// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/DateTimePicker.tsx
//  Date + time picker — light/dark theme upgrade
//
//  Unchanged behaviour: portal popup (same fix as DatePicker), Date / Time
//  tabs, 5-minute steps, Today / Clear, Confirm → 'YYYY-MM-DDTHH:mm'.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, CalendarDays, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface DateTimePickerProps {
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
const HOURS      = Array.from({ length: 24 }, (_, i) => String(i).padStart(2,'0'));
const MINUTES    = Array.from({ length: 12 }, (_, i) => String(i*5).padStart(2,'0'));

const NAV_BTN =
  'p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800 transition';
const HOVER_CELL = 'hover:bg-slate-100 dark:hover:bg-slate-800';

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseDateTime(str: string) {
  if (!str) return { datePart:'', timePart:'' };
  const [datePart, timePart=''] = str.split('T');
  return { datePart, timePart: timePart.slice(0,5) };
}
function formatDisplay(str: string) {
  if (!str) return '';
  const { datePart, timePart } = parseDateTime(str);
  if (!datePart) return '';
  const [y,m,d] = datePart.split('-').map(Number);
  const ds = new Date(y,m-1,d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  return timePart ? `${ds}, ${timePart}` : ds;
}
function buildValue(datePart: string, timePart: string) {
  if (!datePart) return '';
  return `${datePart}T${timePart||'00:00'}`;
}

export function DateTimePicker({
  value, onChange,
  placeholder = 'Select date & time',
  className = '', disabled = false,
}: DateTimePickerProps) {
  const today   = toYMD(new Date());
  const nowH    = String(new Date().getHours()).padStart(2,'0');
  const nowM    = String(Math.floor(new Date().getMinutes()/5)*5).padStart(2,'0');
  const { datePart: initDate, timePart: initTime } = parseDateTime(value);
  const initD   = initDate ? new Date(initDate+'T00:00') : new Date();

  const [open, setOpen]               = useState(false);
  const [tab, setTab]                 = useState<'date'|'time'>('date');
  const [viewYear, setViewYear]       = useState(initD.getFullYear());
  const [viewMonth, setViewMonth]     = useState(initD.getMonth());
  const [showYearGrid, setShowYearGrid] = useState(false);
  const [selDate, setSelDate]         = useState(initDate);
  const [selHour, setSelHour]         = useState(initTime ? initTime.slice(0,2) : nowH);
  const [selMin,  setSelMin]          = useState(initTime ? initTime.slice(3,5) : nowM);
  const [popupStyle, setPopupStyle]   = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef   = useRef<HTMLDivElement>(null);
  const hourRef    = useRef<HTMLDivElement>(null);
  const minRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { datePart, timePart } = parseDateTime(value);
    setSelDate(datePart);
    if (timePart) { setSelHour(timePart.slice(0,2)); setSelMin(timePart.slice(3,5)); }
    if (datePart) { const d=new Date(datePart+'T00:00'); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  }, [value]);

  useEffect(() => {
    if (tab !== 'time' || !open) return;
    setTimeout(() => {
      hourRef.current?.querySelector('[data-selected]')?.scrollIntoView({ block:'center' });
      minRef.current?.querySelector('[data-selected]')?.scrollIntoView({ block:'center' });
    }, 50);
  }, [tab, open]);

  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect    = triggerRef.current.getBoundingClientRect();
    const popupH  = 380;
    const showAbove = (window.innerHeight - rect.bottom) < popupH && rect.top > (window.innerHeight - rect.bottom);
    setPopupStyle({
      position: 'fixed',
      left:     rect.left,
      width:    Math.max(rect.width, 288),
      zIndex:   9999,
      ...(showAbove ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    });
  }, []);

  const openPicker = () => { if (disabled) return; calcPosition(); setOpen(o => !o); };

  useEffect(() => {
    if (!open) return;
    const u = () => calcPosition();
    window.addEventListener('scroll', u, true);
    window.addEventListener('resize', u);
    return () => { window.removeEventListener('scroll',u,true); window.removeEventListener('resize',u); };
  }, [open, calcPosition]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !popupRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key==='Escape') setOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth  = new Date(viewYear, viewMonth+1, 0).getDate();
  const startOffset  = (firstOfMonth.getDay()+6) % 7;
  const cells: (number|null)[] = [...Array(startOffset).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const yearRange = Array.from({length:12},(_,i)=>viewYear-5+i);

  const prevMonth = () => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); setShowYearGrid(false); };
  const nextMonth = () => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); setShowYearGrid(false); };

  const confirmSel = useCallback(() => {
    onChange(buildValue(selDate, `${selHour}:${selMin}`));
    setOpen(false);
  }, [selDate, selHour, selMin, onChange]);

  const pickDay = (day: number) => {
    const ymd = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    setSelDate(ymd);
    setTab('time');
  };

  const listBtn = (active: boolean) =>
    `w-full py-2 text-sm font-semibold transition rounded-lg ${
      active ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
    }`;

  const popup = open && (
    <div ref={popupRef} style={popupStyle}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/50 p-4 select-none">

      {/* Date / Time tabs */}
      <div className="grid grid-cols-2 gap-1 mb-3 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
        {(['date','time'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab===t
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
            {t==='date' ? <CalendarDays className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {t==='date' ? 'Date' : 'Time'}
            {t==='date' && selDate && <span className="opacity-70">{selDate.slice(8)}/{selDate.slice(5,7)}</span>}
            {t==='time' && <span className="opacity-70">{selHour}:{selMin}</span>}
          </button>
        ))}
      </div>

      {/* DATE TAB */}
      {tab==='date' && (showYearGrid ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={()=>setViewYear(y=>y-12)} className={NAV_BTN} aria-label="Previous years"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-bold text-slate-900 dark:text-white">{yearRange[0]} – {yearRange[11]}</span>
            <button type="button" onClick={()=>setViewYear(y=>y+12)} className={NAV_BTN} aria-label="Next years"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {yearRange.map(y=>(
              <button key={y} type="button" onClick={()=>{setViewYear(y);setShowYearGrid(false);}}
                className={`py-2 rounded-lg text-xs font-semibold transition ${
                  y===viewYear ? 'bg-blue-600 text-white'
                  : y===new Date().getFullYear() ? `text-blue-600 dark:text-blue-400 ${HOVER_CELL}`
                  : `text-slate-700 dark:text-slate-300 ${HOVER_CELL}`}`}>{y}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className={NAV_BTN} aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={()=>setShowYearGrid(true)}
              className="text-sm font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              {MONTHS[viewMonth]} {viewYear}
            </button>
            <button type="button" onClick={nextMonth} className={NAV_BTN} aria-label="Next month"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(d=><div key={d} className="text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day,i)=>{
              if(!day) return <div key={`e-${i}`}/>;
              const ymd=`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isSel=ymd===selDate, isToday=ymd===today;
              const isWknd=[0,6].includes(new Date(viewYear,viewMonth,day).getDay());
              return <button key={day} type="button" onClick={()=>pickDay(day)}
                className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition ${
                  isSel ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : isToday ? `ring-1 ring-blue-500 text-blue-600 dark:text-blue-400 font-bold ${HOVER_CELL}`
                  : isWknd ? `text-slate-400 dark:text-slate-500 ${HOVER_CELL}`
                  : `text-slate-700 dark:text-slate-200 ${HOVER_CELL}`}`}>{day}</button>;
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={()=>{setSelDate(today);setTab('time');}}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition">Today</button>
            {selDate && (
              <button type="button" onClick={()=>{onChange('');setSelDate('');setOpen(false);}}
                className="text-xs font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition">Clear</button>
            )}
          </div>
        </>
      ))}

      {/* TIME TAB */}
      {tab==='time' && (
        <>
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 text-center mb-1">HOUR</p>
              <div ref={hourRef} className="h-48 overflow-y-auto rounded-xl p-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                {HOURS.map(h=>(
                  <button key={h} type="button" data-selected={h===selHour||undefined} onClick={()=>setSelHour(h)} className={listBtn(h===selHour)}>{h}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center text-slate-400 text-2xl font-thin pt-4">:</div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 text-center mb-1">MIN</p>
              <div ref={minRef} className="h-48 overflow-y-auto rounded-xl p-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                {MINUTES.map(mn=>(
                  <button key={mn} type="button" data-selected={mn===selMin||undefined} onClick={()=>setSelMin(mn)} className={listBtn(mn===selMin)}>{mn}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 text-center text-sm">
            <span className="font-bold text-slate-900 dark:text-white">{selHour}:{selMin}</span>
            {selDate && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">on {new Date(selDate+'T00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>}
          </div>
        </>
      )}

      <button type="button" disabled={!selDate} onClick={confirmSel}
        className="w-full mt-3 inline-flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
        {selDate && <Check className="w-4 h-4" />}
        {selDate ? `Confirm — ${formatDisplay(buildValue(selDate,`${selHour}:${selMin}`))}` : 'Select a date first'}
      </button>
    </div>
  );

  return (
    <div className="relative">
      <button ref={triggerRef} type="button" disabled={disabled} onClick={openPicker}
        className={`w-full flex items-center justify-between gap-2 bg-white dark:bg-slate-800/60 border text-sm rounded-xl px-3.5 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? 'border-blue-500 ring-2 ring-blue-500/30'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        } ${value ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'} ${className}`}>
        <span className="truncate">{value ? formatDisplay(value) : placeholder}</span>
        <CalendarClock className={`w-4 h-4 shrink-0 ${open ? 'text-blue-500' : 'text-slate-400'}`} />
      </button>
      {typeof document !== 'undefined' && createPortal(popup, document.body)}
    </div>
  );
}
