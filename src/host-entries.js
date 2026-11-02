import { ensureEntryStyles } from './floating-entry.js';

// LJ-HOST-ENTRIES-20261031: ST 1.19 wand/settings containers can appear after the extension starts.
const registrations = new WeakMap();

export function registerHostEntries({ open, openPackages = open, document = globalThis.document, context = {} } = {}) {
  if (!document?.documentElement) return () => {};
  registrations.get(document)?.();
  ensureEntryStyles(document);
  let destroyed = false;
  const owned = new Map();
  const create = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node; };
  function entry(id, kind) {
    const root = create('div', `extension_container lj-host-entry lj-host-${kind}`); root.id = id;
    // LJ-HOST-DRAWER-20261102: the host owns the collapsed settings drawer; the wand keeps only the app opener.
    let content = root;
    const actions = [['open', '打开 Living Japan', 'fa-torii-gate', open]];
    if (kind === 'settings') {
      const drawer = create('div', 'inline-drawer');
      const header = create('div', 'inline-drawer-toggle inline-drawer-header');
      const icon = create('div', 'inline-drawer-icon fa-solid fa-circle-chevron-down down'); icon.setAttribute('aria-hidden', 'true');
      header.append(create('strong', '', 'Living Japan'), icon);
      content = create('div', 'inline-drawer-content');
      content.append(create('div', 'lj-host-description', '写作资料与地区资料包'));
      drawer.append(header, content); root.append(drawer);
      actions.push(['packages', '地区资料包', 'fa-box-open', openPackages]);
    }
    const error = create('div', 'lj-host-error'); error.hidden = true; error.setAttribute('role', 'alert');
    for (const [action, text, icon, callback] of actions) {
      const button = create('button', kind === 'wand' ? 'list-group-item flex-container flexGap5 lj-host-button' : 'menu_button menu_button_icon lj-host-button');
      button.type = 'button'; button.setAttribute('data-lj-host-action', action);
      const glyph = create('i', `fa-solid ${icon}${kind === 'wand' ? ' extensionsMenuExtensionButton' : ''}`); glyph.setAttribute('aria-hidden', 'true');
      button.append(glyph, create('span', '', text));
      button.addEventListener('click', () => {
        error.hidden = true;
        const failed = reason => { error.textContent = String(reason?.message || reason); error.hidden = false; };
        try { Promise.resolve(callback?.()).catch(failed); } catch (reason) { failed(reason); }
      });
      content.append(button);
    }
    content.append(error); return root;
  }
  function mount() {
    if (destroyed) return;
    for (const [parentId, id, kind] of [['extensionsMenu', 'living-japan-wand-entry', 'wand'], ['extensions_settings', 'living-japan-settings-entry', 'settings']]) {
      const parent = document.getElementById(parentId); if (!parent) continue;
      let node = owned.get(id);
      if (node?.parentNode === parent) continue;
      document.getElementById(id)?.remove(); node?.remove();
      node = entry(id, kind); owned.set(id, node); parent.append(node);
    }
  }
  const Observer = document.defaultView?.MutationObserver || globalThis.MutationObserver;
  const observer = Observer ? new Observer(mount) : null;
  observer?.observe(document.body || document.documentElement, { childList: true, subtree: true });
  const ready = context.eventTypes?.APP_READY || context.event_types?.APP_READY;
  if (ready) context.eventSource?.on?.(ready, mount);
  mount();
  function destroy() {
    if (destroyed) return; destroyed = true; observer?.disconnect();
    if (ready) { const off = context.eventSource?.off || context.eventSource?.removeListener; off?.call(context.eventSource, ready, mount); }
    for (const node of owned.values()) node.remove(); owned.clear();
    if (registrations.get(document) === destroy) registrations.delete(document);
  }
  registrations.set(document, destroy); return destroy;
}
