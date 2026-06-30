import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { getPublicHeadCode } from '../../_lib/public-head-code';
import { PublicHeadCode } from '../../_components/PublicHeadCode';
import { SiteFooter, SiteHeader } from '../../_components/SiteShell';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'USPS Form 1583 在线公证教程（2026最新）| Anytime Mailbox 仅接受在线公证（OneNotary）避坑',
  description:
    'Anytime Mailbox 激活美国地址必备的 USPS Form 1583 公证教程（2026 最新）：现在仅接受在线视频公证（OneNotary，约 US$25），本地公证与淘宝/第三方代办已不被认可；含所需证件、地址证明变化、无 SSN 路径与常见被拒原因。',
  alternates: {
    canonical: '/guide/usps-form-1583',
  },
  keywords: [
    'USPS Form 1583',
    '1583公证',
    '1583在线公证',
    'OneNotary',
    'Anytime Mailbox 公证',
    '美国地址公证',
    '在线视频公证',
    '无SSN公证',
    '地址证明保单',
    '1583被拒',
  ],
  openGraph: {
    title: 'USPS Form 1583 在线公证教程（2026）| Anytime Mailbox 仅接受在线公证',
    description: '现在只接受在线视频公证（OneNotary，约 US$25），本地与第三方代办已不被认可。',
    type: 'article',
    locale: 'zh_CN',
  },
};

const steps = [
  {
    name: '了解 1583 的作用',
    text: 'USPS Form 1583 用于正式授权邮箱地址房东（CMRA）代你接收邮件，是 Anytime Mailbox 地址激活的前提。',
  },
  {
    name: '确认只能在线公证',
    text: '截至 2026 年，Anytime Mailbox 仅接受在线视频公证。本地公证、淘宝及其他第三方机构代办出具的 1583 已不再被认可。',
  },
  {
    name: '准备证件与地址证明',
    text: '身份核验通常用护照与身份证（及翻译件）。地址证明要求收紧：过去常用的驾照翻译件可能无法通过审核，目前较稳妥的是提供与表格地址一致的英文地址证明（例如英文版保险保单）。如无 SSN，按流程选择「没有」。',
  },
  {
    name: '在平台预生成 1583 表格',
    text: '在 Anytime Mailbox 的验证流程中填写个人信息（用途选个人、护照签发地填省份等），系统会预生成 1583 表格 PDF 供下载。',
  },
  {
    name: '通过 OneNotary 在线公证',
    text: '使用 Anytime Mailbox 内置/推荐的在线公证渠道（OneNotary，onenotary.us/anytime-mailbox），费用约 US$25，全程英文视频通话，需要一定英文沟通能力。',
  },
  {
    name: '身份核验与视频公证',
    text: '上传预生成的 1583 PDF，按提示允许摄像头/麦克风，用手机扫码拍摄护照与证件照片完成生物核验，再进入与公证员的视频会议确认 1583 并电子签名。',
  },
  {
    name: '付款并提交审核',
    text: '完成后付款下载带双方签名的 1583 PDF，按 Anytime Mailbox 要求上传该文件与身份/地址证明，等待审核通过即可启用地址。',
  },
];

const faqs = [
  {
    question: '现在还能找淘宝或本地公证办 1583 吗？',
    answer:
      '不行。2026 年起 Anytime Mailbox 只接受在线视频公证，淘宝、本地公证及其他外部机构出具的 1583 已不被认可，需通过其认可的在线公证渠道（如 OneNotary）完成。',
  },
  {
    question: '1583 在线公证大概多少钱？',
    answer:
      '通过 OneNotary 等在线视频公证一次约 US$25（以平台实时报价为准），全程英文视频，需要基础英文沟通能力。',
  },
  {
    question: '没有 SSN 可以做 1583 公证吗？',
    answer:
      '可以。流程中会询问是否有 SSN，非美国居民选择「没有」，并使用护照、身份证（及翻译件）等完成身份核验。具体以公证平台与房东要求为准。',
  },
  {
    question: '地址证明应该用什么？驾照翻译件还行吗？',
    answer:
      '地址证明要求已收紧，过去常用的驾照翻译件可能无法通过审核。目前较稳妥的做法是提供与表格地址一致的英文地址证明，例如英文版保险保单（车险/家财险）。请以 Anytime Mailbox 与公证平台的最新要求为准。',
  },
  {
    question: '1583 审核被拒常见原因有哪些？',
    answer:
      '常见原因包括：表格信息与证件不一致、证件或地址证明照片不清晰、地址证明不符合最新要求（如驾照翻译件被拒）、使用了已不被认可的本地或第三方公证等。提交前逐项核对可降低被拒概率。',
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
        { '@type': 'ListItem', position: 3, name: 'USPS Form 1583 公证教程' },
      ],
    },
    {
      '@type': 'HowTo',
      name: 'USPS Form 1583 在线公证教程（2026 最新）',
      description: '完成 Anytime Mailbox 地址激活所需的 USPS Form 1583 在线视频公证完整步骤。',
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

export default async function Usps1583GuidePage() {
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
              <strong>USPS Form 1583 公证教程</strong>
            </nav>
            <h1>USPS Form 1583 在线公证教程（2026 最新）：Anytime Mailbox 激活避坑</h1>
            <p className="addresses-hero-copy">
              在 Anytime Mailbox 租到合适的美国住宅地址后，还需完成 USPS Form 1583 公证才能正式启用。
              2026 年起平台只接受在线视频公证——本文讲解最新流程、所需证件、地址证明变化、无 SSN 路径与常见被拒原因。
            </p>
          </div>
        </section>

        <section className="addresses-inner addresses-section">
          <div className="guide-prose">
            <div className="guide-callout">
              重要变化：Anytime Mailbox 现在<strong>只接受在线视频公证</strong>（如 OneNotary）。
              <strong>本地公证、淘宝及其他第三方代办出具的 1583 已不再被认可</strong>，且地址证明要求收紧（驾照翻译件可能无法通过）。
            </div>

            <nav className="guide-toc" aria-label="目录">
              <strong>本文目录</strong>
              <ol>
                <li><a href="#what">一、1583 是什么，为什么必须做</a></li>
                <li><a href="#changes">二、2026 最新变化：哪些方法已不支持</a></li>
                <li><a href="#prepare">三、准备材料（含地址证明与无 SSN 路径）</a></li>
                <li><a href="#steps">四、在线公证完整步骤</a></li>
                <li><a href="#rejection">五、常见被拒原因避坑</a></li>
                <li><a href="#faq">六、常见问题</a></li>
              </ol>
            </nav>

            <h2 id="what">一、1583 是什么，为什么必须做</h2>
            <p>
              <strong>USPS Form 1583</strong> 是美国邮政要求的授权表：当你委托商业邮件接收代理（CMRA，即 Anytime Mailbox 房东）
              代收信件时，必须通过经公证的 1583 表格授权对方。没有完成 1583 公证，租来的地址无法正式启用。
            </p>

            <h2 id="changes">二、2026 最新变化：哪些方法已不支持</h2>
            <ul>
              <li><strong>仅在线视频公证：</strong>平台现在只接受在线视频公证，<strong>本地公证已停止接受</strong>。</li>
              <li><strong>第三方代办不被认可：</strong>淘宝等渠道代办、外部公证机构单独出具的 1583，Anytime Mailbox 已不再认可。</li>
              <li><strong>地址证明收紧：</strong>过去常用的<strong>驾照翻译件可能无法通过审核</strong>，需改用与表格地址一致的英文地址证明（如英文版保单）。</li>
            </ul>

            <h2 id="prepare">三、准备材料（含地址证明与无 SSN 路径）</h2>
            <ul>
              <li><strong>身份证明：</strong>护照与身份证（及翻译件），用于在线身份核验。</li>
              <li><strong>地址证明（已收紧）：</strong>建议提供与 1583 表格地址一致的英文地址证明，常见做法是用英文版保险保单（车险/家财险，淘宝几十元一年）。</li>
              <li><strong>无 SSN：</strong>流程会询问是否有 SSN，没有就如实选择「没有」，按非居民路径继续。</li>
              <li><strong>设备：</strong>带摄像头/麦克风的电脑用于视频公证，手机用于扫码拍摄证件；需要基础英文沟通能力。</li>
            </ul>

            <h2 id="steps">四、在线公证完整步骤</h2>
            <ol>
              {steps.map((step) => (
                <li key={step.name}>
                  <strong>{step.name}：</strong>
                  {step.text}
                </li>
              ))}
            </ol>

            <h2 id="rejection">五、常见被拒原因避坑</h2>
            <ul>
              <li>表格信息与证件不一致（姓名拼写、生日、地址）。</li>
              <li>证件或地址证明照片模糊、反光或边角缺失。</li>
              <li>地址证明不符合最新要求（如驾照翻译件被拒），未提供与表格一致的英文地址证明。</li>
              <li>使用了已不被认可的本地或第三方公证。</li>
              <li>提交前未逐项核对，建议公证前再对一遍姓名、地址与证件。</li>
            </ul>

            <div className="guide-cta">
              <div>
                <strong>还没选好地址？先筛选真实住宅地址</strong>
                <span>已过滤 RDI Residential 的 Anytime Mailbox 地址，配合 CMRA 与街景判断。</span>
              </div>
              <Link href="/residential-addresses">
                去筛选住宅地址
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <h2 id="faq">六、常见问题</h2>
            <div className="addresses-faq">
              {faqs.map((faq) => (
                <article key={faq.question}>
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </article>
              ))}
            </div>

            <div className="guide-callout">
              本文为第三方教程，仅供学习参考，非 Anytime Mailbox、USPS 或任何公证平台的官方内容。平台流程、价格与公证/证件要求可能随时调整，请以官方最新说明为准。
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
