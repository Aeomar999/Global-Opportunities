"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Ban, RotateCcw, ShieldCheck } from "lucide-react";
import { hirerAccounts, type HirerAccount, type VerificationSummary } from "@/lib/mock-hirers";

const VERIFICATION_STYLES: Record<VerificationSummary, { bg: string; text: string; label: string }> = {
  verified: { bg: "#F0FDF4", text: "#16A34A", label: "Verified" },
  pending: { bg: "#FFFBEB", text: "#B7791F", label: "Pending" },
  rejected: { bg: "#FEF2F2", text: "#ED4C5C", label: "Rejected" },
};

export default function HirerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const original = hirerAccounts.find((h) => h.id === params.id);
  const [hirer, setHirer] = useState<HirerAccount | undefined>(original);

  if (!hirer) {
    return (
      <div>
        <p className="text-sm text-kb-text-muted">Hirer not found.</p>
        <Link href="/hirers" className="text-sm text-kb-primary font-semibold mt-2 inline-block">
          Back to Hirers Directory
        </Link>
      </div>
    );
  }

  const toggleStatus = () => {
    setHirer((prev) =>
      prev ? { ...prev, status: prev.status === "active" ? "suspended" : "active" } : prev
    );
  };

  const isActive = hirer.status === "active";
  const v = VERIFICATION_STYLES[hirer.verification];

  return (
    <div>
      <button
        onClick={() => router.push("/hirers")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Hirers Directory
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-kb-text-body">{hirer.companyName}</h1>
          <p className="text-sm text-kb-text-muted mt-1">
            {hirer.industry} · {hirer.location}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold rounded-full px-3 py-1.5"
            style={{ backgroundColor: v.bg, color: v.text }}
          >
            {v.label}
          </span>
          <span
            className="text-xs font-semibold rounded-full px-3 py-1.5"
            style={
              isActive ? { backgroundColor: "#F0FDF4", color: "#16A34A" } : { backgroundColor: "#FEF2F2", color: "#ED4C5C" }
            }
          >
            {isActive ? "Active" : "Suspended"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <InfoCard title="Company">
          <InfoRow label="Recruiter" value={hirer.recruiterName} />
          <InfoRow label="Recruiter Email" value={hirer.recruiterEmail} />
          <InfoRow label="Joined" value={hirer.joinedDate} />
          <InfoRow label="Active Postings" value={String(hirer.postingsCount)} />
        </InfoCard>

        {hirer.linkedVerificationId && (
          <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder mb-3">
              Verification
            </p>
            <p className="text-sm text-kb-text-body mb-3">
              This company&apos;s verification documents are {v.label.toLowerCase()}.
            </p>
            <Link
              href={`/verification/${hirer.linkedVerificationId}`}
              className="flex items-center gap-2 text-sm font-semibold text-kb-primary"
            >
              <ShieldCheck size={16} />
              Go to Verification Review
            </Link>
          </div>
        )}
      </div>

      <button
        onClick={toggleStatus}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          isActive
            ? "bg-red-50 hover:bg-red-100 text-red-600"
            : "bg-green-50 hover:bg-green-100 text-green-700"
        }`}
      >
        {isActive ? <Ban size={16} strokeWidth={2.5} /> : <RotateCcw size={16} strokeWidth={2.5} />}
        {isActive ? "Suspend account" : "Reinstate account"}
      </button>
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
