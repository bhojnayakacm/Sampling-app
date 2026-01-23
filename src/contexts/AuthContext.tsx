import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  profileError: boolean; // True if profile fetch failed after all retries
  signOut: () => Promise<void>;
  retryFetchProfile: () => void; // Manual retry for error recovery
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

  // Refs to track retry state and prevent memory leaks
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

  // Fetch profile with retry logic
  const fetchProfileWithRetry = useCallback(async (userId: string, isRetry = false) => {
    if (!isMountedRef.current) return;

    // Reset state for fresh fetch (not retry)
    if (!isRetry) {
      retryCountRef.current = 0;
      setProfileError(false);
      setLoading(true);

      // Set safety timeout to prevent infinite loading
      clearTimeouts();
      safetyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && loading) {
          console.warn('[Auth] Safety timeout reached - forcing loading to complete');
          setLoading(false);
          setProfileError(true);
        }
      }, MAX_LOADING_TIME);
    }

    try {
      console.log(`[Auth] Fetching profile (attempt ${retryCountRef.current + 1}/${RETRY_DELAYS.length + 1})`);

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
          const created = await tryCreateProfile(userId);
          if (created) {
            clearTimeouts();
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
          clearTimeouts();
          setProfileError(true);
          setLoading(false);
          return;
        }

        // Other errors
        throw error;
      }

      // Success - profile found
      console.log('[Auth] Profile loaded successfully');
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

      clearTimeouts();
      setProfileError(true);
      setLoading(false);
    }
  }, [clearTimeouts, loading]);

  // Try to create profile (fallback if DB trigger failed)
  async function tryCreateProfile(userId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Extract and validate role
      let role = user.user_metadata?.role?.toLowerCase() || 'requester';
      if (!['admin', 'coordinator', 'requester', 'maker'].includes(role)) {
        role = 'requester';
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          role: role,
          full_name: user.user_metadata?.full_name || user.email || 'User',
          phone: user.user_metadata?.phone || null,
          department: user.user_metadata?.department || null,
        })
        .select()
        .single();

      if (error) {
        // Unique constraint violation = trigger already created it
        // This is actually OK - we'll fetch it on next retry
        if (error.code === '23505') {
          console.log('[Auth] Profile already exists (created by trigger), will retry fetch');
          return false;
        }
        throw error;
      }

      if (isMountedRef.current) {
        setProfile(data);
        console.log('[Auth] Profile created successfully');
      }
      return true;
    } catch (error) {
      console.error('[Auth] Error creating profile:', error);
      return false;
    }
  }

  // Manual retry function (exposed to UI for error recovery)
  const retryFetchProfile = useCallback(() => {
    if (user?.id) {
      console.log('[Auth] Manual retry triggered');
      fetchProfileWithRetry(user.id);
    }
  }, [user?.id, fetchProfileWithRetry]);

  // Main auth effect
  useEffect(() => {
    isMountedRef.current = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMountedRef.current) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfileWithRetry(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMountedRef.current) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfileWithRetry(session.user.id);
      } else {
        clearTimeouts();
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
  }, [fetchProfileWithRetry, clearTimeouts]);

  async function signOut() {
    clearTimeouts();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setProfileError(false);
  }

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
