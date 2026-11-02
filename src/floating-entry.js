// LJ-FLOATING-ENTRY-20261031: v3.6 daruma artwork and gestures; immediate open and independent quick settings.
const DARUMA_SVG = "<svg class=\"lj-fab-expanded-flower lj-fab-daruma\" viewBox=\"0 0 64 64\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M32 3C15 3 6 17 5 37 4 53 15 61 32 61S60 53 59 37C58 17 49 3 32 3Z\" fill=\"#dd332d\" stroke=\"#a62022\" stroke-width=\"2\"/><path d=\"M13 22C14 11 24 8 32 8S50 11 51 22L49 35C44 41 20 41 15 35Z\" fill=\"#fff2d7\"/><path d=\"M15 19Q22 11 28 17M36 17Q43 11 49 19\" fill=\"none\" stroke=\"#312b2a\" stroke-width=\"3.4\" stroke-linecap=\"round\"/><g class=\"lj-daruma-eyes\"><path d=\"M15 23Q22 18 28 23Q22 29 15 23M36 23Q43 18 50 23Q43 29 36 23\" fill=\"#fff\" stroke=\"#6d392f\" stroke-width=\"1.2\"/><circle cx=\"25\" cy=\"23\" r=\"2.8\" fill=\"#292525\"/><circle cx=\"46\" cy=\"23\" r=\"2.8\" fill=\"#292525\"/></g><path d=\"M31 25 29 30 34 30M29 32Q23 28 18 33M35 32Q41 28 46 33M22 35Q32 40 43 34\" fill=\"none\" stroke=\"#3a2c29\" stroke-width=\"2.3\" stroke-linecap=\"round\"/><path d=\"M23 39 20 46M32 41 32 48M41 39 44 46M13 40 10 48M51 40 54 48\" stroke=\"#f5bd58\" stroke-width=\"2.3\" stroke-linecap=\"round\"/><path d=\"M23 51Q32 47 41 51L39 57 25 57Z\" fill=\"#f6c966\"/><path d=\"M29 51 29 55M35 51 35 55\" stroke=\"#a52a24\" stroke-width=\"1.6\"/></svg><svg class=\"lj-fab-edge-flower lj-fab-daruma-squashed\" viewBox=\"0 0 19 58\" aria-hidden=\"true\" focusable=\"false\"><rect class=\"lj-fab-tab-frame\" x=\".5\" y=\".5\" width=\"18\" height=\"57\" rx=\"5\"/><path d=\"M9.5 4C3 4 2 12 2.2 30L2 44Q2 54 9.5 54T17 44L16.8 30C17 12 16 4 9.5 4Z\" fill=\"#dc352e\"/><path d=\"M4 17Q4 10 9.5 10T15 17L14 33Q9.5 38 5 33Z\" fill=\"#fff2d7\"/><path d=\"M4.5 18 7.8 15.5M11 15.5 14.5 18\" stroke=\"#332925\" stroke-width=\"1.8\" stroke-linecap=\"round\"/><g class=\"lj-daruma-eyes\"><ellipse cx=\"6.8\" cy=\"23\" rx=\"2.5\" ry=\"3.5\" fill=\"#fff\"/><ellipse cx=\"12.3\" cy=\"23\" rx=\"2.2\" ry=\"3.5\" fill=\"#fff\"/><ellipse cx=\"8\" cy=\"23.5\" rx=\"1.3\" ry=\"2.2\" fill=\"#292525\"/><ellipse cx=\"13.3\" cy=\"23.5\" rx=\"1.2\" ry=\"2.2\" fill=\"#292525\"/></g><path d=\"M9.5 26 8.5 29 11 29M8.8 31 5 32.5M10.5 31 14 32.5M6 34Q9.5 37 13 33.5\" fill=\"none\" stroke=\"#382b27\" stroke-width=\"1.4\" stroke-linecap=\"round\"/><path d=\"M5 39 4 44M9.5 40 9.5 45M14 39 15 44\" stroke=\"#f6c866\" stroke-width=\"1.8\" stroke-linecap=\"round\"/><rect x=\"5.5\" y=\"47\" width=\"8\" height=\"5\" rx=\"1.5\" fill=\"#f6c866\"/><path d=\"M8 48 8 51M11 48 11 51\" stroke=\"#a52a24\" stroke-width=\"1\"/></svg>";
const instances = new WeakMap();
const SWITCHES = [
  ['masterEnabled', '提示注入', '自动读取聊天中的资料'],
  ['skipUserLocationInput', '跳过用户地点输入', '地点改读最近 AI 回复；时间天气照常'],
  ['namedPlaceBodiesEnabled', '具名地点正文', '地点的完整描写'],
  ['layer:TN', '时间与自然', '天光、天气与季节'],
  ['layer:EX', '外部地域', '地区与周边环境'],
  ['layer:IN', '内部场所', '场馆与室内环境'],
  ['layer:EV', '明确场景事件', '活动与现场情景'],
];
const dockEdge = value => ['left', 'right', 'top', 'bottom'].includes(value) ? value : null;
const point = value => Number.isFinite(value?.x) && Number.isFinite(value?.y) ? { x: value.x, y: value.y } : null;
// LJ-LOCATION-INPUT-TOGGLE-20261101: this optional reading mode is off until explicitly enabled.
const enabled = (settings, key) => key === 'skipUserLocationInput' ? settings[key] === true
  : (key.startsWith('layer:') ? settings.layers?.[key.slice(6)] : settings[key]) !== false;

export function ensureEntryStyles(document) {
  if (document.getElementById('living-japan-entry-styles')) return;
  const link = document.createElement('link');
  link.id = 'living-japan-entry-styles'; link.rel = 'stylesheet';
  link.href = new URL('./floating-entry.css', import.meta.url).href;
  (document.head || document.documentElement).appendChild(link);
}

export function createFloatingEntry({ store, open, document = globalThis.document, window = globalThis.window } = {}) {
  if (!document?.body || !store?.read || !store?.update) throw new TypeError('悬浮入口需要页面与用户存储');
  instances.get(document)?.();
  window ||= document.defaultView || globalThis;
  ensureEntryStyles(document);
  const cleanup = [], timers = { idle: null, press: null };
  const now = () => window.performance?.now() ?? Date.now();
  const later = (fn, ms) => window.setTimeout(fn, ms);
  const clear = key => { if (timers[key] !== null) window.clearTimeout(timers[key]); timers[key] = null; };
  const on = (node, name, fn) => { node?.addEventListener?.(name, fn); cleanup.push(() => node?.removeEventListener?.(name, fn)); };
  const make = (tag, className, text) => { const node = document.createElement(tag); node.className = className || ''; if (text) node.textContent = text; return node; };
  const control = make('div'); control.id = 'living-japan-floating-control';
  const button = make('button'); button.id = 'living-japan-open'; button.type = 'button'; button.innerHTML = DARUMA_SVG;
  button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false');
  const menu = make('div'); menu.id = 'living-japan-floating-menu'; menu.hidden = true; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Living Japan 快捷开关');
  const title = make('div', 'lj-entry-menu-title', 'Living Japan');
  const subtitle = make('div', 'lj-entry-menu-note', '快捷开关 · 即时保存');
  menu.append(title, subtitle);
  const switches = SWITCHES.map(([key, label, description]) => {
    const row = make('button', 'lj-entry-switch'); row.type = 'button'; row.setAttribute('role', 'menuitemcheckbox'); row.setAttribute('data-setting', key);
    const words = make('span', 'lj-entry-switch-words'); words.append(make('strong', '', label), make('small', '', description));
    const mark = make('span', 'lj-entry-switch-mark'); mark.setAttribute('aria-hidden', 'true');
    row.append(words, mark); menu.append(row); return { key, row, mark };
  });
  const openButton = make('button', 'lj-entry-open-panel', '打开 Living Japan 面板'); openButton.type = 'button'; openButton.setAttribute('role', 'menuitem');
  const errorNote = make('div', 'lj-entry-error'); errorNote.hidden = true; errorNote.setAttribute('role', 'alert');
  menu.append(openButton, errorNote); control.append(button, menu); document.body.append(control);
  let destroyed = false, isOpen = false, hovered = false, focused = false, gesture = null, suppressUntil = 0, busy = false, errorText = '';
  let saved = store.read(), savedPoint = point(saved.extensionUi?.entryPosition) || point(saved.livingJapanUIPreferences?.sakuraFabPosition);
  let savedEdge = dockEdge(Object.hasOwn(saved.extensionUi || {}, 'entryDockEdge') ? saved.extensionUi.entryDockEdge : saved.livingJapanUIPreferences?.sakuraFabDockEdge);
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  function box() {
    const view = window.visualViewport;
    return { left: view?.offsetLeft || 0, top: view?.offsetTop || 0, width: view?.width || window.innerWidth, height: view?.height || window.innerHeight };
  }
  function applyPosition(value, edge) {
    const view = box(), maxX = Math.max(view.left, view.left + view.width - 58), maxY = Math.max(view.top, view.top + view.height - 58);
    const x = edge === 'left' ? view.left : edge === 'right' ? maxX : Math.max(view.left, Math.min(maxX, value.x));
    const y = edge === 'top' ? view.top : edge === 'bottom' ? maxY : Math.max(view.top, Math.min(maxY, value.y));
    const applied = { x: Math.round(x), y: Math.round(y) };
    control.style.left = `${applied.x}px`; control.style.top = `${applied.y}px`; control.style.right = 'auto'; control.style.bottom = 'auto';
    return applied;
  }
  function nearestEdge() {
    const rect = control.getBoundingClientRect(), view = box();
    return [['left', rect.left - view.left], ['right', view.left + view.width - rect.right], ['top', rect.top - view.top], ['bottom', view.top + view.height - rect.bottom]]
      .filter(([, gap]) => gap >= -1 && gap <= 8).sort((a, b) => a[1] - b[1])[0]?.[0] || null;
  }
  function reveal() { clear('idle'); control.removeAttribute('data-edge-hidden'); }
  function scheduleIdle() {
    reveal();
    if (destroyed || gesture || hovered || focused || isOpen || !menu.hidden || !nearestEdge()) return;
    timers.idle = later(() => { timers.idle = null; const edge = nearestEdge(); if (edge && !gesture && !hovered && !focused && !isOpen && menu.hidden) control.setAttribute('data-edge-hidden', edge); }, 1800);
  }
  function render() {
    const settings = saved.livingJapanSettings || {}, active = enabled(settings, 'masterEnabled');
    button.setAttribute('data-enabled', String(active)); button.setAttribute('data-error', String(Boolean(errorText)));
    const label = `Living Japan · 提示注入${active ? '已开启' : '已暂停'}；单击打开，右键或长按快捷开关`;
    button.title = errorText ? `${label}\n${errorText}` : label; button.setAttribute('aria-label', button.title);
    const theme = saved.extensionUi?.theme || saved.livingJapanUIPreferences?.uiThemePreference || 'auto';
    control.setAttribute('data-theme', theme === 'night' || (theme === 'auto' && media?.matches) ? 'night' : 'day');
    subtitle.textContent = active ? '快捷开关 · 即时保存' : '总开关已暂停，各通道选择保留';
    for (const { key, row, mark } of switches) { const value = enabled(settings, key); row.setAttribute('aria-checked', String(value)); row.disabled = busy; mark.textContent = value ? '开' : '关'; }
  }
  function setError(error) { errorText = error ? String(error.message || error) : ''; errorNote.textContent = errorText; errorNote.hidden = !errorText; render(); }
  function positionMenu() {
    const view = box(), rect = control.getBoundingClientRect(), size = menu.getBoundingClientRect();
    const width = Math.min(size.width || 260, view.width - 16), height = Math.min(size.height || 390, view.height - 16);
    const left = Math.max(view.left + 8, Math.min(view.left + view.width - width - 8, rect.right - width));
    const preferredTop = rect.top - height - 12;
    const top = Math.max(view.top + 8, Math.min(view.top + view.height - height - 8, preferredTop >= view.top + 8 ? preferredTop : rect.bottom + 12));
    menu.style.left = `${Math.round(left)}px`; menu.style.top = `${Math.round(top)}px`;
    menu.style.maxHeight = `${Math.max(80, view.height - 16)}px`;
  }
  function closeMenu(restoreFocus = false) { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); if (restoreFocus) button.focus(); scheduleIdle(); }
  function openMenu() { reveal(); render(); menu.hidden = false; button.setAttribute('aria-expanded', 'true'); positionMenu(); switches[0].row.focus(); }
  function requestOpen() {
    closeMenu();
    try { Promise.resolve(open?.()).catch(setError); } catch (error) { setError(error); }
  }
  async function toggle(key) {
    if (busy) return;
    busy = true; setError(null);
    try {
      await store.update(draft => {
        draft.livingJapanSettings ||= {};
        const settings = draft.livingJapanSettings, value = !enabled(settings, key);
        if (key.startsWith('layer:')) { settings.layers ||= {}; settings.layers[key.slice(6)] = value; } else settings[key] = value;
        return draft;
      });
      saved = store.read();
    } catch (error) { setError(error); }
    finally { busy = false; render(); }
  }
  on(button, 'click', event => { event.preventDefault(); event.stopPropagation(); if (now() >= suppressUntil) requestOpen(); });
  on(button, 'contextmenu', event => { event.preventDefault(); event.stopPropagation(); openMenu(); });
  on(button, 'keydown', event => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); openMenu(); }
    else if (event.key === 'Escape') closeMenu(true);
  });
  on(openButton, 'click', event => { event.stopPropagation(); requestOpen(); });
  for (const { key, row } of switches) on(row, 'click', event => { event.stopPropagation(); void toggle(key); });
  on(menu, 'click', event => event.stopPropagation());
  on(menu, 'keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...switches.map(item => item.row), openButton].filter(item => !item.disabled), index = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : (index + 1) % items.length;
    items[next]?.focus();
  });
  on(button, 'pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    reveal(); const rect = control.getBoundingClientRect();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, dragging: false, long: false };
    try { button.setPointerCapture?.(event.pointerId); } catch { /* Capture is optional in embedded WebViews. */ }
    clear('press');
    if (event.pointerType === 'touch' || event.pointerType === 'pen') timers.press = later(() => {
      timers.press = null; if (!gesture || gesture.dragging) return;
      gesture.long = true; suppressUntil = now() + 700; openMenu();
    }, 580);
  });
  on(button, 'pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.long) { event.preventDefault(); return; }
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging && Math.hypot(dx, dy) < 8) return;
    if (!gesture.dragging) { gesture.dragging = true; clear('press'); closeMenu(); control.setAttribute('data-dragging', 'true'); }
    gesture.point = applyPosition({ x: gesture.left + dx, y: gesture.top + dy }); event.preventDefault();
  });
  function finish(event) {
    if (!gesture || (event.pointerId !== undefined && event.pointerId !== gesture.id)) return;
    const done = gesture; gesture = null; clear('press'); control.removeAttribute('data-dragging');
    try { button.releasePointerCapture?.(done.id); } catch { /* Capture may already have ended. */ }
    if (done.dragging) {
      suppressUntil = now() + 500; savedEdge = nearestEdge(); savedPoint = applyPosition(done.point, savedEdge);
      const position = { ...savedPoint }, edge = savedEdge;
      store.update(draft => { draft.extensionUi ||= {}; draft.extensionUi.entryPosition = position; draft.extensionUi.entryDockEdge = edge; return draft; }).catch(setError);
    } else if (done.long || event.type !== 'pointerup') suppressUntil = now() + 500;
    scheduleIdle();
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(button, type, finish);
  for (const type of ['pointerup', 'pointercancel']) on(document, type, finish);
  on(control, 'pointerenter', () => { hovered = true; reveal(); });
  on(control, 'pointerleave', () => { hovered = false; scheduleIdle(); });
  on(control, 'focusin', () => { focused = true; reveal(); });
  on(control, 'focusout', event => { focused = control.contains(event.relatedTarget); scheduleIdle(); });
  on(document, 'pointerdown', event => { if (!menu.hidden && !control.contains(event.target)) closeMenu(); });
  function viewportChanged() { if (savedPoint) applyPosition(savedPoint, savedEdge); if (!menu.hidden) positionMenu(); scheduleIdle(); }
  on(window, 'resize', viewportChanged); on(window.visualViewport, 'resize', viewportChanged); on(window.visualViewport, 'scroll', viewportChanged);
  on(media, 'change', render);
  const unsubscribe = store.subscribe?.(value => {
    saved = value; render();
    if (!gesture) {
      const nextPoint = point(value.extensionUi?.entryPosition);
      if (nextPoint) { savedPoint = nextPoint; savedEdge = dockEdge(value.extensionUi?.entryDockEdge); applyPosition(savedPoint, savedEdge); }
    }
  });
  if (savedPoint) { applyPosition(savedPoint, savedEdge); if (!savedEdge) { savedEdge = nearestEdge(); if (savedEdge) applyPosition(savedPoint, savedEdge); } }
  render(); scheduleIdle();
  function destroy() {
    if (destroyed) return; destroyed = true; clear('idle'); clear('press'); unsubscribe?.();
    cleanup.forEach(fn => fn()); control.remove();
    if (instances.get(document) === destroy) instances.delete(document);
  }
  instances.set(document, destroy);
  return { button, control, destroy, setError, setOpen(value) { isOpen = Boolean(value); scheduleIdle(); } };
}
