import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate' | 'indigo';
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const COLOR_MAP: Record<string, { bg: string; iconBg: string; text: string; glow: string }> = {
  blue: {
    bg: 'hover:border-blue-500/40',
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    glow: 'from-blue-500/10 to-transparent',
  },
  emerald: {
    bg: 'hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    glow: 'from-emerald-500/10 to-transparent',
  },
  amber: {
    bg: 'hover:border-amber-500/40',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    glow: 'from-amber-500/10 to-transparent',
  },
  purple: {
    bg: 'hover:border-purple-500/40',
    iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
    text: 'text-purple-600 dark:text-purple-400',
    glow: 'from-purple-500/10 to-transparent',
  },
  rose: {
    bg: 'hover:border-rose-500/40',
    iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
    glow: 'from-rose-500/10 to-transparent',
  },
  indigo: {
    bg: 'hover:border-indigo-500/40',
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    text: 'text-indigo-600 dark:text-indigo-400',
    glow: 'from-indigo-500/10 to-transparent',
  },
  slate: {
    bg: 'hover:border-slate-400/40',
    iconBg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
    text: 'text-slate-600 dark:text-slate-400',
    glow: 'from-slate-500/10 to-transparent',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  loading = false,
  onClick,
  className = '',
}) => {
  const scheme = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-xs transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
      } ${scheme.bg} ${className}`}
    >
      <div
        className={`absolute -top-12 -right-12 w-28 h-28 bg-gradient-to-br ${scheme.glow} rounded-full blur-xl pointer-events-none opacity-50`}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {title}
          </p>

          {loading ? (
            <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg mt-1" />
          ) : (
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {value}
            </h3>
          )}

          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {subtitle}
            </p>
          )}

          {trend && (
            <div className="flex items-center gap-1 text-xs pt-1">
              <span
                className={`inline-flex items-center font-bold ${
                  trend.isPositive ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {trend.isPositive ? (
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                )}
                {trend.value}
              </span>
              {trend.label && (
                <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                  {trend.label}
                </span>
              )}
            </div>
          )}
        </div>

          {Icon && (
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform ${scheme.iconBg}`}>
              {React.isValidElement(Icon) ? (
                Icon
              ) : typeof Icon === 'string' ? (
                <span className="text-xl">{Icon}</span>
              ) : (
                React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: 'w-5 h-5' })
              )}
            </div>
          )}
      </div>
    </div>
  );
};