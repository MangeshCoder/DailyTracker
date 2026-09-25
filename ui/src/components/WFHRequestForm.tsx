import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Home, Sun, Moon, Send, AlertCircle, Sparkles } from 'lucide-react';
import Swal from 'sweetalert2';
import { wfhApi } from '../services/api';
import { DatePicker } from './DatePicker';
import { Card, CardContent } from './ui/Card';

export interface WFHRequestFormProps {
  onSuccess: () => void;
}

export const WFHRequestForm: React.FC<WFHRequestFormProps> = ({ onSuccess }) => {
  const [type, setType] = useState<'WFH' | 'HalfDay'>('WFH');
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<'Morning' | 'Afternoon'>('Morning');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submitMutation = useMutation({
    mutationFn: () =>
      wfhApi.submit({
        requestType: type,
        requestDate: date,
        halfDaySlot: type === 'HalfDay' ? slot : undefined,
        reason,
      }),
    onSuccess: (data) => {
      setError('');
      setDate('');
      setReason('');
      onSuccess();
      Swal.fire({
        title: 'Request Submitted!',
        text: data.message || 'Your request was dispatched to your manager for review.',
        icon: 'success',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        iconColor: '#3b82f6',
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (err: any) => {
      Swal.fire({
        title: 'Submission Failed',
        text: err.response?.data?.message || 'Failed to submit request. Please try again.',
        icon: 'error',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        confirmButtonColor: '#3b82f6',
      });
    },
  });

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Submit Attendance Request</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select your request category, effective date, and provide brief justification for your team lead.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Automatic Routing
          </span>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2.5">
              Request Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => setType('WFH')}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  type === 'WFH'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-500/10 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      type === 'WFH'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-bold ${
                        type === 'WFH'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      Work From Home
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Complete remote day with full standard hours from home location.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('HalfDay')}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  type === 'HalfDay'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-500/10 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      type === 'HalfDay'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-bold ${
                        type === 'HalfDay'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      Half Day Pass
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Attend either morning or afternoon shift (4.5 hours duty).
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Request Date <span className="text-rose-500">*</span>
            </label>
            <DatePicker
              value={date}
              min={minDate}
              onChange={setDate}
              placeholder="Select date for attendance adjustment"
            />
          </div>

          {type === 'HalfDay' && (
            <div className="animate-in fade-in duration-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Shift Slot <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSlot('Morning')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                    slot === 'Morning'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Morning Shift (Until 1:30 PM)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSlot('Afternoon')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                    slot === 'Afternoon'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span>Afternoon Shift (Post 1:30 PM)</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Reason / Justification <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-slate-400">
                {reason.length} / 500 characters
              </span>
            </div>
            <textarea
              rows={3}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                type === 'WFH'
                  ? 'Describe necessity for remote work (e.g., home repairs, family emergency, travel)...'
                  : 'Describe reason for partial day attendance...'
              }
              className="w-full px-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={!date || !reason.trim() || submitMutation.isPending}
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              {submitMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Request...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit {type === 'WFH' ? 'Work From Home' : 'Half Day'} Request</span>
                </>
              )}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};