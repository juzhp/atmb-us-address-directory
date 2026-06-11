import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Binoculars,
  Camera,
  CheckCircle2,
  CircleAlert,
  DatabaseZap,
  DollarSign,
  ExternalLink,
  Hash,
  Home,
  MapPinned,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';

import { StateCombobox } from './_components/StateCombobox';
import { PublicHeadCode } from './_components/PublicHeadCode';
import { SiteFooter, SiteHeader } from './_components/SiteShell';
import { getHomePageData, type HomeFeaturedAddress } from './_lib/home-data';
import { getPublicHeadCode } from './_lib/public-head-code';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Anytime Mailbox住宅地址指南 | 筛选美国真实住宅地址',
  description:
    '基于 Anytime Mailbox 地址数据，结合 Smarty RDI/CMRA、Google Maps 街景跳转、价格、ZIP 与邮箱编号范围，帮助中文用户筛选美国真实住宅地址租用候选。',
  alternates: {
    canonical: '/',
  },
  keywords: [
    '美国真实住宅地址',
    'Anytime Mailbox住宅地址',
    '美国住宅地址租用',
    'RDI Residential',
    'CMRA',
    'Smarty地址验证',
    'Google Maps街景',
  ],
  openGraph: {
    title: 'Anytime Mailbox住宅地址指南',
    description: '通过 RDI、CMRA、街景、价格和邮箱编号范围筛选美国真实住宅地址。',
    type: 'website',
    locale: 'zh_CN',
    images: [
      {
        url: '/assets/home/hero-residential-map-v4.png',
        width: 1536,
        height: 1024,
        alt: '美国住宅地址筛选数据地图界面',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anytime Mailbox住宅地址指南',
    description: '筛选美国真实住宅地址的第三方研究工具。',
    images: ['/assets/home/hero-residential-map-v4.png'],
  },
};

const indicators = [
  {
    title: 'RDI：Residential / Commercial',
    icon: Home,
    text: 'RDI 来自 Smarty 地址验证结果，用于判断地址更接近住宅用途还是商业用途。Residential 通常更符合真实住宅地址筛选目标。',
  },
  {
    title: 'CMRA：Yes / No',
    icon: ShieldCheck,
    text: 'CMRA = Yes 通常表示商业邮件接收代理相关地址；若目标是更接近普通住宅场景，CMRA = No 通常更值得优先查看。',
  },
  {
    title: '街景：跳转 Google Maps',
    icon: Camera,
    text: '网站提供 Google Maps 跳转入口，用户打开后自行查看房屋外观、门牌、街区环境、停车与商业痕迹。',
  },
  {
    title: '邮箱编号范围：使用人数参考',
    icon: DatabaseZap,
    text: '邮箱编号范围可粗略反映该地址可能已有多少邮箱编号或用户使用，只作为拥挤度和风险判断的辅助信号。',
  },
];

const trustItems = [
  {
    title: '每日监控更新',
    text: '抓取地址、价格、邮箱编号范围与状态变化',
    icon: RefreshCw,
  },
  {
    title: 'Smarty RDI / CMRA',
    text: 'RDI 与 CMRA 字段来自 Smarty 数据',
    icon: ShieldCheck,
  },
  {
    title: 'Google Maps 街景跳转',
    text: '点击链接查看街景与周边环境，自行判断',
    icon: MapPinned,
  },
  {
    title: '邮箱编号范围参考',
    text: '辅助判断该地址可能已有多少用户使用',
    icon: DatabaseZap,
  },
];

const decisionItems = [
  {
    title: '价格',
    text: '价格不是越低越好，过低可能存在风险，需要结合当地市场价格判断。',
    icon: DollarSign,
  },
  {
    title: 'RDI',
    text: '优先查看 Residential；如果为 Commercial，需要结合街景与用途谨慎判断。',
    icon: Home,
  },
  {
    title: 'CMRA',
    text: 'CMRA = No 通常更理想；Yes 可能意味着商业邮件代理或转运相关场景。',
    icon: ShieldCheck,
  },
  {
    title: '街景',
    text: '查看房屋类型、门牌、周边环境、停车与商业痕迹，判断是否符合需求。',
    icon: MapPinned,
  },
  {
    title: '邮箱编号',
    text: '范围较大时可能使用人数较多，只作为拥挤度和风险判断的参考之一。',
    icon: Hash,
  },
];

const faqs = [
  {
    question: 'RDI = Residential 就一定适合吗？',
    answer:
      '不一定。Residential 只是 Smarty 返回的地址用途辅助字段，仍需要结合 CMRA、街景、价格、ZIP 与邮箱编号范围综合判断。',
  },
  {
    question: 'CMRA = Yes 是否代表不能用？',
    answer:
      '不一定，但它通常表示商业邮件接收代理相关地址。若目标是更接近真实住宅用途，CMRA = No 通常更值得优先查看。',
  },
  {
    question: '街景由谁判断？网站会自动给结论吗？',
    answer:
      '网站提供 Google Maps 跳转链接，街景由用户打开后自行判断。本站不自动给出最终可用结论。',
  },
  {
    question: '邮箱编号范围可以说明什么？',
    answer:
      '它只能大致反映该地址可能已有多少邮箱编号或用户使用，不能单独判断地址质量。',
  },
  {
    question: '这是 Anytime Mailbox 官方网站吗？',
    answer:
      '不是。本站是第三方地址筛选指南，非 Anytime Mailbox 官方网站。所有信息仅供参考与研究使用。',
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

export default async function HomePage() {
  const [headCode, { featuredAddresses, stateOptions }] = await Promise.all([
    getPublicHeadCode(),
    getHomePageData(),
  ]);
  const featuredItemListJsonLd = featuredAddresses.length
    ? buildFeaturedItemListJsonLd(featuredAddresses)
    : null;

  return (
    <>
      <PublicHeadCode headCode={headCode} />
      <SiteHeader />
      <main className="site-main">
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="site-eyebrow">美国真实住宅地址筛选指南</p>
            <h1>
              用 RDI、CMRA 与街景
              <br />
              辅助筛选美国真实住宅地址
            </h1>
            <p className="home-hero-lede">
              基于 Anytime Mailbox 地址数据，结合 Smarty 返回的 RDI 与 CMRA 字段、Google Maps 街景跳转、
              价格、ZIP 与邮箱编号范围，帮助中文用户更快缩小美国住宅地址租用候选范围。
            </p>
            <div className="home-proof-list" aria-label="核心判断维度">
              <span><span className="home-proof-icon"><CheckCircle2 size={15} aria-hidden="true" /></span>RDI 区分 Residential / Commercial</span>
              <span><span className="home-proof-icon"><CheckCircle2 size={15} aria-hidden="true" /></span>CMRA 标记 Yes / No</span>
              <span><span className="home-proof-icon"><CheckCircle2 size={15} aria-hidden="true" /></span>点击 Google Maps 自行判断街景</span>
              <span><span className="home-proof-icon"><CheckCircle2 size={15} aria-hidden="true" /></span>数据每日监控更新</span>
            </div>
          </div>
          <div className="home-hero-visual" aria-hidden="true">
            <Image
              src="/assets/home/hero-residential-map-v4.png"
              alt=""
              width={1536}
              height={1024}
              priority
              sizes="(max-width: 900px) 100vw, 760px"
            />
          </div>
        </section>

        <section className="home-search-panel" aria-labelledby="home-search-title">
          <h2 className="home-visually-hidden" id="home-search-title">首页只保留三个核心条件</h2>
          <form className="home-filter-form" action="/addresses" method="get">
            <StateCombobox
              label="所在州"
              name="state"
              options={stateOptions.map((state) => ({
                code: state.code,
                label: state.label,
                searchText: state.searchText,
                count: state.count,
              }))}
              placeholder="搜索州、英文名或州代码"
            />
            <label>
              <span>RDI 类型</span>
              <select name="rdi" defaultValue="Residential">
                <option value="">全部</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="none">无</option>
              </select>
            </label>
            <label>
              <span>CMRA</span>
              <select name="cmra" defaultValue="No">
                <option value="">全部</option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
                <option value="none">无</option>
              </select>
            </label>
            <button type="submit">
              <Search size={17} aria-hidden="true" />
              筛选地址
            </button>
          </form>
          <div className="home-filter-note">
            <span><ShieldCheck size={16} aria-hidden="true" /><strong>RDI / CMRA</strong> 来源于 Smarty 地址验证结果</span>
            <span><MapPinned size={16} aria-hidden="true" />街景通过 Google Maps 链接跳转后由用户自行判断</span>
            <span><RefreshCw size={16} aria-hidden="true" />地址、价格与邮箱编号范围每日监控更新</span>
          </div>
        </section>

        <section className="home-trust-row" aria-label="核心说明">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <article className="home-trust-item" key={item.title}>
                <span className="home-trust-icon"><Icon size={24} aria-hidden="true" /></span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.text}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="home-section" id="indicators" aria-labelledby="indicators-title">
          <div className="home-section-heading">
            <p className="site-eyebrow">判断指标</p>
            <h2 id="indicators-title">我们使用的四个辅助判断指标</h2>
            <p>这些字段用于帮助你更科学地筛选美国住宅地址，但它们仍是辅助判断，不等于最终承诺或保证。</p>
          </div>
          <div className="home-indicator-grid">
            {indicators.map((item) => {
              const Icon = item.icon;
              return (
                <article className="home-indicator" key={item.title}>
                  <Icon size={24} aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="home-section home-featured" aria-labelledby="featured-title">
          <div className="home-featured-top">
            <div className="home-section-heading">
              <p className="site-eyebrow">真实精选</p>
              <h2 id="featured-title">精选住宅地址</h2>
              <p>以下为后台标记为精选、且 RDI 为 Residential 的真实地址候选，用于展示价格、RDI、CMRA、ZIP 与邮箱编号范围等辅助判断字段。</p>
            </div>
            <span className="home-update-pill">
              <RefreshCw size={18} aria-hidden="true" />
              每日监控更新
            </span>
          </div>
          {featuredAddresses.length ? (
            <div className="home-address-grid">
              {featuredAddresses.map((address) => (
                <article className="home-address-card" key={address.id}>
                  {address.imageUrl ? (
                    <Image
                      src={address.imageUrl}
                      alt={`${address.name} 街景图`}
                      width={640}
                      height={360}
                      sizes="(max-width: 900px) 100vw, 25vw"
                    />
                  ) : (
                    <div className="home-address-image-placeholder">
                      <MapPinned size={28} aria-hidden="true" />
                      <span>暂无街景图</span>
                    </div>
                  )}
                  <div className="home-address-body">
                    <h3>{address.name}</h3>
                    <address>
                      {address.streetAddress}
                      <br />
                      {address.city}, {address.state} {address.postalCode}
                    </address>
                    <div className="home-address-price">{address.price}</div>
                    <div className="home-address-chips">
                      <span className={address.rdi === 'Residential' ? 'good' : 'warn'}>{address.rdi}</span>
                      <span className={address.cmra === 'No' ? 'good' : 'warn'}>{address.cmra}</span>
                    </div>
                    <dl>
                      <div>
                        <dt>州</dt>
                        <dd>{address.stateLabel}</dd>
                      </div>
                      <div>
                        <dt>ZIP</dt>
                        <dd>{address.postalCode}</dd>
                      </div>
                      <div>
                        <dt>邮箱编号</dt>
                        <dd>{address.mailbox}</dd>
                      </div>
                    </dl>
                    <div className="home-card-actions">
                      <a href={address.detailUrl} rel="noreferrer" target="_blank">
                        <ExternalLink size={16} aria-hidden="true" />
                        查看详情
                      </a>
                      <a className="photo" href={address.mapsUrl} rel="noreferrer" target="_blank">
                        <Camera size={16} aria-hidden="true" />
                        查看照片
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="home-featured-empty">
              <MapPinned size={24} aria-hidden="true" />
              <p>暂无精选住宅地址，后台设置精选后会在这里展示。</p>
            </div>
          )}
          <Link className="home-more-link" href="/residential-addresses">
            查看更多精选住宅地址
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>

        <section className="home-section home-process" aria-labelledby="process-title">
          <div className="home-section-heading">
            <h2 id="process-title">如何综合判断一个美国住宅地址是否适合租用？</h2>
            <p>先筛选州、RDI、CMRA，再进入地址详情看价格、ZIP、邮箱编号范围，并跳转 Google Maps 检查街景。</p>
          </div>
          <div className="home-decision-strip">
            {decisionItems.map((item) => {
              const Icon = item.icon;
              return (
                <article className="home-decision-item" key={item.title}>
                  <h3>
                    <span className="home-decision-icon"><Icon size={20} aria-hidden="true" /></span>
                    {item.title}
                  </h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
          <div className="home-decision-notice">
            <span className="home-decision-icon">
              <CircleAlert size={20} aria-hidden="true" />
            </span>
            <p><strong>重要提醒：</strong>以上所有指标仅为辅助判断，不能保证地址 100% 适用或可用。租用前仍需结合你的实际用途与风险承受能力，谨慎选择。</p>
          </div>
        </section>

        <section className="home-section home-insight" aria-labelledby="insight-title">
          <div>
            <p className="site-eyebrow">每日监控更新</p>
            <h2 id="insight-title">地址、价格和编号范围会持续变化</h2>
            <p>
              后台任务会监控 Anytime Mailbox 地址、价格、邮箱编号范围和上下架状态。已经成功获取过 Smarty
              RDI/CMRA 的地址会复用结果，避免重复请求。
            </p>
          </div>
          <div className="home-insight-list">
            <span><RefreshCw size={18} aria-hidden="true" />每日监控地址变化</span>
            <span><BadgeCheck size={18} aria-hidden="true" />复用已验证 RDI/CMRA</span>
            <span><MapPinned size={18} aria-hidden="true" />街景跳转人工判断</span>
            <span><Binoculars size={18} aria-hidden="true" />编号范围辅助判断拥挤度</span>
          </div>
        </section>

        <section className="home-section home-faq" id="faq" aria-labelledby="faq-title">
          <div className="home-section-heading">
            <p className="site-eyebrow">FAQ</p>
            <h2 id="faq-title">常见问题</h2>
          </div>
          <div className="home-faq-list">
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
      {featuredItemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(featuredItemListJsonLd) }}
        />
      ) : null}
    </>
  );
}

function buildFeaturedItemListJsonLd(featuredAddresses: HomeFeaturedAddress[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: featuredAddresses.map((address, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: address.sourceDetailUrl,
      name: address.name,
      item: {
        '@type': 'PostalAddress',
        streetAddress: address.streetAddress,
        addressLocality: address.city,
        addressRegion: address.state,
        postalCode: address.postalCode,
        addressCountry: 'US',
      },
    })),
  };
}
