import Link from "next/link";
import { SiteShell } from "../../components/site-shell.jsx";
import { getAdminSession } from "../../lib/admin-auth.js";
import { LogoutButton } from "./logout-button.jsx";
import shellStyles from "../../components/site-shell.module.css";

const adminLinks = [
  { href: "/admin/locations", label: "地址管理" },
  { href: "/admin/smarty-tokens", label: "Smarty 密钥" },
  { href: "/admin/settings", label: "设置" }
];

const adminFooterLinks = [
  { href: "/admin/locations", label: "地址管理" },
  { href: "/admin/smarty-tokens", label: "Smarty 密钥" },
  { href: "/admin/settings", label: "设置" },
  { href: "/admin/password", label: "修改密码" },
  { href: "/admin/login", label: "重新登录" }
];

export default async function AdminLayout({ children }) {
  const user = await getAdminSession();

  return (
    <SiteShell
      navLinks={adminLinks}
      footerLinks={adminFooterLinks}
      rightSlot={
        user ? (
          <div className={shellStyles.userMeta}>
            <span className={shellStyles.userName}>{user.username}</span>
            <Link href="/admin/password" className={shellStyles.navButtonLink}>
              修改密码
            </Link>
            <LogoutButton className={shellStyles.navButton} />
          </div>
        ) : null
      }
    >
      {children}
    </SiteShell>
  );
}
