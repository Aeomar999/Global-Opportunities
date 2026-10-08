"use client";

/**
 * CredentialField: a WRITE-ONLY secret (the WordPress credential, the Google Analytics secret).
 *
 *   Nothing saved:   [ ••••••••••••••••••  (eye) ]   [ Save credential ]
 *   Saved:           Saved · ends in ••••3f9a                         [ Replace ]
 *
 * - The value is never shown after it is saved: not here, not in the page, not in an input. The screen only knows the LAST FOUR characters,
 *   masked ("••••3f9a"). Replace opens an empty field for a new value; Cancel keeps the saved one.
 * - The field is type="password" with the show/hide eye (PasswordInput, the one Login has) and autocomplete="new-password", so the browser does not
 *   offer to remember it. What is typed lives in this component's state ONLY while it is being typed:
 *     * saving reads it into a local variable, empties the state at once, and hands the value to saveCredential(), which keeps only the last four
 *       characters (services/settings.ts); the field itself is removed from the page;
 *     * it is emptied when the tab goes to the background (visibilitychange), and when the field is removed (unmount, a new tab);
 *     * it is never logged, put in a toast, a URL, localStorage or sessionStorage.
 * - "Test connection" is a mock: a spinner for 800 ms, then an announced result. It takes no value and sends nothing anywhere.
 *
 * Props: kind ("wordpress" | "analytics"), title (what it is called: "WordPress application password"), name (for messages: "WordPress")
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Plug } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/form/Field";
import { PasswordInput } from "@/components/ui/form/PasswordInput";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { getIntegration, getIntegrationsVersion, maskedTail, saveCredential, subscribeIntegrations, testConnection, type IntegrationKind } from "@/lib/services/settings";

interface CredentialFieldProps {
  kind: IntegrationKind;
  title: string;
  name: string;
}

export function CredentialField({ kind, title, name }: CredentialFieldProps) {
  const toast = useToast();
  useSyncExternalStore(subscribeIntegrations, getIntegrationsVersion, getIntegrationsVersion);
  const status = getIntegration(kind);
  const [replacing, setReplacing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [test, setTest] = useState<"idle" | "testing" | "ok">("idle");

  const editing = !status.saved || replacing;

  // What is typed is dropped when the tab goes to the background, and when the field goes away.
  useEffect(() => {
    const clear = () => {
      if (document.visibilityState === "hidden") setDraft("");
    };
    document.addEventListener("visibilitychange", clear);
    return () => document.removeEventListener("visibilitychange", clear);
  }, []);

  const save = () => {
    const secret = draft;
    if (!secret.trim()) {
      setError("Enter the credential.");
      return;
    }
    setDraft(""); // emptied at once: the value is not kept in this component after this line
    setError(undefined);
    // TODO(backend): send it to the server over HTTPS; the server stores it and never sends it back
    saveCredential(kind, secret);
    setReplacing(false);
    setTest("idle");
    toast.success(`The ${name} credential was saved.`);
  };

  const runTest = async () => {
    setTest("testing");
    await testConnection(kind);
    setTest("ok");
  };

  return (
    <div className="space-y-3" data-testid={`credential-${kind}`}>
      {editing ? (
        <div>
          <Field label={title} error={error} helper="Write-only: once saved it is never shown again.">
            <PasswordInput
              value={draft}
              onChange={(value) => {
                setDraft(value);
                setError(undefined);
              }}
              autoComplete="new-password"
              label={`${name} credential`}
              testId={`credential-input-${kind}`}
            />
          </Field>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {status.saved && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraft("");
                  setError(undefined);
                  setReplacing(false);
                }}
              >
                Cancel
              </Button>
            )}
            <Button type="button" onClick={save}>
              Save credential
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="field-label text-ink">{title}</p>
            <p data-testid={`credential-saved-${kind}`} className="body-sm mt-0.5 flex items-center gap-1.5 text-ink">
              <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-success" />
              Saved · ends in {maskedTail(status.tail)}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setReplacing(true)}>
            Replace
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Tooltip label="Save a credential first" placement="top" disabled={status.saved}>
          <Button type="button" variant="secondary" icon={Plug} loading={test === "testing"} disabled={!status.saved || editing} onClick={runTest}>
            Test connection
          </Button>
        </Tooltip>
        <p role="status" aria-live="polite" data-testid={`test-result-${kind}`} className="body-sm text-success">
          {test === "testing" && <span className="text-muted">Testing the connection…</span>}
          {test === "ok" && `The connection to ${name} works.`}
        </p>
      </div>
    </div>
  );
}
