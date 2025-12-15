import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

// Extended profile type with email for user management
export interface UserWithEmail extends Profile {
  email: string;
}

/**
 * Fetch all users with their email addresses
 * Combines data from profiles table and auth.users
 */
export function useAllUsers() {
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      // Get profiles from database
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Get auth users to fetch emails
      const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        // If admin.listUsers fails (permission issue), return profiles without emails
        console.warn('Could not fetch user emails:', authError);
        return profiles.map(profile => ({
          ...profile,
          email: 'N/A',
        })) as UserWithEmail[];
      }

      // Merge email into profiles
      const usersWithEmail = profiles.map(profile => {
        const authUser = users.find(u => u.id === profile.id);
        return {
          ...profile,
          email: authUser?.email || 'N/A',
        };
      }) as UserWithEmail[];

      return usersWithEmail;
    },
  });
}

/**
 * Fetch all active makers for assignment dropdowns
 */
export function useMakers() {
  return useQuery({
    queryKey: ['makers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'maker')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Update a user's role
 * @param userId - User ID to update
 * @param newRole - New role (marketing, coordinator, maker, admin)
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate queries to refresh user list
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
  });
}

/**
 * Toggle user active status (soft delete)
 * @param userId - User ID to toggle
 * @param isActive - New active status
 */
export function useToggleUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
  });
}
