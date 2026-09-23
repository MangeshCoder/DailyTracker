import { useEffect, useState } from "react";
// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 2: Live Work Timer
// ═══════════════════════════════════════════════════════════════════════════════
interface LiveTimerProps {
  checkInTime?: string;    // ISO string
  isOnBreak?: boolean;
  breakStartTime?: string; // ISO string – when current break started
  className?: string;
}

export const LiveWorkTimer = ({ checkInTime, isOnBreak, breakStartTime, className = '' }: LiveTimerProps) => {
  const [elapsed, setElapsed] = useState({ h: 0, m: 0, s: 0 });
  const [breakElapsed, setBreakElapsed] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    if (!checkInTime) return;

    const tick = () => {
      const now = Date.now();
      const checkIn = new Date(checkInTime).getTime();
      const totalSecs = Math.max(0, Math.floor((now - checkIn) / 1000));

      setElapsed({
        h: Math.floor(totalSecs / 3600),
        m: Math.floor((totalSecs % 3600) / 60),
        s: totalSecs % 60
      });

      if (isOnBreak && breakStartTime) {
        const breakStart = new Date(breakStartTime).getTime();
        const breakSecs = Math.max(0, Math.floor((now - breakStart) / 1000));
        setBreakElapsed({
          h: Math.floor(breakSecs / 3600),
          m: Math.floor((breakSecs % 3600) / 60),
          s: breakSecs % 60
        });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [checkInTime, isOnBreak, breakStartTime]);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (!checkInTime) {
    return (
      <div className={`text-center ${className}`}>
        <div className="text-4xl font-mono font-bold text-slate-600 tracking-widest">
          --:--:--
        </div>
        <p className="text-xs text-slate-600 mt-1">Not checked in</p>
      </div>
    );
  }

  return (
    <div className={`text-center ${className}`}>
      <div className={`text-4xl font-mono font-bold tracking-widest transition-colors ${
        isOnBreak ? 'text-amber-400' : 'text-blue-400'
      }`}>
        {pad(elapsed.h)}:{pad(elapsed.m)}:{pad(elapsed.s)}
      </div>
      <p className="text-xs text-slate-500 mt-1">
        {isOnBreak
          ? `🛑 On break — ${pad(breakElapsed.m)}:${pad(breakElapsed.s)}`
          : '⏱️ Total session time since check-in'
        }
      </p>
    </div>
  );
};