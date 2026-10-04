/**
 * Roles: who can sit at the desk.
 *
 * The first three are the original staff roles. The rest are the desk roles. A user holds one or two roles
 * (`Role[]`); what each role may see or change is in src/config/permissions.ts.
 *
 * Role ids use snake_case (they are stored in the dev-switcher cookie and used in tests); labels are for people.
 */
export const ROLE_IDS = [
  "super_admin",
  "moderator",
  "support",
  "partnerships_officer",
  "opportunities_officer",
  "training_officer",
  "database_officer",
  "communications_officer",
  "social_media_manager",
  "country_lead",
  "admin_support",
  "desk_lead",
] as const;

export type Role = (typeof ROLE_IDS)[number];

export interface RoleInfo {
  label: string;
  /** One line on what the role is for. */
  description: string;
}

export const ROLES: Record<Role, RoleInfo> = {
  super_admin: { label: "Super Admin", description: "Full access to every screen, including staff and settings." },
  moderator: { label: "Moderator", description: "Reviews verifications, reports and postings, and looks after channels and accounts." },
  support: { label: "Support", description: "Helps seekers and hirers, and can suspend their accounts." },
  partnerships_officer: { label: "Partnerships Officer", description: "Runs the partner pipeline from first contact to active partner." },
  opportunities_officer: { label: "Opportunities Officer", description: "Vets, writes and publishes opportunity listings and career resources." },
  training_officer: { label: "Training and Capacity Development Officer", description: "Plans and runs training programs and events." },
  database_officer: { label: "Database Officer", description: "Keeps the beneficiary database accurate and complete." },
  communications_officer: { label: "Communications Officer", description: "Writes testimonials, notifications and articles, and reads the monthly report." },
  social_media_manager: { label: "Social Media Manager", description: "Plans and publishes the desk's social media posts." },
  country_lead: { label: "Country Lead", description: "Leads the ambassador network in one country and follows its programs and partners." },
  admin_support: { label: "Admin Support", description: "Looks after the team list and day-to-day administration." },
  desk_lead: { label: "Desk Lead", description: "Leads the desk: full access, plus the team scorecard." },
};

export const isRole = (value: string): value is Role => (ROLE_IDS as readonly string[]).includes(value);
