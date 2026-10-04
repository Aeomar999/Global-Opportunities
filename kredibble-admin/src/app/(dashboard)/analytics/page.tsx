"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Briefcase, Building2, Flag, Loader2, Users } from "lucide-react";
import { getAnalytics, type AnalyticsSummary } from "@/lib/api";

// Keys are the backend's opportunity types (kredibble-backend/src/models/Platform.js).
const TYPE_META: Record<string, { label: string; color: string }> = {
  job: { label: "Jobs", color: "#6671E4" },
  jobs: { label: "Jobs", color: "#6671E4" },
  internship: { label: "Internships", color: "#F59E0B" },
  internships: { label: "Internships", color: "#F59E0B" },
  competition: { label: "Competitions", color: "#EF4444" },
  fellowship: { label: "Fellowships", color: "#10B981" },
  "training-workshop": { label: "Training", color: "#0EA5E9" },
};

const typeFor = (type: string) => TYPE_META[type] || { label: type, color: "#6B7280" };

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getAnalytics());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div>
      <h1 className="text-xl font-bold text-kb-text-body mb-1">Platform Analytics</h1>
      <p className="text-sm text-kb-text-muted mb-6">
        Cross-platform stats aggregated from Seekers, Hirers, Opportunities, and Trust & Safety.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-kb-primary" />
          <span className="ml-2 text-sm text-kb-text-muted">Loading analytics...</span>
        </div>
      ) : error || !summary ? (
        <div className="flex items-center justify-center py-10 text-center">
          <AlertCircle size={24} className="text-kb-error mr-2" />
          <div className="text-sm text-kb-text-body">
            <p className="font-medium">Failed to load analytics</p>
            <p className="text-xs text-kb-text-muted mt-1">{error}</p>
            <button onClick={fetchAnalytics} className="mt-3 text-sm text-kb-primary hover:underline">
              Retry
            </button>
          </div>
        </div>
      ) : (
        <AnalyticsView summary={summary} />
      )}
    </div>
  );
}

function AnalyticsView({ summary }: { summary: AnalyticsSummary }) {
  const maxTypeCount = Math.max(...summary.opportunitiesByType.map((t) => t.count), 1);

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Active Seekers" value={summary.seekers.active} sub={`of ${summary.seekers.total} total`} color="#6671E4" />
        <StatCard icon={Building2} label="Verified Hirers" value={summary.hirers.verified} sub={`of ${summary.hirers.total} total`} color="#16A34A" />
        <StatCard icon={Briefcase} label="Total Applications" value={summary.applications.total} sub="across all seekers" color="#F59E0B" />
        <StatCard icon={Flag} label="Open Reports" value={summary.reports.open} sub={`of ${summary.reports.total} total`} color="#ED4C5C" />
      </div>

      <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-6">
        <p className="text-sm font-bold text-kb-text-body mb-5">Postings by Type</p>
        <div className="flex flex-col gap-4">
          {summary.opportunitiesByType.length === 0 && (
            <p className="text-sm text-kb-text-muted">No postings yet.</p>
          )}
          {summary.opportunitiesByType.map(({ type, count }) => {
            const meta = typeFor(type);
            return (
              <div key={type} className="flex items-center gap-4">
                <span className="text-sm text-kb-text-muted w-24 shrink-0">{meta.label}</span>
                <div className="flex-1 h-3 rounded-full bg-kb-bg-alt overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(count / maxTypeCount) * 100}%`, backgroundColor: meta.color }}
                  />
                </div>
                <span data-testid={`postings-${type}`} className="text-sm font-semibold text-kb-text-body w-6 text-right shrink-0">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${color}1A` }}>
        <Icon size={18} color={color} />
      </div>
      <p className="text-2xl font-bold text-kb-text-body">{value}</p>
      <p className="text-xs text-kb-text-muted mt-1">{label}</p>
      <p className="text-[11px] text-kb-text-placeholder mt-0.5">{sub}</p>
    </div>
  );
}
