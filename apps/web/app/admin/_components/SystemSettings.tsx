'use client';

import type {
  AdminSystemSettings,
  AdminSystemSettingsResponse,
  HeadCodeCheckResponse,
  UpdateFrequencyDays,
  UpdateMinute,
} from '@atmb/shared';
import {
  CheckCircle2,
  Code2,
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

  const updateLabel = useMemo(() => {
    if (!settings?.autoUpdateEnabled || !settings.updateFrequencyDays) {
      return '不更新';
    }
    return `每 ${settings.updateFrequencyDays} 天`;
  }, [settings]);

  async function loadSettings() {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/settings`, {
      credentials: 'include',
    });

    if (!response.ok) {
      setLoadError('加载系统设置失败');
      return;
    }

    setLoadError('');
    applySettings(((await response.json()) as AdminSystemSettingsResponse).settings);
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

      <form className="settings-card" onSubmit={saveSchedule}>
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
