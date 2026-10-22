import type { PublicAddressesPageData } from './public-address-data';
import {
  buildResidentialAddressesPageUrl,
  getPublicResidentialAddressesPageData,
  type PublicResidentialAddressFilters,
} from './public-residential-address-data';

export { parsePublicResidentialAddressFilters, PUBLIC_RESIDENTIAL_RESULT_HASH } from './public-residential-address-data';
export type { PublicResidentialAddressFilters } from './public-residential-address-data';

export const PUBLIC_IPOSTAL1_RESIDENTIAL_BASE_PATH = '/ipostal1-residential-addresses';

export async function getPublicIpostal1ResidentialAddressesPageData(
  filters: PublicResidentialAddressFilters,
): Promise<PublicAddressesPageData> {
  return getPublicResidentialAddressesPageData(filters, 'ipostal1');
}

export function buildIpostal1ResidentialAddressesPageUrl(
  filters: PublicResidentialAddressFilters,
  overrides: Partial<PublicResidentialAddressFilters> = {},
) {
  return buildResidentialAddressesPageUrl(filters, overrides, PUBLIC_IPOSTAL1_RESIDENTIAL_BASE_PATH);
}
