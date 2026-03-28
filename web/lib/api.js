import { getServerApiOrigin } from "./server-origin.js";

export async function fetchPublicLocations(searchParams = {}) {
  const serverApiOrigin = await getServerApiOrigin();
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const response = await fetch(`${serverApiOrigin}/api/public/locations?${params.toString()}`, {
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error("Failed to load locations.");
  }

  return response.json();
}

export async function fetchPublicLocation(id) {
  const serverApiOrigin = await getServerApiOrigin();
  const response = await fetch(`${serverApiOrigin}/api/public/locations/${id}`, {
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function fetchPublicStats() {
  const serverApiOrigin = await getServerApiOrigin();
  const response = await fetch(`${serverApiOrigin}/api/public/stats`, {
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error("Failed to load stats.");
  }

  return response.json();
}

export async function fetchStates() {
  const serverApiOrigin = await getServerApiOrigin();
  const response = await fetch(`${serverApiOrigin}/api/public/states`, {
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error("Failed to load states.");
  }

  return response.json();
}

export async function fetchRecentStates(limit = 20) {
  const serverApiOrigin = await getServerApiOrigin();
  const response = await fetch(`${serverApiOrigin}/api/public/recent-states?limit=${limit}`, {
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error("Failed to load recent states.");
  }

  return response.json();
}

export async function fetchPublicLocationsByState(state) {
  return fetchPublicLocations({
    state,
    limit: 500,
    page: 1
  });
}

export function buildLocationHref(location) {
  return `/locations/${slugify(location.location_name || location.locationName)}-${location.id}`;
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractIdFromSlug(slug) {
  const match = String(slug || "").match(/-(\d+)$/);
  return match ? Number(match[1]) : Number.NaN;
}
