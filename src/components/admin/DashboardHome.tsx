import React, { useEffect, useState } from 'react';
import {
  Image as ImageIcon,
  Files,
  Inbox,
  Database,
  TrendingUp,
  ArrowRight,
  CircleDollarSign,
  CheckCircle2,
  Archive,
  FilePen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { api } from '../../lib/adminApi';
import type { ArtworkRecord, UserRole } from '../../types';

interface InquiriesResponse {
  success: boolean;
  inquiries: Array<{
    id: string;
    artwork_title?: string;
    name: string;
    email: string;
    status: string;
    created_at: string;
    message: string;
  }>;
}

interface DashboardHomeProps {
  artworks: ArtworkRecord[];
  catalogCount: number;
  onNavigate: (path: string) => void;
  /** Drives which shortcuts are offered — a viewer cannot open the editor-only sections. */
  role?: UserRole;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  artworks,
  catalogCount,
  onNavigate,
  role = 'viewer',
}) => {
  const canEdit = role === 'admin' || role === 'editor';
  const [inquiries, setInquiries] = useState<InquiriesResponse['inquiries']>([]);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; version?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // `/api/inquiries` requires editor+, so do not even ask as a viewer —
      // an unhandled 403 would surface as a broken card.
      const [inqRes, dbRes] = await Promise.allSettled([
        canEdit
          ? api<InquiriesResponse>('/api/inquiries')
          : Promise.resolve({ inquiries: [] } as InquiriesResponse),
        api<{ connected: boolean; version?: string }>('/api/database/status'),
      ]);
      if (cancelled) return;
      if (inqRes.status === 'fulfilled' && inqRes.value?.inquiries) {
        setInquiries(inqRes.value.inquiries);
      }
      if (dbRes.status === 'fulfilled') {
        setDbStatus({ connected: !!dbRes.value.connected, version: dbRes.value.version });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  const active = artworks.filter((a) => !a.trashed);
  const available = active.filter((a) => a.status === 'Available');
  const sold = active.filter((a) => a.status === 'Sold');
  const archived = active.filter((a) => a.archived);
  const drafts = active.filter((a) => a.draft === true);
  const heroCount = active.filter((a) => a.heroSlider);
  const newInquiries = inquiries.filter((i) => (i.status || 'New').toLowerCase() === 'new');

  const stats = [
    { label: 'Total Catalog', value: catalogCount || active.length, icon: ImageIcon, hint: `${heroCount.length} on hero slider` },
    { label: 'Available', value: available.length, icon: CheckCircle2, hint: `${sold.length} sold` },
    { label: 'New Inquiries', value: newInquiries.length, icon: Inbox, hint: `${inquiries.length} total` },
    { label: 'Drafts', value: drafts.length, icon: FilePen, hint: drafts.length > 0 ? 'hidden from public site' : 'nothing in progress' },
  ];

  const seriesBreakdown = Object.entries(
    active.reduce((acc: Record<string, number>, a: ArtworkRecord) => {
      const key = a.gallery_series || 'Uncategorized';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const recentInquiries = inquiries.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Series breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catalog by Series</CardTitle>
            <CardDescription>Top gallery series across active works</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {seriesBreakdown.length === 0 && <p className="text-sm text-muted-foreground">No catalog data.</p>}
            {seriesBreakdown.map(([series, count]) => (
              <div key={series} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm">{series}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / (seriesBreakdown[0]?.[1] || 1)) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold">{count}</span>
              </div>
            ))}
            {canEdit && (
              <Button variant="outline" size="sm" className="mt-2" onClick={() => onNavigate('/admin/taxonomies')}>
                Manage taxonomies <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recent inquiries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Inquiries</CardTitle>
              <CardDescription>Latest collector interest</CardDescription>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => onNavigate('/admin/inquiries')}>
                View all
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : recentInquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No inquiries yet.</p>
            ) : (
              <div className="space-y-3">
                {recentInquiries.map((inq) => (
                  <div key={inq.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inq.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {inq.artwork_title || 'General inquiry'} · {new Date(inq.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={(inq.status || 'New').toLowerCase() === 'new' ? 'warning' : 'secondary'}>
                      {inq.status || 'New'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> System
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${dbStatus?.connected ? 'bg-emerald-500' : 'bg-red-500'}`}
            />
            PostgreSQL {dbStatus?.connected ? 'connected' : 'unavailable'}
          </span>
          {dbStatus?.version && (
            <span className="text-xs text-muted-foreground">{dbStatus.version.slice(0, 40)}</span>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Supabase Auth · Resend email
          </span>
        </CardContent>
      </Card>
    </div>
  );
};
