import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Request, RequestStatus, Priority, UserRole, RequestStatusHistory, RequestItemDB, CreateRequestItemInput, RequiredByHistoryEntry } from '@/types';

// Pagination and filtering parameters
export interface RequestFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: RequestStatus | RequestStatus[] | null;
  priority?: Priority | null;
  overdue?: boolean;
  productType?: string | null;
  userId?: string; // For role-based filtering (requester sees own, maker sees assigned)
  userRole?: UserRole; // To determine filtering logic
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Fetch paginated and filtered requests (SERVER-SIDE)
export function usePaginatedRequests(filters: RequestFilters = {}) {
  const {
    page = 1,
    pageSize = 15,
    search = '',
    status = null,
    priority = null,
    overdue = false,
    productType = null,
    userId,
    userRole,
  } = filters;

  return useQuery({
    queryKey: ['paginated-requests', page, pageSize, search, status, priority, overdue, productType, userId, userRole],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PaginatedResult<Request>> => {
      // Step 1: If filtering by product type, pre-fetch matching request IDs (case-insensitive)
      let productTypeIds: string[] | null = null;

      if (productType) {
        // Normalize: "Magro Stone" → "magro_stone" to match DB enum values
        const normalizedType = productType.toLowerCase().replace(/\s+/g, '_');
        const { data: matchingItems, error: itemsError } = await supabase
          .from('request_items')
          .select('request_id')
          .ilike('product_type', `%${normalizedType}%`);

        if (itemsError) throw itemsError;

        if (!matchingItems || matchingItems.length === 0) {
          return { data: [], count: 0, page, pageSize, totalPages: 0 };
        }

        productTypeIds = [...new Set(matchingItems.map((i) => i.request_id))];
      }

      // Step 2: Build the main requests query
      let query = supabase
        .from('requests')
        .select(`
          *,
          creator:profiles!created_by (
            id,
            full_name,
            role,
            department,
            phone
          ),
          maker:profiles!assigned_to (
            id,
            full_name,
            role,
            department
          )
        `, { count: 'exact' });

      // Apply product type ID filter (from Step 1)
      if (productTypeIds !== null) {
        query = query.in('id', productTypeIds);
      }

      // Role-based filtering
      if (userRole === 'requester' && userId) {
        // Requesters see only their own requests
        query = query.eq('created_by', userId);
      } else if (userRole === 'maker' && userId) {
        // Makers see only requests assigned to them
        query = query.eq('assigned_to', userId);
      } else if (userRole === 'dispatcher') {
        // Dispatchers see field_boy requests that are ready, dispatched, or received
        query = query.eq('pickup_responsibility', 'field_boy').in('status', ['ready', 'dispatched', 'received']);
      } else if (userRole === 'admin' || userRole === 'coordinator') {
        // Admins and coordinators see all requests except drafts
        query = query.neq('status', 'draft');
      }

      // Role-based search filter
      // Note: For staff, we'll do client-side filtering on creator name due to Supabase limitations
      const isStaffSearch = (userRole === 'admin' || userRole === 'coordinator' || userRole === 'maker') && search && search.trim();

      if (search && search.trim()) {
        const searchTerm = search.trim();
        if (userRole === 'requester') {
          // Requesters: Search by Request ID, Client Name, or Company Name
          query = query.or(
            `request_number.ilike.%${searchTerm}%,client_contact_name.ilike.%${searchTerm}%,firm_name.ilike.%${searchTerm}%`
          );
        } else if (userRole === 'admin' || userRole === 'coordinator' || userRole === 'maker') {
          // Staff: Search by Request ID only (creator name search done client-side below)
          query = query.ilike('request_number', `%${searchTerm}%`);
        }
      }

      // Status filter
      if (status) {
        if (Array.isArray(status)) {
          query = query.in('status', status);
        } else {
          query = query.eq('status', status);
        }
      }

      // Priority filter
      if (priority) {
        query = query.eq('priority', priority);
      }

      // Overdue filter: required_by is past AND request is still in an active status
      if (overdue) {
        query = query
          .not('required_by', 'is', null)
          .lt('required_by', new Date().toISOString())
          .in('status', ['pending_approval', 'approved', 'assigned', 'in_production', 'ready', 'dispatched']);
      }

      // Ordering
      query = query.order('created_at', { ascending: false });

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      let filteredData = (data as Request[]) || [];
      let finalCount = count || 0;

      // Client-side filtering for staff searching by creator name
      if (isStaffSearch && search) {
        const searchLower = search.trim().toLowerCase();
        // If the request_number search returned no results, try searching by creator name
        if (filteredData.length === 0) {
          // Re-fetch without search filter to search by creator name
          const { data: allData, error: refetchError } = await supabase
            .from('requests')
            .select(`
              *,
              creator:profiles!created_by (
                id,
                full_name,
                role,
                department,
                phone
              ),
              maker:profiles!assigned_to (
                id,
                full_name,
                role,
                department
              )
            `, { count: 'exact' })
            .neq('status', 'draft')
            .order('created_at', { ascending: false });

          if (refetchError) throw refetchError;

          // Filter by creator name
          filteredData = (allData as Request[])?.filter(req =>
            req.creator?.full_name?.toLowerCase().includes(searchLower)
          ) || [];

          // Apply pagination manually
          finalCount = filteredData.length;
          const from = (page - 1) * pageSize;
          const to = from + pageSize;
          filteredData = filteredData.slice(from, to);
        }
      }

      return {
        data: filteredData,
        count: finalCount,
        page,
        pageSize,
        totalPages: Math.ceil(finalCount / pageSize),
      };
    },
  });
}

// Fetch all requests for the current user (based on role) - LEGACY (for stats)
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

// Fetch requests created by current user (for requester staff)
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
          drafts: 0,
          inProgress: 0,
          dispatched: 0,
          rejected: 0,
          received: 0,
        };
      }

      // Fetch user's requests
      const { data, error } = await supabase
        .from('requests')
        .select('status')
        .eq('created_by', userId);

      if (error) throw error;

      // Calculate stats (exclude drafts from total count)
      const drafts = data.filter((r) => r.status === 'draft').length;
      const total = data.length - drafts; // Total submitted requests (excluding drafts)

      // In Progress: All active statuses before dispatch
      // Includes: pending_approval, approved, assigned, in_production, ready
      const inProgress = data.filter((r) =>
        ['pending_approval', 'approved', 'assigned', 'in_production', 'ready'].includes(r.status)
      ).length;

      const dispatched = data.filter((r) => r.status === 'dispatched').length;
      const rejected = data.filter((r) => r.status === 'rejected').length;
      const received = data.filter((r) => r.status === 'received').length;

      return { total, drafts, inProgress, dispatched, rejected, received };
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

      // Exclude drafts from coordinator/admin view (drafts are not submitted)
      const submittedRequests = data.filter((r) => r.status !== 'draft');
      const total = submittedRequests.length;

      // Pending: ONLY pending_approval (strictly awaiting coordinator action)
      const pending = submittedRequests.filter((r) => r.status === 'pending_approval').length;

      // Approved: awaiting assignment to a maker
      const approved = submittedRequests.filter((r) => r.status === 'approved').length;

      // Assigned: awaiting maker to start work
      const assigned = submittedRequests.filter((r) => r.status === 'assigned').length;

      // In Production: STRICTLY only in_production (maker actively working)
      const in_production = submittedRequests.filter((r) => r.status === 'in_production').length;

      // Ready: sample completed, awaiting dispatch
      const ready = submittedRequests.filter((r) => r.status === 'ready').length;

      // Dispatched: shipped out
      const dispatched = submittedRequests.filter((r) => r.status === 'dispatched').length;

      // Received: delivered and confirmed
      const received = submittedRequests.filter((r) => r.status === 'received').length;

      // Rejected
      const rejected = submittedRequests.filter((r) => r.status === 'rejected').length;

      return { total, pending, approved, assigned, in_production, ready, dispatched, received, rejected };
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
      const completed = data.filter((r) => ['ready', 'dispatched', 'received', 'closed'].includes(r.status)).length;

      return { assigned, in_progress, completed };
    },
    enabled: !!userId,
  });
}

// Get stats for dispatcher (field boy)
export function useDispatcherStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['dispatcher-stats', userId],
    queryFn: async () => {
      if (!userId) return { readyForPickup: 0, dispatchedToday: 0, totalDispatched: 0 };

      // Ready count: system-wide field_boy requests awaiting pickup
      const { count: readyForPickup, error: readyError } = await supabase
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .eq('pickup_responsibility', 'field_boy')
        .eq('status', 'ready');

      if (readyError) throw readyError;

      // Dispatched counts: query status history for THIS user's dispatches
      const { data: dispatchHistory, error: historyError } = await supabase
        .from('request_status_history')
        .select('changed_at')
        .eq('status', 'dispatched')
        .eq('changed_by', userId);

      if (historyError) throw historyError;

      const totalDispatched = dispatchHistory?.length || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dispatchedToday = (dispatchHistory || []).filter(
        (h) => h.changed_at && new Date(h.changed_at) >= today
      ).length;

      return { readyForPickup: readyForPickup || 0, dispatchedToday, totalDispatched };
    },
    enabled: !!userId,
  });
}

// Fetch ready field_boy requests for the dispatcher work list
export function useFieldBoyReadyRequests() {
  return useQuery({
    queryKey: ['field-boy-ready-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          creator:profiles!created_by (
            id,
            full_name,
            role,
            department
          ),
          items:request_items (*)
        `)
        .eq('status', 'ready')
        .eq('pickup_responsibility', 'field_boy')
        .order('required_by', { ascending: true });

      if (error) throw error;
      return (data || []) as Request[];
    },
  });
}

// Fetch dispatcher's dispatch history from request_status_history
// This queries the history table to find all requests THIS user dispatched
export function useDispatcherHistory(userId: string | undefined, timeRange: 'today' | 'all') {
  return useQuery({
    queryKey: ['dispatcher-history', userId, timeRange],
    queryFn: async () => {
      if (!userId) return [];

      // Step 1: Get all request IDs this dispatcher has dispatched
      let historyQuery = supabase
        .from('request_status_history')
        .select('request_id, changed_at')
        .eq('status', 'dispatched')
        .eq('changed_by', userId)
        .order('changed_at', { ascending: false });

      // Apply time filter for "today"
      if (timeRange === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        historyQuery = historyQuery.gte('changed_at', today.toISOString());
      }

      const { data: historyData, error: historyError } = await historyQuery;

      if (historyError) throw historyError;
      if (!historyData || historyData.length === 0) return [];

      // Step 2: Get unique request IDs (a request might have been dispatched multiple times in edge cases)
      const requestIds = [...new Set(historyData.map((h) => h.request_id))];

      // Step 3: Fetch full request details for those IDs
      const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select(`
          *,
          creator:profiles!created_by (
            id,
            full_name,
            role,
            department
          ),
          items:request_items (*)
        `)
        .in('id', requestIds);

      if (requestsError) throw requestsError;

      // Step 4: Sort by dispatch time (most recent first) using the history data
      const dispatchTimeMap = new Map(
        historyData.map((h) => [h.request_id, new Date(h.changed_at).getTime()])
      );

      const sortedRequests = (requests || []).sort((a, b) => {
        const timeA = dispatchTimeMap.get(a.id) || 0;
        const timeB = dispatchTimeMap.get(b.id) || 0;
        return timeB - timeA;
      });

      // Add dispatched_at from history for display purposes
      return sortedRequests.map((r) => ({
        ...r,
        _dispatchedByMeAt: historyData.find((h) => h.request_id === r.id)?.changed_at,
      })) as (Request & { _dispatchedByMeAt?: string })[];
    },
    enabled: !!userId,
  });
}

// Update request status (enhanced with auto-timestamps and optional message)
export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      status,
      message,
      dispatchNotes,
    }: {
      requestId: string;
      status: string;
      message?: string;
      dispatchNotes?: string;
    }) => {
      const updates: any = { status };

      // Add coordinator message if provided (for approve/reject)
      if (message !== undefined) {
        updates.coordinator_message = message;
      }

      // Add dispatch notes if provided (for dispatch action)
      if (dispatchNotes !== undefined) {
        updates.dispatch_notes = dispatchNotes;
      }

      // Auto-set timestamps based on status
      if (status === 'dispatched') {
        updates.dispatched_at = new Date().toISOString();
      } else if (status === 'ready') {
        updates.completed_at = new Date().toISOString();
      } else if (status === 'received') {
        updates.received_at = new Date().toISOString();
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
    onSuccess: (_data, variables) => {
      // Invalidate all relevant caches for instant UI updates
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['request', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items'] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['request-items'] });
      queryClient.invalidateQueries({ queryKey: ['request-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['all-requests-stats'] });
      queryClient.invalidateQueries({ queryKey: ['maker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dispatcher-stats'] });
      queryClient.invalidateQueries({ queryKey: ['field-boy-ready-requests'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
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
    onSuccess: (_data, variables) => {
      // Invalidate all relevant caches for instant UI updates
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['request', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items'] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['request-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['all-requests-stats'] });
      queryClient.invalidateQueries({ queryKey: ['maker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
    },
  });
}

// Update draft request (for editing drafts)
export function useUpdateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, updates }: { requestId: string; updates: any }) => {
      const { data, error } = await supabase
        .from('requests')
        .update(updates)
        .eq('id', requestId)
        .eq('status', 'draft') // Extra safety: only update if still a draft
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
    },
  });
}

// Delete draft request
export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error, count } = await supabase
        .from('requests')
        .delete({ count: 'exact' })
        .eq('id', requestId)
        .eq('status', 'draft') // Extra safety: only delete if it's a draft
        .select();

      if (error) throw error;

      // Verify that a row was actually deleted
      if (!data || data.length === 0 || count === 0) {
        throw new Error('Failed to delete draft. The draft may not exist or you may not have permission to delete it.');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// ============================================================
// TRACKING & DELIVERY CONFIRMATION
// ============================================================

// Fetch status history for a request
export function useRequestTimeline(requestId: string | undefined) {
  return useQuery({
    queryKey: ['request-timeline', requestId],
    queryFn: async () => {
      if (!requestId) throw new Error('Request ID is required');

      const { data, error } = await supabase
        .from('request_status_history')
        .select(`
          id,
          request_id,
          status,
          changed_at,
          changed_by,
          notes,
          created_at,
          changer:profiles!changed_by (
            id,
            full_name,
            role
          )
        `)
        .eq('request_id', requestId)
        .order('changed_at', { ascending: true });

      if (error) throw error;

      // Transform data to match RequestStatusHistory type
      const transformedData = (data || []).map((item: any) => ({
        ...item,
        changer: Array.isArray(item.changer) ? item.changer[0] : item.changer,
      }));

      return transformedData as RequestStatusHistory[];
    },
    enabled: !!requestId,
  });
}

// Mark request as received (delivery confirmation)
export function useMarkAsReceived() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, receivedBy }: { requestId: string; receivedBy: string }) => {
      // First, verify the request status
      const { data: currentRequest, error: fetchError } = await supabase
        .from('requests')
        .select('status, pickup_responsibility')
        .eq('id', requestId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!currentRequest) {
        throw new Error('Request not found or you do not have permission to access it');
      }

      // Allow "ready" → "received" for self-pickup (skips dispatch step)
      const isSelfPickup = currentRequest.pickup_responsibility === 'self_pickup';
      const allowedStatuses = isSelfPickup ? ['dispatched', 'ready'] : ['dispatched'];

      if (!allowedStatuses.includes(currentRequest.status)) {
        throw new Error(
          `Request must be in "${allowedStatuses.join('" or "')}" status to mark as received`
        );
      }

      // Update status to 'received', set timestamp, and record who received it
      const { data, error } = await supabase
        .from('requests')
        .update({
          status: 'received',
          received_at: new Date().toISOString(),
          received_by: receivedBy,
        })
        .eq('id', requestId)
        .select();

      if (error) throw error;

      // CRITICAL: Check if update was actually performed
      // If data is empty, RLS silently blocked the UPDATE (no rows modified)
      if (!data || data.length === 0) {
        const { data: verifyData } = await supabase
          .from('requests')
          .select('status')
          .eq('id', requestId)
          .maybeSingle();

        if (verifyData?.status !== 'received') {
          throw new Error(
            'Permission denied: You do not have permission to update this request. ' +
            'Please contact your administrator if you believe this is an error.'
          );
        }

        return { data: verifyData, requestId };
      }

      return { data: data[0], requestId };
    },
    onSuccess: (result) => {
      const requestId = result.requestId;
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items'] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items', requestId] });
      queryClient.invalidateQueries({ queryKey: ['request-items'] });
      queryClient.invalidateQueries({ queryKey: ['request-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['request-timeline', requestId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['all-requests-stats'] });
      queryClient.invalidateQueries({ queryKey: ['maker-stats'] });
    },
  });
}

// Fetch status history for multiple requests (for batch display)
export function useRequestsTimeline(requestIds: string[]) {
  return useQuery({
    queryKey: ['requests-timeline', requestIds],
    queryFn: async () => {
      if (!requestIds || requestIds.length === 0) return [];

      const { data, error } = await supabase
        .from('request_status_history')
        .select(`
          id,
          request_id,
          status,
          changed_at,
          changed_by,
          notes,
          created_at,
          changer:profiles!changed_by (
            id,
            full_name,
            role
          )
        `)
        .in('request_id', requestIds)
        .order('changed_at', { ascending: true });

      if (error) throw error;

      // Transform data to match RequestStatusHistory type
      const transformedData = (data || []).map((item: any) => ({
        ...item,
        changer: Array.isArray(item.changer) ? item.changer[0] : item.changer,
      }));

      return transformedData as RequestStatusHistory[];
    },
    enabled: requestIds.length > 0,
  });
}

// ============================================================
// DUPLICATE REQUEST DETECTION
// ============================================================

export interface DuplicateCheckParams {
  client_name: string;
  client_phone: string;
  quality: string;
  sample_size: string;
  thickness: string;
  quantity: number;
}

export interface ExistingRequest {
  request_number: string;
  created_at: string;
  requester_name: string;
  status: RequestStatus;
  client_contact_name: string;
  product_type: string;
  quality: string;
  sample_size: string;
  thickness: string;
  quantity: number;
}

export interface DuplicateCheckResult {
  is_duplicate: boolean;
  duplicate_type: 'exact_match' | 'client_match' | null;
  existing_request: ExistingRequest | null;
}

// Check for duplicate requests before submission
export async function checkForDuplicates(params: DuplicateCheckParams): Promise<DuplicateCheckResult> {
  const { data, error } = await supabase.rpc('check_for_duplicates', {
    p_client_name: params.client_name,
    p_client_phone: params.client_phone,
    p_quality: params.quality,
    p_sample_size: params.sample_size,
    p_thickness: params.thickness,
    p_quantity: params.quantity,
  });

  if (error) {
    console.error('Error checking for duplicates:', error);
    throw error;
  }

  // RPC returns an array with a single row
  const result = data?.[0] || { is_duplicate: false, duplicate_type: null, existing_request: null };

  return {
    is_duplicate: result.is_duplicate || false,
    duplicate_type: result.duplicate_type || null,
    existing_request: result.existing_request || null,
  };
}

// ============================================================
// REQUEST ITEMS (MULTI-PRODUCT SUPPORT)
// ============================================================

// Fetch items for a specific request
export function useRequestItems(requestId: string | undefined) {
  return useQuery({
    queryKey: ['request-items', requestId],
    queryFn: async () => {
      if (!requestId) throw new Error('Request ID is required');

      const { data, error } = await supabase
        .from('request_items')
        .select('*')
        .eq('request_id', requestId)
        .order('item_index', { ascending: true });

      if (error) throw error;
      return data as RequestItemDB[];
    },
    enabled: !!requestId,
  });
}

// Fetch request with items (combined query)
export function useRequestWithItems(requestId: string | undefined) {
  return useQuery({
    queryKey: ['request-with-items', requestId],
    queryFn: async () => {
      if (!requestId) throw new Error('Request ID is required');

      // Fetch request
      const { data: request, error: requestError } = await supabase
        .from('requests')
        .select(`
          *,
          creator:profiles!created_by (
            id,
            full_name,
            role,
            department
          ),
          maker:profiles!assigned_to (
            id,
            full_name,
            role,
            department
          )
        `)
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;

      // Fetch items
      const { data: items, error: itemsError } = await supabase
        .from('request_items')
        .select('*')
        .eq('request_id', requestId)
        .order('item_index', { ascending: true });

      if (itemsError) throw itemsError;

      return {
        ...request,
        items: items || [],
      } as Request;
    },
    enabled: !!requestId,
  });
}

// Create request with items (transactional insert)
// IMPORTANT: This function creates EXACTLY ONE parent request, regardless of item quantities
export async function createRequestWithItems(
  requestData: Record<string, any>,
  items: Omit<CreateRequestItemInput, 'request_id'>[]
): Promise<{ request: Request; items: RequestItemDB[] }> {
  console.log('[API] createRequestWithItems called');
  console.log('[API] Items to create:', items.length);
  console.log('[API] Item quantities:', items.map(i => i.quantity));

  // Step 1: Insert EXACTLY ONE parent request
  console.log('[API] Inserting ONE parent request...');
  const { data: request, error: requestError } = await supabase
    .from('requests')
    .insert([{
      ...requestData,
      item_count: items.length,
    }])
    .select()
    .single();

  if (requestError) {
    console.error('[API] Failed to create parent request:', requestError);
    throw requestError;
  }

  console.log('[API] Created parent request:', request.id, request.request_number);

  // Step 2: Insert all items with the request_id (quantity is a field value, NOT a loop count)
  const itemsToInsert: CreateRequestItemInput[] = items.map((item, index) => ({
    ...item,
    request_id: request.id,
    item_index: index,
  }));

  console.log('[API] Inserting', itemsToInsert.length, 'items for request', request.request_number);

  const { data: insertedItems, error: itemsError } = await supabase
    .from('request_items')
    .insert(itemsToInsert)
    .select();

  if (itemsError) {
    console.error('[API] Failed to create items, rolling back request:', itemsError);
    // If items insertion fails, we should ideally rollback the request
    // But since Supabase doesn't support transactions in JS SDK,
    // we'll delete the orphaned request
    await supabase.from('requests').delete().eq('id', request.id);
    throw itemsError;
  }

  console.log('[API] Successfully created request', request.request_number, 'with', insertedItems?.length, 'items');

  return {
    request: request as Request,
    items: insertedItems as RequestItemDB[],
  };
}

// Update request with items (for editing drafts)
export async function updateRequestWithItems(
  requestId: string,
  requestData: Record<string, any>,
  items: Omit<CreateRequestItemInput, 'request_id'>[]
): Promise<{ request: Request; items: RequestItemDB[] }> {
  // Step 1: Update the parent request
  const { data: request, error: requestError } = await supabase
    .from('requests')
    .update({
      ...requestData,
      item_count: items.length,
    })
    .eq('id', requestId)
    .select()
    .single();

  if (requestError) throw requestError;

  // Step 2: Delete existing items
  const { error: deleteError } = await supabase
    .from('request_items')
    .delete()
    .eq('request_id', requestId);

  if (deleteError) throw deleteError;

  // Step 3: Insert new items
  const itemsToInsert: CreateRequestItemInput[] = items.map((item, index) => ({
    ...item,
    request_id: requestId,
    item_index: index,
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from('request_items')
    .insert(itemsToInsert)
    .select();

  if (itemsError) throw itemsError;

  return {
    request: request as Request,
    items: insertedItems as RequestItemDB[],
  };
}

// Hook for creating request with items
export function useCreateRequestWithItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestData,
      items,
    }: {
      requestData: Record<string, any>;
      items: Omit<CreateRequestItemInput, 'request_id'>[];
    }) => {
      return createRequestWithItems(requestData, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['all-requests-stats'] });
    },
  });
}

// Hook for updating request with items
export function useUpdateRequestWithItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      requestData,
      items,
    }: {
      requestId: string;
      requestData: Record<string, any>;
      items: Omit<CreateRequestItemInput, 'request_id'>[];
    }) => {
      return updateRequestWithItems(requestId, requestData, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['request'] });
      queryClient.invalidateQueries({ queryKey: ['request-items'] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// ============================================================
// REQUIRED BY (DEADLINE) MANAGEMENT
// ============================================================

// Hook for updating required_by date with audit trail
export function useUpdateRequiredBy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      newDate,
      reason,
      changedByName,
    }: {
      requestId: string;
      newDate: string;
      reason: string;
      changedByName: string;
    }) => {
      // First, fetch the current request to get existing history and old date
      const { data: currentRequest, error: fetchError } = await supabase
        .from('requests')
        .select('required_by, required_by_history')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Create new history entry
      const historyEntry: RequiredByHistoryEntry = {
        old_date: currentRequest.required_by,
        new_date: newDate,
        reason: reason,
        changed_by_name: changedByName,
        timestamp: new Date().toISOString(),
      };

      // Append to existing history (or create new array)
      const existingHistory: RequiredByHistoryEntry[] = currentRequest.required_by_history || [];
      const newHistory = [...existingHistory, historyEntry];

      // Update the request with new date and history
      const { data, error } = await supabase
        .from('requests')
        .update({
          required_by: newDate,
          required_by_history: newHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['request', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
    },
  });
}
