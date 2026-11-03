import textScript from './legacy/text-script.js';

// LJ-ADMIN-PLACE-PAIR-20261103: named places and appended routes share the same saved administrative identity.
const idsOf = entity => [entity?.placeId, entity?.id, entity?.legacyPlaceId, ...(entity?.sourceIds || []), ...(entity?.allSourceIds || [])].filter(Boolean);
const rowsOf = value => Array.isArray(value) ? value : Object.values(value || {});
const displayName = node => node?.name || node?.label || node?.nameJa || '';
const administrativeKinds = new Set(['prefecture', 'city', 'ward', 'special_ward', 'town', 'village']);
const localKinds = new Set(['city', 'ward', 'special_ward', 'town', 'village']);

function administrativeNodes(data, entities = []) {
  const nodes = new Map();
  for (const node of [...rowsOf(data.adminNodes), ...rowsOf(data.canonicalPlaceContexts?.adminNodes), ...entities.flatMap(entity => [...(entity?.adminNodes || []), ...(entity?.adminPath || []).filter(value => typeof value === 'object')])]) {
    if (node?.id) nodes.set(node.id, { ...nodes.get(node.id), ...node });
  }
  return nodes;
}

export function placeAdministrativeIdentity(entity, data = {}) {
  if (!entity) return null;
  if (typeof entity === 'string') entity = { id: entity };
  const ids = idsOf(entity), contexts = data.canonicalPlaceContexts || {};
  const canonical = ids.map(id => contexts.rows?.[contexts.aliases?.[id] || id]).find(Boolean);
  const place = (data.places || []).find(row => ids.includes(row.placeId));
  const allIds = [...ids, ...idsOf(canonical)];
  const editedId = allIds.find(id => Object.hasOwn(data.placeEdits?.created || {}, id) || Object.hasOwn(data.placeEdits?.overrides || {}, id));
  const edit = data.placeEdits?.created?.[editedId] || data.placeEdits?.overrides?.[editedId];
  const source = { ...place, ...canonical, ...entity, ...edit };
  const nodes = administrativeNodes(data, [place, canonical, entity, edit]);
  const pathIds = (source.adminPath || []).map(value => typeof value === 'string' ? value : value?.id).filter(Boolean);
  const personalAssignment = edit && (Object.hasOwn(edit, 'adminNodeId') || Object.hasOwn(edit, 'adminPath'));
  const id = personalAssignment ? edit.adminNodeId || (edit.adminPath || []).map(value => typeof value === 'string' ? value : value?.id).filter(Boolean).at(-1)
    : source.adminNodeId || source.administrativeNodeId || pathIds.at(-1) || (nodes.has(source.id) ? source.id : null);
  const node = nodes.get(id);
  if (!node || !displayName(node) || !localKinds.has(node.kind)) return null;
  const path = [], seen = new Set();
  let current = node;
  while (current && !seen.has(current.id)) { seen.add(current.id); path.unshift(current); current = nodes.get(current.parentId); }
  if (pathIds.length) {
    const explicit = pathIds.map(value => nodes.get(value)).filter(Boolean);
    if (explicit.at(-1)?.id === id && explicit.length > path.length) path.splice(0, path.length, ...explicit);
  }
  const label = path.filter(value => administrativeKinds.has(value.kind)).map(displayName).filter(Boolean).filter((value, index, names) => !index || value !== names[index - 1]).join(' ');
  return { id, node, path, label };
}

export function createAdministrativePlaceMatcher(entries, candidates, data = {}, fullNameSpans = []) {
  const nodes = administrativeNodes(data, [...candidates, ...(data.places || [])]), identities = new Map();
  const normalize = value => String(value || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').toLocaleLowerCase();
  const converter = textScript.createConverter(data.textConversion || {}), names = new Map(), ancestry = new Map();
  const pathFor = id => {
    if (ancestry.has(id)) return ancestry.get(id);
    const path = [], seen = new Set(); let node = nodes.get(id);
    while (node && !seen.has(node.id)) { seen.add(node.id); path.unshift(node.id); node = nodes.get(node.parentId); }
    ancestry.set(id, path); return path;
  };
  for (const node of nodes.values()) {
    if (!administrativeKinds.has(node.kind)) continue;
    const aliases = [node.name, node.label, node.nameJa, ...(node.aliases || []),
      ...(data.placeNameAliases?.administrativeNames?.[node.name] || []), ...(data.placeNameAliases?.administrativeNames?.[node.nameJa] || [])].filter(Boolean);
    for (const name of new Set(aliases.flatMap(value => [value, converter.toSimplified(value), converter.toTraditional(value)]).map(normalize))) {
      if (!name) continue;
      if (!names.has(name)) names.set(name, new Set()); names.get(name).add(node.id);
    }
  }
  const allOccurrenceLists = [];
  const occurrenceLists = entries.map(entry => {
    const text = normalize(entry.text), found = [], nameSpans = fullNameSpans.filter(span => span.entry === entry);
    for (const [name, ids] of names) {
      let index = text.indexOf(name);
      while (index >= 0) {
        found.push({ position: index, end: index + name.length, trigger: name, ids: [...ids], entry });
        index = text.indexOf(name, index + Math.max(1, name.length));
      }
    }
    const complete = found.filter(value => !found.some(other => other !== value && other.position <= value.position && other.end >= value.end && other.end - other.position > value.end - value.position))
      .sort((left, right) => left.position - right.position || right.end - left.end);
    allOccurrenceLists.push(complete);
    return complete.filter(event => !nameSpans.some(span => span.position <= event.position && span.end >= event.end));
  });
  const advance = (context, event) => {
    let ids = event.ids;
    if (ids.length > 1 && context?.ids.length === 1) {
      for (const ancestor of [...pathFor(context.ids[0])].reverse()) {
        if (!administrativeKinds.has(nodes.get(ancestor)?.kind)) continue;
        const compatible = ids.filter(id => pathFor(id).includes(ancestor));
        if (compatible.length) { ids = compatible; break; }
      }
    }
    ids = ids.filter(id => !ids.some(other => other !== id && pathFor(other).includes(id)));
    return { ids, evidence: event };
  };
  const starts = [], ends = [];
  let context = null;
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry.hasPriorityTags && entry.locationBoundary !== null && entry.locationBoundary !== undefined) context = null;
    starts[index] = context;
    for (const event of occurrenceLists[index]) {
      context = advance(context, event);
    }
    ends[index] = context;
  }
  return {
    pair(entity, entry, position, end, match = {}) {
      if (!identities.has(entity)) identities.set(entity, placeAdministrativeIdentity(entity, data));
      const identity = identities.get(entity), index = entries.indexOf(entry);
      if (!identity) return { matched: false, reason: 'place_administration_missing', administrativeId: null };
      const text = normalize(entry.text), pathIds = new Set(identity.path.map(node => node.id));
      const inside = match.triggerTier === 'full' ? (allOccurrenceLists[index] || []).filter(event => event.position >= position && event.end <= end && event.ids.some(id => pathIds.has(id))) : [];
      const locatedLeaf = inside.find(event => {
        if (!event.ids.includes(identity.id)) return false;
        const before = text.slice(position, event.position), after = text.slice(event.end, end);
        const branchSuffix = /^\s*(?:分店|支店|店)(?:$|[\s（）()·・-])/u.test(after);
        const separated = (!before || /[\s（）()·・/：:]$/u.test(before)) && (!after || /^[\s（）()·・/：:]/u.test(after));
        const registered = (entity.locationComposite?.qualifiers || []).some(value => normalize(value).includes(event.trigger));
        const parent = inside.some(other => other.end <= event.position && other.ids.some(id => id !== identity.id && pathIds.has(id)));
        return branchSuffix || separated || registered || parent;
      });
      const local = locatedLeaf ? inside : [];
      const events = [...new Set([...(occurrenceLists[index] || []), ...local])].sort((left, right) => left.position - right.position || right.end - left.end);
      let selected = starts[index];
      for (const event of events) selected = advance(selected, event);
      for (let newer = 0; newer < index; newer++) {
        const boundary = entries[newer].hasPriorityTags && entries[newer].locationBoundary !== null && entries[newer].locationBoundary !== undefined;
        if (!occurrenceLists[newer].length && !boundary) continue;
        const latest = ends[newer];
        if (!latest || latest.ids.length !== 1 || !identity.path.some(node => node.id === latest.ids[0])) {
          return { matched: false, reason: 'newer_administrative_context', administrativeId: identity.id, evidence: latest?.evidence || null };
        }
        break;
      }
      if (!selected) return { matched: false, reason: 'administrative_context_missing', administrativeId: identity.id };
      if (selected.ids.length !== 1) return { matched: false, reason: 'administrative_context_ambiguous', administrativeId: identity.id, evidence: selected.evidence };
      return { matched: selected.ids[0] === identity.id, reason: selected.ids[0] === identity.id ? 'administrative_pair' : 'administrative_context_mismatch',
        administrativeId: identity.id, administrativeLabel: identity.label, evidence: selected.evidence };
    },
  };
}
