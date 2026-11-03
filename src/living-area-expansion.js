import { canonicalPlaceContext } from './place-identities.js';
import { placeIntroduction } from './place-metadata.js';
import { selectPeerPlaces } from './peer-place-selection.js';
import { isHiddenPlace, normalizeHiddenPlaceIds } from './place-hidden.js';

// LJ-MATERIAL-SCOPE-20261103: identity, two spatial parents for bindings, and place text have separate scopes.
export function createLivingAreaExpansion(data, directPlaceIds, settings, options = {}) {
  const contexts = data.canonicalPlaceContexts || {}, rows = contexts.rows || {};
  const resolve = id => canonicalPlaceContext(id, data) || rows[id];
  const unique = values => [...new Map(values.filter(Boolean).map(row => [row.id, row])).values()];
  const parents = row => unique((row?.related || []).filter(edge => edge.kind === 'within').map(edge => resolve(edge.id)))
    .filter(parent => !contexts.adminNodes?.[parent.id] && parent.type !== '行政区' && !parent.isNavigation);
  const children = row => unique((row?.related || []).filter(edge => edge.kind === 'contains').map(edge => resolve(edge.id)));
  const ancestors = row => {
    const found = [], seen = new Set([row.id]), queue = parents(row).map(entity => ({ entity, depth: 1 }));
    while (queue.length) {
      const entry = queue.shift(), parent = entry.entity;
      if (seen.has(parent.id)) continue;
      seen.add(parent.id);
      found.push(entry);
      queue.push(...parents(parent).map(entity => ({ entity, depth: entry.depth + 1 })));
    }
    return found;
  };
  const subjects = settings.masterEnabled ? unique(directPlaceIds.map(resolve)) : [];
  const directIds = new Set(subjects.map(row => row.id)), materialContexts = new Map();
  const blockedAdministrativeGroups = (data.controlGroups || []).filter(group =>
    group.kind === 'administrative' && group.layer === 'EX' && settings.groups[group.controlGroupId] === false);
  const placeTextBlockers = new Map();
  const peerPlans = new Map(), selectionCache = options.peerPlaceSelectionCache || {};
  const entries = subjects.map(entity => {
    const ancestorsWithDepth = ancestors(entity);
    const chain = ancestorsWithDepth.map(entry => entry.entity);
    const materialParents = ancestorsWithDepth.filter(entry => entry.depth <= 2).map(entry => entry.entity);
    for (const row of [...materialParents.slice().reverse(), entity])
      materialContexts.set(row.id, { entity: row, attachedOnly: !directIds.has(row.id) });
    const adminPath = new Set([...(entity.adminPath || []), entity.adminNodeId]);
    const blockedGroup = blockedAdministrativeGroups.find(group => adminPath.has(group.adminNodeId));
    if (blockedGroup) placeTextBlockers.set(entity.id, 'control_group_off:' + blockedGroup.controlGroupId);
    const showPlaceText = settings.layers.EX !== false && !blockedGroup;
    if (!showPlaceText) return { entity, materialParents, showPlaceText };
    const small = entity.livingAreaRole === 'small' ? entity : chain.find(row => row.livingAreaRole === 'small');
    const large = entity.livingAreaRole === 'large' ? entity : chain.find(row => row.livingAreaRole === 'large');
    const directParents = parents(entity);
    const peerCandidates = entity.livingAreaRole === 'small' ? children(entity).filter(row => !row.livingAreaRole)
      : entity.livingAreaRole === 'large' ? []
        : unique(directParents.flatMap(children)).filter(row => row.id !== entity.id && !row.livingAreaRole);
    const parentId = entity.livingAreaRole === 'small' ? entity.id : directParents.map(row => row.id).sort().join('|') || entity.id;
    if (entity.livingAreaRole !== 'large' && !peerPlans.has(parentId)) {
      const selected = selectPeerPlaces(peerCandidates.filter(row => !directIds.has(row.id)), {
        quotas: settings.peerPlaceQuotas, favoritePlaceIds: settings.favoritePlaceIds, hiddenPlaceIds: settings.hiddenPlaceIds, data,
        cache: selectionCache, ...(typeof options.random === 'function' ? { random: options.random } : {}),
      });
      peerPlans.set(parentId, { parentId, ...selected });
    }
    const peers = peerPlans.get(parentId)?.rows || [];
    const smallAreas = large && entity.livingAreaRole !== 'small' ? children(large).filter(row => row.livingAreaRole === 'small') : [];
    const largeParents = parents(large);
    const peerAreas = large && settings.expandPeerLivingAreas
      ? (largeParents.length ? unique(largeParents.flatMap(children)) : Object.values(rows).filter(row => row.adminNodeId === large.adminNodeId))
        .filter(row => row.livingAreaRole === 'large' && row.id !== large.id && !directIds.has(row.id)) : [];
    return { entity, small, large, peers, smallAreas, peerAreas, parent: directParents[0], materialParents, showPlaceText };
  });
  return { entries, directIds, placeTextBlockers, hiddenPlaceIds: normalizeHiddenPlaceIds(settings.hiddenPlaceIds), materialContexts: [...materialContexts.values()],
    peerSelections: [...peerPlans.values()].map(({ parentId, groups }) => ({ parentId, groups })) };
}

// LJ-SPACE-OUTPUT-20261103: introductions, owned material and peer references retain their own spatial meaning.
export function renderLivingAreaExpansion(data, plan, packages, materialResult) {
  const hidden = new Set(plan.hiddenPlaceIds || []);
  const visible = row => row && !isHiddenPlace(row, hidden, data);
  const identity = id => canonicalPlaceContext(id, data)?.id || id;
  const packageMap = new Map(packages.map(item => [item.id, item]));
  const selections = materialResult.diagnostics.selected || [];
  const attachedIds = new Set(selections.filter(row => row.attached).map(row => row.packageId));
  const globalIds = new Set(selections.filter(row => (row.regional || row.keyword) && !attachedIds.has(row.packageId)).map(row => row.packageId));
  const attached = new Map();
  for (const row of selections) if (row.attached) {
    if (!attached.has(row.entityId)) attached.set(row.entityId, []);
    attached.get(row.entityId).push(row.packageId);
  }
  const directPackages = new Map();
  for (const item of packages) if (item.placeId && !item.materialFragmentId && plan.directIds.has(identity(item.placeId))) {
    const id = identity(item.placeId);
    if (!directPackages.has(id)) directPackages.set(id, []);
    directPackages.get(id).push(item.id);
  }
  const placedIds = new Set(), emittedIds = new Set(), duplicateIds = new Set(), detailedIds = new Set(), content = new Map();
  const placedMaterials = [];
  const reserve = item => {
    const body = String(item?.body || '').trim();
    if (!body) return '';
    if (emittedIds.has(item.id)) { duplicateIds.add(item.id); return ''; }
    emittedIds.add(item.id); return body;
  };
  for (const item of packages) if (globalIds.has(item.id) || !item.placeId && !item.materialFragmentId) reserve(item);
  for (const { entity } of plan.materialContexts) {
    const direct = directPackages.get(entity.id) || [], bound = attached.get(entity.id) || [];
    const isEvent = id => packageMap.get(id)?.layer === 'EV';
    if (direct.some(id => !isEvent(id) && String(packageMap.get(id)?.body || '').trim())) detailedIds.add(entity.id);
    content.set(entity.id, [...new Set([
      ...bound.filter(id => !isEvent(id)), ...direct.filter(id => !isEvent(id)),
      ...bound.filter(isEvent), ...direct.filter(isEvent),
    ])].filter(id => !globalIds.has(id)));
  }
  const takeContent = row => {
    const bodies = [];
    for (const id of content.get(row.id) || []) {
      const body = reserve(packageMap.get(id));
      if (!body) continue;
      placedIds.add(id);
      if (packageMap.get(id)?.materialFragmentId) placedMaterials.push({ packageId: id, entityId: row.id });
      bodies.push(body);
    }
    content.delete(row.id);
    return bodies.join('\n\n');
  };
  const introducedIds = new Set();
  const takeIntroduction = row => {
    if (!visible(row) || introducedIds.has(row.id) || detailedIds.has(row.id)) return '';
    const intro = placeIntroduction(row, data).trim();
    if (intro) introducedIds.add(row.id);
    return intro;
  };
  const line = row => {
    const intro = takeIntroduction(row);
    return row.name + (intro ? '：' + intro : '');
  };
  const adminNodes = data.canonicalPlaceContexts?.adminNodes || {};
  const adminTitle = row => {
    const node = adminNodes[row.adminNodeId || row.adminPath?.at(-1)];
    if (!node) return '';
    const parent = adminNodes[node.parentId];
    return (parent && visible(parent) && /(?:city|municipality)/.test(parent.kind || '') ? parent.name || parent.label || '' : '') + (visible(node) ? node.name || node.label || '' : '');
  };
  const sections = [], displayedAdmins = new Set(), displayedLarge = new Set(), displayedNearby = new Set(), displayedPeers = new Set();
  const addContent = (row, { introduction = true, heading = false } = {}) => {
    const body = takeContent(row);
    const intro = introduction ? takeIntroduction(row) : '';
    const text = [intro, body].filter(Boolean).join('\n\n');
    if (visible(row) && (heading || text)) sections.push('【' + row.name + '】' + (text ? '\n' + text : ''));
    else if (body) sections.push(body);
  };
  for (const entry of plan.entries) {
    const { entity, large, small, materialParents } = entry;
    const outward = materialParents.slice().reverse();
    if (!entry.showPlaceText) {
      for (const row of [...outward, entity]) addContent(row, { introduction: false });
      continue;
    }
    const title = adminTitle(entity);
    if (title && !displayedAdmins.has(title)) { displayedAdmins.add(title); sections.push('### ' + title); }
    if (large && !displayedLarge.has(large.id)) {
      displayedLarge.add(large.id);
      addContent(large, { heading: true });
      const smallAreas = entry.smallAreas.filter(visible);
      if (smallAreas.length) sections.push(smallAreas.map(line).join('\n'));
    }
    const peerAreas = entry.peerAreas.filter(row => visible(row) && !displayedPeers.has(row.id));
    if (peerAreas.length) {
      peerAreas.forEach(row => displayedPeers.add(row.id));
      sections.push('【周边街区】\n' + peerAreas.map(line).join('\n'));
    }
    for (const row of outward) {
      if (row.id === large?.id || plan.directIds.has(row.id)) continue;
      addContent(row);
    }
    if (entity.livingAreaRole === 'large') continue;
    const nearbyKey = (small?.id || '') + '/' + (entity.livingAreaRole === 'small' ? entity.id : entry.parent?.id || entity.id);
    if (!displayedNearby.has(nearbyKey)) {
      displayedNearby.add(nearbyKey);
      const peers = entry.peers.filter(row => visible(row) && !plan.directIds.has(row.id));
      if (peers.length) {
        const headingSource = entity.livingAreaRole === 'small' ? entity : entry.parent;
        const heading = visible(headingSource) ? headingSource.name + (entity.livingAreaRole === 'small' ? '内的地点' : '内的其他地点') : '相关地点';
        sections.push('【' + heading + '】\n' + peers.map(line).join('\n'));
      }
    }
    addContent(entity, { heading: true });
  }
  return { text: sections.join('\n\n'), placedPackageIds: [...placedIds], duplicatePackageIds: [...duplicateIds], emittedPackageIds: [...emittedIds], placedMaterials };
}
