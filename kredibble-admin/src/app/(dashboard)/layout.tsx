"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { hasAdminSession } from "@/lib/api";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    if (!hasAdminSession()) {
      router.replace("/login");
      return;
    }

    const timer = setTimeout(() => setIsCheckingSession(false), 0);
    return () => clearTimeout(timer);
  }, [router]);

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kb-bg-screen text-sm text-kb-text-muted">
        Checking admin session...
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-screen bg-kb-bg-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 p-8">{children}</main>
    </div>
  );
}
