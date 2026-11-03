import { normalizeMaterialLibrary, materialPackageId, materialCategoryNodeId, materialOwnFragmentId, categoryPath, regionPath, inferClimateRegion, MATERIAL_ANY_REGION_ID, materialRegionRows, materialRegionPath, isUniversalMaterial } from '../src/material-library.js';
import { MATERIAL_LAYER_LABELS, defaultMaterialConditions } from '../src/material-catalog.js';
import { placeIntroduction } from '../src/place-metadata.js';
import { canonicalPlaceContext, placeIdentityIds, placeStorageId, personalPlaceRecord, placeBindingGroups } from '../src/place-identities.js';

const weatherOptions = [
  ['clear', '晴朗'], ['cloudy', '阴天／多云'], ['rain', '下雨'], ['light_rain', '小雨'], ['steady_rain', '持续降雨'], ['heavy_rain', '大雨／雷雨'],
  ['snow', '降雪'], ['light_snow', '小雪'], ['heavy_snow', '大雪'], ['snow_cover', '积雪'], ['typhoon', '台风天气'], ['strong_wind', '强风'], ['not_raining', '已经停雨'],
].map(([value, label]) => ({ value, label }));
const cancel = { id: 'cancel', label: '取消' }, saveChoice = { id: 'save', label: '保存', primary: true };
const compactName = (library, id) => categoryPath(library, id).map(row => row.name).join(' › ');
const geographicRegionOptions = library => Object.values(library.regions).map(region => ({ value: region.id, label: regionPath(library, region.id).filter(row => row.id !== 'jp' || row.id === region.id).map(row => row.name).join(' › ') }));
const materialRegionOptions = library => materialRegionRows(library).map(region => ({ value: region.id, label: materialRegionPath(library, region.id).filter(row => row.id !== 'jp' || row.id === region.id).map(row => row.name).join(' › ') }));
const monthPartOptions = ['上旬（1—10日）', '中旬（11—20日）', '下旬（21日至月底）'].map((label, value) => ({ value: String(value), label }));

// LJ-TIME-PRESET-20261103: shortcuts fill the existing minute endpoints; the helper itself is never stored.
export const MATERIAL_TIME_PRESETS = Array.from({length:8},(_,index)=>{
  const hour=index*3, pad=value=>String(value).padStart(2,'0');
  const startTime=pad(hour)+':00',endTime=pad(hour+2)+':59';
  return {id:pad(hour)+'_'+pad(hour+3),label:startTime+'—'+endTime,startTime,endTime};
});
const timePresetOptions = [{value:'none',label:'不限时刻（清空起止）'},...MATERIAL_TIME_PRESETS.map(row=>({value:row.id,label:row.label})),{value:'custom',label:'自定时刻'}];
export function materialTimePreset(startTime='',endTime='') {
  if(!startTime&&!endTime)return 'none';
  return MATERIAL_TIME_PRESETS.find(row=>row.startTime===startTime&&row.endTime===endTime)?.id||'custom';
}
export function materialTimePresetChange(fieldId,values) {
  if(fieldId==='timePreset'){
    if(values.timePreset==='none')return {startTime:'',endTime:''};
    const preset=MATERIAL_TIME_PRESETS.find(row=>row.id===values.timePreset);
    return preset?{startTime:preset.startTime,endTime:preset.endTime}:{};
  }
  return ['startTime','endTime'].includes(fieldId)?{timePreset:materialTimePreset(values.startTime,values.endTime)}:{};
}

export function fragmentConditionText(library, fragment) {
  if (!fragment) return '';
  if (isUniversalMaterial(fragment)) return '通用 · 不限地区、日期、时段和天气';
  const c = fragment.conditions || {}, parts = [fragment.regionId === MATERIAL_ANY_REGION_ID ? '不限地域' : library.regions[fragment.regionId]?.name || '地域待指定'];
  if (c.months?.length) parts.push(c.months.join('、') + '月');
  if (c.monthParts?.length) parts.push(c.monthParts.map(part => ['上旬', '中旬', '下旬'][part]).join('、'));
  if (c.startDate) parts.push(c.startDate + ' 至 ' + c.endDate);
  if (c.startTime) parts.push(c.startTime + ' 至 ' + c.endTime);
  if (c.weatherTypes?.length) parts.push(c.weatherTypes.map(value => weatherOptions.find(option => option.value === value)?.label || value).join('／'));
  if (!c.months?.length && !c.monthParts?.length && !c.startDate && !c.startTime && !c.weatherTypes?.length) parts.push('不限时间和天气');
  return parts.join(' · ');
}

// LJ-MATERIAL-EDIT-20261030: save only user registrations through existing dialogs and text readers.
export function createMaterialEditor(ui) {
  const entityKey = entity => placeStorageId(entity, ui.engine.data);
  const library = () => ui.engine.data.materialLibrary;
  const raw = () => normalizeMaterialLibrary(ui.bridge.store.read().materialLibrary || {});
  const allowed = async () => !ui.reader || await ui.reader.leave();
  async function persist(value) {
    await ui.bridge.session.runtime.saveMaterialLibrary(value);
    await ui.refresh();
  }
  async function editKeywords(categoryId) {
    const category = library()?.categories[categoryId];
    if (!category || !(await allowed())) return;
    let draft = (category.activationKeywords || []).join('\n');
    while (true) {
      const result = await ui.ask({ title: category.name + ' · 独立有效词',
        message: '选填，每行一个。命中后取用本词条的本级正文与直接适用情况，仍按条件和开关筛选。留空时保留原有挂接取用。',
        fields: [{ id: 'activationKeywords', label: '独立有效词', multiline: true, value: draft }],
        confirmDiscard: true, choices: [cancel, saveChoice] });
      if (result.id !== 'save') return;
      draft = result.values.activationKeywords;
      try {
        const value = raw();
        value.categories[categoryId] = { ...library().categories[categoryId], activationKeywords: [...new Set(draft.split(/\r?\n/).map(word => word.trim()).filter(Boolean))] };
        await persist(value); await ui.reader?.refreshActive?.(); ui.notify('独立有效词已保存'); return;
      } catch (error) { ui.notify(error.message, 'error'); }
    }
  }
  async function add(node) {
    if (!node || !library() || !(await allowed())) return;
    const options = [{ id: 'category', label: '新增下级词条' }];
    if (node.categoryId) options.push({ id: 'fragment', label: '添加一种适用情况' });
    if (node.kind === 'layer' && node.layer === 'TN') options.push({ id: 'region', label: '新增适用地域' });
    const kind = await ui.ask({ title: '在“' + node.name + '”中新增', message: '分类和片段可以先留空，以后继续补充。', choices: [...options, cancel] });
    if (kind === 'cancel') return;
    if (kind === 'category') {
      const parent = node.categoryId ? library().categories[node.categoryId] : null;
      const fields = [{ id: 'name', label: '分类名称', value: '' }];
      if (node.layer === 'TN' && !parent) fields.push({ id: 'mode', label: '适用方式', value: 'bound', options: [{ value: 'bound', label: '地点挂接此词条后适用' }, { value: 'regional', label: '按地域与时间适用' }] });
      const result = await ui.ask({ title: '新增分类', message: parent ? '上级：' + compactName(library(), parent.id) : '所属：' + MATERIAL_LAYER_LABELS[node.layer], fields, confirmDiscard: true, choices: [cancel, saveChoice] });
      if (result.id !== 'save') return;
      const name = result.values.name.trim(); if (!name) { ui.notify('请填写分类名称', 'error'); return; }
      const id = crypto.randomUUID(), value = raw();
      value.categories[id] = { id, name, parentId: parent?.id || null, layer: node.layer, ...(result.values.mode === 'regional' ? { autoRegional: true } : {}) };
      await persist(value);
      await ui.locateMaterialNode(materialCategoryNodeId(id, node.layer === 'TN' ? node.regionId || 'jp' : ''));
      ui.notify('分类已建立，正文可以保持为空');
    } else if (kind === 'region') {
      const result = await ui.ask({ title: '新增适用地域', message: '建立一个独立地域；之后可在地点的词条属性中选择它。', fields: [{ id: 'name', label: '地域名称', value: '' }], confirmDiscard: true, choices: [cancel, saveChoice] });
      if (result.id !== 'save') return;
      const name = result.values.name.trim(); if (!name) { ui.notify('请填写地域名称', 'error'); return; }
      const id = crypto.randomUUID(), value = raw(); value.regions[id] = { id, name, parentId: 'jp' };
      await persist(value); await ui.locateMaterialNode('material-region:' + id); ui.notify('适用地域已建立');
    } else if (kind === 'fragment') {
      const result = await ui.ask({ title: '添加一种适用情况', message: '词条：' + compactName(library(), node.categoryId), fields: [{ id: 'title', label: '情况名称', value: '' }, { id: 'regionId', label: '适用地域', value: node.regionId || 'jp', options: materialRegionOptions(library()) }], confirmDiscard: true, choices: [cancel, { id: 'save', label: '建立并编辑', primary: true }] });
      if (result.id !== 'save') return;
      const title = result.values.title.trim(); if (!title) { ui.notify('请填写片段名称', 'error'); return; }
      const id = crypto.randomUUID(), value = raw();
      value.fragments[id] = { id, title, categoryId: node.categoryId, regionId: result.values.regionId, familyId: '', conditions: defaultMaterialConditions(node.categoryId) };
      await persist(value);
      const packageId = materialPackageId(id); await ui.locateMaterial(ui.getEntityForPackage(packageId), packageId, true);
      ui.notify('片段已建立；正文可留空，资料信息中可设置时间条件');
    }
  }
  async function editFragment(id) {
    if (!(await allowed())) return;
    let fragment = library()?.fragments[id]; if (!fragment) return;
    while (fragment) {
      const c = fragment.conditions || {}, own = fragment.ownBody, fixedRegion = own && library().categories[fragment.categoryId]?.layer === 'TN';
      const fixedGeography = fixedRegion && fragment.regionId !== MATERIAL_ANY_REGION_ID;
      const visibleWhen = fixedGeography ? undefined : { id: 'applicability', value: 'conditional' };
      const regionName = materialRegionPath(library(), fragment.regionId).at(-1).name;
      const result = await ui.ask({ title: '正文适用情况', layout: 'conditions', confirmDiscard: true, discardChoices: ['unrestricted'], onFieldChange: materialTimePresetChange,
        message: '词条：' + compactName(library(), fragment.categoryId) + (fixedRegion ? ' · 适用地区：' + regionName + '（此正文固定）' : '') + '。按条件取用时，各项需同时满足。', fields: [
        ...(!fixedGeography ? [{ id: 'applicability', label: '适用情况', value: isUniversalMaterial(fragment) ? 'universal' : 'conditional', options: [{ value: 'universal', label: '通用' }, { value: 'conditional', label: '按条件' }] }] : []),
        ...(!own ? [{ id: 'title', label: '情况名称', value: fragment.title }] : []),
        ...(!fixedRegion ? [{ id: 'regionId', label: '适用地域', value: fragment.regionId, options: materialRegionOptions(library()), visibleWhen }] : []),
        { id: 'months', label: '月份（如3、4、5；留空不限）', value: (c.months || []).join('、'), visibleWhen },
        { id: 'monthParts', label: '旬（不勾选则不限）', multiple: true, options: monthPartOptions, value: (c.monthParts || []).map(String), visibleWhen },
        { id: 'startDate', label: '起始月日（如12-20；可跨年）', value: c.startDate || '', half: true, visibleWhen },
        { id: 'endDate', label: '结束月日（如01-10）', value: c.endDate || '', half: true, visibleWhen },
        { id: 'timePreset', label: '时段快捷填写（选后仍可调整）', value: materialTimePreset(c.startTime,c.endTime), options: timePresetOptions, transient: true, visibleWhen },
        { id: 'startTime', label: '起始时刻（可跨夜）', type: 'time', value: c.startTime || '', half: true, visibleWhen },
        { id: 'endTime', label: '结束时刻', type: 'time', value: c.endTime || '', half: true, visibleWhen },
        { id: 'weatherTypes', label: '适用天气（不勾选则不限）', multiple: true, options: weatherOptions, value: c.weatherTypes || [], visibleWhen },
      ], choices: [cancel, ...(fixedGeography ? [{ id: 'unrestricted', label: '打开不限地域正文' }] : []), saveChoice] });
      if (result.id === 'unrestricted' && fixedGeography) {
        const packageId = materialPackageId(materialOwnFragmentId(fragment.categoryId, MATERIAL_ANY_REGION_ID));
        await ui.locateMaterial(ui.getEntityForPackage(packageId), packageId, false); return;
      }
      if (result.id !== 'save') return;
      const values = result.values, universal = !fixedGeography && values.applicability === 'universal';
      const months = !universal && values.months.trim() ? values.months.trim().split(/[,，、\s]+/).map(Number) : [];
      fragment = { ...fragment, title: own ? fragment.title : values.title.trim(), regionId: fixedRegion ? fragment.regionId : universal ? MATERIAL_ANY_REGION_ID : values.regionId,
        conditions: universal ? {} : { ...c, months, monthParts: (values.monthParts || []).map(Number), startDate: values.startDate.trim(), endDate: values.endDate.trim(), startTime: values.startTime, endTime: values.endTime, weatherTypes: values.weatherTypes } };
      try {
        if (!fragment.title) throw new Error('请填写片段名称');
        if (months.some(month => !Number.isInteger(month) || month < 1 || month > 12)) throw new Error('月份请填写1至12，多个用顿号分开');
        const value = raw(); value.fragments[id] = fragment;
        await persist(value); await ui.reader.refreshActive(); ui.notify(own ? '词条正文适用条件已保存' : '片段资料与适用条件已保存'); return;
      } catch (error) { ui.notify(error.message, 'error'); }
    }
  }
  function pointRegion(entity) {
    const saved = personalPlaceRecord(entity, ui.engine.data, 'climateRegionId');
    return saved ? saved.climateRegionId : inferClimateRegion(canonicalPlaceContext(entity, ui.engine.data) || entity);
  }
  function pointSnapshot(entity, climateRegionId) {
    const id = entityKey(entity), saved = library().places[id] || {};
    return { ...saved, id, name: entity.name || entity.label, aliases: entity.aliases || [], fullNames: entity.fullNames || [entity.name || entity.label], legacyPlaceId: entity.legacyPlaceId || undefined, sourceIds: placeIdentityIds(entity, ui.engine.data), adminPath: entity.adminPath || [], adminNodes: entity.adminNodes || [], regionCode: entity.regionCode || null, coordinates: entity.coordinates || null, type: entity.type || '', kind: entity.kind || '', climateRegionId: climateRegionId || null };
  }
  async function editIntroduction(entity) {
    if(ui.placeEditor&&entity&&!entity.materialFragmentId)return ui.placeEditor.open(entity,{tab:'text'});
    if (!entity || entity.materialFragmentId || !library() || !(await allowed())) return;
    const result = await ui.ask({ title: (entity.name || entity.label) + ' · 一句话介绍', message: '显示在地点卡片和相关地点列表，可留空。', fields: [{ id: 'summary', label: '一句话介绍', multiline: true, value: placeIntroduction(entity, ui.engine.data) }], choices: [cancel, saveChoice] });
    if (result.id !== 'save') return;
    const value = raw(), id = entityKey(entity);
    value.places[id] = { ...pointSnapshot(entity, pointRegion(entity)), summary: result.values.summary.trim() };
    await persist(value); await ui.reader.refreshActive(); ui.notify('一句话介绍已保存');
  }
  async function chooseCategory() {
    let query = '', layer = '', selected = '';
    while (true) {
      const rows = Object.values(library().categories).filter(category => (!layer || category.layer === layer) && (!query || compactName(library(), category.id).toLocaleLowerCase().includes(query.toLocaleLowerCase())));
      const result = await ui.ask({ title: '选择已查证的词条', message: rows.length + ' 个词条；可输入名称筛选。', fields: [
        { id: 'query', label: '搜索词条', value: query },
        { id: 'layer', label: '资料分类', value: layer, options: [{ value: '', label: '全部分类' }, ...Object.entries(MATERIAL_LAYER_LABELS).map(([value, label]) => ({ value, label }))] },
        { id: 'categoryId', label: '词条', value: selected, options: rows.length ? rows.map(category => ({ value: category.id, label: MATERIAL_LAYER_LABELS[category.layer] + ' › ' + compactName(library(), category.id) })) : [{ value: '', label: '没有匹配词条，请换个搜索词' }] },
      ], choices: [cancel, { id: 'filter', label: '筛选' }, { id: 'attach', label: '挂接此词条', primary: true }] });
      if (result.id === 'cancel') return null;
      query = result.values.query.trim(); layer = result.values.layer; selected = result.values.categoryId;
      if (result.id === 'attach' && selected) return selected;
    }
  }
  async function showPlace(entity) {
    if(ui.placeEditor&&entity&&!entity.materialFragmentId)return ui.placeEditor.open(entity,{tab:'bindings'});
    if (!entity || !library() || !(await allowed())) return;
    const id = entityKey(entity);
    let selected = '', climateRegionId = pointRegion(entity) || '';
    while (true) {
      const links = placeBindingGroups(entity, ui.engine.data);
      const result = await ui.ask({ title: (entity.name || entity.label) + ' · 词条属性', message: '已挂接 ' + links.length + ' 个词条。地域用于选择适用版本，地点正文可以为空。', fields: [
        { id: 'climateRegionId', label: '适用地域', value: climateRegionId, options: [{ value: '', label: '待确认地域' }, ...geographicRegionOptions(library())] },
        { id: 'bindingId', label: '已挂词条', value: selected, options: links.length ? links.map(binding => ({ value: binding.id, label: compactName(library(), binding.categoryId) + (binding.enabled === false ? '（已暂停）' : '') })) : [{ value: '', label: '尚未挂接词条' }] },
      ], choices: [{ id: 'close', label: '关闭' }, { id: 'add', label: '新增挂接', primary: true }, ...(links.length ? [{ id: 'view', label: '查看资料' }, { id: 'toggle', label: '暂停／恢复' }, { id: 'remove', label: '解除挂接' }] : []), { id: 'region', label: '保存地域' }] });
      if (result.id === 'close' || result.id === 'cancel') return;
      climateRegionId = result.values.climateRegionId; selected = result.values.bindingId;
      const link = links.find(binding => binding.id === selected);
      if (result.id === 'view' && link) {
        const category = library().categories[link.categoryId];
        await ui.locateMaterialNode(materialCategoryNodeId(category.id, category.layer === 'TN' ? climateRegionId || 'jp' : '')); return;
      }
      const value = raw();
      if (result.id === 'add') {
        const categoryId = await chooseCategory(); if (!categoryId) continue;
        const existing = links.find(binding => binding.categoryId === categoryId), bindingId = existing?.id || crypto.randomUUID();
        if (existing) for (const originalId of existing.bindingIds) value.bindings[originalId] = { ...value.bindings[originalId], enabled: true };
        else value.bindings[bindingId] = { id: bindingId, entityId: id, categoryId, enabled: true };
        selected = bindingId;
      } else if (result.id === 'toggle' && link) for (const originalId of link.bindingIds) value.bindings[originalId] = { ...value.bindings[originalId], enabled: link.enabled === false };
      else if (result.id === 'remove' && link) { for (const originalId of link.bindingIds) delete value.bindings[originalId]; selected = ''; }
      else if (result.id !== 'region') continue;
      value.places[id] = pointSnapshot(entity, climateRegionId);
      await persist(value); ui.notify(result.id === 'remove' ? '挂接已解除，词条和正文保留' : result.id === 'toggle' ? '当前地点的挂接状态已保存' : result.id === 'region' ? '适用地域已保存' : '词条已挂接到当前地点');
    }
  }
  function placeInfo(entity) {
    if (!library()) return { climateName: '', bindings: [] };
    const climateRegionId = pointRegion(entity);
    return { climateName: library().regions[climateRegionId]?.name || '待确认地域', bindings: placeBindingGroups(entity, ui.engine.data).map(binding => ({ ...binding, name: compactName(library(), binding.categoryId) })) };
  }
  return { add, editKeywords, editFragment, editIntroduction, showPlace, placeInfo };
}
