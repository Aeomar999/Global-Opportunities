"use client";

/**
 * IntegrationsTab: Settings > Integrations (Desk Lead and Super Admin).
 *
 * Two cards: WordPress (the site address and an application password) and Google Analytics (the property ID and an API secret). The address
 * and the property ID are ordinary settings; the password and the secret are WRITE-ONLY (CredentialField): once saved they show as
 * "Saved · ends in ••••3f9a" with a Replace button and are never shown again. "Test connection" is a mock that succeeds after 800 ms.
 * A note says what is true in the real app: "Credentials are stored on the server in the real app".
 */
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { CredentialField } from "@/components/settings/CredentialField";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { useToast } from "@/components/ui/Toast";
import { getIntegration, getIntegrationsVersion, saveIdentifier, subscribeIntegrations, type IntegrationKind } from "@/lib/services/settings";

interface CardSpec {
  kind: IntegrationKind;
  title: string;
  description: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  secretTitle: string;
  name: string;
}

const CARDS: CardSpec[] = [
  {
    kind: "wordpress",
    title: "WordPress",
    description: "Lets the desk publish to the website.",
    identifierLabel: "Site address",
    identifierPlaceholder: "https://www.example.org",
    secretTitle: "Application password",
    name: "WordPress",
  },
  {
    kind: "analytics",
    title: "Google Analytics",
    description: "Where the website audience numbers come from.",
    identifierLabel: "Property ID",
    identifierPlaceholder: "e.g. 123456789",
    secretTitle: "API secret",
    name: "Google Analytics",
  },
];

function IntegrationCard({ spec }: { spec: CardSpec }) {
  const toast = useToast();
  useSyncExternalStore(subscribeIntegrations, getIntegrationsVersion, getIntegrationsVersion);
  const saved = getIntegration(spec.kind);
  const [identifier, setIdentifier] = useState(saved.identifier);

  const saveSetting = (event: FormEvent) => {
    event.preventDefault();
    // TODO(backend): persist this change
    saveIdentifier(spec.kind, identifier);
    toast.success(`The ${spec.name} ${spec.identifierLabel.toLowerCase()} was saved.`);
  };

  return (
    <Card as="section" ariaLabel={spec.title}>
      <CardHeader title={spec.title} subtitle={spec.description} />
      <form onSubmit={saveSetting} noValidate className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <Field label={spec.identifierLabel} optional>
            <Input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={spec.identifierPlaceholder} autoComplete="off" />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={identifier.trim() === saved.identifier}>
          Save
        </Button>
      </form>
      <CredentialField kind={spec.kind} title={spec.secretTitle} name={spec.name} />
    </Card>
  );
}

export function IntegrationsTab() {
  return (
    <div className="max-w-240 space-y-4">
      {CARDS.map((spec) => (
        <IntegrationCard key={spec.kind} spec={spec} />
      ))}
      <p data-testid="credentials-note" className="caption">
        Credentials are stored on the server in the real app. Here nothing is stored: only the last four characters are remembered, until you reload.
      </p>
    </div>
  );
}
