import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Request, RequestSummary, CreateRequestInput } from '@/types';

// Fetch all requests for the current user (based on role)
export function useRequests() {
  return useQuery({
    queryKey: ['requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          creator:profiles!created_by (
            id,
            full_name,
            role
          ),
          maker:profiles!assigned_to (
            id,
            full_name,
            role
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Request[];
    },
  });
}

// Fetch requests created by current user (for marketing staff)
export function useMyRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-requests', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          creator:profiles!created_by (
            id,
            full_name,
            role
          ),
          maker:profiles!assigned_to (
            id,
            full_name,
            role
          )
        `)
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Request[];
    },
    enabled: !!userId,
  });
}

// Fetch single request by ID
export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: async () => {
      if (!id) throw new Error('Request ID is required');

      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          creator:profiles!created_by (
            id,
            full_name,
            role
          ),
          maker:profiles!assigned_to (
            id,
            full_name,
            role
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Request;
    },
    enabled: !!id,
  });
}

// Get dashboard stats for current user
export function useDashboardStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard-stats', userId],
    queryFn: async () => {
      if (!userId) {
        return {
          total: 0,
          pending: 0,
          in_production: 0,
          dispatched: 0,
        };
      }

      // Fetch user's requests
      const { data, error } = await supabase
        .from('requests')
        .select('status')
        .eq('created_by', userId);

      if (error) throw error;

      // Calculate stats
      const total = data.length;
      const pending = data.filter((r) =>
        ['pending_approval', 'approved', 'assigned'].includes(r.status)
      ).length;
      const in_production = data.filter((r) => r.status === 'in_production').length;
      const dispatched = data.filter((r) => r.status === 'dispatched').length;

      return { total, pending, in_production, dispatched };
    },
    enabled: !!userId,
  });
}

// Get stats for coordinators/admins (all requests)
export function useAllRequestsStats() {
  return useQuery({
    queryKey: ['all-requests-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('status');

      if (error) throw error;

      const total = data.length;
      const pending = data.filter((r) =>
        ['pending_approval', 'approved'].includes(r.status)
      ).length;
      const in_production = data.filter((r) =>
        ['assigned', 'in_production'].includes(r.status)
      ).length;
      const dispatched = data.filter((r) => r.status === 'dispatched').length;

      return { total, pending, in_production, dispatched };
    },
  });
}

// Get stats for makers (assigned to them)
export function useMakerStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['maker-stats', userId],
    queryFn: async () => {
      if (!userId) {
        return {
          assigned: 0,
          in_progress: 0,
          completed: 0,
        };
      }

      // Fetch tasks assigned to this maker
      const { data, error } = await supabase
        .from('requests')
        .select('status')
        .eq('assigned_to', userId);

      if (error) throw error;

      // Calculate stats
      const assigned = data.filter((r) => r.status === 'assigned').length;
      const in_progress = data.filter((r) => r.status === 'in_production').length;
      const completed = data.filter((r) => ['ready', 'dispatched'].includes(r.status)).length;

      return { assigned, in_progress, completed };
    },
    enabled: !!userId,
  });
}

// Update request status (enhanced with auto-timestamps)
export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: string;
      status: string;
    }) => {
      const updates: any = { status };

      // Auto-set timestamps based on status
      if (status === 'dispatched') {
        updates.dispatched_at = new Date().toISOString();
      } else if (status === 'ready') {
        updates.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('requests')
        .update(updates)
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['all-requests-stats'] });
    },
  });
}

// Assign request to maker
export function useAssignRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, makerId }: { requestId: string; makerId: string }) => {
      const { data, error } = await supabase
        .from('requests')
        .update({
          assigned_to: makerId,
          status: 'assigned',
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['all-requests-stats'] });
    },
  });
}
