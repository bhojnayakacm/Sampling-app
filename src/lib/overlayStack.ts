/**
 * Module-level overlay stack counter.
 *
 * Any drawer, bottom-sheet, or picker that pushes its own history entry
 * should increment this when opening and decrement when closing.
 *
 * The form's exit-guard popstate listener checks this counter synchronously:
 * if depth > 0, a sub-overlay owns the current back-press, so the form
 * does nothing.
 */
let depth = 0;

export function pushOverlay() {
  depth++;
}

export function popOverlay() {
  depth = Math.max(0, depth - 1);
}

export function hasOpenOverlay() {
  return depth > 0;
}
