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
