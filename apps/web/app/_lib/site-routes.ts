export const SITE_URL = 'https://usaddres.com';

export const publicRoutes = [
  {
    path: '/',
    priority: 1,
    title: '美国住宅地址筛选工具',
    summary:
      '首页。用 RDI、CMRA、街景与价格辅助筛选 Anytime Mailbox(ATMB) 美国真实住宅地址，可按州、RDI、CMRA 三个核心条件直接跳转到地址列表。',
  },
  {
    path: '/addresses',
    priority: 0.9,
    title: 'Anytime Mailbox 美国地址大全',
    summary:
      '全站收录地址的搜索与筛选页。支持关键词、州、RDI、CMRA、USPS CMRA、C1 预审与价格区间组合筛选，结果分页展示。',
  },
  {
    path: '/residential-addresses',
    priority: 0.9,
    title: '美国真实住宅地址（RDI Residential）',
    summary: '已默认过滤 RDI = Residential 的地址精选页，可再按州、CMRA、USPS CMRA、C1 预审与关键词二次筛选。',
  },
  {
    path: '/guide/anytime-mailbox-tutorial',
    priority: 0.8,
    title: 'Anytime Mailbox(ATMB) 注册教程',
    summary: '从选州、筛选真实住宅地址到选套餐、支付、激活的全流程教程，含避开商业与 CMRA 地址的判断方法。',
  },
  {
    path: '/guide/usps-form-1583',
    priority: 0.8,
    title: 'USPS Form 1583 在线公证教程',
    summary:
      '激活 Anytime Mailbox 美国地址所需的 USPS Form 1583 公证教程：仅接受在线视频公证（OneNotary），含所需证件、无 SSN 路径与常见被拒原因。',
  },
  {
    path: '/guide/us-residential-address-verification',
    priority: 0.8,
    title: '美国住宅地址验证教程',
    summary:
      '用 Capital One 地址预审核、Smarty 的 RDI 与 CMRA、USPS CMRA 工具与 Google 街景四步交叉验证，判断一个美国地址是真实私人住宅还是商业 CMRA 地址。',
  },
] as const;
