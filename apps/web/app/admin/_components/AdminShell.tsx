'use client';

import type { AdminUserProfile } from '@atmb/shared';
import {
  ChevronDown,
  KeyRound,
  ListChecks,
  LogOut,
  MapPinned,
  Settings,
  TableProperties,
} from 'lucide-react';
import { FormEvent, ReactNode, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { PUBLIC_API_BASE_URL } from '../../lib/api';
import { AdminToastStack, useAdminToasts } from './AdminToast';

const navItems = [
  { href: '/admin/addresses', label: '地址管理', icon: TableProperties },
  { href: '/admin/tasks', label: '任务管理', icon: ListChecks },
  { href: '/go/get-us-residential-address', label: '获得美国住宅地址', icon: MapPinned, external: true },
  { href: '/admin/settings', label: '系统设置', icon: Settings },
];

const githubUrl = 'https://github.com/juzhp/atmb-us-address-directory';

export function AdminShell({ children, user }: { children: ReactNode; user: AdminUserProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useAdminToasts();

  function logout() {
    startTransition(async () => {
      await fetch(`${PUBLIC_API_BASE_URL}/api/admin/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/admin/login');
      router.refresh();
    });
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      showToast('两次输入的新密码不一致', 'error');
      return;
    }

    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(body?.message ?? '修改密码失败', 'error');
        return;
      }

      showToast('密码已更新', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOpen(false);
    });
  }

  function closePasswordDialog() {
    setPasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="admin-app">
      <AdminToastStack toasts={toasts} onDismiss={dismissToast} />
      <header className="admin-header">
        <div className="admin-header-inner">
          <a className="admin-header-brand" href="/admin/addresses">
            <img src="/assets/site-logo.svg" alt="" />
            <span className="admin-brand-text">
              <span className="admin-brand-title">ATMB 地址筛选后台</span>
              <span className="admin-brand-subtitle">Residential Address Admin</span>
            </span>
          </a>

          <nav className="admin-nav" aria-label="后台导航">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = !item.external && pathname === item.href;
              return (
                <a
                  key={item.href}
                  className={[
                    'admin-nav-link',
                    active ? 'active' : '',
                    item.external ? 'external' : '',
                  ].filter(Boolean).join(' ')}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noreferrer' : undefined}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          <div className="admin-header-actions">
            <a className="admin-icon-link" href={githubUrl} target="_blank" rel="noreferrer" aria-label="GitHub">
              <GitHubMark />
            </a>
            <div className="admin-user-menu">
              <button className="admin-user-button" type="button" onClick={() => setMenuOpen((open) => !open)}>
                <span className="admin-user-avatar">{getUserInitial(user)}</span>
                <span className="admin-user-name">{user.displayName || user.username}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div className="admin-user-dropdown">
                  <button type="button" onClick={() => { setPasswordOpen(true); setMenuOpen(false); }}>
                    <KeyRound size={16} aria-hidden="true" />
                    修改密码
                  </button>
                  <button className="logout" type="button" onClick={logout}>
                    <LogOut size={16} aria-hidden="true" />
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {children}

      {passwordOpen ? (
        <div className="admin-modal-backdrop" role="presentation">
          <form className="admin-password-dialog" onSubmit={changePassword}>
            <div className="admin-dialog-heading">
              <h2>修改密码</h2>
              <button type="button" onClick={closePasswordDialog}>关闭</button>
            </div>
            <label>
              <span>当前密码</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              <span>新密码</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              <span>确认新密码</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <div className="admin-dialog-actions">
              <button type="button" onClick={closePasswordDialog}>取消</button>
              <button className="primary" disabled={isPending} type="submit">保存</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function getUserInitial(user: AdminUserProfile) {
  return (user.displayName || user.username || 'A').slice(0, 1).toUpperCase();
}

function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.5 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.38-3.37-1.38-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.93.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.93c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .28.18.6.69.5A10.09 10.09 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
