/**
 * Labels and icons of a program's type and format, shared by the list, the form and the detail page so a type reads
 * the same everywhere. Programs are orange (an entity colour): their icon tiles use IconTile tone "brand".
 */
import { BookOpen, CalendarDays, Flag, GraduationCap, Hammer, Megaphone, MessagesSquare, Presentation, type LucideIcon } from "lucide-react";
import type { ProgramFormat, ProgramStatus, ProgramType } from "@/lib/mock-entities";

export const PROGRAM_TYPE_META: Record<ProgramType, { label: string; icon: LucideIcon }> = {
  training: { label: "Training", icon: GraduationCap },
  bootcamp: { label: "Bootcamp", icon: Hammer },
  webinar: { label: "Webinar", icon: Presentation },
  outreach: { label: "Outreach", icon: Megaphone },
  project: { label: "Project", icon: Flag },
  mentorship: { label: "Mentorship", icon: MessagesSquare },
  event: { label: "Event", icon: CalendarDays },
};

export const PROGRAM_FORMAT_LABELS: Record<ProgramFormat, string> = { online: "Online", "in-person": "In person", hybrid: "Hybrid" };

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = { planned: "Planned", running: "Running", delivered: "Delivered", cancelled: "Cancelled" };

/** The icon shown for a type that is not known (never happens with the seed; keeps a stray value from crashing). */
export const FALLBACK_PROGRAM_ICON = BookOpen;
