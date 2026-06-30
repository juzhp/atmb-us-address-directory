import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ScrollBackTop } from './_components/ScrollBackTop';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://usaddres.com'),
  title: 'Anytime Mailbox住宅地址指南',
  description: '筛选 Anytime Mailbox(ATMB) 美国真实私人住宅地址：RDI/CMRA、街景、价格一站筛查，适合美国信用卡与银行开户。',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/assets/favicon.svg', type: 'image/svg+xml' },
      { url: '/assets/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/assets/favicon-256.png', sizes: '256x256', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <ScrollBackTop />
      </body>
    </html>
  );
}
