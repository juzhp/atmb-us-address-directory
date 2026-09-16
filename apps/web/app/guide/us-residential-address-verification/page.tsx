import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { getPublicHeadCode } from '../../_lib/public-head-code';
import { PublicHeadCode } from '../../_components/PublicHeadCode';
import { SiteFooter, SiteHeader } from '../../_components/SiteShell';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: '2026 美国住宅地址验证教程 | Capital One 地址预审 / Smarty RDI CMRA / USPS CMRA / 街景四步核验',
  description:
    '手把手教你判断一个美国地址是真实私人住宅还是商业 CMRA 地址：用 Capital One 地址预审核（C1 预审）、Smarty 查 RDI 与 CMRA、USPS 工具查 CMRA、Google 街景看外观，四步交叉验证，附通过与拒绝的真实截图。适合申请美国信用卡、银行开户前选址。',
  alternates: {
    canonical: '/guide/us-residential-address-verification',
  },
  keywords: [
    '美国地址验证',
    '美国住宅地址识别',
    'Capital One 地址预审',
    'C1 预审',
    'Smarty RDI',
    'USPS CMRA 查询',
    '美国私人地址',
    '美国商业地址',
    'RDI Residential',
    'CMRA',
    '美国信用卡地址',
    '美国银行开户地址',
  ],
  openGraph: {
    title: '2026 美国住宅地址验证教程 | Capital One 预审 · Smarty · USPS · 街景四步核验',
    description: '四个免费工具交叉验证一个美国地址是否为真实私人住宅，附 Capital One 通过与被拒的截图样例。',
    type: 'article',
    locale: 'zh_CN',
  },
};

const steps = [
  {
    name: 'Capital One 地址预审（C1 预审）',
    text: '打开 Capital One 信用卡预审页面，前两步可跳过或随意填写，第三步在 Residential address 填入候选地址后点 Next。能进入下一步即通过；地址框下方出现红字提示则被拒。到这一步即可停止，不要继续填写真实身份信息。',
  },
  {
    name: 'Smarty 查 RDI 与 CMRA',
    text: '在 Smarty 的单地址查询工具输入地址，查看 Analyzed Output：RDI 显示 Residential、CMRA 显示 N 为目标；RDI 为 Commercial 或 CMRA 为 Y 直接排除。',
  },
  {
    name: 'USPS 工具查 CMRA',
    text: '在 USPS ZIP Code Lookup 按地址查询，展开结果看 COMMERCIAL MAIL RECEIVING AGENCY：N 可用，Y 排除。',
  },
  {
    name: 'Google 街景看外观',
    text: '在 Google Maps 进入街景，核对墙上门牌号与地址一致，确认是普通民宅而不是商铺、写字楼或仓库。街景只作参考，不能单独下结论。',
  },
];

const faqs = [
  {
    question: 'Capital One 地址预审通过，就一定能申请成功吗？',
    answer:
      '不能。C1 预审只说明这个地址在 Capital One 的申请表里能提交，不会被判定为商业邮件接收代理；最终是否获批还取决于信用记录、身份验证等因素，也不代表其它银行或发卡方的结果。',
  },
  {
    question: 'Smarty 显示 Residential，Capital One 却拒绝，以哪个为准？',
    answer:
      '两边用的地址库并不同步。Smarty 的 RDI 和 CMRA 来自 USPS 投递数据，Capital One 有自己的风控库。出现这种情况时，这个地址用于 Capital One 会被拦下，用于其它用途仍可结合另外几项判断。',
  },
  {
    question: 'RDI 显示 Commercial 的地址一定不能用吗？',
    answer:
      'Commercial 表示 USPS 把它当作商业投递点，通常是写字楼、商铺或仓库。用于注册公司或接收商业信件没有问题，但用于信用卡、银行开户等个人业务被拒的概率明显更高。',
  },
  {
    question: 'Google 街景能单独作为判断依据吗？',
    answer:
      '不能。街景可能是几年前的画面，一栋普通民宅也可能在做收信业务。街景适合在前三项通过后做最后一道外观核对，或者用来排除明显的商铺和仓库。',
  },
  {
    question: '本站列表里的 CMRA 和 USPS CMRA 有什么区别？',
    answer:
      'CMRA 来自 Smarty 地址验证结果，USPS CMRA 是 USPS 工具直接查到的标记，对应本文的第二步和第三步。两者都是 N 时更接近普通住宅场景。',
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
        { '@type': 'ListItem', position: 3, name: '美国住宅地址验证教程' },
      ],
    },
    {
      '@type': 'HowTo',
      name: '美国住宅地址四步验证：Capital One 预审、Smarty、USPS、Google 街景',
      description: '用四个免费工具交叉验证一个美国地址是否为真实私人住宅，避开商业与 CMRA 地址。',
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

export default async function UsResidentialAddressVerificationPage() {
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
              <strong>美国住宅地址验证教程</strong>
            </nav>
            <h1>2026 美国住宅地址验证四步教程：Capital One 地址预审、Smarty RDI/CMRA、USPS CMRA 与 Google 街景</h1>
            <p className="addresses-hero-copy">
              租到的美国地址到底是私人住宅，还是已经被标记的商业收件点，直接决定信用卡、银行开户申请能不能顺利提交。
              本文用四个免费工具交叉验证同一个地址，每一步都附真实截图，包括 Capital One 通过与被拒的两种结果。
            </p>
          </div>
        </section>

        <section className="addresses-inner addresses-section">
          <div className="guide-prose">
            <nav className="guide-toc" aria-label="目录">
              <strong>本文目录</strong>
              <ol>
                <li><a href="#types">一、住宅地址、商业地址与 CMRA 是什么</a></li>
                <li><a href="#overview">二、四步核验一览</a></li>
                <li><a href="#capital-one">三、第一步：Capital One 地址预审（C1 预审）</a></li>
                <li><a href="#smarty">四、第二步：Smarty 查 RDI 与 CMRA</a></li>
                <li><a href="#usps">五、第三步：USPS 工具查 CMRA</a></li>
                <li><a href="#street-view">六、第四步：Google 街景看外观</a></li>
                <li><a href="#decision">七、结果怎么综合判断</a></li>
                <li><a href="#shortcut">八、不想逐个查：直接用筛好的列表</a></li>
                <li><a href="#faq">九、常见问题</a></li>
              </ol>
            </nav>

            <h2 id="types">一、住宅地址、商业地址与 CMRA 是什么</h2>
            <p>先把三个经常混在一起的概念分开，后面每一步看的都是它们：</p>
            <ul>
              <li>
                <strong>住宅地址（RDI = Residential）：</strong>USPS 按住宅投递的普通民宅。适合接收个人信件、作为信用卡与银行开户地址、用作地址证明。
              </li>
              <li>
                <strong>商业地址（RDI = Commercial）：</strong>写字楼、商铺、仓库等按商业投递的地址。注册公司、接收商业信函没问题，用于个人金融业务容易被风控。
              </li>
              <li>
                <strong>CMRA（Commercial Mail Receiving Agency）：</strong>商业邮件接收代理，也就是替客户收信的门店或信箱服务点。USPS 会给这类地址打上 CMRA 标记，多数发卡行和银行会直接拒绝。
              </li>
            </ul>
            <p>
              另外，P.O. Box 邮政信箱本身就不是街道地址，同样不能当住宅地址使用。
            </p>
            <p>
              虚拟邮箱平台上的地址大多本来就是 CMRA 或商业地址。但由于平台是加盟经营、USPS 与各家银行的数据库更新并不同步，
              总有一部分地址在这些系统里还没有被标记，看起来就是一栋普通住宅。<strong>这类地址才值得花时间去挑，而挑出来靠的就是下面四步。</strong>
            </p>

            <h2 id="overview">二、四步核验一览</h2>
            <ol>
              <li><strong>Capital One 地址预审：</strong>看申请表在地址这一步会不会被拦。目标：顺利进入下一步。</li>
              <li><strong>Smarty：</strong>看 RDI 与 CMRA。目标：RDI = Residential 且 CMRA = N。</li>
              <li><strong>USPS ZIP Code Lookup：</strong>看 COMMERCIAL MAIL RECEIVING AGENCY。目标：N。</li>
              <li><strong>Google 街景：</strong>看门牌与外观。目标：门牌一致、是民宅。</li>
            </ol>
            <p>
              建议按这个顺序做：Capital One 一步就能刷掉大部分被标记的地址；Smarty 与 USPS 互相印证；街景放在最后做外观核对。
              四项都通过的地址优先级最高。
            </p>

            <h2 id="capital-one">三、第一步：Capital One 地址预审（C1 预审）</h2>
            <p>
              Capital One 的信用卡预审页面在填地址时会实时校验地址类型，这是目前最直接的一道"能不能提交"测试。
              本站列表里的 <strong>C1 预审</strong> 字段记录的就是这一步的结果。
            </p>
            <ol>
              <li>打开 Capital One 官网的信用卡 pre-approval 入口，点击 Get Started。</li>
              <li>第一步的问题可以选择 Skip，第二步的姓名随意填写，这两步只是为了走到地址页。</li>
              <li>第三步在 <strong>Residential address</strong> 输入候选地址（街道、城市、州、ZIP），点击 Next。</li>
            </ol>
            <div className="guide-figure-grid">
              <figure className="guide-figure">
                <Image
                  src="/assets/guide/c1-1-015356.png"
                  alt="Capital One 地址预审通过：填写地址后点击 Next 直接进入下一步"
                  width={1000}
                  height={895}
                  sizes="(max-width: 680px) 100vw, 420px"
                />
                <figcaption><strong>通过：</strong>地址框为绿色边框，点击 Next 后直接进入第 4 步，说明 Capital One 接受这个地址。</figcaption>
              </figure>
              <figure className="guide-figure">
                <Image
                  src="/assets/guide/c1-2-015356.png"
                  alt="Capital One 地址预审被拒：地址框下方出现红色提示，不接受商业邮件接收代理地址"
                  width={999}
                  height={976}
                  sizes="(max-width: 680px) 100vw, 420px"
                />
                <figcaption><strong>被拒：</strong>地址框下方出现红字，提示不接受商业邮件接收代理地址，要求改用实际居住地址。这个地址在 Capital One 已被标记为 CMRA。</figcaption>
              </figure>
            </div>
            <div className="guide-callout">
              做到地址这一步就可以停止，不要继续填写 SSN 等真实身份信息。预审通过只代表这个地址能提交，不代表申请会获批。
              Capital One 的地址库和 USPS、Smarty 并不同步，所以会出现 Smarty 显示 Residential 但这里被拒的情况，以这里的结果为准去判断 Capital One 的可用性。
            </div>

            <h2 id="smarty">四、第二步：Smarty 查 RDI 与 CMRA</h2>
            <p>
              Smarty 是地址验证服务商，官网提供免费的单地址查询工具，不用写代码。输入地址后点击 View results，在右侧 Analysis 的
              <strong> Analyzed Output</strong> 里找两项：
            </p>
            <ul>
              <li><strong>RDI：</strong>Residential 表示住宅投递，Commercial 表示商业投递。</li>
              <li><strong>CMRA：</strong>N 表示未被标记为商业邮件接收代理，Y 表示已被标记。</li>
            </ul>
            <figure className="guide-figure">
              <Image
                src="/assets/guide/c1-3-015356.png"
                alt="Smarty 单地址查询结果：RDI 显示 Residential，CMRA 显示 N"
                width={2116}
                height={1708}
                sizes="(max-width: 900px) 100vw, 860px"
              />
              <figcaption>Smarty 查询结果中，红框标出的 RDI = Residential、CMRA = N 就是我们要的组合；Vacant = N 说明该地址目前有人投递。</figcaption>
            </figure>
            <p>
              本站列表里的 <strong>RDI</strong> 与 <strong>CMRA</strong> 两列对应的就是这一步。任何一项不达标（RDI = Commercial 或 CMRA = Y），都不建议再往下花时间。
            </p>

            <h2 id="usps">五、第三步：USPS 工具查 CMRA</h2>
            <p>
              USPS 官网的 ZIP Code Lookup 支持按地址查询，结果里直接给出 CMRA 标记，可以和 Smarty 的结果互相印证。
              选择 ZIP Code by Address，输入街道、城市、州后点击 Find，展开结果卡片。
            </p>
            <figure className="guide-figure">
              <Image
                src="/assets/guide/c1-4-015356.png"
                alt="USPS ZIP Code Lookup 查询结果：COMMERCIAL MAIL RECEIVING AGENCY 显示 N"
                width={1756}
                height={1320}
                sizes="(max-width: 900px) 100vw, 860px"
              />
              <figcaption>USPS 结果中红框标出的 COMMERCIAL MAIL RECEIVING AGENCY = N，表示 USPS 没有把它记为收件代理点；显示 Y 则直接排除。</figcaption>
            </figure>
            <p>本站列表里的 <strong>USPS CMRA</strong> 字段对应的就是这一项。</p>

            <h2 id="street-view">六、第四步：Google 街景看外观</h2>
            <p>
              前三项看的都是数据库，街景看的是这栋房子本身。在 Google Maps 搜索地址，切换到街景，重点核对两件事：
            </p>
            <ul>
              <li><strong>门牌号一致：</strong>墙上或信箱上的号码要和你查询的地址对得上，避免街景定位到隔壁。</li>
              <li><strong>外观是民宅：</strong>独栋、联排或公寓都可以；出现店招、卷帘门、装卸区、一整面墙的信箱格，通常是商铺、仓库或收件门店。</li>
            </ul>
            <figure className="guide-figure">
              <Image
                src="/assets/guide/c1-5-015356.png"
                alt="Google 街景：民宅外墙上的门牌号与查询地址一致"
                width={1701}
                height={1105}
                sizes="(max-width: 900px) 100vw, 860px"
              />
              <figcaption>街景里红框标出的门牌号与搜索地址一致，建筑是普通独栋民宅，没有任何商业痕迹。</figcaption>
            </figure>
            <div className="guide-callout">
              街景只做参考：画面可能是几年前拍的，一栋普通民宅也可能在做收信业务。它适合在前三项通过后做最后一道外观核对，或者用来排除明显的商铺和仓库。
            </div>

            <h2 id="decision">七、结果怎么综合判断</h2>
            <ul>
              <li><strong>四项全部通过：</strong>优先候选，可以进入注册和公证流程。</li>
              <li><strong>Smarty、USPS 都通过，但 Capital One 被拒：</strong>Capital One 的库里已经标记了它。用于 Capital One 会被拦下；其它发卡行或非金融用途可以结合自身需求考虑。</li>
              <li><strong>Smarty CMRA = Y 或 USPS CMRA = Y：</strong>基本可以判定为收件代理点，不建议用于信用卡与银行开户。</li>
              <li><strong>RDI = Commercial：</strong>商业投递地址，注册公司可以，个人金融业务谨慎。</li>
              <li><strong>街景像商铺或仓库：</strong>即使前三项通过也要降级，优先换一个。</li>
            </ul>
            <div className="guide-callout">
              以上四项都是辅助判断，各家银行和发卡方的地址库、风控规则随时会变，任何一项通过都不构成"一定能开户"的保证。
            </div>

            <h2 id="shortcut">八、不想逐个查：直接用筛好的列表</h2>
            <p>
              一个地址走完四步大约要五到十分钟，平台上一个州就有几十上百个地址。本站已经把 Anytime Mailbox 全站地址的
              <strong> RDI、CMRA、USPS CMRA、C1 预审</strong> 和价格、邮箱编号范围整理成列表，可以直接按"USPS CMRA = N 且 C1 预审通过"筛选，
              再用街景做最后核对。
            </p>
            <div className="guide-cta">
              <div>
                <strong>直接筛选 USPS CMRA = N 且 C1 预审通过的住宅地址</strong>
                <span>列表默认只显示 RDI Residential，徽章上悬停可看每项的更新时间。</span>
              </div>
              <Link href="/residential-addresses?usps=N&c1=pass">
                去筛选住宅地址
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="guide-cta">
              <div>
                <strong>选好地址后：Anytime Mailbox 注册与 1583 公证</strong>
                <span>注册、选套餐、支付与在线公证的完整步骤。</span>
              </div>
              <Link href="/guide/anytime-mailbox-tutorial">
                查看注册教程
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <h2 id="faq">九、常见问题</h2>
            <div className="addresses-faq">
              {faqs.map((faq) => (
                <article key={faq.question}>
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </article>
              ))}
            </div>

            <div className="guide-callout">
              本文为第三方教程，仅供学习参考，与 Capital One、Smarty、USPS、Google 及 Anytime Mailbox 均无关联。各平台页面、规则与银行政策可能随时调整，请以官方页面为准。
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
