import React, { useCallback, useEffect, useState } from 'react';
import { Inbox, Mail, Phone, Search, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { api } from '../../lib/adminApi';
import { cn } from '../../lib/utils';

interface InquiryRecord {
  id: string;
  artwork_slug?: string | null;
  artwork_title?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  status: string;
  created_at: string;
}

interface InquiriesViewProps {
  onCountChange?: (newCount: number) => void;
}

export const InquiriesView: React.FC<InquiriesViewProps> = ({ onCountChange }) => {
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<InquiryRecord | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ inquiries: InquiryRecord[] }>('/api/inquiries');
      setInquiries(data.inquiries || []);
      const newCount = (data.inquiries || []).filter(
        (i) => (i.status || 'New').toLowerCase() === 'new'
      ).length;
      onCountChange?.(newCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (inquiry: InquiryRecord, status: string) => {
    setUpdatingId(inquiry.id);
    try {
      await api(`/api/inquiries/${inquiry.id}/status`, { method: 'PATCH', body: { status } });
      setInquiries((list) =>
        list.map((i) => (i.id === inquiry.id ? { ...i, status } : i))
      );
      if (selected?.id === inquiry.id) setSelected({ ...selected, status });
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = inquiries.filter((i) => {
    const matchesSearch =
      !search ||
      [i.name, i.email, i.artwork_title, i.message]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchesStatus =
      statusFilter === 'all' || (i.status || 'New').toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, artwork…"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'new', label: 'New' },
            { value: 'contacted', label: 'Contacted' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {inquiries.length}
        </span>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No inquiries match your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">From</TableHead>
                  <TableHead>Artwork</TableHead>
                  <TableHead className="hidden md:table-cell">Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inq) => (
                  <TableRow
                    key={inq.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(inq)}
                  >
                    <TableCell className="pl-4">
                      <div className="font-medium">{inq.name}</div>
                      <div className="text-xs text-muted-foreground">{inq.email}</div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {inq.artwork_title || '—'}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {new Date(inq.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          (inq.status || 'New').toLowerCase() === 'new'
                            ? 'warning'
                            : (inq.status || '').toLowerCase() === 'closed'
                            ? 'secondary'
                            : 'info'
                        }
                      >
                        {inq.status || 'New'}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={(inq.status || 'New').toLowerCase()}
                        onChange={(e) => updateStatus(inq, e.target.value)}
                        disabled={updatingId === inq.id}
                        className="h-8 w-32 text-xs"
                        options={[
                          { value: 'new', label: 'New' },
                          { value: 'contacted', label: 'Contacted' },
                          { value: 'closed', label: 'Closed' },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Inquiry from {selected.name}</DialogTitle>
              <DialogDescription>
                {selected.artwork_title ? `Regarding “${selected.artwork_title}”` : 'General inquiry'} ·{' '}
                {new Date(selected.created_at).toLocaleString()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <a
                  href={`mailto:${selected.email}`}
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" /> {selected.email}
                </a>
                {selected.phone && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-4 w-4" /> {selected.phone}
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm whitespace-pre-wrap">
                {selected.message}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Set status:</span>
                {['New', 'Contacted', 'Closed'].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={(selected.status || 'New') === s ? 'default' : 'outline'}
                    onClick={() => updateStatus(selected, s)}
                    disabled={updatingId === selected.id}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};
