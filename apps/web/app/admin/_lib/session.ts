import { cookies } from 'next/headers';

import type { LoginResponse } from '@atmb/shared';

import { SERVER_API_BASE_URL } from '../../lib/api';

export async function getCurrentAdmin() {
  const cookieHeader = (await cookies()).toString();

  const response = await fetch(`${SERVER_API_BASE_URL}/api/admin/auth/me`, {
    cache: 'no-store',
    headers: cookieHeader
      ? {
          cookie: cookieHeader,
        }
      : undefined,
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as LoginResponse;
}
