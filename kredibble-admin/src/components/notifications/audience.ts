import { Building2, Globe, Users, type LucideIcon } from "lucide-react";
import type { Audience } from "@/lib/notification-store";

/** How an audience is named in sentences and history rows. */
export const AUDIENCE_LABEL: Record<Audience, string> = {
  seekers: "All Seekers",
  hirers: "All Hirers",
  both: "Everyone",
};

export const AUDIENCE_ICON: Record<Audience, LucideIcon> = {
  seekers: Users,
  hirers: Building2,
  both: Globe,
};
