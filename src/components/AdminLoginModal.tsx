import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Lock, 
  ShieldCheck, 
  KeyRound, 
  User, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  X, 
  Cpu, 
  Cookie, 
  Hash, 
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated, isLoading, statusInfo, login, logout, changePassword } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'change-password' | 'architecture'>('login');
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [changeLoading, setChangeLoading] = useState(false);

  if (!isOpen) return null;

  const handleFillDefaults = () => {
    setEmail(statusInfo?.defaultAdminEmail || 'admin@roryskagen.com');
    setPassword(statusInfo?.defaultPasswordHint || 'StudioAdmin2026!');
    setLoginError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    const res = await login(email, password);
    setLoginLoading(false);

    if (res.success) {
      setPassword('');
      setLoginError(null);
      // Auto close after brief moment or stay open
      setTimeout(() => {
        onClose();
      }, 600);
    } else {
      setLoginError(res.error || 'Failed to authenticate');
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
                Pure Native Node.js Security • Zero Dependencies
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

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-[#ECEBE6] dark:bg-zinc-950 text-xs font-mono">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2.5 px-4 text-center font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'login'
                ? 'bg-white dark:bg-[#111111] text-zinc-950 dark:text-white border-b-2 border-zinc-950 dark:border-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            {isAuthenticated ? 'Admin Profile' : 'Sign In'}
          </button>
          
          {isAuthenticated && (
            <button
              onClick={() => setActiveTab('change-password')}
              className={`flex-1 py-2.5 px-4 text-center font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === 'change-password'
                  ? 'bg-white dark:bg-[#111111] text-zinc-950 dark:text-white border-b-2 border-zinc-950 dark:border-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Change Key
            </button>
          )}

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex-1 py-2.5 px-4 text-center font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-white dark:bg-[#111111] text-zinc-950 dark:text-white border-b-2 border-zinc-950 dark:border-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Architecture
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 space-y-5">
          {/* TAB 1: LOGIN / USER PROFILE */}
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
                        Authenticated as <strong>{user.name}</strong> ({user.email}). You have verified administrative privileges to manage artwork status, execute storage actions, and synchronize assets.
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
                      <span className="text-zinc-500 uppercase">Session Storage:</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">HttpOnly Secure Cookie + Memory Map</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-500 uppercase">Hashing:</span>
                      <span className="text-zinc-700 dark:text-zinc-300">scrypt (16-byte salt, 64-byte key)</span>
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

                  {/* Seed hint box */}
                  <div className="p-3 bg-[#F2F1EC] dark:bg-black/60 border border-zinc-300 dark:border-zinc-800 text-xs font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase text-[10px] text-zinc-600 dark:text-zinc-400">Studio Admin Seed Credentials:</span>
                      <button
                        type="button"
                        onClick={handleFillDefaults}
                        className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline uppercase font-bold cursor-pointer"
                      >
                        Auto-Fill Form
                      </button>
                    </div>
                    <div className="text-[11px] text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                      <span>Email: <code className="bg-white dark:bg-zinc-900 px-1 py-0.5 border border-zinc-200 dark:border-zinc-800 font-bold">{statusInfo?.defaultAdminEmail || 'admin@roryskagen.com'}</code></span>
                      <span>Password: <code className="bg-white dark:bg-zinc-900 px-1 py-0.5 border border-zinc-200 dark:border-zinc-800 font-bold">{statusInfo?.defaultPasswordHint || 'StudioAdmin2026!'}</code></span>
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
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@roryskagen.com"
                        className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100 transition-colors"
                      />
                      <User className="w-4 h-4 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-700 dark:text-zinc-300 font-bold">
                      Password:
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 pr-9 text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black focus:outline-hidden focus:border-zinc-950 dark:focus:border-zinc-100 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                    >
                      Cancel
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

          {/* TAB 2: CHANGE PASSWORD */}
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

          {/* TAB 3: ARCHITECTURE & ZERO-DEPENDENCY SPEC */}
          {activeTab === 'architecture' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-[#F2F1EC] dark:bg-black/60 border border-zinc-300 dark:border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold uppercase text-[11px]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Pure Native Node.js Architecture</span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11px]">
                  This backend implements full OWASP-standard user admin authentication directly in Express without any external auth libraries or heavy npm dependencies.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white uppercase">
                    <Hash className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Password Hashing</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Native <code className="bg-zinc-100 dark:bg-zinc-900 px-1 font-bold">crypto.scryptSync</code> with 16-byte random cryptographic salt and constant-time <code className="bg-zinc-100 dark:bg-zinc-900 px-1 font-bold">timingSafeEqual</code> comparison.
                  </p>
                </div>

                <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white uppercase">
                    <Cookie className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Cookie Delivery</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Session tokens written strictly via <code className="bg-zinc-100 dark:bg-zinc-900 px-1 font-bold">HttpOnly</code>, <code className="bg-zinc-100 dark:bg-zinc-900 px-1 font-bold">SameSite=Lax</code>, and <code className="bg-zinc-100 dark:bg-zinc-900 px-1 font-bold">Secure</code> cookies with 7-day TTL.
                  </p>
                </div>

                <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white uppercase">
                    <Cpu className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Session Storage</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    High-entropy 32-byte session tokens mapped to user records in in-memory memory map persisted safely to <code className="bg-zinc-100 dark:bg-zinc-900 px-1 font-bold">data/auth_store.json</code>.
                  </p>
                </div>

                <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white uppercase">
                    <KeyRound className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Dual Channel</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Seamless fallback to <code className="bg-zinc-100 dark:bg-zinc-900 px-1 font-bold">Authorization: Bearer</code> headers for frictionless sandbox and iframe support.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
