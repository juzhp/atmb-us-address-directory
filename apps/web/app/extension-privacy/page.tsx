import type { Metadata } from 'next';
import Link from 'next/link';

import { getPublicHeadCode } from '../_lib/public-head-code';
import { PublicHeadCode } from '../_components/PublicHeadCode';
import { SiteFooter, SiteHeader } from '../_components/SiteShell';

export const revalidate = 86400;

const CONTACT_EMAIL = 'juzhpcom@gmail.com';
const EFFECTIVE_DATE = '2026-11-05';

export const metadata: Metadata = {
  title: 'usaddres 地址助手隐私政策 | Privacy Policy',
  description:
    'usaddres 地址助手（Chrome / Edge 浏览器扩展）的隐私政策：扩展处理哪些数据、发送到哪里、保存在哪里，以及推荐链接说明。',
  alternates: {
    canonical: '/extension-privacy',
  },
};

export default async function ExtensionPrivacyPage() {
  const headCode = await getPublicHeadCode();

  return (
    <>
      <PublicHeadCode headCode={headCode} />
      <SiteHeader />
      <main className="site-main addresses-page">
        <section className="addresses-hero">
          <div className="addresses-inner">
            <nav className="addresses-breadcrumb" aria-label="面包屑">
              <Link href="/">首页</Link>
              <span>/</span>
              <strong>扩展隐私政策</strong>
            </nav>
            <h1>usaddres 地址助手隐私政策</h1>
            <p className="addresses-hero-copy">
              适用于 Chrome 与 Edge 浏览器扩展「ATMB / iPostal1 美国住宅地址筛选 - usaddres」（扩展内显示为「usaddres 地址助手」）。生效日期：{EFFECTIVE_DATE}。English version below.
            </p>
          </div>
        </section>

        <section className="addresses-inner addresses-section">
          <div className="guide-prose">
            <h2 id="zh">一、扩展做什么</h2>
            <p>
              当你打开 Anytime Mailbox 或 iPostal1 的地址页面时，扩展会在页面上的每个地址旁显示 usaddres.com 已整理的信息：RDI、CMRA、USPS CMRA、C1
              预审、价格、邮箱编号范围和地址黑名单记录，并提供筛选、本地隐藏和实时查询入口。这是扩展唯一的用途。
            </p>

            <h2>二、扩展处理哪些数据</h2>
            <ul>
              <li>
                <strong>页面上显示的地址。</strong>
                为了查出对应信息，扩展会把当前页面上列出的邮箱地址文本和平台自带的地址编号发送到
                usaddres.com 的查询接口。这些是平台公开展示的商业地址，不是你的个人信息；请求不带账号、Cookie 或任何能识别你身份的标识。
              </li>
              <li>
                <strong>网络请求的常规信息。</strong>
                和访问任何网站一样，服务器会看到请求的 IP 地址和时间，用于限制过于频繁的查询以及常规的服务器日志；不会用它建立用户画像。
              </li>
              <li>
                <strong>只保存在你浏览器里的数据。</strong>
                扩展的开关设置、筛选条件、你隐藏的地址、查询结果的短时缓存，以及上一次通过推荐链接访问各平台的时间。它们存放在浏览器的扩展存储中；其中开关设置会随浏览器自带的同步功能在你自己的设备间同步。我们无法读取这些数据。
              </li>
            </ul>
            <p>扩展不收集姓名、邮箱、密码、支付信息、浏览历史、定位，也不读取这两个平台之外的网页内容。</p>

            <h2>三、实时查询</h2>
            <p>
              当你点击「Smarty 实时查询」或「USPS 实时查询」时，扩展会在你的浏览器里打开 Smarty 官网的地址验证页面或 USPS 的 ZIP
              查询页面，替你填入该地址并提交，再把页面显示的结果带回原页面。这相当于你自己在这些网站上查询，相关数据由对应网站按其各自的隐私政策处理。不点击就不会发生。
            </p>

            <h2>四、推荐链接说明</h2>
            <p>
              扩展里两个平台的功能默认关闭。当你手动开启某个平台后，扩展会通过 usaddres 的推荐链接打开该平台（此后大约每 30
              天一次）。如果你随后在该平台开通服务，我们可能获得推荐佣金，这不会增加你的费用。你可以随时在扩展弹窗里关闭对应平台。
            </p>

            <h2>五、我们不会做的事</h2>
            <ul>
              <li>不出售、不出租、不向第三方转让任何数据。</li>
              <li>不投放广告，不接入统计或追踪脚本。</li>
              <li>不加载或执行远程代码，扩展的全部代码都在安装包内。</li>
              <li>不把数据用于与上述用途无关的目的，也不用于信用评估或放贷。</li>
            </ul>

            <h2>六、如何删除数据</h2>
            <p>
              在扩展弹窗中可以清除查询缓存和隐藏记录；卸载扩展会删除它保存在浏览器里的全部数据。服务器端不保存与你个人相关的记录。
            </p>

            <h2>七、联系我们</h2>
            <p>
              对本政策有疑问，请发邮件至 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。政策如有变更会更新本页并修改生效日期。
            </p>

            <h2 id="en">Privacy Policy (English)</h2>
            <p>
              This policy applies to the browser extension &quot;ATMB / iPostal1 美国住宅地址筛选 - usaddres&quot; (shown as &quot;usaddres 地址助手&quot; inside the extension) for Chrome and Edge. Effective date:{' '}
              {EFFECTIVE_DATE}.
            </p>
            <h3>What the extension does</h3>
            <p>
              On Anytime Mailbox and iPostal1 address pages, the extension shows information that usaddres.com has compiled for each listed mailbox address: RDI,
              CMRA, USPS CMRA, Capital One address pre-check, price, mailbox number range and community-reported blacklist records. It also offers filtering,
              local hiding and on-demand live lookups. This is its single purpose.
            </p>
            <h3>Data handled</h3>
            <ul>
              <li>
                <strong>Addresses shown on the page.</strong> To look up the information, the extension sends the mailbox address text and the platform&apos;s own
                location identifiers shown on the current page to the usaddres.com lookup API. These are publicly listed commercial addresses, not your personal
                information. Requests carry no account, cookie or personal identifier.
              </li>
              <li>
                <strong>Standard request information.</strong> As with any website, the server sees the IP address and time of a request. This is used for rate
                limiting and ordinary server logs, not for profiling.
              </li>
              <li>
                <strong>Data kept only in your browser.</strong> Extension settings, filter choices, addresses you hide, a short-lived lookup cache, and the time
                of the last visit through a referral link for each platform. They stay in the browser&apos;s extension storage; settings may sync between your own
                devices through the browser&apos;s built-in sync. We cannot access this data.
              </li>
            </ul>
            <p>
              The extension does not collect names, email addresses, passwords, payment details, browsing history or location, and does not read pages outside the
              two supported platforms.
            </p>
            <h3>Live lookups</h3>
            <p>
              When you click &quot;Smarty 实时查询&quot; or &quot;USPS 实时查询&quot;, the extension opens Smarty&apos;s address verification page or the USPS ZIP Code Lookup
              page in your browser, fills in that address, submits it, and brings the displayed result back. This is equivalent to you using those sites
              yourself; they process the data under their own privacy policies. Nothing happens unless you click.
            </p>
            <h3>Affiliate disclosure</h3>
            <p>
              Both platforms are turned off by default. After you turn a platform on, the extension opens that platform through a usaddres referral link (about
              once every 30 days afterwards). If you later purchase a service there, we may earn a referral commission at no extra cost to you. You can turn a
              platform off at any time in the extension popup.
            </p>
            <h3>What we do not do</h3>
            <ul>
              <li>We do not sell, rent or transfer data to third parties.</li>
              <li>We do not show ads or use analytics or tracking scripts.</li>
              <li>We do not load or execute remote code; all code ships inside the extension package.</li>
              <li>We do not use data for purposes unrelated to the extension&apos;s single purpose, or for creditworthiness or lending decisions.</li>
            </ul>
            <h3>Deleting data</h3>
            <p>
              You can clear the lookup cache and hidden-address records in the extension popup. Uninstalling the extension removes everything it stored in your
              browser. No personal records are kept on the server.
            </p>
            <h3>Contact</h3>
            <p>
              Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Changes will be posted on this page with an updated effective
              date.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
