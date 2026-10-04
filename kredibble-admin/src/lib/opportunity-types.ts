/**
 * Labels and icons for opportunity types, shared by the Opportunities Queue and the review page.
 *
 * The redesign's four types (jobs, internships, events, grants) plus the API's other posting types, so a posting
 * is never shown as a type it isn't. A type nobody has listed here shows its own name.
 */
import { Award, Briefcase, CalendarDays, GraduationCap, HandCoins, Presentation, Trophy, type LucideIcon } from "lucide-react";

export interface OpportunityTypeMeta {
  label: string;
  icon: LucideIcon;
}

const TYPE_META: Record<string, OpportunityTypeMeta> = {
  jobs: { label: "Job", icon: Briefcase },
  internships: { label: "Internship", icon: GraduationCap },
  events: { label: "Event", icon: CalendarDays },
  grants: { label: "Grant", icon: HandCoins },
  competitions: { label: "Competition", icon: Trophy },
  fellowships: { label: "Fellowship", icon: Award },
  trainings: { label: "Training", icon: Presentation },
};

/** The label and icon for a type key ("jobs", "competitions", ...). */
export const opportunityTypeMeta = (type: string): OpportunityTypeMeta => TYPE_META[type] ?? { label: type, icon: Briefcase };
