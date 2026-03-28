import { SiteShell } from "../../components/site-shell.jsx";
import { getAdminSession } from "../../lib/admin-auth.js";
import { LogoutButton } from "./logout-button.jsx";
import shellStyles from "../../components/site-shell.module.css";

const adminLinks = [
  { href: "/admin/locations", label: "地址管理" },
  { href: "/admin/smarty-tokens", label: "Smarty 密钥" }
];

const adminFooterLinks = [
  { href: "/admin/locations", label: "地址管理" },
  { href: "/admin/smarty-tokens", label: "Smarty 密钥" },
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
            <LogoutButton className={shellStyles.navButton} />
          </div>
        ) : null
      }
    >
      {children}
    </SiteShell>
  );
}
