// LJ-EXTENSION-UPDATE: 扩展更新只调用酒馆更新接口，用户保存独立保留。
export function createUpdateManager({ context, fetcher = globalThis.fetch, extensionName = 'Living-Japan', global: isGlobal, version } = {}) {
  let scope, discovery, checking = null, state = { checking: false, available: false, supported: null, error: null, version: /^v\d{8}$/.test(version || '') ? version : null };
  const listeners = new Set(), getState = () => structuredClone(state);
  function publish(value) { state = { ...state, ...value }; for (const fn of listeners) { try { fn(getState()); } catch (error) { console.error('[Living Japan] 程序更新状态订阅失败', error); } } }
  async function installationScope() {
    if (typeof isGlobal === 'boolean') return isGlobal ? 'global' : 'local';
    if (scope !== undefined) return scope;
    discovery ||= (async () => {
      const response = await fetcher('/api/extensions/discover', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error(`程序安装位置读取失败（${response.status}）`);
      const entries = await response.json();
      const matches = (Array.isArray(entries) ? entries : []).filter(entry => entry.name === `third-party/${extensionName}` || entry.name === extensionName);
      scope = matches.find(entry => entry.type === 'local')?.type || matches.find(entry => entry.type === 'global')?.type || null;
      return scope;
    })();
    try { return await discovery; } finally { discovery = null; }
  }
  async function request(action) {
    const installScope = await installationScope();
    if (!installScope) throw new Error('未找到可更新的程序安装信息');
    const response = await fetcher(`/api/extensions/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(context?.getRequestHeaders?.() || {}) },
      body: JSON.stringify({ extensionName, global: installScope === 'global' }),
    });
    if (!response.ok) throw new Error(`扩展${action === 'update' ? '更新' : '检查'}失败（${response.status}）`);
    return response.json();
  }
  return {
    getState,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    check() {
      if (checking) return checking;
      publish({ checking: true, error: null });
      checking = Promise.resolve().then(async () => {
        try {
          const result = await installationScope() ? await request('version') : {};
          const supported = Boolean(result.currentCommitHash && result.remoteUrl);
          publish({ ...result, supported, available: supported && result.isUpToDate === false });
        } catch (error) { publish({ error: error.message }); throw error; }
        finally { checking = null; publish({ checking: false }); }
        return getState();
      });
      return checking;
    },
    async update() {
      const result = await request('update');
      if (!result.shortCommitHash || typeof result.isUpToDate !== 'boolean') throw new Error('服务器未确认扩展更新结果');
      publish({ available: false, error: null, reloadRequired: result.isUpToDate === false });
      return { ...result, reloadRequired: result.isUpToDate === false };
    },
  };
}

export function inspectBuiltinChanges(container, manifest = {}) {
  const slots = manifest.slots || manifest.editableTextSlots?.slots || {};
  const records = container?.livingJapanTextOverrides?.records || {};
  const changedSlotKeys = [], missingSlotKeys = [];
  for (const [slotKey, record] of Object.entries(records)) {
    if (!slots[slotKey]) missingSlotKeys.push(slotKey);
    else if (record.baseBuiltinSha256 !== slots[slotKey].bodySha256) changedSlotKeys.push(slotKey);
  }
  return { dataVersion: manifest.dataVersion || manifest.version || null, changedSlotKeys, missingSlotKeys };
}
