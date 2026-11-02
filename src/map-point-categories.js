import { METRO_POINT_CATEGORIES, metroPointCategoryIds } from './metro-point-categories.js';
// LJ-MAP-POINT-CATEGORIES-01: display-only classifications shared by worker, map and settings.
export const MAP_POINT_CATEGORIES = [
  ['景', '景点'], ['馆', '博物馆'], ['社', '神社'], ['寺', '寺院'], ['大', '大学'],
  ['医', '医疗'], ['剧', '剧场'], ['商', '商场'], ['超', '超市'], ['图', '图书馆'],
  ['校', '学校'], ['便', '便利店'], ['咖', '咖啡'], ['包', '面包店'], ['书', '书店'],
  ['酒', '酒吧'], ['歌', '卡拉OK'], ['宿', '住宿'], ['食', '餐饮'], ['艺', '文化艺术'],
  ['游', '娱乐'], ['体', '体育'], ['园', '公园'], ['店', '商店'], ['宗', '宗教'],
  ['服', '服装店'], ['政', '公共服务'], ['办', '办公'], ['交', '交通'], ['住', '住宅'],
  ['工', '工业'], ['地', '地理地点'], ['建', '建筑'], ['bus', '公交站'],
  ['svc', '生活服务'], ['other', '未分类地点'],
].map(([id, label]) => ({ id, label }));

export const MAP_POINT_GROUPS = [
  { id: 'shopping', label: '购物与商店', categoryIds: ['商', '超', '便', '书', '店', '服'] },
  { id: 'food-drink', label: '餐饮与饮品', categoryIds: ['食', '咖', '包', '酒'] },
  { id: 'parks-nature', label: '公园与自然', categoryIds: ['园', '地'] },
  { id: 'sights', label: '景点与古迹', categoryIds: ['景'] },
  { id: 'culture', label: '文化与展馆', categoryIds: ['馆', '图', '艺'] },
  { id: 'entertainment', label: '娱乐与演出', categoryIds: ['游', '剧', '歌'] },
  { id: 'sports', label: '体育运动', categoryIds: ['体'] },
  { id: 'religion', label: '宗教场所', categoryIds: ['社', '寺', '宗'] },
  { id: 'education', label: '教育', categoryIds: ['大', '校'] },
  { id: 'services', label: '医疗与生活服务', categoryIds: ['医', '政', 'svc'] },
  { id: 'lodging', label: '住宿', categoryIds: ['宿'] },
  { id: 'transport', label: '交通设施', categoryIds: ['交', 'bus'] },
  { id: 'buildings', label: '建筑与生活空间', categoryIds: ['办', '住', '工', '建'] },
  { id: 'other', label: '未分类地点', categoryIds: ['other'] },
];

const categoryIds = new Set(MAP_POINT_CATEGORIES.map(category => category.id));
const typeCategories = new Map(MAP_POINT_CATEGORIES.map(category => [category.label, [category.id]]));
const baselineTypeLabels = {
  景: ['城址遗迹', '灯塔', '观景台', '历史建筑', '历史民居'],
  馆: ['船舶展示馆', '动物展示馆', '环境学习馆', '纪念馆', '科技品牌体验馆', '科学馆', '科学展示馆', '历史资料馆', '露天博物馆', '汽车展示体验馆', '水族馆', '天文馆', '天文台', '铁路体验馆', '植物馆', '资料馆'],
  剧: ['成人演艺剧场', '电影院', '爵士俱乐部', '演出场', '音乐厅', '音乐文化设施'],
  商: ['布料商业街', '餐饮器具商业街', '朝市', '地下街', '古书街', '户外用品购物园', '角色商品街', '乐器店街', '历史商业街', '门前商业街', '批发市场', '商业交通街区', '商业街区', '商业设施', '商业文化设施', '商业园区', '商业综合体', '生活用品商场', '市场', '手作商业街', '兴趣商品商场', '科研商业园区'],
  便: ['自贩机区'],
  咖: ['咖啡馆', '漫画咖啡馆', '桌游咖啡馆'],
  书: ['同人书店'],
  酒: ['啤酒馆'],
  宿: ['胶囊旅馆', '露营地', '旅馆'],
  食: ['餐饮街区', '餐饮商业设施', '主题餐厅'],
  艺: ['画廊', '会展中心', '美术馆', '设计展馆', '数字艺术展馆', '文化活动中心', '文化综合体', '商业文化设施', '艺术步道', '制作体验馆'],
  游: ['柏青哥店', '场外赛马设施', '电影体验馆', '动物园', '动物展示区', '儿童活动园', '公共浴场', '解谜游戏馆', '麻将馆', '桑拿设施', '数字游乐设施', '水上乐园', '网咖', '围棋活动场所', '温泉街区', '温泉浴场', '夜店', '游乐园', '游戏厅', '娱乐街区', '主题乐园', '综合游乐设施'],
  体: ['棒球场', '棒球打击场', '保龄球馆', '钓鱼场', '飞镖场', '高尔夫练习场', '滑冰场', '卡丁车赛场', '竞轮场', '赛马场', '赛艇场', '树上冒险场', '体育场', '体育馆', '相扑馆', '运动场', '运动公园', '足球场'],
  园: ['滨水步道', '滨水公共空间', '城址公园', '花田', '花园', '生态观察园', '庭园', '温室', '遗址公园', '艺术步道', '自然步道', '植物园', '运动公园'],
  店: ['唱片店', '电器商店', '动漫商店', '二手动漫商店', '画材店', '角色商品店', '乐器店', '模型店', '水族商店', '玩具店', '文具店', '园艺商店', '综合零售店'],
  政: ['市民活动中心'],
  办: ['科研园区', '科研商业园区'],
  交: ['地下通道', '观光缆车', '客船码头', '铁路沿线', '渔港', '商业交通街区'],
  住: ['住宅街区'],
  工: ['工业景观区'],
  地: ['潮滩', '岛屿', '港町街区', '港湾', '高原街区', '海岸', '海岬', '海滩', '海崖', '湖滨街区', '湖泊', '火山地景', '街区', '历史街区', '瀑布', '山地', '湿地', '田园', '岩岸景观', '渔港街区', '站前街区', '中心街区', '生活带'],
  建: ['水坝'],
};
for (const [id, labels] of Object.entries(baselineTypeLabels)) {
  for (const label of labels) typeCategories.set(label, [...new Set([...(typeCategories.get(label) || []), id])]);
}

const typesOf = target => String(target?.type || '').split('／').map(type => type.trim()).filter(Boolean);
const isBus = (target, types) => target?.subtype === 'bus_station' || target?.categoryCode === 'bus' || types.includes('公交站');
const isRail = (target, types) => target?.kind === 'station' || types.includes('车站') || ['train_station', 'light_rail_and_subway_station'].includes(target?.subtype);

export function normalizeMapPointVisibility(value) {
  return Object.fromEntries([...MAP_POINT_CATEGORIES, ...METRO_POINT_CATEGORIES.filter(({ id }) => Object.hasOwn(value || {}, id))]
    .map(({ id }) => [id, value?.[id] !== false]));
}

export function mapPointCategoryIds(target) {
  const types = typesOf(target);
  if (isBus(target, types)) return ['bus'];
  if (isRail(target, types)) return [];
  const metroIds = metroPointCategoryIds(target);
  if (metroIds.length) return metroIds;
  const ids = new Set(categoryIds.has(target?.categoryCode) ? [target.categoryCode] : []);
  for (const type of types) for (const id of typeCategories.get(type) || []) ids.add(id);
  return [...ids];
}

export function isMapPointVisible(target, visibility) {
  return mapPointCategoryIds(target).every(id => visibility?.[id] !== false);
}
