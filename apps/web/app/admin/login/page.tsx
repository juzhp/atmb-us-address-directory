import type { Metadata } from 'next';
import { LockKeyhole } from 'lucide-react';

import { AdminLoginForm } from '../_components/AdminLoginForm';

export const metadata: Metadata = {
  title: '后台登录 | ATMB 地址筛选后台',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginPage() {
  return (
    <main className="admin-login-page">
      <header className="admin-login-topbar">
        <div className="admin-login-brand">
          <div className="admin-login-brand-mark" aria-hidden="true">
            <img className="admin-login-logo-image" src="/assets/site-logo.svg" alt="" />
          </div>
          <div>
            <div className="admin-login-brand-title">ATMB 地址筛选后台</div>
            <div className="admin-login-brand-subtitle">Residential Address Admin</div>
          </div>
        </div>
      </header>

      <section className="admin-login-stage" aria-label="后台登录">
        <div className="admin-login-card">
          <div className="admin-login-inner">
            <div className="admin-login-heading">
              <div className="admin-login-emblem" aria-hidden="true">
                <LockKeyhole size={30} strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="admin-login-title">后台登录</h1>
                <div className="admin-login-subtitle">ATMB Admin</div>
              </div>
            </div>

            <AdminLoginForm />
            <p className="admin-login-note">登录后进入地址管理后台</p>
          </div>
        </div>
      </section>
    </main>
  );
}
