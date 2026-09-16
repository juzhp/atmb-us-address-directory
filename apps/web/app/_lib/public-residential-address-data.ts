import {
  getPublicAddressesPageData,
  type PublicAddressesPageData,
  type PublicAddressFilters,
} from './public-address-data';

export const PUBLIC_RESIDENTIAL_RESULT_HASH = '#residential-list-title';

export interface PublicResidentialAddressFilters {
  q: string;
  state: string;
  cmra: string;
  usps: string;
  c1: string;
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
    state: normalizeState(firstParam(searchParams.state)),
    cmra: normalizeEnumParam(firstParam(searchParams.cmra), ['Yes', 'No', 'none']),
    usps: normalizeEnumParam(firstParam(searchParams.usps), ['Y', 'N']),
    c1: normalizeEnumParam(firstParam(searchParams.c1), ['pass', 'fail']),
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
  if (nextFilters.state) params.set('state', nextFilters.state);
  if (nextFilters.cmra) params.set('cmra', nextFilters.cmra);
  if (nextFilters.usps) params.set('usps', nextFilters.usps);
  if (nextFilters.c1) params.set('c1', nextFilters.c1);
  if (nextFilters.page > 1) params.set('page', String(nextFilters.page));

  const query = params.toString();
  return `${query ? `/residential-addresses?${query}` : '/residential-addresses'}${PUBLIC_RESIDENTIAL_RESULT_HASH}`;
}

function toAddressFilters(filters: PublicResidentialAddressFilters): PublicAddressFilters {
  return {
    q: filters.q,
    state: filters.state,
    rdi: 'Residential',
    cmra: filters.cmra,
    usps: filters.usps,
    c1: filters.c1,
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

function normalizeState(value: string | undefined) {
  const state = value?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(state) ? state : '';
}

function normalizeEnumParam(value: string | undefined, allowedValues: string[]) {
  const normalized = value?.trim() ?? '';
  return allowedValues.includes(normalized) ? normalized : '';
}

function normalizePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}
