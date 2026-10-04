"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Ban, RotateCcw, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { getHirerById, HirerAccount } from "@/lib/api";

interface ExtendedHirerAccount extends HirerAccount {
  industry?: string;
  location?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  postingsCount?: number;
  joinedDate?: string;
  linkedVerificationId?: string;
}

const VERIFICATION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  verified: { bg: "#F0FDF4", text: "#16A34A", label: "Verified" },
  pending: { bg: "#FFFBEB", text: "#B7791F", label: "Pending" },
  rejected: { bg: "#FEF2F2", text: "#ED4C5C", label: "Rejected" },
  unknown: { bg: "#F3F4F6", text: "#6B7280", label: "Unknown" },
};

export default function HirerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [hirer, setHirer] = useState<ExtendedHirerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHirer = async () => {
      setLoading(true);
      try {
        const data = await getHirerById<ExtendedHirerAccount>(params.id);
        setHirer(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load hirer");
      } finally {
        setLoading(false);
      }
    };
    fetchHirer();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-kb-primary" />
        <span className="ml-2 text-sm text-kb-text-muted">Loading hirer...</span>
      </div>
    );
  }

  if (error || !hirer) {
    return (
      <div>
        <div className="flex items-center justify-center py-10">
          <AlertCircle size={24} className="text-kb-error mr-2" />
          <div className="text-sm text-kb-text-body">
            <p className="font-medium">Failed to load hirer</p>
            <p className="text-xs text-kb-text-muted mt-1">{error || "Hirer not found"}</p>
            <Link href="/hirers" className="mt-3 text-sm text-kb-primary font-semibold hover:underline inline-block">
              Back to Hirers Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isActive = hirer.verified; // Using verified as active status
  const v = VERIFICATION_STYLES[hirer.overallStatus || "unknown"];

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
            {hirer.industry || "—"} · {hirer.location || "—"}
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
            {isActive ? "Verified" : "Pending"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <InfoCard title="Company">
          <InfoRow label="Recruiter" value={hirer.recruiterName || "—"} />
          <InfoRow label="Recruiter Email" value={hirer.recruiterEmail || "—"} />
          <InfoRow label="Joined" value={new Date(hirer.createdAt).toLocaleDateString()} />
          <InfoRow label="Active Postings" value={String(hirer.postingsCount || 0)} />
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
        onClick={() => {
          setHirer((prev) => (prev ? { ...prev, verified: !prev.verified } : prev));
        }}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          hirer.verified
            ? "bg-red-50 hover:bg-red-100 text-red-600"
            : "bg-green-50 hover:bg-green-100 text-green-700"
        }`}
      >
        {hirer.verified ? <Ban size={16} strokeWidth={2.5} /> : <RotateCcw size={16} strokeWidth={2.5} />}
        {hirer.verified ? "Suspend account" : "Reinstate account"}
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