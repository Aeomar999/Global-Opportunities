"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { logoutAdmin } from "@/lib/api";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r border-kb-border bg-kb-bg-card flex flex-col">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-kb-border">
        <Image src="/logo.png" alt="Kredibble" width={32} height={32} className="rounded-lg" />
        <span className="text-sm font-bold text-kb-text-body">Kredibble Admin</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-kb-text-placeholder">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = item.built && pathname === item.href;
              const Icon = item.icon;

              if (!item.built) {
                return (
                  <div
                    key={item.href}
                    title="Coming soon"
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-kb-text-placeholder cursor-not-allowed select-none"
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={16} />
                      {item.label}
                    </span>
                    <span className="text-[10px] font-semibold bg-kb-bg-alt text-kb-text-placeholder rounded-full px-2 py-0.5">
                      Soon
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-kb-primary/10 text-kb-primary"
                      : "text-kb-text-body hover:bg-kb-bg-alt"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-kb-border">
        <button
          onClick={async () => {
            await logoutAdmin();
            router.push("/login");
          }}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
