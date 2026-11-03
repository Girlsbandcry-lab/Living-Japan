import { preserveUnavailableSettings } from './region-pack-runtime.js';
import { normalizeMaterialLibrary } from './material-library.js';
import { applyPlaceEdit, normalizePlaceEdits, placeEditRecord, placeEditPermissions, placeEditValues, placeEditIdentityIds, placeEditSlotId, placeEditPackageId } from './place-edits.js';
import { canonicalPlaceContext, placeIdentityIds, placeBindingGroups } from './place-identities.js';
import { placeIntroduction } from './place-metadata.js';

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
  let previewSerial = 0;
  let macroContext = null;
  let clearImportSlots = null;
  const listeners = [];
  const readContext = () => (typeof context === 'function' ? context() : context) || {};
  const messages = () => (readContext().chat || []).slice();
  const now = () => new Date().toISOString();
  const notify = (type, error) => onChange({ type, error, runtime, engine });

  function refreshCaches(rebuild = false) {
    let state = store.read();
    const slots = state.customSlots || {};
    const library = state.materialLibrary || {};
    const signature = JSON.stringify([slots, library, state.placeEdits]);
    if (rebuild || signature !== slotSignature) {
      const hasSlots = Array.isArray(slots) ? slots.length > 0 : Object.keys(slots).length > 0;
      const hasMaterials = ['categories', 'regions', 'fragments', 'places', 'bindings'].some(key => Object.keys(library[key] || {}).length > 0);
      const hasEdits = Object.keys(state.placeEdits?.overrides || {}).length || Object.keys(state.placeEdits?.created || {}).length;
      engine = (rebuild || hasSlots || hasMaterials || hasEdits) && initialEngine.withUserData ? initialEngine.withUserData(state)
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

  async function preparePlaceRequest(requestType, selectedSettings = settings, chat = messages()) {
    if (!prepareUserData?.prepareRequest) return {};
    const prepared = await prepareUserData.prepareRequest(chat, selectedSettings, { engine, requestType });
    if (prepared.changed) refreshCaches(true);
    return { directPlaceIds: prepared.directPlaceIds, placeMatchDiagnostics: prepared.placeMatchDiagnostics };
  }

  async function handleGeneration(type = 'normal', options = {}, dryRun = false) {
    refreshCaches();
    const gate = engine.requestGate(type, options, dryRun);
    currentRequest = { id: ++requestSerial, type, gate, dryRun: Boolean(dryRun), macroExpanded: false, parentStationSelectionCache: {}, interestSelectionCache: {}, peerPlaceSelectionCache: {} };
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
    const request = currentRequest || { type: 'normal', gate: engine.requestGate('normal', {}, false), parentStationSelectionCache: {}, interestSelectionCache: {}, peerPlaceSelectionCache: {} };
    if (!request.gate.allowed) return '';
    if (request.preparingText || request.preparationError || textResources?.isGenerationReady && !textResources.isGenerationReady()) return '';
    try {
      if (currentRequest) currentRequest.macroExpanded = true;
      const placeOptions = prepareUserData?.prepareRequest ? { directPlaceIds: request.directPlaceIds || [], placeMatchDiagnostics: request.placeMatchDiagnostics } : {};
      const result = engine.runEngine(messages(), settings, { ...placeOptions, requestType: request.type, textOverrides, parentStationSelectionCache: request.parentStationSelectionCache, interestSelectionCache: request.interestSelectionCache, peerPlaceSelectionCache: request.peerPlaceSelectionCache });
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
    previewSerial++;
    currentRequest = lastDiagnostics = lastActualInjection = lastPreview = null;
    notify('chat-changed');
  }

  async function previewCurrent(settingsOverride) {
    // LJ-PREVIEW-SNAPSHOT-20261103: one chat input, and an obsolete trial cannot publish a record.
    const serial = ++previewSerial;
    const startedAt = now();
    refreshCaches();
    const selectedSettings = engine.normalizeSettings(settingsOverride || settings);
    const selectedTextOverrides = textOverrides;
    const chat = clone(messages());
    let placeOptions;
    try {
      placeOptions = await preparePlaceRequest('normal', selectedSettings, chat);
      if (serial !== previewSerial) return null;
      await prepareText('ensureAllBodies');
    } catch (error) {
      if (serial !== previewSerial) return null;
      throw error;
    }
    if (serial !== previewSerial) return null;
    const result = engine.runEngine(chat, selectedSettings, { ...placeOptions, requestType: 'normal', textOverrides: selectedTextOverrides, parentStationSelectionCache: {}, interestSelectionCache: {}, peerPlaceSelectionCache: {} });
    lastPreview = { kind: 'preview', status: 'preview', startedAt, completedAt: now(), prompt: result.prompt, packageIds: [...result.packageIds], diagnostics: { ...result.diagnostics, route: 'panel_preview', macro: '{{' + engine.data.macroName + '}}', packageIds: [...result.packageIds], previewPrompt: result.prompt }, error: null };
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
      if (initialEngine.data.regionPackageMode) clearImportSlots = store.setImportSlots?.(
        container => (initialEngine.withUserData ? initialEngine.withUserData(container) : engine).data.editableTextSlots.slots);
      if (typeof target.registerMacro === 'function') {
        target.registerMacro(engine.data.macroName, expandMacro, 'Living Japan 背景资料锚点');
        macroContext = target;
      }
    } catch (error) { stop(); throw error; }
    notify('ready');
    return { started: true, duplicate: false };
  }

  async function placeEditModel(entityOrId, { isNew = false, parentId } = {}) {
    const state = store.read(), edits = normalizePlaceEdits(state.placeEdits);
    let id = typeof entityOrId === 'string' ? entityOrId : entityOrId?.id;
    if (!id && isNew) id = 'user-place:' + crypto.randomUUID();
    if (!id) throw new Error('请选择要编辑的地点');
    const existingCreated = edits.created[id], draftNew = isNew && !existingCreated;
    if (!draftNew) { await prepareUserData?.(state); refreshCaches(); }
    let builtinEntity = await prepareUserData?.resolveBuiltin?.(id);
    if (!builtinEntity && !existingCreated && !draftNew) builtinEntity = canonicalPlaceContext(id, initialEngine.data) || (initialEngine.data.places || []).find(row => row.placeId === id);
    builtinEntity = builtinEntity ? { ...builtinEntity, id: builtinEntity.id || builtinEntity.placeId, name: builtinEntity.name || builtinEntity.label } : null;
    const resolved = !draftNew ? await prepareUserData?.resolve?.(id) : null;
    if (resolved?.id && !existingCreated) id = resolved.id;
    if (!builtinEntity && !existingCreated && !draftNew && typeof entityOrId !== 'object') throw new Error('找不到当前地点');
    let source = builtinEntity || (existingCreated ? { id, ...existingCreated, userCreated: true } : entityOrId && typeof entityOrId === 'object' ? entityOrId : { id, name: '', type: '具名地点', parentId, fullNames: [] });
    if (draftNew && parentId) {
      const parent = await prepareUserData?.browseNode?.(parentId);
      source = { ...source, parentId, adminNodeId: parent?.type === '行政区' ? parent.id : parent?.adminNodeId || parent?.adminPath?.at(-1) || null,
        adminPath: parent?.type === '行政区' ? [...(parent.adminPath || []).filter(value => value !== parent.id), parent.id] : parent?.adminPath || [],
        adminNodes: parent?.adminNodes || [], regionCode: parent?.regionCode || '00' };
    }
    const entity = applyPlaceEdit(source, { placeEdits: edits }), builtin = placeEditValues(source), values = placeEditValues(entity);
    const ids = new Set(placeIdentityIds(resolved || entity, engine.data)); ids.add(id);
    let packages = (engine.data.packages || []).filter(item => !item.materialFragmentId && !item.materialAnchor && (ids.has(item.placeId) || resolved?.packageIds?.includes(item.id)));
    if (packages.length) { await ensureBodies(packages.map(item => item.id)); packages = packages.map(item => engine.data.packages.find(next => next.id === item.id)); }
    if (!draftNew) { await ensureSummaries([source]); values.summary = placeIntroduction(entity, engine.data); builtin.summary = placeIntroduction(source, { ...engine.data, placeEdits: normalizePlaceEdits(), materialLibrary: initialEngine.data.materialLibrary }); }
    const bodyVariants = packages.flatMap(item => engine.editableVariantsForPackage(item).map(variant => {
      const record = store.read().livingJapanTextOverrides?.records?.[variant.slotKey];
      const slot = item.userSlotId && state.customSlots?.[item.userSlotId];
      return { slotKey: variant.slotKey, packageId: item.id, calendarSegmentId: variant.calendarSegmentId || null, title: item.displayName || values.name,
        body: record ? record.body : variant.body || '', builtinBody: variant.body || '', custom: Boolean(record), userSlot: Boolean(item.userSlotId && !slot?.placeEditPrimary), virtual: false };
    }));
    if (!bodyVariants.length) bodyVariants.push({ slotKey: 'P/' + placeEditPackageId(id), packageId: placeEditPackageId(id), calendarSegmentId: null, title: values.name || '地点正文', body: '', builtinBody: '', custom: false, userSlot: false, virtual: true });
    const record = placeEditRecord({ ...resolved, id }, { placeEdits: edits });
    const bindings = placeBindingGroups(resolved || entity, engine.data);
    builtin.bindings = placeBindingGroups(source, initialEngine.data);
    const overriddenFields = Object.keys(record?.fields || {});
    if (placeIdentityIds(resolved || entity, engine.data).some(key => Object.hasOwn(state.materialLibrary?.places?.[key] || {}, 'summary')) && !overriddenFields.includes('summary')) overriddenFields.push('summary');
    if (bindings.length && !overriddenFields.includes('bindings')) overriddenFields.push('bindings');
    return { id, isNew: draftNew, values, builtin, permissions: placeEditPermissions(builtinEntity || source, Boolean(existingCreated || draftNew)), bodyVariants, overriddenFields, bindings };
  }

  async function savePlaceEdit(id, options = {}) {
    const model = await placeEditModel(id, { isNew: options.isNew }), before = store.read(), created = model.isNew || Object.hasOwn(before.placeEdits?.created || {}, model.id);
    const candidate = clone(before); candidate.placeEdits = normalizePlaceEdits(candidate.placeEdits);
    const table = created ? candidate.placeEdits.created : candidate.placeEdits.overrides;
    const previous = table[model.id] || {};
    let patch = options.restoreAll && !created ? {} : clone(previous);
    const restoreFields = new Set(options.restoreFields || []);
    if (restoreFields.has('parentId')) for (const key of ['adminNodeId', 'adminPath', 'adminNodes', 'regionCode']) restoreFields.add(key);
    if (restoreFields.has('type') || restoreFields.has('typeId')) for (const key of ['type', 'typeId', 'subtype']) restoreFields.add(key);
    if (options.restoreAll && !created) for (const key of [...Object.keys(previous), 'summary', 'bindings']) restoreFields.add(key);
    for (const key of restoreFields) delete patch[key];
    const input = options.fields || {};
    for (const [key, value] of Object.entries(input)) {
      if (key === 'coordinates' && !model.permissions.coordinates || !model.permissions.structure && key !== 'summary') continue;
      if (created || JSON.stringify(value) !== JSON.stringify(model.builtin[key])) patch[key] = clone(value);
      else delete patch[key];
    }
    if (created && model.isNew) patch = { ...model.values, ...patch };
    if (model.permissions.structure && Object.hasOwn(options, 'bindings')) patch.bindings = clone(options.bindings);
    if (Object.hasOwn(input, 'parentId') && model.permissions.structure) {
      const parentId = input.parentId, seen = new Set(), pending = [parentId];
      while (pending.length) {
        const current = pending.pop();
        if (!current) continue;
        if (current === model.id) throw new Error('地点不能归属到自己或自己的下级');
        if (seen.has(current)) continue;
        seen.add(current);
        const parent = await prepareUserData?.browseNode?.(current);
        if (parent) pending.push(...(parent.parents || []).map(ref => typeof ref === 'string' ? ref : ref.id));
      }
      const parent = parentId ? await prepareUserData?.browseNode?.(parentId) : null;
      patch.adminNodeId = parent?.type === '行政区' ? parent.id : parent?.adminNodeId || parent?.adminPath?.at(-1) || null;
      patch.adminPath = parent?.type === '行政区' ? [...(parent.adminPath || []).filter(value => value !== parent.id), parent.id] : parent?.adminPath || [];
      patch.adminNodes = parent?.adminNodes || []; patch.regionCode = parent?.regionCode || '00';
    }
    if (created && !patch.coordinates) throw new Error('请先在地图上选择地点落点');
    if (Object.keys(patch).length) table[model.id] = patch; else delete table[model.id];
    candidate.placeEdits = normalizePlaceEdits(candidate.placeEdits);
    const ids = new Set(placeIdentityIds({ id: model.id }, engine.data)); ids.add(model.id);
    if (restoreFields.has('summary')) for (const key of ids) if (candidate.materialLibrary?.places?.[key]) delete candidate.materialLibrary.places[key].summary;
    if (restoreFields.has('bindings')) for (const [key, binding] of Object.entries(candidate.materialLibrary?.bindings || {})) if (ids.has(binding.entityId)) delete candidate.materialLibrary.bindings[key];
    const texts = candidate[engine.data.textOverrideKey] ||= { schemaVersion: 1, records: {}, orphans: {} };
    texts.records ||= {}; texts.orphans ||= {};
    const restoreBodies = new Set(options.restoreBodies || []);
    if (options.restoreAll && !created) for (const variant of model.bodyVariants) if (!variant.userSlot) restoreBodies.add(variant.slotKey);
    for (const key of restoreBodies) { delete texts.records[key]; delete texts.orphans[key]; }
    for (const [slotKey, body] of Object.entries(options.bodies || {})) {
      if (typeof body !== 'string') throw new Error('正文应为文字');
      const variant = model.bodyVariants.find(row => row.slotKey === slotKey);
      if (!variant) throw new Error('找不到当前地点的正文分支');
      if (variant.virtual) {
        const slotId = placeEditSlotId(model.id);
        candidate.customSlots[slotId] = { id: slotId, entityId: model.id, ...model.values, ...patch, name: patch.name || model.values.name, title: patch.name || model.values.name, layer: 'EX', placeEditPrimary: true };
      }
      texts.records[slotKey] = { slotKey, packageId: variant.packageId, calendarSegmentId: variant.calendarSegmentId, body, baseBuiltinSha256: engine.data.editableTextSlots?.slots?.[slotKey]?.bodySha256 || '', savedAt: now(), sourceRelease: engine.data.releaseId || '' };
      delete texts.orphans[slotKey];
    }
    if (initialEngine.withUserData) initialEngine.withUserData(candidate);
    await store.update(() => candidate, { expectedRevision: before.revision });
    refreshCaches(Boolean(await prepareUserData?.(store.read())) || true);
    notify('place-edited');
    return placeEditModel(model.id);
  }

  function stop() {
    previewSerial++;
    clearImportSlots?.();
    clearImportSlots = null;
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
    readPlaceEdit: placeEditModel,
    savePlaceEdit,
    restorePlaceEdit: (id, fields) => savePlaceEdit(id, fields ? { restoreFields: fields } : { restoreAll: true }),
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
