"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Ban, ChevronLeft, Loader2, RotateCcw } from "lucide-react";
import { getStaffById, STAFF_ROLES, updateStaff, type StaffMember } from "@/lib/api";

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStaff(await getStaffById(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff member");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStaff();
  }, [fetchStaff]);

  const save = async (data: Partial<Pick<StaffMember, "role" | "status">>) => {
    setSaving(true);
    setActionError(null);
    try {
      setStaff(await updateStaff(params.id, data));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update staff member");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-kb-primary" />
        <span className="ml-2 text-sm text-kb-text-muted">Loading staff member...</span>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-kb-text-body">
          <AlertCircle size={18} className="text-kb-error" />
          <span>{error || "Staff member not found."}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={fetchStaff} className="text-sm text-kb-primary font-semibold hover:underline">
            Retry
          </button>
          <Link href="/staff" className="text-sm text-kb-primary font-semibold">
            Back to Staff
          </Link>
        </div>
      </div>
    );
  }

  const isActive = staff.status === "active";

  return (
    <div className="max-w-lg">
      <button
        onClick={() => router.push("/staff")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Staff
      </button>

      <h1 className="text-xl font-bold text-kb-text-body">{staff.name}</h1>
      <p className="text-sm text-kb-text-muted mt-1 mb-6">
        {staff.email}
        {staff.joinedDate ? ` · Joined ${staff.joinedDate}` : ""}
      </p>

      <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder mb-3">Role</p>
        <div className="flex flex-wrap gap-2">
          {STAFF_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => save({ role })}
              disabled={saving}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-60 ${
                staff.role === role
                  ? "bg-kb-primary text-white"
                  : "bg-kb-bg-alt border border-kb-border text-kb-text-muted"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {actionError && <p className="text-sm text-kb-error mb-3">{actionError}</p>}

      <button
        onClick={() => save({ status: isActive ? "suspended" : "active" })}
        disabled={saving}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
          isActive ? "bg-red-50 hover:bg-red-100 text-red-600" : "bg-green-50 hover:bg-green-100 text-green-700"
        }`}
      >
        {isActive ? <Ban size={16} strokeWidth={2.5} /> : <RotateCcw size={16} strokeWidth={2.5} />}
        {isActive ? "Suspend access" : "Reinstate access"}
      </button>
    </div>
  );
}
