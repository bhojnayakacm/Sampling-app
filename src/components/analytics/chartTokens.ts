/**
 * Chart color tokens for Reports & Analytics — the ONLY place chart colors
 * are defined. Every value here was measured, not eyeballed, against this
 * app's real chart surface (white `bg-white` cards):
 *
 *   Categorical (trend chart, 2 series, adjacent):
 *     #2a78d6 ↔ #eb6834 — CVD ΔE 24.7, normal-vision ΔE 33.6, both ≥ 3:1. PASS.
 *
 *   Pipeline bars: an ordinal one-hue ramp was the first choice (the stages
 *   ARE ordered), but no 6-step subset of the blue ramp clears the ≥ 0.06
 *   adjacent-lightness gate between the 2:1 light-end floor and the darkest
 *   step — all 210 combinations failed. Stage order is already carried by row
 *   order and visible labels, so the pipeline renders as one series in
 *   SERIES_1 instead of an illegible ramp.
 *
 *   Ink (WCAG text contrast on white):
 *     slate-900 17.85:1 · slate-600 7.58:1 · slate-500 4.76:1 — all pass.
 *     slate-400 is 2.56:1 and FAILS as text; never use it for labels here.
 *
 *   Delta text: emerald-700 5.48:1, rose-700 6.29:1 — always paired with an
 *   arrow icon, so direction never rests on color alone.
 *
 *   Meter: fill vs its own track 3.34:1 (PASS).
 *
 * The app ships no dark theme (no dark tokens in index.css), so there is no
 * dark variant to select here.
 */

export const CHART = {
  /** Slot 1 — primary series, every single-series bar, the meter fill. */
  series1: '#2a78d6',
  /** Slot 2 — second series in the trend chart. */
  series2: '#eb6834',
  /** Meter track: a lighter step of the SAME ramp as the fill (blue-on-blue). */
  meterTrack: '#cde2fb',
  /** Hairline gridline, one step off the white surface. Non-data furniture. */
  grid: '#e2e8f0',
  /** Axis baseline. */
  axis: '#cbd5e1',
  /** Crosshair cursor line. Non-text, so the text-contrast floor doesn't apply. */
  crosshair: '#94a3b8',
  /** Chart surface — used for the 2px ring around active dots. */
  surface: '#ffffff',
  /** Muted ink for axis ticks. Lightest value permitted for any text. */
  inkMuted: '#64748b',
} as const;
