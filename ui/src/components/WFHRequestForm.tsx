import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wfhApi } from '../services/api'; 
import { WFHRequest } from '../types'; 
import { StatusPill } from './StatusPill';
import { useState } from 'react';
import Swal from 'sweetalert2';
import { DatePicker } from './DatePicker';

export const WFHRequestForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const [type, setType] = useState<'WFH' | 'HalfDay'>('WFH');
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<'Morning' | 'Afternoon'>('Morning');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submitMutation = useMutation({
    mutationFn: () => wfhApi.submit({
      requestType: type,
      requestDate: date,
      halfDaySlot: type === 'HalfDay' ? slot : undefined,
      reason,
    }),
    onSuccess: (data) => {
      setError('');
      setDate(''); setReason('');
      onSuccess();
        Swal.fire({
        title: 'Request Submitted!',
        text: data.message,
        icon: 'success',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        iconColor: '#3b82f6',
        timer: 2000,
        showConfirmButton: false
        });
    },
    onError: (err: any) => {
        Swal.fire({
            title: 'Submission Failed',
            text: err.response?.data?.message || 'Failed to submit request',
            icon: 'error',
            background: 'rgb(15, 23, 42)',
            color: '#ffffff',
            confirmButtonColor: '#3b82f6'
        });
        }
  });

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
        📋 Submit New Request
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Request Type */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Request Type</p>
        <div className="grid grid-cols-2 gap-3">
          {(['WFH', 'HalfDay'] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition text-left ${
                type === t
                  ? t === 'WFH'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
              }`}>
              <span className="text-2xl">{t === 'WFH' ? '🏠' : '🌗'}</span>
              <div>
                <p className={`font-semibold text-sm ${
                  type === t ? (t === 'WFH' ? 'text-blue-400' : 'text-amber-400') : 'text-white'
                }`}>
                  {t === 'WFH' ? 'Work From Home' : 'Half Day'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t === 'WFH' ? 'Work full day from home' : 'Work only half the day'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Date
        </label>
        <DatePicker
          value={date}
          min={minDate}
          onChange={setDate}
          placeholder="Select date"
        />
      </div>

      {/* Half day slot selector */}
      {type === 'HalfDay' && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Which Half?
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(['Morning', 'Afternoon'] as const).map(s => (
              <button key={s} onClick={() => setSlot(s)}
                className={`py-2.5 rounded-xl border-2 text-sm font-medium transition ${
                  slot === s
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-slate-700 hover:border-slate-600 text-slate-400 bg-slate-800/50'
                }`}>
                {s === 'Morning' ? '🌅 Morning' : '🌆 Afternoon'}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Morning: Check in and leave by noon · Afternoon: Come after noon
          </p>
        </div>
      )}

      {/* Reason */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Reason
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder={type === 'WFH'
            ? 'e.g. Plumber scheduled, need to work from home...'
            : 'e.g. Doctor appointment in the morning...'}
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-slate-600"
        />
        <p className="text-xs text-slate-600 mt-1">{reason.length}/500</p>
      </div>

      <button
        onClick={() => submitMutation.mutate()}
        disabled={!date || !reason.trim() || submitMutation.isPending}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition"
      >
        {submitMutation.isPending ? '⏳ Submitting...' : `📤 Submit ${type === 'WFH' ? 'WFH' : 'Half Day'} Request`}
      </button>
    </div>
  );
};