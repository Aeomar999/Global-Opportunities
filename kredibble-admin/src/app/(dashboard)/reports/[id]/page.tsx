"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ChevronLeft, CheckCircle2, Hash, Loader2, XCircle } from "lucide-react";
import { getReportById, updateReport, type ReportRecord } from "@/lib/api";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "#FFFBEB", text: "#B7791F", label: "Open" },
  resolved: { bg: "#F0FDF4", text: "#16A34A", label: "Resolved" },
  dismissed: { bg: "#F3F4F6", text: "#6B7280", label: "Dismissed" },
};

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getReportById(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReport();
  }, [fetchReport]);

  const setStatus = async (status: "resolved" | "dismissed") => {
    setSaving(true);
    setActionError(null);
    try {
      setReport(await updateReport(params.id, { status }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update report");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-kb-primary" />
        <span className="ml-2 text-sm text-kb-text-muted">Loading report...</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-kb-text-body">
          <AlertCircle size={18} className="text-kb-error" />
          <span>{error || "Report not found."}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={fetchReport} className="text-sm text-kb-primary font-semibold hover:underline">
            Retry
          </button>
          <Link href="/reports" className="text-sm text-kb-primary font-semibold">
            Back to Reports Queue
          </Link>
        </div>
      </div>
    );
  }

  const style = STATUS_STYLES[report.status] || STATUS_STYLES.open;

  return (
    <div>
      <button
        onClick={() => router.push("/reports")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Reports Queue
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder mb-1">
            {report.targetType}
          </p>
          <h1 className="text-xl font-bold text-kb-text-body">{report.targetLabel || "Untitled report"}</h1>
        </div>
        <span
          className="text-xs font-semibold rounded-full px-3 py-1.5"
          style={{ backgroundColor: style.bg, color: style.text }}
        >
          {style.label}
        </span>
      </div>

      <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder mb-3">
          Report Details
        </p>
        <div className="flex flex-col gap-2.5 mb-4">
          <InfoRow label="Reason" value={report.reason} />
          <InfoRow label="Reported by" value={report.reporterName || "—"} />
          <InfoRow label="Date" value={report.date || new Date(report.createdAt).toLocaleDateString()} />
        </div>
        {report.details && <p className="text-sm text-kb-text-body leading-relaxed">{report.details}</p>}
      </div>

      {report.linkedChannelId && (
        <Link
          href={`/community/${report.linkedChannelId}`}
          className="flex items-center gap-2 text-sm font-semibold text-kb-primary mb-6"
        >
          <Hash size={16} />
          View the channel this report is about
        </Link>
      )}

      {actionError && <p className="text-sm text-kb-error mb-3">{actionError}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={() => setStatus("resolved")}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-50 hover:bg-green-100 text-sm font-semibold text-green-700 transition-colors disabled:opacity-60"
        >
          <CheckCircle2 size={16} strokeWidth={2.5} />
          Mark resolved
        </button>
        <button
          onClick={() => setStatus("dismissed")}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-600 transition-colors disabled:opacity-60"
        >
          <XCircle size={16} strokeWidth={2.5} />
          Dismiss
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-kb-text-muted">{label}</span>
      <span className="text-sm text-kb-text-body font-medium text-right">{value}</span>
    </div>
  );
}
