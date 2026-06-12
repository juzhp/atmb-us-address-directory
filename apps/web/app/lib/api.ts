function normalizeApiBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
}

export const PUBLIC_API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ?? '';

export const SERVER_API_BASE_URL =
  normalizeApiBaseUrl(process.env.API_BASE_URL)
  ?? normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL)
  ?? 'http://127.0.0.1:3001';
