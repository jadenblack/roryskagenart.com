import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, History, RefreshCw, Rocket, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { api } from '../../lib/adminApi';
import { cn } from '../../lib/utils';
import type { ReleaseLog } from '../../data/releaseLog.generated';

/**
 * The studio's own release history — read-only, derived, never authored here.
 *
 * D1 in `plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md` splits history from the plan:
 * this screen is the *backward* half, a projection of `CHANGELOG.md` and `DEPLOYMENT_LOG.md`
 * that the app can read but never write. The structure comes from `GET /api/plan/history`,
 * which serves the generated artifact rather than parsing markdown in the browser — see
 * `scripts/generate-release-log.ts` for why, and for the staleness guard that keeps the
 * artifact honest.
 *
 * ⚠️ THE TYPES COME FROM THE ARTIFACT, NOT FROM A HAND-WRITTEN COPY.
 * `ReleaseLog` is re-exported by `src/data/releaseLog.generated.ts`, so a change to the
 * parser's shape fails `npm run lint` here instead of silently rendering blank rows.
 *
 * `requireAuth` and no role check: a viewer may read the history. It is already public in the
 * repository's own git history and in the deployed site's release notes.
 */

interface HistoryResponse {
  success: boolean;
  log: ReleaseLog;
}

/** Badge colour per Keep a Changelog category, so the eye can scan a release. */
const CATEGORY_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'destructive' | 'secondary'> = {
  Added: 'success',
  Changed: 'info',
  Fixed: 'warning',
  Deprecated: 'warning',
  Removed: 'destructive',
  Security: 'destructive',
};

export const ChangelogView: React.FC = () => {
  const [log, setLog] = useState<ReleaseLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showUnreleased, setShowUnreleased] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<HistoryResponse>('/api/plan/history');
      setLog(data.log);
    } catch (err: any) {
      setError(err.message || 'Failed to load the release history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const releases = log?.changelog ?? [];

  /**
   * `[Unreleased]` is the most interesting block in the file — it is what the next release will
   * be — so it is shown by default, and the toggle exists only because it can grow long.
   *
   * A search keeps a release when the release itself matches (its version or its preamble), or
   * when at least one of its notes does; in the second case only the matching notes are kept, so
   * a hit is visible rather than buried in a wall of text.
   */
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const base = releases.filter((release) => showUnreleased || !release.unreleased);
    if (!needle) return base;

    return base.flatMap((release) => {
      const sections = release.sections
        .map((section) => ({
          ...section,
          entries: section.entries.filter(
            (entry) =>
              entry.text.toLowerCase().includes(needle) ||
              section.heading.toLowerCase().includes(needle)
          ),
        }))
        .filter((section) => section.entries.length > 0);

      const matches =
        (release.summary ?? '').toLowerCase().includes(needle) ||
        (release.version ?? 'unreleased').toLowerCase().includes(needle) ||
        sections.length > 0;

      return matches ? [{ ...release, sections }] : [];
    });
  }, [releases, search, showUnreleased]);

  const deployments = log?.deployments ?? [];
  const warnings = log?.diagnostics?.warnings ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <History className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search releases and notes…"
            className="pl-8"
          />
        </div>
        <Button
          variant={showUnreleased ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowUnreleased((v) => !v)}
        >
          <Tag className="h-4 w-4" />
          Unreleased
        </Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {log
            ? `${log.diagnostics.releases} releases · ${log.diagnostics.deploymentRows} deployments`
            : ''}
        </span>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* A parse warning means the two documents changed shape under the parser. The studio
          should see that rather than a quietly incomplete history. */}
      {warnings.length > 0 && (
        <Card className="border-amber-500/40">
          <CardContent className="space-y-1 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {warnings.length} parse warning{warnings.length === 1 ? '' : 's'}
            </p>
            {warnings.slice(0, 5).map((warning) => (
              <p key={warning} className="text-xs text-muted-foreground">
                {warning}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center text-sm text-muted-foreground">
                {search ? `No releases match “${search}”.` : 'No releases recorded yet.'}
              </CardContent>
            </Card>
          )}

          {filtered.map((release) => (
            <Card key={release.version ?? 'unreleased'}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {release.unreleased ? (
                      <>
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        Unreleased
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 text-muted-foreground" />
                        {release.version}
                      </>
                    )}
                  </CardTitle>
                  {release.date && <span className="text-xs text-muted-foreground">{release.date}</span>}
                </div>
                {release.summary && (
                  <CardDescription className="whitespace-pre-wrap">{release.summary}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {release.sections.map((section) => (
                  <div key={section.heading} className="space-y-2">
                    <Badge variant={CATEGORY_VARIANT[section.category] ?? 'secondary'}>
                      {section.heading}
                    </Badge>
                    <ul className="space-y-1.5">
                      {section.entries.map((entry, index) => (
                        <li
                          key={`${section.heading}-${index}`}
                          className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                          <span className="min-w-0">
                            {entry.text}
                            {/* The parser keeps nested bullets as `details`, so a note that had
                                sub-points does not lose them. */}
                            {entry.details.length > 0 && (
                              <ul className="mt-1 space-y-1 pl-4 text-xs">
                                {entry.details.map((detail, detailIndex) => (
                                  <li key={detailIndex} className="list-disc">
                                    {detail}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {release.sections.length === 0 && !release.summary && (
                  <p className="text-sm text-muted-foreground">No notes recorded for this release.</p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Deployments — the same releases, but as the platform recorded them. */}
          {deployments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Deployments</CardTitle>
                <CardDescription>
                  From DEPLOYMENT_LOG.md — the platform's own record of what went live.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {deployments.slice(0, 30).map((row, index) => (
                  <div
                    key={`${row.version ?? 'row'}-${index}`}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <span className="w-20 shrink-0 font-mono text-xs">{row.version || '—'}</span>
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{row.date || '—'}</span>
                    <Badge
                      variant={
                        (row.status ?? '').includes('Ready')
                          ? 'success'
                          : (row.status ?? '').includes('Error')
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {row.status || 'unknown'}
                    </Badge>
                    {row.target && <span className="text-xs text-muted-foreground">{row.target}</span>}
                    {row.buildTime && (
                      <span className="text-xs text-muted-foreground">{row.buildTime}</span>
                    )}
                    {/* The ⚠️ marker the log uses for process problems, carried through the parse. */}
                    {row.flagged && (
                      <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> flagged
                      </span>
                    )}
                    {row.url && (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
