import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { getPublicHeadCode } from '../../_lib/public-head-code';
import { PublicHeadCode } from '../../_components/PublicHeadCode';
import { SiteFooter, SiteHeader } from '../../_components/SiteShell';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: '2026 Anytime Mailbox(ATMB) 注册教程 | 美国真实住宅地址筛选避坑（信用卡/开户必备）',
  description:
    '手把手 Anytime Mailbox(ATMB) 注册教程：从选州、筛选 RDI Residential / CMRA No 真实住宅地址，到选套餐、支付、激活全流程，并教你用 RDI/CMRA/街景避开商业与 CMRA 地址。适合申请美国信用卡、银行开户、公司注册。',
  alternates: {
    canonical: '/guide/anytime-mailbox-tutorial',
  },
  keywords: [
    'Anytime Mailbox教程',
    'Anytime Mailbox注册',
    'ATMB注册教程',
    '美国私人地址申请',
    '美国住宅地址租赁',
    '美国地址选址技巧',
    'RDI Residential',
    'CMRA',
    '美国信用卡地址',
    '美国虚拟地址',
  ],
  openGraph: {
    title: '2026 Anytime Mailbox(ATMB) 注册教程 | 美国真实住宅地址筛选避坑',
    description: '注册、选址、筛选 RDI Residential / CMRA No 真实住宅地址的完整步骤与避坑要点。',
    type: 'article',
    locale: 'zh_CN',
  },
};

const steps = [
  {
    name: '准备资料',
    text: '准备好身份证信息、一张可在线支付的 Visa/Mastercard 双币卡，以及稳定的美国网络节点，便于注册、填表与支付。',
  },
  {
    name: '选择州与地址',
    text: '打开 Anytime Mailbox，选择目标州进入地址列表。列表里既有住宅地址也有大量商业地址，需要逐个识别。',
  },
  {
    name: '验证 RDI 与 CMRA',
    text: '用 USPS Zip Lookup 与 Smarty 验证：RDI 显示 Residential、CMRA 显示 N（No）的才是更接近真实私人住宅的地址。',
  },
  {
    name: '查看街景',
    text: '在 Google Maps 查看建筑外观，住宅楼更可靠；厂区、仓库、写字楼通常应排除。',
  },
  {
    name: '选择套餐',
    text: '建议先选月付套餐体验。注意 Anytime Mailbox 为加盟制，套餐价格与权益由各地址房东自定，需点开 Full Details 查看碎纸费、信件/包裹免费存放时长与滞留费。',
  },
  {
    name: '填写信息并支付',
    text: '填写用于信件转发回国的国内地址、登录邮箱与密码，确认信息后用双币卡支付，邮箱号即被分配。',
  },
  {
    name: '完成 1583 公证激活',
    text: '支付后地址尚不能正式使用，需完成 USPS Form 1583 公证后审核通过才会启用。注意 ATMB 现在只接受在线视频公证（如 OneNotary），本地或第三方代办的 1583 已不被认可。',
  },
];

const faqs = [
  {
    question: 'Anytime Mailbox 的地址都是真实住宅地址吗？',
    answer:
      '不是。同一平台同时收录大量商业地址（CMRA）。需要用 RDI 与 CMRA 指标逐个判断，RDI = Residential 且 CMRA = No 的地址才更接近真实私人住宅。',
  },
  {
    question: '为什么申请美国信用卡/银行开户建议用住宅地址？',
    answer:
      '部分发卡行与银行对地址类型较敏感，商业邮件接收代理（CMRA）地址在风控时更容易被拒。具体要求以各银行/发卡方官方政策为准。',
  },
  {
    question: '手动筛选一个合规地址要多久？',
    answer:
      '据公开教程分享，逐个用 USPS/Smarty 核对 RDI/CMRA 往往要一个多小时。本站已把 RDI/CMRA、价格、邮箱编号范围批量整理好，可直接筛选。',
  },
  {
    question: '先月付还是年付？',
    answer:
      '建议先月付体验该地址房东的实际服务（扫描、转发时效、客服），满意后再考虑转年付，避免一次性投入后发现服务不合适。',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://usaddres.com/' },
        { '@type': 'ListItem', position: 2, name: '教程', item: 'https://usaddres.com/guide/anytime-mailbox-tutorial' },
        { '@type': 'ListItem', position: 3, name: 'Anytime Mailbox 注册教程' },
      ],
    },
    {
      '@type': 'HowTo',
      name: 'Anytime Mailbox 注册与美国真实住宅地址筛选教程',
      description:
        '在 Anytime Mailbox 注册并筛选 RDI Residential / CMRA No 美国真实住宅地址的完整步骤。',
      step: steps.map((step, index) => ({
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

export default async function AnytimeMailboxTutorialPage() {
  const headCode = await getPublicHeadCode();

  return (
    <>
      <PublicHeadCode headCode={headCode} />
      <SiteHeader active="guide" />
      <main className="site-main addresses-page">
        <section className="addresses-hero">
          <div className="addresses-inner">
            <nav className="addresses-breadcrumb" aria-label="面包屑">
              <Link href="/">首页</Link>
              <span>/</span>
              <Link href="/guide/anytime-mailbox-tutorial">教程</Link>
              <span>/</span>
              <strong>Anytime Mailbox 注册教程</strong>
            </nav>
            <h1>2026 Anytime Mailbox(ATMB) 注册教程：筛选美国真实住宅地址避坑指南</h1>
            <p className="addresses-hero-copy">
              想申请美国信用卡、银行开户或注册美国公司，第一步往往是租一个美国地址。本文手把手讲解如何在
              Anytime Mailbox(ATMB) 注册，并用 RDI、CMRA 与街景筛选出更接近真实私人住宅的地址，避开商业与 CMRA 地址。
            </p>
          </div>
        </section>

        <section className="addresses-inner addresses-section">
          <div className="guide-prose">
            <nav className="guide-toc" aria-label="目录">
              <strong>本文目录</strong>
              <ol>
                <li><a href="#what">一、Anytime Mailbox 是什么，适合谁</a></li>
                <li><a href="#why-residential">二、为什么要选 RDI Residential / CMRA No 地址</a></li>
                <li><a href="#filter-fast">三、手动逐个查太累：用工具几秒筛好</a></li>
                <li><a href="#steps">四、注册与选址完整步骤</a></li>
                <li><a href="#pitfalls">五、选地址避坑要点</a></li>
                <li><a href="#activate">六、激活：还需要 1583 公证</a></li>
                <li><a href="#faq">七、常见问题</a></li>
              </ol>
            </nav>

            <h2 id="what">一、Anytime Mailbox 是什么，适合谁</h2>
            <p>
              Anytime Mailbox（常简称 <strong>ATMB</strong>）是一个美国虚拟邮箱地址平台：你租用某个实体地址下的一个邮箱号，
              即可用它接收信件，并通过房东提供的「打开扫描、转发、回收、销毁、本地自提」等服务远程处理邮件。
            </p>
            <p>常见用途包括：申请美国信用卡与本土银行卡、银行开户、注册美国公司、跨境电商收款与收件、接收平台信函等。</p>

            <h2 id="why-residential">二、为什么要选 RDI Residential / CMRA No 地址</h2>
            <p>
              同一平台同时收录大量<strong>商业地址</strong>。判断一个地址是否更接近真实私人住宅，主要看两个指标：
            </p>
            <ul>
              <li><strong>RDI</strong>（Residential Delivery Indicator）：显示 <strong>Residential</strong> 表示更接近住宅投递，Commercial 则为商业。</li>
              <li><strong>CMRA</strong>（Commercial Mail Receiving Agency）：显示 <strong>N / No</strong> 表示未被标记为商业邮件接收代理。</li>
            </ul>
            <p>
              一般来说，<strong>RDI = Residential 且 CMRA = No</strong> 的地址更值得优先考虑。部分银行与发卡方在风控时对
              CMRA 地址更敏感，容易导致申请被拒——但具体政策以官方为准。
            </p>
            <div className="guide-callout">
              提示：RDI、CMRA 来自 USPS 与 Smarty 等第三方验证结果，仅用于缩小候选范围，不构成是否能成功开户的承诺。
            </div>

            <h2 id="filter-fast">三、手动逐个查太累：用工具几秒筛好</h2>
            <p>
              如果一个一个地址打开 USPS、Smarty 去核对 RDI/CMRA，公开教程里有人<strong>花了一个半小时</strong>才找到一个合规地址。
              本站已经把全站 Anytime Mailbox 地址的 RDI、CMRA、价格与邮箱编号范围批量整理好，并默认过滤出 RDI Residential 候选，
              省去逐个查询的时间。
            </p>
            <div className="guide-cta">
              <div>
                <strong>直接筛选已过滤 RDI Residential 的地址</strong>
                <span>支持 CMRA、关键词与价格二次筛选，配合街景判断。</span>
              </div>
              <Link href="/residential-addresses">
                去筛选住宅地址
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <h2 id="steps">四、注册与选址完整步骤</h2>
            <ol>
              {steps.map((step) => (
                <li key={step.name}>
                  <strong>{step.name}：</strong>
                  {step.text}
                </li>
              ))}
            </ol>

            <h2 id="pitfalls">五、选地址避坑要点</h2>
            <ul>
              <li>
                <strong>加盟制房东：</strong>Anytime Mailbox 由各地址房东自行定价与定权益，价格相同的两个地址，
                免费扫描页数、转发手续费、存放时长可能差别很大，务必点开 <strong>Full Details</strong> 对比。
              </li>
              <li>
                <strong>留意滞留与碎纸费：</strong>信件/包裹免费存放超时会产生滞留费，部分房东碎纸也收费。
              </li>
              <li>
                <strong>不同业务对州/地址要求不同：</strong>个别银行或发卡方会限定地址所在州或类型，
                以你要办理业务的官方要求为准，先确认再选址。
              </li>
              <li>
                <strong>可选二次确认：</strong>把候选地址填进 Capital One 等信用卡申请表，能顺利进入下一步通常说明地址可用；
                若出现红色报错多为商业地址需更换——仅作辅助参考，不代表一定能开户。
              </li>
              <li>
                <strong>价格策略：</strong>不同地址房东定价不同，常见 US$7.99–9.99/月，低至约 US$5.99，高端 US$20–30+，
                以页面实时价格为准；建议先月付体验再决定是否转年付。
              </li>
            </ul>

            <h2 id="activate">六、激活：还需要 1583 公证</h2>
            <p>
              支付成功后地址还不能马上正式使用——你需要完成 <strong>USPS Form 1583</strong> 公证，授权房东代收信件，审核通过后邮箱才启用。
            </p>
            <div className="guide-callout">
              2026 最新变化：Anytime Mailbox 现在<strong>只接受在线视频公证</strong>（如 OneNotary，约 US$25），
              本地公证、淘宝及第三方代办出具的 1583 已不再被认可；地址证明要求也有收紧（例如驾照翻译件可能无法通过审核）。
              具体渠道、证件与避坑见下一篇教程。
            </div>
            <div className="guide-cta">
              <div>
                <strong>下一步：USPS Form 1583 在线公证教程</strong>
                <span>Notarize / Proof 流程、自助公证省钱、无 SSN 路径与被拒原因。</span>
              </div>
              <Link href="/guide/usps-form-1583">
                查看 1583 公证教程
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

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
              本文为第三方教程，仅供学习参考，非 Anytime Mailbox 官方内容。平台流程、价格与各银行政策可能随时调整，请以官方页面为准。
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
