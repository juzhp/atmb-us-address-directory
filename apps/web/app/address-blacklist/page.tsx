import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  Database,
  ExternalLink,
  Flag,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';

import { buildPublicListCanonicalPath } from '../_lib/public-address-data';
import {
  buildBlacklistPageUrl,
  getPublicBlacklistPageData,
  parsePublicBlacklistFilters,
  PUBLIC_BLACKLIST_BASE_PATH,
  type PublicBlacklistFilters,
  type PublicBlacklistPageData,
} from '../_lib/public-blacklist-data';
import { getPublicHeadCode } from '../_lib/public-head-code';
import { ActiveFilterChips, type ActiveFilterChip } from '../_components/ActiveFilterChips';
import { BlacklistSubmitForm } from '../_components/BlacklistSubmitForm';
import { PublicHeadCode } from '../_components/PublicHeadCode';
import { SiteFooter, SiteHeader } from '../_components/SiteShell';

export const revalidate = 3600;

const listMetadata: Metadata = {
  title: '美国地址黑名单 | 被拒、不配合、丢件等问题地址查询与反馈',
  description:
    '收集用户反馈的美国地址问题：被银行、信用卡、支付平台拒绝，房东或运营方不配合，邮件丢失、额外收费等。按街道、城市、州、ZIP 搜索，也可以提交你遇到的问题地址。',
  keywords: [
    '美国地址黑名单',
    '虚拟地址黑名单',
    '问题地址',
    '美国地址被拒',
    '信用卡地址被拒',
    '虚拟邮箱 房东不配合',
    '虚拟邮箱 丢件',
    'CMRA 地址',
    'CMRA address',
    'CMRA address check',
    'virtual address blacklist',
    'flagged address',
  ],
};

const seoCards = [
  {
    title: '先查再用',
    text: '租用虚拟邮箱或填写美国地址前，先搜一下街道、城市或 ZIP，看看有没有人反馈过这个地址的问题。',
    icon: Search,
  },
  {
    title: '问题不止被拒',
    text: '除了被银行、信用卡、支付平台拒绝，房东或运营方不配合、邮件丢失、隐藏收费这类使用体验问题同样会被收录。',
    icon: MessageSquareWarning,
  },
  {
    title: '大家一起维护',
    text: '任何人都可以提交自己遇到的问题地址，帮助后来者避开同样的坑。',
    icon: Users,
  },
];

const faqs = [
  {
    question: '什么是地址黑名单？',
    answer: '这里收录用户反馈过问题的美国地址：被银行、信用卡或支付平台拒绝，房东或运营方不配合，邮件丢失、额外收费等。租用虚拟邮箱或填写美国地址前，可以先在这里查一下。',
  },
  {
    question: '什么是 CMRA 地址（What is a CMRA address）？',
    answer: 'CMRA 是 Commercial Mail Receiving Agency（商业邮件接收代理）的简称，例如 UPS Store 和各类虚拟邮箱服务的地址。不少银行和信用卡机构不接受 CMRA 地址作为住址，因此它们是黑名单里最常见的一类。',
  },
  {
    question: '哪些问题可以提交？',
    answer: '被银行、信用卡、支付平台或其他机构拒绝；房东或运营方不配合办理手续；邮件处理慢、丢失或损坏；出现事先没有说明的费用等。只要会影响别人使用这个地址，都可以提交。',
  },
  {
    question: '黑名单里的地址就一定不能用吗？',
    answer: '不一定。反馈来自不同用户的个人经历，同一地址在不同机构、不同时间的结果可能不同，请结合自己的用途判断。',
  },
  {
    question: '地址被误列入黑名单怎么办？',
    answer: '如果你认为某个地址被误报，可发送邮件至 juzhpcom@gmail.com，说明地址与理由，我们会核对后下架或补充说明。',
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

interface BlacklistPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: BlacklistPageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};

  return {
    ...listMetadata,
    alternates: {
      canonical: buildPublicListCanonicalPath(PUBLIC_BLACKLIST_BASE_PATH, parsePublicBlacklistFilters(params)),
    },
  };
}

export default async function AddressBlacklistPage({ searchParams }: BlacklistPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = parsePublicBlacklistFilters(params);
  const dataPromise = getPublicBlacklistPageData(filters);
  const headCode = await getPublicHeadCode();

  return (
    <>
      <PublicHeadCode headCode={headCode} />
      <SiteHeader active="blacklist" />
      <main className="site-main addresses-page blacklist-page">
        <section className="addresses-hero">
          <div className="addresses-inner">
            <nav className="addresses-breadcrumb" aria-label="面包屑">
              <Link href="/">首页</Link>
              <span>/</span>
              <strong>地址黑名单</strong>
            </nav>
            <h1>美国地址黑名单</h1>
            <p className="addresses-hero-copy">
              收集大家在使用美国地址时遇到的问题：被银行、信用卡或支付平台拒绝，房东或运营方不配合，邮件丢失、额外收费等。
              租用虚拟邮箱或填写美国地址前，先按街道、城市、州或 ZIP 搜一下；遇到问题的地址也欢迎在下方提交。
            </p>
            <div className="addresses-proof-list" aria-label="页面能力">
              <span><span><Search size={15} aria-hidden="true" /></span>搜索地址</span>
              <span><span><MessageSquareWarning size={15} aria-hidden="true" /></span>查看问题反馈</span>
              <span><span><Flag size={15} aria-hidden="true" /></span>提交问题地址</span>
            </div>
          </div>
        </section>

        <section className="addresses-inner addresses-search-panel" aria-labelledby="blacklist-search-title">
          <h2 className="home-visually-hidden" id="blacklist-search-title">搜索黑名单地址</h2>
          <form className="addresses-search-form blacklist-search-form" action={`${PUBLIC_BLACKLIST_BASE_PATH}#blacklist-list-title`} method="get">
            <label className="addresses-keyword-field">
              <span>搜索地址</span>
              <div className="addresses-input-like">
                <Search size={18} aria-hidden="true" />
                <input
                  name="q"
                  placeholder="街道、城市、州或 ZIP，例如 Main St / Los Angeles / 加州 / 90001"
                  defaultValue={filters.q}
                />
              </div>
            </label>
            <button type="submit">
              <Search size={18} aria-hidden="true" />
              搜索黑名单
            </button>
          </form>
        </section>

        <section className="addresses-inner addresses-section" aria-labelledby="blacklist-list-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="blacklist-list-title">黑名单地址列表</h2>
              <p>每个地址下列出用户反馈的问题和来源链接。</p>
            </div>
            <Suspense fallback={null}>
              <BlacklistRangePill dataPromise={dataPromise} />
            </Suspense>
          </div>

          <Suspense fallback={<BlacklistResultsSkeleton />}>
            <BlacklistResults dataPromise={dataPromise} filters={filters} />
          </Suspense>
        </section>

        <section className="addresses-inner addresses-section" id="submit" aria-labelledby="blacklist-submit-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="blacklist-submit-title">提交问题地址</h2>
              <p>遇到被拒、房东不配合、丢件或乱收费的美国地址？粘贴整行地址一键解析，写下遇到的问题后提交。</p>
            </div>
          </div>
          <div className="blacklist-submit-panel">
            <BlacklistSubmitForm />
          </div>
        </section>

        <section className="addresses-inner addresses-section" aria-labelledby="blacklist-seo-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="blacklist-seo-title">地址黑名单怎么用？</h2>
              <p>把黑名单当成租用虚拟地址或填写美国地址前的最后一道检查。</p>
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

        <section className="addresses-inner addresses-section" id="faq" aria-labelledby="blacklist-faq-title">
          <div className="addresses-section-head">
            <div>
              <h2 id="blacklist-faq-title">地址黑名单常见问题</h2>
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

async function BlacklistRangePill({ dataPromise }: { dataPromise: Promise<PublicBlacklistPageData> }) {
  const data = await dataPromise;

  return (
    <span className="addresses-update-pill">
      <Database size={18} aria-hidden="true" />
      显示 {data.start}-{data.end} / {formatNumber(data.total)}
    </span>
  );
}

function BlacklistResultsSkeleton() {
  return (
    <div className="addresses-result-panel">
      <div className="addresses-skeleton" aria-busy="true" aria-live="polite" style={{ padding: 16 }}>
        <span className="home-visually-hidden">正在加载黑名单列表…</span>
        {Array.from({ length: 6 }).map((_, index) => (
          <span className="addresses-skeleton-row" key={index} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}

async function BlacklistResults({
  dataPromise,
  filters,
}: {
  dataPromise: Promise<PublicBlacklistPageData>;
  filters: PublicBlacklistFilters;
}) {
  const data = await dataPromise;
  const paginationItems = getPaginationItems(data.page, data.totalPages);
  const clearAllHref = buildBlacklistPageUrl(filters, { q: '', page: 1 });
  const chips: ActiveFilterChip[] = filters.q
    ? [{ key: 'q', label: '关键词', value: filters.q, removeHref: clearAllHref }]
    : [];

  return (
    <div className="addresses-result-panel">
      <div className="addresses-result-toolbar">
        <div className="addresses-result-count">
          找到 <strong>{formatNumber(data.total)}</strong> 个黑名单地址
        </div>
        <ActiveFilterChips chips={chips} clearAllHref={clearAllHref} />
      </div>
      {data.items.length > 0 ? (
        <div className="blacklist-list" role="list">
          {data.items.map((entry) => (
            <article className="blacklist-row" key={entry.key} role="listitem">
              <div className="blacklist-row-address">
                <span className="addresses-badge warn"><ShieldAlert size={14} aria-hidden="true" />黑名单</span>
                <h3>{entry.streetAddress}</h3>
                <p>{entry.cityLine}</p>
                <small>{entry.stateLabel}</small>
              </div>
              <ol className="blacklist-reasons">
                {entry.reasons.map((item) => (
                  <li key={item.id}>
                    <p>{item.reason}</p>
                    <div className="blacklist-reason-meta">
                      <span>收录于 {item.approvedAt}</span>
                      {item.sourceUrl ? (
                        <a href={item.sourceUrl} rel="nofollow noreferrer noopener" target="_blank">
                          <ExternalLink size={14} aria-hidden="true" />
                          来源链接
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      ) : (
        <div className="addresses-empty">
          <strong>{filters.q ? '没有找到匹配的黑名单地址' : '暂无黑名单地址'}</strong>
          <p>{filters.q ? '可以减少关键词，或只输入 ZIP / 城市再试。没有命中不代表地址一定没问题。' : '欢迎在下方提交你遇到的问题地址。'}</p>
          <div className="addresses-empty-actions">
            {filters.q ? (
              <Link href={clearAllHref}>
                <RefreshCw size={15} aria-hidden="true" />
                清除搜索
              </Link>
            ) : null}
            <a href="#blacklist-submit-title">
              <Flag size={15} aria-hidden="true" />
              提交问题地址
            </a>
          </div>
        </div>
      )}
      <nav className="addresses-pagination" aria-label="黑名单分页">
        <span>第 {data.page} 页，共 {data.totalPages} 页</span>
        <div>
          {data.page > 1 ? (
            <Link href={buildBlacklistPageUrl(filters, { page: data.page - 1 })}>上一页</Link>
          ) : (
            <span className="disabled">上一页</span>
          )}
          {paginationItems.map((item, index) => (
            item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`}>...</span>
            ) : (
              <Link
                className={item === data.page ? 'active' : undefined}
                href={buildBlacklistPageUrl(filters, { page: item })}
                key={item}
              >
                {item}
              </Link>
            )
          ))}
          {data.page < data.totalPages ? (
            <Link href={buildBlacklistPageUrl(filters, { page: data.page + 1 })}>下一页</Link>
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

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}
