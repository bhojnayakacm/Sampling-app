// ============================================================
// USER ROLES
// ============================================================

export type UserRole =
  | 'admin'
  | 'coordinator'           // legacy — kept for backward compat; no new users assigned
  | 'marble_coordinator'    // new: sees only marble requests
  | 'magro_coordinator'     // new: sees only magro requests
  | 'requester'
  | 'maker'
  | 'dispatcher';

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
export type ClientType = 'retail' | 'architect' | 'project' | 'other' | string;

// ============================================================
// CATEGORY & PRODUCT TYPE SYSTEM
// ============================================================

// Top-level category: the 2 routing buckets
export type RequestCategory = 'marble' | 'magro';

// Sub-category: only applies to magro items
export type SubCategory = 'tile' | 'stone' | 'quartz' | 'terrazzo';

// Internal key for looking up per-product-type option arrays
// (marble has its own key; magro items use their sub_category as key)
export type OptionsKey = 'marble' | 'tile' | 'stone' | 'quartz' | 'terrazzo';

// Legacy type kept so analytics / display code can gradually migrate
export type ProductType = RequestCategory;

export type Quality = 'standard' | 'premium' | string; // Allow custom quality strings

export type Purpose = 'new_launch' | 'client_presentation' | 'mock_up' | 'approval';

// ============================================================
// CATEGORY & SUB-CATEGORY LABELS / HELPERS
// ============================================================

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  marble: 'Marble',
  magro: 'Magro',
};

export const MAGRO_SUB_CATEGORIES: SubCategory[] = ['tile', 'stone', 'quartz', 'terrazzo'];

export const SUB_CATEGORY_LABELS: Record<SubCategory, string> = {
  tile: 'Tile',
  stone: 'Stone',
  quartz: 'Quartz',
  terrazzo: 'Terrazzo',
};

/**
 * Maps a (category, sub_category) pair to the OptionsKey used for
 * size, thickness, finish, and quality option arrays.
 *
 * - marble → 'marble'
 * - magro + tile → 'tile'
 * - magro + stone → 'stone'
 * - magro + quartz → 'quartz'
 * - magro + terrazzo → 'terrazzo'
 * - incomplete selection → null
 */
export function getOptionsKey(
  category: RequestCategory | '',
  sub_category: SubCategory | '',
): OptionsKey | null {
  if (category === 'marble') return 'marble';
  if (category === 'magro' && sub_category) return sub_category as OptionsKey;
  return null;
}

// ============================================================
// MULTI-PRODUCT TYPES
// ============================================================

// Form state for product items (used in UI)
export interface ProductItem {
  id: string; // Unique identifier for React keys (client-side only)

  // Two-step product type selection
  category: RequestCategory | '';     // 'marble' | 'magro' | ''
  sub_category: SubCategory | '';     // populated only when category = 'magro'

  // Multi-select quality support (Batch Entry feature)
  selected_qualities: string[]; // Array of selected verified qualities from database

  // Legacy single quality field (kept for backward compatibility when loading drafts)
  quality: string;

  // Primary attribute fields — store custom text directly when "Other" is selected
  sample_size: string;
  sample_size_custom?: string; // UI-only: custom text when sample_size select = "Other"
  thickness: string;
  thickness_custom?: string;   // UI-only: custom text when thickness select = "Other"
  finish: string;
  finish_custom?: string;      // UI-only: custom text when finish select = "Other"
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
  product_type: RequestCategory;  // 'marble' | 'magro'
  sub_category: SubCategory | null; // 'tile' | 'stone' | 'quartz' | 'terrazzo' | null
  quality: string;
  sample_size: string;
  thickness: string;
  finish: string | null;
  quantity: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// Input for creating request items
export interface CreateRequestItemInput {
  request_id: string;
  item_index: number;
  product_type: RequestCategory;    // 'marble' | 'magro'
  sub_category?: SubCategory | null; // null for marble, required for magro
  quality: string;
  sample_size: string;
  thickness: string;
  finish?: string | null;
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
  email: string | null;       // Synced from auth.users at signup
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

  // Category routing (set at submission time; null for mixed drafts)
  category: RequestCategory | null;

  // Section 1: Requester Details
  department: string;  // Department type
  mobile_no: string;
  pickup_responsibility: string;  // PickupResponsibility type
  delivery_method_remark: string | null;  // Coordinator's remark when changing delivery method
  is_delivery_method_edited: boolean | null;  // True if coordinator modified the pickup method
  delivery_address: string | null;  // Not required if self_pickup
  is_address_edited: boolean | null;  // True if coordinator modified the address
  address_edit_remark: string | null;  // Coordinator's remark when changing address
  required_by: string;  // ISO timestamp
  priority: Priority;

  // Section 2: Client Project Details
  client_type: string;  // ClientType — stores custom text directly when "Other" is selected
  client_contact_name: string;  // Name of client/architect/contacted person based on client_type
  client_phone: string;
  client_email: string | null;
  firm_name: string;  // Company or firm name
  site_location: string;

  // Dynamic fields based on client_type
  supporting_architect_name: string | null;  // For Retail clients
  architect_firm_name: string | null;  // For Retail clients
  project_type: string | null;  // For Project clients — stores custom text directly when "Other" is selected
  project_placeholder: string | null;  // For Project clients

  // Section 3: Sample Request Details
  purpose: string;  // Purpose type
  packing_details: string;  // PackingType
  packing_remarks: string | null;

  // Multi-product support
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
    phone: string | null;
  };
  maker?: {
    id: string;
    full_name: string;
    role: UserRole;
    department: string | null;
  };
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
// PRODUCT-SPECIFIC OPTIONS (keyed by OptionsKey)
// ============================================================

// Size options by OptionsKey
export const PRODUCT_SIZE_OPTIONS: Record<OptionsKey, string[]> = {
  marble: ['12x12', '6x4', '6x6', '12x9', 'A4', '2x2', '24x24', 'Other'],
  tile: ['4x4', '4x8', '12x12', '10x10', '4x6', 'Other'],
  stone: ['4x4', 'Other'],
  terrazzo: ['4x4', '4x8', '12x12', '10x10', '4x6', 'Other'],
  quartz: ['4x4', '4x8', '12x12', '10x10', '4x6', 'Other'],
};

// Finish options by OptionsKey (null = no finish field shown)
export const PRODUCT_FINISH_OPTIONS: Record<OptionsKey, string[] | null> = {
  marble: ['Polish', 'Honed', 'Leather/Brushed', 'Sandblasted', 'Lappato', 'Satin', 'Other'],
  tile: ['Matt', 'Satin', 'Glossy', 'High Glossy', 'Textured', 'Carvin', 'Lappato', 'Rustic', 'Grew', 'Other'],
  stone: ['Semi gloss', 'Gloss', 'Matt', 'Other'],
  terrazzo: null,  // No finish for terrazzo
  quartz: null,    // No finish for quartz
};

// Thickness options by OptionsKey
export const PRODUCT_THICKNESS_OPTIONS: Record<OptionsKey, string[]> = {
  marble: ['20mm', '18mm', '16mm', 'Other'],
  tile: ['5mm', '6mm', '9mm', '12mm', '15mm', '16mm', '20mm', 'Other'],
  stone: ['20mm', 'Other'],
  terrazzo: ['20mm', 'Other'],
  quartz: ['16mm', 'Other'],
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
