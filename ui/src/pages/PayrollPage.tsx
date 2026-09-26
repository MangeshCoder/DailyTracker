import React, { useState } from 'react';
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
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import {
  Wallet,
  DollarSign,
  TrendingDown,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Receipt,
  Users,
  Building2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Edit3,
  ChevronDown,
  ChevronUp,
  X,
  Coins
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sym = (currency: string) => CURRENCY_SYMBOL[currency] ?? currency + ' ';

const fmt = (amount: number, currency: string) =>
  `${sym(currency)}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ─── Avatar Component ─────────────────────────────────────────────────────────
const Avatar: React.FC<{ name: string; size?: 'xs' | 'sm' | 'md' }> = ({
  name,
  size = 'sm',
}) => {
  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-bold',
  };
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`${sizeMap[size]} rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600
      flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm shadow-blue-500/20`}
    >
      {initials || 'U'}
    </div>
  );
};

// ─── Set Salary Modal ─────────────────────────────────────────────────────────
const SetSalaryModal: React.FC<{
  employee: { id: number; fullName: string; role: string };
  existing?: EmployeeSalaryDto | null;
  onClose: () => void;
}> = ({ employee, existing, onClose }) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<SetSalaryDto>({
    monthlySalary: existing?.monthlySalary ?? 0,
    currency: existing?.currency ?? 'INR',
    overtimeMultiplier: existing?.overtimeMultiplier ?? 1.5,
  });

  const mut = useMutation({
    mutationFn: () => payrollApi.setSalary(employee.id, form),
    onSuccess: () => {
      toast.success(`Salary package updated for ${employee.fullName}`);
      qc.invalidateQueries({ queryKey: ['teamSalaries'] });
      qc.invalidateQueries({ queryKey: ['teamPayroll'] });
      onClose();
    },
    onError: () => toast.error('Failed to configure employee salary'),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Configure Salary Package
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {employee.fullName} · {employee.role}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 uppercase tracking-wider">
              Monthly Gross Base Salary *
            </label>
            <div className="flex gap-2">
              <select
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
                className="w-24 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c} ({sym(c)})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={form.monthlySalary || ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    monthlySalary: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="e.g. 75000"
                className="flex-1 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 uppercase tracking-wider">
              Overtime Pay Multiplier
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 1.25, 1.5, 2].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, overtimeMultiplier: v }))
                  }
                  className={`py-2 rounded-xl text-xs sm:text-sm font-bold transition border cursor-pointer ${
                    form.overtimeMultiplier === v
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {v}×
                </button>
              ))}
            </div>
            <p className="text-slate-500 text-[11px] mt-1.5">
              Hourly OT Rate = (Monthly Salary ÷ 176 hrs) × {form.overtimeMultiplier}
            </p>
          </div>

          {form.monthlySalary > 0 && (
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Calculated Per-Day Rate:</span>
                <span className="text-slate-900 dark:text-white font-bold">
                  {sym(form.currency)}
                  {(form.monthlySalary / 22).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Standard Hourly Benchmark:</span>
                <span className="text-slate-900 dark:text-white font-bold">
                  {sym(form.currency)}
                  {(form.monthlySalary / (22 * 8)).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex gap-3 bg-slate-50/30 dark:bg-slate-950/20">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs sm:text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={form.monthlySalary <= 0 || mut.isPending}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-xl transition shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            {mut.isPending
              ? 'Saving…'
              : existing
              ? 'Update Package'
              : 'Save Package'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Payslip Card (Employee View) ─────────────────────────────────────────────
const PayslipCard: React.FC<{ payslip: PayslipDto }> = ({ payslip }) => {
  const cur = payslip.currency;

  if (!payslip.salaryConfigured) {
    return (
      <Card className="border-amber-500/30 shadow-sm overflow-hidden">
        <CardContent className="p-8 sm:p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
            <Coins className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Salary Package Pending Configuration
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Your compensation package has not been set by management or HR yet. Please contact your supervisor to assign your base salary.
          </p>
        </CardContent>
      </Card>
    );
  }

  const attendanceItems = [
    {
      label: 'Days Present / WFH',
      value: payslip.daysPresent,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Half Days',
      value: payslip.daysHalfDay,
      color: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Paid Leave',
      value: payslip.daysPaidLeave,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Unpaid Leave (LWP)',
      value: payslip.daysUnpaidLeave,
      color: 'text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Unapproved Absent',
      value: payslip.daysAbsent,
      color: 'text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Net Take-Home Pay"
          value={fmt(payslip.netPay, cur)}
          subtitle="Final computed disbursement"
          icon={Wallet}
          color="emerald"
        />
        <StatCard
          title="Gross Earnings"
          value={fmt(payslip.grossEarnings, cur)}
          subtitle="Before applicable deductions"
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Total Deductions"
          value={fmt(payslip.totalDeductions, cur)}
          subtitle="Absences and tax withholdings"
          icon={TrendingDown}
          color="rose"
        />
        <StatCard
          title="Working Days"
          value={`${payslip.workingDaysInMonth} Days`}
          subtitle={`Daily rate: ${fmt(payslip.perDayRate, cur)}`}
          icon={Calendar}
          color="purple"
        />
      </div>

      {/* ── Payslip Hero Banner ── */}
      <Card className="border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-md overflow-hidden">
        <CardContent className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Official Monthly Payslip
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold mt-1">
                {payslip.monthLabel}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {payslip.workingDaysInMonth} working days in period · Per-day standard rate: {fmt(payslip.perDayRate, cur)}
              </p>
            </div>
            <div className="text-left sm:text-right bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[200px]">
              <span className="text-xs text-slate-400 block">Net Payable Amount</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 block mt-0.5">
                {fmt(payslip.netPay, cur)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Gross: {fmt(payslip.grossEarnings, cur)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Detailed Breakdown Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Attendance Summary */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>Attendance Ledger</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-3">
            {attendanceItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between text-xs sm:text-sm"
              >
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  {item.label}
                </span>
                <span className={`font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
            {payslip.overtimeMinutes > 0 && (
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm">
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  Approved Overtime
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {payslip.overtimeHours}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Earnings */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span>Earnings & Compensations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-3">
            {payslip.earnings.map((e, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    {e.label}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {fmt(e.amount, cur)}
                  </span>
                </div>
                {e.note && (
                  <p className="text-slate-400 text-[11px] mt-0.5">{e.note}</p>
                )}
              </div>
            ))}
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-900 dark:text-white font-bold">
                Gross Earnings
              </span>
              <span className="text-slate-900 dark:text-white font-bold">
                {fmt(payslip.grossEarnings, cur)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Deductions */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              <span>Itemized Deductions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {payslip.deductions.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-semibold py-4">
                <CheckCircle2 className="w-4 h-4" />
                <span>Zero deductions assessed this billing cycle.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {payslip.deductions.map((d, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">
                        {d.label}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        −{fmt(d.amount, cur)}
                      </span>
                    </div>
                    {d.note && (
                      <p className="text-slate-400 text-[11px] mt-0.5">{d.note}</p>
                    )}
                  </div>
                ))}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-900 dark:text-white font-bold">
                    Total Deductions
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    −{fmt(payslip.totalDeductions, cur)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Net Disbursement Summary */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 shadow-sm overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-4 sm:p-5 border-b border-emerald-500/10">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
              Net Disbursement Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                Gross Earnings
              </span>
              <span className="text-slate-900 dark:text-white font-semibold">
                {fmt(payslip.grossEarnings, cur)}
              </span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                Total Deductions
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                −{fmt(payslip.totalDeductions, cur)}
              </span>
            </div>
            <div className="flex justify-between pt-2.5 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-900 dark:text-white font-bold text-sm">
                Net Pay (Payable)
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-base sm:text-lg">
                {fmt(payslip.netPay, cur)}
              </span>
            </div>

            <p className="text-slate-500 text-[11px] pt-3 border-t border-slate-100 dark:border-slate-800">
              Base Package: {fmt(payslip.monthlySalary, cur)} / month · OT Factor: {payslip.overtimeMultiplier}×
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ─── Team Payroll View (Manager / HR) ─────────────────────────────────────────
const TeamPayrollView: React.FC<{
  teamData: TeamPayrollDto;
  salaries: EmployeeSalaryDto[];
}> = ({ teamData, salaries }) => {
  const [setSalaryFor, setSetSalaryFor] = useState<{
    id: number;
    fullName: string;
    role: string;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const getSalary = (userId: number) =>
    salaries.find((s) => s.userId === userId) ?? null;

  const currency = teamData.members[0]?.currency ?? 'INR';

  return (
    <div className="space-y-6">
      {/* Team Totals KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Gross Payroll"
          value={teamData.members[0] ? fmt(teamData.teamTotalGross, currency) : '–'}
          subtitle="Cumulative team earnings"
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Total Net Disbursement"
          value={teamData.members[0] ? fmt(teamData.teamTotalNet, currency) : '–'}
          subtitle="Net funds after deductions"
          icon={Wallet}
          color="emerald"
        />
        <StatCard
          title="Total Deductions"
          value={teamData.members[0] ? fmt(teamData.teamTotalDeductions, currency) : '–'}
          subtitle="Total withholdings & unpaid leaves"
          icon={TrendingDown}
          color="rose"
        />
        <StatCard
          title="Overtime Liability"
          value={teamData.members[0] ? fmt(teamData.teamTotalOvertimePay, currency) : '–'}
          subtitle="Overtime compensation paid"
          icon={Clock}
          color="amber"
        />
      </div>

      {/* Warning banner for unconfigured employees */}
      {teamData.membersNotConfigured > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300">
              {teamData.membersNotConfigured} team member{teamData.membersNotConfigured !== 1 ? 's' : ''} require salary configuration
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Net pay displays as 0 until a monthly package is defined. Click "Set Salary" to assign their baseline.
            </p>
          </div>
        </div>
      )}

      {/* Member Payroll Ledger Card */}
      <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                Team Payroll Ledger — {teamData.monthLabel}
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {teamData.membersConfigured} active packages · {teamData.membersNotConfigured} pending setup
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {teamData.members.map((p) => {
              const isOpen = expandedId === p.userId;
              const salaryConf = getSalary(p.userId);

              return (
                <div key={p.userId}>
                  {/* Summary Row */}
                  <div className="p-4 flex items-center gap-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition select-none">
                    <Avatar name={p.fullName} size="sm" />

                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold truncate">
                        {p.fullName}
                      </p>
                      <p className="text-slate-400 text-[11px] truncate">
                        {p.role}
                      </p>
                    </div>

                    {/* Attendance Mini Chips */}
                    <div className="hidden md:flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        {p.daysPresent} Present
                      </span>
                      {p.daysAbsent > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
                          {p.daysAbsent} Absent
                        </span>
                      )}
                      {p.overtimeMinutes > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                          {p.overtimeHours} OT
                        </span>
                      )}
                    </div>

                    {/* Net Pay Amount */}
                    <div className="text-right flex-shrink-0 w-28 sm:w-32">
                      {p.salaryConfigured ? (
                        <>
                          <p className="text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm">
                            {fmt(p.netPay, p.currency)}
                          </p>
                          <p className="text-slate-400 text-[11px]">
                            Gross: {fmt(p.grossEarnings, p.currency)}
                          </p>
                        </>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          Not Configured
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setSetSalaryFor({
                            id: p.userId,
                            fullName: p.fullName,
                            role: p.role,
                          })
                        }
                        className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                          p.salaryConfigured
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                            : 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                        }`}
                      >
                        {p.salaryConfigured ? 'Edit Package' : 'Set Salary'}
                      </button>

                      {p.salaryConfigured && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isOpen ? null : p.userId)
                          }
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                        >
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Breakdown Drawer */}
                  {isOpen && p.salaryConfigured && (
                    <div className="p-4 sm:p-5 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Earnings */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Earnings Breakdown
                          </h5>
                          {p.earnings.map((e, i) => (
                            <div
                              key={i}
                              className="flex justify-between items-center text-xs"
                            >
                              <div>
                                <p className="text-slate-800 dark:text-slate-200 font-semibold">
                                  {e.label}
                                </p>
                                {e.note && (
                                  <p className="text-slate-400 text-[10px]">
                                    {e.note}
                                  </p>
                                )}
                              </div>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                {fmt(e.amount, p.currency)}
                              </span>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs font-bold">
                            <span className="text-slate-900 dark:text-white">
                              Total Gross
                            </span>
                            <span className="text-slate-900 dark:text-white">
                              {fmt(p.grossEarnings, p.currency)}
                            </span>
                          </div>
                        </div>

                        {/* Deductions */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Deductions Breakdown
                          </h5>
                          {p.deductions.length === 0 ? (
                            <p className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold py-2">
                              No deductions recorded.
                            </p>
                          ) : (
                            p.deductions.map((d, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center text-xs"
                              >
                                <div>
                                  <p className="text-slate-800 dark:text-slate-200 font-semibold">
                                    {d.label}
                                  </p>
                                  {d.note && (
                                    <p className="text-slate-400 text-[10px]">
                                      {d.note}
                                    </p>
                                  )}
                                </div>
                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                  −{fmt(d.amount, p.currency)}
                                </span>
                              </div>
                            ))
                          )}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs font-bold">
                            <span className="text-slate-900 dark:text-white">
                              Final Net Pay
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400">
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
        </CardContent>
      </Card>

      {/* Set Salary Modal */}
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

// ─── Main PayrollPage ─────────────────────────────────────────────────────────
export const PayrollPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<'my' | 'team'>('my');
  const [downloading, setDownloading] = useState(false);

  const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear();

  const prev = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const next = () => {
    if (isCurrent) return;
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  };

  // My payslip
  const { data: myPayslip, isLoading: myLoading } = useQuery<PayslipDto>({
    queryKey: ['myPayslip', month, year],
    queryFn: () => payrollApi.getMyPayslip(month, year).then((r) => r.data),
    staleTime: 30_000,
  });

  // Team payroll
  const { data: teamData, isLoading: teamLoading } = useQuery<TeamPayrollDto>({
    queryKey: ['teamPayroll', month, year],
    queryFn: () => payrollApi.getTeamPayroll(month, year).then((r) => r.data),
    staleTime: 30_000,
    enabled: isManager && tab === 'team',
  });

  // Salary configs for manager
  const { data: salaries = [] } = useQuery<EmployeeSalaryDto[]>({
    queryKey: ['teamSalaries'],
    queryFn: () => payrollApi.getTeamSalaries().then((r) => r.data),
    staleTime: 60_000,
    enabled: isManager,
  });

  const loading = tab === 'my' ? myLoading : teamLoading;

  const handleDownloadPayslip = async () => {
    setDownloading(true);
    try {
      const response = await payrollApi.downloadPayslip(month, year);
      const blob = new Blob([response.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip-${month}-${year}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Payslip generated and downloaded successfully');
    } catch {
      toast.error('Failed to generate payslip download');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Payroll & Compensation Hub"
        description="Comprehensive salary disbursement statements computed from verified attendance, leaves, and approved overtime hours."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Finance & HR' },
          { label: 'Payroll Hub' },
        ]}
        badge={{ label: 'Automated Tax & OT Engine', variant: 'emerald' }}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {tab === 'my' && myPayslip?.salaryConfigured && (
              <button
                type="button"
                onClick={handleDownloadPayslip}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm shadow-emerald-500/20 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{downloading ? 'Preparing…' : 'Download Payslip'}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-1 rounded-2xl shadow-sm">
              <button
                type="button"
                onClick={prev}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="px-3 py-1 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-w-[130px] text-center"
              >
                {MONTHS[month - 1]} {year}
              </button>
              <button
                type="button"
                onClick={next}
                disabled={isCurrent}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      />

      {/* ── Tab Switcher for Managers ── */}
      {isManager && (
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setTab('my')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === 'my'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>My Payslip</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('team')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === 'team'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Payroll Ledger</span>
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse"
              />
            ))}
          </div>
          <div className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
        </div>
      ) : tab === 'my' && myPayslip ? (
        <PayslipCard payslip={myPayslip} />
      ) : tab === 'team' && teamData ? (
        <TeamPayrollView teamData={teamData} salaries={salaries} />
      ) : (
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="text-center py-20 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Payroll Records for {MONTHS[month - 1]} {year}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Attendance records and salary figures are required to compute monthly statements.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayrollPage;