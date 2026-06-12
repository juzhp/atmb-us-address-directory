'use client';

import type { LoginResponse } from '@atmb/shared';
import { AlertCircle, ArrowRight, LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { PUBLIC_API_BASE_URL } from '../../lib/api';

export function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const canSubmit = username.trim().length > 0 && password.length > 0 && !isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('请输入账号和密码');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ username: username.trim(), password }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { message?: string } | null;
          setError(body?.message ?? '登录失败，请检查账号和密码');
          return;
        }

        await response.json() as LoginResponse;
        router.push('/admin/addresses');
        router.refresh();
      } catch {
        setError('无法连接后台服务，请确认 API 服务已启动');
      }
    });
  }

  return (
    <form className="admin-login-form" onSubmit={handleSubmit}>
      <label className="admin-login-field">
        <span className="admin-login-field-label">账号</span>
        <span className="admin-login-input-wrap">
          <UserRound size={20} strokeWidth={2.2} aria-hidden="true" />
          <input
            className="admin-login-input"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="请输入账号"
          />
        </span>
      </label>

      <label className="admin-login-field">
        <span className="admin-login-field-label">密码</span>
        <span className="admin-login-input-wrap">
          <LockKeyhole size={20} strokeWidth={2.2} aria-hidden="true" />
          <input
            className="admin-login-input"
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入密码"
          />
        </span>
      </label>

      {error ? (
        <div className="admin-login-error" role="alert">
          <AlertCircle size={18} strokeWidth={2.2} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <button className="admin-login-button" disabled={!canSubmit} type="submit">
        <span>{isPending ? '登录中' : '登录'}</span>
        <ArrowRight size={20} strokeWidth={2.3} aria-hidden="true" />
      </button>
    </form>
  );
}
