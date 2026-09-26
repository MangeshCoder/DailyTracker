// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/TwoFactorSettingsPage.tsx
//  Security & 2FA - Modern Design System Upgrade
//
//  Route: /security
//  Logic unchanged from previous version:
//  ✅ Shows 2FA status (authApi.get2FAStatus)
//  ✅ Enable: setup → scan QR / manual key → verify 6-digit code
//  ✅ Disable: enter current 6-digit code
//  ✅ Trust this device for 30 days
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, getDeviceToken } from '../services/api';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import {
  ShieldCheck,
  ShieldOff,
  Smartphone,
  QrCode,
  KeyRound,
  Loader2,
  Copy,
  Check,
  MonitorSmartphone,
  ScanFace,
  ArrowRight,
  X,
} from 'lucide-react';

const CODE_INPUT_CLS =
  'w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'placeholder:text-slate-300 dark:placeholder:text-slate-600 rounded-xl px-4 py-3 font-mono text-2xl text-center tracking-[0.5em] ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';

export const TwoFactorSettingsPage = () => {
  const navigate = useNavigate();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify'>('idle');
  const [qrData, setQrData] = useState<{ manualEntryKey: string; qrCodeBase64: string } | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const fetchStatus = async () => {
    try {
      const res = await authApi.get2FAStatus();
      setTwoFactorEnabled(res.data.twoFactorEnabled);
    } catch {
      setTwoFactorEnabled(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const res = await authApi.setup2FA();
      setQrData({ manualEntryKey: res.data.manualEntryKey, qrCodeBase64: res.data.qrCodeBase64 });
      setSetupStep('qr');
    } catch {
      toast.error('Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) return;
    setLoading(true);
    try {
      await authApi.verify2FASetup(code);
      setSetupStep('idle');
      setCode('');
      setQrData(null);
      setTwoFactorEnabled(true);
      toast.success('Two-factor authentication has been enabled.');
    } catch {
      toast.error('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disableCode || disableCode.length !== 6) return;
    setLoading(true);
    try {
      await authApi.disable2FA(disableCode);
      setTwoFactorEnabled(false);
      setDisableCode('');
      toast.success('Two-factor authentication has been disabled.');
    } catch {
      toast.error('Invalid code. 2FA was not disabled.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrustDevice = async () => {
    try {
      const deviceToken = getDeviceToken();
      await authApi.trustDevice(deviceToken, `${navigator.userAgent.split(' ').slice(-2).join(' ')}`);
      toast.success('This device is now trusted for 30 days. 2FA will be skipped.');
    } catch {
      toast.error('Failed to trust device.');
    }
  };

  const cancelSetup = () => {
    setSetupStep('idle');
    setQrData(null);
    setCode('');
  };

  const copyKey = async () => {
    if (!qrData) return;
    try {
      await navigator.clipboard.writeText(qrData.manualEntryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available — key is still visible */
    }
  };

  const header = (
    <PageHeader
      title="Security"
      description="Protect your account with two-factor authentication."
      breadcrumbs={[
        { label: 'Workspace', href: '/' },
        { label: 'Account' },
        { label: 'Security & 2FA' },
      ]}
      badge={twoFactorEnabled === null
        ? { label: 'Checking…', variant: 'slate' }
        : twoFactorEnabled
          ? { label: '2FA On', variant: 'emerald', icon: <ShieldCheck className="w-3 h-3" /> }
          : { label: '2FA Off', variant: 'amber', icon: <ShieldOff className="w-3 h-3" /> }}
      className="!mb-0"
    />
  );

  if (twoFactorEnabled === null) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {header}
        <div className="h-48 bg-slate-100 dark:bg-slate-800/60 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {header}

      {/* ── Status card ── */}
      <Card className="relative overflow-hidden !rounded-3xl">
        <div className={`absolute -top-20 -right-20 w-56 h-56 rounded-full blur-2xl pointer-events-none bg-gradient-to-br ${
          twoFactorEnabled ? 'from-emerald-500/15' : 'from-amber-500/15'
        } to-transparent`} />
        <CardContent className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
              twoFactorEnabled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}>
              {twoFactorEnabled ? <ShieldCheck className="w-7 h-7" /> : <ShieldOff className="w-7 h-7" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Two-Factor Authentication</h2>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  twoFactorEnabled
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
                }`}>
                  {twoFactorEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {twoFactorEnabled
                  ? '2FA is enabled. Your account is protected.'
                  : 'Add an extra layer of security with an authenticator app.'}
              </p>
            </div>
            {!twoFactorEnabled && setupStep === 'idle' && (
              <button
                onClick={handleSetup2FA}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-50 shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {loading ? 'Setting up…' : 'Enable 2FA'}
              </button>
            )}
          </div>

          {/* Enabled: disable + trust device */}
          {twoFactorEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
              <form onSubmit={handleDisable2FA} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                  <ShieldOff className="w-4 h-4 text-rose-500" /> Disable 2FA
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Enter the current code from your app.</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className={`${CODE_INPUT_CLS} !text-xl !py-2.5`}
                />
                <button
                  type="submit"
                  disabled={loading || disableCode.length !== 6}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                  Disable 2FA
                </button>
              </form>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                  <MonitorSmartphone className="w-4 h-4 text-blue-500" /> Trusted device
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-1">
                  Skip the 2FA code on this browser for the next 30 days.
                </p>
                <button
                  type="button"
                  onClick={handleTrustDevice}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition"
                >
                  <Check className="w-4 h-4" /> Trust this device
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── QR setup ── */}
      {setupStep === 'qr' && qrData && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Set up your authenticator</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Google Authenticator, Authy, or any TOTP app</p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelSetup}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Cancel setup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Step 1 */}
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">1</span>
                  Scan this QR code
                </p>
                <div className="flex justify-center p-4 rounded-2xl bg-white border border-slate-200 dark:border-slate-700">
                  <img
                    src={`data:image/png;base64,${qrData.qrCodeBase64}`}
                    alt="2FA QR Code"
                    className="w-48 h-48"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 mb-1.5">Can't scan? Enter this key manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono">
                    {qrData.manualEntryKey}
                  </code>
                  <button
                    type="button"
                    onClick={copyKey}
                    title="Copy key"
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <form onSubmit={handleVerifySetup}>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">2</span>
                  Enter the 6-digit code
                </p>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                  <Smartphone className="w-8 h-8 mx-auto text-blue-500 mb-3" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    className={CODE_INPUT_CLS}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">Codes refresh every 30 seconds</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={cancelSetup}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="flex-[2] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    Verify & Enable
                  </button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Other security ── */}
      <Card hover onClick={() => navigate('/face-setup')} className="p-5 cursor-pointer group">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 flex items-center justify-center shrink-0">
            <ScanFace className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Face Registration</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Set up face verification for check-in and check-out.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition" />
        </div>
      </Card>
    </div>
  );
};