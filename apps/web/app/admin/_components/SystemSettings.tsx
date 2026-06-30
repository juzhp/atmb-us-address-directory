'use client';

import type {
  AdminProxyListItem,
  AdminProxyListResponse,
  AdminProxyResponse,
  AdminSystemSettings,
  AdminSystemSettingsResponse,
  HeadCodeCheckResponse,
  UpdateFrequencyDays,
  UpdateMinute,
} from '@atmb/shared';
import {
  CheckCircle2,
  Code2,
  Plus,
  Power,
  Trash2,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState, useTransition } from 'react';

import { PUBLIC_API_BASE_URL } from '../../lib/api';
import { AdminToastStack, useAdminToasts } from './AdminToast';

const frequencyOptions = [1, 2, 3, 4, 5, 10] as const;
const hours = Array.from({ length: 24 }, (_, index) => index);
const minutes = [0, 30] as const;

export function SystemSettings() {
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null);
  const [smartyForm, setSmartyForm] = useState({
    authId: '',
    authToken: '',
    remainingCredits: '',
    monthlyUsed: '',
  });
  const [proxies, setProxies] = useState<AdminProxyListItem[]>([]);
  const [proxyForm, setProxyForm] = useState({
    url: '',
    note: '',
  });
  const [scheduleForm, setScheduleForm] = useState({
    autoUpdateEnabled: true,
    updateFrequencyDays: '1',
    updateHour: '8',
    updateMinute: '30',
  });
  const [headCode, setHeadCode] = useState('');
  const [headCheck, setHeadCheck] = useState<HeadCodeCheckResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useAdminToasts();

  useEffect(() => {
    startTransition(loadSettings);
  }, []);

  const activeProxyCount = proxies.filter((proxy) => proxy.isActive).length;

  const updateLabel = useMemo(() => {
    if (!settings?.autoUpdateEnabled || !settings.updateFrequencyDays) {
      return '不更新';
    }
    return `每 ${settings.updateFrequencyDays} 天`;
  }, [settings]);

  async function loadSettings() {
    const [settingsResponse, proxiesResponse] = await Promise.all([
      fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings`, { credentials: 'include' }),
      fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings/proxies`, { credentials: 'include' }),
    ]);

    if (!settingsResponse.ok || !proxiesResponse.ok) {
      setLoadError('加载系统设置失败');
      return;
    }

    setLoadError('');
    applySettings(((await settingsResponse.json()) as AdminSystemSettingsResponse).settings);
    setProxies(((await proxiesResponse.json()) as AdminProxyListResponse).items);
  }

  function applySettings(next: AdminSystemSettings) {
    setSettings(next);
    setSmartyForm({
      authId: next.smartyAuthId,
      authToken: '',
      remainingCredits: next.smartyRemainingCredits === null ? '' : String(next.smartyRemainingCredits),
      monthlyUsed: next.smartyMonthlyUsed === null ? '' : String(next.smartyMonthlyUsed),
    });
    setScheduleForm({
      autoUpdateEnabled: next.autoUpdateEnabled,
      updateFrequencyDays: next.updateFrequencyDays === null ? 'none' : String(next.updateFrequencyDays),
      updateHour: String(next.updateHour),
      updateMinute: String(next.updateMinute),
    });
    setHeadCode(next.headCode);
    setHeadCheck(null);
  }

  function saveSmarty(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings/smarty`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          authId: smartyForm.authId,
          authToken: smartyForm.authToken || undefined,
          remainingCredits: numberOrNull(smartyForm.remainingCredits),
          monthlyUsed: numberOrNull(smartyForm.monthlyUsed),
        }),
      });

      if (!response.ok) {
        showToast('保存 Smarty 配置失败', 'error');
        return;
      }

      const body = (await response.json()) as AdminSystemSettingsResponse;
      applySettings(body.settings);
      showToast('Smarty 配置已保存', 'success');
    });
  }

  function testSmartyConnection() {
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings/smarty/test`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(body?.message ?? '测试连接失败', 'error');
        return;
      }

      const body = (await response.json()) as AdminSystemSettingsResponse;
      applySettings(body.settings);
      showToast('Smarty 连接测试已完成', 'success');
    });
  }


  function createProxy(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings/proxies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: proxyForm.url,
          note: proxyForm.note || null,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(body?.message ?? '保存代理失败', 'error');
        return;
      }

      const body = (await response.json()) as AdminProxyResponse;
      setProxies((current) => [body.item, ...current]);
      setProxyForm({ url: '', note: '' });
      showToast('代理已添加', 'success');
    });
  }

  function updateProxy(proxy: AdminProxyListItem, input: Partial<Pick<AdminProxyListItem, 'url' | 'note' | 'isActive'>>) {
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings/proxies/${proxy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(body?.message ?? '更新代理失败', 'error');
        return;
      }

      const body = (await response.json()) as AdminProxyResponse;
      setProxies((current) => current.map((item) => (item.id === body.item.id ? body.item : item)));
      showToast(body.item.isActive ? '代理已启用' : '代理已暂停', 'success');
    });
  }

  function testProxy(proxy: AdminProxyListItem) {
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings/proxies/${proxy.id}/test`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(body?.message ?? '测试代理失败', 'error');
        return;
      }

      const body = (await response.json()) as AdminProxyResponse;
      setProxies((current) => current.map((item) => (item.id === body.item.id ? body.item : item)));
      showToast(body.item.lastTestStatus === 'success' ? '代理测试通过' : '代理测试失败', body.item.lastTestStatus === 'success' ? 'success' : 'error');
    });
  }

  function deleteProxy(proxy: AdminProxyListItem) {
    if (!window.confirm(`删除代理 ${proxy.url}？`)) return;

    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings/proxies/${proxy.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        showToast('删除代理失败', 'error');
        return;
      }

      setProxies((current) => current.filter((item) => item.id !== proxy.id));
      showToast('代理已删除', 'success');
    });
  }
  function saveSchedule(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    startTransition(async () => {
      const enabled = scheduleForm.autoUpdateEnabled && scheduleForm.updateFrequencyDays !== 'none';
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings/update-schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          autoUpdateEnabled: enabled,
          updateFrequencyDays: enabled ? Number(scheduleForm.updateFrequencyDays) as UpdateFrequencyDays : null,
          updateHour: Number(scheduleForm.updateHour),
          updateMinute: Number(scheduleForm.updateMinute) as UpdateMinute,
        }),
      });

      if (!response.ok) {
        showToast('保存更新设置失败', 'error');
        return;
      }

      const body = (await response.json()) as AdminSystemSettingsResponse;
      applySettings(body.settings);
      showToast('更新设置已保存', 'success');
    });
  }

  function resetSchedule() {
    setScheduleForm({
      autoUpdateEnabled: true,
      updateFrequencyDays: '1',
      updateHour: '8',
      updateMinute: '30',
    });
  }

  function saveHeadCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings/head-code`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ headCode }),
      });

      if (!response.ok) {
        showToast('保存 Head 代码失败', 'error');
        return;
      }

      const body = (await response.json()) as AdminSystemSettingsResponse;
      setSettings(body.settings);
      showToast('Head 代码已保存', 'success');
    });
  }

  function checkHeadCode() {
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings/head-code/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ headCode }),
      });

      if (!response.ok) {
        showToast('格式检查失败', 'error');
        return;
      }

      setHeadCheck((await response.json()) as HeadCodeCheckResponse);
      showToast('Head 代码格式检查完成', 'success');
    });
  }

  function saveAll() {
    saveSmarty();
    saveSchedule();
    saveHeadCode();
  }

  if (!settings) {
    return (
      <main className="admin-page">
        <section className="admin-empty-card">
          <p className="admin-kicker">系统设置</p>
          <p>{loadError || '正在加载系统配置。'}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page admin-settings-page">
      <AdminToastStack toasts={toasts} onDismiss={dismissToast} />
      <section className="admin-page-heading">
        <div>
          <p className="admin-kicker">系统设置</p>
          <p>配置 Smarty API 密钥、查看地址校验剩余额度、设置数据自动更新频率，并维护前台页面的 Head 代码。</p>
        </div>
        <div className="admin-page-actions">
          <button disabled={isPending} type="button" onClick={() => startTransition(loadSettings)}>
            <RefreshCw size={16} aria-hidden="true" />
            刷新额度
          </button>
          <button className="primary" disabled={isPending} type="button" onClick={saveAll}>
            <Save size={16} aria-hidden="true" />
            保存全部设置
          </button>
        </div>
      </section>

      <section className="admin-stats-grid">
        <SettingStat label="Smarty 连接" value={connectionLabel(settings.smartyConnectionStatus)} icon={<ShieldCheck size={21} />} />
        <SettingStat label="剩余额度" value={formatNullableNumber(settings.smartyRemainingCredits)} icon={<CheckCircle2 size={21} />} />
        <SettingStat label="本月已用" value={formatNullableNumber(settings.smartyMonthlyUsed)} icon={<RefreshCw size={21} />} />
        <SettingStat label="更新频率" value={updateLabel} icon={<Settings size={21} />} />
      </section>

      <form className="settings-card" onSubmit={saveSmarty}>
        <div className="settings-card-head">
          <div>
            <h2>Smarty 密钥设置</h2>
            <p>用于获取 RDI、CMRA、地址标准化和连接状态校验。</p>
          </div>
          <span className={`settings-badge ${settings.smartyConnectionStatus}`}>{connectionLabel(settings.smartyConnectionStatus)}</span>
        </div>
        <div className="settings-card-body">
          <div className="settings-form-grid">
            <label>
              <span>Auth ID</span>
              <input
                value={smartyForm.authId}
                onChange={(event) => setSmartyForm((current) => ({ ...current, authId: event.target.value }))}
                placeholder="Smarty Auth ID"
              />
              <small>保存后用于后台任务调用 Smarty API。</small>
            </label>
            <label>
              <span>Auth Token</span>
              <input
                type="password"
                value={smartyForm.authToken}
                onChange={(event) => setSmartyForm((current) => ({ ...current, authToken: event.target.value }))}
                placeholder={settings.hasSmartyAuthToken ? '已保存，输入新 Token 可重置' : 'Smarty Auth Token'}
              />
              <small>Token 加密存储，页面不返回明文。</small>
            </label>
            <label>
              <span>剩余额度</span>
              <input
                inputMode="numeric"
                value={smartyForm.remainingCredits}
                onChange={(event) => setSmartyForm((current) => ({ ...current, remainingCredits: event.target.value }))}
                placeholder="例如 18420"
              />
            </label>
            <label>
              <span>本月已用</span>
              <input
                inputMode="numeric"
                value={smartyForm.monthlyUsed}
                onChange={(event) => setSmartyForm((current) => ({ ...current, monthlyUsed: event.target.value }))}
                placeholder="例如 3716"
              />
            </label>
          </div>
          <div className="settings-inline-status">
            <ShieldCheck size={20} aria-hidden="true" />
            <span>
              <strong>{settings.smartyConnectionMessage ?? connectionStatusCopy(settings)}</strong>
              <small>最后测试：{settings.smartyLastTestedAt ? formatDateTime(settings.smartyLastTestedAt) : '尚未测试'}</small>
            </span>
          </div>
          <div className="settings-card-actions">
            <button disabled={isPending} type="button" onClick={testSmartyConnection}>测试连接</button>
            <button className="primary" disabled={isPending} type="submit">保存 Smarty 配置</button>
          </div>
        </div>
      </form>


      <form className="settings-card" onSubmit={createProxy}>
        <div className="settings-card-head">
          <div>
            <h2>代理库</h2>
            <p>除同步 Smarty 外，抓取任务会从启用的代理中随机选择一个发起 ATMB 请求。</p>
          </div>
          <span className={`settings-badge ${activeProxyCount > 0 ? 'connected' : 'not_configured'}`}>
            {activeProxyCount > 0 ? `${activeProxyCount} 个启用` : '未启用'}
          </span>
        </div>
        <div className="settings-card-body">
          <div className="settings-form-grid proxy-form-grid">
            <label>
              <span>代理地址</span>
              <input
                value={proxyForm.url}
                onChange={(event) => setProxyForm((current) => ({ ...current, url: event.target.value }))}
                placeholder="http://user:pass@host:port"
              />
              <small>支持 HTTP/HTTPS；只填 host:port 时默认按 HTTP 保存。</small>
            </label>
            <label>
              <span>备注</span>
              <input
                value={proxyForm.note}
                onChange={(event) => setProxyForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="用途、来源、有效期"
              />
            </label>
          </div>
          <div className="settings-card-actions">
            <button className="primary" disabled={isPending || !proxyForm.url.trim()} type="submit">
              <Plus size={16} aria-hidden="true" />
              添加代理
            </button>
          </div>

          <div className="proxy-table-wrap">
            {proxies.length ? (
              <table className="admin-address-table proxy-table">
                <thead>
                  <tr>
                    <th>代理</th>
                    <th>状态</th>
                    <th>测试</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {proxies.map((proxy) => (
                    <tr key={proxy.id}>
                      <td>
                        <strong>{proxy.url}</strong>
                        <span>更新：{formatDateTime(proxy.updatedAt)}</span>
                      </td>
                      <td>
                        <span className={`settings-badge ${proxy.isActive ? 'connected' : 'not_configured'}`}>
                          {proxy.isActive ? '启用中' : '已暂停'}
                        </span>
                      </td>
                      <td>
                        <strong>{proxyTestLabel(proxy.lastTestStatus)}</strong>
                        <span>{proxy.lastTestMessage ?? '尚未测试'}</span>
                        {proxy.lastTestSampleAddress ? <span>{proxy.lastTestSampleAddress}</span> : null}
                        {proxy.lastTestedAt ? <span>{formatDateTime(proxy.lastTestedAt)}</span> : null}
                      </td>
                      <td>{proxy.note || '-'}</td>
                      <td>
                        <div className="proxy-actions">
                          <button disabled={isPending} type="button" onClick={() => testProxy(proxy)}>
                            <RefreshCw size={15} aria-hidden="true" />
                            测试
                          </button>
                          <button disabled={isPending} type="button" onClick={() => updateProxy(proxy, { isActive: !proxy.isActive })}>
                            <Power size={15} aria-hidden="true" />
                            {proxy.isActive ? '暂停' : '启用'}
                          </button>
                          <button className="danger" disabled={isPending} type="button" onClick={() => deleteProxy(proxy)}>
                            <Trash2 size={15} aria-hidden="true" />
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="proxy-empty">暂无代理</div>
            )}
          </div>
        </div>
      </form>      <form className="settings-card" onSubmit={saveSchedule}>
        <div className="settings-card-head">
          <div>
            <h2>更新设置</h2>
            <p>控制地址数据、价格、RDI/CMRA 和邮箱编号范围的自动更新节奏。</p>
          </div>
          <span className={`settings-badge ${settings.autoUpdateEnabled ? 'connected' : 'not_configured'}`}>
            {settings.autoUpdateEnabled ? '自动更新中' : '不更新'}
          </span>
        </div>
        <div className="settings-card-body schedule-body">
          <div className={`schedule-panel ${scheduleForm.autoUpdateEnabled && scheduleForm.updateFrequencyDays !== 'none' ? '' : 'paused'}`}>
            <div className="schedule-frequency-card">
              <span className="schedule-section-label">更新频率</span>
              <div className="frequency-options">
                {frequencyOptions.map((day) => (
                  <button
                    key={day}
                    className={scheduleForm.updateFrequencyDays === String(day) && scheduleForm.autoUpdateEnabled ? 'active' : ''}
                    type="button"
                    onClick={() => setScheduleForm((current) => ({
                      ...current,
                      autoUpdateEnabled: true,
                      updateFrequencyDays: String(day),
                    }))}
                  >
                    每 {day} 天
                  </button>
                ))}
                <button
                  className={!scheduleForm.autoUpdateEnabled || scheduleForm.updateFrequencyDays === 'none' ? 'active muted' : 'muted'}
                  type="button"
                  onClick={() => setScheduleForm((current) => ({
                    ...current,
                    autoUpdateEnabled: false,
                    updateFrequencyDays: 'none',
                  }))}
                >
                  不更新
                </button>
              </div>
            </div>
            <div className="schedule-time-card">
              <span className="schedule-section-label">执行时间</span>
              <div className="settings-form-grid schedule">
                <label>
                  <span>更新时间（时）</span>
                  <select
                    value={scheduleForm.updateHour}
                    onChange={(event) => setScheduleForm((current) => ({ ...current, updateHour: event.target.value }))}
                  >
                    {hours.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}</option>)}
                  </select>
                  <small>小时可选 0 - 23。</small>
                </label>
                <label>
                  <span>更新时间（分）</span>
                  <select
                    value={scheduleForm.updateMinute}
                    onChange={(event) => setScheduleForm((current) => ({ ...current, updateMinute: event.target.value }))}
                  >
                    {minutes.map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, '0')}</option>)}
                  </select>
                  <small>分钟仅支持 00 或 30。</small>
                </label>
                <div className="next-run-card">
                  <RefreshCw size={19} aria-hidden="true" />
                  <span>
                    下一次自动更新：{settings.nextRunAt ? formatDateTime(settings.nextRunAt) : '暂停'}
                    <small>后续任务系统会读取当前配置。</small>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="settings-card-actions schedule-actions">
            <button type="button" onClick={resetSchedule}>恢复默认</button>
            <button className="primary" disabled={isPending} type="submit">保存更新设置</button>
          </div>
        </div>
      </form>

      <form className="settings-card" onSubmit={saveHeadCode}>
        <div className="settings-card-head">
          <div>
            <h2>Head 代码管理</h2>
            <p>用于维护全站 SEO、统计验证和自定义 meta/script 代码。</p>
          </div>
          <span className="settings-badge connected">已启用</span>
        </div>
        <div className="settings-card-body">
          <label className="head-code-control">
            <span>全站 Head 代码</span>
            <textarea
              spellCheck={false}
              value={headCode}
              onChange={(event) => {
                setHeadCode(event.target.value);
                setHeadCheck(null);
              }}
              placeholder="<!-- Google Search Console / Analytics / Custom Meta -->"
            />
          </label>
          <div className="editor-meta">
            <span>保存后仅供前台 SEO 页面接入，后台管理页不注入。</span>
            <span>
              {headCheck ? `${headCheck.lineCount} 行 / ${headCheck.characterCount} 字符` : `${headCode.length ? headCode.split(/\r\n|\r|\n/).length : 0} 行 / ${headCode.length} 字符`}
            </span>
          </div>
          {headCheck?.warnings.length ? (
            <ul className="settings-warnings">
              {headCheck.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : null}
          <div className="settings-card-actions">
            <button type="button" onClick={checkHeadCode}>格式检查</button>
            <button className="primary" disabled={isPending} type="submit">保存 Head 代码</button>
          </div>
        </div>
      </form>
    </main>
  );
}

function SettingStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="admin-stat-card settings-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="settings-stat-icon">{icon}</div>
    </div>
  );
}

function numberOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function proxyTestLabel(status: AdminProxyListItem['lastTestStatus']) {
  if (status === 'success') return '测试通过';
  if (status === 'failed') return '测试失败';
  return '尚未测试';
}
function connectionLabel(status: AdminSystemSettings['smartyConnectionStatus']) {
  if (status === 'connected') return '已连接';
  if (status === 'failed') return '连接失败';
  return '未配置';
}

function connectionStatusCopy(settings: AdminSystemSettings) {
  if (settings.smartyConnectionStatus === 'connected') return 'Smarty US Street API 校验通过';
  if (settings.smartyConnectionStatus === 'failed') return 'Smarty 连接测试失败';
  return '保存 Auth ID 和 Auth Token 后可测试连接';
}

function formatNullableNumber(value: number | null) {
  return value === null ? '-' : value.toLocaleString();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
