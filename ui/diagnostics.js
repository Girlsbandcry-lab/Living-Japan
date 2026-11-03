import { MATERIAL_LAYER_LABELS as LABELS } from '../src/material-catalog.js';
import { materialPackageId, MATERIAL_ANY_REGION_ID } from '../src/material-library.js';
const TABS = [['results', '资料结果'], ['prompt', '提示词全文'], ['channels', '读取通道'], ['raw', '原始 JSON']];
const administrativePlaceReasons = {
  administrative_context_missing: '未读到地点对应的行政区',
  administrative_context_ambiguous: '行政区名称有歧义，请补充市或都道府县',
  administrative_context_mismatch: '读取到的行政区与地点归属不符',
  newer_administrative_context: '已读取到较新的行政区，前文地点不再适用',
  place_administration_missing: '地点未登记可配对的行政区',
  ambiguous_named_place: '同一行政区有多个同名地点',
};
const materialReasons = { region_mismatch: '适用地域不符', time_or_weather_mismatch: '故事时间或天气条件不符或缺失', binding_off: '此地点的词条挂接已暂停', empty_body: '当前有效正文为空', alternate_version: '同组另一版本的地域优先', outside_legacy_metro_scope: '首都圈既有资料不适用于此地域', region_branch_off: '适用地域分支已暂停' };

export function storyDateDiagnosticText(diagnostic = {}) {
  const date = (diagnostic.restoredStoryState || diagnostic.channels?.TN?.state)?.date;
  if (!date) return '本记录未读到有效日期';
  const source = diagnostic.channels?.TN?.stateSources?.date, selected = diagnostic.calendarSelection;
  const precision = date.day !== null && date.day !== undefined ? '具体日期' : Number.isInteger(date.monthPart) ? '未指定具体日' : '仅月份，未指定旬或具体日';
  const sourceLabel = source?.source === 'current_user' ? '本轮用户输入' : source?.source === 'assistant_history' ? `向上第 ${source.historyIndex} 层 AI 回复` : '未记录读取位置';
  return [`有效日期：${date.raw || date.month + '月'}（${precision}）`, sourceLabel,
    selected ? `旧日历查表：${selected.label || selected.segmentId}${selected.monthOnlyFallback ? '（沿用原有15日选段；不作为已知日期或旬）' : ''}` : ''].filter(Boolean).join(' · ');
}

export function materialDiagnosticRows(diagnostic = {}) {
  return [...(diagnostic.materialPipeline?.skipped || []).map(row => ({ input: { id: materialPackageId(row.id), reason: row.reason }, status: row.reason === 'empty_body' ? 'empty' : /off/.test(row.reason) ? 'closed' : 'candidate', explanation: materialReasons[row.reason] || '' })),
    ...(diagnostic.materialPipeline?.legacyClimateSkipped || []).map(row => ({ input: row, status: row.reason === 'region_branch_off' ? 'closed' : 'candidate', explanation: materialReasons[row.reason] }))];
}

// LJ-DIAGNOSTICS-LIVE: 实际宏记录与当前试算分开，完整报告只取真实运行结果。
export function mountDiagnostics(ui) {
  const { session, catalog } = ui.bridge, esc = ui.esc;
  const desktop = ui.layout === 'desktop';
  // LJ-DIAGNOSTICS-APPROVED-VIEW-20261101: restore each approved view while retaining the live record contract.
  const page = desktop ? document.getElementById('ljDiagnosticsPage') : document.querySelector('[data-page-root="diagnostic"]');
  if (!desktop && page) {
    page.classList.add('lj-diagnostic-narrow');
    if (ui.layout === 'mobile') page.classList.add('mobile-diagnostic');
    page.innerHTML = '<div class="record-switch" id="diagRecords"></div><p class="mobile-diag-scope" id="diagScope"></p><div class="summary" id="diagSummary"></div>' +
      '<div class="section-tabs" id="diagTabs"></div><div class="mobile-diag-find" id="diagFind"></div>' +
      '<div class="diag-scroll" id="diagScroll"><div id="diagResults"></div><div class="report" id="diagReport" hidden></div></div>' +
      '<div class="copybar" id="diagActions"></div>';
  }
  const records = document.getElementById(desktop ? 'check11Records' : 'diagRecords');
  const summary = document.getElementById(desktop ? 'check11Summary' : 'diagSummary');
  const tabs = document.getElementById(desktop ? 'check11Tabs' : 'diagTabs');
  const main = document.getElementById(desktop ? 'check11Content' : 'diagResults');
  const report = desktop ? main : document.getElementById('diagReport');
  if (!records || !summary || !tabs || !main) return { render() {} };
  const queryHost = desktop ? main : document.getElementById('diagFind');
  let recordKind = 'actual', tab = 'results', filter = 'all', query = '', previewing = false, composing = false;
  const currentRecord = () => recordKind === 'preview' ? session.runtime.getLastPreview() : session.runtime.getLastActualInjection();
  const packageById = id => ui.engine.data.packages.find(item => item.id === id);
  function reasonText(reason) {
    if (!reason) return '';
    const code = String(reason);
    if (code.startsWith('control_group_off:')) {
      const id = code.slice('control_group_off:'.length), group = ui.engine.data.controlGroups.find(item => item.controlGroupId === id);
      return `由“${group?.label || id}”暂停`;
    }
    return ({ master_off: '提示注入已关闭', layer_off: '本通道已暂停', named_places_off: '具名地点正文已关闭', package_off: '本级正文已关闭', missing_station_package: '未找到站点正文包', waiting_for_macro: '等待宏展开', macro_not_expanded: '本轮没有展开 Living Japan 宏', disabled: '未启用', direct: '本轮直接命中', linked: '由已登记关系联动', material_fragment: '按地点及适用条件选入', empty: '当前有效正文为空' })[code] || code;
  }
  function rowData(record) {
    const diagnostic = record?.diagnostics || {}, result = [], occupied = new Set();
    // LJ-DIAGNOSTIC-STATUS-20261103: one package row retains the evidence of every evaluated place.
    const pipeline = diagnostic.materialPipeline, evidence = new Map();
    const contextNames = new Map((pipeline?.contexts || []).map(row => [row.entityId, row.name]));
    const placement = diagnostic.livingAreaExpansion?.placedMaterials;
    const placed = new Set((placement || []).map(row => JSON.stringify([row.packageId, row.entityId])));
    for (const row of pipeline?.evaluated || []) {
      if (!evidence.has(row.packageId)) evidence.set(row.packageId, []);
      evidence.get(row.packageId).push(row);
    }
    const add = (input, status, explanation = '') => {
      const id = typeof input === 'string' ? input : input.id || input.packageId;
      if (!id || occupied.has(id)) return;
      occupied.add(id);
      const item = packageById(id), detail = typeof input === 'string' ? {} : input;
      if (item?.materialAnchor) return;
      const reasons = (evidence.get(id) || []).map(row => {
        const permission = row.allowed === true ? '开关允许取用' : row.allowed === false ? '开关限制' : '开关未评估';
        const condition = row.conditionsMatched === true ? '条件匹配' : row.conditionsMatched === false ? '条件不符' : '条件未评估';
        const here = status === 'injected' && placed.has(JSON.stringify([id, row.entityId]));
        const placementText = here ? (recordKind === 'preview' ? '预计在此处拼接' : '已在此处拼接') : placement && row.attached ? (recordKind === 'preview' ? '预计不在此处拼接' : '本处未拼接') : '';
        const reasons = new Set([row.blocker, row.reason].filter(Boolean).map(code => materialReasons[code] || reasonText(code)));
        const scope = row.universal ? '通用文字' : row.regionId === MATERIAL_ANY_REGION_ID ? '不限地域' : '';
        const details = [scope, permission, condition, placementText, ...reasons].filter(Boolean);
        const origin = row.keyword ? `独立有效词“${row.trigger}”${row.entityId ? '（地域参考：' + (contextNames.get(row.entityId) || row.entityId) + '）' : ''}` : contextNames.get(row.entityId) || row.entityId;
        return `${origin}：${details.join(' · ')}`;
      });
      const keywordSelected = pipeline?.selected?.some(row => row.packageId === id && row.keyword);
      const keyword = (evidence.get(id) || []).find(row => row.keyword && (status !== 'injected' || keywordSelected));
      result.push({ id, name: detail.displayName || item?.displayName || id, layer: item?.layer || detail.layer || '', status, reason: reasons.join('；') || explanation || reasonText(detail.blocker || detail.reason), trigger: detail.trigger || keyword?.trigger || '', custom: Boolean(detail.customText), source: sourceText(detail.source || keyword?.source) });
    };
    (diagnostic.injectedPackages || record?.packageIds || []).forEach(item => add(item, 'injected'));
    (diagnostic.blockedPackages || []).forEach(item => add(item, 'closed'));
    (diagnostic.recognizedEmptyBodies || []).forEach(item => add(item, 'empty', '已识别，当前有效正文为空'));
    (diagnostic.duplicatesRemoved || []).forEach(item => add(item, 'merged', '正文重复，合并输出'));
    for (const [id, rows] of evidence) {
      const status = rows.every(row => row.allowed === false) ? 'closed' : rows.some(row => !row.reason) ? 'selected' : rows.some(row => row.reason === 'empty_body') ? 'empty' : 'candidate';
      add(id, status);
    }
    materialDiagnosticRows(diagnostic).forEach(row => add(row.input, row.status, row.explanation));
    for (const parent of diagnostic.namedStationParents || []) {
      for (const station of parent.stationStates || []) add(station, station.selected ? 'selected' : 'candidate', station.blocker ? reasonText(station.blocker) : station.selected ? '已选中；最终是否输出见正文结果' : '属于上层站候选，本次未选中');
    }
    (diagnostic.matchedBeforeLinks || []).forEach(item => add(item, 'candidate', '已识别候选，未列入最终正文'));
    return result;
  }
  function statusLabel(value) {
    return ({ injected: recordKind === 'preview' ? '预计拼接' : '已拼接', closed: '受开关限制', empty: '空正文', merged: '已合并', selected: '已选中', candidate: '候选' })[value] || value;
  }
  function statusText(record) {
    if (!record) return recordKind === 'preview' ? '尚未试算当前聊天' : '尚无本聊天的实际宏记录';
    if (record.status === 'expanded' || record.status === 'preview') {
      const preview = record.status === 'preview';
      if (record.prompt === '') return preview ? '已试算，预计没有资料输出' : '本轮宏已展开，但没有资料输出';
      if (record.prompt && Array.isArray(record.packageIds) && !record.packageIds.length) return preview ? '试算预计输出地点参考' : '本轮宏已输出地点参考';
    }
    return ({ preview: '仅当前聊天试算', expanded: '本轮宏已展开；不代表模型已接收', pending: '本轮等待宏展开', macro_not_expanded: '本轮未展开宏', rejected: '本轮生成类型未进入注入', error: '本轮发生错误' })[record.status] || '运行记录';
  }
  function sourceText(source) {
    if (!source) return '未记录读取位置';
    const kind = typeof source === 'string' ? source : source.source;
    if (kind === 'current_user') return '本轮用户输入';
    if (kind === 'assistant_history') return Number(source.historyIndex) > 0 ? `向上第 ${source.historyIndex} 层 AI 回复` : 'AI 历史回复';
    return kind ? String(kind) : '未记录读取位置';
  }
  function placeReading(record) {
    const diagnostic = record?.diagnostics || {}, match = diagnostic.placeMatch;
    if (!['expanded', 'preview'].includes(record?.status)) return { entries: [] };
    if (match?.stopReason === 'master_disabled' || diagnostic.reason === 'master_off') return { entries: [], message: '自动扫描已关闭' };
    if (match?.stopReason === 'ex_disabled') return { entries: [], message: '本记录未读取地点通道' };
    const matchesIds = match?.directPlaceIds ?? diagnostic.livingAreaExpansion?.directPlaceIds;
    if (!Array.isArray(matchesIds)) return { entries: [], message: '本记录没有地点识别明细' };
    const ids = [...new Set(matchesIds)];
    if (!ids.length) return { entries: [], message: administrativePlaceReasons[match?.stopReason] || '未命中地点' };
    const contexts = ui.engine.data.canonicalPlaceContexts || {};
    return { entries: ids.map(id => {
      const evidence = match?.matches?.find(row => row.id === id);
      const name = evidence?.displayName || contexts.rows?.[contexts.aliases?.[id] || id]?.name || catalog.get?.(id)?.name || id;
      return { name, source: evidence?.source, trigger: evidence?.trigger };
    }) };
  }
  function placeMatchText({ entries, message }) {
    if (entries.length > 1) return `本次直接命中 ${entries.length} 处地点`;
    const place = entries[0];
    return place ? [`本次直接命中：${place.name}`, place.source && sourceText(place.source)].filter(Boolean).join(' · ') : message || '';
  }
  function readingSource(source) {
    const tags = source?.tagNames?.length ? `标签 ${source.tagNames.join('、')}` : '';
    return [sourceText(source), tags].filter(Boolean).join(' · ');
  }
  // LJ-DIAGNOSTIC-READING-SUMMARY-20261103: explain the selected record without inferring any new state.
  function readingSummary(record, place) {
    if (!['expanded', 'preview'].includes(record?.status)) return '';
    const diagnostic = record.diagnostics || {}, channel = diagnostic.channels?.TN;
    const state = diagnostic.restoredStoryState ?? channel?.state;
    const sources = channel?.stateSources, date = state?.date;
    const dateText = date?.month ? [
      date.year ? `${date.year}年` : '', `${date.month}月`,
      date.day ? `${date.day}日` : ['上旬', '中旬', '下旬'][date.monthPart] || '',
    ].join('') : '';
    const clock = point => Number.isInteger(point?.hour) && Number.isInteger(point?.minute)
      ? [point.hour, point.minute].map(value => String(value).padStart(2, '0')).join(':') : '';
    const endpoint = clock(state?.clockEndpoint ?? state?.timeRange?.endPoint);
    const start = clock(state?.timeRange?.start);
    const time = start && endpoint ? `${start}–${endpoint}（采用 ${endpoint}）` : endpoint;
    const weatherLabels = { clear: '晴朗', cloudy: '阴天／多云', rain: '下雨', light_rain: '小雨', steady_rain: '持续降雨', heavy_rain: '大雨／雷雨', light_snow: '小雪', heavy_snow: '大雪', snow: '降雪', snow_cover: '积雪', strong_wind: '强风', typhoon: '台风', not_raining: '雨停' };
    const weather = state?.weather, weatherText = weatherLabels[weather?.type] || weather?.trigger || (weather?.type ? '已识别天气（名称未记录）' : '');
    const field = (label, value, source, recordedValue) => {
      const display = diagnostic.reason === 'master_off' ? '未读取（自动扫描已关闭）'
        : value || (recordedValue === null ? '未读到有效' + label : '未记录');
      return `<div><dt>${label}</dt><dd><strong>${esc(display)}</strong>${value && display === value ? `<small>${esc(readingSource(source))}</small>` : ''}</dd></div>`;
    };
    const locations = place.entries.length ? place.entries.map(item =>
      `<div><strong>${esc(item.name)}</strong><small>${esc([readingSource(item.source), item.trigger && `触发词“${item.trigger}”`].filter(Boolean).join(' · '))}</small></div>`
    ).join('') : `<strong>${esc(place.message)}</strong>`;
    const recordedClock = state?.clockEndpoint === undefined ? state?.timeRange : state.clockEndpoint;
    return `<section class="lj-diagnostic-reading-summary" aria-label="本次读到"><h3>本次读到</h3><dl>${field('日期', dateText, sources?.date, date)}${field('时刻', time, sources?.clockEndpoint ?? sources?.timeRange, recordedClock)}${field('天气', weatherText, sources?.weather, weather)}<div class="lj-diagnostic-reading-place"><dt>地点</dt><dd>${locations}</dd></div></dl></section>`;
  }
  function detailed() { return ui.engine.normalizeSettings?.(ui.bridge.store?.read?.().livingJapanSettings || {})?.diagnostics !== false; }
  function filtersHtml() {
    return [['all','全部'],['injected','拼接'],['closed','开关限制'],['empty','空正文'],['candidate','候选/选中'],['merged','合并']].map(([id,label]) => `<button type="button" class="${filter === id ? 'on' : ''}" data-lj-diag-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join('');
  }
  function filteredRows(record) {
    return rowData(record).filter(item => (filter === 'all' || item.status === filter || filter === 'candidate' && item.status === 'selected') && (!query || `${item.name} ${item.trigger} ${LABELS[item.layer] || ''} ${item.source} ${item.reason}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  }
  function resultRowsHtml(record, rows) {
    return rows.length ? rows.map(item => {
      const meta = `${LABELS[item.layer] || item.layer}${item.custom ? ' · 使用修改稿' : ''}`;
      const reason = [item.trigger ? `命中“${item.trigger}”` : '', item.reason].filter(Boolean).join(' · ');
      if (desktop) return `<button type="button" class="check11-row" data-lj-diag-package="${esc(item.id)}"><span class="check11-name"><strong>${esc(item.name)}</strong><small>${esc(meta)}</small></span><span class="check11-status ${item.status}">${statusLabel(item.status)}</span><span class="check11-source" title="${esc(item.source)}">${esc(item.source)}</span><span class="check11-reason" title="${esc(reason)}">${esc(reason || '未记录处理原因')}</span></button>`;
      return `<button type="button" class="li lj-diagnostic-result${ui.layout === 'mobile' ? ' mobile-diag-result' : ''}" data-lj-diag-package="${esc(item.id)}"><span class="grow"><span class="name">${esc(item.name)}</span><span class="meta">${esc(meta)}</span><span class="meta">${esc(item.source)}</span>${reason ? `<span class="reason"${ui.layout === 'mobile' && !detailed() ? ' hidden' : ''}>${esc(reason)}</span>` : ''}</span><span class="tag ${['closed', 'empty'].includes(item.status) ? 'warn' : item.status === 'injected' ? 'ok' : ''}">${statusLabel(item.status)}</span></button>`;
    }).join('') : `<p class="${desktop ? 'check11-empty' : 'search-empty'}">${record ? '当前筛选没有条目。' : statusText(record)}</p>`;
  }
  // LJ-DIAGNOSTIC-INPUT-01: preserve the live search input while refreshing its result list.
  function renderResults(record, place = placeReading(record)) {
    const input = queryHost.querySelector('[data-lj-diag-query]'), list = main.querySelector('[data-lj-diag-list]');
    const rows = filteredRows(record), total = rowData(record).length;
    const columns = desktop ? '<div class="check11-tablehead"><span>资料名称</span><span>结果</span><span>读取位置</span><span>命中与处理原因</span></div>' : '';
    const contents = readingSummary(record, place) + columns + resultRowsHtml(record, rows);
    if (desktop && (!input || !list)) {
      main.innerHTML = `<section class="check11-results"><div class="check11-filterbar"><div class="check11-filters">${filtersHtml()}</div><input class="check11-search" type="search" data-lj-diag-query aria-label="检索诊断名称、类型、来源或原因" placeholder="搜索名称、类型、来源或原因" value="${esc(query)}"></div><div class="check11-list" data-lj-diag-list>${contents}</div><div class="check11-foot"><span data-lj-diag-visible>显示 ${rows.length} / ${total} 条</span><span>长列表在此处滚动</span></div></section>`;
    } else if (!list) {
      main.innerHTML = `<div class="list diag-list" data-lj-diag-list>${contents}</div>`;
    } else if (!composing) {
      if (input && input.value !== query) input.value = query;
      list.innerHTML = contents;
    }
    const visible = main.querySelector('[data-lj-diag-visible]');
    if (visible) visible.textContent = `显示 ${rows.length} / ${total} 条`;
    queryHost.querySelectorAll('[data-lj-diag-filter]').forEach(node => { const active = filter === node.dataset.ljDiagFilter; node.classList.toggle('on', active); node.setAttribute('aria-pressed', String(active)); });
    const clear = queryHost.querySelector('[data-lj-diag-clear]'); if (clear) clear.hidden = !query;
  }
  function channelsHtml(record) {
    const diagnostic = record?.diagnostics || {}, saved = ui.engine.normalizeSettings(ui.bridge.store.read().livingJapanSettings);
    const channels = Object.entries(LABELS).map(([key, label]) => {
      const channel = diagnostic.channels?.[key];
      const sources = channel?.entries?.length ? `<ul>${channel.entries.map(entry => `<li><strong>${esc(readingSource(entry))}</strong>${entry.textPreview ? `<br>${esc(entry.textPreview)}` : ''}</li>`).join('')}</ul>` : '<p>本记录没有逐条来源明细。</p>';
      const details = channel ? `<details><summary>查看本记录读取来源</summary>${sources}<details><summary>原始通道记录</summary><pre class="lj-report">${esc(JSON.stringify(channel, null, 2))}</pre></details></details>` : '';
      const count = channel ? [
        Number.isInteger(channel.actualHistoryChecked) && `回看 ${channel.actualHistoryChecked} 层`,
        Array.isArray(channel.recognized) && `${channel.recognized.length} 个识别`,
        Array.isArray(channel.blocked) && `${channel.blocked.length} 个受开关限制`,
      ].filter(Boolean).join(' · ') : '';
      return `<section class="${desktop ? 'check11-channel' : 'lj-diagnostic-channel'}"><h3>${label}<button type="button" class="${desktop ? 'check11-action' : 'btn text'}" data-lj-diag-settings="${key}">读取设置</button></h3><p>${count || (channel ? '本记录没有通道统计。' : '此记录没有通道读取信息。')}</p>${key === 'TN' && channel ? `<p>${esc(storyDateDiagnosticText(diagnostic))}</p>` : ''}<ul><li>当前设置优先标签：${esc(saved.channelTags?.[key]?.priority?.join('、') || '未设置')}</li><li>当前排除标签：${esc(saved.channelTags?.[key]?.excluded?.join('、') || '未设置')}</li></ul>${details}</section>`;
    }).join('');
    return desktop ? `<div class="check11-channels">${channels}</div>` : channels;
  }
  function readingText(record) { return tab === 'prompt' ? record?.prompt || '' : JSON.stringify(record || { status: 'no_record' }, null, 2); }
  function readingHtml(record) {
    const text = readingText(record), prompt = tab === 'prompt';
    const title = prompt ? `${recordKind === 'preview' ? '预览' : '实际'}提示词全文` : '原始诊断 JSON';
    return `<section class="${desktop ? 'check11-reading' : 'lj-diagnostic-reading'}"><div class="${desktop ? 'check11-readinghead' : 'lj-diagnostic-readinghead'}"><strong>${title}</strong><span>${text.length} 字符</span><button type="button" class="${desktop ? 'check11-action' : 'btn text'}" data-lj-diag-action="copy-page">复制${prompt ? '提示词' : ' JSON'}</button></div><pre class="${desktop ? '' : 'code'}">${esc(text || '本记录没有提示词正文。')}</pre></section>`;
  }
  function render() {
    const record = currentRecord(), rows = rowData(record);
    const count = kind => ['expanded', 'preview'].includes(record?.status) ? rows.filter(item => item.status === kind).length : '—';
    const place = placeReading(record), placeMatch = placeMatchText(place), outputLabel = recordKind === 'preview' ? '预计拼接正文' : '已拼接正文';
    records.innerHTML = `<button type="button" data-lj-diag-record="actual" class="${recordKind === 'actual' ? 'on' : ''}" aria-pressed="${recordKind === 'actual'}">上一轮实际记录</button><button type="button" data-lj-diag-record="preview" class="${recordKind === 'preview' ? 'on' : ''}" aria-pressed="${recordKind === 'preview'}">当前聊天预览</button>`;
    summary.innerHTML = desktop ? `<div class="check11-outcome"><strong>${esc(statusText(record))}</strong><small data-lj-diag-place-match>${esc(placeMatch)}</small><small>${esc(record?.completedAt || record?.startedAt || '')}${record?.error ? ` · ${esc(record.error)}` : ''}</small></div><div class="check11-metrics"><span><b>${count('injected')}</b>${outputLabel}</span><span><b>${count('closed')}</b>开关限制</span><span><b>${count('empty')}</b>空正文</span></div>` : `<div class="metric"><b>${count('injected')}</b><span>${outputLabel}</span></div><div class="metric"><b>${count('closed')}</b><span>开关限制</span></div><div class="metric"><b>${count('empty')}</b><span>空正文</span></div>`;
    const scope = document.getElementById('diagScope'); if (!desktop && scope) scope.textContent = [statusText(record), record?.error, placeMatch].filter(Boolean).join(' · ');
    page.classList.toggle('lj-diagnostic-detailed', detailed());
    tabs.innerHTML = TABS.map(([id,label]) => `<button type="button" data-lj-diag-tab="${id}" class="${tab === id ? 'on' : ''}" aria-pressed="${tab === id}">${label}</button>`).join('');
    if (!desktop) { main.hidden = tab !== 'results'; report.hidden = tab === 'results'; queryHost.hidden = tab !== 'results'; }
    const target = tab === 'results' ? main : report;
    if (tab === 'results') renderResults(record, place);
    else if (tab === 'channels') target.innerHTML = channelsHtml(record);
    else target.innerHTML = readingHtml(record);
    document.querySelectorAll('[data-lj-diag-action="preview"]').forEach(node => { node.disabled = previewing; node.textContent = previewing ? '正在试算…' : '刷新预览'; });
  }
  async function copyText(text, message) {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else { const input = document.createElement('textarea'); input.value = text; document.body.append(input); input.select(); const copied = document.execCommand('copy'); input.remove(); if (!copied) throw new Error('当前浏览器没有允许复制，请在原始JSON页手动复制'); }
    const status = document.getElementById('diagCopyStatus'); if (status) status.textContent = message;
    ui.notify(message);
  }
  async function copyReport() {
    const record = currentRecord();
    if (!record) { ui.notify('当前没有可复制的诊断记录'); return; }
    const text = `Living Japan · ${recordKind === 'preview' ? '当前聊天预览' : '上一轮实际宏记录'}\n${statusText(record)}\n\n${JSON.stringify(record, null, 2)}`;
    await copyText(text, '已复制完整诊断记录');
  }
  async function action(event) {
    const target = event.target.closest('[data-lj-diag-record],[data-lj-diag-tab],[data-lj-diag-filter],[data-lj-diag-action],[data-lj-diag-package],[data-lj-diag-settings],[data-lj-diag-clear]'); if (!target) return;
    try {
      if (target.dataset.ljDiagRecord) { recordKind = target.dataset.ljDiagRecord; render(); }
      else if (target.dataset.ljDiagTab) { tab = target.dataset.ljDiagTab; render(); }
      else if (target.dataset.ljDiagFilter) { filter = target.dataset.ljDiagFilter; render(); }
      else if (target.dataset.ljDiagAction === 'preview') { if (previewing) return; previewing = true; render(); if (await session.preview() === null) return; recordKind = 'preview'; ui.notify('当前聊天预览已更新，上一轮实际记录保留'); }
      else if (target.dataset.ljDiagAction === 'copy') await copyReport();
      else if (target.dataset.ljDiagAction === 'copy-page') await copyText(readingText(currentRecord()), tab === 'prompt' ? '已复制提示词全文' : '已复制原始 JSON');
      else if (target.dataset.ljDiagClear !== undefined) { query = ''; renderResults(currentRecord()); queryHost.querySelector('[data-lj-diag-query]')?.focus(); }
      else if (target.dataset.ljDiagPackage) {
        const item = packageById(target.dataset.ljDiagPackage); if (!item) throw new Error('此旧记录的正文包已不在当前版本');
        const entity = catalog.get(item.placeId) || { id: item.placeId || `package:${item.id}`, name: item.displayName, type: LABELS[item.layer], packageIds: [item.id], coordinates: null };
        await ui.openReader(entity, item.id);
      } else if (target.dataset.ljDiagSettings) {
        await ui.openSettings('reading', target.dataset.ljDiagSettings);
      }
    } catch (error) { const status = document.getElementById('diagCopyStatus'); if (status && target.dataset.ljDiagAction?.startsWith('copy')) status.textContent = '复制未完成，可在原始 JSON 页选择文字复制。'; ui.notify(error.message || String(error), 'error'); }
    finally { if (previewing) { previewing = false; render(); } }
  }
  page.addEventListener('click', action);
  const actionHost = desktop ? document.querySelector('#check11Window .check11-actions') : document.getElementById('diagActions');
  if (actionHost) actionHost.innerHTML = `<button type="button" class="${desktop ? 'check11-action' : 'btn'}" data-lj-diag-action="preview">刷新预览</button><button type="button" class="${desktop ? 'check11-action primary' : 'btn primary'}" data-lj-diag-action="copy">复制完整诊断结果</button>${desktop ? '' : '<span id="diagCopyStatus" role="status"></span>'}`;
  if (!desktop) queryHost.innerHTML = `<div class="diag-filter" id="diagFilter">${filtersHtml()}</div><label class="mobile-diag-search"><span aria-hidden="true">⌕</span><input class="input" type="search" data-lj-diag-query aria-label="检索诊断名称、类型、来源或原因" placeholder="搜索名称、类型、来源或原因"><button type="button" class="btn text" data-lj-diag-clear aria-label="清除诊断搜索" hidden>×</button></label>`;
  function queryChanged(event) {
    if (!event.target.matches('[data-lj-diag-query]') || composing || event.isComposing) return;
    query = event.target.value;
    renderResults(currentRecord());
  }
  queryHost.addEventListener('compositionstart', event => { if (event.target.matches('[data-lj-diag-query]')) composing = true; });
  queryHost.addEventListener('compositionend', event => { if (!event.target.matches('[data-lj-diag-query]')) return; composing = false; queryChanged(event); });
  queryHost.addEventListener('input', queryChanged);
  render();
  return { render };
}
