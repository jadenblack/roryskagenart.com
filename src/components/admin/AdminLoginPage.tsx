import React, { useState } from 'react';
import { Lock, Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../context/AuthContext';

interface AdminLoginPageProps {
  onSuccess?: () => void;
  onBackToSite?: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onSuccess, onBackToSite }) => {
  const { login, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      onSuccess?.();
    } else {
      setError(result.error || 'Sign-in failed.');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (result.success) {
      setNotice(result.message || 'Reset email sent.');
      setMode('login');
    } else {
      setError(result.error || 'Failed to send reset email.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <img
            src="/android-chrome-192x192.png"
            alt="Rory Skagen Studio"
            className="mx-auto h-16 w-16 rounded-xl shadow-sm"
          />
          <h1 className="mt-4 text-xl font-bold tracking-tight">Rory Skagen Studio</h1>
          <p className="text-sm text-muted-foreground">Sign in to the studio admin dashboard</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{mode === 'login' ? 'Sign in' : 'Reset password'}</CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Use your studio Supabase account credentials.'
                : 'We will email you a secure reset link.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@roryskagen.com"
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-8 pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}
                {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sign in
                </Button>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                    }}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@roryskagen.com"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to sign in
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        {onBackToSite && (
          <button
            onClick={onBackToSite}
            className="mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" /> Back to public site
          </button>
        )}
      </div>
    </div>
  );
};
