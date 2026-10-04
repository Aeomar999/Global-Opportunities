"use client";

/**
 * Events: capacity and attendance across all hirer-posted events.
 * Built on the shared list template; this file holds the column config and the data.
 * Data: mock events (src/lib/mock-events.ts), unchanged.
 */
import { CalendarDays } from "lucide-react";
import { eventRecords, type EventRecord } from "@/lib/mock-events";
import { overlayRows, subscribeMockStore } from "@/lib/mock-store";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import type { Column } from "@/components/list/types";

// Mock records with this session's changes (see mock-store.ts) laid over them.
const loadEvents = () => Promise.resolve(overlayRows("events", eventRecords));

const COLUMNS: Column<EventRecord>[] = [
  { key: "event", header: "Event", type: "primary", width: "28%", title: (r) => r.title, leading: () => ({ icon: CalendarDays }) },
  { key: "hirer", header: "Hirer", type: "text", width: "17%", value: (r) => r.hirer },
  { key: "date", header: "Date", type: "text", width: "13%", value: (r) => r.dateTime.split(",")[0] },
  {
    key: "attendance",
    header: "Attendance",
    type: "progress",
    width: "24%",
    label: (r) => `${r.attendeesCount}/${r.capacity}`,
    percent: (r) => Math.round((r.attendeesCount / r.capacity) * 100),
  },
  { key: "status", header: "Status", type: "status", width: "18%", status: (r) => r.status },
];

export default function EventsPage() {
  const { rows, isLoading, error, retry } = useListData(loadEvents, { subscribe: subscribeMockStore });

  return (
    <ListPage title="Events" subtitle="Capacity and attendance across all hirer-posted events.">
      <DataTable
        label="Events"
        columns={COLUMNS}
        rows={rows ?? []}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/events/${r.id}`}
        loading={isLoading}
        error={error}
        onRetry={retry}
        emptyNoData={{ icon: CalendarDays, title: "No events yet", description: "Events posted by hirers appear here." }}
        emptyNoResults={{ icon: CalendarDays, title: "No events match" }}
      />
    </ListPage>
  );
}
