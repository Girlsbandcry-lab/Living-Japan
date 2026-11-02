import { placeIntroduction } from '../src/place-metadata.js';

export function createPlaceSummary(ui) {
  return (entity, { selected = false } = {}) => {
    if (!entity) return { text: '在地图或搜索结果中选择地点', hasBody: false };
    const engine = ui.engine, overrides = ui.bridge.store.read().livingJapanTextOverrides;
    const hasBody = ui.reader.packageIds(entity).some(id => {
      const item = engine.data.packages.find(value => value.id === id);
      return item && Boolean(item.hasBody || String(item.body || '').trim() || String(overrides.records?.['P/' + id]?.body || '').trim());
    });
    // LJ-MAP-SELECTED-SUMMARY-20261031: selected headings already show type; other cards retain type and introduction.
    const introduction = placeIntroduction(entity, engine.data);
    return { text: selected ? introduction : [entity.displayType || entity.type || '地点', introduction].filter(Boolean).join(' · '), hasBody };
  };
}
