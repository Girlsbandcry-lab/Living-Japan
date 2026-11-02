const step = (page, target, title, text, tab) => ({ page, target, title, text, tab });
const groups = {
  map: [
    step('map', '[data-map-query]', '先找到地点', '输入名称或类型后选择结果。名称负责选中当前地点，图钉负责移动地图；两种操作可以分开使用。'),
    step('map', '[data-map-favorites] button', '常用地点只负责选中', '四个快捷槽位使用你保存的自定义名。单击选为当前地点，再用地点操作区设置起点或终点。空槽可到设置填写。'),
    step('map', '[data-lj-map="origin"],[data-lj-map="read"],[data-lj-map="details"]', '再决定怎样使用地点', '选中地点后，可以阅读正文、设起点或终点，或追加名称。追加只放进聊天输入框，不替你发送。'),
  ],
  locations: [
    step('region', '#loc10Search,#regionSearch', '按名称或类型查找', '搜索名称、内置别名或地点类型。点结果会回到它实际所属的同级列表，再继续查看；退出搜索后恢复浏览。'),
    step('region', '#loc10List [data-enter],#regionList [data-enter],#loc10List [data-action="browse-read"],#regionList [data-action="browse-read"],#loc10ListHead button,#regionCrumb button', '逐层进入，正文单独打开', '地区、类型和设施的下级入口继续展开；地点名称选中本项，查看按钮打开正文。没有正文也先显示阅读空态，需要时再新增空位。'),
  ],
  packages: [
    step('package', '#pkg10Roots button,#packageRoots button', '从资料大项开始', '按时间与自然、外部地域、内部场所、明确场景事件进入当前层。父项进入下级，正文项打开阅读。'),
    step('package', '#pkg10CurrentSwitch,#packageCurrentSwitch', '分清整支与本级正文', '当前分支暂停会保留下级选择。正文自己的开关只控制本级；若被上级暂停，可查看原因再决定修改哪一级。'),
    step('package', '.lj-material-search input', '搜索后只批量改勾选正文', '先搜索，再开启多选。全选覆盖匹配正文，批量开关只改明确勾选的正文；目录分支保持独立。阅读后可比较原文并编辑修改稿，保存后才成为有效正文。'),
  ],
  check: [
    step('diagnostic', '[data-lj-diag-record="actual"]', '先区分记录与试算', '上一轮实际记录保存宏的运行结果；当前聊天预览只按现在的资料与开关试算，不覆盖上一轮记录。'),
    step('diagnostic', '[data-lj-diag-action="copy"],[data-lj-diag-tab="raw"]', '需要排查时复制完整报告', '筛选结果和读取通道帮助定位问题。复制报告导出完整当前记录；看到预览或宏展开，不代表模型已经收到正文。'),
  ],
  save: [
    step('settings', '[data-settings-common="theme"]', '常用设置即时保存', '主题、锁定和提示注入更改后即时保存。锁定只决定点击面板外部是否关闭，不影响外部聊天输入。', 'common'),
    step('settings', '[data-settings-action="save-reading"]', '读取设置由本组统一保存', '调整文字、回看层数和读取标签后，点击这个按钮保存本组。常用地点在自己的分组中独立保存。', 'reading'),
    step('settings', '[data-settings-action="export"]', '最后保留个人备份', '导出备份会包含修改稿、自建空位、开关和偏好。导入前先预览范围；程序更新与个人保存分开。这里也能重看完整或单页引导。', 'backup'),
  ],
};

// LJ-LIVE-GUIDE-01: live controls only; navigation uses the existing unsaved-change gates.
export function createGuideSession(ui, { settings, onStep = () => {}, onClose = () => {} } = {}) {
  let steps = [], index = -1, scope = 'all', busy = false, epoch = 0;
  async function move(nextIndex, nextSteps = steps, nextScope = scope) {
    if (busy || nextIndex < 0 || nextIndex >= nextSteps.length) return false;
    busy = true; const ticket = epoch;
    try {
      const next = nextSteps[nextIndex];
      if (next.page === 'settings' && ui.state.page === 'settings' && next.tab && settings?.requestLeave && !(await settings.requestLeave())) return false;
      if ((await ui.showPage(next.page)) === false || ui.state.page !== next.page || ticket !== epoch) return false;
      if (next.tab) await settings?.openTab?.(next.tab);
      if (ticket !== epoch) return false;
      steps = nextSteps; index = nextIndex; scope = nextScope;
      await onStep(next, index, steps.length); return true;
    } finally { busy = false; }
  }
  function close() { epoch++; steps = []; index = -1; onClose(); }
  async function start(value = 'all') {
    const nextSteps = value === 'all' ? Object.values(groups).flat() : groups[value];
    if (!nextSteps) return false;
    ui.state.guideOffered = true;
    return move(0, nextSteps, value);
  }
  async function next() {
    if (busy || index < 0) return false;
    if (index < steps.length - 1) return move(index + 1);
    if (scope === 'all') await ui.bridge.store.update(data => { data.extensionUi ||= {}; data.extensionUi.guide = { ...data.extensionUi.guide, completed: true }; });
    const download=scope === 'all' && ui.bridge.packages?.required;
    close(); if(download) await ui.bridge.openPackages({focusId:'metro',required:true}); return true;
  }
  async function offer() {
    const prefs = ui.bridge.store.read().extensionUi?.guide || {};
    if(ui.bridge.packages?.required && !ui.state.guideOffered) { ui.state.guideOffered=true; return prefs.completed ? ui.bridge.openPackages({focusId:'metro',required:true}) : start('all'); }
    if (prefs.autoPrompt === false || prefs.completed || ui.state.guideOffered) return false;
    ui.state.guideOffered = true;
    const choice = await ui.ask({ title: '熟悉 Living Japan 的实际操作', message: '跟着页面里的真实按钮走一遍；可以随时结束，也能在“设置 → 备份与说明”重看完整或单页引导。', choices: [{ id: 'start', label: '开始引导', primary: true }, { id: 'later', label: '稍后再看' }, { id: 'never', label: '不再自动提示' }] });
    if (choice === 'never') await ui.bridge.store.update(data => { data.extensionUi ||= {}; data.extensionUi.guide = { ...data.extensionUi.guide, autoPrompt: false }; });
    return choice === 'start' ? start('all') : false;
  }
  return { start, next, previous: () => move(index - 1), close, offer };
}

export function placeGuideCard(target, card, viewport) {
  const clamp = (value, max) => Math.max(8, Math.min(value, Math.max(8, max)));
  const left = clamp(target.left, viewport.width - card.width - 8), top = clamp(target.top, viewport.height - card.height - 8);
  const choices = [{ left, top: target.bottom + 10 }, { left, top: target.top - card.height - 10 }, { left: target.right + 10, top }, { left: target.left - card.width - 10, top }];
  const fits = box => box.left >= 8 && box.top >= 8 && box.left + card.width <= viewport.width - 8 && box.top + card.height <= viewport.height - 8;
  const fit = choices.find(fits); if (fit) return fit;
  const overlap = box => Math.max(0, Math.min(box.left + card.width, target.right) - Math.max(box.left, target.left)) * Math.max(0, Math.min(box.top + card.height, target.bottom) - Math.max(box.top, target.top));
  return choices.map(box => ({ left: clamp(box.left, viewport.width - card.width - 8), top: clamp(box.top, viewport.height - card.height - 8) })).sort((a, b) => overlap(a) - overlap(b))[0];
}

export function mountGuide(ui, options = {}) {
  const doc = document;
  if (!doc.getElementById('ljGuideStyle')) { const link = doc.createElement('link'); link.id = 'ljGuideStyle'; link.rel = 'stylesheet'; link.href = new URL('./guide.css', import.meta.url).href; doc.head.append(link); }
  let layer, card, ring, activeStep, priorFocus, frame;
  const targetFor = step => [...doc.querySelectorAll(step.target)].find(node => { const rect = node.getBoundingClientRect(); return !node.closest('[hidden]') && node.getClientRects().length && rect.width && rect.height; });
  function position() {
    frame = null; if (!layer || !activeStep) return;
    const target = targetFor(activeStep), viewport = { width: innerWidth, height: innerHeight };
    ring.hidden = !target;
    if (!target) { card.style.left = '8px'; card.style.top = '8px'; return; }
    const rect = target.getBoundingClientRect();
    Object.assign(ring.style, { left: `${Math.max(0, rect.left - 3)}px`, top: `${Math.max(0, rect.top - 3)}px`, width: `${Math.min(viewport.width, rect.width + 6)}px`, height: `${Math.min(viewport.height, rect.height + 6)}px` });
    const freeHeight = Math.max(rect.top - 18, viewport.height - rect.bottom - 18);
    card.style.maxHeight = `${Math.max(140, Math.min(viewport.height - 16, freeHeight))}px`;
    const box = placeGuideCard(rect, card.getBoundingClientRect(), viewport);
    Object.assign(card.style, { left: `${box.left}px`, top: `${box.top}px` });
  }
  const schedule = () => { if (layer && frame == null) frame = requestAnimationFrame(position); };
  function hide() { if (frame != null) cancelAnimationFrame(frame); frame = null; layer?.remove(); layer = card = ring = activeStep = null; if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true }); priorFocus = null; }
  const run = operation => Promise.resolve().then(operation).catch(error => ui.notify(error.message || String(error), 'error'));
  const session = createGuideSession(ui, { ...options, onClose: hide, onStep(step, index, count) {
    activeStep = step;
    if (!layer) {
      priorFocus = doc.activeElement;
      layer = doc.createElement('div'); layer.className = 'lj-guide-layer';
      ring = doc.createElement('div'); ring.className = 'lj-guide-ring'; ring.setAttribute('aria-hidden', 'true');
      card = doc.createElement('aside'); card.className = 'lj-guide-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'false'); card.setAttribute('aria-label', '操作引导');
      layer.append(ring, card); doc.body.append(layer);
      card.addEventListener('click', event => { const button = event.target.closest('[data-guide]'); if (!button) return; if (button.dataset.guide === 'close') session.close(); else run(() => button.dataset.guide === 'previous' ? session.previous() : session.next()); });
    }
    card.innerHTML = `<header><strong>${ui.esc(step.title)}</strong><span>${index + 1} / ${count}</span></header><p>${ui.esc(step.text)}</p><footer><button type="button" class="lj-button" data-guide="close">结束引导</button><button type="button" class="lj-button" data-guide="previous" ${index ? '' : 'disabled'}>上一步</button><button type="button" class="lj-button primary" data-guide="next">${index === count - 1 ? '完成' : '下一步'}</button></footer>`;
    targetFor(step)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); position();
    card.querySelector('[data-guide="next"]').focus({ preventScroll: true });
  } });
  const escape = event => { if (layer && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); session.close(); } };
  doc.addEventListener('keydown', escape); doc.addEventListener('scroll', schedule, true); window.addEventListener('resize', schedule);
  const observer = new MutationObserver(records => { if (layer && records.some(record => !layer.contains(record.target))) schedule(); });
  observer.observe(doc.body, { childList: true, subtree: true });
  return { ...session, destroy() { session.close(); observer.disconnect(); doc.removeEventListener('keydown', escape); doc.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule); } };
}
