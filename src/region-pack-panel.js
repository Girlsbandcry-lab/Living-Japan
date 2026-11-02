// LJ-REGION-PACK-PANEL-20261031: public downloads have their own live progress and never write personal settings.
const DEFAULT_PACKS = [
  ['metro', '首都圈', '东京、神奈川、埼玉、千叶'], ['hokkaido', '北海道', '北海道'],
  ['tohoku', '东北', '青森、岩手、宫城、秋田、山形、福岛'], ['kanto', '关东', '茨城、栃木、群马'],
  ['chubu', '中部', '中部地区'], ['kinki', '近畿', '近畿地区'], ['chugoku', '中国', '中国地区'],
  ['shikoku', '四国', '四国地区'], ['kyushu-okinawa', '九州与冲绳', '九州、冲绳'],
];
const PHASES = { preparing: '正在准备下载', downloading: '正在下载', saving: '正在保存', verifying: '正在校验', paused: '下载已暂停', error: '下载未完成', ready: '下载与校验完成' };
const activeOperation = operation => Boolean(operation && !['paused', 'error', 'ready'].includes(operation.phase));
const bytes = value => Number.isFinite(value) ? value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : value >= 1_000 ? `${(value / 1_000).toFixed(1)} kB` : `${Math.max(0, value)} B` : '待公布';
const publicVersion = value => value && !/[a-f0-9]{12,}/i.test(String(value)) ? String(value) : '';
const publicError = value => /[a-f0-9]{12,}|https?:|(?:data|src)\/|common|chunk/i.test(String(value)) ? '资料下载未完成，请重试。' : String(value || '');

export function createRegionPackPanel({ manager, store, onChangePackages = operation => operation(), onContinue, closeWorkspace, document = globalThis.document } = {}) {
  if (!manager?.getState || !document?.body) throw new TypeError('资料包页面需要下载管理器与页面');
  if (!document.getElementById('living-japan-pack-panel-styles')) {
    const link = document.createElement('link'); link.id = 'living-japan-pack-panel-styles'; link.rel = 'stylesheet';
    link.href = new URL('./region-pack-panel.css', import.meta.url).href; (document.head || document.documentElement).append(link);
  }
  const make = (tag, className = '', text = '') => { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; };
  const button = (text, action, handler, className = '') => {
    const node = make('button', className, text); node.type = 'button'; node.setAttribute('data-pack-action', action);
    node.addEventListener('click', handler); return node;
  };
  const dialog = make('dialog', 'lj-pack-dialog'); dialog.id = 'living-japan-region-pack-panel'; dialog.hidden = true;
  dialog.setAttribute('aria-labelledby', 'lj-pack-heading'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('role', 'dialog');
  const header = make('header', 'lj-pack-header'), heading = make('h2', '', '地区资料包'); heading.id = 'lj-pack-heading';
  const headingText = make('div'); headingText.append(heading, make('p', 'lj-pack-header-note', '按需要下载，个人资料独立保存'));
  const close = button('×', 'close', hide, 'lj-pack-close'); close.setAttribute('aria-label', '关闭地区资料包页面'); header.append(headingText, close);
  const content = make('div', 'lj-pack-content'), intro = make('section', 'lj-pack-intro');
  const introTitle = make('strong'), introText = make('p'); intro.append(introTitle, introText);
  const notice = make('div', 'lj-pack-notice'); notice.setAttribute('data-pack-notice', ''); notice.setAttribute('role', 'status');
  const error = make('div', 'lj-pack-error'); error.hidden = true; error.setAttribute('role', 'alert');
  const toolbar = make('div', 'lj-pack-toolbar'), refresh = button('检查可下载版本', 'refresh', () => { void refreshCatalog(); }, 'lj-pack-secondary');
  toolbar.append(make('span', '', '首都圈为必需资料；其他大区下载后可单独启用'), refresh);
  const list = make('div', 'lj-pack-list');
  content.append(intro, notice, error, toolbar, list);
  const footer = make('footer', 'lj-pack-footer'), footerText = make('p', '', '下载包含所需的共用基础资料；移除公共下载会保留个人正文、开关与收藏。');
  const continueButton = button('开始使用', 'continue', () => { void continueToApp(); }, 'lj-pack-primary');
  footer.append(footerText, continueButton); dialog.append(header, content, footer); document.body.append(dialog);
  let state = manager.getState(), required = false, focusId = 'metro', busy = false, changingActive = false, refreshing = false, destroyed = false, lastFocus = null, pendingRemoval = null;
  let ownError = '', refreshPromise = null;
  const cards = new Map();
  const view = document.defaultView || globalThis, media = view.matchMedia?.('(prefers-color-scheme: dark)');
  function updateTheme() {
    const saved = store?.read?.() || {}, theme = saved.extensionUi?.theme || saved.livingJapanUIPreferences?.uiThemePreference || 'auto';
    dialog.setAttribute('data-theme', theme === 'night' || (theme === 'auto' && media?.matches) ? 'night' : 'day');
  }
  function entryList() {
    const entries = new Map(DEFAULT_PACKS.map(([id, name, description]) => [id, { id, name, description }]));
    const hidden = new Set(['common', ...(state.catalog?.packages || []).filter(entry => entry.internal || entry.hidden).map(entry => entry.id)]);
    for (const entry of state.catalog?.packages || []) if (!hidden.has(entry.id)) entries.set(entry.id, { ...entries.get(entry.id), ...entry });
    for (const [id, value] of Object.entries(state.packages || {})) if (!hidden.has(id) && !entries.has(id)) entries.set(id, { id, name: value.installed?.manifest?.name || '地区资料' });
    for (const id of hidden) entries.delete(id);
    return [...entries.values()];
  }
  function createCard(entry) {
    const id = entry.id, root = make('section', 'lj-pack-card'); root.setAttribute('data-pack-id', id); root.setAttribute('tabindex', '-1');
    const top = make('div', 'lj-pack-card-top'), names = make('div'), name = make('h3'), description = make('p', 'lj-pack-description'), badge = make('span', 'lj-pack-badge');
    names.append(name, description); top.append(names, badge);
    const details = make('p', 'lj-pack-details');
    const progressBox = make('div', 'lj-pack-progress-box'), phase = make('div', 'lj-pack-phase'), progress = make('progress'), count = make('div', 'lj-pack-count');
    phase.setAttribute('data-pack-phase', id); progress.setAttribute('data-pack-progress', id); progress.setAttribute('aria-label', `${entry.name}下载进度`);
    progressBox.append(phase, progress, count);
    const actions = make('div', 'lj-pack-actions');
    const install = button('下载', `install:${id}`, () => { void mutate(() => manager.install(id), manager.installChangesActive?.(id) !== false); }, 'lj-pack-primary');
    const enable = button('暂停使用', `enable:${id}`, () => { void mutate(() => manager.setEnabled(id, !state.packages[id]?.enabled)); }, 'lj-pack-secondary');
    const remove = button('移除下载', `remove:${id}`, () => { pendingRemoval = id; render(); }, 'lj-pack-text-button');
    const cancel = button('取消下载', `cancel:${id}`, () => { manager.cancel(id); }, 'lj-pack-secondary');
    actions.append(install, enable, cancel, remove);
    const confirm = make('div', 'lj-pack-confirm'), confirmText = make('p', '', '移除这份公共下载？个人正文、开关与收藏都会保留。');
    const confirmRemove = button('确认移除', `confirm-remove:${id}`, () => { pendingRemoval = null; void mutate(() => manager.remove(id)); }, 'lj-pack-danger');
    confirm.append(confirmText, confirmRemove, button('保留', `keep:${id}`, () => { pendingRemoval = null; render(); }, 'lj-pack-secondary'));
    root.append(top, details, progressBox, actions, confirm); list.append(root);
    const card = { root, name, description, badge, details, progressBox, phase, progress, count, install, enable, remove, cancel, confirm, confirmRemove };
    cards.set(id, card); return card;
  }
  function render() {
    if (destroyed) return;
    updateTheme();
    const operation = state.operation, running = activeOperation(operation), locked = busy || running;
    const metro = state.packages?.metro, ready = state.ready ?? Boolean(metro?.installed && metro.enabled && metro.usable !== false);
    intro.hidden = !required;
    const recoverMetro = metro?.installed && metro.usable !== false && !metro.enabled;
    introTitle.textContent = ready ? '首都圈资料已准备好' : recoverMetro ? '启用首都圈资料' : '最后一步：下载首都圈资料';
    introText.textContent = ready ? '现在可以进入 Living Japan，查找地点并使用已下载资料。' : recoverMetro ? '资料已保存在本地，点击启用后即可开始使用。' : (state.catalog?.packages?.find(entry => entry.id === 'metro')?.coverage?.description || '下载当前已审收的首都圈资料，这里会显示实际进度。');
    notice.textContent = !state.sourceUrl ? '地区下载源尚未配置，当前不能下载。已有公共下载与个人资料不会改变。' : refreshing ? '正在读取可下载版本…' : !state.loaded ? '地区安装记录尚未成功读取。' : !state.catalog ? '尚未取得下载目录，请重试检查版本。' : '';
    if(busy && changingActive && operation?.phase === 'ready') notice.textContent = '资料已保存，正在载入地区资料…';
    if(operation?.cleanupError) notice.textContent = '资料状态已更新；部分旧下载文件暂未清理，下次下载或移除时会重试。';
    notice.hidden = !notice.textContent;
    error.textContent = publicError(ownError); error.hidden = !ownError;
    refresh.disabled = refreshing || locked || !state.sourceUrl;
    close.disabled = locked;
    continueButton.hidden = !required; continueButton.disabled = !ready || locked;
    const entries = entryList(), visibleIds = new Set(entries.map(entry => entry.id));
    for (const [id, card] of cards) if (!visibleIds.has(id)) { card.root.remove(); cards.delete(id); }
    for (const entry of entries) {
      const card = cards.get(entry.id) || createCard(entry), saved = state.packages?.[entry.id], installed = saved?.installed;
      const current = operation?.packId === entry.id ? operation : null, downloading = activeOperation(current);
      const available = Boolean(entry.manifestUrl && state.sourceUrl), update = Boolean(installed && (state.updates ? state.updates.items.some(item => item.id === entry.id) : entry.version && entry.version !== installed.version));
      const retry = Boolean(saved?.pending || (installed && saved.usable === false) || ['paused', 'error'].includes(current?.phase));
      card.root.setAttribute('data-focus', String(entry.id === focusId));
      card.root.setAttribute('data-featured', String(required && entry.id === 'metro'));
      card.name.textContent = entry.name; card.description.textContent = entry.coverage?.description || entry.description || ''; card.description.hidden = !card.description.textContent;
      card.badge.textContent = downloading ? PHASES[current.phase] : installed ? saved.usable === false ? '需要重新下载' : update ? '可更新' : saved.enabled ? entry.id === 'metro' ? '必需 · 已启用' : '已启用' : '已下载 · 未启用' : retry ? '下载未完成' : '未下载';
      card.badge.setAttribute('data-status', downloading ? 'working' : installed && saved.enabled ? 'ready' : 'idle');
      const version = publicVersion(update || !installed ? entry.version : installed.version);
      const detail = version ? [`版本 ${version}`] : [];
      if (!installed || update || retry) detail.push(`本次下载 ${bytes(state.updates?.downloads?.[entry.id])}`);
      card.details.textContent = detail.join(' · ');
      card.install.hidden = Boolean((entry.id === 'metro' && recoverMetro) || (installed && !update && !retry));
      card.install.textContent = current?.phase === 'error' ? '重试下载' : retry ? '继续下载' : update ? '下载更新' : entry.id === 'metro' && required ? '下载首都圈资料' : '下载';
      card.install.disabled = locked || !state.loaded || !available;
      card.enable.hidden = !installed || (entry.id === 'metro' && !recoverMetro); card.enable.disabled = locked || saved?.usable === false; card.enable.textContent = entry.id === 'metro' ? '启用首都圈' : saved?.enabled ? '停用资料' : '启用资料';
      card.remove.hidden = entry.id === 'metro' || (!installed && !saved?.pending); card.remove.disabled = locked;
      card.cancel.hidden = !downloading; card.cancel.disabled = false;
      card.confirm.hidden = pendingRemoval !== entry.id; card.confirmRemove.disabled = locked;
      card.progressBox.hidden = !current || (!saved?.installed && current.phase === 'ready');
      if (current) {
        const total = Number(current.downloadTotalBytes) || 0, received = Number(current.downloadedBytes) || 0;
        card.phase.textContent = PHASES[current.phase] || '正在处理';
        if (current.phase === 'error' && current.error) card.phase.textContent += `：${publicError(current.error)}`;
        if (total > 0) { card.progress.max = total; card.progress.value = Math.min(total, Math.max(0, received)); }
        else { card.progress.max = 1; if(current.phase === 'ready') card.progress.value = 1; else card.progress.removeAttribute('value'); }
        const percentage = total > 0 ? `${Math.min(100, received / total * 100).toFixed(0)}% · ` : current.phase === 'ready' ? '100% · ' : '';
        card.count.textContent = `${percentage}已下载 ${bytes(received)}${total > 0 ? ` / ${bytes(total)}` : ''}`;
        card.progress.setAttribute('aria-valuetext', `${card.phase.textContent}；${card.count.textContent}`);
      }
    }
  }
  async function mutate(operation, affectsActive = true) {
    if (busy || activeOperation(state.operation)) return;
    const restorePanel = affectsActive && !dialog.hidden, previousControl = document.activeElement;
    const resume = () => {
      if (!restorePanel || destroyed) return;
      dialog.hidden = false;
      if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute('open', '');
    };
    busy = true; changingActive = affectsActive; ownError = ''; render();
    try {
      if (affectsActive) {
        // Let the workspace iframe handle its draft dialog before restoring download progress.
        if (restorePanel) { if (typeof dialog.close === 'function' && dialog.open) dialog.close(); dialog.removeAttribute('open'); dialog.hidden = true; }
        await onChangePackages(() => { resume(); return operation(); });
      } else await operation();
    }
    catch (reason) { const message = String(reason?.message || reason); if (reason?.name !== 'AbortError' && state.operation?.error !== message) ownError = message; }
    finally {
      busy = false; changingActive = false; state = manager.getState(); render(); resume();
      if (restorePanel && !destroyed) {
        if (dialog.contains(previousControl) && !previousControl.disabled && !previousControl.hidden) previousControl.focus?.();
        else cards.get(state.operation?.packId || focusId)?.root.focus();
      }
    }
  }
  async function refreshCatalog() {
    if (refreshPromise) return refreshPromise;
    if (!state.sourceUrl) { render(); return; }
    refreshing = true; ownError = ''; render();
    refreshPromise = (async () => {
      try { if (!state.loaded) await manager.load(); await manager.refreshCatalog(); }
      catch (reason) { ownError = String(reason?.message || reason); }
      finally { refreshing = false; state = manager.getState(); refreshPromise = null; render(); }
    })();
    return refreshPromise;
  }
  async function continueToApp() {
    if (continueButton.disabled) return;
    busy = true; render();
    try { const result = await (onContinue || closeWorkspace)?.(); if (result !== false) hide(true); }
    catch (reason) { ownError = String(reason?.message || reason); }
    finally { busy = false; render(); }
  }
  function hide(force = false) {
    if ((busy || activeOperation(state.operation)) && force !== true) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    dialog.removeAttribute('open'); dialog.hidden = true;
    lastFocus?.focus?.();
  }
  const cancelDialog = event => { event.preventDefault(); hide(); };
  dialog.addEventListener('cancel', cancelDialog);
  const unsubscribe = manager.subscribe(value => { state = value; render(); });
  const unsubscribeStore = store?.subscribe?.(updateTheme);
  media?.addEventListener?.('change', updateTheme);
  function destroy() {
    if (destroyed) return; destroyed = true; unsubscribe(); unsubscribeStore?.(); media?.removeEventListener?.('change', updateTheme);
    hide(true); dialog.remove();
  }
  return {
    async open(options = {}) {
      if (destroyed) return;
      required = Boolean(options.required); focusId = options.focusId || 'metro'; pendingRemoval = null;
      if (dialog.hidden) lastFocus = document.activeElement;
      state = manager.getState(); render(); dialog.hidden = false;
      if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute('open', '');
      const card = cards.get(focusId); card?.root.scrollIntoView?.({ block: 'nearest' }); card?.root.focus();
      if (state.updates?.checking) await refreshCatalog();
    },
    destroy,
  };
}
