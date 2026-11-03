import { createFloatingEntry } from './floating-entry.js';
import { loadBaseline, addUserDataToData, createBaselineEngine } from './baseline.js';
import { createSession } from './session.js';
import { createUserStore, createSillyTavernTransport } from './storage.js';
import { createUpdateManager } from './updates.js';
import { createCatalog } from './catalog.js';
import { createCanonicalContextPreparer } from './place-identities.js';

// LJ-EXT-COMPOSITION: assemble independent data, storage, session and approved UI modules.
export async function startLivingJapan({ baseUrl, context: suppliedContext, store: suppliedStore, fetcher = fetch, packSnapshot, packages, entry: suppliedEntry, metroNames, updates: suppliedUpdates } = {}) {
  const context = suppliedContext || globalThis.SillyTavern?.getContext?.();
  if (!context) throw new Error('请在 SillyTavern 中启用扩展，或打开独立预览入口');
  const started = performance.now();
  const baseline = await loadBaseline(baseUrl, { fetcher, lazyTexts: true, metroNames });
  if (packSnapshot) { baseline.data.regionPackageMode = true; baseline.engine = createBaselineEngine(baseline.data); }
  const store = suppliedStore || createUserStore({
    transport: createSillyTavernTransport({ context, fetcher: fetch }),
    initialData: {
      livingJapanSettings: baseline.data.defaultSettings,
      livingJapanUIPreferences: baseline.data.defaultUIPreferences || {},
    },
    knownSlots: container => addUserDataToData(baseline.data, container).editableTextSlots.slots,
  });
  if (!suppliedStore) await store.load();
  const entry = suppliedEntry || createFloatingEntry({store, open: () => open()});
  const button = entry.button;
  const catalog = createCatalog({ baseData: baseline.data, baseUrl, fetcher, packSnapshot });
  const index = await catalog.loadIndex();
  const prepareUserData = await createCanonicalContextPreparer({ data: baseline.data, catalog, index, baseUrl, fetcher, packSnapshot });
  if (prepareUserData) { await prepareUserData(store.read()); baseline.engine = createBaselineEngine(baseline.data); }
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => fn());
  const session = createSession({ engine: baseline.engine, store, context: () => suppliedContext || globalThis.SillyTavern.getContext(), onChange: emit, prepareUserData, textResources: baseline.textResources });
  await session.start();
  const updates = suppliedUpdates || createUpdateManager({ context, extensionName: String(baseUrl).split('/').filter(Boolean).at(-1) || 'Living-Japan' });
  if (!suppliedUpdates) void updates.check().catch(()=>{});
  let shell = null, shellViewport = null, shellScroll = null, frame = null, activeLayout = null, sizeDrag = null;
  const resizeHandles = [];
  let inputObserver = null;
  // LJ-WINDOW-GEOMETRY-20261102: each layout restores one saved geometry inside the visible outer-frame bounds.
  const geometryKey = mode => mode === 'desktop' ? 'horizontal' : mode === 'portrait' ? 'vertical' : null;
  function geometrySlots(preferences = {}) {
    const saved = preferences.panelGeometry;
    if (saved && ('horizontal' in saved || 'vertical' in saved)) return { horizontal: saved.horizontal || null, vertical: saved.vertical || null };
    return { horizontal: null, vertical: null, ...(saved ? { [preferences.panelLayoutMode === 'vertical' ? 'vertical' : 'horizontal']: saved } : {}) };
  }
  const geometries = geometrySlots(store.read().livingJapanUIPreferences);
  let geometrySave = Promise.resolve();
  function currentGeometry() {
    return { x: parseFloat(shellViewport.style.left), y: parseFloat(shellViewport.style.top), width: parseFloat(shell.style.width), height: parseFloat(shell.style.height) };
  }
  function persistGeometry(value = currentGeometry()) {
    const key = geometryKey(shell.dataset.layout);
    if (!key) return geometrySave;
    const geometry = value && { ...value };
    geometries[key] = geometry;
    geometrySave = store.update(data => {
      const preferences = data.livingJapanUIPreferences || {};
      data.livingJapanUIPreferences = { ...preferences, panelGeometry: { ...geometrySlots(preferences), [key]: geometry } };
      return data;
    }).catch(error => { frame?.contentWindow?.LivingJapanView?.ui?.notify(error.message, 'error'); });
    return geometrySave;
  }
  function changeGeometry(value) {
    const key = geometryKey(shell.dataset.layout);
    if (!key) return;
    geometries[key] = value;
    sizeFrame();
    geometries[key] = currentGeometry();
  }
  let requestedLayout = store.read().extensionUi?.layout || 'auto';
  let previewLayoutOverride = false, mobileRest = null, mobileFocusRest = null, mobileKeyboard = false;
  const isPhone = () => {
    const shortSide = Math.min(window.screen?.width || Infinity, window.screen?.height || Infinity);
    return shortSide <= 600 && (window.navigator?.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches);
  };
  const isPinned=data=>(data.extensionUi?.pinned??data.livingJapanUIPreferences?.panelPinned)!==false;
  let pinned=isPinned(store.read());
  const state = { regionCode: 'metro', selectedId: null, routeOrigin: null, routeDestination: null, travelMode: 'public_transit', page: 'map', history: [] };
  // LJ-PREVIEW-WINDOW-01: explicit layouts and one in-frame close control share a bounded shell.
  function layout() {
    if (isPhone() && !previewLayoutOverride) return 'mobile';
    return requestedLayout === 'auto' ? (window.innerWidth <= 600 ? 'mobile' : 'desktop') : requestedLayout;
  }
  function hasTextFocus() {
    let focused = document.activeElement;
    try { if (focused === frame) focused = frame.contentDocument?.activeElement || frame.contentWindow?.document?.activeElement; } catch {}
    return focused?.isContentEditable || focused?.tagName === 'TEXTAREA'
      || (focused?.tagName === 'INPUT' && !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'hidden'].includes(focused.type));
  }
  // LJ-WINDOW-BOUNDS-20261102: PC uses browser walls; mobile keeps a resting canvas and lifts it above the keyboard.
  function mobileBounds({ left, top, width, height }) {
    const input = document.getElementById('send_textarea');
    const box = input?.getBoundingClientRect(), bottom = top + height;
    const inputVisible = box?.width > 0 && box.height > 0 && box.bottom > top;
    const style = inputVisible ? window.getComputedStyle?.(input) : null;
    const peek = inputVisible ? Math.min(box.height, Math.max(32, Math.min(64, (parseFloat(style?.lineHeight) || 20) * 2 + (parseFloat(style?.paddingTop) || 0) + (parseFloat(style?.paddingBottom) || 0)))) : 0;
    const gap = inputVisible ? Math.max(0, bottom - box.bottom) : 0;
    const rotated = mobileRest && Math.abs(width - mobileRest.width) > 2;
    if (rotated) { mobileRest = mobileFocusRest = null; mobileKeyboard = false; }
    const focused = hasTextFocus();
    if (focused && !mobileFocusRest && mobileRest) mobileFocusRest = { ...mobileRest };
    if (!focused && !mobileKeyboard) mobileFocusRest = null;
    const resting = mobileFocusRest || mobileRest, drop = resting ? resting.visualHeight - height : 0;
    if (resting && drop > Math.max(100, resting.visualHeight * .18) && focused) mobileKeyboard = true;
    if (resting && drop > 2 && (focused || mobileKeyboard)) {
      mobileRest = resting;
      const raisedBottom = Math.min(bottom - resting.gap, inputVisible ? box.bottom : bottom) - resting.peek;
      return { left, top: raisedBottom - resting.height, width, height: resting.height };
    }
    if (mobileKeyboard && drop <= 2) { mobileKeyboard = false; mobileFocusRest = null; }
    // Input growth alone does not rewrite the canvas; browser size/orientation changes do.
    if (!mobileRest || height !== mobileRest.visualHeight || top !== mobileRest.top || left !== mobileRest.left) {
      mobileRest = { left, top, width, visualHeight: height, height: Math.max(1, height - gap - peek), gap, peek };
    }
    return { left, top, width, height: mobileRest.height };
  }
  function sizeFrame() {
    if (!shell) return;
    const visual = window.visualViewport;
    const left = visual?.offsetLeft || 0, top = visual?.offsetTop || 0;
    const availableWidth = visual?.width || window.innerWidth;
    const availableHeight = Math.max(1, visual?.height || window.innerHeight), mode = shell.dataset.layout, geometry = geometries[geometryKey(mode)];
    let width, height, viewportWidth, viewportHeight, mobile;
    if (mode === 'mobile') {
      mobile = mobileBounds({ left, top, width: availableWidth, height: availableHeight });
      width = viewportWidth = mobile.width; height = viewportHeight = mobile.height;
    } else {
      const ratio = mode === 'portrait' ? 0.5 : 8 / 5, minimum = mode === 'portrait' ? 640 : 600;
      const fitted = Math.max(minimum, Math.min(availableHeight - 8, (availableWidth - 8) / ratio));
      const savedHeight = Number(geometry?.height);
      height = Math.max(minimum, Math.min(geometry && Number.isFinite(savedHeight) ? savedHeight : fitted, fitted)); width = height * ratio;
      viewportWidth = Math.min(availableWidth, width + 8 + (height > availableHeight - 8 ? 16 : 0));
      viewportHeight = Math.min(availableHeight, height + 8 + (width > availableWidth - 8 ? 16 : 0));
    }
    const x = Math.min(left + availableWidth - viewportWidth, Number.isFinite(geometry?.x) ? geometry.x : left + (availableWidth - viewportWidth) / 2);
    const y = Math.min(top + availableHeight - viewportHeight, Number.isFinite(geometry?.y) ? geometry.y : top + (availableHeight - viewportHeight) / 2);
    Object.assign(shell.style, { width: `${width}px`, height: `${height}px` });
    Object.assign(shellViewport.style, { left: `${mobile ? mobile.left : Math.max(left, x)}px`, top: `${mobile ? mobile.top : Math.max(top, y)}px`, width: `${viewportWidth}px`, height: `${viewportHeight}px` });
    Object.assign(shellScroll.style, { width: `${Math.max(1, viewportWidth - (mode === 'mobile' ? 0 : 8))}px`, height: `${Math.max(1, viewportHeight - (mode === 'mobile' ? 0 : 8))}px` });
    // LJ-PORTRAIT-CANVAS-20261030: shrink approved controls uniformly; additional room grows the content viewport at scale one.
    if (mode === 'portrait' || mode === 'mobile') {
      const innerWidth = shell.clientWidth || width - 2, innerHeight = shell.clientHeight || height - 2;
      const scale = mode === 'portrait' ? Math.min(1, innerWidth / 430, innerHeight / 860) : Math.min(1, innerWidth / 430);
      const canvasWidth = scale < 1 ? 430 : innerWidth, canvasHeight = mode === 'portrait' && scale < 1 ? 860 : innerHeight / scale;
      Object.assign(frame.style, { position: 'absolute', width: `${canvasWidth}px`, height: `${canvasHeight}px`, transformOrigin: 'top left', transform: `scale(${scale})`, left: `${(innerWidth - canvasWidth * scale) / 2}px`, top: `${(innerHeight - canvasHeight * scale) / 2}px` });
    } else Object.assign(frame.style, { position: '', width: '', height: '', transformOrigin: '', transform: '', left: '', top: '' });
    for (const handle of resizeHandles) handle.hidden = mode === 'mobile';
  }
  function mountWindowDrag(handle) {
    if (!handle || !geometryKey(shell?.dataset.layout)) return () => {};
    let drag = null;
    handle.dataset.windowDrag = 'true';
    const hostPoint = event => {
      const rect = frame.getBoundingClientRect();
      return { x: rect.left + event.clientX * rect.width / frame.clientWidth, y: rect.top + event.clientY * rect.height / frame.clientHeight };
    };
    const down = event => {
      if ((event.button != null && event.button !== 0) || !geometryKey(shell.dataset.layout)
        || event.target.closest?.('button,input,select,textarea,a,[role="button"],[contenteditable],.brand7,.lily')) return;
      event.preventDefault(); event.stopPropagation();
      drag = { id: event.pointerId, point: hostPoint(event), geometry: currentGeometry() };
      handle.dataset.windowDragging = 'true'; handle.setPointerCapture(event.pointerId);
    };
    const move = event => {
      if (!drag || drag.id !== event.pointerId) return;
      const point = hostPoint(event);
      changeGeometry({ ...drag.geometry, x: drag.geometry.x + point.x - drag.point.x, y: drag.geometry.y + point.y - drag.point.y });
    };
    const end = event => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null; delete handle.dataset.windowDragging;
      if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      void persistGeometry();
    };
    const events = { pointerdown: down, pointermove: move, pointerup: end, pointercancel: end, lostpointercapture: end };
    for (const [name, listener] of Object.entries(events)) handle.addEventListener(name, listener);
    return () => { for (const [name, listener] of Object.entries(events)) handle.removeEventListener(name, listener); delete handle.dataset.windowDrag; delete handle.dataset.windowDragging; };
  }
  function mountSizeControl() {
    const fitSize = () => { if (!geometryKey(shell.dataset.layout)) return; geometries[geometryKey(shell.dataset.layout)] = null; sizeFrame(); void persistGeometry(null); };
    for (const edge of ['right', 'bottom', 'corner']) {
      const handle = document.createElement('button'); handle.id = `living-japan-resize${edge === 'corner' ? '' : `-${edge}`}`; handle.type = 'button';
      handle.dataset.resizeEdge = edge;
      handle.title = '拖动边缘调整大小；双击恢复适配'; handle.setAttribute('aria-label', '调整界面大小；方向键调整，回车恢复适配');
      shellViewport.append(handle); resizeHandles.push(handle);
      handle.addEventListener('pointerdown', event => {
        if ((event.button != null && event.button !== 0) || !geometryKey(shell.dataset.layout)) return;
        event.preventDefault(); event.stopPropagation();
        const box = shellViewport.getBoundingClientRect();
        sizeDrag = { id: event.pointerId, edge, x: event.clientX, y: event.clientY, height: parseFloat(shell.style.height), left: box.left, top: box.top };
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointermove', event => {
        if (!sizeDrag || sizeDrag.id !== event.pointerId || sizeDrag.edge !== edge) return;
        const ratio = shell.dataset.layout === 'portrait' ? 0.5 : 8 / 5;
        const dx = event.clientX - sizeDrag.x, dy = event.clientY - sizeDrag.y;
        const delta = edge === 'right' ? dx / ratio : edge === 'bottom' ? dy : (dx * ratio + dy) / (ratio * ratio + 1);
        changeGeometry({ x: sizeDrag.left, y: sizeDrag.top, height: sizeDrag.height + delta });
      });
      const endSize = event => { if (sizeDrag?.id !== event.pointerId || sizeDrag.edge !== edge) return; sizeDrag = null; if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId); void persistGeometry(); };
      handle.addEventListener('pointerup', endSize); handle.addEventListener('pointercancel', endSize); handle.addEventListener('lostpointercapture', endSize);
      handle.addEventListener('dblclick', fitSize);
      handle.addEventListener('keydown', event => {
        if (!geometryKey(shell.dataset.layout)) return;
        if (event.key === 'Enter' || event.key === 'Home') { event.preventDefault(); fitSize(); }
        if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
          event.preventDefault(); changeGeometry({ ...currentGeometry(), height: parseFloat(shell.style.height) + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -20 : 20) }); void persistGeometry();
        }
      });
    }
    window.addEventListener('resize', sizeFrame);
    window.visualViewport?.addEventListener('resize', sizeFrame); window.visualViewport?.addEventListener('scroll', sizeFrame);
    if (window.ResizeObserver) {
      inputObserver = new window.ResizeObserver(sizeFrame);
      for (const id of ['send_textarea', 'preview-input']) { const input = document.getElementById(id); if (input) inputObserver.observe(input); }
    }
  }
  function renderFrame() {
    const next = layout();
    shell.dataset.layout = shellViewport.dataset.layout = next;
    sizeFrame();
    if (activeLayout === next) return;
    activeLayout = next;
    shellScroll.scrollTop = shellScroll.scrollLeft = 0;
    frame.src = new URL(`ui/${next}.html`, baseUrl).href;
  }
  async function close() {
    const view = frame?.contentWindow?.LivingJapanView;
    if (view?.leave && !(await view.leave())) return;
    await geometrySave;
    view?.ui?.guide?.close();
    if (shell) shell.hidden = shellViewport.hidden = true;
    entry.setOpen?.(false);
  }
  async function open() {
    if (!shell) {
      shell = document.createElement('section'); shell.id = 'living-japan-shell'; shell.setAttribute('aria-label', 'Living Japan');
      shellViewport = document.createElement('div'); shellViewport.id = 'living-japan-viewport';
      shellScroll = document.createElement('div'); shellScroll.id = 'living-japan-scroll';
      frame = document.createElement('iframe'); frame.title = 'Living Japan 工作区';
      shell.append(frame); shellScroll.append(shell); shellViewport.append(shellScroll); document.body.append(shellViewport); mountSizeControl();
    }
    shell.hidden = shellViewport.hidden = false; renderFrame(); entry.setOpen?.(true);
  }
  const bridge = {
    baseline, session, store, catalog, updates, context, baseUrl, state, fetcher, packages,
    openPackages: (...args) => packages?.open(...args),
    canLeave: async () => !frame?.contentWindow?.LivingJapanView?.leave || await frame.contentWindow.LivingJapanView.leave(),
    isOpen: () => Boolean(shell && !shell.hidden),
    get engine() { return session.engine; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async refresh() { await session.refresh(); emit(); },
    async setLayout(value) {
      if (!['auto', 'desktop', 'portrait', 'mobile'].includes(value)) return false;
      const preview = Boolean(document.getElementById('previewStatus'));
      if (isPhone() && !preview) return value === 'auto' || value === 'mobile';
      const view = frame?.contentWindow?.LivingJapanView;
      const prepareLayout = view?.prepareLayoutChange || view?.leave;
      if (prepareLayout && !(await prepareLayout.call(view))) return false;
      await geometrySave;
      await store.update(data => { data.extensionUi = { ...data.extensionUi, layout: value }; return data; });
      requestedLayout = value; previewLayoutOverride = preview && value !== 'auto'; if (shell) renderFrame();
      return true;
    },
    append(name) { return session.engine.appendPlaceNameToChatInput(document, session.engine.outputTextForScript(name,session.engine.normalizeSettings(store.read().livingJapanSettings))); },
    appendTraffic(text) { return session.engine.appendTrafficToChatInput(document, session.engine.outputTextForScript(text,session.engine.normalizeSettings(store.read().livingJapanSettings))); },
    open, close, mountWindowDrag,
    guideHost: { document, openQuickMenu: () => entry.openMenu?.() },
    metrics: { startupMs: Math.round(performance.now() - started), baselineRelease: baseline.data.releaseId },
    destroy() { session.stop(); catalog.destroy?.(); document.removeEventListener('click',outsideClick); unsubscribeStore(); inputObserver?.disconnect(); window.removeEventListener('resize',sizeFrame); window.visualViewport?.removeEventListener('resize',sizeFrame); window.visualViewport?.removeEventListener('scroll',sizeFrame); shellViewport?.remove(); if(!suppliedEntry)entry.destroy(); listeners.clear(); },
  };
  globalThis.LivingJapanBridge = bridge;
  const outsideClick=event=>{if(shell&&!shell.hidden&&!pinned&&!shellViewport.contains(event.target)&&!entry.control?.contains(event.target)&&!button.contains(event.target)&&!event.target.closest?.('[data-lj-region-panel],[data-lj-guide]'))void close();};
  document.addEventListener('click',outsideClick);
  const unsubscribeStore=store.subscribe(data => { pinned=isPinned(data); emit(); });
  return bridge;
}
