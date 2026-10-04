"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, UserPlus } from "lucide-react";
import { inviteStaff, STAFF_ROLES } from "@/lib/api";

type StaffRole = (typeof STAFF_ROLES)[number];

export default function InviteStaffPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("Admin Support");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = Boolean(email.trim());

  const handleInvite = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      await inviteStaff({ email: email.trim(), role });
      router.push("/staff");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add staff member");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <button
        onClick={() => router.push("/staff")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Staff
      </button>

      <h1 className="text-xl font-bold text-kb-text-body mb-1">Add Staff</h1>
      <p className="text-sm text-kb-text-muted mb-6">
        Give an existing Kredibble account staff access and choose its role. They keep their own name and
        password; ask them to sign up first if they don&apos;t have an account.
      </p>

      <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-kb-text-body mb-1.5">Account email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ama.boateng@kredibble.com"
            className="w-full h-11 rounded-lg border border-kb-border-input px-3 text-sm text-kb-text-body outline-none focus:border-kb-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-kb-text-body mb-1.5">Role</label>
          <div className="flex flex-wrap gap-2">
            {STAFF_ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  role === r ? "bg-kb-primary text-white" : "bg-kb-bg-alt border border-kb-border text-kb-text-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-kb-error">{error}</p>}

        <button
          onClick={handleInvite}
          disabled={!isValid || saving}
          className="flex items-center justify-center gap-2 h-11 rounded-lg bg-kb-primary text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity mt-2"
        >
          <UserPlus size={15} />
          {saving ? "Adding..." : "Add Staff Member"}
        </button>
      </div>
    </div>
  );
}
