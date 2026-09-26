// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/ForgotPasswordPage.tsx
//  Account Recovery
//
//  Design from the 24-Sep redesign is kept. Changes:
//  ✅ Light mode added (dark unchanged) + sun/moon toggle top-right
//  ✅ Footer no longer claims "end-to-end encryption"
//  Logic unchanged: email → OTP → new password → redirect to /login.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  ShieldCheck
} from 'lucide-react';
import { authApi } from '../services/api';
import { AUTH, AuthBackground, AuthThemeToggle } from '../components/auth/authTheme';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (step === 'email') {
        await authApi.sendForgotPasswordOtp({ email: email.trim() });
        setStep('reset');
        setSuccess(`Verification code sent to ${email.trim()}`);
      } else {
        await authApi.resetPassword({
          email: email.trim(),
          code: otp.trim(),
          newPassword
        });
        setSuccess('Password reset successful! Redirecting to sign in...');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${AUTH.page} flex items-center justify-center p-4`}>
      <AuthBackground />
      <AuthThemeToggle />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className={`text-2xl font-bold tracking-tight ${AUTH.heading}`}>Account Recovery</h1>
          <p className={`text-xs mt-1 ${AUTH.muted}`}>
            {step === 'email' ? 'Enter your work email to reset your password' : 'Enter the code and choose a new password'}
          </p>
        </div>

        <div className={AUTH.card}>
          {error && (
            <div className={`mb-4 ${AUTH.error}`}>
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={`mb-4 ${AUTH.success}`}>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 'email' ? (
              <>
                <div>
                  <label className={AUTH.label}>Work Email</label>
                  <div className="relative">
                    <div className={AUTH.inputIcon}><Mail className="w-4 h-4" /></div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className={`${AUTH.input} pl-10 pr-4`}
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className={`${AUTH.primaryBtn} mt-2`}>
                  {loading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /><span>Sending Recovery Code...</span></>
                  ) : (
                    <><span>Send Recovery Code</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className={AUTH.otpBox}>
                  <KeyRound className="w-7 h-7 text-blue-500 mx-auto mb-2" />
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Enter 6-Digit Security Code
                  </label>
                  <p className={`text-[11px] mb-3 ${AUTH.muted}`}>
                    Sent to <span className="text-slate-800 dark:text-slate-200 font-semibold">{email}</span>
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className={`${AUTH.otpInput} !py-2.5`}
                  />
                </div>

                <div>
                  <label className={AUTH.label}>New Password</label>
                  <div className="relative">
                    <div className={AUTH.inputIcon}><Lock className="w-4 h-4" /></div>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className={`${AUTH.input} pl-10 pr-4`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || newPassword.length < 6}
                  className={AUTH.primaryBtn}
                >
                  {loading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /><span>Updating Password...</span></>
                  ) : (
                    <><span>Set New Password</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>

                <button type="button" onClick={() => setStep('email')} className={`w-full py-2 text-xs ${AUTH.ghostBtn}`}>
                  ← Back to email entry
                </button>
              </>
            )}
          </form>

          <div className={`mt-6 text-center text-xs pt-4 border-t ${AUTH.divider} ${AUTH.muted}`}>
            Remembered your password?{' '}
            <Link to="/login" className={`${AUTH.link} hover:underline`}>
              Sign In
            </Link>
          </div>
        </div>

        <div className={`mt-4 text-center text-xs flex items-center justify-center gap-1.5 ${AUTH.subtle}`}>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>The reset code is sent only to your registered email</span>
        </div>
      </div>
    </div>
  );
}
