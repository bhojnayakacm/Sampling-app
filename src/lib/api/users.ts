import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

/**
 * Fetch all users (email is now directly on profiles table).
 */
export function useAllUsers() {
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Profile[];
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
 * Update a user's role with smart department handling.
 *
 * - Changing TO 'requester': requires department to be provided
 * - Changing FROM 'requester': automatically clears department
 * - Other changes: role only
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      newRole,
      department,
    }: {
      userId: string;
      newRole: string;
      department?: string | null;
    }) => {
      const updatePayload: Record<string, unknown> = { role: newRole };

      if (newRole === 'requester') {
        // Setting to requester: department is required
        if (!department) {
          throw new Error('Department is required when assigning the Requester role');
        }
        updatePayload.department = department;
      } else {
        // Any other role: clear department
        updatePayload.department = null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
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

/**
 * Toggle user active status (soft delete)
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

/**
 * Delete user by admin (calls RPC function)
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('delete_user_by_admin', {
        target_user_id: userId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
  });
}
