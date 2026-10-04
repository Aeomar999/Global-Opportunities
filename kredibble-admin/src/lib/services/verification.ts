/**
 * Data and actions for the Verification review page (verification/[id]).
 *
 * Same switch as the other loaders (see mock-mode.ts):
 * - Mock mode: the mock company from src/lib/mock-data.ts. Actions resolve with the changed record and the page
 *   keeps it in the shared mock store, exactly as before.
 * - Real mode: GET /admin/verification/companies/:id and its documents, mapped onto the page's shape by
 *   toReview(). An action PATCHes the document, then the company when the derived overall status changes, and
 *   resolves with the record as the server now holds it. A failure rejects with the server's message.
 *
 * The overall status is derived from the four documents: all approved -> approved, any rejected -> rejected,
 * otherwise pending. A document the company never uploaded is absent from `docs` and counts as not approved.
 */
import {
  getVerificationCompanyById,
  getVerificationCompanyDocuments,
  updateVerificationCompany,
  updateVerificationDocument,
  type CompanyVerification,
  type VerificationDoc as ApiVerificationDoc,
} from "@/lib/api";
import { pendingCompanies, type DocStatus, type PendingCompany, type VerificationDoc } from "@/lib/mock-data";
import { MISSING, fetchAll, orMissing } from "./api-helpers";
import { isMockMode } from "./mock-mode";

export const DOC_KEYS = ["businessReg", "orgId", "companyLogo", "proofOfOrg"] as const;
export type DocKey = (typeof DOC_KEYS)[number];

/** The name a document is shown under when the company never uploaded it. */
export const DOC_LABELS: Record<DocKey, string> = {
  businessReg: "Business Registration",
  orgId: "Organization ID",
  companyLogo: "Company Logo",
  proofOfOrg: "Proof of Organization",
};

/** One document on the review page. `id` is the API document's id (real mode only). */
export interface ReviewDoc extends VerificationDoc {
  id?: string;
}

/** The review page's record: the mock company's shape, except that a document never uploaded is absent. */
export interface VerificationReview extends Omit<PendingCompany, "docs"> {
  docs: Partial<Record<DocKey, ReviewDoc>>;
}

const DOC_STATUSES: readonly DocStatus[] = ["pending", "approved", "rejected"];
const isDocKey = (key: string): key is DocKey => (DOC_KEYS as readonly string[]).includes(key);

/** The API stores statuses as free text; anything but approved or rejected is still awaiting a decision. */
const toDocStatus = (status: string | undefined): DocStatus => DOC_STATUSES.find((known) => known === status) ?? "pending";

/** all approved -> approved; any rejected -> rejected; otherwise pending. Missing documents are not approved. */
export function deriveOverallStatus(docs: VerificationReview["docs"]): DocStatus {
  const statuses = DOC_KEYS.map((key) => docs[key]?.status);
  if (statuses.every((status) => status === "approved")) return "approved";
  if (statuses.some((status) => status === "rejected")) return "rejected";
  return "pending";
}

function toReview(company: CompanyVerification, documents: ApiVerificationDoc[]): VerificationReview {
  const docs: VerificationReview["docs"] = {};
  // The API lists the newest upload first, so a re-uploaded document replaces the older one.
  for (const document of documents) {
    if (!isDocKey(document.key) || docs[document.key]) continue;
    docs[document.key] = {
      id: document.id,
      label: document.label || DOC_LABELS[document.key],
      fileName: document.fileName || MISSING,
      status: toDocStatus(document.status),
    };
  }
  return {
    id: company.id,
    name: company.name,
    // Text the API does not send stays empty: the page leaves it out rather than inventing it.
    industry: company.industry ?? "",
    companySize: company.companySize ?? "",
    location: company.location ?? "",
    website: company.website ?? "",
    companyEmail: company.companyEmail ?? "",
    recruiterName: company.recruiterName ?? "",
    recruiterRole: company.recruiterRole ?? "",
    recruiterEmail: company.recruiterEmail ?? "",
    submittedDate: company.submittedDate || company.createdAt,
    overallStatus: toDocStatus(company.overallStatus),
    docs,
  };
}

/** One company with its documents, or undefined when it does not exist. */
export async function loadVerificationReview(id: string): Promise<VerificationReview | undefined> {
  if (isMockMode()) return pendingCompanies.find((company) => company.id === id);
  const company = await getVerificationCompanyById(id).catch(orMissing<CompanyVerification>);
  if (!company) return undefined;
  const documents = await fetchAll((page, limit) => getVerificationCompanyDocuments(id, { page, limit }));
  return toReview(company, documents);
}

/**
 * Sets one document's status and, when that changes the derived overall status, the company's too.
 * Resolves with the updated record. Rejects with the server's message; when the document was saved but the
 * company was not, the message says so, because a reload will show the saved document.
 */
export async function setVerificationDocStatus(review: VerificationReview, key: DocKey, status: DocStatus): Promise<VerificationReview> {
  const current = review.docs[key];
  if (!current) throw new Error(`${DOC_LABELS[key]} was never uploaded, so it cannot be reviewed.`);
  const docs = { ...review.docs, [key]: { ...current, status } };
  const overallStatus = deriveOverallStatus(docs);
  if (isMockMode()) return { ...review, docs, overallStatus };

  if (!current.id) throw new Error(`${current.label} has no document id, so it cannot be reviewed.`);
  const saved = await updateVerificationDocument(current.id, { status });
  const savedDocs = { ...review.docs, [key]: { ...current, status: toDocStatus(saved.status) } };
  const savedOverall = deriveOverallStatus(savedDocs);
  if (savedOverall === review.overallStatus) return { ...review, docs: savedDocs };

  try {
    const company = await updateVerificationCompany(review.id, { overallStatus: savedOverall });
    return { ...review, docs: savedDocs, overallStatus: toDocStatus(company.overallStatus) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "the request failed";
    throw new Error(`${current.label} was saved, but the company's overall status was not (${reason}). Reload to see the saved state.`);
  }
}
