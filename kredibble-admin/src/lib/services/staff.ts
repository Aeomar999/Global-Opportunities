/**
 * Staff service: the ONE place that reads and changes the team. The Team page, the invite form, /staff/[id] and the
 * scorecards (and any "assigned owner" choice) all go through these functions, so a person exists once and every
 * screen agrees about who is on the team.
 *
 * The data is the "staff" collection of the shared mock store (seeded in mock-seed.ts). Changes are written in every
 * mode (the Team screens were in-memory in every mode before), and shown everywhere through the store's
 * subscription. TODO(backend): persist these changes.
 */
import { KPIS, type KpiKey } from "@/config/kpis";
import type { Role } from "@/config/roles";
import { MAX_STAFF_ROLES } from "@/config/staff-roles";
import type { StaffMember } from "@/lib/mock-entities";
import { getMockCollection, setMockCollection, subscribeMockStore } from "@/lib/mock-store";

/** Tells a list or detail hook to reload when the team changes. */
export const subscribeStaff = subscribeMockStore;

const write = (rows: StaffMember[]) => setMockCollection("staff", rows, { always: true });

export const loadStaffRows = (): Promise<StaffMember[]> => Promise.resolve([...getMockCollection("staff")]);

export const loadStaffMember = (id: string): Promise<StaffMember | undefined> =>
  Promise.resolve(getMockCollection("staff").find((person) => person.id === id));

/** Adds a person to the team (newest first). One role, or two (anything beyond MAX_STAFF_ROLES is dropped). */
export function inviteStaff(name: string, email: string, roles: Role | Role[]): StaffMember {
  const person: StaffMember = {
    id: `staff-${Date.now()}`,
    name,
    email,
    roles: (Array.isArray(roles) ? roles : [roles]).slice(0, MAX_STAFF_ROLES),
    status: "active",
    joinedDate: new Date().toISOString().slice(0, 10),
  };
  write([person, ...getMockCollection("staff")]);
  return person;
}

/** Gives a person one or two roles (anything else is ignored). */
export function setStaffRoles(id: string, roles: Role[]) {
  if (roles.length < 1 || roles.length > MAX_STAFF_ROLES) return;
  write(getMockCollection("staff").map((person) => (person.id === id ? { ...person, roles } : person)));
}

export function toggleStaffStatus(id: string) {
  write(getMockCollection("staff").map((person) => (person.id === id ? { ...person, status: person.status === "active" ? "suspended" : "active" } : person)));
}

/** The people held to a KPI: active team members who hold one of its owner roles. This is the list any scorecard or owner choice uses. */
export function staffOwningKpi(key: KpiKey, people: StaffMember[] = getMockCollection("staff")): StaffMember[] {
  const owners = KPIS[key].owners;
  return people.filter((person) => person.status === "active" && person.roles.some((role) => owners.includes(role)));
}
