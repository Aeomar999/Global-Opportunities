"use client";

/**
 * Partners (/partners): the six-stage partner pipeline as a board (purple accent: Partners and Network are purple).
 *
 * - Two summary tiles on top (PartnerSummary, the ProgramSummary pattern): "Open pipeline" (Prospect to Proposal plus MOU)
 *   and "Closed this month" (moved into Onboard or Renew this month). They count ALL partners, whatever the filters say.
 *   From 1280px the tiles are stacked in a 240px column with the health card beside them (one row); below, they stack.
 * - Pipeline health card (a three-zone gauge): open deals against the deals needed to hit next month's "Partners onboarded" target
 *   (pipelineHealth(), counted on ALL partners so a filter does not change it). In mock mode outside production,
 *   ?health=healthy|thin|critical|nodata|capped feeds it demo inputs so every state can be seen (lib/pipeline-health-demo.ts).
 * - Toolbar: search, Owner, Type and Country (the custom Select). "New partner" (primary) needs edit access on partners.
 * - The board (KanbanBoard): Prospect, Outreach, Proposal, MOU, Onboard, Renew. The KEYS are fixed; the LABELS come from the
 *   store (usePartnerStageLabels), so Settings can rename them later. Onboard and Renew carry a "Closed" marker.
 *   A card moves by drag and drop, or with its "Move to…" menu (keyboard, touch and phones). Moving into Onboard or
 *   Renew closes the deal and moving out opens it again, automatically; there is NO manual closed switch anywhere. A
 *   toast confirms the move and says when the deal became closed (or open). The move is announced in a live region.
 * - Roles: Partnerships Officer, Desk Lead and Super Admin edit; Country Lead only views (no menu, no drag handle).
 * When the filters match nothing (for example Type = Government, which no seeded partner has) the board is replaced by a
 * "no results" state with a "Clear filters" button, on phones too.
 * Outside mock mode a notice says the page shows sample data (partners have no backend yet). The dev ?state=
 * loading|empty|error switch works here.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Handshake, Plus, SearchX } from "lucide-react";
import { useRoles } from "@/components/access/RoleProvider";
import { ListPage } from "@/components/list/ListPage";
import { TableToolbar } from "@/components/list/TableToolbar";
import { PartnerCard } from "@/components/partners/PartnerCard";
import { PartnerSummary } from "@/components/partners/PartnerSummary";
import { PipelineHealthCard } from "@/components/partners/PipelineHealthCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { KanbanBoard, type KanbanColumn } from "@/components/ui/KanbanBoard";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { useToast } from "@/components/ui/Toast";
import { CLOSED_STAGES, PARTNER_STAGES, PARTNER_TYPES, PARTNER_TYPE_LABELS, type PartnerStage, type PartnerType } from "@/lib/mock-entities";
import { usePartnerStageLabels } from "@/lib/mock-store";
import { pipelineHealth } from "@/lib/pipeline-health";
import { demoHealth, parseHealthOverride } from "@/lib/pipeline-health-demo";
import { isMockMode } from "@/lib/services/mock-mode";
import { flattenMoves, loadPartnerRows, movePartner, nextMonthPartnersTarget, subscribePartners, type PartnerRow } from "@/lib/services/partners";
import { useListData } from "@/lib/use-list-data";

const ALL = "all";

export default function PartnersPage() {
  const { rows, isLoading, error, retry } = useListData(loadPartnerRows, { subscribe: subscribePartners });
  const labels = usePartnerStageLabels();
  const { can } = useRoles();
  const toast = useToast();
  const canEdit = can("partners", "edit");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  // The dev-only ?health= override (ignored outside mock mode and in production).
  const override = parseHealthOverride(useSearchParams().get("health"), isMockMode(), process.env.NODE_ENV);

  const all = useMemo(() => rows ?? [], [rows]);
  const columns: KanbanColumn[] = PARTNER_STAGES.map((key) => ({ key, label: labels[key], marker: CLOSED_STAGES.includes(key) ? "Closed" : undefined }));

  // The health of the WHOLE pipeline, whatever the filters say.
  const target = nextMonthPartnersTarget();
  const realHealth = useMemo(() => (rows ? pipelineHealth(rows, flattenMoves(rows), target) : null), [rows, target]);
  const demo = override ? demoHealth(override) : null;
  const health = demo ? demo.health : realHealth;
  const shownTarget = demo ? demo.target : target;

  const ownerOptions: SelectOption<string>[] = useMemo(
    () => [
      { value: ALL, label: "All owners" },
      ...[...new Map(all.filter((row) => row.ownerName).map((row) => [row.ownerId, row.ownerName as string])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
    ],
    [all],
  );
  const typeOptions: SelectOption<string>[] = [{ value: ALL, label: "All types" }, ...PARTNER_TYPES.map((value) => ({ value, label: PARTNER_TYPE_LABELS[value] }))];
  const countryOptions: SelectOption<string>[] = useMemo(
    () => [{ value: ALL, label: "All countries" }, ...[...new Set(all.map((row) => row.country))].sort().map((name) => ({ value: name, label: name }))],
    [all],
  );

  const term = search.trim().toLowerCase();
  const visible = all.filter(
    (row) =>
      (owner === ALL || row.ownerId === owner) &&
      (type === ALL || row.type === (type as PartnerType)) &&
      (country === ALL || row.country === country) &&
      (!term || [row.name, row.contactName, row.country, row.provides].some((text) => text.toLowerCase().includes(term))),
  );

  const filtered = owner !== ALL || type !== ALL || country !== ALL || term !== "";
  const clearFilters = () => {
    setSearch("");
    setOwner(ALL);
    setType(ALL);
    setCountry(ALL);
  };

  const onMove = (row: PartnerRow, to: string) => {
    const result = movePartner(row.id, to as PartnerStage);
    if (!result) return;
    const closing = result.closedChange === "closed" ? " It is now closed." : result.closedChange === "reopened" ? " It is open again." : "";
    // TODO(backend): persist this change
    toast.success(`${row.name} moved to ${labels[result.to]}.${closing}`);
  };

  return (
    <ListPage
      title="Partners"
      subtitle="Organisations in the six-stage partner pipeline."
      action={canEdit ? { label: "New partner", href: "/partners/new", icon: Plus } : undefined}
      toolbar={
        <div className="space-y-4">
          <NotConnectedNotice />
          {/* From 1280px: the two tiles stacked in a 240px column on the left, the health card taking the rest, in ONE row
              (so the board starts higher). Below 1280px they stack. */}
          <div className="space-y-4 xl:grid xl:grid-cols-[15rem_1fr] xl:items-stretch xl:gap-4 xl:space-y-0">
            <PartnerSummary partners={rows} className="xl:max-w-none xl:grid-cols-1" />
            <PipelineHealthCard health={health} target={shownTarget} demo={override ?? undefined} />
          </div>
          <TableToolbar search={{ value: search, onChange: setSearch, placeholder: "Search partners", label: "Search partners" }}>
            <Select options={ownerOptions} value={owner} onChange={setOwner} ariaLabel="Filter by owner" sheetTitle="Owner" className="w-fit" />
            <Select options={typeOptions} value={type} onChange={setType} ariaLabel="Filter by type" sheetTitle="Type" className="w-fit" />
            <Select options={countryOptions} value={country} onChange={setCountry} ariaLabel="Filter by country" sheetTitle="Country" className="w-fit" />
          </TableToolbar>
        </div>
      }
    >
      {error ? (
        <Card as="section" ariaLabel="Partners">
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="font-semibold text-ink">Could not load the partners</p>
            <p className="caption">{error}</p>
            <Button variant="secondary" onClick={retry}>
              Try again
            </Button>
          </div>
        </Card>
      ) : !isLoading && all.length === 0 ? (
        <Card as="section" ariaLabel="Partners">
          <EmptyState icon={Handshake} title="No partners yet" description="Organisations you reach out to appear here, from Prospect to Renew." />
        </Card>
      ) : !isLoading && filtered && visible.length === 0 ? (
        <Card as="section" ariaLabel="Partners">
          <EmptyState
            icon={SearchX}
            title="No partners match these filters"
            description="Nothing in the pipeline fits this search, owner, type and country. Clear the filters to see every partner."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <KanbanBoard
          ariaLabel="Partner pipeline"
          columns={columns}
          items={visible}
          getId={(row) => row.id}
          getColumnKey={(row) => row.stage}
          getName={(row) => row.name}
          renderCard={(row) => <PartnerCard partner={row} />}
          onMove={onMove}
          canMove={canEdit}
          itemNoun="partners"
          loading={isLoading}
        />
      )}
    </ListPage>
  );
}
