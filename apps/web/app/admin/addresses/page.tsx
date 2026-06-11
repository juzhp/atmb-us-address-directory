import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AddressManagement } from '../_components/AddressManagement';
import { AdminShell } from '../_components/AdminShell';
import { getCurrentAdmin } from '../_lib/session';

export const metadata: Metadata = {
  title: '地址管理 | Anytime Mailbox住宅地址指南',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminAddressesPage() {
  const session = await getCurrentAdmin();

  if (!session) {
    redirect('/admin/login');
  }

  return (
    <AdminShell user={session.user}>
      <AddressManagement />
    </AdminShell>
  );
}
