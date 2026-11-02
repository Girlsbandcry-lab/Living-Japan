import { isRailStation } from './station-presentation.js';
import { METRO_POINT_CATEGORIES } from './metro-point-categories.js';
import { MAP_POINT_CATEGORIES } from './map-point-categories.js';

// LJ-PERSONAL-PLACE-20261102: sparse personal fields always compose over the current builtin identity.
const clone = value => value === undefined ? undefined : structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value || {}, key);
const fields = ['name', 'type', 'typeId', 'subtype', 'fullNames', 'parentId', 'adminNodeId', 'adminPath', 'adminNodes', 'regionCode', 'coordinates', 'summary', 'bindings'];
export const PLACE_EDIT_TYPES = [...METRO_POINT_CATEGORIES, ...MAP_POINT_CATEGORIES];
const typeById = new Map(PLACE_EDIT_TYPES.map(row => [row.id, row]));
export const placeEditSlotId = id => 'place-edit:' + id;
export const placeEditPackageId = id => 'LJ_USER_' + encodeURIComponent(placeEditSlotId(id));
export const placeEditIdentityIds = entity => [...new Set([typeof entity === 'string' ? entity : entity?.id, entity?.legacyPlaceId, ...(entity?.sourceIds || []), ...(entity?.allSourceIds || [])].filter(Boolean))];

export function normalizePlaceEdits(raw = {}) {
  if (!object(raw) || Number(raw.schemaVersion || 1) !== 1) throw new Error('个人地点资料格式或版本无效');
  const result = { schemaVersion: 1, overrides: {}, created: {} };
  for (const table of ['overrides', 'created']) {
    if (raw[table] !== undefined && !object(raw[table])) throw new Error('个人地点记录格式无效');
    for (const [id, record] of Object.entries(raw[table] || {})) {
      if (!id || !object(record)) throw new Error('个人地点编号或记录无效');
      const row = Object.fromEntries(fields.filter(field => own(record, field)).map(field => [field, clone(record[field])]));
      for (const field of ['name', 'type', 'subtype', 'summary']) if (own(row, field) && typeof row[field] !== 'string') throw new Error('地点文字资料格式无效');
      if (own(row, 'name') && !row.name.trim()) throw new Error('地点名称不能为空');
      if (own(row, 'fullNames') && (!Array.isArray(row.fullNames) || row.fullNames.some(name => typeof name !== 'string'))) throw new Error('完整激活词应为文字列表');
      if (row.fullNames) row.fullNames = [...new Set(row.fullNames.map(name => name.trim()).filter(Boolean))];
      if (own(row, 'coordinates') && row.coordinates !== null) {
        const c = Array.isArray(row.coordinates) ? { longitude: row.coordinates[0], latitude: row.coordinates[1] } : row.coordinates;
        if (!object(c) || !Number.isFinite(c.longitude) || !Number.isFinite(c.latitude) || Math.abs(c.longitude) > 180 || Math.abs(c.latitude) > 90) throw new Error('请选择有效地图落点');
        row.coordinates = { longitude: c.longitude, latitude: c.latitude };
      }
      result[table][id] = row;
    }
  }
  return result;
}

export function placeEditRecord(entity, state = {}) {
  const edits = state.placeEdits || state;
  for (const id of placeEditIdentityIds(entity)) {
    if (own(edits.created, id)) return { id, fields: edits.created[id], isNew: true };
    if (own(edits.overrides, id)) return { id, fields: edits.overrides[id], isNew: false };
  }
  return null;
}

export function placeEditPermissions(builtin, isNew = false) {
  const builtinStation = !isNew && isRailStation(builtin);
  return { coordinates: Boolean(isNew), structure: !builtinStation, builtinStation };
}

export function applyPlaceEdit(builtin, state = {}) {
  if (!builtin) return builtin;
  const record = placeEditRecord(builtin, state);
  if (!record) return builtin;
  const allowed = placeEditPermissions(builtin, record.isNew), patch = record.fields;
  const applied = Object.fromEntries(Object.entries(patch).filter(([key]) => key !== 'bindings' && (allowed.structure || key === 'summary') && (key !== 'coordinates' || allowed.coordinates)));
  const result = { ...builtin, ...clone(applied), personalEdited: true, builtinStationLocked: allowed.builtinStation, ...(record.isNew ? { personalPlace: true, userCreated: true, canonicalPlace: true } : {}) };
  if (own(applied, 'type') || own(applied, 'typeId') || own(applied, 'subtype')) {
    result.displayType = result.type; delete result.typePathIds; delete result.materialTypeId; delete result.categoryCode;
    if ((own(applied, 'type') || own(applied, 'typeId')) && !own(applied, 'subtype')) result.subtype = '';
    const selected = typeById.get(applied.typeId) || PLACE_EDIT_TYPES.find(row => row.label === result.type);
    if (selected) {
      result.typeId = selected.id; result.materialTypeId = selected.id; result.type = selected.label; result.displayType = selected.label;
      if (selected.id.includes('.')) {
        const path = [], seen = new Set(); let current = selected;
        while (current && !seen.has(current.id)) { seen.add(current.id); path.unshift(current.id); current = typeById.get(current.parentId); }
        result.typePathIds = ['layer:' + (selected.layer || selected.id.slice(0, 2).toUpperCase()), ...path];
      } else result.categoryCode = selected.id;
    }
  }
  if (own(applied, 'name')) result.activationName = applied.name;
  if (own(applied, 'fullNames')) { result.personalFullTriggers = [...applied.fullNames]; result.fullNames = [...applied.fullNames]; }
  if (own(applied, 'parentId')) {
    result.related = (builtin.related || []).filter(edge => edge.kind !== 'within');
    if (applied.parentId && !String(applied.parentId).startsWith('admin:') && !String(applied.parentId).startsWith('navigation:')) result.related.push({ id: applied.parentId, kind: 'within' });
    result.parents = applied.parentId ? [{ id: applied.parentId, regionCode: result.regionCode }] : [];
  }
  return result;
}

export function placeEditValues(entity = {}) {
  const parentId = entity.parentId ?? entity.parents?.[0]?.id ?? entity.related?.find(edge => edge.kind === 'within')?.id ?? entity.adminNodeId ?? entity.adminPath?.at(-1) ?? null;
  return { name: entity.name || entity.label || '', type: entity.type || '具名地点', typeId: entity.typeId || entity.typePathIds?.at(-1) || entity.materialTypeId || entity.categoryCode || '', subtype: entity.subtype || '',
    fullNames: clone(entity.personalFullTriggers || entity.fullNames || [entity.activationName || entity.name].filter(Boolean)),
    parentId, adminNodeId: entity.adminNodeId || entity.adminPath?.at(-1) || null, adminPath: clone(entity.adminPath || []), adminNodes: clone(entity.adminNodes || []),
    regionCode: entity.regionCode || '00', coordinates: clone(entity.coordinates || null), summary: typeof entity.summary === 'string' ? entity.summary : '' };
}

export function applyPlaceEditsToData(data, container = {}) {
  data.placeEdits = normalizePlaceEdits(container.placeEdits);
  const contexts = data.canonicalPlaceContexts ||= { aliases: {}, rows: {}, adminNodes: {} };
  contexts.aliases ||= {}; contexts.rows ||= {};
  const identities = new Map();
  for (const row of Object.values(contexts.rows)) for (const id of placeEditIdentityIds(row)) identities.set(id, row.id);
  for (const [id, row] of Object.entries(data.placeEdits.created)) {
    contexts.rows[id] = { id, kind: 'content_object', related: [], packageIds: [placeEditPackageId(id)], ...row, userCreated: true, personalPlace: true, canonicalPlace: true };
    contexts.aliases[id] = id;
  }
  for (const [id, row] of Object.entries(contexts.rows)) contexts.rows[id] = applyPlaceEdit(row, data);
  for (const [id, patch] of Object.entries({ ...data.placeEdits.overrides, ...data.placeEdits.created })) {
    const rowId = identities.get(id) || id, row = contexts.rows[rowId];
    if (!row || !own(patch, 'parentId') || !placeEditPermissions(row, own(data.placeEdits.created, id)).structure) continue;
    for (const parent of Object.values(contexts.rows)) parent.related = (parent.related || []).filter(edge => edge.kind !== 'contains' || edge.id !== rowId);
    const parent = contexts.rows[contexts.aliases[patch.parentId] || patch.parentId];
    if (parent) parent.related = [...(parent.related || []), { id: rowId, kind: 'contains' }];
  }
  data.places = (data.places || []).map(place => {
    const projected = applyPlaceEdit({ ...place, id: place.placeId, name: place.label, type: place.type || '具名地点' }, data);
    return projected.personalEdited ? { ...place, ...projected, label: projected.name } : place;
  });
  for (const item of data.packages || []) {
    const canonicalId = contexts.aliases[item.placeId] || identities.get(item.placeId) || item.placeId;
    const entity = contexts.rows[canonicalId], record = placeEditRecord(entity || { id: item.placeId }, data);
    if (!record || item.materialFragmentId) continue;
    const permissions = placeEditPermissions(entity || {}, record.isNew);
    if (permissions.structure && own(record.fields, 'name') && (!item.userSlotId || container.customSlots?.[item.userSlotId]?.placeEditPrimary)) item.displayName = record.fields.name;
    if (permissions.structure && own(record.fields, 'fullNames')) {
      item.personalFullTriggers = [...record.fields.fullNames]; item.fullTriggers = [...record.fields.fullNames]; item.directTriggers = [...record.fields.fullNames]; item.aliasTriggers = []; item.conditionalTriggers = []; item.dateConditionalTriggers = []; item.locationComposite = null;
    }
    if (permissions.structure && entity) {
      item.administrativeNodeId = entity.adminNodeId;
      item.administrativeControlGroupIds = (data.controlGroups || []).filter(group => group.kind === 'administrative' && group.layer === item.layer && (entity.adminPath || []).includes(group.adminNodeId)).map(group => group.controlGroupId);
      item.controlGroupIds = [...(item.controlGroupIds || []).filter(id => !(data.controlGroups || []).some(group => group.controlGroupId === id && group.kind === 'administrative')), ...item.administrativeControlGroupIds];
    }
  }
  return data;
}

export function placeEditUserSlots(container = {}, data = {}) {
  const slots = clone(container.customSlots || {});
  for (const [id, place] of Object.entries(container.placeEdits?.created || {})) {
    const slotId = placeEditSlotId(id);
    slots[slotId] ||= { id: slotId, entityId: id, name: place.name, title: place.name, layer: 'EX', ...clone(place), placeEditPrimary: true };
  }
  const contexts = data.canonicalPlaceContexts || {};
  for (const [slotId, slot] of Object.entries(slots)) {
    if (!slot.placeEditPrimary) continue;
    const id = slot.entityId, created = container.placeEdits?.created?.[id];
    const builtin = contexts.rows?.[contexts.aliases?.[id] || id]
      || Object.values(contexts.rows || {}).find(row => placeEditIdentityIds(row).includes(id))
      || (data.places || []).find(row => row.placeId === id);
    const source = created ? { id, ...created } : builtin;
    // Older snapshots remain a startup fallback until their stable identity is resolved.
    if (!source) continue;
    const entity = applyPlaceEdit({ ...source, id, name: source.name || source.label }, container);
    slots[slotId] = { id: slotId, entityId: id, layer: slot.layer || 'EX', placeEditPrimary: true,
      ...placeEditValues(entity), name: entity.name, title: entity.name, aliases: clone(entity.aliases || []) };
  }
  return slots;
}

export function placeEditMaterialLibrary(data, container = {}) {
  const library = clone(container.materialLibrary || {});
  library.places ||= {}; library.bindings ||= {};
  for (const [id, patch] of Object.entries({ ...container.placeEdits?.overrides, ...container.placeEdits?.created })) {
    if (!own(patch, 'bindings')) continue;
    const contexts = data.canonicalPlaceContexts || {}, source = contexts.rows?.[contexts.aliases?.[id] || id] || { id, name: patch.name || library.places[id]?.name || id };
    const entity = applyPlaceEdit(source, container), ids = new Set(placeEditIdentityIds(entity)); ids.add(id);
    if (!placeEditPermissions(source, Object.hasOwn(container.placeEdits?.created || {}, id)).structure) continue;
    for (const [bindingId, binding] of Object.entries(library.bindings)) if (ids.has(binding.entityId)) delete library.bindings[bindingId];
    if (!patch.bindings?.length) continue;
    library.places[id] = { ...library.places[id], id, name: entity.name, adminPath: entity.adminPath || [], regionCode: entity.regionCode };
    for (const binding of patch.bindings) {
      const bindingId = 'place-edit:' + id + ':' + binding.categoryId;
      library.bindings[bindingId] = { ...binding, id: bindingId, entityId: id, enabled: binding.enabled !== false };
    }
  }
  return library;
}
