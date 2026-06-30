import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Database,
  Home,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  buildResidentialAddressesPageUrl,
  getPublicResidentialAddressesPageData,
  parsePublicResidentialAddressFilters,
  type PublicResidentialAddressFilters,
} from '../_lib/public-residential-address-data';
import { getPublicHeadCode } from '../_lib/public-head-code';
import { AddressRowClickState } from '../_components/AddressRowClickState';
import { PublicHeadCode } from '../_components/PublicHeadCode';
import { SiteFooter, SiteHeader } from '../_components/SiteShell';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Anytime Mailbox 住宅地址 | 美国真实住宅地址筛选',
  description:
    '浏览全站筛选出的 RDI Residential 地址候选。支持关键词搜索和 CMRA 筛选，帮助中文用户快速查找更接近美国真实住宅用途的 Anytime Mailbox 地址。',
  alternates: {
    canonical: '/residential-addresses',
  },
  keywords: [
    'Anytime Mailbox住宅地址',
    '美国真实住宅地址',
    'Residential地址',
    'RDI Residential',
    'CMRA',
    'Smarty地址验证',
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
    text: 'CMRA 可选择全部、Yes 或 No，用于区分是否可能与商业邮件接收代理相关，帮助用户进一步缩小住宅地址候选。',
    icon: ShieldCheck,
  },
  {
    title: 'RDI Residential 固定前提',
    text: '本页结果默认已经满足 RDI Residential。是否适合租用仍需进入详情页结合 CMRA、街景、价格和用途判断。',
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
    answer: '通常更值得优先查看，但仍需结合街景、用途、价格和风险判断。',
  },
  {
    question: 'RDI Residential 是否保证一定可用？',
    answer: '不保证。RDI Residential 只是 Smarty 返回的辅助字段，不构成地址可用承诺。',
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
  const [headCode, data] = await Promise.all([
    getPublicHeadCode(),
    getPublicResidentialAddressesPageData(filters),
  ]);
  const paginationItems = getPaginationItems(data.page, data.totalPages);

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
                <p className="site-eyebrow">住宅地址筛选入口 · 支持关键词与 CMRA 筛选</p>
                <h1>Anytime Mailbox 住宅地址</h1>
                <p className="addresses-hero-copy">
                  浏览全站筛选出的 RDI Residential 地址候选。你可以用关键词查找城市、州、ZIP 或街道，
                  并通过 CMRA 过滤地址类型，再进入详情页查看街景跳转、价格、邮箱编号范围和每日监控变化。
                </p>
                <div className="addresses-proof-list" aria-label="页面能力">
                  <span><span><Check size={15} aria-hidden="true" /></span>关键词搜索</span>
                  <span><span><Check size={15} aria-hidden="true" /></span>固定 RDI Residential</span>
                  <span><span><Check size={15} aria-hidden="true" /></span>CMRA 筛选</span>
                  <span><span><Check size={15} aria-hidden="true" /></span>每日监控更新</span>
                </div>
              </div>
              <aside className="addresses-stat-panel" aria-label="住宅地址概览">
                <h2>住宅地址概览</h2>
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
            <button type="submit">
              <Search size={18} aria-hidden="true" />
              搜索地址
            </button>
          </form>

          <div className="addresses-search-note">
            <span><Home size={16} aria-hidden="true" />本页仅展示 <strong>RDI Residential</strong> 地址候选</span>
            <span><ShieldCheck size={16} aria-hidden="true" /><strong>CMRA</strong> 来源于 Smarty 地址验证结果</span>
            <span><RefreshCw size={16} aria-hidden="true" />地址、价格与邮箱编号范围每日监控更新</span>
          </div>
        </section>

        <section className="addresses-inner addresses-section" aria-labelledby="residential-list-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="residential-list-title">住宅地址列表</h2>
              <p>结果列表默认只展示 RDI Residential 地址，同时给出 CMRA、价格和邮箱编号范围，方便进入详情页进一步判断。</p>
            </div>
            <span className="addresses-update-pill">
              <Database size={18} aria-hidden="true" />
              显示 {data.start}-{data.end} / {formatNumber(data.total)}
            </span>
          </div>

          <div className="addresses-result-panel">
            <div className="addresses-result-toolbar">
              <div className="addresses-result-count">
                找到 <strong>{formatNumber(data.total)}</strong> 个 RDI Residential 地址
              </div>
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
                <p>可以减少关键词，或清除 CMRA 筛选后重新搜索。</p>
                <div className="addresses-empty-actions">
                  <Link href={buildResidentialAddressesPageUrl(filters, { q: '', cmra: '', page: 1 })}>
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
        </section>

        <section className="addresses-inner addresses-section" aria-labelledby="residential-seo-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="residential-seo-title">如何使用住宅地址页面筛选美国住宅地址？</h2>
              <p>这个页面面向 Residential 地址浏览场景：先用关键词找到城市、ZIP 或街道，再用 CMRA 判断是否接近你的使用需求。</p>
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
