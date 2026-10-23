import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminShell } from '../_components/AdminShell';
import { BlacklistManagement } from '../_components/BlacklistManagement';
import { getCurrentAdmin } from '../_lib/session';

export const metadata: Metadata = {
  title: '地址黑名单 | Anytime Mailbox住宅地址指南',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminBlacklistPage() {
  const session = await getCurrentAdmin();

  if (!session) {
    redirect('/admin/login');
  }

  return (
    <AdminShell user={session.user}>
      <BlacklistManagement />
    </AdminShell>
  );
}
