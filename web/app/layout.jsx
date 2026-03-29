import "./globals.css";
import { fetchPublicSiteSettings } from "../lib/api.js";
import { renderCustomHeadCode } from "../lib/head-code.js";
import { getSiteUrl } from "../lib/site.js";

export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "ATMB 美国住宅地址目录",
  description:
    "收录 Anytime Mailbox 美国地址，帮助你快速筛选更适合租用的美国住宅地址、美国私人地址与真实美国地址。",
  applicationName: "ATMB 美国住宅地址目录",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  },
  alternates: {
    canonical: "/"
  }
};

export default async function RootLayout({ children }) {
  let headCode = "";

  try {
    const settings = await fetchPublicSiteSettings();
    headCode = settings?.headCode ?? "";
  } catch {
    headCode = "";
  }

  return (
    <html lang="zh-CN">
      <head>{renderCustomHeadCode(headCode)}</head>
      <body>{children}</body>
    </html>
  );
}
