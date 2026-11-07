import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, Download, Filter, Puzzle, ShieldAlert, Zap } from 'lucide-react';

import { getPublicHeadCode } from '../_lib/public-head-code';
import { CHROME_STORE_URL, EDGE_STORE_LIVE, EDGE_STORE_URL } from '../_lib/extension-links';
import { SITE_URL } from '../_lib/site-routes';
import { PublicHeadCode } from '../_components/PublicHeadCode';
import { SiteFooter, SiteHeader } from '../_components/SiteShell';

export const revalidate = 86400;

const PAGE_PATH = '/extension';
const GITHUB_URL = 'https://github.com/juzhp/atmb-us-address-directory/tree/main/apps/extension';

export const metadata: Metadata = {
  title: 'usaddres 地址助手：Chrome / Edge 浏览器扩展，在 ATMB、iPostal1 页面直接显示 RDI、CMRA 与地址黑名单',
  description:
    '免费 Chrome / Edge 扩展：浏览 Anytime Mailbox(ATMB) 和 iPostal1 的美国地址页面时，每个地址旁自动显示 RDI、CMRA、USPS CMRA、C1 预审、价格和用户黑名单，支持页面内筛选、本地隐藏，以及一键 Smarty / USPS 实时查询。附安装教程与常见问题。',
  alternates: {
    canonical: PAGE_PATH,
  },
  keywords: [
    'usaddres 地址助手',
    'Anytime Mailbox 扩展',
    'iPostal1 扩展',
    'ATMB 插件',
    '美国住宅地址筛选插件',
    'Chrome 扩展 美国地址',
    'Edge 扩展 美国地址',
    'RDI CMRA 浏览器扩展',
    'USPS CMRA 查询',
    'Smarty 地址验证',
    '美国地址黑名单',
    '虚拟邮箱地址筛选',
  ],
  openGraph: {
    title: 'usaddres 地址助手：ATMB / iPostal1 美国住宅地址筛选浏览器扩展',
    description: '在 Anytime Mailbox 与 iPostal1 页面直接看到每个地址的 RDI、CMRA、黑名单，一键 Smarty / USPS 实时查询。免费，Chrome 与 Edge 可用。',
    type: 'website',
    locale: 'zh_CN',
    url: PAGE_PATH,
  },
};

const screenshots = [
  {
    src: '/assets/extension/anytime-mailbox-list-rdi-cmra-filter.webp',
    width: 1792,
    height: 1573,
    alt: 'usaddres 地址助手在 Anytime Mailbox 加州地址列表页：顶部筛选栏，每个地址下方的数据条显示 RDI、CMRA、USPS CMRA、C1 预审、价格和邮箱编号',
    caption: 'Anytime Mailbox 州列表页：列表顶部多出 usaddres 筛选栏，每个地址下方是数据条和「隐藏」按钮；未展开时只显示一枚带颜色的小芯片。',
  },
  {
    src: '/assets/extension/anytime-mailbox-detail-smarty-usps-live-lookup.webp',
    width: 1800,
    height: 1160,
    alt: 'usaddres 地址助手在 Anytime Mailbox 地址详情页展示 Smarty 与 USPS 实时查询结果：RDI Residential、CMRA N、DPV 已确认',
    caption: '地址详情页：点击「Smarty 实时查询」「USPS 实时查询」，扩展在新标签页打开官方查询页、自动填写并提交，结果直接显示在数据条里。',
  },
  {
    src: '/assets/extension/ipostal1-list-rdi-cmra-filter.webp',
    width: 1861,
    height: 1429,
    alt: 'usaddres 地址助手在 iPostal1 地址选择页：筛选栏与每个地址卡片下方的 RDI、CMRA、价格数据条',
    caption: 'iPostal1 地址选择页：同样的筛选栏、芯片与数据条，可按 RDI、CMRA、黑名单等条件直接过滤整页地址。',
  },
  {
    src: '/assets/extension/ipostal1-plan-blacklist-usps-live-lookup.webp',
    width: 1792,
    height: 966,
    alt: 'usaddres 地址助手在 iPostal1 选套餐页提示该地址有 1 条黑名单记录，并显示 USPS 与 Smarty 实时查询结果',
    caption: 'iPostal1 选套餐页：地址进了黑名单会用红色标出并给出用户反馈的原因，下单前就能看到风险。',
  },
] as const;

const features = [
  {
    icon: Check,
    title: '地址旁直接显示关键数据',
    text: 'RDI（住宅 / 商业）、CMRA、USPS CMRA、C1 预审（Capital One 地址预审核）、价格与邮箱编号范围，来自 usaddres.com 每日更新的数据，不用再切换页面逐个查。',
  },
  {
    icon: ShieldAlert,
    title: '黑名单地址醒目预警',
    text: '其他用户反馈过被银行、信用卡或平台拒绝、邮件丢失、额外收费的地址，会标成红色并给出原因和来源，下单前就能避开。',
  },
  {
    icon: Filter,
    title: '页面内筛选与本地隐藏',
    text: '列表顶部的筛选栏按收录状态、RDI、CMRA、USPS CMRA、C1 预审、黑名单过滤整页地址；不想再看的地址点「隐藏」，只记在你自己的浏览器里，随时找回。',
  },
  {
    icon: Zap,
    title: 'Smarty / USPS 一键实时查询',
    text: '展开数据条后点击实时查询，扩展在新标签页打开 Smarty 官网的地址验证页或 USPS 的 ZIP Code Lookup，自动填入地址并提交，把 RDI、CMRA、DPV 等结果带回原页面。',
  },
];

const chromeSteps = [
  {
    name: '打开 Chrome 应用商店页面',
    text: '点击本页的「添加到 Chrome」按钮，进入 Chrome 应用商店中「ATMB / iPostal1 美国住宅地址筛选 - usaddres」的页面。',
  },
  {
    name: '点击「添加至 Chrome」并确认',
    text: '在弹出的权限提示里点击「添加扩展程序」。扩展只请求存储、标签页权限和对 usaddres.com 的访问，不读取其它网站。',
  },
  {
    name: '固定到工具栏（可选）',
    text: '点击地址栏右侧的拼图图标，在列表里把「usaddres」旁边的图钉点亮，以后点一下图标就能打开设置弹窗。',
  },
  {
    name: '在弹窗里开启平台',
    text: '点击扩展图标，开启「在 Anytime Mailbox 启用」或「在 iPostal1 启用」。两个开关默认关闭；开启时扩展会通过 usaddres 的推荐链接打开一次该平台，不影响价格。',
  },
  {
    name: '打开地址页面开始使用',
    text: '访问 Anytime Mailbox 的州列表页、地址详情页，或 iPostal1 的地址选择页，每个地址旁会出现 usaddres 芯片；点击芯片展开完整数据条。',
  },
];

const faqs = [
  {
    question: '扩展收费吗？需要注册账号吗？',
    answer: '完全免费，不需要注册或登录。扩展代码在 GitHub 开源，没有广告，也没有统计或追踪脚本。',
  },
  {
    question: '为什么平台开关默认是关闭的？开启后会发生什么？',
    answer:
      '扩展的数据功能与 usaddres 的推荐链接绑定：你手动开启某个平台后，扩展会通过推荐链接打开一次该平台（此后大约每 30 天一次）。如果你随后在该平台开通服务，usaddres 可能获得推荐佣金，这不会增加你的费用。不开启就不会发生，随时可以在弹窗里关闭。',
  },
  {
    question: '支持 Firefox 或 Safari 吗？',
    answer: '目前只提供 Chrome 与 Microsoft Edge 版本（Manifest V3）。Brave、Vivaldi 等基于 Chromium 的浏览器可以直接从 Chrome 应用商店安装。',
  },
  {
    question: '实时查询为什么要打开新标签页？',
    answer:
      '扩展不调用 Smarty 或 USPS 的接口，而是在你自己的浏览器里打开它们的公开查询页面，像人一样填写并提交，再把页面显示的结果带回来。这相当于你自己去查了一次，所以需要一个标签页；Smarty 在后台标签页完成，USPS 的页面会切到前台，偶尔需要你手动点一下 Find。',
  },
  {
    question: '为什么有的地址显示「未收录」？',
    answer:
      'usaddres.com 每日抓取两个平台的地址，但新上架或刚改名的地址可能还没进入数据库，也有部分地址已经下架。未收录的地址仍然可以用实时查询核对 RDI 与 CMRA，也可以到本站黑名单页搜索。',
  },
  {
    question: '扩展会收集我的个人信息吗？',
    answer:
      '不会。扩展只把页面上公开显示的邮箱地址发送到 usaddres.com 用于查询，不收集姓名、邮箱、密码、浏览历史或定位。设置、筛选条件和隐藏记录只保存在你的浏览器里，卸载扩展即全部删除。详见扩展隐私政策。',
  },
  {
    question: '怎么卸载或重置？',
    answer: '在 chrome://extensions 或 edge://extensions 页面找到 usaddres 点「移除」即可；在弹窗里也可以单独清除查询缓存和隐藏记录。',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: '浏览器扩展' },
      ],
    },
    {
      '@type': 'SoftwareApplication',
      name: 'usaddres 地址助手',
      alternateName: 'ATMB / iPostal1 美国住宅地址筛选 - usaddres',
      url: `${SITE_URL}${PAGE_PATH}`,
      applicationCategory: 'BrowserApplication',
      operatingSystem: 'Chrome, Microsoft Edge',
      installUrl: CHROME_STORE_URL,
      downloadUrl: CHROME_STORE_URL,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      screenshot: screenshots.map((shot) => `${SITE_URL}${shot.src}`),
      description:
        '在 Anytime Mailbox 与 iPostal1 的地址页面上叠加 usaddres.com 整理的 RDI、CMRA、USPS CMRA、C1 预审、价格与用户黑名单，支持筛选、本地隐藏和 Smarty / USPS 实时查询。',
      author: { '@type': 'Organization', name: 'usaddres', url: SITE_URL },
      codeRepository: GITHUB_URL,
    },
    {
      '@type': 'HowTo',
      name: '在 Chrome 中安装 usaddres 地址助手',
      step: chromeSteps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        text: step.text,
      })),
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ],
};

export default async function ExtensionPage() {
  const headCode = await getPublicHeadCode();

  return (
    <>
      <PublicHeadCode headCode={headCode} />
      <SiteHeader active="extension" />
      <main className="site-main addresses-page">
        <section className="addresses-hero">
          <div className="addresses-inner">
            <nav className="addresses-breadcrumb" aria-label="面包屑">
              <Link href="/">首页</Link>
              <span>/</span>
              <strong>浏览器扩展</strong>
            </nav>
            <h1>usaddres 地址助手：在 Anytime Mailbox 与 iPostal1 页面直接显示 RDI、CMRA 与地址黑名单的浏览器扩展</h1>
            <p className="addresses-hero-copy">
              挑美国地址时不用再在平台页面和本站之间来回切换。装上这个免费的 Chrome / Edge 扩展，ATMB 和 iPostal1
              的每个地址旁都会显示 usaddres.com 整理的 RDI、CMRA、USPS CMRA、C1 预审、价格和用户黑名单，还能在页面里筛选、隐藏，并一键发起 Smarty / USPS 实时查询。
            </p>
            <div className="extension-install-buttons">
              <a className="extension-install-button" href={CHROME_STORE_URL} rel="noreferrer" target="_blank">
                <Puzzle size={18} aria-hidden="true" />
                添加到 Chrome
              </a>
              {EDGE_STORE_LIVE ? (
                <a className="extension-install-button is-secondary" href={EDGE_STORE_URL} rel="noreferrer" target="_blank">
                  <Download size={18} aria-hidden="true" />
                  添加到 Edge
                </a>
              ) : (
                <a className="extension-install-button is-secondary" href="#install-edge">
                  <Download size={18} aria-hidden="true" />
                  Edge 安装方法
                </a>
              )}
              <span className="extension-install-note">免费 · 开源 · 无广告 · 不需要注册</span>
            </div>
          </div>
        </section>

        <section className="addresses-inner addresses-section">
          <div className="guide-prose">
            <nav className="guide-toc" aria-label="目录">
              <strong>本页目录</strong>
              <ol>
                <li><a href="#features">一、扩展能做什么</a></li>
                <li><a href="#screenshots">二、效果截图</a></li>
                <li><a href="#install-chrome">三、Chrome 安装教程</a></li>
                <li><a href="#install-edge">四、Edge 安装教程</a></li>
                <li><a href="#live-lookup">五、在 usaddres.com 列表里实时查询</a></li>
                <li><a href="#privacy">六、隐私与推荐链接</a></li>
                <li><a href="#faq">七、常见问题</a></li>
              </ol>
            </nav>

            <h2 id="features">一、扩展能做什么</h2>
            <p>
              Anytime Mailbox 和 iPostal1 的地址页面只告诉你地址和价格，判断它是不是真实住宅、有没有被标记为 CMRA、有没有人踩过坑，都要另外去查。
              扩展把本站已经整理好的数据直接叠加到这两个平台的页面上：
            </p>
            <div className="extension-feature-grid">
              {features.map((feature) => (
                <article className="extension-feature" key={feature.title}>
                  <feature.icon size={20} aria-hidden="true" />
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
            <p>
              每个地址旁的小芯片用颜色一眼区分：<strong>绿色</strong>住宅且无风险项，<strong>黄色</strong>有商业、CMRA 等风险项，<strong>红色</strong>在黑名单，<strong>灰色</strong>未收录。点击芯片展开完整数据条。
            </p>

            <h2 id="screenshots">二、效果截图</h2>
            {screenshots.map((shot) => (
              <figure className="guide-figure" key={shot.src}>
                <Image src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} sizes="(max-width: 900px) 100vw, 820px" />
                <figcaption>{shot.caption}</figcaption>
              </figure>
            ))}

            <h2 id="install-chrome">三、Chrome 安装教程</h2>
            <p>扩展已在 Chrome 应用商店上架，Brave、Vivaldi、Opera 等 Chromium 内核浏览器也可以用同一个商店页面安装。</p>
            <ol>
              {chromeSteps.map((step) => (
                <li key={step.name}>
                  <strong>{step.name}：</strong>{step.text}
                </li>
              ))}
            </ol>
            <div className="guide-cta">
              <div>
                <strong>Chrome 应用商店：ATMB / iPostal1 美国住宅地址筛选 - usaddres</strong>
                <span>安装后点击扩展图标开启平台，再打开 ATMB 或 iPostal1 的地址页面即可。</span>
              </div>
              <a href={CHROME_STORE_URL} rel="noreferrer" target="_blank">
                添加到 Chrome
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>

            <h2 id="install-edge">四、Edge 安装教程</h2>
            {EDGE_STORE_LIVE ? (
              <>
                <p>扩展已在 Microsoft Edge 加载项商店上架：打开商店页面，点击「获取」并确认权限提示即可。安装后的开启步骤与 Chrome 相同。</p>
                <div className="guide-cta">
                  <div>
                    <strong>Microsoft Edge 加载项：ATMB / iPostal1 美国住宅地址筛选 - usaddres</strong>
                    <span>与 Chrome 版本是同一个安装包、同一套功能。</span>
                  </div>
                  <a href={EDGE_STORE_URL} rel="noreferrer" target="_blank">
                    添加到 Edge
                    <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </div>
              </>
            ) : (
              <>
                <p>
                  Microsoft Edge 加载项商店的版本正在审核中，通过后本页会更新为商店链接。现在可以在 Edge 里直接从 Chrome 应用商店安装，功能完全一样：
                </p>
                <ol>
                  <li><strong>允许其它商店的扩展：</strong>在 Edge 地址栏输入 <code>edge://extensions</code> 回车，在左下角打开「允许来自其他应用商店的扩展」。</li>
                  <li><strong>打开 Chrome 应用商店页面：</strong>点击上面的「添加到 Chrome」按钮，Edge 会正常打开该页面。</li>
                  <li><strong>点击「获取」并确认：</strong>页面上的按钮在 Edge 中显示为「获取」或「添加到 Chrome」，点击后在权限提示里选择「添加扩展」。</li>
                  <li><strong>开启平台：</strong>点击工具栏上的扩展图标，开启需要的平台，之后的用法与 Chrome 相同。</li>
                </ol>
              </>
            )}
            <div className="guide-callout">
              也可以从 <a href={GITHUB_URL} rel="noreferrer" target="_blank">GitHub 仓库</a> 获取源码自行构建，在扩展管理页开启「开发者模式」后加载 dist 目录。日常使用建议走商店安装，才能自动收到更新。
            </div>

            <h2 id="live-lookup">五、在 usaddres.com 列表里实时查询</h2>
            <p>
              装好扩展后，本站 <Link href="/addresses">ATMB 地址列表</Link>、<Link href="/ipostal1">iPostal1 地址列表</Link> 以及两个住宅地址精选页的每一行底部都多出
              <strong>「Smarty 实时查询」</strong>和<strong>「USPS 实时查询」</strong>。本站列表里的 RDI、CMRA、USPS CMRA 是定期抓取的结果，想确认某个地址此刻的状态时点一下即可：
            </p>
            <ul>
              <li><strong>Smarty 实时查询：</strong>扩展在后台标签页打开 Smarty 官网的地址验证页，自动填入地址并提交，几秒后 RDI、CMRA、DPV 匹配和空置状态显示在该行下方。</li>
              <li><strong>USPS 实时查询：</strong>扩展打开 USPS 的 ZIP Code Lookup 并自动填表提交，结果（CMRA、DPV 确认、县）带回后自动切回本站。USPS 页面偶尔需要你手动点一下 Find。</li>
              <li><strong>没装扩展：</strong>点击会跳到本页。这个功能必须由扩展在你自己的浏览器里完成，本站服务器不会替你调用 Smarty 或 USPS。</li>
            </ul>
            <div className="guide-cta">
              <div>
                <strong>去列表里试试实时查询</strong>
                <span>默认只显示 RDI Residential 的住宅地址，每一行底部都有实时查询入口。</span>
              </div>
              <Link href="/residential-addresses">
                打开住宅地址列表
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <h2 id="privacy">六、隐私与推荐链接</h2>
            <p>
              扩展只把当前页面上公开显示的邮箱地址发送到 usaddres.com 查询对应数据，不收集姓名、邮箱、密码、浏览历史或定位，不含广告与统计脚本，全部代码打包在安装包里。设置、筛选条件、隐藏记录只保存在你的浏览器中。
            </p>
            <p>
              两个平台的功能默认关闭。你手动开启某个平台后，扩展会通过 usaddres 的推荐链接打开该平台（此后大约每 30 天一次）；如果你随后在该平台开通服务，我们可能获得推荐佣金，这不会增加你的费用。完整说明见
              <Link href="/extension-privacy">扩展隐私政策</Link>。
            </p>

            <h2 id="faq">七、常见问题</h2>
            <div className="addresses-faq">
              {faqs.map((faq) => (
                <article key={faq.question}>
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </article>
              ))}
            </div>

            <div className="guide-callout">
              本扩展由 usaddres.com 提供，是第三方工具，与 Anytime Mailbox、iPostal1、Smarty、USPS、Capital One 均无隶属关系。所有数据仅供辅助判断，最终以各平台和金融机构的实际审核为准。
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
