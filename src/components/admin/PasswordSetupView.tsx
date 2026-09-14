import React, { useState } from 'react';
import { KeyRound, Loader2, Eye, EyeOff, Check, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { AuthHandoff } from '../../lib/authRedirect';

interface PasswordSetupViewProps {
  /** 'invite' for a first-time invitation, 'recovery' for a reset. */
  reason: Exclude<AuthHandoff, null>;
  onDone: () => void;
  onBackToSite?: () => void;
}

/** Minimum accepted by Supabase Auth projects (dashboard-configurable). */
const MIN_LENGTH = 8;

/**
 * Terminal step of the invite / password-reset hand-off.
 *
 * Supabase verifies the emailed token and signs the user in; this screen is the
 * only place they can choose a password. Without it an invited user lands on
 * the public site already signed in with a password they never set — and, on
 * the recovery path, with their old password still live.
 */
export const PasswordSetupView: React.FC<PasswordSetupViewProps> = ({
  reason,
  onDone,
  onBackToSite,
}) => {
  const { user, logout, refreshAuth } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      await refreshAuth();
      onDone();
    } catch (err: any) {
      setError(err?.message || 'Could not save the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <img
            src="/android-chrome-192x192.png"
            alt="Rory Skagen Art"
            className="mx-auto h-16 w-16 rounded-xl shadow-sm"
          />
          <h1 className="mt-4 text-xl font-bold tracking-tight">Rory Skagen Art</h1>
          <p className="text-sm text-muted-foreground">
            {reason === 'invite' ? 'Welcome to the studio workspace' : 'Choose a new password'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              {reason === 'invite' ? 'Set your password' : 'Reset your password'}
            </CardTitle>
            <CardDescription>
              {user?.email
                ? `Signed in as ${user.email}. Choose a password to finish.`
                : 'Choose a password to finish.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={reveal ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={`At least ${MIN_LENGTH} characters`}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((r) => !r)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={reveal ? 'Hide password' : 'Show password'}
                  >
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {tooShort && (
                  <p className="text-xs text-destructive">
                    Use at least {MIN_LENGTH} characters.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
                {confirm.length > 0 && !mismatch && password.length >= MIN_LENGTH && (
                  <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" /> Passwords match
                  </p>
                )}
              </div>

              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save password &amp; open studio
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => void logout()}
            className="hover:text-foreground cursor-pointer"
          >
            Sign out
          </button>
          {onBackToSite && (
            <button
              type="button"
              onClick={onBackToSite}
              className="flex items-center gap-1 hover:text-foreground cursor-pointer"
            >
              <ArrowLeft className="h-3 w-3" /> Back to the gallery
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
