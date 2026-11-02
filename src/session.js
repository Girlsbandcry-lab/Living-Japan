import { preserveUnavailableSettings } from './region-pack-runtime.js';
import { normalizeMaterialLibrary } from './material-library.js';

// LJ-EXT-SESSION
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
export function createSession({ engine: initialEngine, store, context = {}, onChange = () => {}, prepareUserData, textResources } = {}) {
  let engine = initialEngine;
  let started = false;
  let slotSignature = null;
  let settings, textOverrides, uiPreferences;
  let currentRequest = null;
  let requestSerial = 0;
  let lastDiagnostics = null;
  let lastActualInjection = null;
  let lastPreview = null;
  let macroContext = null;
  const listeners = [];
  const readContext = () => (typeof context === 'function' ? context() : context) || {};
  const messages = () => (readContext().chat || []).slice();
  const now = () => new Date().toISOString();
  const notify = (type, error) => onChange({ type, error, runtime, engine });

  function refreshCaches(rebuild = false) {
    let state = store.read();
    const slots = state.customSlots || {};
    const library = state.materialLibrary || {};
    const signature = JSON.stringify([slots, library]);
    if (rebuild || signature !== slotSignature) {
      const hasSlots = Array.isArray(slots) ? slots.length > 0 : Object.keys(slots).length > 0;
      const hasMaterials = ['categories', 'regions', 'fragments', 'places', 'bindings'].some(key => Object.keys(library[key] || {}).length > 0);
      engine = (rebuild || hasSlots || hasMaterials) && initialEngine.withUserData ? initialEngine.withUserData(state)
        : hasSlots && initialEngine.withUserSlots ? initialEngine.withUserSlots(slots) : initialEngine;
      slotSignature = signature;
      if (!initialEngine.data.regionPackageMode) store.setKnownSlots?.(initialEngine.withUserData
        ? container => initialEngine.withUserData(container).data.editableTextSlots.slots
        : engine.data.editableTextSlots.slots);
      state = store.read();
    }
    settings = engine.normalizeSettings(state[engine.data.settingsKey]);
    textOverrides = engine.normalizeTextOverrides(state[engine.data.textOverrideKey]);
    uiPreferences = engine.normalizeUIPreferences(state[engine.data.uiPreferencesKey]);
    return state;
  }

  async function saveField(key, value, normalize) {
    const normalized = normalize(value);
    await store.update(draft => { draft[key] = key === engine.data.settingsKey && engine.data.regionPackageMode ? preserveUnavailableSettings(draft[key], normalized, engine.data.packages.map(item=>item.id)) : normalized; });
    refreshCaches();
    return clone(normalized);
  }

  async function prepareText(method, ids) {
    if (!textResources) return false;
    const changed = Boolean(await textResources[method](ids));
    if (changed) refreshCaches(true);
    return changed;
  }

  const ensureBodies = ids => prepareText('ensureBodies', ids);
  const ensureSummaries = ids => prepareText('ensureSummaries', ids);

  async function preparePlaceRequest(requestType, selectedSettings = settings) {
    if (!prepareUserData?.prepareRequest) return {};
    const prepared = await prepareUserData.prepareRequest(messages(), selectedSettings, { engine, requestType });
    if (prepared.changed) refreshCaches(true);
    return { directPlaceIds: prepared.directPlaceIds, placeMatchDiagnostics: prepared.placeMatchDiagnostics };
  }

  async function handleGeneration(type = 'normal', options = {}, dryRun = false) {
    refreshCaches();
    const gate = engine.requestGate(type, options, dryRun);
    currentRequest = { id: ++requestSerial, type, gate, dryRun: Boolean(dryRun), macroExpanded: false, parentStationSelectionCache: {}, interestSelectionCache: {} };
    if (!dryRun) lastActualInjection = {
      kind: 'actual', status: gate.allowed ? 'pending' : 'rejected', requestId: currentRequest.id,
      startedAt: now(), completedAt: gate.allowed ? null : now(), prompt: '', packageIds: [],
      diagnostics: { route: 'macro', macro: '{{' + engine.data.macroName + '}}', requestType: type, gate, packageIds: [], reason: gate.allowed ? 'waiting_for_macro' : gate.reason }, error: null
    };
    if (!gate.allowed) lastDiagnostics = clone(lastActualInjection?.diagnostics || { requestType: type, gate, packageIds: [] });
    notify('generation');
    if (!gate.allowed || !textResources && !prepareUserData?.prepareRequest) return;
    const request = currentRequest;
    request.preparingText = true;
    try {
      const places = await preparePlaceRequest(type);
      if (currentRequest !== request) return;
      Object.assign(request, places);
      await prepareText('ensureAllBodies');
      if (currentRequest !== request) return;
      request.preparingText = false;
    } catch (error) {
      if (currentRequest !== request) return;
      request.preparingText = false;
      request.preparationError = String(error?.message || error);
      lastDiagnostics = { route: 'macro', macro: '{{' + engine.data.macroName + '}}', requestType: type, gate, packageIds: [], reason: 'text_prepare_failed', error: request.preparationError };
      if (!dryRun) lastActualInjection = { ...lastActualInjection, status: 'error', completedAt: now(), diagnostics: clone(lastDiagnostics), error: request.preparationError };
      readContext().stopGeneration?.();
      notify('error', error);
    }
  }

  function expandMacro() {
    if (!started) return '';
    const request = currentRequest || { type: 'normal', gate: engine.requestGate('normal', {}, false), parentStationSelectionCache: {}, interestSelectionCache: {} };
    if (!request.gate.allowed) return '';
    if (request.preparingText || request.preparationError || textResources?.isGenerationReady && !textResources.isGenerationReady()) return '';
    try {
      if (currentRequest) currentRequest.macroExpanded = true;
      const placeOptions = prepareUserData?.prepareRequest ? { directPlaceIds: request.directPlaceIds || [], placeMatchDiagnostics: request.placeMatchDiagnostics } : {};
      const result = engine.runEngine(messages(), settings, { ...placeOptions, requestType: request.type, textOverrides, parentStationSelectionCache: request.parentStationSelectionCache, interestSelectionCache: request.interestSelectionCache });
      lastDiagnostics = { ...result.diagnostics, route: 'macro', macro: '{{' + engine.data.macroName + '}}', gate: request.gate, packageIds: result.packageIds, actualPrompt: result.prompt };
      if (currentRequest && !currentRequest.dryRun) lastActualInjection = {
        kind: 'actual', status: 'expanded', requestId: request.id, startedAt: lastActualInjection?.startedAt || now(), completedAt: now(), prompt: result.prompt, packageIds: [...result.packageIds], diagnostics: clone(lastDiagnostics), error: null
      };
      notify('actual');
      return result.prompt;
    } catch (error) {
      lastDiagnostics = { route: 'macro', macro: '{{' + engine.data.macroName + '}}', requestType: request.type, gate: request.gate, packageIds: [], error: String(error?.message || error) };
      if (currentRequest && !currentRequest.dryRun) lastActualInjection = { kind: 'actual', status: 'error', requestId: request.id, startedAt: lastActualInjection?.startedAt || now(), completedAt: now(), prompt: '', packageIds: [], diagnostics: clone(lastDiagnostics), error: lastDiagnostics.error };
      notify('error', error);
      return '';
    }
  }

  function resetRequest() {
    if (currentRequest && !currentRequest.dryRun && !currentRequest.macroExpanded && lastActualInjection?.status === 'pending') {
      lastDiagnostics = { route: 'macro', macro: '{{' + engine.data.macroName + '}}', requestType: currentRequest.type, gate: currentRequest.gate, packageIds: [], reason: 'macro_not_expanded' };
      lastActualInjection = { ...lastActualInjection, status: 'macro_not_expanded', completedAt: now(), diagnostics: clone(lastDiagnostics) };
    }
    currentRequest = null;
    notify('generation-ended');
  }

  function onChatChanged() {
    currentRequest = lastDiagnostics = lastActualInjection = lastPreview = null;
    notify('chat-changed');
  }

  async function previewCurrent(settingsOverride) {
    refreshCaches();
    const selectedSettings = engine.normalizeSettings(settingsOverride || settings);
    const placeOptions = await preparePlaceRequest('normal', selectedSettings);
    await prepareText('ensureAllBodies');
    const result = engine.runEngine(messages(), selectedSettings, { ...placeOptions, requestType: 'normal', textOverrides, parentStationSelectionCache: {}, interestSelectionCache: {} });
    lastPreview = { kind: 'preview', status: 'preview', startedAt: now(), completedAt: now(), prompt: result.prompt, packageIds: [...result.packageIds], diagnostics: { ...result.diagnostics, route: 'panel_preview', macro: '{{' + engine.data.macroName + '}}', packageIds: [...result.packageIds], previewPrompt: result.prompt }, error: null };
    notify('preview');
    return result;
  }

  async function start() {
    if (started) return { started: true, duplicate: false };
    refreshCaches(Boolean(await prepareUserData?.(store.read())));
    const target = readContext();
    for (const [name, callback] of [['GENERATION_AFTER_COMMANDS', handleGeneration], ['GENERATION_ENDED', resetRequest], ['GENERATION_STOPPED', resetRequest], ['CHAT_CHANGED', onChatChanged]]) {
      const event = target.eventTypes?.[name] || name;
      if (target.eventSource?.on) { target.eventSource.on(event, callback); listeners.push([target.eventSource, event, callback]); }
    }
    started = true;
    try {
      if (typeof target.registerMacro === 'function') {
        target.registerMacro(engine.data.macroName, expandMacro, 'Living Japan 背景资料锚点');
        macroContext = target;
      }
    } catch (error) { stop(); throw error; }
    notify('ready');
    return { started: true, duplicate: false };
  }

  function stop() {
    if (macroContext) macroContext.unregisterMacro?.(engine.data.macroName);
    macroContext = null;
    for (const [source, event, callback] of listeners.splice(0)) {
      if (source.removeListener) source.removeListener(event, callback);
      else source.off?.(event, callback);
    }
    started = false;
    currentRequest = lastDiagnostics = lastActualInjection = lastPreview = null;
    notify('stopped');
  }

  const runtime = {
    start, stop, handleGeneration, expandMacro, previewCurrent,
    isBooted: () => started,
    isMacroRegistered: () => Boolean(macroContext),
    getLastDiagnostics: () => clone(lastDiagnostics),
    getLastActualInjection: () => clone(lastActualInjection),
    getLastPreview: () => clone(lastPreview),
    readSettings: async () => { refreshCaches(); return clone(settings); },
    readTextOverrides: async () => { refreshCaches(); return clone(textOverrides); },
    readUIPreferences: async () => { refreshCaches(); return clone(uiPreferences); },
    saveSettings: value => saveField(engine.data.settingsKey, value, engine.normalizeSettings),
    saveTextOverrides: value => saveField(engine.data.textOverrideKey, value, engine.normalizeTextOverrides),
    saveUIPreferences: value => saveField(engine.data.uiPreferencesKey, value, engine.normalizeUIPreferences),
    async saveMaterialLibrary(value) {
      const normalized = normalizeMaterialLibrary(value);
      const candidate = { ...store.read(), materialLibrary: normalized };
      const prepared = Boolean(await prepareUserData?.(candidate));
      initialEngine.withUserData(candidate);
      await store.update(draft => { draft.materialLibrary = normalized; });
      refreshCaches(prepared);
      return clone(normalized);
    },
    async saveTextOverride(packageId, calendarSegmentId, body) {
      const variant = engine.editableVariantsForPackage(packageId).find(item => (item.calendarSegmentId || null) === (calendarSegmentId || null));
      if (!variant) throw new Error('找不到当前资料包正文分支');
      const clearFragment = engine.data.packages.some(item => item.id === packageId && item.materialFragmentId) && typeof body === 'string' && !body.trim();
      await store.update(draft => {
        const next = engine.normalizeTextOverrides(draft[engine.data.textOverrideKey]);
        if (clearFragment) delete next.records[variant.slotKey];
        else next.records[variant.slotKey] = engine.createOverrideRecord(variant, body);
        delete next.orphans[variant.slotKey];
        draft[engine.data.textOverrideKey] = next;
      });
      refreshCaches(); return clone(textOverrides);
    },
    async removeTextOverride(packageId, calendarSegmentId) {
      const variant = engine.editableVariantsForPackage(packageId).find(item => (item.calendarSegmentId || null) === (calendarSegmentId || null));
      if (!variant) throw new Error('找不到当前资料包正文分支');
      await store.update(draft => { const next = engine.normalizeTextOverrides(draft[engine.data.textOverrideKey]); delete next.records[variant.slotKey]; draft[engine.data.textOverrideKey] = next; });
      refreshCaches(); return clone(textOverrides);
    },
    exportTextOverrides: () => engine.serializeTextOverrides(textOverrides),
    async importTextOverrides(value) {
      const parsed = engine.parseTextOverrideImport(value, textOverrides);
      parsed.store = await saveField(engine.data.textOverrideKey, parsed.store, engine.normalizeTextOverrides);
      return clone(parsed);
    }
  };
  refreshCaches();
  return { get runtime() { return runtime; }, get engine() { return engine; }, start, stop, ensureBodies, ensureSummaries, async refresh() { refreshCaches(Boolean(await prepareUserData?.(store.read()))); notify('refreshed'); return engine; }, preview: previewCurrent };
}
