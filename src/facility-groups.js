// LJ-FACILITY-BROWSE-01: source-backed membership changes browsing only, never entity/text identity.
export function createFacilityGroups() {
  const groups = new Map(), parents = new Map(), refs = new Map(), owners = new Map();
  function add(definition) {
    if (!definition?.id) return;
    const byId = new Map((definition.memberRefs || []).map(ref => [typeof ref === 'string' ? ref : ref.id, typeof ref === 'string' ? { id: ref } : { ...ref }]));
    for (const id of definition.memberIds || []) if (!byId.has(id)) byId.set(id, { id });
    byId.delete(definition.entityId);
    if (!byId.size || (!definition.entityId && byId.size < 2)) return;
    const members = [...byId.values()];
    const group = { ...definition, memberRefs: members, memberIds: members.map(ref => ref.id), types: [...new Set(definition.types || [])] };
    groups.set(group.id, group);
    if (group.entityId) owners.set(group.entityId, group);
    if (group.entityRef) refs.set(group.entityRef.id, { ...group.entityRef });
    for (const ref of members) {
      refs.set(ref.id, { ...(refs.get(ref.id) || {}), ...ref });
      if (!parents.has(ref.id)) parents.set(ref.id, []);
      if (!parents.get(ref.id).includes(group.id)) parents.get(ref.id).push(group.id);
    }
  }
  const parentOf = id => parents.get(id)?.find(groupId => groups.has(groupId)) || null;
  const ownedBy = id => owners.get(id) || null;
  const parentGroup = group => group.entityId ? parentOf(group.entityId) : null;
  function matches(group, allowed) {
    if (!allowed) return true;
    const pending = [group], seen = new Set();
    while (pending.length) {
      const item = pending.pop(); if (seen.has(item.id)) continue; seen.add(item.id);
      if (allowed.has(item.entityId)) return true;
      for (const id of item.memberIds) { if (allowed.has(id)) return true; const nested = ownedBy(id); if (nested) pending.push(nested); }
    }
    return false;
  }
  function roots(adminId, allowed) {
    return [...groups.values()].filter(group => group.adminNodeId === adminId && !parentGroup(group) && matches(group, allowed));
  }
  function view(group) {
    return { id: group.id, name: group.name, type: group.kind === 'station' ? '车站内点位' : '设施内点位', kind: 'browse-facility', groupKind: group.kind,
      browseOnly: true, entityId: group.entityId || null, types: group.types, parentId: parentGroup(group) || group.adminNodeId,
      adminNodeId: group.adminNodeId, regionCode: group.regionCode, memberCount: group.memberIds.length, evidence: group.evidence };
  }
  function excludedIds(adminId) {
    const ids = new Set();
    for (const group of groups.values()) {
      if (group.adminNodeId === adminId && group.entityId) ids.add(group.entityId);
      for (const ref of group.memberRefs) if ((ref.adminNodeId || group.adminNodeId) === adminId) ids.add(ref.id);
    }
    return [...ids];
  }
  return { add, get: id => groups.get(id) || null, ref: id => refs.get(id), parentOf, ownedBy, parentGroup, roots, matches, view, excludedIds,
    clear() { groups.clear(); parents.clear(); refs.clear(); owners.clear(); } };
}
