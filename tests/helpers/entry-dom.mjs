export function entryDOM(width = 1000, height = 700) {
  let clock = 0, timerId = 0;
  const timers = new Map(), observers = new Set();
  function target(value = {}) {
    const listeners = new Map();
    return Object.assign(value, {
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      fire(type, values = {}) {
        const event = { type, target: this, button: 0, pointerId: 1, pointerType: 'mouse', clientX: 0, clientY: 0, stopped: false,
          preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...values };
        for (const fn of listeners.get(type) || []) fn(event);
        if (!event.stopped && this.parentNode) this.parentNode.fire(type, event);
        return event;
      },
      listenerCount() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); },
    });
  }
  let document;
  function element(tag) {
    const attributes = new Map();
    const node = target({ tagName: tag.toUpperCase(), children: [], style: {}, dataset: {}, hidden: false, disabled: false, id: '', className: '', textContent: '', innerHTML: '', parentNode: null,
      append(...children) { for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); } },
      appendChild(child) { this.append(child); return child; },
      replaceChildren(...children) { for (const child of [...this.children]) child.remove(); this.append(...children); },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; },
      contains(other) { return this === other || this.children.some(child => child.contains(other)); },
      setAttribute(key, value) { attributes.set(key, String(value)); if (key === 'id') this.id = String(value); if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); },
      getAttribute(key) { if (key === 'id') return this.id; return attributes.get(key) ?? null; },
      removeAttribute(key) { attributes.delete(key); if (key.startsWith('data-')) delete this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; },
      matches(selector) { if (selector.startsWith('#')) return this.id === selector.slice(1); const attr = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector); return attr ? (attr[2] === undefined ? this.getAttribute(attr[1]) !== null : this.getAttribute(attr[1]) === attr[2]) : this.tagName === selector.toUpperCase(); },
      closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest?.(selector) || null; },
      querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      getBoundingClientRect() {
        const isMenu = this.id === 'living-japan-floating-menu';
        const w = isMenu ? 260 : 58, h = isMenu ? 360 : 58;
        const left = this.style.left ? parseFloat(this.style.left) : window.innerWidth - 76;
        const top = this.style.top ? parseFloat(this.style.top) : window.innerHeight - 76;
        return { left, top, width: w, height: h, right: left + w, bottom: top + h };
      },
      focus() { document.activeElement = this; }, setPointerCapture() {}, releasePointerCapture() {},
      get isConnected() { return document.documentElement.contains(this); },
    });
    return node;
  }
  const window = target({ innerWidth: width, innerHeight: height, performance: { now: () => clock },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, at: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    matchMedia: () => ({ matches: false }),
    MutationObserver: class { constructor(fn) { this.fn = fn; } observe() { observers.add(this); } disconnect() { observers.delete(this); } },
  });
  document = target({ createElement: element, defaultView: window, activeElement: null });
  document.documentElement = element('html'); document.head = element('head'); document.body = element('body');
  document.documentElement.append(document.head, document.body);
  document.getElementById = id => document.documentElement.querySelector(`#${id}`);
  document.querySelector = selector => document.documentElement.querySelector(selector);
  document.body.parentNode = document.documentElement; document.documentElement.parentNode = document;
  return { document, window, observers,
    tick(ms) { clock += ms; for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn(); } },
    mutate() { for (const observer of [...observers]) observer.fn([]); },
  };
}

export function entryStore(input = {}) {
  let value = structuredClone(input);
  const subscribers = new Set();
  return { read: () => structuredClone(value),
    async update(mutator) { const draft = structuredClone(value); value = mutator(draft) || draft; for (const fn of subscribers) fn(structuredClone(value)); return structuredClone(value); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    get subscribers() { return subscribers.size; },
  };
}
