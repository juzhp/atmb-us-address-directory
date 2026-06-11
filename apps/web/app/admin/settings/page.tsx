import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminShell } from '../_components/AdminShell';
import { SystemSettings } from '../_components/SystemSettings';
import { getCurrentAdmin } from '../_lib/session';

export const metadata: Metadata = {
  title: '系统设置 | ATMB 地址筛选后台',
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const session = await getCurrentAdmin();

  if (!session) redirect('/admin/login');

  return (
    <AdminShell user={session.user}>
      <SystemSettings />
    </AdminShell>
  );
}
