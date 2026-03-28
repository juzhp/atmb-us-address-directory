import { buildLocationHref, fetchAllPublicLocations, fetchStates } from "../lib/api.js";
import { enrichStates } from "../lib/states.js";
import { getSiteUrl } from "../lib/site.js";

export default async function sitemap() {
  const siteUrl = getSiteUrl();
  const [rawStates, locations] = await Promise.all([fetchStates(), fetchAllLocations()]);
  const states = enrichStates(rawStates);
  const now = new Date();

  const entries = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: `${siteUrl}/residential-addresses`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9
    },
    ...states.map((item) => ({
      url: `${siteUrl}/states/${item.slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85
    })),
    ...locations.map((item) => ({
      url: `${siteUrl}${buildLocationHref(item)}`,
      lastModified: item.updated_at || item.updatedAt || item.last_seen_at || item.lastSeenAt || now,
      changeFrequency: "weekly",
      priority: 0.7
    }))
  ];

  return entries;
}

async function fetchAllLocations() {
  return fetchAllPublicLocations();
}
