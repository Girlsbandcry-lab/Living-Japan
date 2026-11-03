import { materialCategoryNodeId } from '../src/material-library.js';

export function createPlaceMaterialNavigation(ui) {
  let navigating = false, returning = false;
  function canReturnToPlace() {
    const token = ui.state.placeMaterialReturn;
    return Boolean(token && token.draft === ui.state.placeEditor);
  }
  async function returnToPlace() {
    if (!canReturnToPlace() || returning) return false;
    const token = ui.state.placeMaterialReturn;
    // showPage owns the reader's save/discard/continue decision.
    returning = true;
    try {
      if (!(await ui.showPage('region'))) return false;
      if (ui.state.placeMaterialReturn === token) delete ui.state.placeMaterialReturn;
      return true;
    } finally { returning = false; }
  }
  async function editPlaceMaterial(packageId, slotKey = null) {
    const draft = ui.state.placeEditor;
    if (!draft || navigating) return false;
    const item = ui.engine.data.packages.find(row => row.id === packageId);
    if (!item?.materialFragmentId) { ui.notify('这份资料已不存在，请返回重新选择。', 'error'); return false; }
    navigating = true;
    const sourcePage = ui.state.page;
    async function rollback() {
      if (!canReturnToPlace()) return;
      if (ui.state.page === sourcePage) delete ui.state.placeMaterialReturn;
      else await returnToPlace();
    }
    try {
      await ui.bridge.session.ensureBodies?.([packageId]);
      const variants = ui.engine.editableVariantsForPackage(packageId);
      const variant = slotKey ? variants.find(row => row.slotKey === slotKey) : variants[0];
      if (!variant) { ui.notify('没有找到这份正文版本，请重新选择。', 'error'); return false; }
      const entity = ui.getEntityForPackage(packageId);
      if (!entity?.materialFragmentId || ui.state.placeEditor !== draft) return false;
      ui.state.placeMaterialReturn = { draft };
      const library = ui.engine.data.materialLibrary, fragment = library?.fragments[item.materialFragmentId];
      const category = library?.categories[fragment?.categoryId];
      const destination = fragment?.ownBody ? materialCategoryNodeId(category.id, category.layer === 'TN' ? fragment.regionId : '') : packageId;
      if (!(await ui.locateMaterialNode(destination))) { await rollback(); return false; }
      const opened = await ui.reader.open(entity, packageId, true, { mode: 'edit', slotKey: variant.slotKey });
      if (!opened) { await rollback(); return false; }
      return true;
    } catch (error) {
      await rollback();
      throw error;
    } finally { navigating = false; }
  }
  return { canReturnToPlace, editPlaceMaterial, returnToPlace };
}
