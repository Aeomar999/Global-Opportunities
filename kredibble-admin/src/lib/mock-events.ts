/**
 * Mock data for Events operations.
 * kredibble-app's events/booking.tsx has no real capacity field today (the
 * "Sales end in 7 hours" urgency banner is hardcoded) — this models what
 * admin-side capacity management would look like.
 */

export type EventStatus = 'upcoming' | 'past' | 'cancelled';

export interface EventRecord {
  id: string;
  title: string;
  hirer: string;
  location: string;
  dateTime: string;
  capacity: number;
  attendeesCount: number;
  status: EventStatus;
}

export const eventRecords: EventRecord[] = [
  {
    id: 'event-1',
    title: 'Founders & Funders Demo Night',
    hirer: 'Ashesi Ventures',
    location: 'Berekuso, Ghana',
    dateTime: '2 Aug 2026, 6:00 PM GMT',
    capacity: 150,
    attendeesCount: 46,
    status: 'upcoming',
  },
  {
    id: 'event-2',
    title: 'Google Career Fair — West Africa',
    hirer: 'Google LLC',
    location: 'Accra, Ghana',
    dateTime: '20 Aug 2026, 10:00 AM GMT',
    capacity: 400,
    attendeesCount: 312,
    status: 'upcoming',
  },
  {
    id: 'event-3',
    title: 'Kanzu Code Hackathon 2026',
    hirer: 'Kanzu Code',
    location: 'Kampala, Uganda',
    dateTime: '5 Jun 2026, 9:00 AM GMT',
    capacity: 80,
    attendeesCount: 80,
    status: 'past',
  },
];
