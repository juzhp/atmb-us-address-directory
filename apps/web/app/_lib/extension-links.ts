// 浏览器扩展「usaddres 地址助手」的商店链接与站内页面；网站上凡是提到扩展的地方都从这里取
export const CHROME_EXTENSION_ID = 'dpkphdjaeijbhdoljooclpdpegdbiafm';
export const EDGE_EXTENSION_ID = 'hoeichopnfmmkkknpaapolkaocpkdkjd';

export const CHROME_STORE_URL = `https://chromewebstore.google.com/detail/${CHROME_EXTENSION_ID}`;
export const EDGE_STORE_URL = `https://microsoftedge.microsoft.com/addons/detail/${EDGE_EXTENSION_ID}`;
// Edge 商店仍在审核：通过后改为 true，扩展页的 Edge 安装按钮会直接指向商店
export const EDGE_STORE_LIVE = false;

export const EXTENSION_PAGE_PATH = '/extension';
// 列表页点实时查询但没装扩展时跳到这里：扩展页上介绍实时查询的那一节
export const EXTENSION_LIVE_LOOKUP_URL = `${EXTENSION_PAGE_PATH}#live-lookup`;
