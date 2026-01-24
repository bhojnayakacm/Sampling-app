import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  profileError: boolean;
  signOut: () => Promise<void>;
  retryFetchProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Retry configuration
const RETRY_DELAYS = [500, 1000, 2000]; // Exponential backoff: 0.5s, 1s, 2s
const MAX_LOADING_TIME = 10000; // Safety timeout: 10 seconds max

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  // Refs for stability - these don't trigger re-renders
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const retryCountRef = useRef(0);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Clear all pending timeouts
  const clearTimeouts = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Try to create profile (fallback if DB trigger failed)
  const tryCreateProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;

      // Extract and validate role
      let role = authUser.user_metadata?.role?.toLowerCase() || 'requester';
      if (!['admin', 'coordinator', 'requester', 'maker'].includes(role)) {
        role = 'requester';
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          role: role,
          full_name: authUser.user_metadata?.full_name || authUser.email || 'User',
          phone: authUser.user_metadata?.phone || null,
          department: authUser.user_metadata?.department || null,
        })
        .select()
        .single();

      if (error) {
        // Unique constraint violation = trigger already created it
        if (error.code === '23505') {
          console.log('[Auth] Profile already exists (created by trigger), will retry fetch');
          return null;
        }
        throw error;
      }

      console.log('[Auth] Profile created successfully');
      return data as Profile;
    } catch (error) {
      console.error('[Auth] Error creating profile:', error);
      return null;
    }
  }, []);

  // Core fetch function - uses refs to avoid dependency issues
  const fetchProfileWithRetry = useCallback(async (userId: string, isRetry = false) => {
    if (!isMountedRef.current) return;

    // STABILITY CHECK 1: Already fetching for this user
    if (isFetchingRef.current && !isRetry) {
      console.log('[Auth] Already fetching, skipping duplicate request');
      return;
    }

    // STABILITY CHECK 2: Already have profile for this user
    if (!isRetry && lastFetchedUserIdRef.current === userId) {
      console.log('[Auth] Already have profile for this user, skipping fetch');
      setLoading(false);
      return;
    }

    // Mark as fetching
    if (!isRetry) {
      isFetchingRef.current = true;
      retryCountRef.current = 0;
      setProfileError(false);
      setLoading(true);

      // Set safety timeout to prevent infinite loading
      clearTimeouts();
      safetyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          console.warn('[Auth] Safety timeout reached - forcing loading to complete');
          isFetchingRef.current = false;
          setLoading(false);
          setProfileError(true);
        }
      }, MAX_LOADING_TIME);
    }

    try {
      console.log(`[Auth] Fetching profile for ${userId} (attempt ${retryCountRef.current + 1}/${RETRY_DELAYS.length + 1})`);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!isMountedRef.current) return;

      if (error) {
        // Profile not found - could be race condition with DB trigger
        if (error.code === 'PGRST116') {
          console.log('[Auth] Profile not found, attempting to create or retry...');

          // Try creating the profile (handles case where trigger failed)
          const createdProfile = await tryCreateProfile(userId);
          if (createdProfile) {
            lastFetchedUserIdRef.current = userId;
            isFetchingRef.current = false;
            clearTimeouts();
            setProfile(createdProfile);
            setLoading(false);
            return;
          }

          // If creation failed (likely trigger is running), retry fetch
          if (retryCountRef.current < RETRY_DELAYS.length) {
            const delay = RETRY_DELAYS[retryCountRef.current];
            console.log(`[Auth] Retrying in ${delay}ms...`);
            retryCountRef.current++;

            retryTimeoutRef.current = setTimeout(() => {
              fetchProfileWithRetry(userId, true);
            }, delay);
            return;
          }

          // All retries exhausted
          console.error('[Auth] Profile fetch failed after all retries');
          isFetchingRef.current = false;
          clearTimeouts();
          setProfileError(true);
          setLoading(false);
          return;
        }

        // Other errors
        throw error;
      }

      // Success - profile found
      console.log('[Auth] Profile loaded successfully for', userId);
      lastFetchedUserIdRef.current = userId;
      isFetchingRef.current = false;
      clearTimeouts();
      setProfile(data);
      setProfileError(false);
      setLoading(false);
    } catch (error) {
      console.error('[Auth] Error fetching profile:', error);

      if (!isMountedRef.current) return;

      // Retry on network errors
      if (retryCountRef.current < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[retryCountRef.current];
        console.log(`[Auth] Retrying after error in ${delay}ms...`);
        retryCountRef.current++;

        retryTimeoutRef.current = setTimeout(() => {
          fetchProfileWithRetry(userId, true);
        }, delay);
        return;
      }

      isFetchingRef.current = false;
      clearTimeouts();
      setProfileError(true);
      setLoading(false);
    }
  }, [clearTimeouts, tryCreateProfile]);

  // Manual retry function (exposed to UI for error recovery)
  const retryFetchProfile = useCallback(() => {
    if (user?.id) {
      console.log('[Auth] Manual retry triggered');
      // Reset the last fetched ID to force a fresh fetch
      lastFetchedUserIdRef.current = null;
      isFetchingRef.current = false;
      fetchProfileWithRetry(user.id);
    }
  }, [user?.id, fetchProfileWithRetry]);

  // Main auth effect - STABLE dependencies only
  useEffect(() => {
    isMountedRef.current = true;
    let initialLoadComplete = false;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMountedRef.current) return;
      initialLoadComplete = true;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        fetchProfileWithRetry(initialSession.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMountedRef.current) return;

      // Skip if this fires before initial load (Supabase sometimes double-fires)
      if (!initialLoadComplete) return;

      const newUserId = newSession?.user?.id ?? null;
      const previousUserId = lastFetchedUserIdRef.current;

      console.log(`[Auth] Auth state changed: ${event}, userId: ${newUserId}`);

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // STABILITY CHECK: Only fetch if user actually changed
        if (newUserId !== previousUserId) {
          console.log('[Auth] User changed, fetching new profile');
          lastFetchedUserIdRef.current = null; // Reset to allow fresh fetch
          isFetchingRef.current = false;
          fetchProfileWithRetry(newSession.user.id);
        } else {
          console.log('[Auth] Same user, skipping profile fetch');
          // Make sure we're not stuck in loading state
          setLoading(false);
        }
      } else {
        // User signed out
        clearTimeouts();
        lastFetchedUserIdRef.current = null;
        isFetchingRef.current = false;
        setProfile(null);
        setProfileError(false);
        setLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      clearTimeouts();
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - runs once on mount

  const signOut = useCallback(async () => {
    clearTimeouts();
    lastFetchedUserIdRef.current = null;
    isFetchingRef.current = false;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setProfileError(false);
  }, [clearTimeouts]);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      profileError,
      signOut,
      retryFetchProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
