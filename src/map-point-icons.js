import { METRO_POINT_CATEGORIES } from './metro-point-categories.js';
import { mapPointCategoryIds } from './map-point-categories.js';
import { metroPurposeNames } from './metro-purpose-catalog.js';
import { MAP_POINT_ICON_DETAILS } from './map-point-icon-details.js';
import { ICON_PICTURE_LABELS, ICON_WORD_LABELS } from './map-point-icon-semantics.js';
import { SOURCED_MAP_ICON_VECTORS } from './map-point-icon-vectors.js';

// LJ-ICON-REFINEMENT-20261031: approved exact-type words and official SVGs; marker shells stay with the map.
const circle = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
const icon = (label, ...paths) => Object.freeze({ label, paths: Object.freeze(paths) });
const word = (label, glyph) => Object.freeze({ label, glyph, paths: Object.freeze([]) });
const sourcedIcon = (label, source) => Object.freeze({ label, ...SOURCED_MAP_ICON_VECTORS[source] });
const symbolByLabel = new Map();
const words = {};
for (const [glyph, labels] of Object.entries(ICON_WORD_LABELS)) {
  const id = `word-${glyph}`;
  words[id] = word(labels.split('|')[0], glyph);
  for (const label of labels.split('|')) symbolByLabel.set(label, id);
}
for (const [id, labels] of Object.entries(ICON_PICTURE_LABELS)) {
  for (const label of labels.split('|')) symbolByLabel.set(label, id);
}
symbolByLabel.set('公共厕所', 'restroom');
for (const label of ICON_WORD_LABELS['仓'].split('|')) symbolByLabel.set(label, 'warehouse');
const usedSymbols = new Set(symbolByLabel.values());

export const MAP_POINT_ICONS = Object.freeze({
  ...Object.fromEntries(Object.entries(words).filter(([id]) => usedSymbols.has(id))),
  unknown: icon('用途待核', 'M12 4 20 12 12 20 4 12Z'),
  unmapped: icon('未分类地点', circle(12, 12, 5)),
  shoe: icon('鞋店', 'M3 6h6l2 7 9 3 1 5H3V6Zm0 11h17M10 10l-3 2'),
  suitcase: icon('箱包与皮具', 'M4 7h16v14H4V7Zm5 0V3h6v4M8 7v14m8-14v14'),
  glasses: icon('眼镜店', circle(6, 13, 4), circle(18, 13, 4), 'M10 13h4M2 12l1-7m19 7-1-7'),
  diamond: icon('珠宝店', 'M2 9 7 3h10l5 6-10 13L2 9Zm0 0h20M7 3l5 19L17 3M7 3l5 6 5-6'),
  blossom: icon('花店', circle(12, 10, 3), 'M9 8C2 2 11-1 12 5c1-6 10-3 3 3 8-1 6 9 0 5 4 7-6 8-5 1-6 4-10-5-1-6ZM12 16v6'),
  pencil: icon('文具店', 'M3 21l2-7L17 2l5 5-12 12-7 2Zm2-7 5 5M15 4l5 5'),
  phone: icon('手机店', 'M6 2h12v20H6V2Zm0 4h12M6 18h12M11 20h2'),
  computer: icon('电脑店', 'M2 3h20v14H2V3Zm10 14v4M7 21h10M5 13h14'),
  golf: icon('高尔夫', 'M10 20V2l10 4-10 4M3 21h18', circle(5, 18, 2)),
  bowling: sourcedIcon('保龄球', 'tabler-bowling'),
  billiards: icon('台球', circle(10, 14, 7), 'M3 3 21 21M8 11h4v6H8v-6Zm0 3h4'),
  baseball: icon('棒球', circle(12, 12, 9), 'M6 5c7 4 7 10 0 14M18 5c-7 4-7 10 0 14M7 8l3-2m-1 6h3m-5 4 3 2m7-10-3-2m1 6h-3m5 4-3 2'),
  football: icon('足球', circle(12, 12, 9), 'M12 7 17 11l-2 6H9l-2-6 5-4Zm0 0V3m5 8 4-2m-6 8 3 3m-9-3-3 3m1-9-4-2'),
  tennis: icon('网球', circle(12, 12, 9), 'M5 5c10 0 14 4 14 14M5 19c0-10 4-14 14-14'),
  clock: sourcedIcon('钟表店', 'lucide-watch'),
  sofa: icon('家具店', 'M5 12V6h14v6M2 10h4v6h12v-6h4v10H2V10Zm2 10v2m16-2v2'),
  hat: icon('帽子店', 'M6 15 8 4h8l2 11M2 15c0 7 20 7 20 0H2Zm5-4h10'),
  gift: icon('礼品店', 'M2 8h20v5H2V8Zm2 5v9h16v-9M12 8v14M12 8C1 8 5-3 12 8c7-11 11 0 0 0Z'),
  lipstick: icon('化妆品店', 'M6 10h10v12H6V10Zm2 0V5l6-3v8M6 15h10'),
  comb: icon('美发用品店', 'M3 6h18v4H3V6Zm0 4v8m4.5-8v8m4.5-8v8m4.5-8v8m4.5-8v8'),
  house: icon('住宅', 'M3 11 12 4 21 11M5 10v10h14V10M10 20v-6h4v6'),
  apartments: icon('集合住宅', 'M5 21V4h14v17M3 21h18M9 8h1m4 0h1M9 12h1m4 0h1M9 16h1m4 0h1'),
  skyline: icon('城市中心', 'M3 21V11h5V5h8v8h5v8M11 8h2m-2 4h2m-2 4h2M3 21h18'),
  'district-commerce': icon('商业街区', 'M2 10h8V6H2v4Zm12 0h8V6h-8v4ZM3 10v9h6v-9m6 0v9h6v-9M11 4h2v17'),
  'district-nightlife': icon('饮食与夜间街区', 'M2 9h8V5H2v4Zm1 0v10h6V9M15 6h6l-3 5-3-5Zm3 5v7m-3 0h6M11 3h1v18'),
  road: icon('道路', 'M7 3 4 21m13-18 3 18M12 4v3m0 4v3m0 4v3'),
  bridge: icon('桥梁', 'M2 15h20M4 15V8m16 7V8M4 9c4 7 12 7 16 0M8 12v3m4-1v1m4-3v3M3 20c2-2 4 2 6 0s4 2 6 0 4 2 6 0'),
  stairs: icon('阶梯与坡道', 'M3 20h5v-5h5v-5h5V5h3M3 5h9m-3-3 3 3-3 3'),
  junction: icon('路口', 'M3 8h5V3m8 0v5h5M3 16h5v5m8 0v-5h5'),
  tunnel: icon('地下通道', 'M3 20V10a9 9 0 0 1 18 0v10M7 20v-9a5 5 0 0 1 10 0v9M12 14v2m0 3v2'),
  tree: icon('公园绿地', 'M9 4 4 11h3l-4 6h5v4m4-4H3m10-7 4-6 4 6h-2l3 5h-4v6m-5-6h9'),
  garden: icon('庭园', 'M4 21h16M12 21V9m0 5c-6 0-8-4-8-7 5 0 8 3 8 7Zm0 3c6 0 8-4 8-7-5 0-8 3-8 7Z'),
  bench: icon('休憩空间', 'M4 8h16v6H4ZM3 17h18M6 17v4m12-4v4M6 14v3m12-3v3'),
  pavilion: icon('公共休憩亭', 'M3 9 12 3l9 6H3Zm3 0v11m12-11v11M3 21h18M6 17h12'),
  viewpoint: icon('观景点', 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z', circle(12, 12, 3)),
  playground: sourcedIcon('儿童游园', 'maki-playground'),
  mountain: icon('山地', 'M2 21 10 5l5 9 3-6 4 13H2Zm4-8 4-2 3 2'),
  forest: icon('森林步道', 'M7 3 2 11h3l-3 6h10l-3-6h3L7 3Zm0 14v4M17 5l-4 7h2l-2 5h9l-3-5h2l-4-7Zm0 12v4'),
  farmland: icon('农地', 'M3 12h18M3 17l7-5m1 9 6-9m3 9 1-9M7 9V3M4 5l3 2 3-2'),
  cave: icon('洞穴', 'M3 21 5 8l6-5 8 5 2 13H3Zm5 0v-8l4-4 4 4v8'),
  rocks: icon('岩石地景', 'M3 21 5 11l6-2 5 4 4-1 2 9H3ZM5 11l5 5 1 5m5-8-2 8'),
  waterfall: icon('瀑布', 'M3 4h8v13m4-13v11m4-11v15M8 4v10M3 21c2-2 4 2 6 0s4 2 6 0 4 2 6 0'),
  river: icon('河流', 'M7 3c8 4-8 10 0 18m10-18c8 4-8 10 0 18'),
  sea: icon('海岸与海面', 'M2 8c3-3 5 3 8 0s5 3 8 0 3 0 4 0M2 13c3-3 5 3 8 0s5 3 8 0 3 0 4 0M2 18c3-3 5 3 8 0s5 3 8 0 3 0 4 0'),
  lake: icon('湖泊', 'M4 7 8 4l5 2 5-1 3 5-2 7-5 3-7-1-4-6 1-6ZM7 12c2-2 3 2 5 0s3 2 5 0'),
  beach: icon('沙滩', 'M3 11a9 9 0 0 1 18 0H3Zm9-9v17m0-14c-3 2-3 4-3 6m3-6c3 2 3 4 3 6M2 21c3-2 5 2 8 0s5 2 8 0 3 0 4 0'),
  island: icon('岛屿', 'M2 19c3-2 5 2 8 0s5 2 8 0 3 0 4 0M5 15c4-4 10-4 14 0M12 14V6m0 2C7 3 5 5 4 7m8 1c3-6 7-5 8-2m-8 2c-5-2-7 0-7 2'),
  harbor: icon('港湾', 'M12 8v12M7 12H3c0 6 4 9 9 9s9-3 9-9h-4M3 12l-1 3m19-3 1 3M8 12h8', circle(12, 5, 3)),
  dam: icon('水坝与水门', 'M3 21 7 4h10l4 17M8 8h8m-9 5h10M10 17h4m-2-4v8M2 21c3-2 5 2 8 0s5 2 8 0 3 0 4 0'),
  building: icon('建筑', 'M4 21V5h16v16M2 21h20M8 9h2m4 0h2M8 13h2m4 0h2M10 21v-4h4v4'),
  tower: icon('塔楼', 'M5 21h14M9 21l1-11h4l1 11M7 7h10v3H7Zm5-5v5M9 4h6'),
  lighthouse: icon('灯塔', 'M7 21 9 10h6l2 11M8 6h8v4H8Zm1-3h6v3M2 7h3m14 0h3M8 16h8M5 21h14'),
  castle: word('城堡与城址', '堡'),
  ruins: icon('历史遗址', 'M3 21h18M5 21V8h4v5h4V5h6v16M5 8l2-4 2 4m4-3 3-2 3 2'),
  factory: icon('工厂', 'M3 21V11l6 3V9l6 3V4h4v17H3ZM7 17h1m4 0h1m4 0h1'),
  warehouse: word('仓库', '仓'),
  plate: icon('餐厅', circle(12, 12, 5), 'M3 3v7m-2-7v4a2 2 0 0 0 4 0V3M3 10v11M21 21V3c-3 1-3 8 0 8'),
  bowl: icon('食堂与定食', 'M3 11h18a9 9 0 0 1-18 0Zm5 9h8M6 4h13M5 7h14'),
  noodles: icon('面食', 'M3 12h18a9 9 0 0 1-18 0Zm5 8h8M7 9V3m4 6V3M4 5h14'),
  // LJ-FOOD-SUBJECT-ICONS-20261031: requested food subjects use the same exact culinary leaf inside and outside metro.
  tempura: icon('天妇罗虾',
    'M3 18c-2-1-1-4 1-4-1-2 1-4 3-3 0-3 3-4 5-2l-1 3c1 2-1 4-3 3 0 3-3 5-5 3Z',
    'M12 9V3c3 0 3 3 1 5m-1 1c3-4 5-4 6-2-1 2-3 3-6 3',
    'M9 20c-2-1-1-4 1-4-1-2 1-4 3-3 0-3 3-4 5-2l-1 3c1 2-1 4-3 3 0 3-3 5-5 3Z',
    'M18 11V5c3 0 3 3 1 5m-1 1c3-4 5-4 5-2-1 2-3 3-5 3M2 20c4 3 16 3 20-1'),
  unagi: word('鳗鱼料理', '鰻'),
  ramen: icon('拉面碗',
    'M3 12c1 7 4 9 9 9s8-2 9-9M3 12c0-4 18-4 18 0s-18 4-18 0Z',
    'M15 10l4-8m0 9 4-8M7 11c2-3 3 3 5 0m-5 3c2-3 3 3 5 0'),
  yakiniku: icon('日式烤肉网', circle(12, 12, 9),
    'M7 5v5m0 5v4m5-16v4m0 10v4m5-16v5m0 5v4M5 7h14M3 12h4m10 0h4M5 17h14',
    'M9 10c-3 0-3 5 0 5h4c4 0 5-5 1-5H9ZM10 12h3'),
  bbq: icon('火焰烧烤肉排',
    'M4 16c0-4 4-6 8-5l5 1c4 1 5 6 1 8l-7 1c-4 0-7-1-7-5ZM8 13l4 6m2-6 3 5',
    'M10 9c-4-2-1-5 0-7 0 3 3 3 4 5 1-1 2-2 2-3 3 5-1 7-6 5Z'),
  burger: icon('汉堡',
    'M3 10c0-9 18-9 18 0H3ZM3 15h18v4c-1 3-17 3-18 0v-4ZM2 12l4 2 4-2 4 2 4-2 4 2M8 6h.01m4-1h.01m4 1h.01'),
  pho: icon('越南粉',
    'M3 14h18c-1 6-5 8-9 8s-8-2-9-8ZM8 22h8M13 11l3-9m0 10 4-9',
    'M4 12c-3-4 2-7 6-7 0 4-2 7-6 7Zm1-1 4-5M6 15c2-2 3 2 5 0s3 2 5 0'),
  sushi: icon('寿司卷',
    'M3 9a5 4 0 0 1 10 0v8a5 4 0 0 1-10 0V9Zm0 0a5 4 0 0 0 10 0M13 12a4.5 3.5 0 0 1 9 0v6a4.5 3.5 0 0 1-9 0v-6Zm0 0a4.5 3.5 0 0 0 9 0',
    circle(8, 9, 1), circle(17.5, 12, 1)),
  pizza: icon('披萨',
    'M10 3a9 9 0 1 0 11 11l-9-2-2-9ZM14 2l2 7 7 2c-1-5-4-8-9-9Z',
    circle(7, 11, 1), circle(10, 17, 1), circle(17, 16, 1)),
  cloche: icon('法餐托盘罩', 'M4 16a8 9 0 0 1 16 0M2 16h20M5 20h14M12 7V4m-2 0h4'),
  dumpling: icon('包子蒸笼',
    'M3 15c1-6 5-9 9-9s8 3 9 9M9 7l3 6 3-6M6 10l3 4m9-4-3 4M2 15h20v6H2v-6Zm4 2v2m12-2v2'),
  curry: word('咖喱', '咖喱'),
  cafe: icon('咖啡馆', 'M4 9h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Zm13 1h2a3 3 0 0 1 0 6h-2M6 3v3m5-3v3m5-3v3'),
  bakery: icon('面包店', 'M4 18c-4-5 1-12 8-12s12 7 8 12l-4-2-4 2-4-2-4 2ZM8 8l1 5m6-5-1 5'),
  cake: sourcedIcon('甜品店', 'lucide-cake-slice'),
  foodhall: icon('餐饮集合', 'M3 9h18V4H3v5Zm1 0v12h16V9M8 13v6m-2-6v3h4v-3m6 0v6'),
  wine: icon('酒吧与品饮', 'M7 3h10v6a5 5 0 0 1-10 0V3Zm5 11v7m-4 0h8M7 8h10'),
  lantern: icon('居酒屋', 'M8 3h8v3m-8 12v3h8v-3M7 6h10l2 6-2 6H7l-2-6 2-6Zm2 0v12m6-12v12'),
  beer: icon('酿造与饮酒', 'M5 8h11v13H5V8Zm11 2h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3M9 11v6m3-6v6M5 8c-3-3 1-7 4-4 2-4 7-2 7 2v2'),
  'music-bar': icon('音乐酒吧', 'M4 11h8v3a4 4 0 0 1-8 0v-3Zm4 7v3m-3 0h6M17 12V4l5-1v7', circle(15.5, 13, 1.5), circle(20.5, 11, 1.5)),
  store: icon('商店', 'M3 9h18l-2-5H5L3 9Zm1 0v12h16V9M8 21v-7h8v7M3 9c0 3 3 3 3 0 0 3 3 3 3 0 0 3 3 3 3 0 0 3 3 3 3 0 0 3 3 3 3 0 0 3 3 3 3 0'),
  // LJ-CONVENIENCE-24-20261031: large numerals remain readable inside the existing marker shell.
  convenience: icon('便利店', 'M3 13v9h18v-9M9 22v-5h6v5M3 7H1v6h2m18-6h2v6h-2',
    'M4 5a3 3 0 0 1 6 0c0 2-1 3-3 5l-3 3h7M17 2l-4 8h7m-2-8v11'),
  cart: icon('超市', 'M2 4h3l3 12h11l3-9H6M10 20h.01M18 20h.01M11 7v5m5-5v5'),
  'cart-boxes': icon('会员仓储商店', 'M2 5h3l3 12h11l3-6H7M8 11V3h6v8m0-5h6v5M10 21h.01M18 21h.01'),
  basket: icon('食品与日用购物', 'M3 10h18l-2 11H5L3 10Zm4 0 5-7 5 7M8 14v3m4-3v3m4-3v3'),
  bag: icon('商场与百货', 'M4 8h16l1 13H3L4 8Zm4 0V6a4 4 0 0 1 8 0v2'),
  market: icon('市场', 'M2 10h20l-3-6H5l-3 6Zm2 0v11m16-11v11M4 15h16M8 4l-1 6m9-6 1 6'),
  pill: icon('药局与药妆', 'M6 18a5 5 0 0 1 0-7l5-5a5 5 0 0 1 7 7l-5 5a5 5 0 0 1-7 0Zm2-9 7 7'),
  hammer: icon('家居五金', 'M3 7 8 2l7 7-3 3-3-3-5 2-1-4Zm8 4 10 10M14 10l-3 3'),
  hanger: icon('服装', 'M9 7a3 3 0 1 1 5 2l-2 2v2M12 13 3 18v3h18v-3l-9-5Z'),
  'vintage-hanger': icon('古着', 'M8 8a3 3 0 1 1 5 2l-1 2v1M12 13 3 18v3h18v-3l-9-5ZM20 2v4m-2-2h4'),
  book: icon('书籍', 'M12 6C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15'),
  record: icon('唱片', circle(12, 12, 9), circle(12, 12, 2), 'M6 10a6 6 0 0 1 4-4m8 8a6 6 0 0 1-4 4'),
  // LJ-LIVE-GUITAR-20261031: retain the recognizable full guitar body at map sizes.
  guitar: sourcedIcon('乐器与现场音乐', 'lucide-guitar'),
  'instrument-guitar': sourcedIcon('乐器店', 'lucide-guitar'),
  character: word('动漫与角色商品', 'ACG'),
  blocks: word('玩具与模型', 'Toys'),
  camera: icon('摄影与相机', 'M3 8h4l2-4h6l2 4h4v13H3V8Z', circle(12, 14, 4)),
  craft: icon('工坊与制作体验', 'M3 21c6 0 6-3 6-5l-3-3c-2 0-5 2-3 8Zm4-7L17 3l4 4-11 10M15 5l4 4'),
  vase: word('古道具', '古物'),
  museum: icon('博物馆', 'M2 9 12 3l10 6H2ZM4 21h16M5 10v8m5-8v8m4-8v8m5-8v8M3 18h18'),
  picture: icon('美术馆与画廊', 'M3 3h18v18H3V3Zm0 14 6-6 5 5 3-3 4 4', circle(16, 8, 2)),
  scroll: sourcedIcon('历史资料馆', 'lucide-book-open-text'),
  memorial: icon('纪念设施', 'M8 17 10 3h4l2 14M6 17h12v4H6v-4ZM4 21h16'),
  science: sourcedIcon('科学馆', 'lucide-atom'),
  telescope: sourcedIcon('天文设施', 'lucide-telescope'),
  library: icon('图书馆', 'M3 21V7l9-4 9 4v14M7 10v7m4-8v8m4-6 2 6M6 21h12'),
  convention: word('会展设施', '展会'),
  masks: icon('剧场', 'M3 4c4 2 7 2 11 0v7a6 6 0 0 1-11 0V4Zm3 4h1m3 0h1M6 11c1 2 3 2 5 0M15 8l6 1-1 8c-1 5-7 6-10 2m5-7h1m2 1h1m-5 4c1-1 3-1 4 0'),
  film: icon('电影院', 'M3 4h18v16H3V4Zm5 0v16m8-16v16M3 9h5m-5 6h5m8-6h5m-5 6h5'),
  music: icon('音乐厅', 'M9 17V5l11-2v12M9 8l11-2', circle(6, 18, 3), circle(17, 16, 3)),
  disco: word('夜店与舞厅', '舞场'),
  microphone: sourcedIcon('卡拉OK', 'lucide-mic-vocal'),
  gamepad: icon('游戏厅', 'M7 7h10c3 0 4 3 5 10 0 3-3 4-5 0l-1-1H8l-1 1c-2 4-5 3-5 0 1-7 2-10 5-10ZM7 10v5m-2-2h4m6-2h.01m3 3h.01'),
  pachinko: icon('柏青哥', 'M5 3h14v18H5V3Zm3 3h8v10H8V6ZM8 19h4m4 0h.01', circle(12, 11, 2)),
  ticket: icon('竞技与票券', 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6Zm12 0v3m0 3v1m0 3v2'),
  tiles: icon('麻将与桌游', 'M3 5h11v16H3V5Zm11 4h7v12h-7M7 9h3m-3 4h3m-3 4h3m7-3h1m-1 4h1'),
  puzzle: icon('主题娱乐', 'M3 9h5V5a2 2 0 0 1 4 0v4h5v4h3a2 2 0 0 1 0 4h-3v4h-5v-3a2 2 0 0 0-4 0v3H3V9Z'),
  school: icon('学校', 'M3 21V9h5V4h8v5h5v12M8 4l4-2 4 2M10 21v-5h4v5M5 13h1m12 0h1M12 7v3m-1-1h2'),
  graduation: icon('大学', 'M2 8 12 3l10 5-10 5L2 8Zm4 2v7c4 3 8 3 12 0v-7m4-2v9'),
  child: icon('儿童服务', circle(12, 6, 3), 'M4 11l5 3h6l5-3M12 14v4m-4 3 4-3 4 3'),
  classroom: word('兴趣与语言教育', '课程'),
  care: icon('照护', 'M3 16h5l3 2h5l5-5M3 21h13l5-5M7 9C2 5 7 1 12 5c5-4 10 0 5 4l-5 5-5-5Z'),
  hospital: icon('医院', 'M4 21V4h16v17M8 9h8m-4-4v8M10 21v-4h4v4'),
  stethoscope: icon('诊所', 'M4 3v6a5 5 0 0 0 10 0V3M3 3h3m7 0h3M9 14v3a4 4 0 0 0 8 0v-4', circle(18, 10, 3)),
  tooth: icon('牙科', 'M12 5C4-2 1 6 5 12c1 2 0 9 3 9 2 0 1-7 4-7s2 7 4 7c3 0 2-7 3-9 4-6 1-14-7-7Z'),
  scissors: icon('理发与美容', circle(6, 6, 3), circle(6, 18, 3), 'M8 8 21 21M8 16 21 3'),
  washer: icon('洗衣', 'M4 3h16v18H4V3Zm0 4h16M7 5h.01m3 0h.01', circle(12, 14, 4), 'M8 14c3 3 5-3 8 0'),
  wrench: icon('修理', 'M21 4a6 6 0 0 1-8 8L5 21l-3-3 9-8a6 6 0 0 1 8-8l-4 4 3 3 3-5Z'),
  paw: icon('宠物', 'M8 13c-3 1-4 5-1 7 2 1 3-1 5-1s3 2 5 1c3-2 2-6-1-7-2-3-6-3-8 0Z', circle(5, 9, 2), circle(9, 5, 2), circle(15, 5, 2), circle(19, 9, 2)),
  zoo: sourcedIcon('动物园', 'mdi-elephant'),
  printer: icon('印刷复印', 'M7 8V3h10v5M7 18H3V8h18v10h-4M7 14h10v7H7v-7Zm10-3h1'),
  government: icon('行政与公共服务', 'M3 8 12 3l9 5H3ZM5 11v7m5-7v7m4-7v7m5-7v7M3 21h18M2 18h20'),
  badge: icon('警察与消防', 'M12 3c3 2 6 3 9 3v6c0 5-6 8-9 10-3-2-9-5-9-10V6c3 0 6-1 9-3Zm0 5 1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5L7 11.5l3.5-.5 1.5-3Z'),
  mail: icon('邮局', 'M3 5h18v14H3V5Zm0 0 9 8 9-8M3 19l6-7m12 7-6-7'),
  bank: icon('银行', 'M2 8 12 3l10 5H2ZM5 11v7m14-7v7M3 21h18', circle(12, 14, 3)),
  community: icon('社区活动', circle(8, 6, 3), circle(17, 8, 2.5), 'M2 21v-4a6 6 0 0 1 12 0v4m1-7a5 5 0 0 1 7 4v3'),
  restroom: word('公共厕所', '厕'),
  flower: icon('殡葬与追思', 'M12 21v-9m0 5c-4 0-7-2-8-5 4 0 7 2 8 5Zm0 2c4 0 7-2 8-5-4 0-7 2-8 5Z', circle(12, 7, 3), 'M12 4c-3-6-8 0-3 3-6 3 0 8 3 3 3 5 9 0 3-3 5-3 0-9-3-3Z'),
  train: icon('铁路车站', 'M5 4h14v13H5V4Zm0 7h14M8 3h8M8 21l2-4m6 4-2-4M8 14h.01m8 0h.01'),
  gate: icon('站厅与换乘', 'M3 21V7h5v14M16 21V7h5v14M8 12h8m-3-3 3 3-3 3'),
  platform: icon('站台', 'M3 21h18M4 17h16V4H4v13Zm0-7h16M7 14h.01m10 0h.01M7 17v4m10-4v4'),
  bus: icon('公交', 'M4 4h16v15H4V4Zm0 8h16M8 4v8m8-8v8M7 16h.01m10 0h.01M7 19v2m10-2v2'),
  boat: icon('客船码头', 'M3 13 12 9l9 4-3 6H6l-3-6Zm4-2V5h10v6M12 5V2M2 21c3-2 5 2 8 0s5 2 8 0 3 0 4 0'),
  plane: icon('机场', 'M12 3c2 0 1 5 2 6l8 5v3l-8-3v5l3 2H7l3-2v-5l-8 3v-3l8-5c1-1 0-6 2-6Z'),
  car: icon('车辆', 'M3 18v-6l3-7h12l3 7v6H3Zm0-6h18M6 18v3m12-3v3M6 15h.01m12 0h.01'),
  taxi: icon('出租车', 'M3 18v-6l3-6h12l3 6v6H3Zm0-6h18M8 6V3h8v3M6 18v3m12-3v3M6 15h.01m12 0h.01'),
  bicycle: icon('自行车', circle(5, 16, 4), circle(19, 16, 4), 'M5 16 9 8l5 8H5Zm9 0 4-11h3M8 8H5m12 3-7-1'),
  parking: icon('停车', 'M5 21V3h9a5 5 0 0 1 0 10H5M3 21h6'),
  fuel: icon('加油', 'M4 21V3h11v18M6 6h7v5H6V6Zm9 7h2v5a2 2 0 0 0 4 0V9l-4-4m2 2-2 2 4 4M2 21h15'),
  'rental-car': icon('车辆租赁', 'M2 18v-6l2-5h10l2 5v6H2Zm0-6h14M5 18v3m8-3v3M19 8v7m0-3h3', circle(19, 5, 3)),
  bed: icon('酒店与旅馆', 'M3 4v17m18-9v9M3 17h18M3 12h18V8H11v4M6 8h2'),
  capsule: icon('胶囊旅馆', 'M3 4h18v16H3V4Zm0 8h18M8 4v16M11 8h7m-7 8h7'),
  bunk: icon('青年旅舍与宿舍', 'M3 3v18m18-18v18M3 9h18M3 18h18M8 4h10v5M8 13h10v5M6 9v9'),
  guesthouse: icon('民宿', 'M3 11 12 3l9 8M5 10v11h14V10M8 14v5m0-2h8v-3h-5'),
  tent: icon('露营住宿', 'M2 21 12 3l10 18H2Zm5 0 5-9 5 9M10 3h4'),
  office: icon('办公', 'M3 8h18v13H3V8Zm5 0V4h8v4M3 13c5 3 13 3 18 0m-9-1v5'),
  desks: icon('共享办公', 'M2 12h20M4 12v9m16-9v9M4 4h6v5H4V4Zm10 0h6v5h-6V4ZM7 9v3m10-3v3'),
  ball: icon('体育运动', circle(12, 12, 9), 'M3 12h18M12 3v18M6 5c8 5 8 9 12 14M6 19C14 14 14 10 18 5'),
  dumbbell: icon('健身与练习', 'M3 7v10m4-13v16m10-16v16m4-13v10M7 12h10M2 10v4m20-4v4'),
  swimming: icon('游泳', circle(17, 5, 2), 'M3 13l6-7 5 4 4 3M8 7l2 6M2 17c3-3 5 3 8 0s5 3 8 0 3 0 4 0M2 21c3-3 5 3 8 0s5 3 8 0 3 0 4 0'),
  bath: icon('公共浴场与温泉', 'M2 13h20M4 13v3a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5v-3M7 4c-2 2 2 4 0 6m5-7c-2 2 2 4 0 6m5-5c-2 2 2 4 0 6'),
  sauna: word('桑拿', '桑拿'),
  fish: icon('水族馆', 'M6 12c4-8 10-8 15 0-5 8-11 8-15 0Zm0 0-4-4v8l4-4ZM13 7l2-3m-2 13 2 3M17 11h.01'),
  animal: word('动物园与水族馆', '动物'),
  greenhouse: icon('植物园', 'M3 21V9l9-6 9 6v12H3Zm9-18v18M3 9h18M7 18c0-5 7-5 7-5s0 5-7 5Z'),
  ferris: icon('游乐园', circle(12, 10, 8), circle(12, 10, 2), 'M12 2v6m8 2h-6m-2 8v-6m-8-2h6M7 4l4 4m6-4-4 4M7 16l4-4m6 4-4-4M7 22l4-10m6 10-4-10M5 22h14'),
  shrine: icon('神社鸟居', 'M2 5c6 2 14 2 20 0M4 9h16M7 6l-1 15m11-15 1 15M12 6v3'),
  temple: icon('寺院', 'M5 5h14l-2-3H7L5 5Zm-2 6h18l-4-4H7l-4 4Zm-1 6h20l-4-4H6l-4 4Zm4 0v4h12v-4M10 21v-4h4v4'),
  church: icon('教会', 'M3 21V11l5 3V8l4-4 4 4v6l5-3v10H3Zm9-17V1m-2 2h4M10 21v-5h4v5'),
  faith: icon('宗教设施', 'M3 21V11h18v10M7 11V8a5 5 0 0 1 10 0v3M10 21v-5h4v5M2 11h20'),
  cemetery: icon('墓园', 'M5 21V9a7 7 0 0 1 14 0v12M3 21h18M9 9h6m-3-3v8'),
});

const categories = new Map(METRO_POINT_CATEGORIES.map(row => [row.id, row]));
const purposes = {
  'ex.residential': 'house', 'ex.commercial': 'district-commerce', 'ex.nightlife': 'district-nightlife',
  'ex.center': 'skyline', 'ex.historic': 'ruins', 'ex.industry': 'factory', 'ex.open-space': 'tree',
  'ex.streets': 'road', 'ex.rural': 'mountain', 'ex.waterfront': 'sea', 'ex.architecture': 'building',
  'in.food': 'plate', 'in.drinking': 'wine', 'in.retail': 'store', 'in.specialty': 'bag', 'in.culture': 'museum',
  'in.entertainment': 'gamepad', 'in.care-learning': 'care', 'in.education': 'school', 'in.health': 'hospital',
  'in.public': 'government', 'in.transport': 'train', 'in.living-work': 'bed', 'in.leisure-faith': 'ball',
  'in.sports': 'ball', 'in.religion': 'faith',
};
const assign = (iconId, ids) => { for (const id of ids.split(' ')) purposes[id] = iconId; };
assign('apartments', 'ex.residential.low-rise ex.residential.high-rise ex.residential.danchi ex.residential.new-town');
assign('castle', 'ex.historic.castle-town ex.historic.castle');
assign('building', 'ex.historic.historic-building ex.historic.historic-structure');
assign('warehouse', 'ex.historic.warehouse ex.industry.logistics in.living-work.warehouse');
assign('harbor', 'ex.industry.port ex.industry.fishing-port ex.waterfront.harbor');
assign('garden', 'ex.open-space.garden ex.open-space.greenway');
assign('playground', 'ex.open-space.playground');
assign('bench', 'ex.open-space.square ex.open-space.courtyard');
assign('sea', 'ex.open-space.waterfront-park ex.rural.wetland ex.waterfront.estuary ex.waterfront.rocks-cliffs ex.waterfront.cape');
assign('ball', 'ex.open-space.sports');
assign('cemetery', 'ex.open-space.memorial in.religion.cemetery');
assign('viewpoint', 'ex.open-space.viewpoint');
assign('pavilion', 'ex.open-space.rest-pavilion');
assign('tower', 'ex.open-space.landmark ex.architecture.tower');
assign('bridge', 'ex.streets.bridge ex.streets.footbridge');
assign('stairs', 'ex.streets.slope');
assign('tunnel', 'ex.streets.underground');
assign('bicycle', 'ex.streets.cycleway in.transport.bicycles');
assign('junction', 'ex.streets.junction');
assign('farmland', 'ex.rural.farmland ex.rural.pasture');
assign('house', 'ex.rural.village-edge');
assign('forest', 'ex.rural.forest-path ex.rural.satoyama');
assign('river', 'ex.rural.valley ex.waterfront.riverbank ex.waterfront.floodplain ex.waterfront.canal');
assign('waterfall', 'ex.rural.waterfall');
assign('cave', 'ex.rural.cave');
assign('rocks', 'ex.rural.rocks');
assign('lake', 'ex.waterfront.lake ex.waterfront.lakeside');
assign('beach', 'ex.waterfront.beach');
assign('island', 'ex.waterfront.island');
assign('dam', 'ex.waterfront.watergate ex.architecture.dam');
assign('lighthouse', 'ex.architecture.lighthouse');
assign('bowl', 'in.food.diner');
assign('noodles', 'in.food.noodles');
assign('curry', 'in.food.curry');
assign('cafe', 'in.food.cafe');
assign('bakery', 'in.food.sweets-bakery');
assign('foodhall', 'in.food.food-hall');
assign('lantern', 'in.food.izakaya');
assign('beer', 'in.drinking.brewpub');
assign('music-bar', 'in.drinking.music-bar');
assign('convenience', 'in.retail.convenience');
assign('cart', 'in.retail.supermarket');
assign('basket', 'in.retail.food-shop in.retail.daily-goods in.retail.direct-sales');
assign('bag', 'in.retail.mall-department');
assign('market', 'in.retail.market');
assign('pill', 'in.retail.drugstore in.health.pharmacy');
assign('hammer', 'in.retail.home-hardware');
assign('hanger', 'in.specialty.clothes');
assign('vintage-hanger', 'in.specialty.vintage');
assign('book', 'in.specialty.books');
assign('record', 'in.specialty.records');
assign('guitar', 'in.specialty.instruments in.entertainment.live-music');
assign('character', 'in.specialty.anime');
assign('blocks', 'in.specialty.toys-models');
assign('camera', 'in.specialty.camera-electronics in.health.photography-service');
assign('craft', 'in.specialty.craft-supplies in.culture.workshop');
assign('vase', 'in.specialty.antiques');
assign('picture', 'in.culture.art-museum in.culture.gallery');
assign('scroll', 'in.culture.history');
assign('memorial', 'in.culture.memorial in.religion.memorial');
assign('science', 'in.culture.science');
assign('library', 'in.culture.library');
assign('convention', 'in.culture.convention');
assign('masks', 'in.entertainment.theater in.entertainment.adult-theater');
assign('film', 'in.entertainment.cinema');
assign('music', 'in.entertainment.concert-hall');
assign('disco', 'in.entertainment.nightclub');
assign('microphone', 'in.entertainment.karaoke');
assign('pachinko', 'in.entertainment.pachinko');
assign('ticket', 'in.entertainment.betting');
assign('tiles', 'in.entertainment.mahjong-games');
assign('puzzle', 'in.entertainment.themed');
assign('child', 'in.education.nursery in.health.child-services');
assign('graduation', 'in.education.university');
assign('classroom', 'in.education.vocational in.education.cram-school in.education.classes');
assign('care', 'in.health.nursing in.health.elder-services in.health.rehabilitation');
assign('stethoscope', 'in.health.clinic');
assign('tooth', 'in.health.dental');
assign('scissors', 'in.public.hair-beauty');
assign('washer', 'in.public.laundry');
assign('wrench', 'in.public.repair');
assign('paw', 'in.public.pets');
assign('printer', 'in.health.printing-service');
assign('badge', 'in.public.police-fire');
assign('mail', 'in.public.post');
assign('bank', 'in.public.bank');
assign('community', 'in.public.community in.public.youth');
assign('restroom', 'in.public.toilets');
assign('flower', 'in.public.funeral-service');
assign('gate', 'in.transport.concourse in.transport.entrance-transfer');
assign('platform', 'in.transport.platform');
assign('bus', 'in.transport.bus');
assign('boat', 'in.transport.ferry');
assign('plane', 'in.transport.airport');
assign('taxi', 'in.transport.taxi');
assign('parking', 'in.transport.parking');
assign('car', 'in.transport.road-services');
assign('fuel', 'in.transport.fueling');
assign('rental-car', 'in.transport.vehicle-rental');
assign('capsule', 'in.living-work.capsule');
assign('bunk', 'in.living-work.hostel in.living-work.dorm-shared-home');
assign('guesthouse', 'in.living-work.guesthouse');
assign('tent', 'in.living-work.camping');
assign('apartments', 'in.living-work.residential-common');
assign('office', 'in.living-work.offices');
assign('desks', 'in.living-work.coworking');
assign('factory', 'in.living-work.factory-workshop');
assign('dumbbell', 'in.sports.fitness');
assign('swimming', 'in.sports.swimming');
assign('bath', 'in.sports.baths-onsen');
assign('sauna', 'in.sports.sauna');
assign('animal', 'in.sports.zoo-aquarium');
assign('greenhouse', 'in.sports.botanical');
assign('ferris', 'in.sports.amusement-park');
assign('shrine', 'in.religion.shrine');
assign('temple', 'in.religion.temple');
assign('church', 'in.religion.church');

for (const row of METRO_POINT_CATEGORIES) {
  if (symbolByLabel.has(row.label)) purposes[row.id] = symbolByLabel.get(row.label);
}
const detailTypes = new Map(MAP_POINT_ICON_DETAILS.map(([id, label, parentId]) => [id, {
  id, label: metroPurposeNames[id] || label, parentId,
  iconId: symbolByLabel.get(metroPurposeNames[id] || label) || purposes[parentId] || 'unmapped',
}]));
const foodSubjectIcons = new Set(['tempura', 'unagi', 'ramen', 'yakiniku', 'bbq', 'burger', 'pho', 'sushi', 'pizza', 'cloche', 'dumpling']);
const nationalFoodSubjects = new Map([...detailTypes.values()]
  .filter(row => row.id.startsWith('metro.detail.cat.食.') && foodSubjectIcons.has(row.iconId))
  .map(row => [row.id.slice('metro.detail.'.length), row.iconId]));

const legacyIcons = {
  景: 'viewpoint', 馆: 'museum', 社: 'shrine', 寺: 'temple', 大: 'graduation', 医: 'hospital',
  剧: 'masks', 商: 'bag', 超: 'cart', 图: 'library', 校: 'school', 便: 'convenience', 咖: 'cafe',
  包: 'bakery', 书: 'book', 酒: 'wine', 歌: 'microphone', 宿: 'bed', 食: 'plate', 艺: 'picture',
  游: 'word-娱', 体: 'word-体', 园: 'tree', 店: 'store', 宗: 'word-宗', 服: 'hanger', 政: 'government',
  办: 'office', 交: 'word-交', 住: 'house', 工: 'factory', 地: 'word-地', 建: 'building',
  bus: 'bus', svc: 'word-服务', other: 'unmapped',
};

function animalIcon(target) {
  const subtype = String(target?.subtype || '');
  const types = String(target?.type || '').split('／').map(value => value.trim());
  const aquarium = subtype === 'aquarium' || types.includes('水族馆') || types.includes('水族館');
  const zoo = subtype === 'zoo' || types.includes('动物园') || types.includes('動物園');
  return aquarium !== zoo ? aquarium ? 'fish' : 'zoo' : 'animal';
}

export function mapPointIconId(target) {
  const path = target?.typePathIds || [];
  if (path.includes('metro.pending')) return 'unknown';
  const detailId = path.findLast(id => detailTypes.has(id));
  if (detailId) return detailTypes.get(detailId).iconId;
  const foodId = path.findLast(id => nationalFoodSubjects.has(id));
  if (foodId) return nationalFoodSubjects.get(foodId);
  const categoryId = path.findLast(id => categories.has(id));
  if (categoryId) {
    for (let row = categories.get(categoryId); row; row = categories.get(row.parentId)) {
      if (row.id === 'in.sports.zoo-aquarium') return animalIcon(target);
      if (purposes[row.id]) return purposes[row.id];
    }
  }
  const subtype = String(target?.subtype || '');
  const types = String(target?.type || '').split('／').map(value => value.trim());
  if (['aquarium', 'zoo'].includes(subtype) || types.some(value => ['水族馆', '水族館', '动物园', '動物園'].includes(value))) return animalIcon(target);
  if (subtype === 'sauna' || types.includes('桑拿设施')) return 'sauna';
  if (['public_bath', 'hot_spring', 'onsen'].includes(subtype) || types.some(value => ['公共浴场', '温泉浴场'].includes(value))) return 'bath';
  if (subtype === 'nightclub' || types.includes('夜店')) return 'word-夜店';
  if (subtype === 'dance_club' || types.includes('舞厅')) return 'word-舞厅';
  if (target?.kind === 'station' || types.includes('车站') || ['train_station', 'light_rail_and_subway_station'].includes(subtype)) return 'train';
  const legacyId = path.findLast(id => id.startsWith('cat.') && legacyIcons[id.split('.')[1]]);
  return legacyIcons[legacyId?.split('.')[1] || mapPointCategoryIds(target)[0] || target?.categoryCode] || 'unmapped';
}

export const MAP_POINT_ICON_TYPES = Object.freeze([
  ...METRO_POINT_CATEGORIES.map(row => ({ id: row.id, label: row.label, parentId: row.parentId || null })),
  ...detailTypes.values(),
].map(row => Object.freeze({ ...row, iconId: mapPointIconId({ typePathIds: [row.id] }) })));

const pathCache = new Map();
// Current local paths measured with SVG getBBox in the browser; future drawings need their own check.
const pathOffsets = {
  animal: [0, -.5], apartments: [0, -.5], badge: [0, -.5], bag: [0, .5], bed: [0, -.5], beer: [-.469, .59],
  bench: [0, -2.5], bicycle: [0, -.5], blocks: [0, -2], bowling: [-1.557, -.5], bridge: [0, -2.289], building: [0, -1],
  bus: [0, -.5], cafe: [-1, 0], camera: [0, -.5], car: [0, -1], castle: [0, -.5], cemetery: [0, .5], character: [0, -.5],
  church: [0, 1], classroom: [.5, 0], convenience: [0, 0], convention: [0, -.5], craft: [.33, 0], curry: [-1, -1],
  dam: [0, -.789], desks: [0, -.5], diamond: [0, -.5], disco: [0, .5], 'district-commerce': [0, -.5],
  'district-nightlife': [.5, 0], factory: [1, -.5], fish: [.5, 0], flower: [0, .784], foodhall: [0, -.5], fuel: [.5, 0],
  gamepad: [0, -1.319], garden: [0, -2], gate: [0, -2], gift: [0, -.556], glasses: [0, 1], golf: [0, .5],
  graduation: [0, .875], hammer: [0, .5], hanger: [0, -.386], harbor: [0, .5], hospital: [0, -.5],
  island: [0, .404], lipstick: [1, 0], market: [0, -.5], masks: [0, -.734], microphone: [2, .031], mountain: [0, -1],
  music: [.5, 0], 'music-bar': [-1, 0], office: [0, -.5], parking: [1, 0], paw: [0, .36], pencil: [-.5, .5],
  plate: [1, 0], platform: [0, -.5], playground: [0, -.5], puzzle: [-.5, 0], 'rental-car': [0, .5], rocks: [-.5, -3],
  sauna: [-.289, 0], school: [0, .5], scroll: [-1, 0], sea: [0, -.766], shoe: [0, -1.5], shrine: [0, -1],
  skyline: [0, -1], sofa: [0, -2], stairs: [0, 1], store: [0, -.5], swimming: [0, -.433], temple: [0, .5],
  tiles: [0, -1], tooth: [0, .363], tower: [0, .5], tree: [-.5, -.5], tunnel: [0, .998],
  'vintage-hanger': [-.5, .5], waterfall: [0, -.789], wrench: [.207, .793],
  tempura: [0, -.5], ramen: [-1, .5], sushi: [-.5, -1.25], cloche: [0, .5], dumpling: [0, -1.5],
};
export function drawMapPointIcon(ctx, iconId, x, y, size, color) {
  const graphic = MAP_POINT_ICONS[iconId] || MAP_POINT_ICONS.unmapped;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (graphic.glyph) {
    ctx.fillStyle = color;
    const fontSize = [...graphic.glyph].length === 1 ? 23 : 18;
    ctx.font = `700 ${fontSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const metrics = ctx.measureText(graphic.glyph);
    const left = metrics.actualBoundingBoxLeft ?? 0, right = metrics.actualBoundingBoxRight ?? metrics.width;
    const ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.8, descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.2;
    ctx.translate(12, 12);
    ctx.scale(Math.min(1, 24 / Math.max(1, metrics.width, left + right)), 1);
    ctx.fillText(graphic.glyph, (left - right) / 2, (ascent - descent) / 2);
  } else if (typeof Path2D === 'function') {
    if (graphic.viewBoxSize) ctx.scale(24 / graphic.viewBoxSize, 24 / graphic.viewBoxSize);
    if (graphic.offset) ctx.translate(...graphic.offset);
    if (!graphic.source && pathOffsets[iconId]) ctx.translate(...pathOffsets[iconId]);
    if (!pathCache.has(graphic)) pathCache.set(graphic, graphic.paths.map(value => new Path2D(value)));
    if (graphic.paint === 'fill') {
      ctx.fillStyle = color;
      for (const path of pathCache.get(graphic)) ctx.fill(path);
    } else {
      for (const path of pathCache.get(graphic)) ctx.stroke(path);
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(12, 4); ctx.lineTo(20, 12); ctx.lineTo(12, 20); ctx.lineTo(4, 12);
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}
