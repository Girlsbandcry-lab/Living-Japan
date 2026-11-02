// LJ-NARROW-MAP-SPLITTER-20261030: resize the normal map above two visible related items, in session only.
export function mountMapSplitter({ page, map, feed, related, route, state, layout }) {
  const document = page.ownerDocument, view = document.defaultView;
  const handle = document.createElement('div'), originalGrid = page.style.gridTemplateRows;
  handle.className = 'lj-map-splitter'; handle.tabIndex = 0;
  handle.setAttribute('role', 'separator'); handle.setAttribute('aria-orientation', 'horizontal');
  handle.setAttribute('aria-controls', 'mapCanvas mapFeed');
  handle.setAttribute('aria-label', '调整地图与详情栏高度');
  handle.title = '上下拖动调整地图与详情栏；方向键调整，Home / End 到两端';
  page.appendChild(handle);
  let drag = null, dead = false;

  function measure() {
    const pageRect = page.getBoundingClientRect();
    if (page.hidden || !pageRect.height || !page.clientHeight) return null;
    const scale = pageRect.height / page.clientHeight;
    const rows = [...related.children].slice(0, 2), end = rows.at(-1) || related;
    const minimumFeed = Math.max(0, (end.getBoundingClientRect().bottom - feed.getBoundingClientRect().top) / scale + feed.scrollTop);
    const available = Math.max(0, page.clientHeight - route.getBoundingClientRect().height / scale);
    const max = Math.max(0, available - minimumFeed), min = Math.min(130, max);
    return { min, max, scale, height: map.getBoundingClientRect().height / scale };
  }
  function position(limits) {
    const height = map.getBoundingClientRect().height / limits.scale;
    handle.style.top = `${height}px`;
    handle.setAttribute('aria-valuemin', Math.round(limits.min));
    handle.setAttribute('aria-valuemax', Math.round(limits.max));
    handle.setAttribute('aria-valuenow', Math.round(height));
  }
  function apply(height, remember = true) {
    const limits = measure(); if (!limits) return;
    height = Math.max(limits.min, Math.min(limits.max, height));
    const grid = `${height}px minmax(0,1fr) auto`;
    if (page.style.gridTemplateRows !== grid) page.style.gridTemplateRows = grid;
    if (remember) state[layout] = height;
    position(limits);
  }
  function refresh() {
    if (dead) return;
    const limits = measure(); if (!limits) return;
    if (Number.isFinite(state[layout])) apply(state[layout], false);
    else position(limits);
  }
  function down(event) {
    if (event.button !== 0 || event.isPrimary === false) return;
    const limits = measure(); if (!limits) return;
    event.preventDefault(); event.stopPropagation(); handle.focus({ preventScroll: true });
    drag = { id: event.pointerId, y: event.clientY, height: limits.height, scale: limits.scale };
    handle.setPointerCapture(event.pointerId); page.classList.add('lj-map-split-dragging');
  }
  function move(event) {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault(); apply(drag.height + (event.clientY - drag.y) / drag.scale);
  }
  function end(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const id = drag.id; drag = null; page.classList.remove('lj-map-split-dragging');
    if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
  }
  function key(event) {
    const limits = measure(); if (!limits) return;
    const height = { ArrowUp: limits.height - 24, ArrowDown: limits.height + 24, Home: limits.min, End: limits.max }[event.key];
    if (height === undefined) return;
    event.preventDefault(); event.stopPropagation(); apply(height);
  }
  const events = { pointerdown: down, pointermove: move, pointerup: end, pointercancel: end, lostpointercapture: end, keydown: key };
  for (const [name, listener] of Object.entries(events)) handle.addEventListener(name, listener);
  const observer = view.ResizeObserver ? new view.ResizeObserver(refresh) : null;
  for (const node of [page, route, related, feed.querySelector('.place-head'), feed.querySelector('.endpoint'), feed.querySelector('.related-title')].filter(Boolean)) observer?.observe(node);
  view.addEventListener('resize', refresh); refresh();
  return { refresh, destroy() {
    dead = true; if (drag) end({ pointerId: drag.id }); observer?.disconnect();
    view.removeEventListener('resize', refresh);
    for (const [name, listener] of Object.entries(events)) handle.removeEventListener(name, listener);
    page.style.gridTemplateRows = originalGrid; handle.remove();
  } };
}
