"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, ChevronLeft, FileText, Loader2, X } from "lucide-react";
import {
  getVerificationCompanyById,
  getVerificationCompanyDocuments,
  updateVerificationCompany,
  updateVerificationDocument,
  type CompanyVerification,
  type VerificationDoc,
} from "@/lib/api";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#FFFBEB", text: "#B7791F", label: "Pending" },
  approved: { bg: "#F0FDF4", text: "#16A34A", label: "Approved" },
  rejected: { bg: "#FEF2F2", text: "#ED4C5C", label: "Rejected" },
};

const styleFor = (status: string) => STATUS_STYLES[status] || STATUS_STYLES.pending;

export default function VerificationReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<CompanyVerification | null>(null);
  const [docs, setDocs] = useState<VerificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [record, page] = await Promise.all([
        getVerificationCompanyById(params.id),
        getVerificationCompanyDocuments(params.id, { limit: 100 }),
      ]);
      setCompany(record);
      setDocs(page.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load verification case");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCase();
  }, [fetchCase]);

  const run = async (action: () => Promise<void>, failure: string) => {
    setSaving(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : failure);
    } finally {
      setSaving(false);
    }
  };

  const setDocStatus = (docId: string, status: "approved" | "rejected") =>
    run(async () => {
      const updated = await updateVerificationDocument(docId, { status });
      setDocs((prev) => prev.map((doc) => (doc.id === docId ? updated : doc)));
    }, "Failed to update document");

  const decide = (overallStatus: "approved" | "rejected") =>
    run(async () => {
      setCompany(await updateVerificationCompany(params.id, { overallStatus }));
    }, "Failed to update verification");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-kb-primary" />
        <span className="ml-2 text-sm text-kb-text-muted">Loading verification case...</span>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-kb-text-body">
          <AlertCircle size={18} className="text-kb-error" />
          <span>{error || "Company not found."}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={fetchCase} className="text-sm text-kb-primary font-semibold hover:underline">
            Retry
          </button>
          <Link href="/verification" className="text-sm text-kb-primary font-semibold">
            Back to Verification Queue
          </Link>
        </div>
      </div>
    );
  }

  const overallStyle = styleFor(company.overallStatus);
  // Same rule the mock used: a company is approvable once every document is approved.
  const allDocsApproved = docs.length > 0 && docs.every((doc) => doc.status === "approved");

  return (
    <div>
      <button
        onClick={() => router.push("/verification")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Verification Queue
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-kb-text-body">{company.name}</h1>
          <p className="text-sm text-kb-text-muted mt-1">
            {[company.industry, company.companySize, company.location].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <span
          data-testid="overall-status"
          className="text-xs font-semibold rounded-full px-3 py-1.5"
          style={{ backgroundColor: overallStyle.bg, color: overallStyle.text }}
        >
          {overallStyle.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <InfoCard title="Company">
          <InfoRow label="Website" value={company.website} />
          <InfoRow label="Company Email" value={company.companyEmail} />
          <InfoRow label="Submitted" value={company.submittedDate || new Date(company.createdAt).toLocaleDateString()} />
        </InfoCard>
        <InfoCard title="Recruiter">
          <InfoRow label="Name" value={company.recruiterName} />
          <InfoRow label="Position" value={company.recruiterRole} />
          <InfoRow label="Email" value={company.recruiterEmail} />
        </InfoCard>
      </div>

      {actionError && <p className="text-sm text-kb-error mb-3">{actionError}</p>}

      <h2 className="text-sm font-bold text-kb-text-body mb-3">Verification Documents</h2>
      <div className="flex flex-col gap-3 mb-6">
        {docs.length === 0 && <p className="text-sm text-kb-text-muted">No documents uploaded yet.</p>}
        {docs.map((doc) => {
          const style = styleFor(doc.status);
          return (
            <div key={doc.id} className="flex items-center gap-4 bg-kb-bg-card border border-kb-border rounded-2xl p-4">
              <div className="w-10 h-10 rounded-lg bg-kb-bg-alt flex items-center justify-center shrink-0">
                <FileText size={18} className="text-kb-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-kb-text-body">{doc.label || doc.key}</p>
                <p className="text-xs text-kb-text-muted mt-0.5 truncate">{doc.fileName || "—"}</p>
              </div>
              <span
                className="text-xs font-semibold rounded-full px-2.5 py-1 shrink-0"
                style={{ backgroundColor: style.bg, color: style.text }}
              >
                {style.label}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setDocStatus(doc.id, "approved")}
                  disabled={saving}
                  className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center transition-colors disabled:opacity-60"
                  title="Approve"
                >
                  <Check size={15} color="#16A34A" strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => setDocStatus(doc.id, "rejected")}
                  disabled={saving}
                  className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors disabled:opacity-60"
                  title="Reject"
                >
                  <X size={15} color="#ED4C5C" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => decide("approved")}
          disabled={saving || !allDocsApproved}
          title={allDocsApproved ? undefined : "Approve every document first"}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-50 hover:bg-green-100 text-sm font-semibold text-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={16} strokeWidth={2.5} />
          Approve company
        </button>
        <button
          onClick={() => decide("rejected")}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-sm font-semibold text-red-600 transition-colors disabled:opacity-60"
        >
          <X size={16} strokeWidth={2.5} />
          Reject company
        </button>
      </div>
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

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-kb-text-muted">{label}</span>
      <span className="text-sm text-kb-text-body font-medium text-right">{value || "—"}</span>
    </div>
  );
}
