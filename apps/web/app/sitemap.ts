import type { MetadataRoute } from 'next';

const SITE_URL = 'https://usaddres.com';

const publicRoutes = [
  { path: '/', priority: 1 },
  { path: '/addresses', priority: 0.9 },
  { path: '/residential-addresses', priority: 0.9 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${SITE_URL}${route.path === '/' ? '/' : route.path}`,
    lastModified,
    changeFrequency: 'daily',
    priority: route.priority,
  }));
}
