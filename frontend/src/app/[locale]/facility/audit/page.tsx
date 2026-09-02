'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useTranslations } from 'next-intl';
import { useFacility } from '@/context/FacilityContext';
import { getAuditLogs } from '@/lib/facility-api';
import type { AuditLogEntry } from '@/lib/facility-api';

const PAGE_SIZE = 50;
const EXPORT_BATCH_SIZE = 200;

function formatResourceType(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function exportToCsv(logs: AuditLogEntry[]) {
  const headers = ['Time', 'User', 'Action', 'Outcome', 'Resource'];
  const rows = logs.map((log) => [
    new Date(log.timestamp).toISOString(),
    log.user_name,
    log.action,
    log.outcome,
    `${log.resource_type}${log.resource_id ? ` (${log.resource_id.slice(0, 8)})` : ''}`,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const { allowed } = useRequireRole('admin', 'owner');
  if (!allowed) return null;

  const t = useTranslations('facility.audit');
  const { state } = useFacility();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (currentOffset: number) => {
    setLoading(true);
    try {
      const data = await getAuditLogs({ limit: PAGE_SIZE, offset: currentOffset });
      setLogs(data.logs);
      setTotal(data.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.authenticated) load(offset);
  }, [state.authenticated, offset, load]);

  const handleExport = useCallback(async () => {
    if (total === 0) return;

    setExporting(true);
    try {
      const exportedLogs: AuditLogEntry[] = [];
      let currentOffset = 0;

      while (currentOffset < total) {
        const data = await getAuditLogs({
          limit: EXPORT_BATCH_SIZE,
          offset: currentOffset,
        });
        exportedLogs.push(...data.logs);

        if (data.logs.length < EXPORT_BATCH_SIZE) {
          break;
        }

        currentOffset += data.logs.length;
      }

      exportToCsv(exportedLogs);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  }, [total]);

  return (
    <main className="flex flex-col h-full overflow-y-auto px-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <button
          type="button"
          onClick={handleExport}
          disabled={total === 0 || exporting}
          className="outline-button h-10 rounded-lg px-4 text-sm font-medium disabled:opacity-100"
        >
          {exporting ? 'Exporting...' : t('export_csv')}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="h-10 rounded-lg bg-foreground/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-foreground/[.06] bg-background/80 dark:border-white/[.12] dark:bg-white/[.02]">
            <table className="w-full text-start text-sm">
              <thead className="bg-foreground/[.02] dark:bg-white/[.015]">
                <tr>
                  <th className="px-4 py-3 font-medium text-foreground-muted">{t('col_time')}</th>
                  <th className="px-4 py-3 font-medium text-foreground-muted">{t('col_user')}</th>
                  <th className="px-4 py-3 font-medium text-foreground-muted">{t('col_action')}</th>
                  <th className="px-4 py-3 font-medium text-foreground-muted">
                    {t('col_resource')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/[.04] dark:divide-white/[.08]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-foreground/[.02] transition-colors">
                    <td className="px-4 py-3 text-foreground-muted text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-foreground text-sm">{log.user_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          log.outcome === 'SUCCESS'
                            ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted text-xs">
                      {formatResourceType(log.resource_type)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-foreground-muted">
              {t('showing', {
                start: offset + 1,
                end: Math.min(offset + PAGE_SIZE, total),
                total,
              })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="outline-button h-9 rounded-lg px-3 text-sm text-foreground disabled:opacity-100"
              >
                {t('previous')}
              </button>
              <button
                type="button"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="outline-button h-9 rounded-lg px-3 text-sm text-foreground disabled:opacity-100"
              >
                {t('next')}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
