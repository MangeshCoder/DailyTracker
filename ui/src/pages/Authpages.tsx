import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi, getDeviceToken } from '../services/api';
import { useAuth } from '../context/Authcontext';
import type { LoginResponseDto } from '../types';

export const LoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // 2FA step: when login returns requiresTwoFactor
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [code, setCode] = useState('');
  const [verify2FALoading, setVerify2FALoading] = useState(false);
  const [emailOtpStep, setEmailOtpStep] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!emailOtpStep) {
        await authApi.sendLoginOtp({ email: form.email });
        setEmailOtpStep(true);
      } else {
        const res = await authApi.verifyLoginOtp({
          email: form.email,
          code: emailOtp
        });

        if (res.data.requiresTwoFactor) {
          setTempToken(res.data.tempToken);
          setTwoFactorStep(true);
          setEmailOtpStep(false);
          return; 
        }

      if (!res.data.requiresTwoFactor) {
        login(res.data.user);
        navigate('/');
      }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setVerify2FALoading(true);
    setError('');
    try {
      const res = await authApi.verify2FALogin(tempToken, code);
      login(res.data.user);
      navigate('/');
    } catch (err: any) {
      setError('Invalid verification code. Please try again.');
    } finally {
      setVerify2FALoading(false);
    }
  };

return (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white">Employee Management System</h1>
        <p className="text-slate-400 mt-1">Track your work day efficiently</p>
      </div>

      <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-6">
          {twoFactorStep
            ? 'Two-Factor Verification'
            : emailOtpStep
            ? 'Email OTP Verification'
            : 'Sign In'}
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* ================= 2FA STEP ================= */}
        {twoFactorStep ? (
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <p className="text-slate-400 text-sm">
              Enter the 6-digit code from your authenticator app
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em]"
            />

            <button
              type="submit"
              disabled={verify2FALoading || code.length !== 6}
              className="w-full bg-blue-600 py-3 rounded-xl"
            >
              {verify2FALoading ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={() => {
                setTwoFactorStep(false);
                setCode('');
                setTempToken('');
              }}
              className="w-full text-slate-400 text-sm"
            >
              ← Back to login
            </button>
          </form>
        ) : emailOtpStep ? (
          /* ================= EMAIL OTP STEP ================= */
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-slate-400 text-sm">
              Enter the 6-digit OTP sent to your email
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={emailOtp}
              onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em]"
            />

            <button
              type="submit"
              disabled={loading || emailOtp.length !== 6}
              className="w-full bg-blue-600 py-3 rounded-xl"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>

            <button
              type="button"
              onClick={() => setEmailOtpStep(false)}
              className="w-full text-slate-400 text-sm"
            >
              ← Back
            </button>
          </form>
        ) : (
          /* ================= NORMAL LOGIN STEP ================= */
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-3"
                />
                <p className="text-right mt-2">
                  <Link to="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300">
                    Forgot Password?
                  </Link>
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 py-3 rounded-xl"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-slate-400 text-sm mt-6">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-400">
                Register
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  </div>
);
};

export const RegisterPage = () => {
  const [form, setForm] = useState({ fullName: '', email: '', password: ''});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');


const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  try {
    if (!otpStep) {
      // Step 1: Send OTP
      await authApi.sendRegisterOtp({ email: form.email });
      setOtpStep(true);
    } else {
      // Step 2: Verify OTP + Register
      const res = await authApi.verifyRegisterOtp({
        ...form,
        code: otp
      });

      login(res.data.user);

      navigate('/');
    }
  } catch (err: any) {
    setError(err.response?.data?.message || 'Something went wrong.');
  } finally {
    setLoading(false);
  }
};

  return (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Employee Management System</h1>
        <p className="text-slate-400 mt-1">
          {otpStep ? 'Verify your email' : 'Create your account'}
        </p>
      </div>

      <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-6">
          {otpStep ? 'Email Verification' : 'Register'}
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {!otpStep ? (
          /* ================= REGISTER FORM ================= */
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              required
              value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
              placeholder="Full Name"
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3"
            />

            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3"
            />

            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Password"
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3"
            />

            {/* <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3"
            >
              <option value="Developer">Developer</option>
              <option value="TeamLead">Team Lead</option>
              <option value="Manager">Manager</option>
            </select> */}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 py-3 rounded-xl"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          /* ================= OTP STEP ================= */
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-slate-400 text-sm">
              Enter the 6-digit OTP sent to your email
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em]"
            />

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-blue-600 py-3 rounded-xl"
            >
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>

            <button
              type="button"
              onClick={() => setOtpStep(false)}
              className="w-full text-slate-400 text-sm"
            >
              ← Back
            </button>
          </form>
        )}

        <p className="text-center text-slate-400 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  </div>
);
};