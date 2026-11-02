import { BUILTIN_MATERIAL_CATEGORIES, MATERIAL_REGIONS } from './material-catalog.js';
import { VENUE_MATERIAL_CATEGORIES } from './venue-material-catalog.js';
import { canonicalPlaceContext, placeIdentityIds, personalPlaceRecord } from './place-identities.js';
import { chainPlaceIdentity, chainPlaceTriggers } from './chain-place-names.js';

// LJ-MATERIAL-PIPELINE-20261030: empty taxonomy, explicit place tags and regional fragments share the existing macro route.
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const maps = ['categories', 'regions', 'fragments', 'places', 'bindings'];
const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
export const materialPackageId = id => 'LJ_FRAGMENT_' + encodeURIComponent(id);
export const materialGroupId = (id, regionId = '') => 'LJ_MATERIAL_' + encodeURIComponent(regionId) + '/' + encodeURIComponent(id);
export const materialRegionGroupId = id => 'LJ_MATERIAL_REGION_' + encodeURIComponent(id);
export const materialCategoryNodeId = (id, regionId = '') => 'material:' + encodeURIComponent(regionId) + ':' + encodeURIComponent(id);

export function normalizeMaterialLibrary(raw = {}) {
  if (!object(raw)) throw new Error('资料登记必须是有效对象');
  if (Number(raw.schemaVersion || 1) !== 1) throw new Error('资料登记版本暂不支持');
  const result = { schemaVersion: 1 };
  for (const key of maps) {
    if (raw[key] !== undefined && !object(raw[key])) throw new Error('资料登记的' + key + '格式无效');
    result[key] = clone(raw[key] || {});
    for (const [id, row] of Object.entries(result[key])) {
      if (!id || !object(row) || (row.id && row.id !== id)) throw new Error('资料登记编号不一致：' + id);
      row.id = id;
    }
  }
  return result;
}

function hierarchy(table, id) {
  const path = [], seen = new Set();
  while (id) {
    if (seen.has(id)) throw new Error('分类或地域不能循环包含');
    seen.add(id);
    const row = table[id];
    if (!row) throw new Error('找不到分类或地域：' + id);
    path.unshift(row); id = row.parentId;
  }
  return path;
}
export const categoryPath = (library, id) => hierarchy(library.categories, id);
export const regionPath = (library, id) => hierarchy(library.regions, id);

const prefectures = '北海道 青森 岩手 宫城 秋田 山形 福岛 茨城 栃木 群马 埼玉 千叶 东京 神奈川 新潟 富山 石川 福井 山梨 长野 岐阜 静冈 爱知 三重 滋贺 京都 大阪 兵库 奈良 和歌山 鸟取 岛根 冈山 广岛 山口 德岛 香川 爱媛 高知 福冈 佐贺 长崎 熊本 大分 宫崎 鹿儿岛 冲绳'.split(' ');
const prefecturesJa = '北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'.split(' ');
export function inferClimateRegion(entity = {}) {
  if (entity.climateRegionId) return entity.climateRegionId;
  const paths = entity.adminPath || [];
  const codeValue = entity.prefectureCode || (/^\d{2}$/.test(entity.regionCode || '') ? entity.regionCode : '') || paths.map(id => String(id).match(/(?:^|:)jp:(\d{2})(?:$|:)/)?.[1] || String(id).match(/^admin:(\d{2})(?:\d{3})?$/)?.[1]).find(Boolean);
  let code = codeValue ? String(codeValue).padStart(2, '0') : null;
  const ancestry = JSON.stringify([entity.prefecture, entity.adminNodes, entity.adminPath, entity.regionId]);
  if (!code) {
    const english = { tokyo: '13', saitama: '11', chiba: '12', kanagawa: '14' };
    code = Object.entries(english).find(([name]) => ancestry.includes(name))?.[1];
  }
  if (!code) {
    const index = prefectures.findIndex((name, i) => ancestry.includes(name) || ancestry.includes(prefecturesJa[i]));
    if (index >= 0) code = String(index + 1).padStart(2, '0');
  }
  if (!code) return null;
  return [...MATERIAL_REGIONS].reverse().find(region => (region.prefectureCodes || []).map(String).map(x => x.padStart(2, '0')).includes(code))?.id || null;
}

const clock = value => { const m = String(value || '').match(/^(\d{2}):(\d{2})$/); return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null; };
const monthDay = value => { const m = String(value || '').match(/^(\d{2})-(\d{2})$/); if (!m) return null; const date = new Date(Date.UTC(2000, Number(m[1]) - 1, Number(m[2]))); return date.getUTCMonth() + 1 === Number(m[1]) && date.getUTCDate() === Number(m[2]) ? Number(m[1]) * 100 + Number(m[2]) : null; };
function validateConditions(c = {}) {
  if (!object(c)) throw new Error('时间条件格式无效');
  if (c.months && (!Array.isArray(c.months) || c.months.some(m => !Number.isInteger(m) || m < 1 || m > 12))) throw new Error('月份应为1至12');
  if ((c.startDate || c.endDate) && (monthDay(c.startDate) === null || monthDay(c.endDate) === null)) throw new Error('请完整填写起止月日，例如12-20和01-10');
  if ((c.startTime || c.endTime) && (clock(c.startTime) === null || clock(c.endTime) === null)) throw new Error('请完整填写起止时刻，例如22:00和02:00');
  if (c.weatherTypes && (!Array.isArray(c.weatherTypes) || c.weatherTypes.some(x => typeof x !== 'string'))) throw new Error('天气条件格式无效');
}

export function addMaterialLibraryToData(data, raw = {}) {
  const user = normalizeMaterialLibrary(raw);
  // LJ-VENUE-CLASS-20261101: use the dispatched IN vocabulary only for material paths; retain personal overrides.
  const builtinCategories = [...BUILTIN_MATERIAL_CATEGORIES.filter(category => category.layer !== 'IN'), ...VENUE_MATERIAL_CATEGORIES];
  const library = { ...user,
    categories: { ...Object.fromEntries(builtinCategories.map(c => [c.id, clone(c)])), ...user.categories },
    regions: { ...Object.fromEntries(MATERIAL_REGIONS.map(r => [r.id, clone(r)])), ...user.regions }
  };
  data.materialLibrary = library;
  for (const category of Object.values(library.categories)) {
    if (!category.name?.trim() || !['TN', 'EX', 'IN', 'EV'].includes(category.layer)) throw new Error('分类缺少名称或所属资料');
    if (categoryPath(library, category.id).some(c => c.layer !== category.layer)) throw new Error('下级分类必须与上级属于同一资料类');
  }
  for (const region of Object.values(library.regions)) { if (!region.name?.trim()) throw new Error('适用地域缺少名称'); regionPath(library, region.id); }
  const addGroup = (id, label, layer) => {
    if (!data.controlGroups.some(g => g.controlGroupId === id)) data.controlGroups.push({ controlGroupId: id, label, layer, kind: 'material', mode: 'material', memberPackageIds: [] });
    data.defaultSettings.groups[id] ??= true;
  };
  for (const region of Object.values(library.regions)) addGroup(materialRegionGroupId(region.id), region.name, 'TN');
  for (const category of Object.values(library.categories)) {
    for (const regionId of category.layer === 'TN' ? Object.keys(library.regions) : ['']) addGroup(materialGroupId(category.id, regionId), category.name, category.layer);
  }
  for (const item of data.packages) if (item.layer === 'TN' && !item.materialFragmentId) item.legacyMaterialRegionId = 'metro';
  let order = Math.max(...data.packages.map(p => p.order || 0), 0) + 1;
  for (const fragment of Object.values(library.fragments)) {
    const category = library.categories[fragment.categoryId];
    if (!category || !library.regions[fragment.regionId] || !fragment.title?.trim()) throw new Error('片段缺少名称、分类或适用地域');
    validateConditions(fragment.conditions);
    const id = materialPackageId(fragment.id), slotKey = 'P/' + id;
    const controls = categoryPath(library, category.id).map(c => materialGroupId(c.id, category.layer === 'TN' ? fragment.regionId : ''));
    if (category.layer === 'TN') controls.unshift(...regionPath(library, fragment.regionId).filter(r => r.id !== 'jp' || fragment.regionId === 'jp').map(r => materialRegionGroupId(r.id)));
    const item = { id, order: order++, layer: category.layer, uiGroupId: controls.at(-1), displayName: fragment.title, parentGroup: category.name,
      matchMode: 'link_only', activation: null, directTriggers: [], conditionalTriggers: [], links: [], triggerLinks: [], controlGroupIds: controls,
      body: '', bodySha256: emptyHash, allowEmptyBody: true, materialFragmentId: fragment.id, categoryId: category.id, regionId: fragment.regionId,
      placeId: null, sourceObjectId: null, bodyRecordId: 'body:' + id, defaultEnabled: true };
    data.packages.push(item); data.defaultSettings.packages[id] = true;
    data.editableTextSlots.slots[slotKey] = { slotKey, packageId: id, calendarSegmentId: null, bodySha256: emptyHash };
    data.editableTextSlots.staticCount += 1; data.editableTextSlots.slotCount += 1;
    data.bodyRecords.push({ bodyRecordId: item.bodyRecordId, packageId: id, ownerPlaceId: null, builtinStatus: 'empty', editableSlotKey: slotKey, fallbackRecordIds: [], bodySha256: emptyHash });
    for (const control of controls) data.controlGroups.find(g => g.controlGroupId === control)?.memberPackageIds.push(id);
  }
  for (const place of Object.values(library.places)) {
    if (!place.name?.trim()) throw new Error('已挂地点缺少名称');
    if (place.climateRegionId && !library.regions[place.climateRegionId]) throw new Error('已挂地点的适用地域不存在');
    const placeId = place.legacyPlaceId || place.id;
    if (data.packages.some(p => p.placeId === placeId && !p.materialFragmentId)) continue;
    const id = 'LJ_MATERIAL_ANCHOR_' + encodeURIComponent(place.id);
    const chain = chainPlaceIdentity(place, data), name = chain?.name || place.name;
    const names = chainPlaceTriggers(chain, [place.name, ...(place.fullNames || []), ...(place.aliases || [])]);
    data.packages.push({ id, order: order++, layer: 'EX', uiGroupId: null, displayName: name, matchMode: 'direct', activation: null,
      directTriggers: names, fullTriggers: names, aliasTriggers: [], conditionalTriggers: [], blockedTerms: [], links: [], triggerLinks: [], controlGroupIds: [],
      body: '', allowEmptyBody: true, materialAnchor: true, materialEntityId: place.id, placeId, placeKind: 'content_object',
      conflictGroup: place.type === '行政区' ? 'EX_MATERIAL_ADMIN' : 'EX_NAMED_VENUE', sourceObjectId: 'material:' + place.id, defaultEnabled: true });
    data.defaultSettings.packages[id] = true;
    if (!data.places.some(p => p.placeId === placeId)) data.places.push({ ...place, name, placeId, label: name, kind: 'content_object', bodyRecordIds: [], controlGroupIds: [], adminPath: place.adminPath || [], materialAnchor: true });
  }
  for (const binding of Object.values(library.bindings)) {
    if (!library.places[binding.entityId] || !library.categories[binding.categoryId]) throw new Error('词条挂接缺少地点或分类');
  }
  return data;
}

function conditionsMatch(c = {}, state = {}) {
  if (c.months?.length && (!state.date || !c.months.includes(state.date.month))) return false;
  const inRange = (value, start, end) => start <= end ? value >= start && value <= end : value >= start || value <= end;
  if (c.startDate) {
    if (!state.date?.day || !inRange(state.date.month * 100 + state.date.day, monthDay(c.startDate), monthDay(c.endDate))) return false;
  }
  if (c.startTime) {
    const time = state.clockEndpoint;
    const minutes = time && (time.minutes ?? time.hour * 60 + time.minute);
    if (minutes === null || minutes === undefined || !inRange(minutes, clock(c.startTime), clock(c.endTime))) return false;
  }
  if (c.weatherTypes?.length && !c.weatherTypes.includes(state.weather?.type)) return false;
  return true;
}

export function selectMaterialFragments({ data, settings, recognizedPackages = [], placeContexts = [], storyState = {}, resolveBody, blockReason }) {
  const library = data.materialLibrary;
  const diagnostics = { contexts: [], selected: [], skipped: [], legacyClimateSkipped: [] };
  if (!library || !settings.masterEnabled) return { packages: [], diagnostics, legacyAllowed: () => true };
  const contextMap = new Map();
  const contexts = [...placeContexts, ...recognizedPackages.filter(p => ['EX', 'IN'].includes(p.layer) && p.placeId).map(p => ({ package: p }))];
  for (const source of contexts) {
    const p = source.package || {};
    const explicit = library.places[p.materialEntityId || p.placeId] || Object.values(library.places).find(e => e.legacyPlaceId === p.placeId);
    const basePlace = data.places.find(e => e.placeId === p.placeId);
    const canonical = canonicalPlaceContext(source.entity?.id || p.placeId, data);
    const entity = canonical || source.entity || explicit || basePlace;
    if (!entity) continue;
    const entityId = canonical?.id || source.entity?.id || explicit?.id || p.placeId;
    const sourceIds = canonical ? placeIdentityIds(canonical, data) : [entityId];
    const personal = canonical ? personalPlaceRecord(canonical, data, 'climateRegionId') : null;
    const climateRegionId = personal ? personal.climateRegionId : Object.hasOwn(entity, 'climateRegionId') ? entity.climateRegionId : inferClimateRegion(entity);
    if (!contextMap.has(entityId)) contextMap.set(entityId, { entityId, name: entity.name || entity.label || p.displayName, climateRegionId, sourceIds, canonical: Boolean(canonical), attachedOnly: Boolean(source.attachedOnly) });
    else if (!source.attachedOnly) contextMap.get(entityId).attachedOnly = false;
  }
  diagnostics.contexts = [...contextMap.values()];
  const picked = new Map();
  for (const context of diagnostics.contexts) {
    const regionIds = context.climateRegionId && library.regions[context.climateRegionId] ? regionPath(library, context.climateRegionId).map(r => r.id) : [];
    const bindings = Object.values(library.bindings).filter(b => context.sourceIds.includes(b.entityId));
    const candidates = [];
    for (const fragment of Object.values(library.fragments)) {
      const category = library.categories[fragment.categoryId];
      const links = bindings.filter(b => b.categoryId === fragment.categoryId);
      const regional = category.layer === 'TN' && categoryPath(library, category.id).some(c => c.autoRegional === true);
      if ((!regional || context.attachedOnly) && !links.length) continue;
      let reason = !regionIds.includes(fragment.regionId) ? 'region_mismatch' : !conditionsMatch(fragment.conditions, storyState || {}) ? 'time_or_weather_mismatch' : null;
      if (reason) { diagnostics.skipped.push({ id: fragment.id, entityId: context.entityId, reason }); continue; }
      candidates.push({ fragment, links, regional, specificity: regionIds.indexOf(fragment.regionId) });
    }
    const families = new Map();
    for (const item of candidates) {
      const key = item.fragment.familyId ? item.fragment.categoryId + '/' + item.fragment.familyId : item.fragment.id;
      if (!families.has(key) || families.get(key).specificity < item.specificity) families.set(key, item);
    }
    for (const { fragment, links, regional } of families.values()) {
      const item = data.packages.find(p => p.materialFragmentId === fragment.id);
      const reason = (links.length && (context.canonical ? links.some(b => b.enabled === false) : !links.some(b => b.enabled !== false))) ? 'binding_off' : blockReason(item);
      if (reason) { diagnostics.skipped.push({ id: fragment.id, entityId: context.entityId, reason }); continue; }
      const effective = resolveBody(item);
      if (!effective.body?.trim()) { diagnostics.skipped.push({ id: fragment.id, entityId: context.entityId, reason: 'empty_body' }); continue; }
      if (!picked.has(item.id)) picked.set(item.id, { ...item, body: effective.body, materialFragmentId: fragment.id,
        ...(effective.custom ? { textOverride: { custom: true, slotKey: effective.slotKey, calendarSegmentId: effective.calendarSegmentId, baseChanged: effective.baseChanged } } : {}) });
      diagnostics.selected.push({ id: fragment.id, packageId: item.id, entityId: context.entityId, regionId: fragment.regionId, regional, bindingIds: links.filter(b => b.enabled !== false).map(b => b.id) });
    }
  }
  function legacyAllowed(item) {
    if (item.layer !== 'TN' || item.materialFragmentId) return true;
    const appropriate = !diagnostics.contexts.length || diagnostics.contexts.some(c => c.climateRegionId && library.regions[c.climateRegionId] && regionPath(library, c.climateRegionId).some(r => r.id === 'metro'));
    const open = regionPath(library, 'metro').filter(r => r.id !== 'jp').every(r => settings.groups[materialRegionGroupId(r.id)] !== false);
    if (!appropriate || !open) diagnostics.legacyClimateSkipped.push({ id: item.id, reason: appropriate ? 'region_branch_off' : 'outside_legacy_metro_scope' });
    return appropriate && open;
  }
  return { packages: [...picked.values()], diagnostics, legacyAllowed };
}
