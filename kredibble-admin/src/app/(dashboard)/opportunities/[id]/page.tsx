"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Award,
  Briefcase,
  CalendarDays,
  Check,
  ChevronLeft,
  GraduationCap,
  HandCoins,
  Loader2,
  X,
} from "lucide-react";
import { getOpportunityById, moderateOpportunity, type OpportunityRecord } from "@/lib/api";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#FFFBEB", text: "#B7791F", label: "Pending" },
  published: { bg: "#F0FDF4", text: "#16A34A", label: "Published" },
  approved: { bg: "#F0FDF4", text: "#16A34A", label: "Approved" },
  rejected: { bg: "#FEF2F2", text: "#ED4C5C", label: "Rejected" },
  closed: { bg: "#F3F4F6", text: "#6B7280", label: "Closed" },
};

// Keys are the backend's opportunity types (kredibble-backend/src/models/Platform.js).
const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  job: { label: "Job", icon: Briefcase, color: "#6671E4" },
  jobs: { label: "Job", icon: Briefcase, color: "#6671E4" },
  internship: { label: "Internship", icon: GraduationCap, color: "#F59E0B" },
  internships: { label: "Internship", icon: GraduationCap, color: "#F59E0B" },
  competition: { label: "Competition", icon: Award, color: "#EF4444" },
  fellowship: { label: "Fellowship", icon: HandCoins, color: "#10B981" },
  "training-workshop": { label: "Training", icon: CalendarDays, color: "#0EA5E9" },
};

const typeFor = (type: string) => TYPE_META[type] || { label: type, icon: Briefcase, color: "#6671E4" };

export default function OpportunityReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [opp, setOpp] = useState<OpportunityRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchOpportunity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOpp(await getOpportunityById(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load opportunity");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOpportunity();
  }, [fetchOpportunity]);

  const decide = async (decision: "approve" | "reject") => {
    setSaving(true);
    setActionError(null);
    try {
      setOpp(await moderateOpportunity(params.id, decision));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update opportunity");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-kb-primary" />
        <span className="ml-2 text-sm text-kb-text-muted">Loading opportunity...</span>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-kb-text-body">
          <AlertCircle size={18} className="text-kb-error" />
          <span>{error || "Opportunity not found."}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={fetchOpportunity} className="text-sm text-kb-primary font-semibold hover:underline">
            Retry
          </button>
          <Link href="/opportunities" className="text-sm text-kb-primary font-semibold">
            Back to Opportunities Queue
          </Link>
        </div>
      </div>
    );
  }

  const type = typeFor(opp.type);
  const status = STATUS_STYLES[opp.moderationStatus] || STATUS_STYLES.pending;
  const Icon = type.icon;
  const hasExtraDetails = Boolean(opp.eventDateTime || opp.eventCategory || opp.grantBudgetRange || opp.grantSector);

  return (
    <div>
      <button
        onClick={() => router.push("/opportunities")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Opportunities Queue
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${type.color}1A`, color: type.color }}
            >
              <Icon size={13} />
              {type.label}
            </span>
          </div>
          <h1 className="text-xl font-bold text-kb-text-body">{opp.title}</h1>
          <p className="text-sm text-kb-text-muted mt-1">
            {opp.company} · {opp.location}
          </p>
        </div>
        <span
          data-testid="moderation-status"
          className="text-xs font-semibold rounded-full px-3 py-1.5"
          style={{ backgroundColor: status.bg, color: status.text }}
        >
          {status.label}
        </span>
      </div>

      <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder mb-3">Description</p>
        <p className="text-sm text-kb-text-body leading-relaxed">{opp.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <InfoCard title="Posting Details">
          <InfoRow label="Posted" value={opp.date || new Date(opp.createdAt).toLocaleDateString()} />
          <InfoRow label="Applicants" value={String(opp.applicantsCount)} />
          <InfoRow label="Vetted" value={opp.vetted ? "Yes" : "No"} />
          {opp.workType && <InfoRow label="Work Type" value={opp.workType} />}
          {opp.salary && <InfoRow label="Salary" value={opp.salary} />}
        </InfoCard>

        {hasExtraDetails && (
          <InfoCard title={opp.eventDateTime || opp.eventCategory ? "Event Details" : "Grant Details"}>
            {opp.eventDateTime && <InfoRow label="Date & Time" value={opp.eventDateTime} />}
            {opp.eventCategory && <InfoRow label="Category" value={opp.eventCategory} />}
            {opp.grantBudgetRange && <InfoRow label="Budget" value={opp.grantBudgetRange} />}
            {opp.grantSector && <InfoRow label="Sector" value={opp.grantSector} />}
          </InfoCard>
        )}
      </div>

      {actionError && <p className="text-sm text-kb-error mb-3">{actionError}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={() => decide("approve")}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-50 hover:bg-green-100 text-sm font-semibold text-green-700 transition-colors disabled:opacity-60"
        >
          <Check size={16} strokeWidth={2.5} />
          Approve
        </button>
        <button
          onClick={() => decide("reject")}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-sm font-semibold text-red-600 transition-colors disabled:opacity-60"
        >
          <X size={16} strokeWidth={2.5} />
          Reject
        </button>
      </div>
      <p className="text-xs text-kb-text-placeholder mt-2">Approving marks the posting as vetted and publishes it.</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder mb-3">{title}</p>
      <div className="flex flex-col gap-2.5">{children}</div>
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
