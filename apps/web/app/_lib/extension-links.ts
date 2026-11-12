// 浏览器扩展「usaddres 地址助手」的商店链接与站内页面；网站上凡是提到扩展的地方都从这里取
export const CHROME_EXTENSION_ID = 'dpkphdjaeijbhdoljooclpdpegdbiafm';
export const EDGE_EXTENSION_ID = 'hoeichopnfmmkkknpaapolkaocpkdkjd';

export const CHROME_STORE_URL = `https://chromewebstore.google.com/detail/${CHROME_EXTENSION_ID}`;
// Edge 加载项商店的正式地址带名称 slug（「atmb-ipostal1-美国住宅地址筛选-」的 URL 编码）
export const EDGE_STORE_URL = `https://microsoftedge.microsoft.com/addons/detail/atmb-ipostal1-%E7%BE%8E%E5%9B%BD%E4%BD%8F%E5%AE%85%E5%9C%B0%E5%9D%80%E7%AD%9B%E9%80%89-/${EDGE_EXTENSION_ID}`;

export const EXTENSION_PAGE_PATH = '/extension';
// 列表页点实时查询但没装扩展时跳到这里：扩展页上介绍实时查询的那一节
export const EXTENSION_LIVE_LOOKUP_URL = `${EXTENSION_PAGE_PATH}#live-lookup`;
