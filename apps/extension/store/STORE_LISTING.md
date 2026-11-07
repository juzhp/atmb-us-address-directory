# ATMB / iPostal1 美国住宅地址筛选 - usaddres · 上架资料（v1.0.0）

Chrome Web Store 与 Microsoft Edge Add-ons 共用同一个安装包和同一套素材。本文件里的文案可以直接复制到两个商店的后台。

## 0. 提交前检查

- [ ] **网站已部署到线上**，`https://usaddres.com/extension-privacy` 能打开（隐私政策页，本次新增，两个商店都要填这个地址）。
- [ ] 重新打包：`npm run package --workspace @atmb/extension`，产物是 `apps/extension/release/usaddres-extension-v1.0.0.zip`。
- [ ] 用这个 zip 解压后的内容在 Chrome 和 Edge 各「加载已解压的扩展程序」走一遍：开启平台开关、看到数据条、筛选、隐藏、实时查询。
- [ ] 开发者账号：Chrome Web Store 需一次性 5 美元注册费；Edge Add-ons（Partner Center）免费。

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 名称（35 字符） | ATMB / iPostal1 美国住宅地址筛选 - usaddres |
| 短名称（工具栏等窄处显示） | usaddres |
| 简短说明（来自 manifest，88 字符） | 选 Anytime Mailbox(ATMB) / iPostal1 美国地址时，直接显示 RDI、CMRA、USPS CMRA、C1 预审与黑名单，快速筛出美国真实住宅地址。 |
| 版本 | 1.0.0 |
| 语言 | 中文（简体）。商店后台的语言不是手选的，由包里的 `default_locale: zh_CN` 和 `_locales/zh_CN/messages.json` 决定；名称、短名称、简短说明都从这个文件读，改文案改它，`manifest.json` 里只保留 `__MSG_…__` 占位 |
| Chrome 类别 | 工具（Tools） |
| Edge 类别 | Productivity |
| 官方网址 | https://usaddres.com/ |
| 隐私政策网址 | https://usaddres.com/extension-privacy |
| 支持邮箱 | juzhpcom@gmail.com |
| 成人内容 | 否 |

## 2. 详细说明（中文，贴到商店「说明」）

```text
在 Anytime Mailbox 和 iPostal1 上挑美国地址时，直接在页面上看到每个地址的关键信息，不用再来回切换查询。

【能看到什么】
• RDI：住宅（Residential）还是商业（Commercial）
• CMRA 与 USPS CMRA：是否被标记为商业邮件接收代理
• C1 预审：Capital One 地址预审核是否通过
• 价格、邮箱编号范围
• 地址黑名单：其他用户反馈过的问题（被银行、信用卡或平台拒绝等）

【怎么用】
1. 点击工具栏图标，在弹窗里开启需要的平台（默认关闭）。
2. 打开 Anytime Mailbox 的州列表页、地址详情页，或 iPostal1 的地址选择页。
3. 每个地址旁会出现一枚小芯片，颜色一眼区分：绿色住宅、黄色有风险项、红色在黑名单、灰色未收录；点击展开完整信息。

【帮你更快筛选】
• 列表顶部的筛选栏：按收录状态、RDI、CMRA、USPS CMRA、C1 预审、黑名单筛选。
• 本地隐藏：不想再看的地址点「隐藏」，只记在你自己的浏览器里，随时可以找回或清空。
• 实时查询：展开后可以一键在新标签页查询 Smarty 和 USPS 的公开查询页面，结果会带回到当前卡片。

【关于推荐链接】
开启某个平台后，扩展会通过 usaddres 的推荐链接打开该平台（此后大约每 30 天一次）。如果你随后在该平台开通服务，我们可能获得推荐佣金，这不会增加你的费用。不开启就不会发生，随时可以在弹窗里关闭。

【隐私】
扩展只把页面上显示的邮箱地址发送到 usaddres.com 用于查询，不收集你的个人信息，不含广告和统计代码。详见隐私政策：https://usaddres.com/extension-privacy

【说明】
本扩展由 usaddres.com 提供，是第三方工具，与 Anytime Mailbox、iPostal1、Smarty、USPS、Capital One 均无隶属关系。所有数据仅供辅助判断，最终结果以各平台和金融机构的实际审核为准。
```

## 3. Detailed description (English，审核人员阅读或以后加英文语言时用)

```text
See the key facts about every US mailbox address right on the page while you browse Anytime Mailbox and iPostal1.

What you see
• RDI: Residential or Commercial
• CMRA and USPS CMRA flags
• Capital One address pre-check result
• Price and mailbox number range
• Community blacklist: issues other users reported (rejected by banks, card issuers or platforms)

How it works
1. Click the toolbar icon and turn on the platform you want (both are off by default).
2. Open an Anytime Mailbox state list or location page, or the iPostal1 location picker.
3. A small chip appears next to each address: green for residential, amber for risk flags, red for blacklisted, grey for not in our data. Click it for details.

Extras
• A filter bar on list pages (recorded, RDI, CMRA, USPS CMRA, pre-check, blacklist).
• Hide addresses locally; hidden items stay in your browser only and can be restored or cleared.
• On-demand live lookup: opens Smarty's public address verification page or the USPS ZIP Code Lookup page in a new tab, fills in the address and brings the displayed result back to the card.

Affiliate disclosure
After you turn a platform on, the extension opens that platform through a usaddres referral link (about once every 30 days). If you later purchase a service there, we may earn a referral commission at no extra cost to you. Nothing happens unless you turn a platform on, and you can turn it off at any time.

Privacy
The extension only sends the mailbox addresses shown on the page to usaddres.com for lookup. It collects no personal information and contains no ads or analytics. Privacy policy: https://usaddres.com/extension-privacy

Disclaimer
This is a third-party tool by usaddres.com. It is not affiliated with Anytime Mailbox, iPostal1, Smarty, USPS or Capital One. All data is for reference only.
```

## 4. 图片素材

| 用途 | 文件 | 规格 | Chrome | Edge |
| --- | --- | --- | --- | --- |
| 商店图标 | `store/assets/store-icon-128x128.png` | 128×128 | 包内自带，后台也可上传 | — |
| 商店徽标 | `store/assets/store-logo-300x300.png` | 300×300 | — | 必填 |
| 小宣传图 | `store/assets/promo-small-440x280.png` | 440×280，无透明 | 建议上传 | 可选 |
| 大宣传图 | `store/assets/promo-marquee-1400x560.png` | 1400×560，无透明 | 可选 | 可选（Edge 要 1400×560） |
| 截图 1 | `store/screenshots/01-atmb-list.png` | 1280×800 | 至少 1 张，最多 5 张 | 最多 6 张 |
| 截图 2 | `store/screenshots/02-live-lookup.png` | 1280×800 | | |
| 截图 3 | `store/screenshots/03-ipostal1-list.png` | 1280×800 | | |
| 截图 4 | `store/screenshots/04-popup.png` | 1280×800 | | |

截图说明（上传时可填）：

1. Anytime Mailbox 州列表：每个地址旁的芯片和顶部筛选栏
2. 展开数据条，Smarty 实时查询结果直接显示在卡片里
3. iPostal1 地址选择页：同样的芯片、数据条和筛选栏
4. 弹窗：按平台开启、显示设置、清理与快捷入口

宣传图和弹窗展示图由 `node scripts/make-store-assets.mjs` 生成；图标或文案变了重新跑一次即可。截图 1–3 是真实页面截图，界面有变化时需要重新截。

## 5. Chrome Web Store「隐私权规范」页签

### 单一用途（Single purpose）

```text
Show address-quality information (RDI, CMRA, USPS CMRA, Capital One pre-check, price, mailbox range and community blacklist records) next to each US mailbox address on Anytime Mailbox and iPostal1 pages, with filtering, local hiding and on-demand live lookups for those same addresses.
```

### 权限理由（Permission justification）

| 权限 | 填写内容 |
| --- | --- |
| storage | `Stores the user's settings (which platforms are enabled, display options), the per-page filter choice, the list of addresses the user chose to hide, a 15-minute lookup cache, and the time of the last referral-link visit per platform. All of it stays in the browser.` |
| tabs | `Used only for actions the user triggers: opening the Smarty / USPS lookup page in a new tab for a live lookup and returning to the original tab with the result; opening a platform through the referral link when the user turns that platform on or it expires (about every 30 days); and reloading the current tab after the user clears the cache in the popup. The extension does not read the user's tab list or history.` |
| 主机权限 `https://usaddres.com/*` | `The background service worker sends the mailbox addresses shown on the current page to the usaddres.com lookup API (POST /api/public/extension/lookup) and receives the address-quality data to display.` |
| 内容脚本 `www.anytimemailbox.com`、`ipostal1.com`、`www.ipostal1.com` | `Reads the mailbox addresses listed on these pages and inserts the information chip, detail strip and filter bar next to them. This is the extension's core function.` |
| 内容脚本 `www.smarty.com/products/us-address-verification*`、`tools.usps.com/zip-code-lookup.htm*`、`zh-tools.usps.com/zip-code-lookup.htm*` | `Only active in a tab the extension itself opened after the user clicked "Smarty 实时查询" or "USPS 实时查询". It fills the address into the page's own lookup form, submits it, reads the result shown on the page and passes it back to the original tab. It does nothing when the user visits these pages on their own.` |

### 远程代码（Remote code）

选择「否，我没有使用远程代码」。全部 JS 都打包在安装包里，没有 `eval`、没有外链脚本。

### 数据使用（Data usage）

- 勾选的数据类别：**网站内容（Website content）**——页面上显示的邮箱地址文本会发送到 usaddres.com 用于查询。
- 其他类别（个人身份信息、健康、财务、身份验证、个人通讯、位置、网络记录、用户活动）均**不勾选**。
  - 说明：服务器和访问任何网站一样会看到请求的 IP，用于限频和常规日志，隐私政策里已写明；它不是扩展主动收集的数据，所以不归入「位置」。如果想更保守，可以把「位置」也勾上，不影响功能。
- 三项声明全部勾选：
  - 不向第三方出售或转让用户数据（获批用途除外）
  - 不为与单一用途无关的目的使用或转让用户数据
  - 不为确定信用度或放贷目的使用或转让用户数据

### 隐私政策网址

`https://usaddres.com/extension-privacy`

## 6. 推荐链接披露

Chrome Web Store 的「Affiliate Ads」政策要求：

1. 推荐（联盟）行为必须在**商店页面**、**扩展界面**和**安装前**都清楚说明；
2. 每次加入推荐代码、链接或 Cookie 之前，需要有相关的**用户操作**。

现状对照：

| 要求 | 现状 |
| --- | --- |
| 商店页面说明 | 已满足：第 2、3 节的说明里有「关于推荐链接」一段 |
| 隐私政策说明 | 已满足：`/extension-privacy` 第四节 |
| 扩展界面说明 | 已满足：弹窗「启用平台」开关下方有一行「开启后会通过 usaddres 推荐链接打开该平台，不影响价格。」 |
| 用户操作 | 首次：用户手动打开开关，满足。之后每 30 天进入平台时自动重新走一次推荐链接，没有再次操作，属于灰色地带 |

如果审核对「30 天自动续」有意见，可以改成到期后在页面上显示「点击启用」芯片，由用户点一下再走推荐链接（代码里已有这枚芯片，改动很小）。

## 7. 给审核人员的测试说明（Chrome 的「Test instructions」/ Edge 的「Notes for certification」）

```text
No account or login is required.

1. Click the extension icon. In the popup, turn on "在 Anytime Mailbox 启用" (Anytime Mailbox) and/or "在 iPostal1 启用" (iPostal1). Both are off by default. Turning one on opens that platform once through our referral link (disclosed in the listing and the privacy policy).
2. Open https://www.anytimemailbox.com/l/usa/alabama . A chip appears under every address and a filter bar appears above the list. Click a chip to expand the detail strip.
3. For iPostal1, open https://ipostal1.com/choose-digital-mailbox-location.php , pick a state and a city; chips appear on each location card.
4. In an expanded strip, "Smarty 实时查询" opens Smarty's public address verification page in a background tab, submits the address through the page's own form and shows the result in the strip. "USPS 实时查询" does the same with the USPS ZIP Code Lookup page.
5. "隐藏" hides an address locally; use the "已隐藏" filter to list hidden addresses and restore them. The popup can clear all hidden records.

The extension is a third-party helper by usaddres.com and is not affiliated with the sites it runs on. All code is bundled; no remote code is loaded.
```

## 8. Edge Add-ons（Partner Center）填写对照

| 页面 | 字段 | 内容 |
| --- | --- | --- |
| Packages | 上传 | 同一个 `usaddres-extension-v1.0.0.zip` |
| Availability | 可见性 / 市场 | Public，全部市场 |
| Properties | Category | Productivity |
| Properties | Privacy policy requirements | 选「是」，URL 填 `https://usaddres.com/extension-privacy` |
| Properties | Website URL | https://usaddres.com/ |
| Properties | Support contact | juzhpcom@gmail.com |
| Properties | Mature content | 否 |
| Store listings（中文简体） | Description | 第 2 节 |
| Store listings | Extension Store logo | `store-logo-300x300.png` |
| Store listings | Small promotional tile | `promo-small-440x280.png` |
| Store listings | Large promotional tile | `promo-marquee-1400x560.png` |
| Store listings | Screenshots | 4 张截图 |
| Store listings | Search terms | 美国住宅地址、美国地址、地址验证、RDI、CMRA、ATMB、iPostal1 |
| Submit | Notes for certification | 第 7 节 |

## 9. 其他可能被问到的点

- **「读取浏览记录」提示**：`tabs` 权限在安装时会显示这句标准提示。实际只用于打开/切换/关闭查询标签页和按需刷新当前页，理由见第 5 节。
- **在第三方网站上自动操作**：实时查询会在 Smarty、USPS 的页面上自动填表并提交。说明里已如实写出；这两个站点如果调整页面或加强限制，功能可能失效，卡片会提示超时或未加载。
- **品牌名称**：名称里带了 ATMB、iPostal1 两个平台词，用来命中这两个词的搜索，属于「说明适用网站」的用法，说明末尾有「无隶属关系」的声明。这是有意的取舍：如果审核以商标或误导为由退回，或者平台方投诉，就把名称换成不带平台词的备用名 `美国住宅地址助手：RDI/CMRA 地址验证 - usaddres`（平台词仍保留在简短说明里），改 `manifest.json` 的 `name` 后重新打包即可。弹窗和工具栏显示的仍是「usaddres 地址助手」/「usaddres」。
- **审核时长**：Chrome 通常 1–3 个工作日，带 `tabs` 和多站点内容脚本的扩展可能进入更长的人工审核；Edge 通常 1–7 个工作日。
- **发版**：以后每次更新把 `manifest.json` 和 `package.json` 的版本号一起加一，再跑 `npm run package`。
