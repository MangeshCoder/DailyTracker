import { useQuery } from "@tanstack/react-query";
import { wfhApi } from "../services/api";
import { StatusPill } from "./StatusPill";
import { useState } from "react";
import { WFHRequest } from "../types";

export const AllRequestsHistory = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filterType, setFilterType] = useState<'All' | 'WFH' | 'HalfDay'>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

  const { data: allRequests = [], isLoading } = useQuery<WFHRequest[]>({
    queryKey: ['allWFH', month, year],
    queryFn: () => wfhApi.getAll(month, year),
  });

  const filtered = allRequests.filter(r =>
    (filterType === 'All' || r.requestType === filterType) &&
    (filterStatus === 'All' || r.status === filterStatus)
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={month} onChange={e => setMonth(+e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i+1} value={i+1}>
              {new Date(2024, i).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
          className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none">
          <option value="All">All Types</option>
          <option value="WFH">🏠 WFH</option>
          <option value="HalfDay">🌗 Half Day</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none">
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <p className="text-slate-500 text-sm self-center">{filtered.length} requests</p>
      </div>

      {isLoading ? (
        <div className="h-40 bg-slate-800 rounded-2xl animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm bg-slate-900 border border-dashed border-slate-700 rounded-2xl">
          No requests found for selected filters
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(req => (
            <div key={req.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                {req.employeeName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-medium">{req.employeeName}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                    req.requestType === 'WFH'
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-amber-400 bg-amber-500/10'
                  }`}>
                    {req.requestType === 'WFH' ? '🏠 WFH' : `🌗 ${req.halfDaySlot ?? 'HalfDay'}`}
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-0.5">
                  {new Date(req.requestDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {req.reviewedByName && <span> · Reviewed by {req.reviewedByName}</span>}
                </p>
              </div>
              <StatusPill status={req.status} size="xs" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};