// ============================================================
// USER ROLES
// ============================================================

export type UserRole = 'admin' | 'coordinator' | 'requester' | 'maker' | 'dispatcher';

// ============================================================
// REQUEST ENUMS
// ============================================================

// Request Status (includes draft for incomplete requests)
export type RequestStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'assigned'
  | 'in_production'
  | 'ready'
  | 'dispatched'
  | 'received'
  | 'rejected';

// Priority (simplified from high/medium/low)
export type Priority = 'urgent' | 'normal';

// ============================================================
// NEW FORM FIELD TYPES
// ============================================================

// Section 1: Requester Details
export type Department = 'sales' | 'marketing' | 'logistics';

export type PickupResponsibility =
  | 'self_pickup'
  | 'courier'
  | 'company_vehicle'
  | 'field_boy'
  | '3rd_party'
  | 'other';

// Section 2: Client Project Details
export type ClientType = 'retail' | 'architect' | 'project' | 'others';

// Section 3: Sample Request Details
export type ProductType = 'marble' | 'tile' | 'magro_stone' | 'terrazzo' | 'quartz';

export type Quality = 'standard' | 'premium' | string; // Allow custom quality strings

export type Purpose = 'new_launch' | 'client_presentation' | 'mock_up' | 'approval';

// ============================================================
// DYNAMIC QUALITY OPTIONS BY PRODUCT TYPE
// Now imported from @/lib/productData.ts for the full list
// This is kept for backward compatibility but the Combobox uses productData directly
// ============================================================

export const PRODUCT_QUALITY_OPTIONS: Record<ProductType, string[]> = {
  marble: ['Custom'], // Full list in productData.ts
  tile: ['Custom'], // Full list in productData.ts
  magro_stone: ['Custom'], // Full list in productData.ts
  terrazzo: ['Custom'], // Full list in productData.ts
  quartz: ['Custom'], // Full list in productData.ts
};

// ============================================================
// MULTI-PRODUCT TYPES
// ============================================================

// Form state for product items (used in UI)
export interface ProductItem {
  id: string; // Unique identifier for React keys (client-side only)
  product_type: ProductType | '';

  // Multi-select quality support (Batch Entry feature)
  selected_qualities: string[]; // Array of selected verified qualities from database
  quality_custom?: string; // Free text for unlisted quality (one-off, never saved to master DB)
  use_custom_quality?: boolean; // Toggle: true = using manual entry instead of multi-select

  // Legacy single quality field (kept for backward compatibility when loading drafts)
  quality: string;

  sample_size: string;
  sample_size_remarks?: string;
  thickness: string;
  thickness_remarks?: string;
  finish: string;
  finish_remarks?: string;
  quantity: number;
  image_file?: File | null;
  image_preview?: string | null;
  image_url?: string | null; // For existing images when editing
}

// Database model for request items (stored in request_items table)
export interface RequestItemDB {
  id: string;
  request_id: string;
  item_index: number;
  product_type: string;
  quality: string;
  quality_custom: string | null;
  sample_size: string;
  sample_size_remarks: string | null;
  thickness: string;
  thickness_remarks: string | null;
  finish: string | null;
  finish_remarks: string | null;
  quantity: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// Input for creating request items
export interface CreateRequestItemInput {
  request_id: string;
  item_index: number;
  product_type: string;
  quality: string;
  quality_custom?: string | null;
  sample_size: string;
  sample_size_remarks?: string | null;
  thickness: string;
  thickness_remarks?: string | null;
  finish?: string | null;
  finish_remarks?: string | null;
  quantity: number;
  image_url?: string | null;
}

export type PackingType = 'wooden_crate' | 'cardboard' | 'bubble_wrap' | 'foam' | 'custom';

// ============================================================
// PROFILE
// ============================================================

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  department: string | null;  // Added: Department captured at signup
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// REQUEST (NEW SCHEMA)
// ============================================================

export interface Request {
  // Core fields
  id: string;
  request_number: string;
  status: RequestStatus;
  created_by: string;
  assigned_to: string | null;

  // Section 1: Requester Details
  department: string;  // Department type
  mobile_no: string;
  pickup_responsibility: string;  // PickupResponsibility type
  pickup_remarks: string | null;
  delivery_method_remark: string | null;  // Coordinator's remark when changing delivery method
  is_delivery_method_edited: boolean | null;  // True if coordinator modified the pickup method
  delivery_address: string | null;  // Not required if self_pickup
  is_address_edited: boolean | null;  // True if coordinator modified the address
  address_edit_remark: string | null;  // Coordinator's remark when changing address
  required_by: string;  // ISO timestamp
  priority: Priority;

  // Section 2: Client Project Details
  client_type: string;  // ClientType
  client_type_remarks: string | null;
  client_contact_name: string;  // Name of client/architect/contacted person based on client_type
  client_phone: string;
  client_email: string | null;
  firm_name: string;  // Company or firm name
  site_location: string;

  // Dynamic fields based on client_type
  supporting_architect_name: string | null;  // For Retail clients
  architect_firm_name: string | null;  // For Retail clients
  project_type: string | null;  // For Project clients (Hotel, Resort, Hospital, Other)
  project_type_custom: string | null;  // For Project clients when "Other" is selected
  project_placeholder: string | null;  // For Project clients

  // Section 3: Sample Request Details (DEPRECATED - kept for backward compatibility)
  // New requests store product data in request_items table
  product_type: string;  // ProductType
  quality: string;  // Quality
  sample_size: string;
  sample_size_remarks: string | null;
  finish: string | null;  // Not required for terrazzo/quartz
  finish_remarks: string | null;
  thickness: string;
  thickness_remarks: string | null;
  quantity: number;
  purpose: string;  // Purpose type
  packing_details: string;  // PackingType
  packing_remarks: string | null;

  // Image (DEPRECATED - kept for backward compatibility)
  image_url: string | null;

  // Multi-product support (new)
  item_count: number;  // Number of items in this request
  items?: RequestItemDB[];  // Populated via join with request_items

  // Requester message (special instructions from requester)
  requester_message: string | null;

  // Coordinator message (for approval/rejection notes)
  coordinator_message: string | null;

  // Dispatch notes (for courier/tracking info)
  dispatch_notes: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  received_by: string | null;

  // Deadline history (audit trail for required_by changes)
  required_by_history: RequiredByHistoryEntry[] | null;

  // Related data (populated via joins)
  creator?: {
    id: string;
    full_name: string;
    role: UserRole;
    department: string | null;
  };
  maker?: {
    id: string;
    full_name: string;
    role: UserRole;
    department: string | null;
  };
}

// ============================================================
// FORM INPUT FOR CREATING NEW REQUEST
// ============================================================

export interface CreateRequestInput {
  // Section 1: Requester Details
  // name is auto-filled from profile (not in form)
  department: Department;
  mobile_no: string;
  pickup_responsibility: PickupResponsibility;
  pickup_remarks?: string;  // Required if pickup_responsibility === 'other'
  delivery_address?: string;  // Not required if pickup_responsibility === 'self_pickup'
  required_by: string;  // datetime-local format
  priority: Priority;

  // Section 2: Client Project Details
  client_type: ClientType;
  client_type_remarks?: string;  // Required if client_type === 'others'
  client_contact_name: string;  // Name of client/architect/contacted person based on client_type
  client_phone: string;
  client_email?: string;
  firm_name: string;  // Company or firm name
  site_location: string;

  // Section 3: Sample Request Details
  product_type: ProductType;
  quality: Quality;
  sample_size: string;
  sample_size_remarks?: string;  // Required if sample_size === 'custom'
  finish?: string;  // Not required for terrazzo/quartz
  finish_remarks?: string;  // Required if finish === 'custom'
  thickness: string;
  thickness_remarks?: string;  // Required if thickness === 'custom'
  quantity: number;
  purpose: Purpose;
  packing_details: PackingType;
  packing_remarks?: string;  // Required if packing_details === 'custom'

  // Image (optional)
  image?: File;
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export interface DashboardStats {
  total: number;
  drafts: number;
  pending: number;
  in_production: number;
  dispatched: number;
}

// ============================================================
// PRODUCT-SPECIFIC OPTIONS
// ============================================================

// Size options by product type
export const PRODUCT_SIZE_OPTIONS: Record<ProductType, string[]> = {
  marble: ['12x12', '6x4', '6x6', '12x9', 'A4', '2x2', '24x24', 'Custom'],
  tile: ['4x4', '4x8', '12x12', '10x10', '4x6', 'Custom'],
  magro_stone: ['4x4', 'Custom'],
  terrazzo: ['4x4', '4x8', '12x12', '10x10', '4x6', 'Custom'],
  quartz: ['4x4', '4x8', '12x12', '10x10', '4x6', 'Custom'],
};

// Finish options by product type
export const PRODUCT_FINISH_OPTIONS: Record<ProductType, string[] | null> = {
  marble: ['Polish', 'Honed', 'Leather/Brushed', 'Sandblasted', 'Lappato', 'Satin', 'Custom'],
  tile: ['Matt', 'Satin', 'Glossy', 'High Glossy', 'Textured', 'Carvin', 'Lappato', 'Rustic', 'Grew', 'Customize'],
  magro_stone: ['Semi gloss', 'Gloss', 'Matt', 'Custom'],
  terrazzo: null,  // No finish for terrazzo
  quartz: null,    // No finish for quartz
};

// Thickness options by product type
export const PRODUCT_THICKNESS_OPTIONS: Record<ProductType, string[]> = {
  marble: ['20mm', '18mm', '16mm', 'Custom'],
  tile: ['5mm', '6mm', '9mm', '12mm', '15mm', '16mm', '20mm', 'Custom'],
  magro_stone: ['20mm', 'Custom'],
  terrazzo: ['20mm', 'Custom'],
  quartz: ['16mm', 'Custom'],
};

// ============================================================
// REQUEST TRACKING & HISTORY
// ============================================================

export interface RequestStatusHistory {
  id: string;
  request_id: string;
  status: RequestStatus;
  changed_at: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
  changer?: {
    id: string;
    full_name: string;
    role: UserRole;
  };
}

export interface RequestTimeline {
  request_id: string;
  request_number: string;
  current_status: RequestStatus;
  history: Array<{
    status: RequestStatus;
    changed_at: string;
    changed_by: string | null;
    changer_name: string | null;
  }>;
}

// ============================================================
// REQUIRED BY (DEADLINE) HISTORY
// ============================================================

export interface RequiredByHistoryEntry {
  old_date: string;      // ISO timestamp of the previous deadline
  new_date: string;      // ISO timestamp of the new deadline
  reason: string;        // Mandatory reason for the change
  changed_by_name: string;  // Name of the coordinator who made the change
  timestamp: string;     // ISO timestamp when the change was made
}
