// LJ-WORKFLOW-TOUR-20261103: versioned first-run demonstration preserves the live workspace and its drafts.
export const WORKFLOW_TOUR_VERSION = '20261103-workflow-1';

export function createWorkflowOffer({ store, start }) {
  let pending = null;
  return function offer() {
    if (pending) return pending;
    if (store.read().extensionUi?.workflowTour?.seenVersion === WORKFLOW_TOUR_VERSION) return Promise.resolve(false);
    pending = (async () => {
      if ((await start('all')) !== true) return false;
      await store.update(data => {
        data.extensionUi ||= {};
        data.extensionUi.workflowTour = { ...data.extensionUi.workflowTour, seenVersion: WORKFLOW_TOUR_VERSION };
      });
      return true;
    })().finally(() => { pending = null; });
    return pending;
  };
}

export function createWorkflowTourHost({ baseUrl, store, layout = () => 'desktop', document: doc = globalThis.document } = {}) {
  let panel = null, frame = null, opening = null, finishOpening = null, previousFocus = null, timer = null;
  const view = doc.defaultView;
  function close() {
    if (timer) view.clearTimeout(timer); timer = null;
    finishOpening?.(false); finishOpening = null;
    panel?.close(); panel?.remove(); panel = frame = null; opening = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }
  function start(scope = 'all') {
    if (panel) return opening || Promise.resolve(true);
    if (!doc.getElementById('lj-workflow-host-style')) {
      const link = doc.createElement('link'); link.id = 'lj-workflow-host-style'; link.rel = 'stylesheet';
      link.href = new URL('src/workflow-tour.css', baseUrl).href; doc.head.append(link);
    }
    previousFocus = doc.activeElement;
    panel = doc.createElement('dialog'); panel.id = 'living-japan-workflow-tour'; panel.setAttribute('aria-label', 'Living Japan 完整流程演示');
    const loading = doc.createElement('div'); loading.className = 'lj-workflow-loading';
    const note = doc.createElement('p'); note.textContent = '正在准备示例和操作演示…';
    const end = doc.createElement('button'); end.type = 'button'; end.textContent = '结束本章导览'; end.addEventListener('click', close);
    loading.append(note, end);
    frame = doc.createElement('iframe'); frame.title = 'Living Japan 完整流程演示 · 示例资料';
    const url = new URL('ui/workflow-tour.html', baseUrl); url.searchParams.set('scope', scope); url.searchParams.set('layout', layout());
    frame.src = url.href;
    opening = new Promise(resolve => { finishOpening = resolve; });
    const fail = event => {
      if (!panel) return;
      if (timer) view.clearTimeout(timer); timer = null;
      note.textContent = event?.detail?.message || '演示未能打开。请结束本章后，从设置中的“完整流程演示”重试。';
      loading.hidden = false; frame.hidden = true;
      finishOpening?.(false); finishOpening = null;
    };
    frame.addEventListener('lj-workflow-ready', () => {
      if (!panel) return;
      if (timer) view.clearTimeout(timer); timer = null;
      loading.hidden = true; frame.hidden = false;
      finishOpening?.(true); finishOpening = null;
      frame.focus();
    });
    frame.addEventListener('lj-workflow-exit', close);
    frame.addEventListener('lj-workflow-error', () => {
      if (!panel) return;
      if (timer) view.clearTimeout(timer); timer = null;
      loading.hidden = true; frame.hidden = false;
    });
    frame.addEventListener('lj-workflow-complete', () => {
      if (scope !== 'all') return;
      void store.update(data => { data.extensionUi ||= {}; data.extensionUi.workflowTour = { ...data.extensionUi.workflowTour, completedVersion: WORKFLOW_TOUR_VERSION }; }).catch(error => { note.textContent = error.message; });
    });
    panel.addEventListener('cancel', event => event.preventDefault());
    panel.addEventListener('click', event => event.stopPropagation());
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); } });
    panel.append(loading, frame); doc.body.append(panel); panel.showModal();
    timer = view.setTimeout(fail, 45000);
    return opening;
  }
  const offer = createWorkflowOffer({ store, start });
  return { start, offer, close, destroy: close, isOpen: () => Boolean(panel) };
}
