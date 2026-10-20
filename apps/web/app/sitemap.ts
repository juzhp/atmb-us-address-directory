import type { MetadataRoute } from 'next';
import type { AddressSource } from '@atmb/shared';

import { getPublicAddressesLastUpdated } from './_lib/public-address-data';
import { publicRoutes, SITE_URL } from './_lib/site-routes';

export const revalidate = 3600;

type PublicRoutePath = (typeof publicRoutes)[number]['path'];

// 列表类页面的 lastModified 取对应平台地址的最近更新时间；内容页写死最后一次实质修改的日期，改内容时同步更新
const routeLastModified: Record<PublicRoutePath, AddressSource | string> = {
  '/': 'anytimemailbox',
  '/addresses': 'anytimemailbox',
  '/residential-addresses': 'anytimemailbox',
  '/ipostal1': 'ipostal1',
  '/guide/anytime-mailbox-tutorial': '2026-09-16',
  '/guide/usps-form-1583': '2026-09-16',
  '/guide/us-residential-address-verification': '2026-09-16',
  '/guide/us-credit-card-address': '2026-10-20',
};

function isAddressSource(value: AddressSource | string): value is AddressSource {
  return value === 'anytimemailbox' || value === 'ipostal1';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const route of publicRoutes) {
    const source = routeLastModified[route.path];
    const lastModified = isAddressSource(source)
      ? ((await getPublicAddressesLastUpdated(source)) ?? undefined)
      : new Date(source);

    entries.push({
      url: `${SITE_URL}${route.path === '/' ? '/' : route.path}`,
      lastModified,
      changeFrequency: 'daily',
      priority: route.priority,
    });
  }

  return entries;
}
