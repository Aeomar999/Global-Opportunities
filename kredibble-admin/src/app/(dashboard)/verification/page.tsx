"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { getVerifications } from "@/lib/api";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#FFFBEB", text: "#B7791F", label: "Pending" },
  approved: { bg: "#F0FDF4", text: "#16A34A", label: "Approved" },
  rejected: { bg: "#FEF2F2", text: "#ED4C5C", label: "Rejected" },
};

interface CompanyVerification {
  id: string;
  name: string;
  recruiterEmail: string;
  industry: string;
  submittedDate: string;
  overallStatus: string;
}

export default function VerificationQueuePage() {
  const [companies, setCompanies] = useState<CompanyVerification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(true), 0);
    getVerifications(filter === "all" ? undefined : filter)
      .then((data) => setCompanies(data as CompanyVerification[]))
      .finally(() => setIsLoading(false));
    return () => clearTimeout(timer);
  }, [filter]);

  return (
    <div>
      <h1 className="text-xl font-bold text-kb-text-body mb-1">Verification Queue</h1>
      <p className="text-sm text-kb-text-muted mb-6">
        Review the documents companies submitted at signup and approve or reject their Hirer verification.
      </p>

      {/* Filter Tabs */}
      <div className="flex bg-kb-bg-card border border-kb-border rounded-xl p-1 gap-1 w-fit mb-6">
        {["all", "pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              filter === s ? "bg-kb-primary text-white shadow-md shadow-kb-primary/20" : "text-kb-text-muted hover:bg-kb-bg-body"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-kb-bg-card border border-kb-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_20px] gap-4 px-5 py-3 border-b border-kb-border text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder">
          <span>Company</span>
          <span>Industry</span>
          <span>Submitted</span>
          <span>Status</span>
          <span />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-kb-primary" />
          </div>
        ) : (
          companies.map((company) => {
            const style = STATUS_STYLES[company.overallStatus] || STATUS_STYLES.pending;

            return (
              <Link
                key={company.id}
                href={`/verification/${company.id}`}
                className="grid grid-cols-[2fr_1.2fr_1fr_1fr_20px] gap-4 px-5 py-4 items-center border-b border-kb-border last:border-b-0 hover:bg-kb-bg-alt transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-kb-text-body">{company.name}</p>
                  <p className="text-xs text-kb-text-muted mt-0.5">{company.recruiterEmail}</p>
                </div>
                <span className="text-sm text-kb-text-muted">{company.industry}</span>
                <span className="text-sm text-kb-text-muted">{company.submittedDate}</span>
                <span
                  className="inline-flex w-fit text-xs font-semibold rounded-full px-2.5 py-1"
                  style={{ backgroundColor: style.bg, color: style.text }}
                >
                  {style.label}
                </span>
                <ChevronRight size={18} className="text-kb-text-placeholder justify-self-end" />
              </Link>
            );
          })
        )}

        {!isLoading && companies.length === 0 && (
          <div className="px-5 py-12 text-center text-kb-text-muted italic">
            No verification requests found.
          </div>
        )}
      </div>
    </div>
  );
}
