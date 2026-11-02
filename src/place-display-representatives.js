import { livingPlaceDisplayRepresentatives } from './living-area-retirement.js';
import { reviewedDisplayAdditions, reviewedHiddenAggregateIds } from './reviewed-display-additions.js';

// LJ-PLACE-DISPLAY-REPRESENTATIVES-20261031: reviewed identities converge for display; bodies and source records stay intact.
const nearbyRepresentatives = [
  [
    "map:tokyo-v2.2:386810",
    "osm:way:203960902"
  ],
  [
    "map:tokyo-v2.2:382359",
    "osm:way:20028328"
  ],
  [
    "map:tokyo-v2.2:156369",
    "osm:way:451564412"
  ],
  [
    "map:japan-v3:1497453",
    "osm:way:314206942"
  ],
  [
    "map:japan-v3:1673514",
    "osm:way:1551428983"
  ],
  [
    "map:tokyo-v2.2:legacy:79,667.5:1:%E8%97%A4%E5%AD%90%C2%B7F%C2%B7%E4%B8%8D%E4%BA%8C%E9%9B%84%E5%8D%9A%E7%89%A9%E9%A6%86::",
    "osm:way:1551428983"
  ]
];
const oldDisplayRows = {
  "place:content_object:D147-P033": {
    "names": [
      "国立科学博物馆",
      "國立科學博物馆",
      "國立科學博物館",
      "国立科学博物館",
      "上野科博",
      "National Museum of Nature and Science",
      "NationalMuseumofNatureandScience"
    ],
    "sourceIds": [
      "place:content_object:D147-P033"
    ]
  },
  "place:content_object:D147-P019": {
    "names": [
      "日本武道馆",
      "日本武道館",
      "Nippon Budokan",
      "NipponBudokan",
      "武道馆",
      "武道館"
    ],
    "sourceIds": [
      "place:content_object:D147-P019"
    ]
  },
  "place:content_object:D151-S03-05": {
    "names": [
      "涩谷PARCO",
      "澀谷PARCO"
    ],
    "sourceIds": [
      "place:content_object:D151-S03-05"
    ]
  },
  "place:content_object:D147-P013": {
    "names": [
      "台场海滨公园",
      "臺场海滨公园",
      "臺場海濱公園",
      "お台場海浜公園",
      "お臺場海濱公園",
      "お台场海滨公园",
      "お台场海浜公园",
      "御台场海滨公园",
      "禦臺场海滨公园",
      "御臺場海濱公園"
    ],
    "sourceIds": [
      "place:content_object:D147-P013"
    ]
  },
  "place:content_object:D149-B18-03": {
    "names": [
      "筑地场外市场",
      "築地場外市場"
    ],
    "sourceIds": [
      "place:content_object:D149-B18-03"
    ]
  },
  "place:content_object:D147-P010": {
    "names": [
      "国营昭和纪念公园",
      "國营昭和纪念公园",
      "國營昭和紀念公園",
      "国営昭和記念公園",
      "國營昭和記念公園",
      "国营昭和记念公园",
      "国営昭和记念公园",
      "昭和纪念公园",
      "昭和紀念公園",
      "昭和記念公園",
      "昭和记念公园"
    ],
    "sourceIds": [
      "place:content_object:D147-P010"
    ]
  },
  "place:content_object:D147-P018": {
    "names": [
      "江户东京建筑园",
      "江戶東京建築園",
      "江戸東京たてもの園",
      "江戶東京たてもの園",
      "江户东京たてもの园",
      "江戸东京たてもの园"
    ],
    "sourceIds": [
      "place:content_object:D147-P018"
    ]
  },
  "place:content_object:D148-TYO-089": {
    "names": [
      "东京国际论坛",
      "东京國际论坛",
      "東京國際論壇",
      "东京国际论坛外部",
      "东京國际论坛外部",
      "東京國際論壇外部",
      "东京国际论坛公共内部",
      "东京國际论坛公共內部",
      "東京國際論壇公共內部"
    ],
    "sourceIds": [
      "place:content_object:D148-TYO-089"
    ]
  },
  "place:content_object:D148-YOK-01": {
    "names": [
      "横滨红砖仓库",
      "橫滨红砖仓库",
      "橫濱紅磚倉庫",
      "横滨红砖仓库外部与红砖公园",
      "橫滨红砖仓库外部與红砖公园",
      "橫濱紅磚倉庫外部與紅磚公園",
      "横滨红砖仓库1号馆与2号馆内部",
      "橫滨红砖仓库1號馆與2號馆內部",
      "橫濱紅磚倉庫1號館與2號館內部"
    ],
    "sourceIds": [
      "place:content_object:D148-YOK-01"
    ]
  },
  "place:content_object:D149-B05-03": {
    "names": [
      "横滨中华街",
      "橫滨中华街",
      "橫濱中華街"
    ],
    "sourceIds": [
      "place:content_object:D149-B05-03"
    ]
  },
  "place:content_object:D147-P057": {
    "names": [
      "LAZONA川崎",
      "LAZONA川崎站连廊与室外广场",
      "LAZONA川崎站连廊與室外广场",
      "LAZONA川崎站連廊與室外廣場",
      "ラゾーナ川崎プラザ",
      "ラゾーナ川崎",
      "Lazona川崎",
      "川崎LAZONA",
      "LAZONA川崎共享商业内部",
      "LAZONA川崎共享商业內部",
      "LAZONA川崎共享商業內部"
    ],
    "sourceIds": [
      "place:content_object:D147-P057"
    ]
  },
  "place:content_object:D147-P062": {
    "names": [
      "川崎市藤子·F·不二雄博物馆",
      "川崎市藤子·F·不二雄博物館",
      "藤子 F 不二雄博物馆",
      "藤子F不二雄博物馆",
      "藤子 F 不二雄博物館",
      "藤子F不二雄博物館",
      "藤子・F・不二雄ミュージアム",
      "藤子·F·不二雄ミュージアム"
    ],
    "sourceIds": [
      "place:content_object:D147-P062"
    ]
  },
  "place:content_object:D147-P048": {
    "names": [
      "横滨竞技场",
      "橫滨竞技场",
      "橫濱競技場",
      "横浜アリーナ",
      "橫濱アリーナ",
      "横滨アリーナ",
      "Yokohama Arena",
      "YokohamaArena",
      "横アリ",
      "橫アリ"
    ],
    "sourceIds": [
      "place:content_object:D147-P048"
    ]
  },
  "place:content_object:D147-P065": {
    "names": [
      "千叶市动物公园",
      "千葉市動物公園",
      "千叶动物公园",
      "千葉動物公園"
    ],
    "sourceIds": [
      "place:content_object:D147-P065"
    ]
  },
  "place:content_object:D147-P074": {
    "names": [
      "埼玉超级竞技场",
      "埼玉超級競技場",
      "さいたまスーパーアリーナ",
      "Saitama Super Arena",
      "SaitamaSuperArena"
    ],
    "sourceIds": [
      "place:content_object:D147-P074"
    ]
  },
  "place:content_object:D147-P071": {
    "names": [
      "武藏一宫冰川神社",
      "武藏一宮冰川神社",
      "武蔵一宮氷川神社",
      "武蔵一宫氷川神社",
      "武蔵一宮 氷川神社",
      "武藏一宮 冰川神社",
      "武藏一宫 冰川神社",
      "武蔵一宫 氷川神社",
      "大宫冰川神社",
      "大宮冰川神社",
      "大宮氷川神社",
      "大宫氷川神社"
    ],
    "sourceIds": [
      "place:content_object:D147-P071"
    ]
  },
  "place:content_object:D149-C12-03": {
    "names": [
      "コクーンシティ",
      "COCOON CITY购物中心",
      "COCOONCITY购物中心",
      "COCOON CITY購物中心",
      "COCOONCITY購物中心",
      "コクーンシティ外部",
      "コクーンシティ公共内部",
      "コクーンシティ公共內部"
    ],
    "sourceIds": [
      "place:content_object:D149-C12-03"
    ]
  },
  "map:tokyo-v2.2:386810": {
    "names": [
      "東京科學博物館"
    ],
    "sourceIds": [
      "map:tokyo-v2.2:386810"
    ]
  },
  "map:tokyo-v2.2:382359": {
    "names": [
      "東京巨蛋棒球場"
    ],
    "sourceIds": [
      "map:tokyo-v2.2:382359"
    ]
  },
  "map:tokyo-v2.2:156369": {
    "names": [
      "パルコ"
    ],
    "sourceIds": [
      "map:tokyo-v2.2:156369"
    ]
  },
  "map:japan-v3:1497453": {
    "names": [
      "横滨八景岛海岛乐园",
      "橫濱八景島海島樂園"
    ],
    "sourceIds": [
      "map:japan-v3:1497453"
    ]
  },
  "map:japan-v3:1673514": {
    "names": [
      "Fujiko.f.fujio Doraemon Museum"
    ],
    "sourceIds": [
      "map:japan-v3:1673514"
    ]
  },
  "map:tokyo-v2.2:legacy:79,667.5:1:%E8%97%A4%E5%AD%90%C2%B7F%C2%B7%E4%B8%8D%E4%BA%8C%E9%9B%84%E5%8D%9A%E7%89%A9%E9%A6%86::": {
    "names": [
      "藤子·F·不二雄博物馆"
    ],
    "sourceIds": [
      "map:tokyo-v2.2:legacy:79,667.5:1:%E8%97%A4%E5%AD%90%C2%B7F%C2%B7%E4%B8%8D%E4%BA%8C%E9%9B%84%E5%8D%9A%E7%89%A9%E9%A6%86::"
    ]
  }
};
export const secondaryDisplayDetailPaths = [...new Set([
  "canonical/points/11/unlocated_0.json.gz",
  "canonical/points/12/unlocated_0.json.gz",
  "canonical/points/13/0_0_21.json.gz",
  "canonical/points/13/0_0_22.json.gz",
  "canonical/points/13/0_0_33.json.gz",
  "canonical/points/13/0_0_4.json.gz",
  "canonical/points/13/unlocated_0.json.gz",
  "canonical/points/14/0_0_1.json.gz",
  "canonical/points/14/0_1_1.json.gz",
  "canonical/points/14/unlocated_0.json.gz",
  ...reviewedDisplayAdditions.map(row => row.detailPath),
])];

const reviewedRows = [
  ...[...livingPlaceDisplayRepresentatives.map(row => [row.oldId, row.canonicalId]), ...nearbyRepresentatives]
    .map(([oldId, targetId]) => ({ oldId, targetId, ...oldDisplayRows[oldId] })),
  ...reviewedDisplayAdditions,
];
const representatives = new Map();
const additions = new Map();
for (const row of reviewedRows) {
  const { oldId, targetId } = row;
  for (const id of [oldId, ...row.sourceIds]) if (id !== targetId) representatives.set(id, targetId);
  const entry = additions.get(targetId) || { names: [], sourceIds: [] };
  entry.names.push(...row.names);
  entry.sourceIds.push(oldId, ...row.sourceIds);
  additions.set(targetId, entry);
}
const unique = values => [...new Set(values.filter(Boolean))];
export const displayRepresentativeId = id => representatives.get(id) || id;
export const isSecondaryDisplayPoint = value => representatives.has(typeof value === 'string' ? value : value?.id || value?.placeId);
export const hiddenAggregateDisplayIds = unique([
  ...['D147-P005', 'D147-P017', 'D147-P044', 'D147-P055', 'D147-P067'].map(id => `place:content_object:${id}`),
  ...reviewedHiddenAggregateIds,
]);
const hiddenAggregates = new Set(hiddenAggregateDisplayIds);
export const isHiddenAggregateDisplayPoint = value => hiddenAggregates.has(typeof value === 'string' ? value : value?.id || value?.placeId);

export function augmentDisplayRepresentative(row) {
  const extra = additions.get(row?.id);
  if (!extra) return row;
  return { ...row,
    aliases: unique([...(row.aliases || []), ...extra.names]).filter(name => name !== row.name),
    sourceIds: unique([row.id, ...(row.sourceIds || []), ...extra.sourceIds]),
    ...(row.allSourceIds ? { allSourceIds: unique([...row.allSourceIds, ...extra.sourceIds]) } : {}),
  };
}
