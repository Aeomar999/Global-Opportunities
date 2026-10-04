"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { getReports, type ReportRecord } from "@/lib/api";

type ReportStatus = "open" | "resolved" | "dismissed";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "#FFFBEB", text: "#B7791F", label: "Open" },
  resolved: { bg: "#F0FDF4", text: "#16A34A", label: "Resolved" },
  dismissed: { bg: "#F3F4F6", text: "#6B7280", label: "Dismissed" },
};

const FILTERS: { label: string; value: ReportStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Resolved", value: "resolved" },
  { label: "Dismissed", value: "dismissed" },
];

export default function ReportsQueuePage() {
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, open] = await Promise.all([
        getReports({ status: filter === "all" ? undefined : filter, limit: 100 }),
        getReports({ status: "open", limit: 1 }),
      ]);
      setReports(list.data);
      setOpenCount(open.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReports();
  }, [fetchReports]);

  return (
    <div>
      <h1 className="text-xl font-bold text-kb-text-body mb-1">Reports Queue</h1>
      <p className="text-sm text-kb-text-muted mb-6">
        {openCount} open report{openCount === 1 ? "" : "s"} awaiting review across posts, users, channels, and postings.
      </p>

      <div className="flex items-center gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              filter === f.value
                ? "bg-kb-primary text-white"
                : "bg-kb-bg-card border border-kb-border text-kb-text-muted hover:text-kb-text-body"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-kb-primary" />
          <span className="ml-2 text-sm text-kb-text-muted">Loading reports...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-center">
          <AlertCircle size={24} className="text-kb-error mr-2" />
          <div className="text-sm text-kb-text-body">
            <p className="font-medium">Failed to load reports</p>
            <p className="text-xs text-kb-text-muted mt-1">{error}</p>
            <button onClick={fetchReports} className="mt-3 text-sm text-kb-primary hover:underline">
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-kb-bg-card border border-kb-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_20px] gap-4 px-5 py-3 border-b border-kb-border text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder">
            <span>Target</span>
            <span>Type</span>
            <span>Reason</span>
            <span>Reported by</span>
            <span>Status</span>
            <span />
          </div>

          {reports.map((report) => {
            const style = STATUS_STYLES[report.status] || STATUS_STYLES.open;
            return (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_20px] gap-4 px-5 py-4 items-center border-b border-kb-border last:border-b-0 hover:bg-kb-bg-alt transition-colors"
              >
                <span className="text-sm font-semibold text-kb-text-body min-w-0 truncate" title={report.targetLabel}>
                  {report.targetLabel || "—"}
                </span>
                <span className="text-sm text-kb-text-muted capitalize truncate">{report.targetType}</span>
                <span className="text-sm text-kb-text-muted truncate">{report.reason}</span>
                <span className="text-sm text-kb-text-muted truncate">{report.reporterName || "—"}</span>
                <span
                  className="inline-flex w-fit text-xs font-semibold rounded-full px-2.5 py-1"
                  style={{ backgroundColor: style.bg, color: style.text }}
                >
                  {style.label}
                </span>
                <ChevronRight size={18} className="text-kb-text-placeholder justify-self-end" />
              </Link>
            );
          })}

          {reports.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-kb-text-muted">No reports in this category.</div>
          )}
        </div>
      )}
    </div>
  );
}
