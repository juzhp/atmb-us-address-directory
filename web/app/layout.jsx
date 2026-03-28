import "./globals.css";
import { getSiteUrl } from "../lib/site.js";

export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "ATMB 美国住宅地址目录",
  description:
    "收录 Anytime Mailbox 美国地址，帮助你快速筛选更适合租用的美国住宅地址、美国私人地址与真实美国地址。",
  applicationName: "ATMB 美国住宅地址目录",
  alternates: {
    canonical: "/"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
