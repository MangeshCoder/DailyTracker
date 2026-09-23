// ─────────────────────────────────────────────────────────────────────────────
//  FILE: frontend/src/pages/PayrollPage.tsx
//  ACTION: CREATE as a new file
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type {
  PayslipDto,
  TeamPayrollDto,
  EmployeeSalaryDto,
  SetSalaryDto,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sym = (currency: string) => CURRENCY_SYMBOL[currency] ?? currency + ' ';

const fmt = (amount: number, currency: string) =>
  `${sym(currency)}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const Avatar = ({ name, size = 'sm' }: { name: string; size?: 'xs' | 'sm' | 'md' }) => {
  const sizeMap = { xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-xs', md: 'w-11 h-11 text-sm' };
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-blue-500 to-violet-600
      flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
};

// ─── Month navigation ─────────────────────────────────────────────────────────
const MonthNav = ({
  month, year, onChange,
}: { month: number; year: number; onChange: (m: number, y: number) => void }) => {
  const now = new Date();
  const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear();

  const prev = () => month === 1 ? onChange(12, year - 1) : onChange(month - 1, year);
  const next = () => {
    if (isCurrent) return;
    month === 12 ? onChange(1, year + 1) : onChange(month + 1, year);
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={prev}
        className="w-8 h-8 flex items-center justify-center rounded-xl
          bg-slate-800 text-slate-400 hover:text-white transition">‹</button>
      <span className="text-white font-semibold text-sm min-w-[130px] text-center">
        {MONTHS[month - 1]} {year}
      </span>
      <button onClick={next} disabled={isCurrent}
        className="w-8 h-8 flex items-center justify-center rounded-xl
          bg-slate-800 text-slate-400 hover:text-white transition
          disabled:opacity-30 disabled:cursor-not-allowed">›</button>
    </div>
  );
};

// ─── Set Salary Modal ─────────────────────────────────────────────────────────
const SetSalaryModal = ({
  employee,
  existing,
  onClose,
}: {
  employee: { id: number; fullName: string; role: string };
  existing?: EmployeeSalaryDto | null;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<SetSalaryDto>({
    monthlySalary:      existing?.monthlySalary      ?? 0,
    currency:           existing?.currency           ?? 'INR',
    overtimeMultiplier: existing?.overtimeMultiplier ?? 1.5,
  });

  const mut = useMutation({
    mutationFn: () => payrollApi.setSalary(employee.id, form),
    onSuccess: () => {
      toast.success(`Salary updated for ${employee.fullName}`);
      qc.invalidateQueries({ queryKey: ['teamSalaries'] });
      qc.invalidateQueries({ queryKey: ['teamPayroll']  });
      onClose();
    },
    onError: () => toast.error('Failed to update salary'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold">Set Salary</h2>
            <p className="text-slate-400 text-xs mt-0.5">{employee.fullName} · {employee.role}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              Monthly Gross Salary *
            </label>
            <div className="flex gap-2">
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-24 bg-slate-800 border border-slate-700 rounded-xl px-2 py-2.5
                  text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={form.monthlySalary || ''}
                onChange={e => setForm(f => ({ ...f, monthlySalary: parseFloat(e.target.value) || 0 }))}
                placeholder="e.g. 50000"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                  text-sm text-slate-200 placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              Overtime Multiplier
            </label>
            <div className="flex items-center gap-3">
              {[1, 1.25, 1.5, 2].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, overtimeMultiplier: v }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition border
                    ${form.overtimeMultiplier === v
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                  {v}×
                </button>
              ))}
            </div>
            <p className="text-slate-600 text-xs mt-1">
              Overtime pay = hours × hourly rate × {form.overtimeMultiplier}
            </p>
          </div>

          {form.monthlySalary > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-xs space-y-1">
              <p className="text-slate-400">
                Per-day rate:{' '}
                <span className="text-white font-semibold">
                  {sym(form.currency)}
                  {(form.monthlySalary / 22).toLocaleString('en-IN', {
                    minimumFractionDigits: 2, maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-slate-600 ml-1">(based on ~22 working days)</span>
              </p>
              <p className="text-slate-400">
                Hourly rate:{' '}
                <span className="text-white font-semibold">
                  {sym(form.currency)}
                  {(form.monthlySalary / (22 * 8)).toLocaleString('en-IN', {
                    minimumFractionDigits: 2, maximumFractionDigits: 2,
                  })}
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 text-slate-400 rounded-xl text-sm hover:text-white transition">
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={form.monthlySalary <= 0 || mut.isPending}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40
              text-white text-sm font-semibold rounded-xl transition">
            {mut.isPending ? 'Saving…' : existing ? 'Update Salary' : 'Set Salary'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Payslip Card (employee's own payslip) ────────────────────────────────────
const PayslipCard = ({ payslip }: { payslip: PayslipDto }) => {
  const cur = payslip.currency;

  if (!payslip.salaryConfigured) {
    return (
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">💼</div>
        <p className="text-amber-400 font-semibold">Salary Not Configured</p>
        <p className="text-slate-500 text-sm mt-2">
          Your manager has not set your salary yet. Contact your manager to configure it.
        </p>
      </div>
    );
  }

  const attendanceItems = [
    { label: 'Days Present / WFH', value: payslip.daysPresent,    color: 'text-emerald-400' },
    { label: 'Half Days',          value: payslip.daysHalfDay,    color: 'text-amber-400'   },
    { label: 'Paid Leave',         value: payslip.daysPaidLeave,  color: 'text-blue-400'    },
    { label: 'Unpaid Leave',       value: payslip.daysUnpaidLeave,color: 'text-orange-400'  },
    { label: 'Absent',             value: payslip.daysAbsent,     color: 'text-rose-400'    },
  ];

  return (
    <div className="space-y-4">

      {/* Payslip header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700
        rounded-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-slate-400 text-sm">Payslip for</p>
            <h2 className="text-white text-xl font-bold mt-0.5">{payslip.monthLabel}</h2>
            <p className="text-slate-500 text-xs mt-1">
              {payslip.workingDaysInMonth} working days ·
              Per-day rate: {fmt(payslip.perDayRate, cur)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs">Net Pay</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1">
              {fmt(payslip.netPay, cur)}
            </p>
            <p className="text-slate-500 text-xs mt-1">
              Gross: {fmt(payslip.grossEarnings, cur)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Attendance summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Attendance Summary</h3>
          <div className="space-y-2.5">
            {attendanceItems.map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">{item.label}</span>
                <span className={`font-bold text-sm ${item.color}`}>{item.value}</span>
              </div>
            ))}
            {payslip.overtimeMinutes > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-400 text-sm">Overtime</span>
                <span className="text-orange-400 font-bold text-sm">{payslip.overtimeHours}</span>
              </div>
            )}
          </div>
        </div>

        {/* Earnings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Earnings</h3>
          <div className="space-y-3">
            {payslip.earnings.map((e, i) => (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm font-medium">{e.label}</span>
                  <span className="text-emerald-400 font-bold text-sm">{fmt(e.amount, cur)}</span>
                </div>
                <p className="text-slate-600 text-xs mt-0.5">{e.note}</p>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-white font-semibold text-sm">Gross Earnings</span>
              <span className="text-white font-bold">{fmt(payslip.grossEarnings, cur)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Deductions</h3>
          {payslip.deductions.length === 0 ? (
            <p className="text-emerald-400 text-sm font-medium">✓ No deductions this month</p>
          ) : (
            <div className="space-y-3">
              {payslip.deductions.map((d, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-sm font-medium">{d.label}</span>
                    <span className="text-rose-400 font-bold text-sm">−{fmt(d.amount, cur)}</span>
                  </div>
                  <p className="text-slate-600 text-xs mt-0.5">{d.note}</p>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-white font-semibold text-sm">Total Deductions</span>
                <span className="text-rose-400 font-bold">−{fmt(payslip.totalDeductions, cur)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Net Pay summary */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10
          border border-emerald-500/20 rounded-2xl p-5 flex flex-col justify-center">
          <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-3">Net Pay Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Gross Earnings</span>
              <span className="text-white font-medium">{fmt(payslip.grossEarnings, cur)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Deductions</span>
              <span className="text-rose-400 font-medium">−{fmt(payslip.totalDeductions, cur)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-700">
              <span className="text-white font-bold">Net Pay</span>
              <span className="text-emerald-400 font-bold text-lg">
                {fmt(payslip.netPay, cur)}
              </span>
            </div>
          </div>
          <p className="text-slate-600 text-xs mt-3">
            Base salary: {fmt(payslip.monthlySalary, cur)} / month ·
            OT rate: {payslip.overtimeMultiplier}×
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Team Payroll View (Manager) ──────────────────────────────────────────────
const TeamPayrollView = ({
  teamData,
  salaries,
}: {
  teamData: TeamPayrollDto;
  salaries: EmployeeSalaryDto[];
}) => {
  const [setSalaryFor, setSetSalaryFor] = useState<{
    id: number; fullName: string; role: string;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const getSalary = (userId: number) =>
    salaries.find(s => s.userId === userId) ?? null;

  return (
    <div className="space-y-5">

      {/* Team totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            icon: '💰', label: 'Total Gross',
            value: teamData.members[0]
              ? fmt(teamData.teamTotalGross, teamData.members[0].currency)
              : '–',
            color: 'text-white',
            bg: 'bg-slate-900 border-slate-800',
          },
          {
            icon: '✅', label: 'Total Net Pay',
            value: teamData.members[0]
              ? fmt(teamData.teamTotalNet, teamData.members[0].currency)
              : '–',
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border-emerald-500/20',
          },
          {
            icon: '📉', label: 'Total Deductions',
            value: teamData.members[0]
              ? fmt(teamData.teamTotalDeductions, teamData.members[0].currency)
              : '–',
            color: 'text-rose-400',
            bg: 'bg-rose-500/10 border-rose-500/20',
          },
          {
            icon: '⏱️', label: 'Overtime Pay',
            value: teamData.members[0]
              ? fmt(teamData.teamTotalOvertimePay, teamData.members[0].currency)
              : '–',
            color: 'text-orange-400',
            bg: 'bg-orange-500/10 border-orange-500/20',
          },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <span>{s.icon}</span>
              <span className="text-slate-500 text-xs">{s.label}</span>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Not configured warning */}
      {teamData.membersNotConfigured > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-amber-400 font-semibold text-sm">
              {teamData.membersNotConfigured} employee{teamData.membersNotConfigured !== 1 ? 's' : ''} have no salary configured
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              Their payroll shows ₹0. Use the "Set Salary" button to configure them.
            </p>
          </div>
        </div>
      )}

      {/* Member list */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-white font-semibold text-sm">
            Team Payroll — {teamData.monthLabel}
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            {teamData.membersConfigured} configured · {teamData.membersNotConfigured} pending
          </p>
        </div>

        <div className="divide-y divide-slate-800/60">
          {teamData.members.map(p => {
            const isOpen   = expandedId === p.userId;
            const salaryConf = getSalary(p.userId);

            return (
              <div key={p.userId}>
                {/* Summary row */}
                <div className="px-4 py-3 flex items-center gap-3">

                  <Avatar name={p.fullName} size="sm" />

                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{p.fullName}</p>
                    <p className="text-slate-500 text-xs">{p.role}</p>
                  </div>

                  {/* Attendance mini */}
                  <div className="hidden md:flex items-center gap-3 text-xs">
                    <span className="text-slate-500">
                      Present: <span className="text-emerald-400 font-semibold">{p.daysPresent}</span>
                    </span>
                    {p.daysAbsent > 0 && (
                      <span className="text-slate-500">
                        Absent: <span className="text-rose-400 font-semibold">{p.daysAbsent}</span>
                      </span>
                    )}
                    {p.overtimeMinutes > 0 && (
                      <span className="text-slate-500">
                        OT: <span className="text-orange-400 font-semibold">{p.overtimeHours}</span>
                      </span>
                    )}
                  </div>

                  {/* Net pay */}
                  <div className="text-right flex-shrink-0 w-28">
                    {p.salaryConfigured ? (
                      <>
                        <p className="text-emerald-400 font-bold text-sm">
                          {fmt(p.netPay, p.currency)}
                        </p>
                        <p className="text-slate-600 text-xs">
                          Gross: {fmt(p.grossEarnings, p.currency)}
                        </p>
                      </>
                    ) : (
                      <span className="text-amber-500 text-xs font-semibold">Not set</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setSetSalaryFor({
                        id: p.userId, fullName: p.fullName, role: p.role,
                      })}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition
                        ${p.salaryConfigured
                          ? 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                          : 'bg-amber-600 hover:bg-amber-500 text-white'}`}>
                      {p.salaryConfigured ? 'Edit' : 'Set Salary'}
                    </button>
                    {p.salaryConfigured && (
                      <button
                        onClick={() => setExpandedId(isOpen ? null : p.userId)}
                        className="text-slate-600 hover:text-white text-xs transition">
                        {isOpen ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded payslip detail */}
                {isOpen && p.salaryConfigured && (
                  <div className="px-4 pb-4 bg-slate-800/20 border-t border-slate-800/60">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      {/* Earnings */}
                      <div className="col-span-2 bg-slate-900 rounded-xl p-3 space-y-2">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                          Earnings
                        </p>
                        {p.earnings.map((e, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <div>
                              <p className="text-slate-300 text-xs">{e.label}</p>
                              <p className="text-slate-600 text-[10px]">{e.note}</p>
                            </div>
                            <span className="text-emerald-400 text-xs font-bold">
                              {fmt(e.amount, p.currency)}
                            </span>
                          </div>
                        ))}
                        <div className="pt-1.5 border-t border-slate-800 flex justify-between">
                          <span className="text-slate-300 text-xs font-semibold">Gross</span>
                          <span className="text-white text-xs font-bold">
                            {fmt(p.grossEarnings, p.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Deductions */}
                      <div className="col-span-2 bg-slate-900 rounded-xl p-3 space-y-2">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                          Deductions
                        </p>
                        {p.deductions.length === 0 ? (
                          <p className="text-emerald-400 text-xs">No deductions</p>
                        ) : p.deductions.map((d, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <div>
                              <p className="text-slate-300 text-xs">{d.label}</p>
                              <p className="text-slate-600 text-[10px]">{d.note}</p>
                            </div>
                            <span className="text-rose-400 text-xs font-bold">
                              −{fmt(d.amount, p.currency)}
                            </span>
                          </div>
                        ))}
                        <div className="pt-1.5 border-t border-slate-800 flex justify-between">
                          <span className="text-slate-300 text-xs font-semibold">Net Pay</span>
                          <span className="text-emerald-400 text-xs font-bold">
                            {fmt(p.netPay, p.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {setSalaryFor && (
        <SetSalaryModal
          employee={setSalaryFor}
          existing={getSalary(setSalaryFor.id)}
          onClose={() => setSetSalaryFor(null)}
        />
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const PayrollPage = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const now   = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [tab,   setTab]   = useState<'my' | 'team'>('my');

  // My payslip
  const { data: myPayslip, isLoading: myLoading } = useQuery<PayslipDto>({
    queryKey: ['myPayslip', month, year],
    queryFn:  () => payrollApi.getMyPayslip(month, year).then(r => r.data),
    staleTime: 30_000,
  });

  // Team payroll — only loaded on team tab
  const { data: teamData, isLoading: teamLoading } = useQuery<TeamPayrollDto>({
    queryKey: ['teamPayroll', month, year],
    queryFn:  () => payrollApi.getTeamPayroll(month, year).then(r => r.data),
    staleTime: 30_000,
    enabled:  isManager && tab === 'team',
  });

  // Salary configs — needed for "Set Salary" modal existing value
  const { data: salaries = [] } = useQuery<EmployeeSalaryDto[]>({
    queryKey: ['teamSalaries'],
    queryFn:  () => payrollApi.getTeamSalaries().then(r => r.data),
    staleTime: 60_000,
    enabled:  isManager,
  });

  const [downloading, setDownloading] = useState(false);

  const loading = tab === 'my' ? myLoading : teamLoading;

  const handleDownloadPayslip = async () => {
        setDownloading(true);
        try {
        const response = await payrollApi.downloadPayslip(month, year);
        // Create a blob URL and open in a new tab.
        // The HTML page auto-triggers window.print() so the browser
        // immediately shows the Save-as-PDF / Print dialog.
        const blob    = new Blob([response.data], { type: 'text/html' });
        const url     = URL.createObjectURL(blob);
        const newTab  = window.open(url, '_blank');
        // Revoke the object URL after the new tab has loaded it
        if (newTab) {
            newTab.addEventListener('load', () => URL.revokeObjectURL(url));
        }
        } catch {
        // Toast is optional — if you have a useToast hook, call toast.error() here
        console.error('Failed to download payslip');
        } finally {
        setDownloading(false);
        }
    };

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll Summary 💰</h1>
          <p className="text-slate-400 text-sm mt-1">
            Monthly payslip based on attendance, leave, and overtime data
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Download button — only visible on My Payslip tab when salary is configured */}
          {tab === 'my' && myPayslip?.salaryConfigured && (
            <button
              onClick={handleDownloadPayslip}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
                bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                disabled:cursor-not-allowed text-white transition">
              {downloading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white
                    rounded-full animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  ⬇️ Download Payslip
                </>
              )}
            </button>
          )}
          <MonthNav month={month} year={year}
            onChange={(m, y) => { setMonth(m); setYear(y); }} />
        </div>
      </div>

      {/* Tab switcher — manager/teamlead only */}
      {isManager && (
        <div className="flex rounded-xl overflow-hidden border border-slate-700 w-fit mb-6">
          {([['my', 'My Payslip'], ['team', 'Team Payroll']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-5 py-2 text-sm font-medium transition
                ${tab === k
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-32 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-52 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
            <div className="h-52 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
          </div>
        </div>
      ) : tab === 'my' && myPayslip ? (
        <PayslipCard payslip={myPayslip} />
      ) : tab === 'team' && teamData ? (
        <TeamPayrollView teamData={teamData} salaries={salaries} />
      ) : (
        <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl">
          <div className="text-4xl mb-3">💰</div>
          <p className="text-slate-300 font-semibold">No payroll data for this month</p>
          <p className="text-slate-500 text-sm mt-1">
            Check in and log hours to generate your payslip
          </p>
        </div>
      )}
    </div>
  );
};