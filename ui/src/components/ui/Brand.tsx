// ─────────────────────────────────────────────────────────────────────────────
//  Montcrest Software branding (files from montcrestsoftware.com, in /public/brand)
//    BrandMark — the "MS" shield on a white tile (sidebar, phone header, auth pages)
//    BrandLogo — the full "Montcrest Software" logo; its maroon text needs a
//                light background, so on dark screens it sits on a white panel
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

export const BrandMark: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <span className={`inline-flex items-center justify-center flex-shrink-0 rounded-xl bg-white shadow-sm ring-1 ring-black/5 ${className}`}>
    <img src="/brand/montcrest-mark.png" alt="Montcrest Software" className="h-[68%] w-auto select-none" draggable={false} />
  </span>
);

export const BrandLogo: React.FC<{ className?: string; panel?: boolean }> = ({ className = 'h-10', panel = true }) => {
  const img = <img src="/brand/montcrest-logo.png" alt="Montcrest Software" className={`w-auto select-none ${className}`} draggable={false} />;
  return panel
    ? <span className="inline-flex items-center rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-black/5">{img}</span>
    : img;
};
