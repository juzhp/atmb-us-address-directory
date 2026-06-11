import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Database,
  DollarSign,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  buildAddressesPageUrl,
  getPublicAddressesPageData,
  parsePublicAddressFilters,
  type PublicAddressFilters,
} from '../_lib/public-address-data';
import { getPublicHeadCode } from '../_lib/public-head-code';
import { AddressRowClickState } from '../_components/AddressRowClickState';
import { PublicHeadCode } from '../_components/PublicHeadCode';
import { SiteFooter, SiteHeader } from '../_components/SiteShell';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '所有 Anytime Mailbox 地址 | 美国住宅地址筛选',
  description:
    '浏览和搜索全站收录的 Anytime Mailbox 美国地址数据。支持关键词搜索、州筛选、RDI、CMRA 与价格筛选，帮助中文用户快速缩小美国真实住宅地址租用候选范围。',
  alternates: {
    canonical: '/addresses',
  },
  keywords: [
    'Anytime Mailbox 地址',
    '所有美国地址',
    '美国住宅地址筛选',
    '美国地址搜索',
    'RDI Residential',
    'CMRA',
    'Smarty 地址验证',
    '美国地址价格',
  ],
};

const seoCards = [
  {
    title: '关键词快速定位地址',
    text: '可以输入城市、州、ZIP、街道或地址名称，快速找到你想进一步查看的 Anytime Mailbox 地址候选。',
    icon: Search,
  },
  {
    title: '按州浏览更直观',
    text: '州列表可以帮助你先缩小地区范围，再结合 RDI、CMRA、价格和邮箱编号范围继续筛选。',
    icon: MapPin,
  },
  {
    title: 'RDI / CMRA 做辅助判断',
    text: 'RDI 和 CMRA 来自 Smarty，只用于缩小候选范围。是否适合租用还需要进入详情页结合街景、用途和风险判断。',
    icon: ShieldCheck,
  },
];

const faqs = [
  {
    question: '关键词搜索会搜索哪些字段？',
    answer: '城市、州、ZIP、街道、地址名称和页面中可索引的地址文本。',
  },
  {
    question: '州列表为什么要用可点击链接？',
    answer: '点击州名后可以直接查看该州的地址候选，比手动输入州名更快，也方便后续继续筛选。',
  },
  {
    question: '价格筛选是否代表地址质量？',
    answer: '不代表。价格只是初筛字段，仍需结合 RDI、CMRA、街景和用途判断。',
  },
  {
    question: 'RDI 和 CMRA 的数据来源是什么？',
    answer: '来自 Smarty 地址验证结果，仅作为辅助判断字段。',
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

interface AddressesPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AddressesPage({ searchParams }: AddressesPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = parsePublicAddressFilters(params);
  const [headCode, data] = await Promise.all([
    getPublicHeadCode(),
    getPublicAddressesPageData(filters),
  ]);
  const visibleStates = data.states.slice(0, 12);
  const hiddenStates = data.states.slice(12);
  const paginationItems = getPaginationItems(data.page, data.totalPages);

  return (
    <>
      <PublicHeadCode headCode={headCode} />
      <SiteHeader active="addresses" />
      <main className="site-main addresses-page">
        <section className="addresses-hero">
          <div className="addresses-inner">
            <nav className="addresses-breadcrumb" aria-label="面包屑">
              <Link href="/">首页</Link>
              <span>/</span>
              <strong>所有地址</strong>
            </nav>
            <div className="addresses-hero-grid">
              <div>
                <h1>所有 Anytime Mailbox 地址</h1>
                <p className="addresses-hero-copy">
                  浏览和搜索全站收录的 Anytime Mailbox 美国地址数据。你可以用关键词查找城市、州、ZIP 或街道，
                  也可以通过州筛选、RDI、CMRA 与价格区间快速缩小候选范围，再进入详情页查看街景跳转、邮箱编号范围和每日监控变化。
                </p>
                <div className="addresses-proof-list" aria-label="页面能力">
                  <span><span><Check size={15} aria-hidden="true" /></span>关键词搜索</span>
                  <span><span><Check size={15} aria-hidden="true" /></span>州筛选</span>
                  <span><span><Check size={15} aria-hidden="true" /></span>RDI / CMRA 筛选</span>
                  <span><span><Check size={15} aria-hidden="true" /></span>价格筛选</span>
                </div>
              </div>
              <aside className="addresses-stat-panel" aria-label="地址库概览">
                <h2>地址库概览</h2>
                <div>
                  <span>收录地址</span>
                  <strong>{formatCompactCount(data.stats.totalAddresses)}</strong>
                </div>
                <div>
                  <span>住宅地址</span>
                  <strong>{formatCompactCount(data.stats.residentialAddresses)}</strong>
                </div>
                <div>
                  <span>州与地区入口</span>
                  <strong>{data.stats.stateCount}</strong>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="addresses-inner addresses-search-panel" aria-labelledby="addresses-search-title">
          <h2 className="home-visually-hidden" id="addresses-search-title">搜索和筛选所有地址</h2>
          <form className="addresses-search-form" action="/addresses#address-list-title" method="get">
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
              <span>RDI 类型</span>
              <select name="rdi" defaultValue={filters.rdi}>
                <option value="">全部类型</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="none">无</option>
              </select>
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
              <span>价格</span>
              <select name="price" defaultValue={filters.price}>
                <option value="">全部价格</option>
                <option value="lt10">小于 US$ 10</option>
                <option value="lt20">小于 US$ 20</option>
                <option value="gte20">大于等于 US$ 20</option>
              </select>
            </label>
            <button type="submit">
              <Search size={18} aria-hidden="true" />
              搜索地址
            </button>
          </form>

          <div className="addresses-state-filter">
            <div className="addresses-state-head">
              <div>
                <h2>州筛选</h2>
                <p>州也是筛选条件，默认展示两行州入口，展开后查看全部州/地区。</p>
              </div>
              {filters.state ? (
                <Link className="addresses-clear-link" href={buildAddressesPageUrl(filters, { state: '', page: 1 })}>
                  清除州筛选
                </Link>
              ) : null}
            </div>
            <div className="addresses-state-grid">
              {visibleStates.map((state) => (
                <StateFilterLink filters={filters} key={state.code} state={state} />
              ))}
            </div>
            {hiddenStates.length > 0 ? (
              <details className="addresses-state-details">
                <summary>
                  展开全部 {data.states.length} 个州/地区
                  <ChevronDown size={17} aria-hidden="true" />
                </summary>
                <div className="addresses-state-grid addresses-state-grid-more">
                  {hiddenStates.map((state) => (
                    <StateFilterLink filters={filters} key={state.code} state={state} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <div className="addresses-search-note">
            <span><ShieldCheck size={16} aria-hidden="true" /><strong>RDI / CMRA</strong> 来源于 Smarty 地址验证结果</span>
            <span><DollarSign size={16} aria-hidden="true" />价格用于初筛，详情页仍需结合用途判断</span>
            <span><RefreshCw size={16} aria-hidden="true" />地址、价格与邮箱编号范围每日监控更新</span>
          </div>
        </section>

        <section className="addresses-inner addresses-section" aria-labelledby="address-list-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="address-list-title">全部地址列表</h2>
              <p>
                结果列表展示地址、RDI、CMRA、价格和邮箱编号范围，
                方便进入详情页进一步判断。
              </p>
            </div>
            <span className="addresses-update-pill">
              <Database size={18} aria-hidden="true" />
              显示 {data.start}-{data.end} / {formatNumber(data.total)}
            </span>
          </div>

          <div className="addresses-result-panel">
            <div className="addresses-result-toolbar">
              <div className="addresses-result-count">
                找到 <strong>{formatNumber(data.total)}</strong> 个 Anytime Mailbox 地址
                {data.selectedStateLabel ? <span> · {data.selectedStateLabel}</span> : null}
              </div>
              <div className="addresses-sort">排序：最近更新 <ChevronDown size={17} aria-hidden="true" /></div>
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
                    <div className="addresses-data-cell">
                      <span className={address.rdi === 'Residential' ? 'addresses-badge good' : 'addresses-badge warn'}>
                        {address.rdi}
                      </span>
                    </div>
                    <div className="addresses-data-cell">
                      <span className={address.cmra === 'No' ? 'addresses-badge good' : 'addresses-badge warn'}>
                        {address.cmra}
                      </span>
                    </div>
                    <div className="addresses-data-cell"><strong>{address.price}</strong></div>
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
                <strong>没有找到匹配地址</strong>
                <p>可以减少关键词，或清除 RDI、CMRA、价格和州筛选后重新搜索。</p>
              </div>
            )}
            <nav className="addresses-pagination" aria-label="地址列表分页">
              <span>第 {data.page} 页，共 {data.totalPages} 页</span>
              <div>
                {data.page > 1 ? (
                  <Link href={buildAddressesPageUrl(filters, { page: data.page - 1 })}>上一页</Link>
                ) : (
                  <span className="disabled">上一页</span>
                )}
                {paginationItems.map((item, index) => (
                  item === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`}>...</span>
                  ) : (
                    <Link
                      className={item === data.page ? 'active' : undefined}
                      href={buildAddressesPageUrl(filters, { page: item })}
                      key={item}
                    >
                      {item}
                    </Link>
                  )
                ))}
                {data.page < data.totalPages ? (
                  <Link href={buildAddressesPageUrl(filters, { page: data.page + 1 })}>下一页</Link>
                ) : (
                  <span className="disabled">下一页</span>
                )}
              </div>
            </nav>
          </div>
        </section>

        <section className="addresses-inner addresses-section" aria-labelledby="addresses-seo-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="addresses-seo-title">如何使用所有地址页面筛选美国住宅地址？</h2>
              <p>这个页面面向搜索和浏览场景：先用关键词或州入口找到地址，再用 RDI、CMRA 和价格做二次过滤。</p>
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
        </section>

        <section className="addresses-inner addresses-section" id="faq" aria-labelledby="addresses-faq-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="addresses-faq-title">所有地址常见问题</h2>
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

function StateFilterLink({
  filters,
  state,
}: {
  filters: PublicAddressFilters;
  state: { code: string; zhName: string; name: string; count: number };
}) {
  const isActive = filters.state === state.code;

  return (
    <Link
      className={isActive ? 'addresses-state-link active' : 'addresses-state-link'}
      href={buildAddressesPageUrl(filters, { state: state.code, page: 1 })}
    >
      <span className="addresses-state-name">
        {state.zhName}
        <small>{state.name} ({state.code})</small>
      </span>
      <span className="addresses-state-count">{state.count}</span>
    </Link>
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

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCompactCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k+`;
  }

  return formatNumber(value);
}
