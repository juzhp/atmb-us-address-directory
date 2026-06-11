import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminShell } from '../_components/AdminShell';
import { TaskManagement } from '../_components/TaskManagement';
import { getCurrentAdmin } from '../_lib/session';

export const metadata: Metadata = {
  title: '任务管理 | ATMB 地址筛选后台',
  robots: { index: false, follow: false },
};

export default async function AdminTasksPage() {
  const session = await getCurrentAdmin();

  if (!session) redirect('/admin/login');

  return (
    <AdminShell user={session.user}>
      <TaskManagement />
    </AdminShell>
  );
}
