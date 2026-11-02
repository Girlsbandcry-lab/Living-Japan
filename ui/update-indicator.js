// LJ-UPDATE-INDICATOR-20261102: pending updates add a decorative corner mark without changing the original header action.
export function mountUpdateIndicator(ui) {
  const manager = ui.bridge.packages?.manager, updates = ui.bridge.updates;
  let data = manager?.getUpdateSummary?.() || {}, program = updates?.getState?.() || {};
  const badges = [...document.querySelectorAll('.brand7,.top .lily')].map(host => {
    const badge = document.createElement('span');
    badge.className = 'lj-update-indicator'; badge.textContent = 'NEW';
    badge.setAttribute('data-lj-update-indicator', ''); badge.setAttribute('aria-hidden', 'true');
    badge.style.position = 'absolute'; badge.style.pointerEvents = 'none';
    host.append(badge); return badge;
  });
  function render() {
    const available = Boolean(data.available || program.available);
    for (const badge of badges) badge.hidden = !available;
  }
  const unsubscribeData = manager?.subscribeUpdates?.(value => { data = value; render(); });
  const unsubscribeProgram = updates?.subscribe?.(value => { program = value; render(); });
  render();
  return { destroy() {
    unsubscribeData?.(); unsubscribeProgram?.();
    for (const badge of badges) badge.remove();
  } };
}
