'use client';

import type { AdminBlacklistItem, AdminBlacklistListResponse, BlacklistStatus } from '@atmb/shared';
import { BLACKLIST_REASON_MAX_LENGTH, BLACKLIST_STATUS_LABELS, parseOneLineUsAddress, US_STATES } from '@atmb/shared';
import { Check, Pencil, Plus, Search, Trash2, Wand2, X } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState, useTransition } from 'react';

import { PUBLIC_API_BASE_URL } from '../../lib/api';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { AdminToastStack, useAdminToasts } from './AdminToast';

type StatusFilter = BlacklistStatus | 'all';

interface Filters {
  keyword: string;
  status: StatusFilter;
}

const initialFilters: Filters = {
  keyword: '',
  status: 'pending',
};

const statusTones: Record<BlacklistStatus, 'green' | 'amber' | 'red'> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
};

export function BlacklistManagement() {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminBlacklistListResponse | null>(null);
  const [dialog, setDialog] = useState<{ item: AdminBlacklistItem | null } | null>(null);
  const [rejecting, setRejecting] = useState<AdminBlacklistItem | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [deleting, setDeleting] = useState<AdminBlacklistItem | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useAdminToasts();

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '20');
    params.set('status', appliedFilters.status);
    if (appliedFilters.keyword) params.set('q', appliedFilters.keyword);
    return params.toString();
  }, [appliedFilters, page]);

  async function loadData() {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/blacklist?${query}`, { credentials: 'include' });

    if (response.ok) {
      setList((await response.json()) as AdminBlacklistListResponse);
    }
  }

  useEffect(() => {
    startTransition(loadData);
  }, [query]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  function resetSearch() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  }

  function changeFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function patchItem(item: AdminBlacklistItem, payload: Record<string, unknown>, successMessage: string) {
    setIsActing(true);

    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/blacklist/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(body?.message ?? '操作失败', 'error');
        return false;
      }

      showToast(successMessage, 'success');
      await loadData();
      return true;
    } finally {
      setIsActing(false);
    }
  }

  async function approve(item: AdminBlacklistItem) {
    await patchItem(item, { status: 'approved' }, '已通过，前台将展示该地址');
  }

  async function reject() {
    if (!rejecting) return;
    const ok = await patchItem(rejecting, { status: 'rejected', reviewNote: rejectNote.trim() || null }, '已拒绝');
    if (ok) {
      setRejecting(null);
      setRejectNote('');
    }
  }

  async function remove() {
    if (!deleting) return;
    setIsActing(true);

    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/blacklist/${deleting.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok && response.status !== 404) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(body?.message ?? '删除失败', 'error');
        return;
      }

      showToast('已删除', 'success');
      setDeleting(null);
      await loadData();
    } finally {
      setIsActing(false);
    }
  }

  return (
    <main className="admin-page">
      <AdminToastStack toasts={toasts} onDismiss={dismissToast} />
      <section className="admin-page-heading">
        <div>
          <p className="admin-kicker">地址黑名单</p>
          <p>
            游客提交的地址默认为待审核，通过后才在前台 /address-blacklist 展示；同一地址可以有多条原因。
            {list ? ` 当前待审核 ${list.pendingCount} 条。` : ''}
          </p>
        </div>
        <div className="admin-page-actions">
          <button className="primary" type="button" onClick={() => setDialog({ item: null })}>
            <Plus size={16} aria-hidden="true" />
            新增黑名单
          </button>
        </div>
      </section>

      <form className="admin-filter-panel blacklist-filter-panel" onSubmit={submitSearch}>
        <div className="admin-filter-title">筛选黑名单</div>
        <label className="wide">
          <span>关键词</span>
          <div className="admin-input-with-icon">
            <Search size={16} aria-hidden="true" />
            <input
              value={filters.keyword}
              onChange={(event) => changeFilter('keyword', event.target.value)}
              placeholder="街道、城市、州、ZIP 或问题描述"
            />
          </div>
        </label>
        <label>
          <span>状态</span>
          <select value={filters.status} onChange={(event) => changeFilter('status', event.target.value as StatusFilter)}>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
            <option value="all">全部</option>
          </select>
        </label>
        <div className="admin-filter-actions">
          <button className="primary" type="submit">
            <Search size={16} aria-hidden="true" />
            搜索
          </button>
          <button type="button" onClick={resetSearch}>
            重置
          </button>
        </div>
      </form>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <strong>黑名单列表</strong>
          <span>{isPending ? '加载中' : `共 ${list?.total ?? 0} 条`}</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-address-table blacklist-admin-table">
            <thead>
              <tr>
                <th>地址</th>
                <th>城市 / 州 / ZIP</th>
                <th>问题描述</th>
                <th>来源</th>
                <th>提交者</th>
                <th>状态</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {list?.items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.streetAddress}</strong></td>
                  <td>{item.city}, {item.state} {item.postalCode}</td>
                  <td><div className="blacklist-reason-cell">{item.reason}</div></td>
                  <td>
                    {item.sourceUrl ? (
                      <a href={item.sourceUrl} rel="noreferrer" target="_blank">查看</a>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td>{item.submittedBy === 'admin' ? '后台' : '游客'}</td>
                  <td>
                    <Badge tone={statusTones[item.status]} title={item.reviewNote ?? undefined}>
                      {BLACKLIST_STATUS_LABELS[item.status]}
                    </Badge>
                    {item.reviewedBy ? <div className="blacklist-review-meta">{item.reviewedBy} · {formatDate(item.reviewedAt ?? item.updatedAt)}</div> : null}
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <div className="blacklist-row-actions">
                      {item.status !== 'approved' ? (
                        <button type="button" disabled={isActing} onClick={() => void approve(item)}>
                          <Check size={14} aria-hidden="true" />
                          通过
                        </button>
                      ) : null}
                      {item.status !== 'rejected' ? (
                        <button type="button" disabled={isActing} onClick={() => { setRejecting(item); setRejectNote(item.reviewNote ?? ''); }}>
                          <X size={14} aria-hidden="true" />
                          拒绝
                        </button>
                      ) : null}
                      <button type="button" onClick={() => setDialog({ item })}>
                        <Pencil size={14} aria-hidden="true" />
                        编辑
                      </button>
                      <button className="danger" type="button" onClick={() => setDeleting(item)}>
                        <Trash2 size={14} aria-hidden="true" />
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list && list.items.length === 0 ? (
                <tr>
                  <td className="admin-empty-cell" colSpan={8}>
                    暂无符合条件的黑名单记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <span>
            第 {list?.page ?? page} 页，共 {list?.totalPages ?? 1} 页
          </span>
          <div>
            <button disabled={page <= 1} type="button" onClick={() => setPage((current) => Math.max(1, current - 1))}>
              上一页
            </button>
            <button disabled={page >= (list?.totalPages ?? 1)} type="button" onClick={() => setPage((current) => current + 1)}>
              下一页
            </button>
          </div>
        </div>
      </section>

      {dialog ? (
        <BlacklistEditDialog
          item={dialog.item}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setDialog(null);
            showToast(dialog.item ? '已保存修改' : '已新增并通过', 'success');
            if (!dialog.item && appliedFilters.status !== 'approved' && appliedFilters.status !== 'all') {
              setFilters((current) => ({ ...current, status: 'approved' }));
              setAppliedFilters((current) => ({ ...current, status: 'approved' }));
              setPage(1);
              return;
            }
            setList((current) => current
              ? { ...current, items: current.items.map((row) => (row.id === saved.id ? saved : row)) }
              : current);
            startTransition(loadData);
          }}
        />
      ) : null}
      {rejecting ? (
        <AdminConfirmDialog
          title="拒绝这条黑名单提交？"
          description={`${rejecting.streetAddress}, ${rejecting.city}, ${rejecting.state} ${rejecting.postalCode}。拒绝后不会在前台展示，可填写备注说明原因。`}
          content={(
            <label className="blacklist-note-field">
              <span>审核备注（可选）</span>
              <textarea
                rows={3}
                maxLength={500}
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                placeholder="例如：信息不足 / 无法核实 / 重复提交"
              />
            </label>
          )}
          confirmText="拒绝"
          tone="danger"
          isPending={isActing}
          onCancel={() => setRejecting(null)}
          onConfirm={() => void reject()}
        />
      ) : null}
      {deleting ? (
        <AdminConfirmDialog
          title="删除这条黑名单记录？"
          description={`${deleting.streetAddress}, ${deleting.city}, ${deleting.state} ${deleting.postalCode}。删除后不可恢复。`}
          confirmText="删除"
          tone="danger"
          isPending={isActing}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </main>
  );
}

function Badge({ children, title, tone }: { children: ReactNode; title?: string; tone: 'green' | 'amber' | 'red' }) {
  return <span className={`admin-badge ${tone}`} title={title}>{children}</span>;
}

const emptyForm = {
  oneLine: '',
  streetAddress: '',
  city: '',
  state: '',
  postalCode: '',
  reason: '',
  sourceUrl: '',
};

// 新增与编辑共用：item 为 null 时新增（直接通过），否则编辑已有记录
function BlacklistEditDialog({
  item,
  onClose,
  onSaved,
}: {
  item: AdminBlacklistItem | null;
  onClose: () => void;
  onSaved: (item: AdminBlacklistItem) => void;
}) {
  const [form, setForm] = useState(item
    ? {
      oneLine: '',
      streetAddress: item.streetAddress,
      city: item.city,
      state: item.state,
      postalCode: item.postalCode,
      reason: item.reason,
      sourceUrl: item.sourceUrl ?? '',
    }
    : emptyForm);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  function setValue<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function parseOneLine() {
    const parsed = parseOneLineUsAddress(form.oneLine);
    setForm((current) => ({
      ...current,
      streetAddress: parsed.streetAddress || current.streetAddress,
      city: parsed.city || current.city,
      state: parsed.state || current.state,
      postalCode: parsed.postalCode || current.postalCode,
    }));
    setMessage(parsed.postalCode ? '' : '没有识别出 ZIP，请检查整行地址格式');
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    startTransition(async () => {
      const response = await fetch(
        item ? `${PUBLIC_API_BASE_URL}/api/admin/blacklist/${item.id}` : `${PUBLIC_API_BASE_URL}/api/admin/blacklist`,
        {
          method: item ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            streetAddress: form.streetAddress,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
            reason: form.reason,
            sourceUrl: form.sourceUrl,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(body?.message ?? '保存失败，请检查字段。');
        return;
      }

      const body = (await response.json()) as { item: AdminBlacklistItem };
      onSaved(body.item);
    });
  }

  return (
    <div className="admin-modal-backdrop">
      <form className="address-dialog blacklist-dialog" onSubmit={save}>
        <div className="admin-dialog-heading">
          <div>
            <h2>{item ? '编辑黑名单记录' : '新增黑名单地址'}</h2>
            <span>{item ? `#${item.id} · ${BLACKLIST_STATUS_LABELS[item.status]}` : '后台新增的记录直接标记为已通过'}</span>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="address-dialog-grid">
          <label className="blacklist-dialog-wide">
            <span>整行地址（粘贴后一键解析）</span>
            <div className="blacklist-parse-row">
              <input
                value={form.oneLine}
                onChange={(event) => setValue('oneLine', event.target.value)}
                placeholder="123 Main St, Suite 5, Los Angeles, CA 90001"
              />
              <button type="button" onClick={parseOneLine} disabled={!form.oneLine.trim()}>
                <Wand2 size={14} aria-hidden="true" />
                解析
              </button>
            </div>
          </label>
          <label className="blacklist-dialog-wide">
            <span>街道地址</span>
            <input required value={form.streetAddress} onChange={(event) => setValue('streetAddress', event.target.value)} />
          </label>
          <label>
            <span>城市</span>
            <input required value={form.city} onChange={(event) => setValue('city', event.target.value)} />
          </label>
          <label>
            <span>州</span>
            <select required value={form.state} onChange={(event) => setValue('state', event.target.value)}>
              <option value="">选择州</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>{state.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>ZIP</span>
            <input required value={form.postalCode} onChange={(event) => setValue('postalCode', event.target.value)} />
          </label>
          <label className="blacklist-dialog-wide">
            <span>问题描述（{form.reason.length}/{BLACKLIST_REASON_MAX_LENGTH}）</span>
            <textarea
              required
              rows={4}
              maxLength={BLACKLIST_REASON_MAX_LENGTH}
              value={form.reason}
              onChange={(event) => setValue('reason', event.target.value)}
            />
          </label>
          <label className="blacklist-dialog-wide">
            <span>来源链接（可选）</span>
            <input type="url" value={form.sourceUrl} onChange={(event) => setValue('sourceUrl', event.target.value)} placeholder="https://" />
          </label>
        </div>
        {message ? <p className="admin-form-message">{message}</p> : null}
        <div className="admin-dialog-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={isPending} type="submit">
            {item ? '保存修改' : '新增并通过'}
          </button>
        </div>
      </form>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
