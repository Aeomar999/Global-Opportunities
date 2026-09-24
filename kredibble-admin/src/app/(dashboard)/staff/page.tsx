"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { staffStore, type StaffMember } from "@/lib/mock-staff";

export default function StaffPage() {
  const [members, setMembers] = useState<StaffMember[]>(staffStore.members);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMembers([...staffStore.members]);
    }, 0);
    const unsubscribe = staffStore.subscribe(() => setMembers([...staffStore.members]));
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-kb-text-body">Staff</h1>
        <Link
          href="/staff/invite"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-kb-primary text-white text-sm font-semibold"
        >
          <Plus size={15} strokeWidth={2.5} />
          Invite Staff
        </Link>
      </div>
      <p className="text-sm text-kb-text-muted mb-6">{members.length} admin/support accounts.</p>

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
            <span className="text-sm text-kb-text-muted truncate">{staff.role}</span>
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
      </div>
    </div>
  );
}
