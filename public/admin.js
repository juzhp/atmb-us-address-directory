const state = {
  page: 1,
  limit: 25,
  items: [],
  smartyTokens: [],
  total: 0,
  isRunning: false,
  runningJobType: null,
  pollTimer: null,
  filters: {
    q: "",
    state: "",
    isActive: ""
  }
};

const elements = {
  crawlStartButton: document.querySelector("#crawl-start-button"),
  personalizeScanButton: document.querySelector("#personalize-scan-button"),
  smartyEnrichButton: document.querySelector("#smarty-enrich-button"),
  refreshButton: document.querySelector("#refresh-button"),
  heroHint: document.querySelector("#hero-hint"),
  statTotalLocations: document.querySelector("#stat-total-locations"),
  statActiveLocations: document.querySelector("#stat-active-locations"),
  statPersonalizeCount: document.querySelector("#stat-personalize-count"),
  statSmartyCount: document.querySelector("#stat-smarty-count"),
  statSmartyRemaining: document.querySelector("#stat-smarty-remaining"),
  statusPill: document.querySelector("#status-pill"),
  jobType: document.querySelector("#job-type"),
  jobStartedAt: document.querySelector("#job-started-at"),
  jobFinishedAt: document.querySelector("#job-finished-at"),
  jobTotalStates: document.querySelector("#job-total-states"),
  jobTotalProcessed: document.querySelector("#job-total-processed"),
  jobTotalDiscovered: document.querySelector("#job-total-discovered"),
  jobTotalInserted: document.querySelector("#job-total-inserted"),
  jobTotalUpdated: document.querySelector("#job-total-updated"),
  jobTotalFailed: document.querySelector("#job-total-failed"),
  jobErrorBox: document.querySelector("#job-error-box"),
  smartyTokenForm: document.querySelector("#smarty-token-form"),
  smartyNameInput: document.querySelector("#smarty-name-input"),
  smartyAuthIdInput: document.querySelector("#smarty-auth-id-input"),
  smartyAuthTokenInput: document.querySelector("#smarty-auth-token-input"),
  smartyQuotaInput: document.querySelector("#smarty-quota-input"),
  smartyPriorityInput: document.querySelector("#smarty-priority-input"),
  smartyTokensTbody: document.querySelector("#smarty-tokens-tbody"),
  filtersForm: document.querySelector("#filters-form"),
  queryInput: document.querySelector("#query-input"),
  stateInput: document.querySelector("#state-input"),
  isActiveInput: document.querySelector("#is-active-input"),
  locationsTbody: document.querySelector("#locations-tbody"),
  tableMeta: document.querySelector("#table-meta"),
  previousPageButton: document.querySelector("#previous-page-button"),
  nextPageButton: document.querySelector("#next-page-button"),
  pageIndicator: document.querySelector("#page-indicator")
};

bootstrap().catch((error) => {
  console.error(error);
  window.alert("页面初始化失败，请查看控制台。");
});

async function bootstrap() {
  bindEvents();
  renderHeroHint();
  await Promise.all([loadStatus(), loadLocations(), loadSmartyTokens()]);
}

function bindEvents() {
  elements.crawlStartButton.addEventListener("click", handleStartCrawl);
  elements.personalizeScanButton.addEventListener("click", handleStartPersonalizeScan);
  elements.smartyEnrichButton.addEventListener("click", handleStartSmartyEnrichment);
  elements.refreshButton.addEventListener("click", () => {
    void Promise.all([loadStatus(), loadLocations(), loadSmartyTokens()]);
  });
  elements.smartyTokenForm.addEventListener("submit", handleCreateSmartyToken);

  elements.filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.page = 1;
    state.filters.q = elements.queryInput.value.trim();
    state.filters.state = elements.stateInput.value.trim().toUpperCase();
    state.filters.isActive = elements.isActiveInput.value;
    renderHeroHint();
    void loadLocations();
  });

  elements.previousPageButton.addEventListener("click", () => {
    if (state.page <= 1) {
      return;
    }

    state.page -= 1;
    void loadLocations();
  });

  elements.nextPageButton.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    if (state.page >= totalPages) {
      return;
    }

    state.page += 1;
    void loadLocations();
  });

  elements.locationsTbody.addEventListener("change", handleInlinePatch);
  elements.smartyTokensTbody.addEventListener("change", handleSmartyTokenInlinePatch);
  elements.smartyTokensTbody.addEventListener("click", handleSmartyTokenActions);
}

async function handleStartCrawl() {
  await startJob("/admin/crawl/start");
}

async function handleStartPersonalizeScan() {
  await startJob("/admin/crawl/personalize/start", {
    query: state.filters.q,
    state: state.filters.state,
    isActive: state.filters.isActive
  });
}

async function handleStartSmartyEnrichment() {
  await startJob("/admin/crawl/smarty/start", {
    query: state.filters.q,
    state: state.filters.state,
    isActive: state.filters.isActive
  });
}

async function loadStatus() {
  const response = await fetch("/admin/crawl/status");
  const payload = await response.json();
  renderStatus(payload);
}

async function loadLocations() {
  elements.tableMeta.textContent = "正在加载...";

  const params = new URLSearchParams({
    page: String(state.page),
    limit: String(state.limit)
  });

  if (state.filters.q) {
    params.set("q", state.filters.q);
  }
  if (state.filters.state) {
    params.set("state", state.filters.state);
  }
  if (state.filters.isActive) {
    params.set("isActive", state.filters.isActive);
  }

  const response = await fetch(`/admin/locations?${params.toString()}`);
  const payload = await response.json();

  state.items = payload.items;
  state.total = payload.total;
  state.page = payload.page;
  state.limit = payload.limit;

  renderTable();
  renderSummaryStats();
}

async function loadSmartyTokens() {
  const response = await fetch("/admin/smarty/tokens");
  const payload = await response.json();
  state.smartyTokens = payload;
  renderSmartyTokens();
  renderSummaryStats();
}

async function handleInlinePatch(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  const rowId = target.dataset.locationId;
  const field = target.dataset.field;
  if (!rowId || !field) {
    return;
  }

  const value = target.value;
  target.disabled = true;

  try {
    const response = await fetch(`/admin/locations/${rowId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        [field]: value
      })
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.message || "更新失败");
    }

    const updated = await response.json();
    const index = state.items.findIndex((item) => String(item.id) === String(updated.id));
    if (index >= 0) {
      state.items[index] = updated;
      renderTable();
    }
  } catch (error) {
    console.error(error);
    window.alert(error.message);
  } finally {
    target.disabled = false;
  }
}

async function handleCreateSmartyToken(event) {
  event.preventDefault();

  const payload = {
    name: elements.smartyNameInput.value.trim(),
    authId: elements.smartyAuthIdInput.value.trim(),
    authToken: elements.smartyAuthTokenInput.value.trim(),
    quotaLimit: Number(elements.smartyQuotaInput.value || 0),
    priority: Number(elements.smartyPriorityInput.value || 100),
    status: "active"
  };

  try {
    const response = await fetch("/admin/smarty/tokens", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responsePayload = await response.json();
    if (!response.ok) {
      throw new Error(responsePayload.message || "添加 Smarty token 失败");
    }

    elements.smartyTokenForm.reset();
    await loadSmartyTokens();
  } catch (error) {
    console.error(error);
    window.alert(error.message);
  }
}

async function handleSmartyTokenInlinePatch(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
    return;
  }

  const tokenId = target.dataset.tokenId;
  const field = target.dataset.field;
  if (!tokenId || !field) {
    return;
  }

  let value = target.value;
  if (field === "quotaLimit" || field === "priority") {
    value = Number(value || 0);
  }

  try {
    const response = await fetch(`/admin/smarty/tokens/${tokenId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        [field]: value
      })
    });

    const responsePayload = await response.json();
    if (!response.ok) {
      throw new Error(responsePayload.message || "更新 Smarty token 失败");
    }

    await loadSmartyTokens();
  } catch (error) {
    console.error(error);
    window.alert(error.message);
  }
}

async function handleSmartyTokenActions(event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const tokenId = target.dataset.tokenId;
  const action = target.dataset.action;
  if (!tokenId || !action) {
    return;
  }

  try {
    if (action === "reset") {
      const response = await fetch(`/admin/smarty/tokens/${tokenId}/reset-usage`, {
        method: "POST"
      });
      const responsePayload = await response.json();
      if (!response.ok) {
        throw new Error(responsePayload.message || "重置额度失败");
      }
    }

    await loadSmartyTokens();
  } catch (error) {
    console.error(error);
    window.alert(error.message);
  }
}

function renderStatus(payload) {
  const job = payload.job;
  state.isRunning = payload.isRunning;
  state.runningJobType = payload.isRunning ? job?.type || null : null;
  syncActionState();

  if (!job) {
    setStatusPill("Idle", "pill-idle");
    elements.jobType.textContent = "-";
    elements.jobStartedAt.textContent = "-";
    elements.jobFinishedAt.textContent = "-";
    elements.jobTotalStates.textContent = "0";
    elements.jobTotalProcessed.textContent = "0";
    elements.jobTotalDiscovered.textContent = "0";
    elements.jobTotalInserted.textContent = "0";
    elements.jobTotalUpdated.textContent = "0";
    elements.jobTotalFailed.textContent = "0";
    elements.jobErrorBox.classList.add("hidden");
    stopPolling();
    renderSummaryStats();
    return;
  }

  setStatusPill(job.status, `pill-${job.status}`);
  elements.jobType.textContent = formatJobType(job.type);
  elements.jobStartedAt.textContent = formatDate(job.started_at);
  elements.jobFinishedAt.textContent = formatDate(job.finished_at);
  elements.jobTotalStates.textContent = String(job.total_states ?? 0);
  elements.jobTotalProcessed.textContent = String(job.total_processed ?? 0);
  elements.jobTotalDiscovered.textContent = String(job.total_discovered ?? 0);
  elements.jobTotalInserted.textContent = String(job.total_inserted ?? 0);
  elements.jobTotalUpdated.textContent = String(job.total_updated ?? 0);
  elements.jobTotalFailed.textContent = String(job.total_failed ?? 0);

  if (job.error) {
    elements.jobErrorBox.textContent = job.error;
    elements.jobErrorBox.classList.remove("hidden");
  } else {
    elements.jobErrorBox.classList.add("hidden");
  }

  if (payload.isRunning) {
    startPolling();
  } else {
    stopPolling();
  }

  renderSummaryStats();
}

function renderTable() {
  if (!state.items.length) {
    elements.locationsTbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">当前筛选条件下没有数据。</td>
      </tr>
    `;
  } else {
    elements.locationsTbody.innerHTML = state.items
      .map(
        (item) => `
          <tr>
            <td>
              <div class="cell-title">
                ${renderLocationLink(item, item.location_name || item.locationName || "-")}
              </div>
              <div class="cell-meta">ID: ${item.id}</div>
            </td>
            <td>
              <div>${renderLocationLink(item, item.full_address || item.fullAddress || "-")}</div>
              <div class="cell-meta">${escapeHtml(item.city || "-")}</div>
            </td>
            <td>${escapeHtml(item.state || "-")}</td>
            <td>${formatCurrency(item.monthly_price)}</td>
            <td>${formatRangeValue(item.personalize_min)}</td>
            <td>${formatRangeValue(item.personalize_max)}</td>
            <td>${renderReadonlyValue(item.rdi || "")}</td>
            <td>${renderReadonlyValue(item.cmra || "")}</td>
            <td>
              <span class="badge ${item.isActive ? "badge-active" : "badge-inactive"}">
                ${item.isActive ? "Active" : "Inactive"}
              </span>
            </td>
          </tr>
        `
      )
      .join("");
  }

  const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
  elements.pageIndicator.textContent = `第 ${state.page} / ${totalPages} 页`;
  elements.tableMeta.textContent = `共 ${state.total} 条记录`;
  elements.previousPageButton.disabled = state.page <= 1;
  elements.nextPageButton.disabled = state.page >= totalPages;
}

function renderSmartyTokens() {
  if (!state.smartyTokens.length) {
    elements.smartyTokensTbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">还没有配置 Smarty token。</td>
      </tr>
    `;
    return;
  }

  elements.smartyTokensTbody.innerHTML = state.smartyTokens
    .map(
      (token) => `
        <tr>
          <td>${escapeHtml(token.name)}</td>
          <td>${escapeHtml(token.authId)}</td>
          <td>
            <input
              class="field-input"
              type="number"
              min="0"
              value="${token.quotaLimit}"
              data-token-id="${token.id}"
              data-field="quotaLimit"
            />
          </td>
          <td>${token.quotaUsed}</td>
          <td>${token.quotaRemaining}</td>
          <td>
            <select class="field-select" data-token-id="${token.id}" data-field="status">
              ${renderSmartyStatusOptions(token.status)}
            </select>
          </td>
          <td>
            <input
              class="field-input"
              type="number"
              min="0"
              value="${token.priority}"
              data-token-id="${token.id}"
              data-field="priority"
            />
          </td>
          <td>
            <div class="action-row">
              <button class="button button-secondary" type="button" data-token-id="${token.id}" data-action="reset">重置用量</button>
            </div>
            ${token.lastError ? `<div class="cell-meta">${escapeHtml(token.lastError)}</div>` : ""}
          </td>
        </tr>
      `
    )
    .join("");
}

function renderEnumSelect(id, field, currentValue) {
  const values =
    field === "rdi"
      ? ["Unknown", "Residential", "Commercial"]
      : ["Unknown", "Y", "N"];

  const options = values
    .map(
      (value) => `
        <option value="${value}" ${value === currentValue ? "selected" : ""}>${value}</option>
      `
    )
    .join("");

  return `
    <select class="field-select" data-location-id="${id}" data-field="${field}">
      ${options}
    </select>
  `;
}

function renderReadonlyValue(value) {
  return `<span class="readonly-value">${escapeHtml(value)}</span>`;
}

function renderLocationLink(item, label) {
  const text = escapeHtml(label);
  const url = item.detail_url || item.detailUrl;
  if (!url) {
    return text;
  }

  return `<a class="location-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${text}</a>`;
}

function renderSmartyStatusOptions(currentValue) {
  return ["active", "disabled", "exhausted", "error"]
    .map(
      (value) => `
        <option value="${value}" ${value === currentValue ? "selected" : ""}>${value}</option>
      `
    )
    .join("");
}

function syncActionState() {
  elements.crawlStartButton.disabled = state.isRunning;
  elements.personalizeScanButton.disabled = state.isRunning;
  elements.smartyEnrichButton.disabled = state.isRunning;
}

function startPolling() {
  if (state.pollTimer) {
    return;
  }

  state.pollTimer = window.setInterval(() => {
    void Promise.all([loadStatus(), loadLocations(), loadSmartyTokens()]);
  }, 4000);
}

function stopPolling() {
  if (!state.pollTimer) {
    return;
  }

  window.clearInterval(state.pollTimer);
  state.pollTimer = null;
}

function setStatusPill(label, className) {
  elements.statusPill.textContent = String(label).toUpperCase();
  elements.statusPill.className = `pill ${className}`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function formatCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatRangeValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return String(value);
}

function formatJobType(type) {
  if (type === "smarty") {
    return "Smarty 补全";
  }

  if (type === "personalize") {
    return "编号扫描";
  }

  if (type === "locations") {
    return "地址抓取";
  }

  return type || "-";
}

function renderSummaryStats() {
  const activeCount = state.items.filter((item) => item.isActive).length;
  const personalizeCount = state.items.filter(
    (item) =>
      typeof item.personalize_min === "number" &&
      typeof item.personalize_max === "number"
  ).length;
  const smartyCount = state.items.filter(
    (item) =>
      Boolean(item.rdi) || Boolean(item.cmra)
  ).length;
  const smartyRemaining = state.smartyTokens
    .filter((token) => token.status === "active")
    .reduce((sum, token) => sum + (token.quotaRemaining || 0), 0);

  elements.statTotalLocations.textContent = String(state.total || 0);
  elements.statActiveLocations.textContent = String(activeCount);
  elements.statPersonalizeCount.textContent = String(personalizeCount);
  elements.statSmartyCount.textContent = String(smartyCount);
  elements.statSmartyRemaining.textContent = String(smartyRemaining);
}

function renderHeroHint() {
  const parts = [];
  if (state.filters.q) {
    parts.push(`搜索: ${state.filters.q}`);
  }
  if (state.filters.state) {
    parts.push(`州: ${state.filters.state}`);
  }
  if (state.filters.isActive === "1") {
    parts.push("状态: Active");
  } else if (state.filters.isActive === "0") {
    parts.push("状态: Inactive");
  }

  elements.heroHint.textContent = parts.length
    ? `当前筛选将影响后台任务。${parts.join(" · ")}`
    : "未设置筛选时，后台任务将基于全部可匹配地址运行。";
}

async function startJob(url, payload = null) {
  syncActionState();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: payload
        ? {
            "content-type": "application/json"
          }
        : undefined,
      body: payload ? JSON.stringify(payload) : undefined
    });
    const responsePayload = await response.json();

    if (!response.ok) {
      throw new Error(responsePayload.reason || responsePayload.message || "启动失败");
    }

    await loadStatus();
  } catch (error) {
    console.error(error);
    window.alert(error.message);
  } finally {
    syncActionState();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
