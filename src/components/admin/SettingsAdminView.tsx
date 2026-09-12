import React, { useCallback, useEffect, useState } from 'react';
import { Save, Loader2, Globe, Mail, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Skeleton } from '../ui/skeleton';
import { api } from '../../lib/adminApi';

interface SiteSettings {
  title: string;
  tagline: string;
  contact_email: string;
}
interface InquirySettings {
  notify_email: string;
  auto_confirm: boolean;
}
interface HeroSettings {
  excerpt_enabled: boolean;
  auto_advance_seconds: number;
}

interface SettingsShape {
  site: SiteSettings;
  inquiries: InquirySettings;
  hero: HeroSettings;
}

const DEFAULTS: SettingsShape = {
  site: { title: 'Rory Skagen Art', tagline: 'Austin, Texas • Est. 1985', contact_email: '' },
  inquiries: { notify_email: '', auto_confirm: true },
  hero: { excerpt_enabled: true, auto_advance_seconds: 6 },
};

export const SettingsAdminView: React.FC = () => {
  const [settings, setSettings] = useState<SettingsShape>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ settings: Partial<SettingsShape> }>('/api/settings');
      setSettings({
        site: { ...DEFAULTS.site, ...(data.settings?.site || {}) },
        inquiries: { ...DEFAULTS.inquiries, ...(data.settings?.inquiries || {}) },
        hero: { ...DEFAULTS.hero, ...(data.settings?.hero || {}) },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api('/api/settings', { method: 'PUT', body: { settings } });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {savedAt && <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved at {savedAt}</span>}
        <Button size="sm" className="ml-auto" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save all settings
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Site identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" /> Site identity
            </CardTitle>
            <CardDescription>Shown in the public header and metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-title">Site title</Label>
              <Input
                id="set-title"
                value={settings.site.title}
                onChange={(e) => setSettings((s) => ({ ...s, site: { ...s.site, title: e.target.value } }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-tagline">Tagline</Label>
              <Input
                id="set-tagline"
                value={settings.site.tagline}
                onChange={(e) => setSettings((s) => ({ ...s, site: { ...s.site, tagline: e.target.value } }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-contact">Public contact email</Label>
              <Input
                id="set-contact"
                type="email"
                value={settings.site.contact_email}
                onChange={(e) => setSettings((s) => ({ ...s, site: { ...s.site, contact_email: e.target.value } }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Inquiries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" /> Inquiries
              </CardTitle>
              <CardDescription>Where new collector inquiries are sent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="set-notify">Notification email</Label>
                <Input
                  id="set-notify"
                  type="email"
                  value={settings.inquiries.notify_email}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, inquiries: { ...s.inquiries, notify_email: e.target.value } }))
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="set-autoconfirm"
                  checked={settings.inquiries.auto_confirm}
                  onCheckedChange={(v) =>
                    setSettings((s) => ({ ...s, inquiries: { ...s.inquiries, auto_confirm: v } }))
                  }
                />
                <Label htmlFor="set-autoconfirm">Send auto-confirmation to collector</Label>
              </div>
            </CardContent>
          </Card>

          {/* Hero */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" /> Hero slider
              </CardTitle>
              <CardDescription>Homepage showcase behaviour.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="set-excerpt"
                  checked={settings.hero.excerpt_enabled}
                  onCheckedChange={(v) =>
                    setSettings((s) => ({ ...s, hero: { ...s.hero, excerpt_enabled: v } }))
                  }
                />
                <Label htmlFor="set-excerpt">Show artwork excerpt overlay</Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="set-advance">Auto-advance (seconds)</Label>
                <Input
                  id="set-advance"
                  type="number"
                  min={2}
                  max={30}
                  value={settings.hero.auto_advance_seconds}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      hero: { ...s.hero, auto_advance_seconds: Number(e.target.value) || 6 },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
