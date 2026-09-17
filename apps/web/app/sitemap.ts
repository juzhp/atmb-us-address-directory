import type { MetadataRoute } from 'next';

import { publicRoutes, SITE_URL } from './_lib/site-routes';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${SITE_URL}${route.path === '/' ? '/' : route.path}`,
    lastModified,
    changeFrequency: 'daily',
    priority: route.priority,
  }));
}
