import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Sanitises anything a user types OR pastes into a 10-digit mobile field.
//
// THE BUG THIS FIXES: the inputs used to combine `maxLength={10}` with a
// first-10 slice. Pasting "+91 9876543210" was truncated by the browser to
// "+91 987654" BEFORE onChange even fired, and what survived the strip was
// "987654" — six digits of a ten-digit number. Even without maxLength, taking
// the FIRST 10 of "919876543210" yields "9198765432", a wrong number that
// still passes a /^\d{10}$/ check. Silent corruption either way.
//
// Rules:
//   • Drop every non-digit — spaces, dashes, parentheses, dots, "+".
//   • 10 digits or fewer: return as-is (partial input while typing is fine;
//     the submit-time /^\d{10}$/ validation still has the final say).
//   • More than 10: keep the LAST 10. Country codes and trunk prefixes are
//     leading, so "919876543210", "0919876543210" and "09876543210" all
//     collapse to "9876543210" without needing a parsing library.
//
// Callers must NOT also set maxLength on the input, or the browser clips the
// pasted text before this ever sees it.
export function formatPhoneNumberInput(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

// Normalises a custom user-typed string (currently used for custom product
// qualities) to a consistent visual form so "abc", "ABC", and "Abc" don't all
// coexist as separate qualities. Rules:
//   • Trim outer whitespace and collapse internal whitespace runs to a single
//     space so accidental double-spaces / tabs disappear.
//   • Capitalise the first letter of every word, lowercase the rest of each
//     word. Honours hyphens and slashes as word boundaries so multi-part
//     names like "off-white" / "black/gold" capitalise both halves.
//   • Empty input returns an empty string unchanged.
//
// This is intentionally tolerant: words shorter than 1 character (i.e. empty
// segments produced by adjacent separators) are skipped, so inputs like
// "  --foo" don't crash.
export function titleCaseQuality(input: string): string {
  if (!input) return ''
  const collapsed = input.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  return collapsed.replace(/([A-Za-z0-9]+)/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  )
}
