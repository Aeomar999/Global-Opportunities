"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, HandCoins, Loader2 } from "lucide-react";
import { getGrants, type GrantRecord } from "@/lib/api";

export default function GrantsOpsPage() {
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGrants((await getGrants({ limit: 100 })).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGrants();
  }, [fetchGrants]);

  return (
    <div>
      <h1 className="text-xl font-bold text-kb-text-body mb-1">Grants</h1>
      <p className="text-sm text-kb-text-muted mb-6">
        Funding pool allocation and application review across all posted grants.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-kb-primary" />
          <span className="ml-2 text-sm text-kb-text-muted">Loading grants...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-center">
          <AlertCircle size={24} className="text-kb-error mr-2" />
          <div className="text-sm text-kb-text-body">
            <p className="font-medium">Failed to load grants</p>
            <p className="text-xs text-kb-text-muted mt-1">{error}</p>
            <button onClick={fetchGrants} className="mt-3 text-sm text-kb-primary hover:underline">
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-kb-bg-card border border-kb-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1.2fr_1fr_1.4fr_1fr_20px] gap-4 px-5 py-3 border-b border-kb-border text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder">
            <span>Grant</span>
            <span>Hirer</span>
            <span>Sector</span>
            <span>Budget Allocated</span>
            <span>Status</span>
            <span />
          </div>

          {grants.map((grant) => {
            const pct = grant.fundingPool > 0 ? Math.round((grant.allocated / grant.fundingPool) * 100) : 0;
            return (
              <Link
                key={grant.id}
                href={`/grants/${grant.id}`}
                className="grid grid-cols-[2fr_1.2fr_1fr_1.4fr_1fr_20px] gap-4 px-5 py-4 items-center border-b border-kb-border last:border-b-0 hover:bg-kb-bg-alt transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-kb-bg-alt flex items-center justify-center shrink-0">
                    <HandCoins size={16} className="text-kb-text-muted" />
                  </div>
                  <span className="text-sm font-semibold text-kb-text-body truncate" title={grant.title}>
                    {grant.title}
                  </span>
                </div>
                <span className="text-sm text-kb-text-muted truncate">{grant.hirer}</span>
                <span className="text-sm text-kb-text-muted truncate">{grant.sector}</span>
                <span className="text-sm text-kb-text-muted truncate">
                  ${grant.allocated.toLocaleString()} / ${grant.fundingPool.toLocaleString()} ({pct}%)
                </span>
                <span
                  className="inline-flex w-fit text-xs font-semibold rounded-full px-2.5 py-1"
                  style={
                    grant.status === "open"
                      ? { backgroundColor: "#F0FDF4", color: "#16A34A" }
                      : { backgroundColor: "#F3F4F6", color: "#6B7280" }
                  }
                >
                  {grant.status === "open" ? "Open" : "Closed"}
                </span>
                <ChevronRight size={18} className="text-kb-text-placeholder justify-self-end" />
              </Link>
            );
          })}

          {grants.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-kb-text-muted">No grants yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
