import { useState, useEffect } from 'react';
import { authApi, getDeviceToken } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

export const TwoFactorSettingsPage = () => {
  const { isDark } = useTheme();
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const muteClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify'>('idle');
  const [qrData, setQrData] = useState<{ manualEntryKey: string; qrCodeBase64: string } | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
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
    } catch (e: unknown) {
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

  if (twoFactorEnabled === null) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-8 bg-slate-700 rounded w-48 mb-4" />
        <div className="animate-pulse h-4 bg-slate-700 rounded w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className={`text-2xl font-bold mb-2 ${textClass}`}>Security</h1>
      <p className={`${muteClass} text-sm mb-8`}>Manage two-factor authentication for your account</p>

      {/* Status card */}
      <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-xl p-6 mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-lg font-semibold ${textClass}`}>Two-Factor Authentication</h2>
            <p className={`${muteClass} text-sm mt-1`}>
              {twoFactorEnabled
                ? '2FA is enabled. Your account is protected.'
                : 'Add an extra layer of security with an authenticator app.'}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              twoFactorEnabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'
            }`}
          >
            {twoFactorEnabled ? 'On' : 'Off'}
          </span>
        </div>

        {twoFactorEnabled ? (
          <div className="space-y-4">
            <form onSubmit={handleDisable2FA} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className={`block text-xs font-medium mb-1 ${muteClass}`}>
                  Enter current code to disable 2FA
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className={`w-full border rounded-lg px-3 py-2 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
                />
              </div>
              <button
                type="submit"
                disabled={loading || disableCode.length !== 6}
                className="px-4 py-2 bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                Disable 2FA
              </button>
            </form>
            <button
              type="button"
              onClick={handleTrustDevice}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Trust this device for 30 days (skip 2FA)
            </button>
          </div>
        ) : setupStep === 'idle' ? (
          <button
            onClick={handleSetup2FA}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition"
          >
            {loading ? 'Setting up...' : 'Enable 2FA'}
          </button>
        ) : null}
      </div>

      {/* QR setup step */}
      {setupStep === 'qr' && qrData && (
        <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-xl p-6 space-y-4`}>
          <h3 className={`text-lg font-semibold ${textClass}`}>Scan QR Code</h3>
          <p className={`${muteClass} text-sm`}>
            Use Google Authenticator, Authy, or any TOTP app to scan the QR code below.
          </p>
          <div className="flex justify-center bg-white rounded-xl p-4">
            <img
              src={`data:image/png;base64,${qrData.qrCodeBase64}`}
              alt="2FA QR Code"
              className="w-48 h-48"
            />
          </div>
          <p className={`${muteClass} text-sm`}>
            Can't scan? Enter this key manually: <code className={`${isDark ? 'text-slate-300 bg-slate-700' : 'text-slate-600 bg-slate-200'} px-2 py-1 rounded`}>{qrData.manualEntryKey}</code>
          </p>
          <form onSubmit={handleVerifySetup} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className={`block text-xs font-medium mb-1 ${muteClass}`}>
                Enter the 6-digit code from your app
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className={`w-full border rounded-lg px-3 py-2 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                Verify & Enable
              </button>
              <button
                type="button"
                onClick={cancelSetup}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-300 text-sm font-medium rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
