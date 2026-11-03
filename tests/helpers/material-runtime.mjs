// Public test fixture: production engine defaults with zero builtin bodies and places.
// Omits map/text-conversion corpora; no test here depends on those resources.
const runtime = {
  "productId": "living-japan",
  "releaseId": "living-japan-v3.6",
  "version": "v3.6",
  "schemaVersion": 4,
  "settingsKey": "livingJapanSettings",
  "textOverrideKey": "livingJapanTextOverrides",
  "textOverrideFormat": "living-japan-text-overrides",
  "uiPreferencesKey": "livingJapanUIPreferences",
  "macroName": "livingjapan",
  "outputTag": "background_element",
  "layerOrder": [
    "TN",
    "EX",
    "IN",
    "EV"
  ],
  "wrappers": {
    "background": {
      "bottom": "以上资料不代表人物当前必然身处其中。只在与已有剧情一致时自然融入。",
      "label": "背景（默认）",
      "top": "以下资料只为当前剧情提供空间、季节、场所和现场质感参考，可按需选用，也可完全不用。"
    },
    "brief": {
      "bottom": "禁止因这些资料延长场景、转移叙事重心或补造人物行动。",
      "label": "简写",
      "top": "以下环境资料只作轻微底色。若与当前剧情相符，从中选取少量最有用的细节；不合适时完全不用。"
    },
    "detailed": {
      "bottom": "细写只增加环境的清晰度，与改变场景、时间、事件与人物选择无关，禁止逐项逐字复述，禁止为使用资料而拖停剧情。",
      "label": "细写",
      "top": "当前场景需要较细描写时，可参考以下环境资料，从空间远近、光线、空气、声音、材质和人群中选取相互协调的细节；不适用的内容仍可舍弃。"
    },
    "standard": {
      "bottom": "资料是背景候选，不是剧情事实清单。禁止逐项逐字复述，也不替人物决定行动、情绪、关系或结果。",
      "label": "标准",
      "top": "以下环境资料可用于补足当前场景的空间、光线、天气、声响与现场质感。只采用与已有时间、地点和事件一致的部分，使环境自然进入叙述。"
    }
  },
  "defaultSettings": {
    "channelTags": {
      "EV": {
        "excluded": [
          "thinking",
          "think",
          "think_fox~",
          "Prism",
          "prism",
          "branches",
          "subtext_think",
          "random_signal",
          "analysis",
          "reasoning",
          "tucao",
          "konatan_planning~",
          "logic_check",
          "IzumiEdit",
          "options",
          "echo",
          "electric",
          "snow"
        ],
        "priority": [
          "time_format",
          "title"
        ]
      },
      "EX": {
        "excluded": [
          "thinking",
          "think",
          "think_fox~",
          "Prism",
          "prism",
          "branches",
          "subtext_think",
          "random_signal",
          "analysis",
          "reasoning",
          "tucao",
          "konatan_planning~",
          "logic_check",
          "IzumiEdit",
          "options",
          "echo",
          "electric",
          "snow"
        ],
        "priority": [
          "time_format",
          "title"
        ]
      },
      "IN": {
        "excluded": [
          "thinking",
          "think",
          "think_fox~",
          "Prism",
          "prism",
          "branches",
          "subtext_think",
          "random_signal",
          "analysis",
          "reasoning",
          "tucao",
          "konatan_planning~",
          "logic_check",
          "IzumiEdit",
          "options",
          "echo",
          "electric",
          "snow"
        ],
        "priority": [
          "time_format",
          "title"
        ]
      },
      "TN": {
        "excluded": [
          "thinking",
          "think",
          "think_fox~",
          "Prism",
          "prism",
          "branches",
          "subtext_think",
          "random_signal",
          "analysis",
          "reasoning",
          "tucao",
          "konatan_planning~",
          "logic_check",
          "IzumiEdit",
          "options",
          "echo",
          "electric",
          "snow"
        ],
        "priority": [
          "time_format",
          "title"
        ]
      }
    },
    "currentUserBoundary": {
      "end": "</本轮用户输入>",
      "start": "<本轮用户输入>"
    },
    "diagnostics": true,
    "groups": {},
    "historyDepth": 4,
    "layers": {
      "EV": true,
      "EX": true,
      "IN": true,
      "TN": true
    },
    "masterEnabled": true,
    "namedPlaceBodiesEnabled": true,
    "packages": {},
    "schemaVersion": 4,
    "textScript": "simplified",
    "wrapperMode": "background"
  },
  "defaultUIPreferences": {
    "onboardingDismissed": false,
    "panelGeometry": {
      "horizontal": null,
      "vertical": null
    },
    "panelLayoutMode": "horizontal",
    "panelPinned": false,
    "sakuraFabDockEdge": null,
    "sakuraFabPosition": null,
    "schemaVersion": 4,
    "transitFavoritePlaces": [],
    "uiThemePreference": "auto"
  },
  "settingsMigration": {
    "legacyV2": {
      "exactExcluded": [
        "thinking",
        "think",
        "think_fox~",
        "Prism",
        "prism",
        "branches",
        "subtext_think",
        "random_signal",
        "analysis",
        "reasoning",
        "tucao",
        "konatan_planning~",
        "logic_check",
        "IzumiEdit",
        "options",
        "echo"
      ],
      "exactPriorityByLayer": {
        "EV": [
          "time_format",
          "title",
          "Slate",
          "明确场景事件",
          "当前事件",
          "event_context"
        ],
        "EX": [
          "time_format",
          "title",
          "Slate",
          "外部地域",
          "当前地点",
          "location_context"
        ],
        "IN": [
          "time_format",
          "title",
          "Slate",
          "内部场所",
          "当前场所",
          "venue_context"
        ],
        "TN": [
          "time_format",
          "title",
          "UpdateVariable",
          "Slate",
          "时间与自然",
          "时间天气",
          "当前时间",
          "time_context"
        ]
      }
    },
    "schemaVersion": 1,
    "singletonPolicy": "migrate_legacy_group_and_package_once_then_keep_group_open",
    "targetSettingsSchemaVersion": 4
  },
  "regionMarkers": [
    {
      "regionId": "TOKYO",
      "triggers": [
        "东京都",
        "東京都",
        "东京",
        "東京"
      ]
    },
    {
      "regionId": "KAWASAKI",
      "triggers": [
        "川崎市",
        "川崎区",
        "川崎"
      ]
    },
    {
      "regionId": "YOKOHAMA",
      "triggers": [
        "横滨市",
        "横浜市",
        "横滨",
        "横浜"
      ]
    },
    {
      "regionId": "CHIBA",
      "triggers": [
        "千叶县",
        "千葉県",
        "千叶市",
        "千葉市",
        "千叶",
        "千葉"
      ]
    },
    {
      "regionId": "SAITAMA",
      "triggers": [
        "埼玉县",
        "埼玉県",
        "埼玉市",
        "さいたま市",
        "埼玉",
        "さいたま"
      ]
    },
    {
      "regionId": "KANAGAWA",
      "triggers": [
        "神奈川县",
        "神奈川県",
        "神奈川",
        "相模原市",
        "相模原"
      ]
    }
  ],
  "locationTimeFocus": {
    "dataId": "LIVING_JAPAN_V1_EMPTY_LOCATION_TIME_FOCUS",
    "outputTag": "location_time_fit",
    "records": [],
    "reviewedCandidatePackageIds": [],
    "schemaVersion": 1,
    "sourceRegistryBodyCorpusSha256": "e6b2b5f45fa46559bc5178579d56f71ed1620a54e56bb1b772a195d8e6a13888"
  },
  "packages": [],
  "places": [],
  "adminNodes": [],
  "controlGroups": [],
  "bodyRecords": [],
  "calendarSegments": [],
  "runtimeContextAnchors": [],
  "walkingInterests": [],
  "textConversion": {},
  "groupLabels": {},
  "editableTextSlots": {
    "schemaVersion": 1,
    "slots": {},
    "staticCount": 0,
    "calendarCount": 0,
    "slotCount": 0
  },
  "runtimeTextManifest": {
    "schemaVersion": 1,
    "bodies": {},
    "summaries": {}
  },
  "locationBrowse": {
    "schemaVersion": 1,
    "regions": [],
    "areas": [],
    "objects": []
  }
};

export const emptyMaterialRuntime = () => structuredClone(runtime);
