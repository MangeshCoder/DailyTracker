import React from 'react';
import { Search, X, LayoutGrid, List, Kanban } from 'lucide-react';

export interface FilterPill {
  key: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export type ViewMode = 'list' | 'kanban' | 'grid';

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: FilterPill[];
  activeFilter?: string;
  onFilterChange?: (key: string) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  supportedViewModes?: ViewMode[];
  actions?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters,
  activeFilter,
  onFilterChange,
  viewMode,
  onViewModeChange,
  supportedViewModes,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
        {onSearchChange !== undefined && (
          <div className="relative min-w-[200px] sm:max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {filters && filters.length > 0 && onFilterChange && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
            {filters.map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => onFilterChange(f.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  {f.icon}
                  <span>{f.label}</span>
                  {f.count !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0">
        {supportedViewModes && supportedViewModes.length > 1 && onViewModeChange && (
          <div className="flex items-center p-1 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl">
            {supportedViewModes.includes('list') && (
              <button
                type="button"
                onClick={() => onViewModeChange('list')}
                title="List view"
                className={`p-1.5 rounded-lg text-xs transition ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            )}
            {supportedViewModes.includes('kanban') && (
              <button
                type="button"
                onClick={() => onViewModeChange('kanban')}
                title="Kanban view"
                className={`p-1.5 rounded-lg text-xs transition ${
                  viewMode === 'kanban'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Kanban className="w-4 h-4" />
              </button>
            )}
            {supportedViewModes.includes('grid') && (
              <button
                type="button"
                onClick={() => onViewModeChange('grid')}
                title="Grid view"
                className={`p-1.5 rounded-lg text-xs transition ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};