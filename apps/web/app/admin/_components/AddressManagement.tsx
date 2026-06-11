'use client';

import type {
  AddressCmra,
  AddressCmraFilter,
  AddressPriceFilter,
  AddressRdi,
  AddressRdiFilter,
  AdminAddressListItem,
  AdminAddressListResponse,
  AdminAddressStats,
  AdminStateOption,
} from '@atmb/shared';
import { Edit3, ImageUp, RefreshCw, Search, Trash2 } from 'lucide-react';
import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState, useTransition } from 'react';

import { PUBLIC_API_BASE_URL } from '../../lib/api';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { AdminToastStack, useAdminToasts } from './AdminToast';

interface Filters {
  keyword: string;
  state: string;
  rdi: '' | AddressRdiFilter;
  cmra: '' | AddressCmraFilter;
  price: AddressPriceFilter;
  featured: '' | 'true' | 'false';
}

const initialFilters: Filters = {
  keyword: '',
  state: '',
  rdi: '',
  cmra: '',
  price: 'all',
  featured: '',
};

const emptyStats: AdminAddressStats = {
  totalAddresses: 0,
  activeAddresses: 0,
  residentialAddresses: 0,
  todayAdded: 0,
  todayRemoved: 0,
};

export function AddressManagement() {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminAddressListResponse | null>(null);
  const [stats, setStats] = useState<AdminAddressStats>(emptyStats);
  const [states, setStates] = useState<AdminStateOption[]>([]);
  const [editing, setEditing] = useState<AdminAddressListItem | null>(null);
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);
  const [confirmMailboxUpdateOpen, setConfirmMailboxUpdateOpen] = useState(false);
  const [confirmSmartySyncOpen, setConfirmSmartySyncOpen] = useState(false);
  const [selectedAddressIds, setSelectedAddressIds] = useState<number[]>([]);
  const [selectedSmartyStageIds, setSelectedSmartyStageIds] = useState<number[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdatingMailbox, setIsUpdatingMailbox] = useState(false);
  const [isCreatingSmartySyncTask, setIsCreatingSmartySyncTask] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useAdminToasts();

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '20');
    if (appliedFilters.keyword) params.set('keyword', appliedFilters.keyword);
    if (appliedFilters.state) params.set('state', appliedFilters.state);
    if (appliedFilters.rdi) params.set('rdi', appliedFilters.rdi);
    if (appliedFilters.cmra) params.set('cmra', appliedFilters.cmra);
    if (appliedFilters.price !== 'all') params.set('price', appliedFilters.price);
    if (appliedFilters.featured) params.set('featured', appliedFilters.featured);
    return params.toString();
  }, [appliedFilters, page]);
  const mailboxSelectableItems = useMemo(
    () => (list?.items ?? []).filter((item) => item.recordSource === 'address'),
    [list?.items],
  );
  const smartySelectableItems = useMemo(
    () => (list?.items ?? []).filter((item) => item.recordSource === 'discovered' && (!item.rdi || !item.cmra)),
    [list?.items],
  );
  const selectableItems = useMemo(
    () => [...mailboxSelectableItems, ...smartySelectableItems],
    [mailboxSelectableItems, smartySelectableItems],
  );
  const selectedOnPageCount =
    mailboxSelectableItems.filter((item) => selectedAddressIds.includes(item.id)).length
    + smartySelectableItems.filter((item) => selectedSmartyStageIds.includes(item.id)).length;
  const allSelectableOnPageSelected = selectableItems.length > 0 && selectedOnPageCount === selectableItems.length;
  const mailboxUpdateSelectedCount = selectedAddressIds.length + selectedSmartyStageIds.length;

  async function loadData() {
    const [addressesResponse, statsResponse, statesResponse] = await Promise.all([
      fetch(`${PUBLIC_API_BASE_URL}/api/admin/addresses?${query}`, { credentials: 'include' }),
      fetch(`${PUBLIC_API_BASE_URL}/api/admin/addresses/stats`, { credentials: 'include' }),
      fetch(`${PUBLIC_API_BASE_URL}/api/admin/states`, { credentials: 'include' }),
    ]);

    if (addressesResponse.ok) {
      setList((await addressesResponse.json()) as AdminAddressListResponse);
    }
    if (statsResponse.ok) {
      setStats((await statsResponse.json()) as AdminAddressStats);
    }
    if (statesResponse.ok) {
      const body = (await statesResponse.json()) as { items: AdminStateOption[] };
      setStates(body.items);
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

  async function createSyncTask() {
    setIsSyncing(true);

    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          note: '手动同步 Anytime Mailbox 地址数据',
        }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string };

      if (!response.ok) {
        showToast(body.message || '同步任务创建失败，请稍后重试。', 'error');
        return;
      }

      showToast('同步任务已创建，可前往任务管理查看执行进度。', 'success');
    } finally {
      setIsSyncing(false);
    }
  }

  async function createMailboxUpdateTask() {
    if (mailboxUpdateSelectedCount === 0) return;
    setIsUpdatingMailbox(true);

    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/addresses/mailbox-update-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          addressIds: selectedAddressIds,
          stageIds: selectedSmartyStageIds,
        }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string };

      if (!response.ok) {
        showToast(body.message || '更新编号任务创建失败，请稍后重试。', 'error');
        return;
      }

      setSelectedAddressIds([]);
      setSelectedSmartyStageIds([]);
      showToast('更新编号任务已创建，可前往任务管理查看执行进度。', 'success');
    } finally {
      setIsUpdatingMailbox(false);
    }
  }

  async function createSmartySyncTask() {
    if (selectedSmartyStageIds.length === 0) return;
    setIsCreatingSmartySyncTask(true);

    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/addresses/smarty-sync-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          stageIds: selectedSmartyStageIds,
        }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string };

      if (!response.ok) {
        showToast(body.message || 'RDI/CMRA 同步任务创建失败，请稍后重试。', 'error');
        return;
      }

      setSelectedSmartyStageIds([]);
      showToast('RDI/CMRA 同步任务已创建，可前往任务管理查看执行进度。', 'success');
    } finally {
      setIsCreatingSmartySyncTask(false);
    }
  }

  function isSmartySyncItem(item: AdminAddressListItem) {
    return item.recordSource === 'discovered' && (!item.rdi || !item.cmra);
  }

  function isItemSelectable(item: AdminAddressListItem) {
    return item.recordSource === 'address' || isSmartySyncItem(item);
  }

  function isItemSelected(item: AdminAddressListItem) {
    if (item.recordSource === 'address') {
      return selectedAddressIds.includes(item.id);
    }

    return isSmartySyncItem(item) && selectedSmartyStageIds.includes(item.id);
  }

  function toggleItemSelection(item: AdminAddressListItem, checked: boolean) {
    if (item.recordSource === 'address') {
      setSelectedAddressIds((current) => (
        checked
          ? [...new Set([...current, item.id])]
          : current.filter((currentId) => currentId !== item.id)
      ));
      return;
    }

    if (isSmartySyncItem(item)) {
      setSelectedSmartyStageIds((current) => (
        checked
          ? [...new Set([...current, item.id])]
          : current.filter((currentId) => currentId !== item.id)
      ));
    }
  }

  function toggleCurrentPageSelection(checked: boolean) {
    setSelectedAddressIds((current) => (
      checked
        ? [...new Set([...current, ...mailboxSelectableItems.map((item) => item.id)])]
        : current.filter((id) => !mailboxSelectableItems.some((item) => item.id === id))
    ));
    setSelectedSmartyStageIds((current) => (
      checked
        ? [...new Set([...current, ...smartySelectableItems.map((item) => item.id)])]
        : current.filter((id) => !smartySelectableItems.some((item) => item.id === id))
    ));
  }

  return (
    <main className="admin-page">
      <AdminToastStack toasts={toasts} onDismiss={dismissToast} />
      <section className="admin-page-heading">
        <div>
          <p className="admin-kicker">地址管理</p>
          <p>管理 Anytime Mailbox 地址数据、Smarty RDI/CMRA 结果、价格、邮箱编号范围和展示状态。</p>
        </div>
        <div className="admin-page-actions">
          <button
            disabled={isUpdatingMailbox || mailboxUpdateSelectedCount === 0}
            type="button"
            title="为选中的地址创建获取地址和获取编号任务"
            onClick={() => setConfirmMailboxUpdateOpen(true)}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {isUpdatingMailbox ? '创建中...' : `更新编号${mailboxUpdateSelectedCount ? `(${mailboxUpdateSelectedCount})` : ''}`}
          </button>
          <button
            disabled={isCreatingSmartySyncTask || selectedSmartyStageIds.length === 0}
            type="button"
            title="为选中的待同步地址创建 RDI/CMRA 同步任务"
            onClick={() => setConfirmSmartySyncOpen(true)}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {isCreatingSmartySyncTask ? '创建中...' : `同步 RDI/CMRA${selectedSmartyStageIds.length ? `(${selectedSmartyStageIds.length})` : ''}`}
          </button>
          <button disabled={isSyncing} type="button" title="创建后台同步任务" onClick={() => setConfirmSyncOpen(true)}>
            <RefreshCw size={16} aria-hidden="true" />
            {isSyncing ? '创建中...' : '同步最新数据'}
          </button>
        </div>
      </section>

      <section className="admin-stats-grid" aria-label="地址统计">
        <Stat label="地址总数" value={stats.totalAddresses} />
        <Stat label="住宅地址" value={stats.residentialAddresses} />
        <Stat label="今日新增" value={stats.todayAdded} />
        <Stat label="今日移除" value={stats.todayRemoved} />
      </section>

      <form className="admin-filter-panel" onSubmit={submitSearch}>
        <div className="admin-filter-title">筛选地址</div>
        <label className="wide">
          <span>关键词</span>
          <div className="admin-input-with-icon">
            <Search size={16} aria-hidden="true" />
            <input
              value={filters.keyword}
              onChange={(event) => changeFilter('keyword', event.target.value)}
              placeholder="地址名称、街道、城市、ZIP"
            />
          </div>
        </label>
        <label>
          <span>州</span>
          <select value={filters.state} onChange={(event) => changeFilter('state', event.target.value)}>
            <option value="">全部州</option>
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>RDI</span>
          <select value={filters.rdi} onChange={(event) => changeFilter('rdi', event.target.value as Filters['rdi'])}>
            <option value="">全部</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
            <option value="none">无</option>
          </select>
        </label>
        <label>
          <span>CMRA</span>
          <select value={filters.cmra} onChange={(event) => changeFilter('cmra', event.target.value as Filters['cmra'])}>
            <option value="">全部</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="none">无</option>
          </select>
        </label>
        <label>
          <span>价格</span>
          <select value={filters.price} onChange={(event) => changeFilter('price', event.target.value as AddressPriceFilter)}>
            <option value="all">全部</option>
            <option value="lt10">小于 $10</option>
            <option value="lt20">小于 $20</option>
            <option value="gte20">大于等于 $20</option>
          </select>
        </label>
        <label>
          <span>精选</span>
          <select value={filters.featured} onChange={(event) => changeFilter('featured', event.target.value as Filters['featured'])}>
            <option value="">全部</option>
            <option value="true">精选</option>
            <option value="false">未精选</option>
          </select>
        </label>
        <div className="admin-filter-actions">
          <button className="primary" type="submit">
            搜索
          </button>
          <button type="button" onClick={resetSearch}>
            重置
          </button>
        </div>
      </form>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <strong>地址列表</strong>
          <span>{isPending ? '加载中' : `共 ${list?.total ?? 0} 条`}</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-address-table">
            <thead>
              <tr>
                <th className="admin-select-cell">
                  <input
                    aria-label="选择当前页地址"
                    checked={allSelectableOnPageSelected}
                    disabled={selectableItems.length === 0}
                    type="checkbox"
                    onChange={(event) => toggleCurrentPageSelection(event.target.checked)}
                  />
                </th>
                <th>地址名称</th>
                <th>地址</th>
                <th>州 / ZIP</th>
                <th>RDI</th>
                <th>CMRA</th>
                <th>精选</th>
                <th>价格</th>
                <th>邮箱编号范围</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {(list?.items ?? []).map((item) => (
                <tr key={`${item.recordSource}-${item.id}`}>
                  <td className="admin-select-cell">
                    <input
                      aria-label={`选择 ${item.name}`}
                      checked={isItemSelected(item)}
                      disabled={!isItemSelectable(item)}
                      type="checkbox"
                      onChange={(event) => toggleItemSelection(item, event.target.checked)}
                    />
                  </td>
                  <td>
                    <a className="address-table-link strong" href={item.anytimeUrl} rel="noreferrer" target="_blank">
                      {item.name}
                    </a>
                    {item.statusNote ? <span>{item.statusNote}</span> : null}
                  </td>
                  <td>
                    <a className="address-table-link" href={item.anytimeUrl} rel="noreferrer" target="_blank">
                      {item.streetAddress}
                      <br />
                      {item.city}, {item.state} {item.postalCode}
                    </a>
                  </td>
                  <td>
                    {item.stateName}
                    <br />
                    {item.postalCode}
                  </td>
                  <td>
                    <Badge tone={item.rdi === 'Residential' ? 'green' : 'blue'}>{item.rdi ?? '无'}</Badge>
                  </td>
                  <td>
                    <Badge tone={item.cmra === 'No' ? 'green' : 'amber'}>{item.cmra ?? '无'}</Badge>
                  </td>
                  <td>
                    <Badge tone={item.isFeatured ? 'green' : 'amber'}>{item.isFeatured ? '精选' : '未精选'}</Badge>
                  </td>
                  <td>
                    {formatPrice(item.priceCents)}
                  </td>
                  <td>
                    {item.mailboxMin ?? '-'} - {item.mailboxMax ?? '-'}
                  </td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td>
                    {item.canEdit ? (
                      <button className="text-action" type="button" onClick={() => setEditing(item)}>
                        <Edit3 size={15} aria-hidden="true" />
                        编辑
                      </button>
                    ) : (
                      <button className="text-action muted" disabled title="补齐 RDI/CMRA 并导入后可编辑" type="button">
                        待同步
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {list && list.items.length === 0 ? (
                <tr>
                  <td className="admin-empty-cell" colSpan={11}>
                    暂无符合条件的地址
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

      {editing ? (
        <AddressEditDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(item) => {
            setEditing(null);
            setList((current) =>
              current
                ? {
                    ...current,
                    items: current.items.map((address) => (address.id === item.id ? item : address)),
                  }
                : current,
            );
            startTransition(loadData);
          }}
        />
      ) : null}
      {confirmSyncOpen ? (
        <AdminConfirmDialog
          title="确认同步最新数据？"
          description="系统会创建后台同步任务，开始更新 Anytime Mailbox 地址、价格、邮箱编号范围，并仅同步未成功获取过 Smarty 的地址。"
          confirmText="开始同步"
          isPending={isSyncing}
          onCancel={() => setConfirmSyncOpen(false)}
          onConfirm={() => {
            setConfirmSyncOpen(false);
            void createSyncTask();
          }}
        />
      ) : null}
      {confirmMailboxUpdateOpen ? (
        <AdminConfirmDialog
          title="确认更新选中地址编号？"
          description={`系统会创建只包含“获取地址”和“获取编号”的任务，重新获取 ${mailboxUpdateSelectedCount} 个地址的 signupUrl 和邮箱编号范围。待同步 RDI/CMRA 的地址会先更新暂存编号，后续同步 Smarty 后再导入主地址。`}
          confirmText="创建更新任务"
          isPending={isUpdatingMailbox}
          onCancel={() => setConfirmMailboxUpdateOpen(false)}
          onConfirm={() => {
            setConfirmMailboxUpdateOpen(false);
            void createMailboxUpdateTask();
          }}
        />
      ) : null}
      {confirmSmartySyncOpen ? (
        <AdminConfirmDialog
          title="确认同步选中地址的 RDI/CMRA？"
          description={`系统会创建只包含“同步 Smarty”的任务，用于补全 ${selectedSmartyStageIds.length} 个待同步地址的 RDI 和 CMRA。已经成功获取过 Smarty 的地址仍会复用缓存，不会重复请求。`}
          confirmText="创建同步任务"
          isPending={isCreatingSmartySyncTask}
          onCancel={() => setConfirmSmartySyncOpen(false)}
          onConfirm={() => {
            setConfirmSmartySyncOpen(false);
            void createSmartySyncTask();
          }}
        />
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-stat-card">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: 'green' | 'amber' | 'blue' }) {
  return <span className={`admin-badge ${tone}`}>{children}</span>;
}

function AddressEditDialog({
  item,
  onClose,
  onSaved,
}: {
  item: AdminAddressListItem;
  onClose: () => void;
  onSaved: (item: AdminAddressListItem) => void;
}) {
  const [form, setForm] = useState(item);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  function setValue<K extends keyof AdminAddressListItem>(key: K, value: AdminAddressListItem[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/addresses/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name,
          streetAddress: form.streetAddress,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          ...(form.rdi ? { rdi: form.rdi } : {}),
          ...(form.cmra ? { cmra: form.cmra } : {}),
          priceCents: form.priceCents,
          isFeatured: form.isFeatured,
          isVisible: form.isVisible,
          statusNote: form.statusNote,
        }),
      });

      if (!response.ok) {
        setMessage('保存失败，请检查字段。');
        return;
      }

      const body = (await response.json()) as { item: AdminAddressListItem };
      onSaved(body.item);
    });
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage('');
    startTransition(async () => {
      const body = new FormData();
      body.append('image', file);
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/addresses/${item.id}/images`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      if (!response.ok) {
        setMessage('上传失败，仅支持 JPG / PNG，最大 5MB。');
        return;
      }
      const result = (await response.json()) as { image: { publicUrl: string } };
      setForm((current) => ({ ...current, imageUrl: result.image.publicUrl }));
      event.target.value = '';
    });
  }

  function clearImage() {
    if (!form.imageUrl) return;
    setMessage('');
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/addresses/${item.id}/images`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        setMessage('清除失败，请稍后重试。');
        return;
      }
      const body = (await response.json()) as { item: AdminAddressListItem };
      setForm(body.item);
    });
  }

  return (
    <div className="admin-modal-backdrop">
      <form className="address-dialog" onSubmit={save}>
        <div className="admin-dialog-heading">
          <div>
            <h2>编辑地址</h2>
            <span>{item.name} · 邮箱编号范围只展示，不可编辑</span>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="address-dialog-grid">
          <label>
            <span>地址名称</span>
            <input value={form.name} onChange={(event) => setValue('name', event.target.value)} />
          </label>
          <label>
            <span>街道地址</span>
            <input value={form.streetAddress} onChange={(event) => setValue('streetAddress', event.target.value)} />
          </label>
          <label>
            <span>城市</span>
            <input value={form.city} onChange={(event) => setValue('city', event.target.value)} />
          </label>
          <label>
            <span>州</span>
            <input value={form.state} onChange={(event) => setValue('state', event.target.value.toUpperCase())} />
          </label>
          <label>
            <span>ZIP</span>
            <input value={form.postalCode} onChange={(event) => setValue('postalCode', event.target.value)} />
          </label>
          <label>
            <span>RDI</span>
            <select value={form.rdi ?? ''} onChange={(event) => setValue('rdi', (event.target.value || null) as AddressRdi | null)}>
              <option value="">无</option>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
            </select>
          </label>
          <label>
            <span>CMRA</span>
            <select value={form.cmra ?? ''} onChange={(event) => setValue('cmra', (event.target.value || null) as AddressCmra | null)}>
              <option value="">无</option>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </label>
          <label>
            <span>价格（美分）</span>
            <input
              type="number"
              value={form.priceCents}
              onChange={(event) => setValue('priceCents', Number(event.target.value))}
            />
          </label>
          <label className="wide">
            <span>状态备注</span>
            <input value={form.statusNote ?? ''} onChange={(event) => setValue('statusNote', event.target.value)} />
          </label>
        </div>
        <div className="address-dialog-media">
          <div className={form.imageUrl ? 'street-preview has-image' : 'street-preview'}>
            {form.imageUrl ? (
              <>
                <img src={form.imageUrl} alt={`${form.name} 街景图`} />
                <button
                  aria-label="清除街景图"
                  className="street-clear-button"
                  disabled={isPending}
                  title="清除街景图"
                  type="button"
                  onClick={clearImage}
                >
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              </>
            ) : (
              <span>当前街景预览占位</span>
            )}
          </div>
          <label className="upload-box">
            <ImageUp size={22} aria-hidden="true" />
            <strong>上传街景图</strong>
            <span>支持 JPG / PNG，最大 5MB</span>
            <input accept="image/png,image/jpeg" type="file" onChange={upload} />
          </label>
          <label className="switch-row">
            <span>
              <strong>设置为精选地址</strong>
              <small>开启后可用于首页精选住宅地址模块。</small>
            </span>
            <input checked={form.isFeatured} type="checkbox" onChange={(event) => setValue('isFeatured', event.target.checked)} />
          </label>
          <label className="switch-row">
            <span>
              <strong>显示状态</strong>
              <small>关闭后不会出现在前台地址列表。</small>
            </span>
            <input checked={form.isVisible} type="checkbox" onChange={(event) => setValue('isVisible', event.target.checked)} />
          </label>
          <div className="mailbox-range-note">
            <span>邮箱编号范围</span>
            <strong>
              {form.mailboxMin ?? '-'} - {form.mailboxMax ?? '-'}
            </strong>
          </div>
        </div>
        {message ? <p className="admin-form-message">{message}</p> : null}
        <div className="admin-dialog-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={isPending} type="submit">
            保存修改
          </button>
        </div>
      </form>
    </div>
  );
}

function formatPrice(cents: number) {
  return `US$ ${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
