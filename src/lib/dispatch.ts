// ============================================================
// Dispatch rosters (shared)
// ============================================================
// Hard-coded operational lists used by the dispatch + reassignment
// flows. Field boys are not profile rows — they are a fixed roster of
// "Name - Phone" strings, stored verbatim in
// requests.dispatch_metadata.field_boy (migration 1016). Keep this the
// single source of truth so DispatchDialog (assign at dispatch) and
// ReassignFieldBoyDialog (re-assign after dispatch) never drift apart.

export const FIELD_BOYS = [
  'Vinay Gupta - +91 99582 08103',
  'Kailash - +91 92129 17601',
  'Deendayal - +91 98997 08047',
  'Khem Chand - +91 85954 66228',
  'Manoj Gupta - +91 82995 61600',
] as const;

export type FieldBoy = (typeof FIELD_BOYS)[number];
