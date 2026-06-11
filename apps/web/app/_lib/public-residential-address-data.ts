import {
  getPublicAddressesPageData,
  type PublicAddressesPageData,
  type PublicAddressFilters,
} from './public-address-data';

export const PUBLIC_RESIDENTIAL_RESULT_HASH = '#residential-list-title';

export interface PublicResidentialAddressFilters {
  q: string;
  cmra: string;
  page: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

export async function getPublicResidentialAddressesPageData(
  filters: PublicResidentialAddressFilters,
): Promise<PublicAddressesPageData> {
  return getPublicAddressesPageData(toAddressFilters(filters));
}

export function parsePublicResidentialAddressFilters(
  searchParams: SearchParams = {},
): PublicResidentialAddressFilters {
  return {
    q: normalizeKeyword(firstParam(searchParams.q)),
    cmra: normalizeEnumParam(firstParam(searchParams.cmra), ['Yes', 'No', 'none']),
    page: normalizePage(firstParam(searchParams.page)),
  };
}

export function buildResidentialAddressesPageUrl(
  filters: PublicResidentialAddressFilters,
  overrides: Partial<PublicResidentialAddressFilters> = {},
) {
  const nextFilters: PublicResidentialAddressFilters = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (nextFilters.q) params.set('q', nextFilters.q);
  if (nextFilters.cmra) params.set('cmra', nextFilters.cmra);
  if (nextFilters.page > 1) params.set('page', String(nextFilters.page));

  const query = params.toString();
  return `${query ? `/residential-addresses?${query}` : '/residential-addresses'}${PUBLIC_RESIDENTIAL_RESULT_HASH}`;
}

function toAddressFilters(filters: PublicResidentialAddressFilters): PublicAddressFilters {
  return {
    q: filters.q,
    state: '',
    rdi: 'Residential',
    cmra: filters.cmra,
    price: '',
    page: filters.page,
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeKeyword(value: string | undefined) {
  return value?.trim().slice(0, 80) ?? '';
}

function normalizeEnumParam(value: string | undefined, allowedValues: string[]) {
  const normalized = value?.trim() ?? '';
  return allowedValues.includes(normalized) ? normalized : '';
}

function normalizePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}
