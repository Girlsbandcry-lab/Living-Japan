import { canonicalPlaceContext } from './place-identities.js';
import { placeIntroduction } from './place-metadata.js';
import { selectPeerPlaces } from './peer-place-selection.js';
import { isHiddenPlace, normalizeHiddenPlaceIds } from './place-hidden.js';

// LJ-LIVING-EXPANSION-20261101: explicit subjects and their living-area ancestors share one final text plan.
export function createLivingAreaExpansion(data, directPlaceIds, settings, options = {}) {
  const contexts = data.canonicalPlaceContexts || {}, rows = contexts.rows || {};
  const resolve = id => canonicalPlaceContext(id, data) || rows[id];
  const unique = values => [...new Map(values.filter(Boolean).map(row => [row.id, row])).values()];
  const parents = row => unique((row?.related || []).filter(edge => edge.kind === 'within').map(edge => resolve(edge.id)));
  const children = row => unique((row?.related || []).filter(edge => edge.kind === 'contains').map(edge => resolve(edge.id)));
  const ancestors = row => {
    const found = [], seen = new Set([row.id]), queue = parents(row);
    while (queue.length) {
      const parent = queue.shift();
      if (seen.has(parent.id)) continue;
      seen.add(parent.id); found.push(parent); queue.push(...parents(parent));
    }
    return found;
  };
  const enabled = settings.masterEnabled && settings.layers.EX !== false && settings.namedPlaceBodiesEnabled !== false;
  const subjects = enabled ? unique(directPlaceIds.map(resolve)).filter(row => {
    const path = new Set([...(row.adminPath || []), row.adminNodeId]);
    return !(data.controlGroups || []).some(group => group.kind === 'administrative' && group.layer === 'EX' && path.has(group.adminNodeId) && settings.groups[group.controlGroupId] === false);
  }) : [];
  const directIds = new Set(subjects.map(row => row.id)), materialContexts = new Map();
  const peerPlans = new Map(), selectionCache = options.peerPlaceSelectionCache || {};
  const entries = subjects.map(entity => {
    const chain = ancestors(entity);
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
    for (const row of [large, small, entity].filter(Boolean)) materialContexts.set(row.id, { entity: row, attachedOnly: !directIds.has(row.id) });
    return { entity, small, large, peers, smallAreas, peerAreas, parent: directParents[0] };
  });
  return { entries, directIds, hiddenPlaceIds: normalizeHiddenPlaceIds(settings.hiddenPlaceIds), materialContexts: [...materialContexts.values()],
    peerSelections: [...peerPlans.values()].map(({ parentId, groups }) => ({ parentId, groups })) };
}

export function renderLivingAreaExpansion(data, plan, packages, materialResult) {
  const hidden = new Set(plan.hiddenPlaceIds || []);
  const visible = row => row && !isHiddenPlace(row, hidden, data);
  const identity = id => canonicalPlaceContext(id, data)?.id || id;
  const packageMap = new Map(packages.map(item => [item.id, item]));
  const selections = materialResult.diagnostics.selected || [];
  const globalIds = new Set(selections.filter(row => row.regional).map(row => row.packageId));
  const attached = new Map();
  for (const row of selections) if (!row.regional) {
    if (!attached.has(row.entityId)) attached.set(row.entityId, []);
    attached.get(row.entityId).push(row.packageId);
  }
  const directPackages = new Map();
  for (const item of packages) if (item.placeId && !item.materialFragmentId && plan.directIds.has(identity(item.placeId))) {
    const id = identity(item.placeId);
    if (!directPackages.has(id)) directPackages.set(id, []);
    directPackages.get(id).push(item.id);
  }
  const placedIds = new Set(), emittedIds = new Set(), duplicateIds = new Set(), effectiveIds = new Set(), content = new Map();
  const reserve = item => {
    const body = String(item?.body || '').trim();
    if (!body) return '';
    if (emittedIds.has(item.id)) { duplicateIds.add(item.id); return ''; }
    emittedIds.add(item.id); return body;
  };
  for (const item of packages) if (globalIds.has(item.id) || !item.placeId && !item.materialFragmentId) reserve(item);
  for (const { entity } of plan.materialContexts) {
    const ids = [...(directPackages.get(entity.id) || []), ...(attached.get(entity.id) || [])];
    const bodies = [];
    for (const id of ids) {
      if (globalIds.has(id)) continue;
      if (String(packageMap.get(id)?.body || '').trim()) effectiveIds.add(entity.id);
      placedIds.add(id);
      const body = reserve(packageMap.get(id));
      if (body) bodies.push(body);
    }
    content.set(entity.id, bodies.join('\n\n'));
  }
  const summary = row => placeIntroduction(row, data).trim();
  const line = row => {
    const intro = effectiveIds.has(row.id) ? '' : summary(row);
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
  for (const entry of plan.entries) {
    const { entity, large, small } = entry;
    const title = adminTitle(entity);
    if (title && !displayedAdmins.has(title)) { displayedAdmins.add(title); sections.push('### ' + title); }
    if (large && !displayedLarge.has(large.id)) {
      displayedLarge.add(large.id);
      const body = content.get(large.id) || (plan.directIds.has(large.id) && !effectiveIds.has(large.id) ? summary(large) : '');
      if (visible(large)) sections.push('【' + large.name + '】' + (body ? '\n' + body : ''));
      else if (content.get(large.id)) sections.push(content.get(large.id));
      const smallAreas = entry.smallAreas.filter(visible);
      if (smallAreas.length) sections.push(smallAreas.map(line).join('\n'));
    }
    const peerAreas = entry.peerAreas.filter(row => visible(row) && !displayedPeers.has(row.id));
    if (peerAreas.length) {
      peerAreas.forEach(row => displayedPeers.add(row.id));
      sections.push(peerAreas.map(line).join('\n'));
    }
    if (entity.livingAreaRole === 'large') continue;
    const nearbyKey = (small?.id || '') + '/' + (entity.livingAreaRole === 'small' ? entity.id : entry.parent?.id || entity.id);
    if (!displayedNearby.has(nearbyKey)) {
      displayedNearby.add(nearbyKey);
      const body = small && !plan.directIds.has(small.id) ? content.get(small.id) : '';
      const peers = entry.peers.filter(row => visible(row) && !plan.directIds.has(row.id));
      if (small || body || peers.length) {
        const headingSource = small || entry.parent || entity;
        const heading = visible(headingSource) ? headingSource.name : '';
        sections.push('【' + heading + '附近地点】' +
          (body ? '\n' + body : '') + (peers.length ? '\n' + peers.map(line).join('\n') : ''));
      }
    }
    const own = content.get(entity.id) || (effectiveIds.has(entity.id) ? '' : summary(entity));
    if (visible(entity)) sections.push('【' + entity.name + '】' + (own ? '\n' + own : ''));
    else if (content.get(entity.id)) sections.push(content.get(entity.id));
  }
  return { text: sections.join('\n\n'), placedPackageIds: [...placedIds], duplicatePackageIds: [...duplicateIds], emittedPackageIds: [...emittedIds] };
}
