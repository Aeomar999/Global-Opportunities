"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, ChevronLeft, Loader2, X } from "lucide-react";
import {
  getGrantApplications,
  getGrantById,
  updateGrantApplication,
  type GrantApplicationRecord,
  type GrantRecord,
} from "@/lib/api";

export default function GrantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [grant, setGrant] = useState<GrantRecord | null>(null);
  const [applications, setApplications] = useState<GrantApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchGrant = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [record, apps] = await Promise.all([
        getGrantById(params.id),
        getGrantApplications(params.id, { limit: 100 }),
      ]);
      setGrant(record);
      setApplications(apps.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grant");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGrant();
  }, [fetchGrant]);

  const setAppStatus = async (appId: string, status: "approved" | "rejected") => {
    setSavingId(appId);
    setActionError(null);
    try {
      const updated = await updateGrantApplication(appId, { status });
      setApplications((prev) => prev.map((app) => (app.id === appId ? updated : app)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update application");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-kb-primary" />
        <span className="ml-2 text-sm text-kb-text-muted">Loading grant...</span>
      </div>
    );
  }

  if (error || !grant) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-kb-text-body">
          <AlertCircle size={18} className="text-kb-error" />
          <span>{error || "Grant not found."}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={fetchGrant} className="text-sm text-kb-primary font-semibold hover:underline">
            Retry
          </button>
          <Link href="/grants" className="text-sm text-kb-primary font-semibold">
            Back to Grants
          </Link>
        </div>
      </div>
    );
  }

  const pct = grant.fundingPool > 0 ? Math.round((grant.allocated / grant.fundingPool) * 100) : 0;
  const remaining = grant.fundingPool - grant.allocated;

  return (
    <div>
      <button
        onClick={() => router.push("/grants")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Grants
      </button>

      <h1 className="text-xl font-bold text-kb-text-body">{grant.title}</h1>
      <p className="text-sm text-kb-text-muted mt-1 mb-6">
        {grant.hirer} · {grant.sector}
      </p>

      <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder mb-3">
          Funding Pool
        </p>
        <div className="h-3 rounded-full bg-kb-bg-alt overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-kb-primary transition-all"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="text-sm text-kb-text-muted">
          ${grant.allocated.toLocaleString()} allocated of ${grant.fundingPool.toLocaleString()} ({pct}%)
          · ${remaining.toLocaleString()} remaining
        </p>
        {/* SEC-060: allocation rules are undecided, so approvals record a decision only. */}
        <p className="text-xs text-kb-text-placeholder mt-2">
          Approving an application records the decision; it doesn&apos;t change the allocated amount yet.
        </p>
      </div>

      {actionError && <p className="text-sm text-kb-error mb-3">{actionError}</p>}

      <h2 className="text-sm font-bold text-kb-text-body mb-3">Applications</h2>
      <div className="flex flex-col gap-3">
        {applications.map((app) => (
          <div
            key={app.id}
            className="flex items-center gap-4 bg-kb-bg-card border border-kb-border rounded-2xl p-4"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-kb-text-body">{app.applicantName}</p>
              <p className="text-xs text-kb-text-muted mt-0.5">
                Requested ${app.requestedAmount.toLocaleString()}
              </p>
            </div>
            <span
              className="text-xs font-semibold rounded-full px-2.5 py-1 shrink-0"
              style={
                app.status === "approved"
                  ? { backgroundColor: "#F0FDF4", color: "#16A34A" }
                  : app.status === "rejected"
                    ? { backgroundColor: "#FEF2F2", color: "#ED4C5C" }
                    : { backgroundColor: "#FFFBEB", color: "#B7791F" }
              }
            >
              {app.status === "approved" ? "Approved" : app.status === "rejected" ? "Rejected" : "Pending"}
            </span>
            {app.status === "pending" && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setAppStatus(app.id, "approved")}
                  className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center transition-colors disabled:opacity-60"
                  title="Approve"
                  disabled={savingId !== null || app.requestedAmount > remaining}
                >
                  <Check size={15} color="#16A34A" strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => setAppStatus(app.id, "rejected")}
                  className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors disabled:opacity-60"
                  title="Reject"
                  disabled={savingId !== null}
                >
                  <X size={15} color="#ED4C5C" strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
        ))}

        {applications.length === 0 && (
          <p className="text-sm text-kb-text-muted">No applications yet.</p>
        )}
      </div>
    </div>
  );
}
