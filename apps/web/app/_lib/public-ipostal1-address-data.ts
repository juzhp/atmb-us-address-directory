import {
  buildAddressesPageUrl,
  getPublicAddressesPageData,
  type PublicAddressesPageData,
  type PublicAddressFilters,
} from './public-address-data';

export { parsePublicAddressFilters } from './public-address-data';

export const PUBLIC_IPOSTAL1_BASE_PATH = '/ipostal1';

export async function getPublicIpostal1AddressesPageData(filters: PublicAddressFilters): Promise<PublicAddressesPageData> {
  return getPublicAddressesPageData(filters, 'ipostal1');
}

export function buildIpostal1AddressesPageUrl(
  filters: PublicAddressFilters,
  overrides: Partial<PublicAddressFilters> = {},
) {
  return buildAddressesPageUrl(filters, overrides, PUBLIC_IPOSTAL1_BASE_PATH);
}
