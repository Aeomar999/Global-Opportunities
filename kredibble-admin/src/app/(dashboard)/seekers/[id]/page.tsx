"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Ban, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { getSeekerById, SeekerProfile } from "@/lib/api";

interface ExtendedSeekerProfile extends SeekerProfile {
  applicationsCount?: number;
  savedCount?: number;
  profession?: string;
}

export default function SeekerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [seeker, setSeeker] = useState<SeekerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeeker = async () => {
      setLoading(true);
      try {
        const data = await getSeekerById<SeekerProfile>(params.id);
        setSeeker(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load seeker");
      } finally {
        setLoading(false);
      }
    };
    fetchSeeker();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-kb-primary" />
        <span className="ml-2 text-sm text-kb-text-muted">Loading seeker...</span>
      </div>
    );
  }

  if (error || !seeker) {
    return (
      <div>
        <div className="flex items-center justify-center py-10">
          <AlertCircle size={24} className="text-kb-error mr-2" />
          <div className="text-sm text-kb-text-body">
            <p className="font-medium">Failed to load seeker</p>
            <p className="text-xs text-kb-text-muted mt-1">{error || "Seeker not found"}</p>
            <Link
              href="/seekers"
              className="mt-3 text-sm text-kb-primary font-semibold hover:underline inline-block"
            >
              Back to Seekers Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isActive = seeker.verified; // Using verified as active status

  const handleToggleStatus = async () => {
    const newVerified = !seeker.verified;
    try {
      // Note: This would need a PATCH endpoint on the backend
      // For now, just update local state
      setSeeker((prev) => (prev ? { ...prev, verified: newVerified } : prev));
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  return (
    <div>
      <button
        onClick={() => router.push("/seekers")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Seekers Directory
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-kb-text-body">{seeker.fullName || seeker.name}</h1>
          <p className="text-sm text-kb-text-muted mt-1">{(seeker as ExtendedSeekerProfile).profession || "—"}</p>
        </div>
        <span
          className="text-xs font-semibold rounded-full px-3 py-1.5"
          style={
            isActive
              ? { backgroundColor: "#F0FDF4", color: "#16A34A" }
              : { backgroundColor: "#FEF2F2", color: "#ED4C5C" }
          }
        >
          {isActive ? "Verified" : "Pending"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <InfoCard title="Account">
          <InfoRow label="Email" value={seeker.email} />
          <InfoRow label="Profession" value={(seeker as ExtendedSeekerProfile).profession || "—"} />
          <InfoRow label="Country" value={seeker.country || "—"} />
          <InfoRow label="Joined" value={new Date(seeker.createdAt).toLocaleDateString()} />
        </InfoCard>
        <InfoCard title="Activity">
          <InfoRow label="Applications submitted" value={String((seeker as ExtendedSeekerProfile).applicationsCount || 0)} />
          <InfoRow label="Saved opportunities" value={String((seeker as ExtendedSeekerProfile).savedCount || 0)} />
        </InfoCard>
      </div>

      <button
        onClick={handleToggleStatus}
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