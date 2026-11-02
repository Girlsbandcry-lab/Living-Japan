import { BUILTIN_MATERIAL_CATEGORIES } from './material-catalog.js';
import { metroPurposeExtensions } from './metro-purpose-catalog.js';

const placeFamilies = new Set([
  'ex.residential', 'ex.commercial', 'ex.nightlife', 'ex.center', 'ex.historic', 'ex.industry',
  'ex.open-space', 'ex.streets', 'ex.rural', 'ex.waterfront', 'ex.architecture',
  'in.food', 'in.drinking', 'in.retail', 'in.specialty', 'in.culture', 'in.entertainment',
  'in.care-learning', 'in.education', 'in.health', 'in.public', 'in.transport',
  'in.living-work', 'in.leisure-faith', 'in.sports', 'in.religion',
]);
// LJ-MAP-ARCHITECTURE-20261031: prose materials stay in their catalog, outside map place controls.
const architectureMaterials = new Set([
  'height', 'wood', 'brick', 'concrete', 'glass', 'nagaya', 'machiya', 'mixed-use',
  'aged', 'renovated', 'roof', 'facade', 'windows', 'fences',
].map(id => `ex.architecture.${id}`));
export const METRO_POINT_CATEGORIES = [...BUILTIN_MATERIAL_CATEGORIES, ...metroPurposeExtensions]
  .filter(row => placeFamilies.has(row.id.split('.').slice(0, 2).join('.')) && !architectureMaterials.has(row.id))
  .map(({ id, name, parentId, layer }) => ({ id, label: id === 'ex.architecture' ? '建筑与构筑物' : name, parentId, layer }));
const byId = new Map(METRO_POINT_CATEGORIES.map(row => [row.id, row]));
const rootOf = row => row.parentId && byId.has(row.parentId) ? rootOf(byId.get(row.parentId)) : row;
export const METRO_POINT_GROUPS = METRO_POINT_CATEGORIES.filter(row => !row.parentId)
  .map(row => ({ id: row.id, label: row.label, layer: row.layer,
    categoryIds: METRO_POINT_CATEGORIES.filter(child => rootOf(child).id === row.id).map(child => child.id) }));

export function normalizeMetroPointVisibility(value) {
  return Object.fromEntries(METRO_POINT_CATEGORIES.map(({ id }) => [id, value?.[id] !== false]));
}

export function metroPointCategoryIds(target) {
  const path = target?.typePathIds;
  if (!Array.isArray(path) || !['layer:IN', 'layer:EX'].includes(path[0])) return [];
  const layer = path[0].slice(6);
  const leaf = path.findLast(id => byId.get(id)?.layer === layer);
  return leaf ? [leaf] : [];
}

const familyAppearances = {
  'ex.residential': ['住', '住'], 'ex.commercial': ['商', '街'], 'ex.nightlife': ['酒', '街'],
  'ex.center': ['建', '街'], 'ex.historic': ['景', '古'], 'ex.industry': ['工', '工'],
  'ex.open-space': ['园', '园'], 'ex.streets': ['交', '路'], 'ex.rural': ['地', '山'],
  'ex.waterfront': ['地', '水'], 'ex.architecture': ['建', '建'],
  'in.food': ['食', '食'], 'in.drinking': ['酒', '酒'], 'in.retail': ['店', '店'],
  'in.specialty': ['店', '店'], 'in.culture': ['艺', '艺'], 'in.entertainment': ['游', '游'],
  'in.care-learning': ['校', '育'], 'in.education': ['校', '校'], 'in.health': ['医', '医'],
  'in.public': ['政', '服'], 'in.transport': ['交', '交'], 'in.living-work': ['建', '建'],
  'in.leisure-faith': ['体', '休'], 'in.sports': ['体', '体'], 'in.religion': ['宗', '宗'],
};
const leafAppearances = {
  'in.food.cafe': ['咖', '咖'], 'in.food.sweets-bakery': ['包', '甜'],
  'in.retail.convenience': ['便', '便'], 'in.retail.supermarket': ['超', '超'],
  'in.retail.mall-department': ['商', '商'], 'in.specialty.books': ['书', '书'],
  'in.specialty.clothes': ['服', '服'], 'in.specialty.vintage': ['服', '衣'],
  'in.culture.museum': ['馆', '馆'], 'in.culture.history': ['馆', '史'],
  'in.culture.memorial': ['馆', '纪'], 'in.culture.science': ['馆', '科'],
  'in.culture.library': ['图', '图'], 'in.entertainment.theater': ['剧', '剧'],
  'in.entertainment.cinema': ['剧', '影'], 'in.entertainment.live-music': ['剧', '乐'],
  'in.entertainment.concert-hall': ['剧', '乐'], 'in.entertainment.nightclub': ['游', '夜'],
  'in.entertainment.karaoke': ['歌', '歌'], 'in.education.university': ['大', '大'],
  'in.sports.baths-onsen': ['体', '浴'], 'in.sports.sauna': ['体', '桑'],
  'in.sports.zoo-aquarium': ['体', '动'], 'in.sports.botanical': ['园', '植'],
  'in.sports.amusement-park': ['游', '游'], 'in.religion.shrine': ['社', '社'],
  'in.religion.temple': ['寺', '寺'],
};

export function metroMapPointAppearance(target) {
  const id = metroPointCategoryIds(target)[0];
  if (!id) return null;
  const lodging = id.startsWith('in.living-work.') && ['hotel-ryokan', 'capsule', 'hostel', 'guesthouse', 'camping'].includes(id.split('.')[2]);
  if (lodging) return { category: '宿', glyph: '宿' };
  for (let row = byId.get(id); row; row = byId.get(row.parentId)) {
    const appearance = leafAppearances[row.id] || familyAppearances[row.id];
    if (appearance) { const [category, glyph] = appearance; return { category, glyph }; }
  }
  return null;
}

export const metroMapPointGlyph = target => metroMapPointAppearance(target)?.glyph || null;
