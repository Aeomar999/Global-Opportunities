"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ShieldCheck, Briefcase, Users, Building2, Hash, Flag, BarChart3,
  Clock, CheckCircle2, ArrowRight, Loader2,
} from "lucide-react";
import { getDashboardSummary } from "@/lib/api";

interface SummaryData {
  pendingVerifications: number;
  pendingOpportunities: number;
  activeSeekers: number;
  activeHirers: number;
  openReports: number;
  totalUsers: number;
  totalOpportunities: number;
}

export default function DashboardHomePage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getDashboardSummary<SummaryData>()
      .then(setSummary)
      .finally(() => setIsLoading(false));
  }, []);

  const quickLinks = [
    {
      href: "/verification",
      icon: ShieldCheck,
      title: "Review pending verifications",
      sub: `${summary?.pendingVerifications || 0} compan${summary?.pendingVerifications === 1 ? "y" : "ies"} waiting on document review`,
    },
    {
      href: "/opportunities",
      icon: Briefcase,
      title: "Review posted opportunities",
      sub: `${summary?.pendingOpportunities || 0} posting${summary?.pendingOpportunities === 1 ? "" : "s"} awaiting moderation`,
    },
    {
      href: "/seekers",
      icon: Users,
      title: "Seekers Directory",
      sub: `${summary?.activeSeekers || 0} registered accounts`,
    },
    {
      href: "/hirers",
      icon: Building2,
      title: "Hirers Directory",
      sub: `${summary?.activeHirers || 0} registered companies`,
    },
    {
      href: "/community",
      icon: Hash,
      title: "Community Channels",
      sub: `Manage platform groups`,
    },
    {
      href: "/reports",
      icon: Flag,
      title: "Reports Queue",
      sub: `${summary?.openReports || 0} open report${summary?.openReports === 1 ? "" : "s"}`,
    },
    {
      href: "/analytics",
      icon: BarChart3,
      title: "Platform Analytics",
      sub: "Cross-platform stats",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-kb-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-kb-text-body mb-1">Dashboard</h1>
      <p className="text-sm text-kb-text-muted mb-6">
        Real-time platform overview fetched from the live database.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Clock} label="Pending Verification" value={summary?.pendingVerifications || 0} color="#F6B612" />
        <StatCard icon={CheckCircle2} label="Active Seekers" value={summary?.activeSeekers || 0} color="#16A34A" />
        <StatCard icon={Building2} label="Active Hirers" value={summary?.activeHirers || 0} color="#6671E4" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between bg-kb-bg-card border border-kb-border rounded-2xl p-5 hover:border-kb-primary transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-kb-primary/10 flex items-center justify-center shrink-0">
                <link.icon size={20} color="#6671E4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-kb-text-body">{link.title}</p>
                <p className="text-xs text-kb-text-muted mt-0.5">{link.sub}</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-kb-text-muted shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: `${color}1A` }}
      >
        <Icon size={18} color={color} />
      </div>
      <p className="text-2xl font-bold text-kb-text-body">{value}</p>
      <p className="text-xs text-kb-text-muted mt-1">{label}</p>
    </div>
  );
}
