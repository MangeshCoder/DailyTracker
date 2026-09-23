// ─────────────────────────────────────────────────────────────────────────────
//  frontend/src/components/DatePicker.tsx
//  ACTION: REPLACE (portal fix for overflow-y-auto modals)
//
//  Root cause of the "half calendar" bug:
//    The popup was `position: absolute` inside a scrollable modal div that has
//    `overflow-y: auto`. CSS clips absolutely-positioned children that go
//    outside an overflow container. So the calendar was rendered but clipped.
//
//  Fix:
//    Render the popup via ReactDOM.createPortal() directly into document.body.
//    Calculate the exact screen position using getBoundingClientRect() on the
//    trigger button. No overflow container can clip a portal child.
//    Automatically flips above the trigger if there's not enough space below.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DatePickerProps {
  value:        string;
  onChange:     (value: string) => void;
  min?:         string;
  max?:         string;
  placeholder?: string;
  className?:   string;
  disabled?:    boolean;
}

const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su'];

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseDate(str: string): Date | null {
  if (!str) return null;
  const [y,m,d] = str.split('-').map(Number);
  if (!y||!m||!d) return null;
  return new Date(y, m-1, d);
}
function formatDisplay(str: string) {
  const d = parseDate(str);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

export function DatePicker({
  value, onChange, min, max,
  placeholder = 'Select date',
  className = '', disabled = false,
}: DatePickerProps) {
  const today   = toYMD(new Date());
  const initD   = parseDate(value) ?? new Date();

  const [open, setOpen]               = useState(false);
  const [viewYear, setViewYear]       = useState(initD.getFullYear());
  const [viewMonth, setViewMonth]     = useState(initD.getMonth());
  const [showYearGrid, setShowYearGrid] = useState(false);
  const [popupStyle, setPopupStyle]   = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef   = useRef<HTMLDivElement>(null);

  // Sync view when value changes externally
  useEffect(() => {
    const d = parseDate(value);
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  }, [value]);

  // Calculate popup position relative to trigger using getBoundingClientRect
  // Flip above if not enough room below
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect       = triggerRef.current.getBoundingClientRect();
    const popupH     = 320; // approximate popup height in px
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const showAbove  = spaceBelow < popupH && spaceAbove > spaceBelow;

    setPopupStyle({
      position: 'fixed',
      left:     rect.left,
      width:    Math.max(rect.width, 288), // min 288px (w-72)
      zIndex:   9999,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
    });
  }, []);

  const openPicker = () => {
    if (disabled) return;
    calcPosition();
    setOpen(o => !o);
  };

  // Recalculate on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => calcPosition();
    window.addEventListener('scroll',  update, true);
    window.addEventListener('resize',  update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, calcPosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) &&
          !popupRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  // Calendar grid
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth  = new Date(viewYear, viewMonth+1, 0).getDate();
  const startOffset  = (firstOfMonth.getDay()+6) % 7;
  const cells: (number|null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_,i) => i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const yearRange = Array.from({ length: 12 }, (_, i) => viewYear - 5 + i);

  const prevMonth = () => { if (viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); setShowYearGrid(false); };
  const nextMonth = () => { if (viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); setShowYearGrid(false); };

  const selectDay = (day: number) => {
    const ymd = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (min && ymd < min) return;
    if (max && ymd > max) return;
    onChange(ymd);
    setOpen(false);
  };

  const popup = open && (
    <div
      ref={popupRef}
      style={popupStyle}
      className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 p-4 select-none"
    >
      {showYearGrid ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setViewYear(y=>y-12)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">‹</button>
            <span className="text-white text-sm font-semibold">{yearRange[0]} – {yearRange[11]}</span>
            <button onClick={() => setViewYear(y=>y+12)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">›</button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {yearRange.map(y => (
              <button key={y} onClick={() => { setViewYear(y); setShowYearGrid(false); }}
                className={`py-2 rounded-lg text-xs font-medium transition ${
                  y === viewYear ? 'bg-blue-600 text-white'
                  : y === new Date().getFullYear() ? 'text-blue-400 hover:bg-slate-800'
                  : 'text-slate-300 hover:bg-slate-800'}`}>{y}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">‹</button>
            <button onClick={() => setShowYearGrid(true)}
              className="text-white text-sm font-semibold hover:text-blue-400 transition px-2 py-1 rounded-lg hover:bg-slate-800">
              {MONTHS[viewMonth]} {viewYear}
            </button>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">›</button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-[11px] font-medium text-slate-500 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const ymd     = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isSel   = ymd === value;
              const isToday = ymd === today;
              const dis     = (min && ymd < min) || (max && ymd > max);
              const isWknd  = [0,6].includes(new Date(viewYear, viewMonth, day).getDay());
              return (
                <button key={day} type="button" disabled={!!dis} onClick={() => selectDay(day)}
                  className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition disabled:cursor-not-allowed ${
                    isSel   ? 'bg-blue-600 text-white'
                    : isToday ? 'ring-1 ring-blue-500 text-blue-400 hover:bg-slate-800'
                    : dis     ? 'text-slate-700'
                    : isWknd  ? 'text-slate-500 hover:bg-slate-800'
                    : 'text-slate-200 hover:bg-slate-800'}`}>{day}</button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
            <button type="button" onClick={() => { if (!(min && today < min) && !(max && today > max)) { onChange(today); setOpen(false); } }}
              className="text-xs text-blue-400 hover:text-blue-300 transition font-medium">Today</button>
            {value && (
              <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition">Clear</button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className={`
          w-full flex items-center justify-between gap-2
          bg-slate-800 border border-slate-700 text-sm rounded-xl px-4 py-3
          transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          ${open ? 'border-blue-500 ring-2 ring-blue-500/30' : 'hover:border-slate-600'}
          ${value ? 'text-white' : 'text-slate-500'}
          ${className}
        `}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Portal — renders outside any overflow container directly into body */}
      {typeof document !== 'undefined' && createPortal(popup, document.body)}
    </div>
  );
}