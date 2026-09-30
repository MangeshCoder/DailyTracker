// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/popupPosition.ts
//  Where to put a floating popup (date picker, dropdown list) next to the field
//  that opened it: below if it fits, else above, else as high as it fits — and
//  never past the left/right edge of the screen.
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties } from 'react';

/** Calendar popups are always this wide, whatever the width of the field */
export const CALENDAR_WIDTH = 296;

export function placePopup(field: DOMRect, popupHeight: number, width: number): CSSProperties {
  const margin = 8, gap = 6;
  const w = Math.min(width, window.innerWidth - margin * 2);
  const left = Math.min(Math.max(field.left, margin), window.innerWidth - w - margin);
  const roomBelow = window.innerHeight - field.bottom - gap - margin;
  const roomAbove = field.top - gap - margin;
  const top =
    popupHeight <= roomBelow ? field.bottom + gap
    : popupHeight <= roomAbove ? field.top - gap - popupHeight
    : Math.max(margin, window.innerHeight - popupHeight - margin);
  return { position: 'fixed', left, top, width: w, zIndex: 9999 };
}
