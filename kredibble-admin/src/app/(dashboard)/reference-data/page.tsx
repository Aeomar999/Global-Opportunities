"use client";

/**
 * Reference data: the dropdown lists the mobile app uses. This one page replaces the Seeker, Hirer and
 * Grants Taxonomy pages (their old URLs redirect here: see src/config/redirects.ts).
 *
 *   [ Seekers | Hirers | Grants ]            <- SegmentedControl, kept in the URL as ?tab=hirer / ?tab=grants
 *   Universities 21 | Programs 25 | ...      <- Tabs with counts (one row per group)
 *   <ReferenceListEditor>                    <- the shared content card
 *
 * State: the three groups' lists live in this page's state, so edits survive switching tabs and are
 * lost on reload ("State stays in memory as today"). Each change carries a TODO(backend) in the editor.
 */
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { REFERENCE_GROUPS, type ReferenceGroupKey } from "@/lib/reference-data";
import { ReferenceListEditor } from "@/components/reference/ReferenceListEditor";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Tabs, tabId, tabPanelId } from "@/components/ui/Tabs";

const GROUP_PARAM = "tab";

export default function ReferenceDataPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Items per list key, and the open list per group.
  const [items, setItems] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(REFERENCE_GROUPS.flatMap((group) => group.lists.map((list) => [list.key, list.items]))),
  );
  const [openList, setOpenList] = useState<Record<string, string>>(() =>
    Object.fromEntries(REFERENCE_GROUPS.map((group) => [group.key, group.lists[0].key])),
  );

  const requested = params.get(GROUP_PARAM);
  const group = REFERENCE_GROUPS.find((g) => g.key === requested) ?? REFERENCE_GROUPS[0];
  const list = group.lists.find((l) => l.key === openList[group.key]) ?? group.lists[0];

  const selectGroup = (key: ReferenceGroupKey) => {
    router.replace(key === REFERENCE_GROUPS[0].key ? pathname : `${pathname}?${GROUP_PARAM}=${key}`, { scroll: false });
  };

  const idPrefix = `reference-${group.key}`;

  return (
    <div className="space-y-4">
      <header>
        <h1 data-testid="page-title" className="page-title">Reference data</h1>
        <p className="page-subtitle mt-1">{group.description}</p>
      </header>

      <SegmentedControl
        ariaLabel="Reference data group"
        value={group.key}
        onChange={selectGroup}
        options={REFERENCE_GROUPS.map((g) => ({ value: g.key, label: g.label }))}
      />

      <Tabs
        ariaLabel={`${group.label} lists`}
        idPrefix={idPrefix}
        value={list.key}
        onChange={(key) => setOpenList((current) => ({ ...current, [group.key]: key }))}
        tabs={group.lists.map((l) => ({ value: l.key, label: l.label, count: items[l.key].length }))}
      />

      <div role="tabpanel" id={tabPanelId(idPrefix, list.key)} aria-labelledby={tabId(idPrefix, list.key)}>
        <ReferenceListEditor
          key={list.key}
          label={list.label}
          singular={list.singular}
          items={items[list.key]}
          onChange={(next) => setItems((current) => ({ ...current, [list.key]: next }))}
        />
      </div>
    </div>
  );
}
