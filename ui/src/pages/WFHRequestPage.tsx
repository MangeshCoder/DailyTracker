
import { WFHRequestForm } from '../components/WFHRequestForm';
import { MyWFHRequests } from '../components/MyWFHRequests';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '../components/DatePicker';

export const WFHRequestPage = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'new' | 'history'>('new');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">WFH & Half Day Requests</h1>
        <p className="text-slate-400 text-sm mt-1">
          Submit requests for work-from-home or half-day attendance. Your manager will approve or reject them.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl w-fit">
        {[
          { key: 'new', label: '📋 New Request' },
          { key: 'history', label: '📚 My Requests' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              tab === t.key ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <WFHRequestForm onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['myWFHRequests'] });
          setTab('history');
        }} />
      )}
      {tab === 'history' && <MyWFHRequests />}
    </div>
  );
};