// User Roles
export type UserRole = 'admin' | 'coordinator' | 'marketing' | 'maker';

// Request Status
export type RequestStatus =
  | 'pending_approval'
  | 'approved'
  | 'assigned'
  | 'in_production'
  | 'ready'
  | 'dispatched'
  | 'rejected';

// Priority Level
export type PriorityLevel = 'high' | 'medium' | 'low';

// Unit Type
export type UnitType = 'pieces' | 'sqft';

// Profile
export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Client
export interface Client {
  id: string;
  name: string;
  phone: string;
  default_address: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Request
export interface Request {
  id: string;
  request_number: string;
  created_by: string;
  assigned_to: string | null;
  status: RequestStatus;
  priority: PriorityLevel;
  requested_date: string;

  // Client info
  client_name: string;
  client_phone: string;
  delivery_address: string;

  // Marble specifications
  sample_name: string;
  stone_type: string;
  dimensions: string;
  thickness: string;
  finish: string;
  edge_profile: string;
  quantity: number;
  unit: UnitType;
  remarks: string | null;

  // Image
  image_url: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  dispatched_at: string | null;

  // Related data (populated via joins)
  creator?: {
    id: string;
    full_name: string;
    role: UserRole;
  };
  maker?: {
    id: string;
    full_name: string;
    role: UserRole;
  };
}

// Request with creator and maker names (from view)
export interface RequestSummary extends Request {
  created_by_name: string | null;
  assigned_to_name: string | null;
}

// Request History
export interface RequestHistory {
  id: string;
  request_id: string;
  changed_by: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

// Form data for creating a new request
export interface CreateRequestInput {
  requested_date: string;
  priority: PriorityLevel;
  client_name: string;
  client_phone: string;
  delivery_address: string;
  sample_name: string;
  stone_type: string;
  dimensions: string;
  thickness: string;
  finish: string;
  edge_profile: string;
  quantity: number;
  unit: UnitType;
  remarks?: string;
  image?: File;
}

// Dashboard stats
export interface DashboardStats {
  total_requests: number;
  pending: number;
  in_production: number;
  dispatched: number;
}
