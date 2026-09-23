// ─────────────────────────────────────────────────────────────────────────────
//  frontend/src/components/DateTimePicker.tsx
//  ACTION: REPLACE (same portal fix as DatePicker)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

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
  value, onChange, min, max,
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

  const popup = open && (
    <div ref={popupRef} style={popupStyle}
      className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 p-4 select-none">

      {/* Date / Time tabs */}
      <div className="flex gap-1 mb-3 bg-slate-800 rounded-xl p-1">
        {(['date','time'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${tab===t?'bg-blue-600 text-white':'text-slate-400 hover:text-white'}`}>
            {t==='date'?'📅 Date':'🕐 Time'}
            {t==='date' && selDate && <span className="ml-1 opacity-70">{selDate.slice(8)}/{selDate.slice(5,7)}</span>}
            {t==='time' && <span className="ml-1 opacity-70">{selHour}:{selMin}</span>}
          </button>
        ))}
      </div>

      {/* DATE TAB */}
      {tab==='date' && (showYearGrid ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <button onClick={()=>setViewYear(y=>y-12)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">‹</button>
            <span className="text-white text-sm font-semibold">{yearRange[0]} – {yearRange[11]}</span>
            <button onClick={()=>setViewYear(y=>y+12)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">›</button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {yearRange.map(y=>(
              <button key={y} onClick={()=>{setViewYear(y);setShowYearGrid(false);}}
                className={`py-2 rounded-lg text-xs font-medium transition ${y===viewYear?'bg-blue-600 text-white':y===new Date().getFullYear()?'text-blue-400 hover:bg-slate-800':'text-slate-300 hover:bg-slate-800'}`}>{y}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">‹</button>
            <button onClick={()=>setShowYearGrid(true)} className="text-white text-sm font-semibold hover:text-blue-400 transition px-2 py-1 rounded-lg hover:bg-slate-800">{MONTHS[viewMonth]} {viewYear}</button>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">›</button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(d=><div key={d} className="text-center text-[11px] font-medium text-slate-500 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day,i)=>{
              if(!day) return <div key={`e-${i}`}/>;
              const ymd=`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isSel=ymd===selDate, isToday=ymd===today;
              const isWknd=[0,6].includes(new Date(viewYear,viewMonth,day).getDay());
              return <button key={day} type="button" onClick={()=>pickDay(day)}
                className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition ${isSel?'bg-blue-600 text-white':isToday?'ring-1 ring-blue-500 text-blue-400 hover:bg-slate-800':isWknd?'text-slate-500 hover:bg-slate-800':'text-slate-200 hover:bg-slate-800'}`}>{day}</button>;
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
            <button type="button" onClick={()=>{setSelDate(today);setTab('time');}} className="text-xs text-blue-400 hover:text-blue-300 transition font-medium">Today</button>
            {selDate && <button type="button" onClick={()=>{onChange('');setSelDate('');setOpen(false);}} className="text-xs text-slate-500 hover:text-slate-300 transition">Clear</button>}
          </div>
        </>
      ))}

      {/* TIME TAB */}
      {tab==='time' && (
        <>
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 font-medium text-center mb-1">HOUR</p>
              <div ref={hourRef} className="h-48 overflow-y-auto rounded-xl bg-slate-800/50">
                {HOURS.map(h=>(
                  <button key={h} type="button" data-selected={h===selHour||undefined} onClick={()=>setSelHour(h)}
                    className={`w-full py-2 text-sm font-medium transition rounded-lg ${h===selHour?'bg-blue-600 text-white':'text-slate-300 hover:bg-slate-700'}`}>{h}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center text-slate-400 text-2xl font-thin pt-4">:</div>
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 font-medium text-center mb-1">MIN</p>
              <div ref={minRef} className="h-48 overflow-y-auto rounded-xl bg-slate-800/50">
                {MINUTES.map(mn=>(
                  <button key={mn} type="button" data-selected={mn===selMin||undefined} onClick={()=>setSelMin(mn)}
                    className={`w-full py-2 text-sm font-medium transition rounded-lg ${mn===selMin?'bg-blue-600 text-white':'text-slate-300 hover:bg-slate-700'}`}>{mn}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 text-center text-sm">
            <span className="text-white font-semibold">{selHour}:{selMin}</span>
            {selDate && <span className="ml-2 text-slate-500 text-xs">on {new Date(selDate+'T00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>}
          </div>
        </>
      )}

      <button type="button" disabled={!selDate} onClick={confirmSel}
        className="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition">
        {selDate ? `Confirm — ${formatDisplay(buildValue(selDate,`${selHour}:${selMin}`))}` : 'Select a date first'}
      </button>
    </div>
  );

  return (
    <div className="relative">
      <button ref={triggerRef} type="button" disabled={disabled} onClick={openPicker}
        className={`w-full flex items-center justify-between gap-2 bg-slate-800 border border-slate-700 text-sm rounded-xl px-4 py-3 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${open?'border-blue-500 ring-2 ring-blue-500/30':'hover:border-slate-600'} ${value?'text-white':'text-slate-500'} ${className}`}>
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {typeof document !== 'undefined' && createPortal(popup, document.body)}
    </div>
  );
}