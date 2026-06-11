import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentAdmin } from './_lib/session';

export const metadata: Metadata = {
  title: '后台入口 | ATMB 地址筛选后台',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminEntryPage() {
  const session = await getCurrentAdmin();

  if (session) {
    redirect('/admin/addresses');
  }

  redirect('/admin/login');
}
