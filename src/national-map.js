import { projectCoordinates } from './catalog.js';
import { normalizeMapPointVisibility, isMapPointVisible, mapPointCategoryIds } from './map-point-categories.js';
import { metroMapPointAppearance } from './metro-point-categories.js';
import { mapPointIconId, drawMapPointIcon } from './map-point-icons.js';
import { mapPalette, schematicLineColor } from './map-palette.js';
import { deduplicateMapPoints, sameMapPoint } from './map-point-dedup.js';
import { mapLevelPolicy, mapPointRole, mapRolePriority } from './map-levels.js';
import { isLivingArea, livingAreaMapVisible } from './living-area-map.js';
import { isHiddenPlace } from './place-hidden.js';

const categoryColors = Object.fromEntries([
  [['商', '超', '便', '书', '店', '服'], '#b46791'], [['食', '咖', '包', '酒'], '#b66b36'],
  [['园', '地'], '#3f8a60'], [['景'], '#3a8698'], [['馆', '图', '艺'], '#527cac'],
  [['游', '剧', '歌'], '#9261a8'], [['体'], '#3b9398'], [['社', '寺', '宗'], '#b75c55'],
  [['大', '校'], '#687eab'], [['医', '政', 'svc'], '#6b8c84'], [['宿'], '#8b72a5'],
  [['交', 'bus'], '#628b97'], [['办', '住', '工', '建', 'other'], '#85847b'],
].flatMap(([ids, color]) => ids.map(id => [id, color])));
const nightIconColors = Object.fromEntries(Object.entries(categoryColors).map(([id, color]) => [id,
  '#' + color.slice(1).match(/../g).map(channel => Math.round(parseInt(channel, 16) * 0.7 + 255 * 0.3).toString(16).padStart(2, '0')).join('')]));

// LJ-NATIONAL-MAP-01: canvas viewport; selection and name append are separate actions.
export function createNationalMap(container, { catalog, onSelect = () => {}, onAppend = () => {}, onError = () => {}, onViewChange = () => {}, onPickPosition = () => {} } = {}) {
  if (!container || !catalog) throw new Error('地图缺少容器或资料目录');
  const canvas = container.ownerDocument.createElement('canvas');
  canvas.setAttribute('aria-label', 'Living Japan 地图，可拖动、缩放和选择地点');
  canvas.setAttribute('role', 'img');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none', cursor: 'grab' });
  if (!container.style.position) container.style.position = 'relative';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d'), handlers = [], paths = new Map(), overlayPaths = new Map(), touches = new Map();
  let width = 800, height = 500, center = [0, 0], scale = 1, detail = 'standard', mode = 'detail', code = 'metro', map = null, focusRegionCode = null;
  let selected = null, route = [null, null], routeEstimate = null, visible = [], roads = [], dead = false, regionEpoch = 0, viewEpoch = 0, pendingRefresh = null, frame = null;
  let presentationAnchors = new Map(), anchorPairs = new Map();
  const renderedRegionIds = new Set();
  // LJ-DISTRICT-LABELS-20261031: readable district names share one anchor slot and last four zoom steps beyond ordinary street detail.
  const pairOf = entity => anchorPairs.get(entity?.id) || anchorPairs.get(entity?.legacyPlaceId);
  const displayEntity = entity => { if (isLivingArea(entity)) return entity; const pair = pairOf(entity); return pair ? mapLevelPolicy(mode, scale).regionAnchor ? pair.anchor : pair.region : entity; };
  const anchorOf = entity => pairOf(entity) ? displayEntity(entity) : presentationAnchors.get(entity?.id) || presentationAnchors.get(entity?.legacyPlaceId);
  const roleOf = entity => { if (entity?.livingAreaRole === 'large') return 'region'; const role = mapPointRole(anchorOf(entity) || entity); return pairOf(entity) && mapLevelPolicy(mode, scale).regionAnchor && role === 'ordinary' ? 'featured' : role; };
  const displayName = entity => { const row = anchorOf(entity) || entity; return roleOf(entity) === 'region' ? mapLevelPolicy(mode, scale).near ? row.name : row.shortName || row.name : entity.name; };
  let drag = null, lastTouch = null, pinch = null, suppressDoubleClickUntil = 0, refreshDeferred = false, labelHits = [];
  let labelCandidates = [], markerRects = [], shownLabelKeys = new Set(), wheelActive = false;
  let overlays = null, overviewLand = [], overviewPromise, theme = 'day', palette = mapPalette(theme);
  let pointVisibility = normalizeMapPointVisibility(), visibilityKey = JSON.stringify(pointVisibility);
  let hasSize = false, pendingFit = null, outline = null, locateEpoch = 0;
  let searchResults = [], searchHits = [], pendingSearchResults = null;
  // LJ-PLACE-MAP-EDIT-20261102: hidden markers stay out of every point layer; picks remain draft-only.
  let hiddenIds=[],hiddenData={},positionPicking=false,pickedPosition=null;
  const hidden=entity=>isHiddenPlace(entity,hiddenIds,hiddenData)||isHiddenPlace(pairOf(entity)?.region,hiddenIds,hiddenData)||isHiddenPlace(pairOf(entity)?.anchor,hiddenIds,hiddenData);
  let paintedView = null, dragPreview = null, framePreview = false;
  const frameRequest = globalThis.requestAnimationFrame || (fn => setTimeout(fn, 16));
  const frameCancel = globalThis.cancelAnimationFrame || clearTimeout;
  const project = value => {
    const point = projectCoordinates(Array.isArray(value) ? { longitude: value[0], latitude: value[1] } : value, catalog.projection());
    return point?.every(Number.isFinite) ? point : null;
  };
  const xy = entity => {
    const anchor = anchorOf(entity);
    if (mode === 'schem' && map?.schematic) {
      const target = pairOf(entity)?.anchor || entity;
      const station = map.schematic.stations.find(s => s.id === target?.id || s.id === target?.legacyPlaceId);
      if (station) return [station.x, station.y];
      if (map.schematic.coordinateSystem !== 'national-projection') return null;
    }
    return project(anchor?.displayAnchorCoordinates || entity?.displayAnchorCoordinates || entity?.coordinates || anchor?.coordinates);
  };
  const screen = point => [(point[0] - center[0]) * scale + width / 2, (point[1] - center[1]) * scale + height / 2];
  const world = point => [(point[0] - width / 2) / scale + center[0], (point[1] - height / 2) / scale + center[1]];
  const bounds = () => [center[0] - width / scale / 2, center[1] - height / scale / 2, center[0] + width / scale / 2, center[1] + height / scale / 2];
  const localPoint = event => { const r = dragPreview?.rect || canvas.getBoundingClientRect(); return [event.clientX - r.left, event.clientY - r.top]; };
  const path = (d, cache = paths) => { if (typeof Path2D === 'undefined') return null; if (!cache.has(d)) cache.set(d, new Path2D(d)); return cache.get(d); };
  function drawPath(record, fill, stroke, strokeWidth, cache = paths) {
    // LJ-MAP-VIEWPORT-GEOMETRY-20261031: preserve source bounds and skip only offscreen geometry.
    const b = record.b, view = bounds(), margin = strokeWidth / scale;
    if (b && (b[2] < view[0] - margin || b[0] > view[2] + margin || b[3] < view[1] - margin || b[1] > view[3] + margin)) return;
    const p = path(record.d, cache); if (!p) return;
    if (fill) { ctx.fillStyle = fill; ctx.fill(p); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth / scale; ctx.stroke(p); }
  }
  // LJ-MAP-STABLE-LABELS-20261031: fixed positions share measured collision space; gestures only retain existing names until settled.
  const overlaps = (a, b) => a.left < b.right + 2 && a.right > b.left - 2 && a.top < b.bottom + 2 && a.bottom > b.top - 2;
  function paintLabels() {
    const placed = [], next = new Set(), interacting = touches.size > 0 || wheelActive;
    // LJ-MAP-CLOSE-ICON-SPACE-20261101: close ultra icons take space before unselected names.
    const iconsFirst = mode === 'ultra' && mapLevelPolicy(mode, scale).close;
    labelCandidates.sort((a, b) => a.priority - b.priority || a.rank - b.rank || Number(shownLabelKeys.has(b.key)) - Number(shownLabelKeys.has(a.key)) || a.key.localeCompare(b.key));
    for (const candidate of labelCandidates) {
      if (next.has(candidate.key)) continue;
      if (interacting && !candidate.active && !shownLabelKeys.has(candidate.key)) continue;
      if ((candidate.entity?.livingAreaRole === 'large' || iconsFirst && !candidate.active) && markerRects.some(rect => rect.id !== candidate.entity?.id && overlaps(candidate.rect, rect))) continue;
      if (placed.some(rect => overlaps(candidate.rect, rect))) continue;
      placed.push(candidate.rect); next.add(candidate.key); candidate.draw();
      if (candidate.entity) {
        labelHits.push({ entity: candidate.entity, ...candidate.rect });
        if (roleOf(candidate.entity) === 'region' && !candidate.active) renderedRegionIds.add(candidate.entity.id);
      }
    }
    shownLabelKeys = next;
  }
  function displayPoints() {
    const eligible = entity => entity && !hidden(entity) && livingAreaMapVisible(entity, bounds()) && (roleOf(entity) === 'region' || isMapPointVisible(entity, pointVisibility)) && xy(entity);
    const active = deduplicateMapPoints([selected, ...route].map(displayEntity).filter(eligible));
    const ordinary = deduplicateMapPoints([...active, ...visible.map(displayEntity).filter(eligible)]).slice(active.length);
    return [...ordinary.sort((a, b) => {
      const left = pairOf(a)?.region || anchorOf(a) || a, right = pairOf(b)?.region || anchorOf(b) || b, roleOrder = mapRolePriority(left) - mapRolePriority(right);
      return roleOrder || (mapPointRole(left) === 'region' ? (left.displayPriority ?? 1000) - (right.displayPriority ?? 1000) || a.id.localeCompare(b.id) : 0);
    }).map(entity => ({ entity, active: false })), ...active.reverse().map(entity => ({ entity, active: true, isSelected: sameMapPoint(entity, displayEntity(selected)),
      roles: route.map((endpoint, i) => sameMapPoint(entity, displayEntity(endpoint)) ? i ? '终点' : '起点' : '').filter(Boolean) }))];
  }
  // LJ-MAP-VISUAL-20261031: reference zoom bands share screen-size markers and matching hit targets.
  const markerRadius = (role, active, policy) => role === 'region' ? 0 : role === 'featured' || mode === 'ultra' && role === 'ordinary' ? policy.close ? 11 : 9 : active ? 7 :
    role === 'station' ? policy.close ? 4.2 : 3.5 : policy.close ? 7 : 5.2;
  function dot(entity, active = false, label = false, color = null, text = displayName(entity) || '', isSelected = false) {
    if (!livingAreaMapVisible(entity, bounds())) return;
    const role = roleOf(entity), policy = mapLevelPolicy(mode, scale);
    if (role !== 'region' && !isMapPointVisible(entity, pointVisibility)) return;
    const p = xy(entity); if (!p) return;
    const [x, y] = screen(p); if (x < -200 || y < -30 || x > width + 200 || y > height + 30) return;
    const radius = markerRadius(role, active, policy);
    if (radius > 0) markerRects.push({ id: entity.id, left: x - radius, right: x + radius, top: y - radius, bottom: y + radius });
    ctx.fillStyle = color || (active ? palette.selected : role === 'featured' ? '#e4572e' : role === 'station' || role === 'region' ? palette.station : palette.point);
    if (role === 'featured' || mode === 'ultra' && role === 'ordinary') {
      // LJ-FEATURED-PICTOGRAMS-20261031: curated landmarks retain their real category drawing, including selection.
      const category = metroMapPointAppearance(entity)?.category || mapPointCategoryIds(entity)[0];
      const iconColors = theme === 'night' ? nightIconColors : categoryColors;
      const iconColor = iconColors[category] || iconColors.other;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = palette.halo; ctx.fill(); ctx.strokeStyle = active ? color || palette.selected : iconColor; ctx.lineWidth = active ? 2 : 1; ctx.stroke();
      drawMapPointIcon(ctx, mapPointIconId(entity), x, y, radius * 2 - 4, iconColor);
    } else if (role === 'ordinary' && !active) {
      // LJ-METRO-CATEGORIES-20261031: precise metro uses share existing marker geometry and palette.
      const metroAppearance = metroMapPointAppearance(entity);
      const category = metroAppearance?.category || mapPointCategoryIds(entity)[0], glyph = metroAppearance?.glyph || (category?.length === 1 ? category : category === 'bus' ? '交' : category === 'svc' ? '服' : '·');
      ctx.fillStyle = categoryColors[category] || categoryColors.other; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `${policy.close ? 11 : 8}px system-ui, sans-serif`; ctx.fillText(glyph, x - ctx.measureText(glyph).width / 2, y + (policy.close ? 4 : 3));
    } else if (role !== 'region') {
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (role === 'station' && !active) { ctx.fillStyle = palette.halo; ctx.fill(); ctx.strokeStyle = palette.station; ctx.lineWidth = 1.5; ctx.stroke(); }
      else { ctx.fill(); ctx.strokeStyle = palette.halo; ctx.lineWidth = 2; ctx.stroke(); }
    }
    if (label || active) {
      const livingArea = entity.livingAreaRole === 'large';
      const fontSize = livingArea ? 16 : active ? 13 : role === 'region' ? 16 : policy.close ? role === 'ordinary' ? 14 : 15 : role === 'ordinary' ? 11 : role === 'station' ? 12 : 13;
      const font = `${!active && (role === 'region' || role === 'featured' || policy.close) ? '600 ' : ''}${fontSize}px system-ui, sans-serif`;
      ctx.font = font;
      const offset = Math.max(13, radius + 6);
      const textWidth = ctx.measureText(text).width;
      const positions = livingArea ? [[x + offset, y], [x - textWidth - offset, y], [x - textWidth / 2, y - 24], [x - textWidth / 2, y + 24]] : [[x + offset, y]];
      for (const [left, baseline] of positions) {
      const labelRect = { entity, left: left - 4, right: left + textWidth + 4, top: role === 'region' ? baseline - 14 : baseline - Math.max(12, fontSize - 3), bottom: baseline + (role === 'region' ? 13 : 11) };
      labelCandidates.push({ key: entity.id, entity, active, rect: labelRect, priority: livingArea ? 6 : active ? isSelected ? -2 : -1 : ({ region: 0, featured: 1, station: 2, ordinary: 3 })[role], rank: role === 'region' ? (anchorOf(entity) || entity).displayPriority ?? 1000 : 0, draw() {
        ctx.font = font;
        if (active && role !== 'region') { ctx.fillStyle = palette.selectedSurface; ctx.fillRect(left - 4, baseline - 10, textWidth + 8, 21); }
        else { ctx.strokeStyle = palette.halo; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeText(text, left, baseline + 5); }
        ctx.fillStyle = active ? palette.selectedText : role === 'featured' ? theme === 'night' ? '#ff8a65' : '#b8401f' : palette.text; ctx.fillText(text, left, baseline + 5);
      } });
      }
    }
  }
  // LJ-MAP-SEARCH-PAGE-20261101: one current-page layer keeps list numbers at their actual positions, outside ordinary point sampling.
  const geographicView = () => mode !== 'schem' || map?.schematic?.coordinateSystem === 'national-projection';
  const searchPoints = (rows = searchResults) => rows.map((entity, index) => ({ entity, number: index + 1,
    point: project(entity?.coordinates) || project(entity?.displayAnchorCoordinates) }))
    .filter(row => row.point && !hidden(row.entity) && !isLivingArea(row.entity) && isMapPointVisible(row.entity, pointVisibility));
  function setSearchResults(rows = []) {
    const next = [...rows];
    if (touches.size && next.length) pendingSearchResults = next;
    else {
      const append = next.length >= searchResults.length && searchResults.every((entity, index) => entity.id === next[index]?.id);
      pendingSearchResults = null; searchResults = next;
      if (!next.length || !append) { searchHits = []; canvas.dataset.searchMarkerCount = '0'; }
      schedule();
    }
    return { total: next.length, located: searchPoints(next).length };
  }
  async function fitSearchResults() {
    const rows = searchPoints(); if (!rows.length || !map) return false;
    if (!geographicView()) setMode('detail');
    const xs = rows.map(row => row.point[0]), ys = rows.map(row => row.point[1]);
    outline = null; fit([Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1]);
    scale = Math.min(120, scale); changed(); await refresh(); return true;
  }
  function drawSearchResults() {
    if (geographicView()) for (const { entity, number, point } of searchPoints()) {
      const [x, y] = screen(point), text = String(number), radius = Math.max(12, text.length * 4 + 4);
      if (x < -radius || x > width + radius || y < -radius || y > height + radius) continue;
      searchHits.push({ entity, x, y, radius });
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = palette.selected; ctx.fill();
      ctx.strokeStyle = palette.halo; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = '600 12px system-ui, sans-serif'; ctx.fillStyle = palette.halo;
      ctx.fillText(text, x - ctx.measureText(text).width / 2, y + 4);
    }
    canvas.dataset.searchMarkerCount = String(searchHits.length);
  }
  function render() {
    frame = null; framePreview = false; if (dead) return;
    if (dragPreview) canvas.style.transform = '';
    labelHits = []; labelCandidates = []; markerRects = []; searchHits = []; canvas.dataset.searchMarkerCount = '0'; renderedRegionIds.clear();
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height); ctx.fillStyle = palette.sea; ctx.fillRect(0, 0, width, height);
    if (!map) return;
    ctx.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * (width / 2 - center[0] * scale), ratio * (height / 2 - center[1] * scale));
    if (mode !== 'schem') {
      const detailedCodes = new Set((map.land || []).map(land => String(land.code || '').slice(0, 2)));
      for (const land of overviewLand) if (!detailedCodes.has(land.code)) drawPath(land, palette.land, null, 0);
      for (const land of map.land || []) drawPath(land, palette.land, null, 0);
    }
    if (mode === 'schem' && map.schematic) {
      for (const line of map.schematic.lines) {
        ctx.beginPath(); line.points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (line.closed) ctx.closePath();
        ctx.strokeStyle = schematicLineColor(line.color, theme); ctx.lineWidth = 3 / scale; ctx.lineJoin = 'round'; ctx.stroke();
      }
    } else {
      if (mode !== 'schem') {
        for (const park of map.parks || []) drawPath(park, palette.park, null, 0);
        for (const river of (map.rivers || []).filter(r => mode !== 'map' || !r.w || r.w >= 4)) drawPath(river, null, palette.river, 1.6);
      }
      const usePbf = mode !== 'schem' && map.pbfRailways;
      const rails = usePbf ? [] : mode === 'map' ? (map.railways || []).filter(r => /山手|中央|東海道|东海道|東北|东北|総武|总武|京浜|京滨/.test(r.n)) : map.railways || [];
      for (const rail of rails) drawPath(rail, null, rail.c ? schematicLineColor(rail.c, theme) : palette.rail, mode === 'schem' ? 2.4 : 0.8);
      if (mode === 'ultra') for (const road of roads) drawPath(road, null, palette.road, 1);
      // LJ-PBF-RENDER-01: verified lines replace old rail strokes; viewport paths are disposable.
      if (mode !== 'schem') {
        for (const boundary of overlays?.boundaries || []) drawPath(boundary, null, boundary.adminLevel === 4 ? palette.boundary : palette.minorBoundary, boundary.adminLevel === 4 ? 0.9 : 0.6, overlayPaths);
        if (usePbf && overlays?.railwaysActive) for (const rail of overlays.railways) {
          const color = { rail: palette.rail, subway: palette.subway, light_rail: palette.lightRail, tram: palette.tram }[rail.kind] || palette.rail;
          const branch = rail.service && rail.service !== 'main';
          drawPath(rail, null, branch ? palette.branch : color, branch ? 0.55 : rail.kind === 'subway' ? 1.1 : 0.9, overlayPaths);
        }
      }
    }
    if (outline && (mode !== 'schem' || map.schematic?.coordinateSystem === 'national-projection')) drawPath(outline, null, theme === 'night' ? '#ffca70' : '#b83f22', 2);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.font = '13px system-ui, sans-serif'; ctx.textBaseline = 'alphabetic';
    if (mode !== 'schem') {
      ctx.font = '12px system-ui, sans-serif';
      for (const label of map.labels || []) {
        const [x, y] = screen([label.x, label.y]), text = label.n || '';
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > width - 25 || y < 14 || y > height) continue;
        const rect = { left: x - 2, right: x + ctx.measureText(text).width + 2, top: y - 12, bottom: y + 3 };
        labelCandidates.push({ key: `admin:${label.n}:${label.x}:${label.y}`, rect, priority: 4, rank: 0, draw() { ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = palette.boundary; ctx.fillText(text, x, y); } });
      }
      for (const park of pointVisibility.园 ? map.parks || [] : []) {
        if (!park.n || !Number.isFinite(park.x) || !Number.isFinite(park.y) || park.a * scale * scale < 500 || (mode === 'map' && park.a < 300)) continue;
        const [x, y] = screen([park.x, park.y]); if (x < 0 || x > width || y < 0 || y > height) continue;
        const textWidth = ctx.measureText(park.n).width, left = x - textWidth / 2;
        const rect = { left: left - 2, right: left + textWidth + 2, top: y - 10, bottom: y + 8 };
        labelCandidates.push({ key: `park:${park.n}:${park.x}:${park.y}`, rect, priority: 5, rank: 0, draw() { ctx.font = '12px system-ui, sans-serif'; ctx.strokeStyle = palette.halo; ctx.lineWidth = 3; ctx.strokeText(park.n, left, y + 5); ctx.fillStyle = palette.parkText; ctx.fillText(park.n, left, y + 5); } });
      }
    }
    const displayed = displayPoints();
    const endpointPosition = endpoint => xy(displayed.find(entry => sameMapPoint(entry.entity, endpoint))?.entity || endpoint);
    const a = endpointPosition(route[0]), b = endpointPosition(route[1]);
    const geometry = routeEstimate?.ok ? routeEstimate.railPath?.geometryPaths || [] : [];
    if (geometry.length && (mode !== 'schem' || map.schematic?.coordinateSystem === 'national-projection')) {
      // LJ-MAP-RAIL-HIGHLIGHT-20261031: restore the original cased purple route along the actual rail geometry.
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const points of geometry) {
        ctx.beginPath(); points.forEach((point, i) => { const p = projectCoordinates({ longitude: point[0], latitude: point[1] }, catalog.projection()); if (!p) return; const [x, y] = screen(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.strokeStyle = theme === 'night' ? '#192a30' : '#fffdf6'; ctx.lineWidth = 10; ctx.globalAlpha = 0.96; ctx.stroke();
        ctx.strokeStyle = theme === 'night' ? '#b28cff' : '#7c3aed'; ctx.lineWidth = 6; ctx.globalAlpha = 0.94; ctx.stroke();
      }
      ctx.restore();
    } else if (a && b) {
      const [ax, ay] = screen(a), [bx, by] = screen(b); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.strokeStyle = palette.route; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = palette.route; ctx.fillText('端点连线', (ax + bx) / 2 + 5, (ay + by) / 2 - 5);
    }
    const policy = mapLevelPolicy(mode, scale);
    const activePoints = displayed.filter(entry => entry.active).map(entry => ({ ...entry, text: entry.roles.length ? `${entry.roles.join(' / ')} · ${displayName(entry.entity)}` : displayName(entry.entity) }));
    const namesVisible = mode === 'schem' || mode !== 'map' && policy.near;
    for (const { entity: e, active } of displayed) {
      if (active) continue;
      dot(e, false, roleOf(e) === 'region' || Boolean(pairOf(e)) || namesVisible);
    }
    for (const { entity: e, text, isSelected } of activePoints) dot(e, true, true, isSelected ? null : palette.endpoint, text, isSelected);
    paintLabels();
    drawSearchResults();
    if(positionPicking&&pickedPosition){const p=project(pickedPosition);if(p){const [x,y]=screen(p);ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle=palette.selected;ctx.fill();ctx.strokeStyle=palette.halo;ctx.lineWidth=3;ctx.stroke();ctx.beginPath();ctx.moveTo(x-17,y);ctx.lineTo(x+17,y);ctx.moveTo(x,y-17);ctx.lineTo(x,y+17);ctx.strokeStyle=palette.selected;ctx.lineWidth=2;ctx.stroke();}}
    paintedView = { center: [...center], scale };
    if (dragPreview) dragPreview.center = [...center];
  }
  // LJ-MAP-DRAG-PREVIEW-20261101: reuse the painted frame; bounded rebases keep its center covered during long drags.
  function beginDragPreview() {
    if (dragPreview || !map || !paintedView) return;
    if (frame != null) { frameCancel(frame); frame = null; }
    if (paintedView.scale !== scale) render();
    dragPreview = { center: [...paintedView.center], rect: canvas.getBoundingClientRect() };
    canvas.style.willChange = 'transform';
    if (pendingRefresh) { clearTimeout(pendingRefresh); pendingRefresh = null; }
    ++viewEpoch; catalog.cancelViewport?.('map-viewport');
  }
  function endDragPreview(commit = false) {
    if (!dragPreview) return false;
    if (frame != null) { frameCancel(frame); frame = null; }
    dragPreview = null; canvas.style.transform = ''; canvas.style.willChange = '';
    if (commit) render();
    return true;
  }
  function paintDragPreview() {
    frame = null; framePreview = false; if (dead) return;
    if (!dragPreview) { render(); return; }
    const x = (dragPreview.center[0] - center[0]) * scale, y = (dragPreview.center[1] - center[1]) * scale;
    if (Math.abs(x) > width / 4 || Math.abs(y) > height / 4) { render(); return; }
    canvas.style.transform = `translate(${x}px, ${y}px)`;
  }
  function schedule(previewOnly = false) {
    if (dead) return;
    if (frame != null) { if (previewOnly || !framePreview) return; frameCancel(frame); }
    framePreview = previewOnly; frame = frameRequest(previewOnly ? paintDragPreview : render);
  }
  async function refresh() {
    if (!map || dead) return;
    if (touches.size) { refreshDeferred = true; return; }
    const epoch = ++viewEpoch, region = code, rect = bounds();
    try {
      if (mode === 'schem' && map.schematic) {
        catalog.cancelViewport?.('map-viewport');
        const presentation = map.presentation || {}, landmarkIds = new Set(presentation.schematicLandmarkIds || []);
        const anchors = [...(presentation.regions || []), ...(presentation.featured || []).filter(row => landmarkIds.has(row.id))].map(row => ({ ...(row.mapRole === 'region' ? catalog.schematicEntity?.(row.id, row) || row : catalog.get?.(row.id) || row), mapRole: row.mapRole, canonicalIndexOnly: row.mapRole !== 'region' }));
        visible = [...anchors, ...map.schematic.stations.map(s => { const fallback = { id: s.id, legacyPlaceId: s.id, name: s.name, type: '车站', coordinates: { x: s.x, y: s.y } }; return catalog.schematicEntity?.(s.id, fallback) || fallback; })]; roads = []; schedule(); return;
      }
      const result = await catalog.viewport(region, rect, { detail, mode, focusRegionCode, scale, pointVisibility, requestScope: 'map-viewport', limit: detail === 'detailed' ? 1000 : detail === 'fine' ? 700 : 350 });
      if (dead || epoch !== viewEpoch || region !== code) return;
      if (touches.size) { refreshDeferred = true; return; }
      visible = result.entities; roads = result.roads || [];
      if (!overlays?.cacheKey || overlays.cacheKey !== result.overlays?.cacheKey) overlayPaths.clear();
      overlays = result.overlays || null; schedule();
    } catch (error) { if (!dead && epoch === viewEpoch) onError(error); }
  }
  function getView() { return { regionCode: code, center: [...center], scale, detail, mode, selectedId: selected?.id || null, outlineId: outline?.id || null }; }
  function changed(draw = true) {
    ++viewEpoch; if (map && hasSize) onViewChange(getView()); if (draw) schedule(Boolean(dragPreview));
    if (pendingRefresh) { clearTimeout(pendingRefresh); pendingRefresh = null; }
    if (!dragPreview) pendingRefresh = setTimeout(() => { pendingRefresh = null; wheelActive = false; refresh(); }, 100);
  }
  function resize() {
    const box = container.getBoundingClientRect(); if (!(box.width > 0 && box.height > 0)) return;
    endDragPreview(); paintedView = null;
    width = box.width; height = box.height; hasSize = true;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    if (pendingFit) { const area = pendingFit; pendingFit = null; fit(area); } else changed();
  }
  // LJ-MAP-TOKYO-HOME-20261031: Tokyo is the subject; nearby Kawasaki and the edges of Yokohama and Chiba remain in the frame.
  function fit(area) {
    if (!map) return;
    endDragPreview();
    area ||= mode === 'schem' && map.schematic && map.schematic.coordinateSystem !== 'national-projection' ? map.schematic.bounds : code === 'metro' ? [14, -222, 1125, 1077] : map.defaultBounds || map.bounds || [0, 0, 1000, 1000];
    if (!hasSize) { pendingFit = area; return; }
    const [x1, y1, x2, y2] = area;
    center = [(x1 + x2) / 2, (y1 + y2) / 2]; scale = Math.max(0.0001, Math.min(width / Math.max(1, x2 - x1), height / Math.max(1, y2 - y1)) * 0.92); changed();
  }
  function zoom(delta, anchor = [width / 2, height / 2]) {
    endDragPreview();
    const before = world(anchor); scale = Math.max(0.0001, Math.min(120, scale * Math.exp(delta * 0.25)));
    const after = world(anchor); center[0] += before[0] - after[0]; center[1] += before[1] - after[1]; changed();
  }
  function hit(point) {
    for (let i = searchHits.length - 1; i >= 0; i--) {
      const row = searchHits[i]; if (Math.hypot(row.x - point[0], row.y - point[1]) <= row.radius) return row.entity;
    }
    const displayed = displayPoints().filter(entry => entry.active || roleOf(entry.entity) !== 'region' || renderedRegionIds.has(entry.entity.id)).reverse();
    for (const { entity: e, active } of displayed) {
      if (!active) continue;
      const label = labelHits.findLast(item => item.entity.id === e.id);
      if (label && point[0] >= label.left && point[0] <= label.right && point[1] >= label.top && point[1] <= label.bottom) return e;
      const p = xy(e); if (!p || roleOf(e) === 'region') continue;
      const s = screen(p), radius = markerRadius(roleOf(e), true, mapLevelPolicy(mode, scale));
      if (Math.hypot(s[0] - point[0], s[1] - point[1]) <= radius) return e;
    }
    for (let i = labelHits.length - 1; i >= 0; i--) {
      const label = labelHits[i];
      if (roleOf(label.entity) !== 'region') continue;
      const entry = displayed.find(item => item.entity.id === label.entity.id);
      if (entry && point[0] >= label.left && point[0] <= label.right && point[1] >= label.top && point[1] <= label.bottom) return entry.entity;
    }
    for (const { entity: e, active } of displayed) {
      if (roleOf(e) === 'region') continue;
      const p = xy(e); if (!p) continue;
      const s = screen(p), role = roleOf(e), radius = Math.max(markerRadius(role, active, mapLevelPolicy(mode, scale)), role === 'featured' ? 7 : 0);
      if (Math.hypot(s[0] - point[0], s[1] - point[1]) <= radius) return e;
    }
    for (let i = labelHits.length - 1; i >= 0; i--) {
      const label = labelHits[i];
      const entry = displayed.find(item => item.entity.id === label.entity.id); if (!entry) continue;
      if (point[0] >= label.left && point[0] <= label.right && point[1] >= label.top && point[1] <= label.bottom) return entry.entity;
    }
    let closest = null, distance = 18;
    for (const { entity: e } of displayed) { if (roleOf(e) === 'region') continue; const p = xy(e); if (!p) continue; const s = screen(p), d = Math.hypot(s[0] - point[0], s[1] - point[1]); if (d < distance) { closest = e; distance = d; } }
    return closest;
  }
  function selectLocal(entity) { selected = entity; schedule(); onSelect(entity); }
  const listen = (name, handler, options) => { canvas.addEventListener(name, handler, options); handlers.push([name, handler, options]); };
  listen('wheel', event => { event.preventDefault(); wheelActive = true; zoom(-Math.sign(event.deltaY), localPoint(event)); }, { passive: false });
  listen('pointerdown', event => {
    const p = localPoint(event); touches.set(event.pointerId, p); canvas.setPointerCapture?.(event.pointerId);
    drag = { id: event.pointerId, start: p, point: p, moved: false }; canvas.style.cursor = 'grabbing';
    if (touches.size === 1) beginDragPreview();
    if (touches.size === 2) { endDragPreview(true); const [a, b] = [...touches.values()]; pinch = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; }
  });
  listen('pointermove', event => {
    if (!touches.has(event.pointerId)) return; const p = localPoint(event); touches.set(event.pointerId, p);
    if (touches.size === 2 && pinch) {
      const [a, b] = [...touches.values()], distance = Math.hypot(a[0] - b[0], a[1] - b[1]), middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (distance > 0 && pinch.distance > 0) zoom(Math.log(distance / pinch.distance) * 4, middle); pinch = { distance, center: middle }; if (drag) drag.moved = true; return;
    }
    if (drag?.id !== event.pointerId) return;
    beginDragPreview();
    if (Math.hypot(p[0] - drag.start[0], p[1] - drag.start[1]) > 4) drag.moved = true;
    center[0] -= (p[0] - drag.point[0]) / scale; center[1] -= (p[1] - drag.point[1]) / scale; drag.point = p; changed();
  });
  const pointerEnd = event => {
    const was = drag; touches.delete(event.pointerId); canvas.releasePointerCapture?.(event.pointerId); if (touches.size < 2) pinch = null;
    const committed = !touches.size && endDragPreview(true);
    if (was?.id === event.pointerId && !was.moved && event.type !== 'pointercancel') {
      if(positionPicking){const projection=catalog.projection(),[x,y]=world(localPoint(event));if(geographicView()&&projection?.xScale&&projection?.yScale){pickedPosition={longitude:(x-projection.xOffset)/projection.xScale,latitude:(y-projection.yOffset)/projection.yScale};schedule();onPickPosition({...pickedPosition});}}
      else {const entity = hit(localPoint(event)); if (entity) {
        selectLocal(entity);
        if (event.pointerType === 'touch') { const now = Date.now(); if (lastTouch?.id === entity.id && now - lastTouch.time < 350) { onAppend(entity); suppressDoubleClickUntil = now + 500; lastTouch = null; } else lastTouch = { id: entity.id, time: now }; }
      }}
    }
    drag = null; canvas.style.cursor = 'grab';
    if (!touches.size && (was?.moved || refreshDeferred || committed)) { refreshDeferred = false; changed(!committed); }
    if (!touches.size && pendingSearchResults !== null) { const rows = pendingSearchResults; pendingSearchResults = null; setSearchResults(rows); }
  };
  listen('pointerup', pointerEnd); listen('pointercancel', pointerEnd);
  listen('dblclick', event => { event.preventDefault(); if (positionPicking||Date.now() < suppressDoubleClickUntil) return; const entity = hit(localPoint(event)); if (entity) { selectLocal(entity); onAppend(entity); } });
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; observer?.observe(container);
  resize();
  async function setRegion(nextCode) {
    endDragPreview(); paintedView = null;
    const epoch = ++regionEpoch; code = String(nextCode).padStart(2, '0'); const requested = code; ++viewEpoch;
    ++locateEpoch; outline = null; pendingFit = null;
    map = null; visible = []; roads = []; labelHits = []; shownLabelKeys.clear(); wheelActive = false; overlays = null; overlayPaths.clear(); schedule();
    try {
      overviewPromise ||= Promise.resolve(catalog.landOverview?.() || []).then(land => { overviewLand = land; });
      const [result] = await Promise.all([catalog.loadRegion(requested), overviewPromise]); if (dead || epoch !== regionEpoch) return null;
      map = result.map; presentationAnchors = new Map([...(map.presentation?.regions || []), ...(map.presentation?.featured || [])].map(row => [row.id, row]));
      const realAnchors = new Map((map.presentation?.anchorPlaces || []).map(row => [row.id, row])); anchorPairs = new Map();
      for (const region of [...(map.presentation?.regions || [])].sort((a, b) => (a.displayPriority ?? 1000) - (b.displayPriority ?? 1000))) {
        const anchor = realAnchors.get(region.displayAnchorPlaceId); if (!anchor || !projectCoordinates(anchor.coordinates, catalog.projection())) continue;
        const pair = { region, anchor }; anchorPairs.set(region.id, pair);
        for (const id of [anchor.id, anchor.legacyPlaceId, ...(anchor.sourceIds || []), ...(anchor.allSourceIds || [])].filter(Boolean)) if (!anchorPairs.has(id)) anchorPairs.set(id, pair);
      }
      paths.clear(); visible = []; roads = []; fit(); await refresh(); return result;
    } catch (error) { if (!dead && epoch === regionEpoch) onError(error); throw error; }
  }
  function setMode(value) {
    if (!['schem', 'map', 'detail', 'ultra'].includes(value)) return;
    endDragPreview();
    // LJ-MAP-MODE-VIEW-20261031: same-projection modes keep their viewport; schematic only retains its original line and point layers.
    const coordinateChange = (mode === 'schem') !== (value === 'schem') && map?.schematic && map.schematic.coordinateSystem !== 'national-projection'; mode = value; ++viewEpoch; roads = []; overlays = null; overlayPaths.clear();
    if (coordinateChange) fit(); else changed(); refresh();
  }
  async function setPointVisibility(value) {
    const next = normalizeMapPointVisibility(value), key = JSON.stringify(next);
    if (key === visibilityKey) return;
    pointVisibility = next; visibilityKey = key; ++viewEpoch; labelHits = []; lastTouch = null;
    visible = visible.filter(entity => roleOf(entity) === 'region' || isMapPointVisible(entity, pointVisibility));
    if (pendingRefresh) { clearTimeout(pendingRefresh); pendingRefresh = null; }
    schedule(); await refresh();
  }
  async function locate(entity) {
    if (!entity || dead) return;
    endDragPreview();
    focusRegionCode = entity.regionCode;
    if (entity.regionCode && entity.regionCode !== code && !(code === 'metro' && ['11', '12', '13', '14'].includes(entity.regionCode))) { if (!(await setRegion(entity.regionCode))) return; }
    if (dead) return;
    const ticket = ++locateEpoch;
    if (entity.type === '行政区' || entity.source?.namespace === 'administration') {
      const boundary = await catalog.adminBoundary?.(entity.id); if (dead || ticket !== locateEpoch) return;
      if (!boundary) { onError(new Error('此行政区尚无可用的完整边界')); return; }
      if (mode === 'schem') setMode('detail');
      outline = boundary; fit(boundary.b); await refresh(); return;
    }
    outline = null;
    if (mode === 'schem' && map?.schematic && !presentationAnchors.has(entity.id) && !map.schematic.stations.some(s => s.id === entity.id || s.id === entity.legacyPlaceId)) setMode('detail');
    const p = xy(entity); if (p) { center = p; scale = Math.max(scale, mode === 'schem' ? 1 : 1.6); changed(); } await refresh();
  }
  return { setRegion,
    setHiddenPlaces(ids,data={}){hiddenIds=ids||[];hiddenData=data;endDragPreview();schedule();},
    setPositionPick(value,position=null){positionPicking=Boolean(value);pickedPosition=position;lastTouch=null;if(positionPicking&&!geographicView())setMode('detail');canvas.style.cursor=positionPicking?'crosshair':'grab';endDragPreview();schedule();},
    async select(entity, { locate: shouldLocate = true } = {}) {
      if (!entity) { selected = null; schedule(); return; }
      if (shouldLocate) await locate(entity); if (!dead) selectLocal(entity);
    },
    locate, setMode, setPointVisibility, setSearchResults, fitSearchResults,
    getSearchBounds: () => geographicView() ? bounds() : null,
    hasAnchor: entity => Boolean(xy(entity)),
    setTheme(value) { const next = value === 'night' ? 'night' : 'day'; if (next === theme) return; theme = next; palette = mapPalette(theme); schedule(); },
    setRoute(origin, destination, estimate = null) { route = [origin, destination]; routeEstimate = estimate; schedule(); }, zoom, fit,
    setDetail(value) { const names = { 0: 'overview', 1: 'standard', 2: 'fine', 3: 'detailed' }; detail = names[value] || (['overview', 'standard', 'fine', 'detailed'].includes(value) ? value : 'standard'); changed(); },
    getView,
    async setView(value) { endDragPreview(); if (value.regionCode && (value.regionCode !== code || !map)) await setRegion(value.regionCode); pendingFit = null; if (value.mode) mode = value.mode; if (Array.isArray(value.center)) center = [...value.center]; if (Number.isFinite(value.scale) && value.scale > 0) scale = value.scale; if (value.detail) detail = value.detail; outline = value.outlineId ? await catalog.adminBoundary?.(value.outlineId) || null : null; changed(); await refresh(); },
    destroy() { endDragPreview(); dead = true; ++regionEpoch; ++viewEpoch; observer?.disconnect(); if (frame != null) frameCancel(frame); if (pendingRefresh) clearTimeout(pendingRefresh); for (const args of handlers) canvas.removeEventListener(...args); canvas.remove(); paths.clear(); overlayPaths.clear(); overlays = null; visible = []; searchResults = []; searchHits = []; pendingSearchResults = null; map = null; } };
}
