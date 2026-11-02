// LJ-LIVING-AREA-RETIREMENT-20261031: retire runtime use; preserve source files and saved-slot identities.
const prefix = 'place:editorial_area:';
const ownIds = value => typeof value === 'string' ? [value] : [value?.id, value?.placeId, value?.ownerPlaceId].filter(Boolean);

export function isRetiredLivingArea(value) {
  return value?.kind === 'editorial_area' || ownIds(value).some(id => typeof id === 'string' && id.startsWith(prefix));
}

export function createLivingAreaRetirement(data = {}) {
  const places = (data.places || []).filter(isRetiredLivingArea);
  const placeIds = new Set(places.flatMap(ownIds));
  const retired = value => isRetiredLivingArea(value) || ownIds(value).some(id => placeIds.has(id));
  const packages = (data.packages || []).filter(retired);
  for (const item of packages) if (item.placeId) placeIds.add(item.placeId);
  const packageIds = new Set(packages.map(item => item.id));
  const bodyRecordIds = new Set([
    ...packages.map(item => item.bodyRecordId),
    ...(data.bodyRecords || []).filter(row => retired(row) || packageIds.has(row.packageId)).map(row => row.bodyRecordId),
  ].filter(Boolean));
  const candidates = new Set([...places, ...packages].flatMap(row => row.controlGroupIds || []));
  const retainedGroups = new Set((data.packages || []).filter(item => !packageIds.has(item.id)).flatMap(item => item.controlGroupIds || []));
  const controlGroupIds = new Set([...candidates].filter(id => !retainedGroups.has(id)));
  const slotKeys = new Set(Object.entries(data.editableTextSlots?.slots || {}).filter(([, slot]) => packageIds.has(slot.packageId)).map(([key]) => key));
  return { placeIds, packageIds, bodyRecordIds, controlGroupIds, slotKeys };
}

export function retireLivingAreaRuntime(data = {}) {
  const policy = createLivingAreaRetirement(data);
  const retired = value => isRetiredLivingArea(value) || ownIds(value).some(id => policy.placeIds.has(id));
  const runtime = { ...data };
  if (data.places) runtime.places = data.places.filter(row => !retired(row));
  if (data.packages) runtime.packages = data.packages.filter(row => !retired(row) && !policy.packageIds.has(row.id));
  if (data.bodyRecords) runtime.bodyRecords = data.bodyRecords.filter(row => !retired(row) && !policy.bodyRecordIds.has(row.bodyRecordId) && !policy.packageIds.has(row.packageId));
  if (data.controlGroups) runtime.controlGroups = data.controlGroups.filter(row => !policy.controlGroupIds.has(row.controlGroupId)).map(row => {
    if (!row.memberPackageIds?.some(id => policy.packageIds.has(id))) return row;
    const memberPackageIds = row.memberPackageIds.filter(id => !policy.packageIds.has(id));
    return { ...row, memberPackageIds, ...(Number.isFinite(row.globalMemberCount) ? { globalMemberCount: row.globalMemberCount - row.memberPackageIds.length + memberPackageIds.length } : {}) };
  });
  if (data.locationBrowse?.areas) runtime.locationBrowse = { ...data.locationBrowse, areas: data.locationBrowse.areas.filter(row => !retired(row)) };
  if (data.canonicalPlaceContexts) {
    const contexts = data.canonicalPlaceContexts;
    const cleanRow = row => row.related?.some(retired) ? { ...row, related: row.related.filter(edge => !retired(edge)) } : row;
    const rows = Array.isArray(contexts.rows)
      ? contexts.rows.filter(row => !retired(row)).map(cleanRow)
      : Object.fromEntries(Object.entries(contexts.rows || {}).filter(([id, row]) => !retired(id) && !retired(row)).map(([id, row]) => [id, cleanRow(row)]));
    const aliases = Object.fromEntries(Object.entries(contexts.aliases || {}).filter(([id, target]) => !retired(id) && !retired(target)));
    runtime.canonicalPlaceContexts = { ...contexts, rows, aliases };
  }
  return runtime;
}

export const livingPlaceDisplayRepresentatives = [
  {
    "oldId": "place:content_object:D147-P033",
    "canonicalId": "osm:way:203960902",
    "displayName": "国立科学博物馆",
    "packageIds": [
      "LT_IN_VENUE_036"
    ],
    "packageEvidence": [
      {
        "id": "LT_IN_VENUE_036",
        "title": "国立科学博物馆",
        "bodySha256": "3797e4a9f70ea28e1c9b74770c11e739605e5be3852b099260d5cf168157934e"
      }
    ]
  },
  {
    "oldId": "place:content_object:D147-P019",
    "canonicalId": "osm:way:43896730",
    "displayName": "日本武道馆",
    "packageIds": [
      "LT_IN_VENUE_001"
    ],
    "packageEvidence": [
      {
        "id": "LT_IN_VENUE_001",
        "title": "日本武道馆",
        "bodySha256": "1f57cf46eb83eddaf5f648ade71c0f02ae6eae3a3ff00dc8dc594bf6a8cc6886"
      }
    ]
  },
  {
    "oldId": "place:content_object:D151-S03-05",
    "canonicalId": "osm:way:451564412",
    "displayName": "涩谷PARCO",
    "packageIds": [
      "LJ_METRO_D151_S03_05"
    ],
    "packageEvidence": [
      {
        "id": "LJ_METRO_D151_S03_05",
        "title": "涩谷PARCO",
        "bodySha256": "40afb1a3be0a227c8dbfc55c89302dcf5f355cfbcaead2605e9ca264259dfa28"
      }
    ]
  },
  {
    "oldId": "place:content_object:D147-P013",
    "canonicalId": "osm:relation:13893938",
    "displayName": "台场海滨公园",
    "packageIds": [
      "LT_EX_VENUE_019"
    ],
    "packageEvidence": [
      {
        "id": "LT_EX_VENUE_019",
        "title": "台场海滨公园",
        "bodySha256": "4f70418361edb6a5cff1f37888106c84cb4ecd25af4e504cf9ade176b595504f"
      }
    ]
  },
  {
    "oldId": "place:content_object:D149-B18-03",
    "canonicalId": "osm:way:606978548",
    "displayName": "筑地场外市场",
    "packageIds": [
      "LJ_METRO_D149_B18_L03"
    ],
    "packageEvidence": [
      {
        "id": "LJ_METRO_D149_B18_L03",
        "title": "筑地场外市场",
        "bodySha256": "d24a495465e5a309b8194d5b895401d0ea5ebb01d6844d42bf977e71178b0bad"
      }
    ]
  },
  {
    "oldId": "place:content_object:D147-P010",
    "canonicalId": "osm:relation:2797943",
    "displayName": "国营昭和纪念公园",
    "packageIds": [
      "LT_EX_VENUE_016"
    ],
    "packageEvidence": [
      {
        "id": "LT_EX_VENUE_016",
        "title": "国营昭和纪念公园",
        "bodySha256": "19c23f905d64bf98c01be5391a259e07fb1f54178dcb449ec1d9c9f6fd954900"
      }
    ]
  },
  {
    "oldId": "place:content_object:D147-P018",
    "canonicalId": "osm:way:35548710",
    "displayName": "江户东京建筑园",
    "packageIds": [
      "LT_EX_VENUE_032"
    ],
    "packageEvidence": [
      {
        "id": "LT_EX_VENUE_032",
        "title": "江户东京建筑园",
        "bodySha256": "88e7ced80fedfac81b267247bba47ffd8e9079193023b64bf77435f7899effda"
      }
    ]
  },
  {
    "oldId": "place:content_object:D148-TYO-089",
    "canonicalId": "osm:node:6319618885",
    "displayName": "东京国际论坛",
    "packageIds": [
      "LJ_METRO_D148_TYO_089_EX",
      "LJ_METRO_D148_TYO_089_IN"
    ],
    "packageEvidence": [
      {
        "id": "LJ_METRO_D148_TYO_089_EX",
        "title": "东京国际论坛外部",
        "bodySha256": "b4b6494a286b5f08ac6d70a1c4f2d2bb2d23de9e9ef343b9c093bb0011f24816"
      },
      {
        "id": "LJ_METRO_D148_TYO_089_IN",
        "title": "东京国际论坛公共内部",
        "bodySha256": "fc3ce622db9ad02e115e70db1161099ef47199a50bc4f192daaca31afe7302a1"
      }
    ]
  },
  {
    "oldId": "place:content_object:D148-YOK-01",
    "canonicalId": "osm:node:10216454044",
    "displayName": "横滨红砖仓库",
    "packageIds": [
      "LJ_METRO_D148_YOK_01_EX",
      "LJ_METRO_D148_YOK_01_IN"
    ],
    "packageEvidence": [
      {
        "id": "LJ_METRO_D148_YOK_01_EX",
        "title": "横滨红砖仓库外部与红砖公园",
        "bodySha256": "dcaa0b2357f00d563008fe56ba0fbf5efc179072ea37b8f923d5558dcc7bc280"
      },
      {
        "id": "LJ_METRO_D148_YOK_01_IN",
        "title": "横滨红砖仓库1号馆与2号馆内部",
        "bodySha256": "ccc2aba37932fac7339ffdfdaf36e86d6b256973b200a9372de77e8fa7c21070"
      }
    ]
  },
  {
    "oldId": "place:content_object:D149-B05-03",
    "canonicalId": "osm:way:445258887",
    "displayName": "横滨中华街",
    "packageIds": [
      "LJ_METRO_D149_B05_L03"
    ],
    "packageEvidence": [
      {
        "id": "LJ_METRO_D149_B05_L03",
        "title": "横滨中华街",
        "bodySha256": "de84203d1a3c83975d7449af67a20dff1428e500d3d9a075aa4de6b17e66bc6b"
      }
    ]
  },
  {
    "oldId": "place:content_object:D147-P057",
    "canonicalId": "map:japan-v3:1604046",
    "displayName": "LAZONA川崎",
    "packageIds": [
      "LT_EX_VENUE_035",
      "LT_IN_VENUE_050"
    ],
    "packageEvidence": [
      {
        "id": "LT_EX_VENUE_035",
        "title": "LAZONA川崎站连廊与室外广场",
        "bodySha256": "7c1aaa74894148516f6955d583d563305bb5d08e4f7f35064bafc80f841876c3"
      },
      {
        "id": "LT_IN_VENUE_050",
        "title": "LAZONA川崎共享商业内部",
        "bodySha256": "c4205c3ef503fdb5807f79d8759469d61d58f48bdc43f76fdc6dabc4d16f3778"
      }
    ]
  },
  {
    "oldId": "place:content_object:D147-P062",
    "canonicalId": "osm:way:1551428983",
    "displayName": "川崎市藤子·F·不二雄博物馆",
    "packageIds": [
      "LT_IN_VENUE_042"
    ],
    "packageEvidence": [
      {
        "id": "LT_IN_VENUE_042",
        "title": "川崎市藤子·F·不二雄博物馆",
        "bodySha256": "f84a312326cf7fd6b3e25de105b3b98aeeadbb78276345ae0dec71e7f45bf5e6"
      }
    ]
  },
  {
    "oldId": "place:content_object:D147-P048",
    "canonicalId": "osm:way:123630243",
    "displayName": "横滨竞技场",
    "packageIds": [
      "LT_IN_VENUE_005"
    ],
    "packageEvidence": [
      {
        "id": "LT_IN_VENUE_005",
        "title": "横滨竞技场",
        "bodySha256": "341ab7457986990e35fafcd11a0eb362330979e68c2dbcdd6194af5de0e14f91"
      }
    ]
  },
  {
    "oldId": "place:content_object:D147-P065",
    "canonicalId": "osm:way:471714222",
    "displayName": "千叶市动物公园",
    "packageIds": [
      "LT_EX_VENUE_005"
    ],
    "packageEvidence": [
      {
        "id": "LT_EX_VENUE_005",
        "title": "千叶市动物公园",
        "bodySha256": "45722ea71b24a872458e69db22f4f4920c20096fb120835df9900bef703f2820"
      }
    ]
  },
  {
    "oldId": "place:content_object:D147-P074",
    "canonicalId": "osm:way:23876795",
    "displayName": "埼玉超级竞技场",
    "packageIds": [
      "LT_IN_VENUE_054"
    ],
    "packageEvidence": [
      {
        "id": "LT_IN_VENUE_054",
        "title": "埼玉超级竞技场",
        "bodySha256": "481a574e232813ea1f1af4b5ff6ed8796566a9629e7b8949a788d72d224a30e5"
      }
    ]
  },
  {
    "oldId": "place:content_object:D147-P071",
    "canonicalId": "osm:way:1258998074",
    "displayName": "武藏一宫冰川神社",
    "packageIds": [
      "LT_EX_VENUE_037"
    ],
    "packageEvidence": [
      {
        "id": "LT_EX_VENUE_037",
        "title": "武藏一宫冰川神社",
        "bodySha256": "d28cac90d73a1810c9a873834140edd25b503db58e0dae0cd307fd479ddf323a"
      }
    ]
  },
  {
    "oldId": "place:content_object:D149-C12-03",
    "canonicalId": "map:japan-v3:2201254",
    "displayName": "Cocoon City",
    "packageIds": [
      "LJ_METRO_D149_C12_L03",
      "LJ_METRO_D149_C12_L04"
    ],
    "packageEvidence": [
      {
        "id": "LJ_METRO_D149_C12_L03",
        "title": "コクーンシティ外部",
        "bodySha256": "5dfb5a172efe41396f227aa85e43515b353970d8bf657c9b39ca61c2567cd86a"
      },
      {
        "id": "LJ_METRO_D149_C12_L04",
        "title": "コクーンシティ公共内部",
        "bodySha256": "eb4630fda8a9640fc6a4b3e5fe7fa743063c057510c88159408f5474f143ce63"
      }
    ]
  }
];
