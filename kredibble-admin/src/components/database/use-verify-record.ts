"use client";

/**
 * useVerifyRecord: the one-click Verify of a database record, shared by the list and the detail page.
 *
 * verify({ id, name }) marks the record verified today (services/database.ts), which moves the pace gauge, the counts, the
 * sidebar pill and the "Beneficiaries verified" KPI in the same render (they all read the one store), then shows a toast
 * with an Undo action. The toast lasts 5 seconds; Undo puts the record back exactly as it was and says so.
 * Only a role with edit access on "database" is given a Verify button, so there is nothing to undo for anyone else.
 */
import { useToast } from "@/components/ui/Toast";
import { undoVerify, verifyRecord } from "@/lib/services/database";

export function useVerifyRecord() {
  const toast = useToast();
  return (record: { id: string; name: string }) => {
    // TODO(backend): persist this change
    const undo = verifyRecord(record.id);
    if (!undo) return;
    toast.success(`${record.name} was verified.`, {
      action: {
        label: "Undo",
        onClick: () => {
          // TODO(backend): persist this change
          undoVerify(undo);
          toast.info(`Verification of ${record.name} was undone.`);
        },
      },
    });
  };
}
