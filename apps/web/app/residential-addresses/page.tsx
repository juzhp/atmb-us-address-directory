import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CreditCard,
  Database,
  Home,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { C1_PRECHECK_LABELS, type AddressC1Precheck } from '@atmb/shared';

import type { PublicAddressesPageData } from '../_lib/public-address-data';
import {
  buildResidentialAddressesPageUrl,
  getPublicResidentialAddressesPageData,
  parsePublicResidentialAddressFilters,
  type PublicResidentialAddressFilters,
} from '../_lib/public-residential-address-data';
import { getPublicHeadCode } from '../_lib/public-head-code';
import { ActiveFilterChips, type ActiveFilterChip } from '../_components/ActiveFilterChips';
import { AddressRowClickState } from '../_components/AddressRowClickState';
import { PublicHeadCode } from '../_components/PublicHeadCode';
import { SiteFooter, SiteHeader } from '../_components/SiteShell';
import { StateFilterPanel, StateFilterPanelSkeleton } from '../_components/StateFilterPanel';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '美国真实住宅地址（RDI Residential）| Anytime Mailbox 私人地址精选',
  description:
    '已默认过滤 RDI = Residential 的 Anytime Mailbox(ATMB) 美国住宅地址候选，再用州、CMRA、USPS CMRA、C1 预审（Capital One 地址预审核）与关键词二次筛选，帮你更快找到接近真实私人住宅、适合美国信用卡与银行开户的地址。',
  alternates: {
    canonical: '/residential-addresses',
  },
  keywords: [
    'Anytime Mailbox住宅地址',
    'ATMB',
    'anytimemailbox',
    '美国真实住宅地址',
    '美国私人住宅地址',
    'Residential地址',
    'RDI Residential',
    'CMRA',
    'USPS CMRA',
    'C1 预审',
    'Capital One 地址预审',
    '美国信用卡地址',
    '美国住宅地址租用',
  ],
};

const seoCards = [
  {
    title: '关键词快速定位地址',
    text: '可以输入城市、州、ZIP、街道或地址名称，快速找到更接近目标地区的住宅地址候选。',
    icon: Search,
  },
  {
    title: 'CMRA 快速过滤候选',
    text: 'CMRA 可选择全部、Yes 或 No，用于区分是否可能与商业邮件接收代理相关，帮助用户进一步缩小住宅地址候选；USPS CMRA 可作为第二重参照。',
    icon: ShieldCheck,
  },
  {
    title: 'RDI Residential 固定前提',
    text: '本页结果默认已经满足 RDI Residential。是否适合租用仍需进入详情页结合 CMRA、USPS CMRA、C1 预审、街景、价格和用途判断。',
    icon: Home,
  },
];

const faqs = [
  {
    question: '住宅地址页面和所有地址页面有什么区别？',
    answer: '住宅地址页面只展示 RDI Residential 地址候选；所有地址页面会包含 Residential 和 Commercial。',
  },
  {
    question: '关键词搜索会搜索哪些字段？',
    answer: '城市、州、ZIP、街道、地址名称和页面中可索引的地址文本。',
  },
  {
    question: 'CMRA = No 是否更适合住宅地址筛选？',
    answer: '通常更值得优先查看，但仍需结合 USPS CMRA、C1 预审、街景、用途、价格和风险判断。',
  },
  {
    question: 'RDI Residential 是否保证一定可用？',
    answer: '不保证。RDI Residential 只是 Smarty 返回的辅助字段，不构成地址可用承诺。',
  },
  {
    question: 'C1 预审通过代表什么？',
    answer: 'C1 预审是 Capital One 地址预审核。通过表示该地址可以用来提交 Capital One 申请，不通过表示提交时会被拦下。它只反映地址能否提交，不代表申请一定获批，也不代表其它银行或发卡方的结果。',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

interface ResidentialAddressesPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResidentialAddressesPage({ searchParams }: ResidentialAddressesPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = parsePublicResidentialAddressFilters(params);
  const dataPromise = getPublicResidentialAddressesPageData(filters);
  const headCode = await getPublicHeadCode();

  return (
    <>
      <PublicHeadCode headCode={headCode} />
      <SiteHeader active="residential" />
      <main className="site-main addresses-page residential-page">
        <section className="addresses-hero">
          <div className="addresses-inner">
            <nav className="addresses-breadcrumb" aria-label="面包屑">
              <Link href="/">首页</Link>
              <span>/</span>
              <strong>住宅地址</strong>
            </nav>
            <div className="addresses-hero-grid">
              <div>
                <p className="site-eyebrow">住宅地址筛选入口 · 支持关键词、州、CMRA、USPS CMRA 与 C1 预审筛选</p>
                <h1>Anytime Mailbox 住宅地址</h1>
                <p className="addresses-hero-copy">
                  浏览全站筛选出的 RDI Residential 地址候选。你可以用关键词查找城市、州、ZIP 或街道，
                  并通过州筛选、CMRA、USPS CMRA 与 C1 预审（Capital One 地址预审核）过滤地址类型，再进入详情页查看街景跳转、价格、邮箱编号范围和每日监控变化。
                </p>
                <div className="addresses-proof-list" aria-label="页面能力">
                  <span><span><Check size={15} aria-hidden="true" /></span>关键词搜索</span>
                  <span><span><Check size={15} aria-hidden="true" /></span>固定 RDI Residential</span>
                  <span><span><Check size={15} aria-hidden="true" /></span>州 / CMRA / USPS CMRA 筛选</span>
                  <span><span><Check size={15} aria-hidden="true" /></span>C1 预审筛选</span>
                </div>
              </div>
              <aside className="addresses-stat-panel" aria-label="住宅地址概览">
                <h2>住宅地址概览</h2>
                <Suspense fallback={<ResidentialStatsFallback />}>
                  <ResidentialStats dataPromise={dataPromise} />
                </Suspense>
              </aside>
            </div>
          </div>
        </section>

        <section className="addresses-inner addresses-search-panel" aria-labelledby="residential-search-title">
          <h2 className="home-visually-hidden" id="residential-search-title">搜索和筛选住宅地址</h2>
          <form
            className="addresses-search-form residential-search-form"
            action="/residential-addresses#residential-list-title"
            method="get"
          >
            <input name="state" type="hidden" value={filters.state} />
            <label className="addresses-keyword-field">
              <span>关键词搜索</span>
              <div className="addresses-input-like">
                <Search size={18} aria-hidden="true" />
                <input
                  name="q"
                  placeholder="城市、州、ZIP、街道或地址关键词"
                  defaultValue={filters.q}
                />
              </div>
            </label>
            <label>
              <span>CMRA</span>
              <select name="cmra" defaultValue={filters.cmra}>
                <option value="">全部</option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
                <option value="none">无</option>
              </select>
            </label>
            <label>
              <span>USPS CMRA</span>
              <select name="usps" defaultValue={filters.usps}>
                <option value="">全部</option>
                <option value="Y">Y</option>
                <option value="N">N</option>
              </select>
            </label>
            <label>
              <span>C1 预审</span>
              <select name="c1" defaultValue={filters.c1}>
                <option value="">全部</option>
                <option value="pass">通过</option>
                <option value="fail">不通过</option>
              </select>
            </label>
            <button type="submit">
              <Search size={18} aria-hidden="true" />
              搜索地址
            </button>
          </form>

          <Suspense fallback={<StateFilterPanelSkeleton />}>
            <ResidentialStateFilter dataPromise={dataPromise} filters={filters} />
          </Suspense>

          <div className="addresses-search-note">
            <span><Home size={16} aria-hidden="true" />本页仅展示 <strong>RDI Residential</strong> 地址候选</span>
            <span><ShieldCheck size={16} aria-hidden="true" /><strong>CMRA</strong> 来源于 Smarty 地址验证结果</span>
            <span><RefreshCw size={16} aria-hidden="true" />地址、价格与邮箱编号范围每日监控更新</span>
            <span><CreditCard size={16} aria-hidden="true" /><strong>USPS CMRA</strong> 与 <strong>C1 预审</strong> 支持筛选并在列表直接展示</span>
          </div>
        </section>

        <section className="addresses-inner addresses-section" aria-labelledby="residential-list-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="residential-list-title">住宅地址列表</h2>
              <p>结果列表默认只展示 RDI Residential 地址，同时给出 CMRA、USPS CMRA、C1 预审、价格和邮箱编号范围，方便进入详情页进一步判断。</p>
            </div>
            <Suspense fallback={null}>
              <ResidentialRangePill dataPromise={dataPromise} />
            </Suspense>
          </div>

          <div className="guide-callout addresses-list-notice" role="note">
            <strong>购买前请再手动核验一次。</strong>
            列表里的 RDI、CMRA、USPS CMRA 与 C1 预审都是辅助判断，各家数据库随时可能变化。下单前建议按
            <Link href="/guide/us-residential-address-verification">《美国住宅地址验证四步教程》</Link>
            自己再查一遍 Capital One 预审、Smarty、USPS 和街景。
          </div>

          <Suspense fallback={<ResidentialResultsSkeleton />}>
            <ResidentialResults dataPromise={dataPromise} filters={filters} />
          </Suspense>
        </section>

        <section className="addresses-inner addresses-section" aria-labelledby="residential-seo-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="residential-seo-title">如何使用住宅地址页面筛选美国住宅地址？</h2>
              <p>这个页面面向 Residential 地址浏览场景：先用关键词找到城市、ZIP 或街道，再用 CMRA、USPS CMRA 与 C1 预审判断是否接近你的使用需求。</p>
            </div>
          </div>
          <div className="addresses-seo-grid">
            {seoCards.map((card) => {
              const Icon = card.icon;
              return (
                <article className="addresses-seo-card" key={card.title}>
                  <span><Icon size={25} aria-hidden="true" /></span>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </article>
              );
            })}
          </div>
          <div className="guide-cta">
            <div>
              <strong>不确定某个地址能不能用？看四步核验教程</strong>
              <span>Capital One 地址预审、Smarty RDI/CMRA、USPS CMRA、Google 街景，附通过与被拒的截图样例。</span>
            </div>
            <Link href="/guide/us-residential-address-verification">
              查看地址验证教程
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="addresses-inner addresses-section" id="faq" aria-labelledby="residential-faq-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="residential-faq-title">住宅地址常见问题</h2>
            </div>
          </div>
          <div className="addresses-faq">
            {faqs.map((faq) => (
              <article key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  );
}

async function ResidentialStats({ dataPromise }: { dataPromise: Promise<PublicAddressesPageData> }) {
  const data = await dataPromise;

  return (
    <>
      <div>
        <span>住宅地址候选</span>
        <strong>{formatCompactCount(data.stats.residentialAddresses)}</strong>
      </div>
      <div>
        <span>RDI 类型</span>
        <strong>Residential</strong>
      </div>
      <div>
        <span>当前筛选</span>
        <strong>{formatCompactCount(data.total)}</strong>
      </div>
    </>
  );
}

function ResidentialStatsFallback() {
  return (
    <>
      <div>
        <span>住宅地址候选</span>
        <strong>…</strong>
      </div>
      <div>
        <span>RDI 类型</span>
        <strong>Residential</strong>
      </div>
      <div>
        <span>当前筛选</span>
        <strong>…</strong>
      </div>
    </>
  );
}

async function ResidentialStateFilter({
  dataPromise,
  filters,
}: {
  dataPromise: Promise<PublicAddressesPageData>;
  filters: PublicResidentialAddressFilters;
}) {
  const data = await dataPromise;

  return (
    <StateFilterPanel
      buildHref={(stateCode) => buildResidentialAddressesPageUrl(filters, { state: stateCode, page: 1 })}
      selectedState={filters.state}
      states={data.states}
    />
  );
}

async function ResidentialRangePill({ dataPromise }: { dataPromise: Promise<PublicAddressesPageData> }) {
  const data = await dataPromise;

  return (
    <span className="addresses-update-pill">
      <Database size={18} aria-hidden="true" />
      显示 {data.start}-{data.end} / {formatNumber(data.total)}
    </span>
  );
}

function ResidentialResultsSkeleton() {
  return (
    <div className="addresses-result-panel">
      <div className="addresses-skeleton" aria-busy="true" aria-live="polite" style={{ padding: 16 }}>
        <span className="home-visually-hidden">正在加载住宅地址列表…</span>
        {Array.from({ length: 8 }).map((_, index) => (
          <span className="addresses-skeleton-row" key={index} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}

async function ResidentialResults({
  dataPromise,
  filters,
}: {
  dataPromise: Promise<PublicAddressesPageData>;
  filters: PublicResidentialAddressFilters;
}) {
  const data = await dataPromise;
  const paginationItems = getPaginationItems(data.page, data.totalPages);
  const clearAllHref = buildResidentialAddressesPageUrl(filters, {
    q: '',
    state: '',
    cmra: '',
    usps: '',
    c1: '',
    page: 1,
  });
  const chips: ActiveFilterChip[] = [];

  if (filters.q) {
    chips.push({
      key: 'q',
      label: '关键词',
      value: filters.q,
      removeHref: buildResidentialAddressesPageUrl(filters, { q: '', page: 1 }),
    });
  }

  if (filters.state) {
    chips.push({
      key: 'state',
      label: '州',
      value: data.selectedStateLabel ?? filters.state,
      removeHref: buildResidentialAddressesPageUrl(filters, { state: '', page: 1 }),
    });
  }

  if (filters.cmra) {
    chips.push({
      key: 'cmra',
      label: 'CMRA',
      value: filters.cmra === 'none' ? '无' : filters.cmra,
      removeHref: buildResidentialAddressesPageUrl(filters, { cmra: '', page: 1 }),
    });
  }

  if (filters.usps) {
    chips.push({
      key: 'usps',
      label: 'USPS CMRA',
      value: filters.usps,
      removeHref: buildResidentialAddressesPageUrl(filters, { usps: '', page: 1 }),
    });
  }

  if (filters.c1) {
    chips.push({
      key: 'c1',
      label: 'C1 预审',
      value: C1_PRECHECK_LABELS[filters.c1 as AddressC1Precheck] ?? filters.c1,
      removeHref: buildResidentialAddressesPageUrl(filters, { c1: '', page: 1 }),
    });
  }

  return (
    <div className="addresses-result-panel">
      <div className="addresses-result-toolbar">
        <div className="addresses-result-count">
          找到 <strong>{formatNumber(data.total)}</strong> 个 RDI Residential 地址
        </div>
        <ActiveFilterChips chips={chips} clearAllHref={clearAllHref} />
      </div>
      {data.items.length > 0 ? (
        <div className="addresses-list" role="list">
          <AddressRowClickState />
          {data.items.map((address) => (
            <article className="addresses-row" data-address-row-id={address.id} key={address.id} role="listitem">
              <div className="addresses-main">
                <h3><a href={address.detailUrl} rel="noreferrer" target="_blank">{address.name}</a></h3>
                <p>{address.streetAddress}<br />{address.cityLine}</p>
              </div>
              <div className="addresses-data-cell"><strong>{address.stateLabel}</strong>州/地区</div>
              <div className="addresses-data-cell"><span className="addresses-badge good">{address.rdi}</span>RDI</div>
              <div className="addresses-data-cell">
                <span className={address.cmra === 'No' ? 'addresses-badge good' : 'addresses-badge warn'}>
                  {address.cmra}
                </span>
                CMRA
              </div>
              <div className="addresses-data-cell">
                <span
                  className={manualCheckBadgeClass(address.uspsCmra === 'N' ? 'good' : address.uspsCmra === 'Y' ? 'warn' : null)}
                  title={address.uspsCmraUpdatedAt ? `更新时间 ${address.uspsCmraUpdatedAt}` : undefined}
                >
                  {address.uspsCmraLabel}
                </span>
                USPS CMRA
              </div>
              <div className="addresses-data-cell">
                <span
                  className={manualCheckBadgeClass(address.c1Precheck === 'pass' ? 'good' : address.c1Precheck === 'fail' ? 'warn' : null)}
                  title={address.c1PrecheckUpdatedAt ? `更新时间 ${address.c1PrecheckUpdatedAt}` : undefined}
                >
                  {address.c1PrecheckLabel}
                </span>
                C1 预审
              </div>
              <div className="addresses-data-cell"><strong>{address.price}</strong>价格</div>
              <div className="addresses-data-cell"><strong>{address.mailbox}</strong>邮箱编号</div>
              <div className="addresses-row-actions">
                <a className="addresses-detail-button" href={address.detailUrl} rel="noreferrer" target="_blank">
                  查看详情
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
                <a className="addresses-photo-button" href={address.mapsUrl} rel="noreferrer" target="_blank">
                  <MapPin size={16} aria-hidden="true" />
                  查看照片
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="addresses-empty">
          <strong>没有找到匹配住宅地址</strong>
          <p>可以减少关键词，或清除州、CMRA、USPS CMRA 与 C1 预审筛选后重新搜索。</p>
          <div className="addresses-empty-actions">
            <Link href={clearAllHref}>
              <RefreshCw size={15} aria-hidden="true" />
              清除全部筛选
            </Link>
            <a href="#residential-search-title">
              <Search size={15} aria-hidden="true" />
              重新搜索
            </a>
          </div>
        </div>
      )}
      <nav className="addresses-pagination" aria-label="住宅地址列表分页">
        <span>第 {data.page} 页，共 {data.totalPages} 页</span>
        <div>
          {data.page > 1 ? (
            <Link href={buildResidentialAddressesPageUrl(filters, { page: data.page - 1 })}>上一页</Link>
          ) : (
            <span className="disabled">上一页</span>
          )}
          {paginationItems.map((item, index) => (
            item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`}>...</span>
            ) : (
              <Link
                className={item === data.page ? 'active' : undefined}
                href={buildResidentialAddressesPageUrl(filters, { page: item })}
                key={item}
              >
                {item}
              </Link>
            )
          ))}
          {data.page < data.totalPages ? (
            <Link href={buildResidentialAddressesPageUrl(filters, { page: data.page + 1 })}>下一页</Link>
          ) : (
            <span className="disabled">下一页</span>
          )}
        </div>
      </nav>
    </div>
  );
}

function getPaginationItems(currentPage: number, totalPages: number) {
  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const normalizedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const items: Array<number | 'ellipsis'> = [];

  normalizedPages.forEach((page) => {
    const previous = items[items.length - 1];

    if (typeof previous === 'number' && page - previous > 1) {
      items.push('ellipsis');
    }

    items.push(page);
  });

  return items;
}

function manualCheckBadgeClass(tone: 'good' | 'warn' | null) {
  return tone ? `addresses-badge ${tone}` : 'addresses-badge muted';
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCompactCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k+`;
  }

  return formatNumber(value);
}
