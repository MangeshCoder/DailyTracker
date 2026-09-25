import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[350px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Unable to load this view
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                An unexpected error occurred while rendering this page component.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-left border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto text-[11px] font-mono text-slate-600 dark:text-slate-300 max-h-28">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
              
              <a
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Go to Dashboard</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}