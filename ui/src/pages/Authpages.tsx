import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Clock,
  Users,
  CheckCircle2,
  KeyRound,
  Fingerprint,
  Briefcase,
  CalendarCheck,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  ChevronRight,
  Shield,
  UserCheck,
  Building2
} from 'lucide-react';
import { authApi, getDeviceToken } from '../services/api';
import { useAuth } from '../context/Authcontext';

// Showcase features displayed on the split-screen banner
const SHOWCASE_FEATURES = [
  {
    icon: Fingerprint,
    title: 'Biometric & Geo Attendance',
    tagline: 'Precision Check-Ins',
    desc: 'Facial verification with GPS geofencing ensures transparent, tamper-free workforce timesheets.',
    badge: 'Hardware & WebRTC Ready'
  },
  {
    icon: CalendarCheck,
    title: 'Automated Leave & Shifts',
    tagline: 'Zero Approval Bottlenecks',
    desc: 'Smart balance tracking, multi-tier manager approvals, and synchronized team leave calendars.',
    badge: 'Real-time Sync'
  },
  {
    icon: Briefcase,
    title: 'Workforce Intelligence',
    tagline: 'Continuous Visibility',
    desc: 'Automated End-Of-Day (EOD) reporting, task burn-down analytics, and peer kudos recognition.',
    badge: 'Actionable Insights'
  }
];

export const LoginPage = () => {
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password');
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // 2FA step (Authenticator app / TOTP)
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [verify2FALoading, setVerify2FALoading] = useState(false);

  // Email OTP step
  const [emailOtpStep, setEmailOtpStep] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Carousel timer
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  // Demo accounts helper
  const [showDemoCredentials, setShowDemoCredentials] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeatureIndex(prev => (prev + 1) % SHOWCASE_FEATURES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle standard password login
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!form.email || !form.password) {
      setError('Please provide both your corporate email and password.');
      return;
    }

    setLoading(true);
    try {
      const deviceToken = rememberDevice ? getDeviceToken() : undefined;
      const res = await authApi.login(
        { email: form.email.trim(), password: form.password },
        deviceToken
      );

      if (res.data?.requiresTwoFactor) {
        setTempToken(res.data.tempToken);
        setTwoFactorStep(true);
        return;
      }

      // Supports both root user and nested tokens.user from the API
      const user = res.data?.user || res.data?.tokens?.user;
      if (user) {
        login(user);
        navigate('/');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP send
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!form.email) {
      setError('Please enter your email address to receive a one-time verification code.');
      return;
    }

    setLoading(true);
    try {
      await authApi.sendLoginOtp({ email: form.email.trim() });
      setEmailOtpStep(true);
      setResendCooldown(45);
      setInfoMessage(`We've sent a 6-digit verification code to ${form.email.trim()}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!emailOtp || emailOtp.length !== 6) {
      setError('Please enter the complete 6-digit code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.verifyLoginOtp({
        email: form.email.trim(),
        code: emailOtp.trim()
      });

      if (res.data?.requiresTwoFactor) {
        setTempToken(res.data.tempToken);
        setTwoFactorStep(true);
        setEmailOtpStep(false);
        return;
      }

      const user = res.data?.user || res.data?.tokens?.user;
      if (user) {
        login(user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle 2FA Verification (TOTP Authenticator)
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    setVerify2FALoading(true);
    try {
      const res = await authApi.verify2FALogin(tempToken, totpCode.trim());
      const user = res.data?.user || res.data?.tokens?.user || res.data;
      if (user) {
        login(user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code. Please check your authenticator clock and try again.');
    } finally {
      setVerify2FALoading(false);
    }
  };

  const handleDemoFill = (email: string) => {
    setForm({ email, password: 'Password123!' });
    setAuthMode('password');
    setEmailOtpStep(false);
    setTwoFactorStep(false);
    setError('');
  };

  const currentFeature = SHOWCASE_FEATURES[activeFeatureIndex];
  const FeatureIcon = currentFeature.icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center relative overflow-hidden selection:bg-blue-600 selection:text-white">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-30 pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* LEFT: Desktop Showcase */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-between space-y-8 pr-4">
            <div>
              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-blue-950/60 border border-blue-800/40 text-blue-400 text-xs font-medium mb-6">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Enterprise Suite · v2.4</span>
                <span className="text-blue-600 font-bold">·</span>
                <span className="text-slate-400">High Reliability EMS</span>
              </div>

              <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-tight">
                The Operating System for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">Modern Workforces</span>
              </h1>
              <p className="mt-4 text-base xl:text-lg text-slate-400 leading-relaxed max-w-xl">
                Seamlessly unify employee attendance, biometric facial verification, smart shift scheduling, and real-time operational analytics in one secure platform.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <FeatureIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                      {currentFeature.tagline}
                    </div>
                    <div className="text-lg font-bold text-white">
                      {currentFeature.title}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-400 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-md">
                  {currentFeature.badge}
                </span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed mb-5">
                {currentFeature.desc}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  {SHOWCASE_FEATURES.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveFeatureIndex(idx)}
                      aria-label={`Show feature ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === activeFeatureIndex ? 'w-8 bg-blue-500' : 'w-2.5 bg-slate-700 hover:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-xs text-slate-500">
                  Slide {activeFeatureIndex + 1} of {SHOWCASE_FEATURES.length}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="border border-slate-800/60 rounded-xl p-3.5 bg-slate-900/40">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-slate-300">Security</span>
                </div>
                <div className="text-xs text-slate-400">
                  256-Bit SSL & Zero-Trust Access
                </div>
              </div>

              <div className="border border-slate-800/60 rounded-xl p-3.5 bg-slate-900/40">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-slate-300">Uptime</span>
                </div>
                <div className="text-xs text-slate-400">
                  99.98% High Availability SLA
                </div>
              </div>

              <div className="border border-slate-800/60 rounded-xl p-3.5 bg-slate-900/40">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-slate-300">Compliance</span>
                </div>
                <div className="text-xs text-slate-400">
                  SOC 2 & Statutory Compliant
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 italic border-l-2 border-blue-500/40 pl-3">
              "Designed for high-growth engineering, management, and field operations teams."
            </div>
          </div>

          {/* RIGHT: Authentication Form Card */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="lg:hidden text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-3">
                <Building2 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Daily Tracker EMS</h1>
              <p className="text-xs text-slate-400 mt-1">Enterprise Employee Management Suite</p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="hidden lg:flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/30">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        {twoFactorStep
                          ? 'Two-Factor Authentication'
                          : emailOtpStep
                          ? 'Email Code Verification'
                          : 'Sign In to Workspace'}
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {twoFactorStep
                          ? 'Enter the 6-digit TOTP from your authenticator'
                          : emailOtpStep
                          ? 'Check your corporate inbox for the verification code'
                          : 'Enter your credentials to access your dashboard'}
                      </p>
                    </div>
                  </div>
                </div>

                {!twoFactorStep && !emailOtpStep && (
                  <div className="mt-5 grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('password');
                        setError('');
                        setInfoMessage('');
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                        authMode === 'password'
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Password Login
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('otp');
                        setError('');
                        setInfoMessage('');
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                        authMode === 'otp'
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Email OTP
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {infoMessage && (
                <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {/* 2FA Form */}
              {twoFactorStep ? (
                <form onSubmit={handleVerify2FA} className="space-y-5">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <KeyRound className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      Enter 6-Digit Authenticator Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      placeholder="000000"
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-center text-3xl tracking-[0.4em] py-3 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={verify2FALoading || totpCode.length !== 6}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {verify2FALoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Security Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorStep(false);
                      setTotpCode('');
                      setTempToken('');
                    }}
                    className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    ← Back to standard login
                  </button>
                </form>
              ) : emailOtpStep ? (
                /* Email OTP Verification Form */
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <Mail className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Enter Verification Code
                    </label>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Sent to <span className="text-slate-200 font-semibold">{form.email}</span>
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      placeholder="000000"
                      value={emailOtp}
                      onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-center text-3xl tracking-[0.4em] py-3 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || emailOtp.length !== 6}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => setEmailOtpStep(false)}
                      className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      ← Change email
                    </button>

                    <button
                      type="button"
                      disabled={resendCooldown > 0 || loading}
                      onClick={() => handleSendOtp()}
                      className="text-blue-400 hover:text-blue-300 disabled:text-slate-600 transition-colors font-medium"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                </form>
              ) : authMode === 'password' ? (
                /* Standard Password Sign-In */
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Work Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="you@company.com"
                        autoComplete="email"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Password
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={e => setRememberDevice(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 focus:ring-offset-transparent transition"
                      />
                      <span className="text-xs text-slate-400 hover:text-slate-300">
                        Trust this device (30 days)
                      </span>
                    </label>

                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-500" />
                      Encrypted session
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Email OTP Request Form */
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Work Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="you@company.com"
                        autoComplete="email"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      We will dispatch a secure 6-digit one-time code to your registered inbox.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Login Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Quick Demo Accounts Drawer */}
              <div className="mt-6 pt-5 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowDemoCredentials(!showDemoCredentials)}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Quick Autofill Test Accounts</span>
                  </span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      showDemoCredentials ? 'rotate-90 text-blue-400' : 'text-slate-500'
                    }`}
                  />
                </button>

                {showDemoCredentials && (
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDemoFill('developer@example.com')}
                      className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-blue-500/50 hover:bg-blue-950/20 text-left transition-colors group"
                    >
                      <div className="text-[11px] font-semibold text-slate-300 group-hover:text-blue-300">
                        Developer
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">dev@...</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDemoFill('teamlead@example.com')}
                      className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-blue-500/50 hover:bg-blue-950/20 text-left transition-colors group"
                    >
                      <div className="text-[11px] font-semibold text-slate-300 group-hover:text-blue-300">
                        Team Lead
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">lead@...</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDemoFill('manager@example.com')}
                      className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-blue-500/50 hover:bg-blue-950/20 text-left transition-colors group"
                    >
                      <div className="text-[11px] font-semibold text-slate-300 group-hover:text-blue-300">
                        Manager
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">mgr@...</div>
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-5 text-center text-xs text-slate-400">
                New to the organization?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                >
                  Create employee account
                </Link>
              </div>
            </div>

            <div className="mt-5 text-center flex items-center justify-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Encrypted with TLS 1.3</span>
              </span>
              <span>·</span>
              <a
                href="mailto:support@company.com"
                className="hover:text-slate-400 transition-colors flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Contact IT Helpdesk</span>
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export const RegisterPage = () => {
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
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
        await authApi.sendRegisterOtp({ email: form.email.trim() });
        setOtpStep(true);
      } else {
        const res = await authApi.verifyRegisterOtp({
          ...form,
          email: form.email.trim(),
          code: otp.trim()
        });

        if (res.data?.user) {
          login(res.data.user);
          navigate('/');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden selection:bg-blue-600 selection:text-white">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-30 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Employee Account</h1>
          <p className="text-xs text-slate-400 mt-1">
            {otpStep ? 'Verify your corporate email address' : 'Join your organization on Daily Tracker EMS'}
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!otpStep ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  required
                  value={form.fullName}
                  onChange={e => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Jane Doe"
                  className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="jane.doe@company.com"
                  className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Create a strong password"
                  className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Verification Code...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <Mail className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Enter 6-Digit Email Code
                </label>
                <p className="text-[11px] text-slate-400 mb-3">
                  Sent to <span className="text-slate-200 font-semibold">{form.email}</span>
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-center text-3xl tracking-[0.4em] py-3 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none placeholder:text-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registering Account...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Complete Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setOtpStep(false)}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back to details
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-xs text-slate-400 pt-4 border-t border-slate-800">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-blue-400 hover:text-blue-300 hover:underline transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};