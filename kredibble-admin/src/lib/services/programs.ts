/**
 * Programs service: GOD's own activities (trainings, bootcamps, webinars...). A Program is NOT an Opportunity: it is
 * something the desk runs, with its own people, partner and target.
 *
 * One function per need; pages never touch the store or the seed. Everything lives in the shared in-memory mock store,
 * so the list, the detail page, the form, the KPI "Programs organised" and the Overview see the same programs. Writes
 * use `{ always: true }` (programs have no backend yet, so they are kept in memory in every mode).
 * TODO(backend): every write below must be persisted by the API.
 *
 * Rules kept here, not in the pages:
 * - "Active" = planned + running. "Delivered" = delivered. Cancelled programs are neither. programSummary() is the ONE
 *   place that counts them, so every summary shows the same two numbers.
 * - A delivered program has deliveredAt = the day it ended (that decides which month it counts toward).
 */
import { getMockCollection, setMockCollection, subscribeMockStore } from "@/lib/mock-store";
import type { Program, ProgramStatus } from "@/lib/mock-entities";

const MOCK_DELAY_MS = 300;
const afterDelay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));

/** Re-run a loader whenever programs (or anything else in the store) change. */
export const subscribeProgramStore = subscribeMockStore;

/** A program with the name of its partner, for the list. */
export interface ProgramRow extends Program {
  partnerName?: string;
}

/** Every program, newest start first, with the partner's name. */
export function loadProgramRows(): Promise<ProgramRow[]> {
  const partners = getMockCollection("partners");
  const rows = getMockCollection("programs")
    .map((program): ProgramRow => ({ ...program, partnerName: partners.find((partner) => partner.id === program.partnerId)?.name }))
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  return afterDelay(rows);
}

/** One program, or undefined. */
export function loadProgram(id: string): Promise<ProgramRow | undefined> {
  const partners = getMockCollection("partners");
  const program = getMockCollection("programs").find((entry) => entry.id === id);
  return afterDelay(program ? { ...program, partnerName: partners.find((partner) => partner.id === program.partnerId)?.name } : undefined);
}

/** The two numbers every program summary shows. */
export function programSummary(programs: readonly Pick<Program, "status">[]): { active: number; delivered: number } {
  return {
    active: programs.filter((program) => program.status === "planned" || program.status === "running").length,
    delivered: programs.filter((program) => program.status === "delivered").length,
  };
}

/** Partners that can be linked to a program (name order). */
export function programPartnerOptions(): { id: string; name: string }[] {
  return getMockCollection("partners")
    .map((partner) => ({ id: partner.id, name: partner.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The fields a person fills in on the form. The id is decided by the service. */
export type ProgramFields = Omit<Program, "id" | "deliveredAt">;

/** The calendar day of a "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" value. */
export const dayOf = (value: string): string => value.slice(0, 10);

const write = (programs: Program[]) => setMockCollection("programs", programs, { always: true });

/** A delivered program counts in the month it ended; any other status has no delivered day. */
const withDeliveredDay = (fields: ProgramFields): Program["deliveredAt"] => (fields.status === "delivered" ? dayOf(fields.endAt) : undefined);

export function createProgram(fields: ProgramFields): Program {
  const program: Program = { ...fields, id: `prg-new-${Date.now()}`, deliveredAt: withDeliveredDay(fields) };
  write([program, ...getMockCollection("programs")]);
  return program;
}

export function updateProgram(id: string, fields: ProgramFields): Program | undefined {
  const current = getMockCollection("programs").find((program) => program.id === id);
  if (!current) return undefined;
  const next: Program = { ...fields, id, deliveredAt: withDeliveredDay(fields) };
  write(getMockCollection("programs").map((program) => (program.id === id ? next : program)));
  return next;
}

/** Cancels a program that has not been delivered. Active drops by one; Delivered does not change. */
export function cancelProgram(id: string) {
  write(
    getMockCollection("programs").map((program) =>
      program.id === id ? { ...program, status: "cancelled" as ProgramStatus, deliveredAt: undefined } : program,
    ),
  );
}
