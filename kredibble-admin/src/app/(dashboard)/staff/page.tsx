"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Loader2, Plus } from "lucide-react";
import { getStaff, type StaffMember } from "@/lib/api";

export default function StaffPage() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getStaff({ limit: 100 });
      setMembers(page.data);
      setTotal(page.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStaff();
  }, [fetchStaff]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-kb-text-body">Staff</h1>
        <Link
          href="/staff/invite"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-kb-primary text-white text-sm font-semibold"
        >
          <Plus size={15} strokeWidth={2.5} />
          Add Staff
        </Link>
      </div>
      <p className="text-sm text-kb-text-muted mb-6">{total} staff accounts.</p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-kb-primary" />
          <span className="ml-2 text-sm text-kb-text-muted">Loading staff...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-center">
          <AlertCircle size={24} className="text-kb-error mr-2" />
          <div className="text-sm text-kb-text-body">
            <p className="font-medium">Failed to load staff</p>
            <p className="text-xs text-kb-text-muted mt-1">{error}</p>
            <button onClick={fetchStaff} className="mt-3 text-sm text-kb-primary hover:underline">
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-kb-bg-card border border-kb-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1.6fr_1fr_1fr_20px] gap-4 px-5 py-3 border-b border-kb-border text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span />
          </div>

          {members.map((staff) => (
            <Link
              key={staff.id}
              href={`/staff/${staff.id}`}
              className="grid grid-cols-[1.6fr_1.6fr_1fr_1fr_20px] gap-4 px-5 py-4 items-center border-b border-kb-border last:border-b-0 hover:bg-kb-bg-alt transition-colors"
            >
              <span className="text-sm font-semibold text-kb-text-body truncate">{staff.name}</span>
              <span className="text-sm text-kb-text-muted truncate" title={staff.email}>{staff.email}</span>
              <span className="text-sm text-kb-text-muted truncate" title={staff.role}>{staff.role}</span>
              <span
                className="inline-flex w-fit text-xs font-semibold rounded-full px-2.5 py-1"
                style={
                  staff.status === "active"
                    ? { backgroundColor: "#F0FDF4", color: "#16A34A" }
                    : { backgroundColor: "#FEF2F2", color: "#ED4C5C" }
                }
              >
                {staff.status === "active" ? "Active" : "Suspended"}
              </span>
              <ChevronRight size={18} className="text-kb-text-placeholder justify-self-end" />
            </Link>
          ))}

          {members.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-kb-text-muted">No staff yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
