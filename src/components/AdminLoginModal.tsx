import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Lock, 
  ShieldCheck, 
  KeyRound, 
  User, 
  UserPlus,
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  X, 
  RefreshCw,
  Mail,
  ArrowRight,
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthModalTab = 'login' | 'register' | 'forgot-password' | 'change-password';

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose }) => {
  const { 
    user, 
    isAuthenticated, 
    statusInfo, 
    login, 
    register, 
    requestPasswordReset, 
    resetPassword, 
    logout, 
    changePassword 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AuthModalTab>('login');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register / Create Account form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<'admin' | 'editor'>('admin');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  // Password reset form state
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetGeneratedCode, setResetGeneratedCode] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Change password form state (authenticated)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [changeLoading, setChangeLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    const res = await login(loginEmail, loginPassword);
    setLoginLoading(false);

    if (res.success) {
      setLoginPassword('');
      setLoginError(null);
      setTimeout(() => {
        onClose();
      }, 500);
    } else {
      setLoginError(res.error || 'Failed to authenticate');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(false);

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters.');
      return;
    }

    setRegLoading(true);
    const res = await register(regName, regEmail, regPassword, regRole);
    setRegLoading(false);

    if (res.success) {
      setRegSuccess(true);
      setTimeout(() => {
        onClose();
      }, 700);
    } else {
      setRegError(res.error || 'Failed to create account.');
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccessMessage(null);
    setResetLoading(true);

    const res = await requestPasswordReset(resetEmail);
    setResetLoading(false);

    if (res.success) {
      setResetGeneratedCode(res.resetCode || null);
      if (res.resetCode) {
        setResetCode(res.resetCode);
      }
      setResetSuccessMessage(res.message || 'Verification code generated.');
      setResetStep('confirm');
    } else {
      setResetError(res.error || 'Failed to request password reset code.');
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccessMessage(null);

    if (newResetPassword !== confirmResetPassword) {
      setResetError('New passwords do not match.');
      return;
    }

    if (newResetPassword.length < 6) {
      setResetError('New password must be at least 6 characters long.');
      return;
    }

    setResetLoading(true);
    const res = await resetPassword(resetEmail, resetCode, newResetPassword);
    setResetLoading(false);

    if (res.success) {
      setResetSuccessMessage('Password successfully updated! You can now sign in.');
      setLoginEmail(resetEmail);
      setLoginPassword(newResetPassword);
      setTimeout(() => {
        setActiveTab('login');
        setResetStep('request');
        setResetGeneratedCode(null);
      }, 1800);
    } else {
      setResetError(res.error || 'Failed to reset password.');
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError(null);
    setChangeSuccess(false);

    if (newPassword !== confirmPassword) {
      setChangeError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setChangeError('New password must be at least 6 characters.');
      return;
    }

    setChangeLoading(true);
    const res = await changePassword(currentPassword, newPassword);
    setChangeLoading(false);

    if (res.success) {
      setChangeSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setChangeSuccess(false);
      }, 4000);
    } else {
      setChangeError(res.error || 'Failed to change password');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-[#111111] border border-zinc-300 dark:border-zinc-800 w-full max-w-lg shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100 relative rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-[#F6F5F0] dark:bg-black/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                Studio Admin Authentication
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono">
                Native Node.js Security • Account &amp; Key Management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer p-1"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation (ARCHITECTURE tab removed as requested) */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-[#ECEBE6] dark:bg-zinc-950 text-xs font-mono">
          {!isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-2.5 px-3 text-center font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-white dark:bg-[#111111] text-zinc-950 dark:text-white border-b-2 border-zinc-950 dark:border-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-2.5 px-3 text-center font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-white dark:bg-[#111111] text-zinc-950 dark:text-white border-b-2 border-zinc-950 dark:border-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Create Account
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('forgot-password')}
                className={`flex-1 py-2.5 px-3 text-center font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'forgot-password'
                    ? 'bg-white dark:bg-[#111111] text-zinc-950 dark:text-white border-b-2 border-zinc-950 dark:border-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Reset Key
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-2.5 px-4 text-center font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-white dark:bg-[#111111] text-zinc-950 dark:text-white border-b-2 border-zinc-950 dark:border-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Admin Profile
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('change-password')}
                className={`flex-1 py-2.5 px-4 text-center font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'change-password'
                    ? 'bg-white dark:bg-[#111111] text-zinc-950 dark:text-white border-b-2 border-zinc-950 dark:border-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Change Password
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-2.5 px-4 text-center font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-white dark:bg-[#111111] text-zinc-950 dark:text-white border-b-2 border-zinc-950 dark:border-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                New User
              </button>
            </>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="p-6 space-y-5">
          {/* TAB 1: LOGIN / AUTHENTICATED PROFILE */}
          {activeTab === 'login' && (
            <div>
              {isAuthenticated && user ? (
                /* Authenticated State Display */
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase font-mono">
                        Active Studio Admin Session
                      </h4>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300">
                        Authenticated as <strong>{user.name}</strong> ({user.email}). You have verified privileges to manage artwork status, execute storage actions, and synchronize assets.
                      </p>
                    </div>
                  </div>

                  <div className="border border-zinc-200 dark:border-zinc-800 bg-[#F9F9F7] dark:bg-black/50 p-4 space-y-2 font-mono text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-200 dark:border-zinc-800/60">
                      <span className="text-zinc-500 uppercase">User Name:</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">{user.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-200 dark:border-zinc-800/60">
                      <span className="text-zinc-500 uppercase">Email:</span>
                      <span className="text-zinc-900 dark:text-zinc-100">{user.email}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-200 dark:border-zinc-800/60">
                      <span className="text-zinc-500 uppercase">Role:</span>
                      <span className="inline-block px-1.5 py-0.2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black uppercase text-[10px] font-bold">
                        {user.role}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-200 dark:border-zinc-800/60">
                      <span className="text-zinc-500 uppercase">Session Security:</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">HttpOnly Secure Cookie + scrypt KDF</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('change-password')}
                      className="px-3 py-2 text-xs font-mono uppercase tracking-wider font-bold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        onClose();
                      }}
                      className="px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Unauthenticated Sign In Form */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {loginError && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800/80 flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  {/* Security Notice & Quick Fill Helper */}
                  <div className="p-3 bg-[#F2F1EC] dark:bg-zinc-900/60 border border-zinc-300 dark:border-zinc-800 text-xs font-mono space-y-2 text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span>Studio Admin Authentication • Supports Cloud &amp; Vercel Serverless</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-200 dark:border-zinc-800/80">
                      <span className="text-[10px] uppercase font-bold text-zinc-500">Quick Fill:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginEmail('rory@ventureio.com');
                          setLoginPassword('Austin512');
                        }}
                        className="px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors"
                      >
                        rory@ventureio.com
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginEmail('admin@roryskagen.com');
                          setLoginPassword('StudioAdmin2026!');
                        }}
                        className="px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors"
                      >
                        admin@roryskagen.com
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                      Admin Email:
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="rory@ventureio.com"
                        className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100 transition-colors"
                      />
                      <User className="w-4 h-4 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                        Password:
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(loginEmail);
                          setActiveTab('forgot-password');
                        }}
                        className="text-[10px] font-mono text-zinc-500 hover:text-black dark:hover:text-white uppercase underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 pr-9 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                        title={showLoginPassword ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveTab('register')}
                      className="text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Account</span>
                    </button>
                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="px-5 py-2 text-xs font-mono uppercase tracking-wider font-bold bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {loginLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{loginLoading ? 'Verifying...' : 'Sign In as Admin'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: CREATE ACCOUNT / REGISTER */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {regError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800/80 flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/80 flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Account successfully created! Signing you in...</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                  Full Name / Display Name:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Rory Skagen or Studio Assistant"
                    className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                  />
                  <User className="w-4 h-4 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                  Email Address:
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. archivist@roryskagen.com"
                    className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                  />
                  <Mail className="w-4 h-4 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                    Password:
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-3 py-2 pr-9 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                    Confirm Password:
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                  User Role:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <label className={`border p-2 cursor-pointer flex items-center gap-2 ${
                    regRole === 'admin' 
                      ? 'border-zinc-950 dark:border-white bg-zinc-100 dark:bg-zinc-900 font-bold' 
                      : 'border-zinc-300 dark:border-zinc-800'
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={regRole === 'admin'}
                      onChange={() => setRegRole('admin')}
                      className="accent-zinc-900 dark:accent-zinc-100"
                    />
                    <span>Administrator</span>
                  </label>
                  <label className={`border p-2 cursor-pointer flex items-center gap-2 ${
                    regRole === 'editor' 
                      ? 'border-zinc-950 dark:border-white bg-zinc-100 dark:bg-zinc-900 font-bold' 
                      : 'border-zinc-300 dark:border-zinc-800'
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="editor"
                      checked={regRole === 'editor'}
                      onChange={() => setRegRole('editor')}
                      className="accent-zinc-900 dark:accent-zinc-100"
                    />
                    <span>Editor / Curator</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
                >
                  Already have an account? Sign In
                </button>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="px-5 py-2 text-xs font-mono uppercase tracking-wider font-bold bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {regLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{regLoading ? 'Registering...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: PASSWORD RESET (2-Step Verification) */}
          {activeTab === 'forgot-password' && (
            <div className="space-y-4 font-mono text-xs">
              {resetError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800/80 flex items-start gap-2 text-red-800 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccessMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/80 flex items-start gap-2 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{resetSuccessMessage}</span>
                </div>
              )}

              {resetGeneratedCode && resetStep === 'confirm' && (
                <div className="p-3 bg-[#FAF8F2] dark:bg-zinc-900 border border-amber-300 dark:border-amber-700/60 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-bold uppercase text-[10px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Password Reset Verification Code</span>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-black p-2 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-600 dark:text-zinc-400 text-[11px]">Verification Code (15 min TTL):</span>
                    <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400 tracking-widest">{resetGeneratedCode}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Auto-populated into the verification form below for instant recovery.
                  </p>
                </div>
              )}

              {resetStep === 'request' ? (
                /* Step 1: Request Reset Code */
                <form onSubmit={handleRequestResetCode} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                      Account Email Address:
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="e.g. admin@roryskagen.com"
                        className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                      />
                      <Mail className="w-4 h-4 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveTab('login')}
                      className="text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="px-5 py-2 uppercase tracking-wider font-bold bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {resetLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                      <span>{resetLoading ? 'Generating...' : 'Get Reset Code'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Step 2: Confirm Reset Code & Set New Password */
                <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                      6-Digit Verification Code:
                    </label>
                    <input
                      type="text"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="e.g. 849201"
                      className="w-full px-3 py-2 text-xs font-mono font-bold tracking-wider border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                      New Password:
                    </label>
                    <div className="relative">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newResetPassword}
                        onChange={(e) => setNewResetPassword(e.target.value)}
                        placeholder="Enter new password (min 6 chars)"
                        className="w-full px-3 py-2 pr-9 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                      Confirm New Password:
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmResetPassword}
                      onChange={(e) => setConfirmResetPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setResetStep('request')}
                      className="text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
                    >
                      &larr; Request New Code
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="px-5 py-2 uppercase tracking-wider font-bold bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {resetLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{resetLoading ? 'Resetting...' : 'Reset & Save Key'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: CHANGE PASSWORD (when authenticated) */}
          {activeTab === 'change-password' && isAuthenticated && (
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              {changeError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800/80 flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{changeError}</span>
                </div>
              )}

              {changeSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/80 flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Admin password successfully updated and securely hashed with scrypt.</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                  Current Password:
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                  New Password:
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                  Confirm New Password:
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="px-3 py-2 text-xs font-mono uppercase font-bold text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changeLoading}
                  className="px-5 py-2 text-xs font-mono uppercase tracking-wider font-bold bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {changeLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>{changeLoading ? 'Updating...' : 'Save New Key'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
