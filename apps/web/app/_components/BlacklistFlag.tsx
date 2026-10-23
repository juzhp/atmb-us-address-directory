import { ShieldAlert } from 'lucide-react';

// 地址被后台标注到黑名单后显示的警示图标，点击跳到黑名单页并搜出对应记录
export function BlacklistFlag({ href }: { href: string | null }) {
  if (!href) {
    return null;
  }

  return (
    <a className="addresses-unsafe-flag" href={href} title="该地址有用户反馈的问题，点击查看黑名单记录" aria-label="查看该地址的黑名单记录">
      <ShieldAlert size={15} aria-hidden="true" />
    </a>
  );
}
