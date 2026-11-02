// LJ-SEARCH-RESULT-LOCATION-20261101: every search layout uses the same existing administrative parent and entity identity.
export function searchResultLocation(entity) {
  const nodes = entity?.adminNodes?.length ? entity.adminNodes : (entity?.adminPath || []).filter(node => node && typeof node === 'object');
  for (let index = nodes.length - 1; index >= 0; index--) {
    const node = nodes[index];
    if (!node || node.id === 'admin:jp' || node.kind === 'country' || node.id && node.id === entity?.id) continue;
    const name = String(node.label || node.name || node.nameJa || '').trim();
    if (name) return name;
  }
  return '';
}

export function createSearchResultItem(entity) {
  const name = entity?.name || entity?.label || '', type = entity?.displayType || entity?.type || '地点';
  const location = searchResultLocation(entity);
  return { id: entity?.id, entity, name, type, location, metaText: [type, location].filter(Boolean).join(' · ') };
}
