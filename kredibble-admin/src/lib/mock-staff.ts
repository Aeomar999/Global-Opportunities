import { BRAND_EMAIL_DOMAIN } from '@/config/brand';
import { formatDate } from '@/lib/format';

export type StaffRole = 'Super Admin' | 'Moderator' | 'Support';
export type StaffStatus = 'active' | 'suspended';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  joinedDate: string;
}

const initialStaff: StaffMember[] = [
  {
    id: 'staff-1',
    name: 'Nana Adjei',
    email: `nana.adjei@${BRAND_EMAIL_DOMAIN}`,
    role: 'Super Admin',
    status: 'active',
    joinedDate: '1 Jan 2026',
  },
  {
    id: 'staff-2',
    name: 'Efua Mensimah',
    email: `efua.mensimah@${BRAND_EMAIL_DOMAIN}`,
    role: 'Moderator',
    status: 'active',
    joinedDate: '15 Mar 2026',
  },
  {
    id: 'staff-3',
    name: 'Yaw Antwi',
    email: `yaw.antwi@${BRAND_EMAIL_DOMAIN}`,
    role: 'Support',
    status: 'active',
    joinedDate: '2 Jun 2026',
  },
];

class StaffStateStore {
  members: StaffMember[] = [...initialStaff];

  private listeners: (() => void)[] = [];

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((l) => l());
  }

  invite(name: string, email: string, role: StaffRole) {
    const member: StaffMember = {
      id: `staff-${Date.now()}`,
      name,
      email,
      role,
      status: 'active',
      joinedDate: formatDate(new Date()),
    };
    this.members = [...this.members, member];
    this.notify();
  }

  updateRole(id: string, role: StaffRole) {
    this.members = this.members.map((m) => (m.id === id ? { ...m, role } : m));
    this.notify();
  }

  toggleStatus(id: string) {
    this.members = this.members.map((m) =>
      m.id === id ? { ...m, status: m.status === 'active' ? 'suspended' : 'active' } : m
    );
    this.notify();
  }
}

export const staffStore = new StaffStateStore();
