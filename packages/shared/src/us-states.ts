export interface UsStateDisplay {
  code: string;
  name: string;
  zhName: string;
  slug: string;
  label: string;
  searchText: string;
}

const US_STATE_DATA = [
  ['AL', 'Alabama', '阿拉巴马州', 'alabama'],
  ['AK', 'Alaska', '阿拉斯加州', 'alaska'],
  ['AZ', 'Arizona', '亚利桑那州', 'arizona'],
  ['AR', 'Arkansas', '阿肯色州', 'arkansas'],
  ['CA', 'California', '加利福尼亚州', 'california'],
  ['CO', 'Colorado', '科罗拉多州', 'colorado'],
  ['CT', 'Connecticut', '康涅狄格州', 'connecticut'],
  ['DC', 'DC', '华盛顿哥伦比亚特区', 'dc'],
  ['DE', 'Delaware', '特拉华州', 'delaware'],
  ['FL', 'Florida', '佛罗里达州', 'florida'],
  ['GA', 'Georgia', '佐治亚州', 'georgia'],
  ['HI', 'Hawaii', '夏威夷州', 'hawaii'],
  ['ID', 'Idaho', '爱达荷州', 'idaho'],
  ['IL', 'Illinois', '伊利诺伊州', 'illinois'],
  ['IN', 'Indiana', '印第安纳州', 'indiana'],
  ['IA', 'Iowa', '爱荷华州', 'iowa'],
  ['KS', 'Kansas', '堪萨斯州', 'kansas'],
  ['KY', 'Kentucky', '肯塔基州', 'kentucky'],
  ['LA', 'Louisiana', '路易斯安那州', 'louisiana'],
  ['ME', 'Maine', '缅因州', 'maine'],
  ['MD', 'Maryland', '马里兰州', 'maryland'],
  ['MA', 'Massachusetts', '马萨诸塞州', 'massachusetts'],
  ['MI', 'Michigan', '密歇根州', 'michigan'],
  ['MN', 'Minnesota', '明尼苏达州', 'minnesota'],
  ['MS', 'Mississippi', '密西西比州', 'mississippi'],
  ['MO', 'Missouri', '密苏里州', 'missouri'],
  ['MT', 'Montana', '蒙大拿州', 'montana'],
  ['NE', 'Nebraska', '内布拉斯加州', 'nebraska'],
  ['NV', 'Nevada', '内华达州', 'nevada'],
  ['NH', 'New Hampshire', '新罕布什尔州', 'new-hampshire'],
  ['NJ', 'New Jersey', '新泽西州', 'new-jersey'],
  ['NM', 'New Mexico', '新墨西哥州', 'new-mexico'],
  ['NY', 'New York', '纽约州', 'new-york'],
  ['NC', 'North Carolina', '北卡罗来纳州', 'north-carolina'],
  ['ND', 'North Dakota', '北达科他州', 'north-dakota'],
  ['OH', 'Ohio', '俄亥俄州', 'ohio'],
  ['OK', 'Oklahoma', '俄克拉荷马州', 'oklahoma'],
  ['OR', 'Oregon', '俄勒冈州', 'oregon'],
  ['PA', 'Pennsylvania', '宾夕法尼亚州', 'pennsylvania'],
  ['PR', 'Puerto Rico', '波多黎各', 'puerto-rico'],
  ['RI', 'Rhode Island', '罗得岛州', 'rhode-island'],
  ['SC', 'South Carolina', '南卡罗来纳州', 'south-carolina'],
  ['SD', 'South Dakota', '南达科他州', 'south-dakota'],
  ['TN', 'Tennessee', '田纳西州', 'tennessee'],
  ['TX', 'Texas', '德克萨斯州', 'texas'],
  ['UT', 'Utah', '犹他州', 'utah'],
  ['VT', 'Vermont', '佛蒙特州', 'vermont'],
  ['VA', 'Virginia', '弗吉尼亚州', 'virginia'],
  ['WA', 'Washington', '华盛顿州', 'washington'],
  ['WV', 'West Virginia', '西弗吉尼亚州', 'west-virginia'],
  ['WI', 'Wisconsin', '威斯康星州', 'wisconsin'],
  ['WY', 'Wyoming', '怀俄明州', 'wyoming'],
] as const;

const US_STATE_ALIASES: Partial<Record<(typeof US_STATE_DATA)[number][0], string[]>> = {
  CA: ['加州'],
  FL: ['佛州'],
  NY: ['纽约'],
  TX: ['德州', '得州'],
  WA: ['华州'],
};

export const US_STATES: UsStateDisplay[] = US_STATE_DATA.map(([code, name, zhName, slug]) => ({
  code,
  name,
  zhName,
  slug,
  label: `${zhName} ${name} (${code})`,
  searchText: `${zhName} ${name} ${code} ${(US_STATE_ALIASES[code] ?? []).join(' ')}`.trim(),
}));

const STATE_BY_CODE = new Map(US_STATES.map((state) => [state.code, state]));

export function getUsStateDisplay(code: string, fallbackName?: string): UsStateDisplay {
  const normalizedCode = code.trim().toUpperCase();
  const mapped = STATE_BY_CODE.get(normalizedCode);

  if (mapped) {
    return mapped;
  }

  const name = fallbackName?.trim() || normalizedCode;

  return {
    code: normalizedCode,
    name,
    zhName: name,
    slug: normalizedCode.toLowerCase(),
    label: `${name} (${normalizedCode})`,
    searchText: `${name} ${normalizedCode}`,
  };
}
