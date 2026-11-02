// Generated from the dispatched classification contract; rebuild with scripts/build-venue-material-catalog.mjs.
export const VENUE_MATERIAL_SOURCE = {
  "path": "工程表/行政区重建/共用/classification-contract-index.json",
  "sha256": "6f3b86538a89358763ad8d4ec7f85700fdb761887e929cd138c45b8df7cdb0a3",
  "canonicalPurposeCount": 602,
  "materialTagCount": 28,
  "aliasCount": 114
};

export const VENUE_MATERIAL_CATEGORIES = [
  {
    "id": "in.food",
    "name": "餐饮场所",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.food.cafe",
    "name": "咖啡与茶饮店",
    "parentId": "in.food",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "咖啡馆与喫茶店",
      "喫茶店"
    ],
    "description": "咖啡馆、茶室和现制茶饮等饮品店。"
  },
  {
    "id": "in.food.tea-drinks",
    "name": "茶饮店",
    "parentId": "in.food.cafe",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "以现制茶饮等饮品为主要用途的店铺。"
  },
  {
    "id": "metro.detail.cat.咖.cafe",
    "name": "咖啡馆",
    "parentId": "in.food.cafe",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.咖.tea_room",
    "name": "茶室",
    "parentId": "in.food.cafe",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.food.curry",
    "name": "咖喱店",
    "parentId": "in.food",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.food.diner",
    "name": "食堂与定食店",
    "parentId": "in.food",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.cafeteria",
    "name": "自助食堂",
    "parentId": "in.food.diner",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.food.food-hall",
    "name": "餐饮集合设施",
    "parentId": "in.food",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.food_court",
    "name": "美食广场",
    "parentId": "in.food.food-hall",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.food.noodles",
    "name": "面食店",
    "parentId": "in.food",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.ramen_restaurant",
    "name": "拉面店",
    "parentId": "in.food.noodles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.soba_restaurant",
    "name": "荞麦面店",
    "parentId": "in.food.noodles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.udon_restaurant",
    "name": "乌冬面店",
    "parentId": "in.food.noodles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.food.restaurant",
    "name": "餐厅",
    "parentId": "in.food",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.american_restaurant",
    "name": "美式餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.asian_restaurant",
    "name": "亚洲料理餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.chinese_restaurant",
    "name": "中餐厅",
    "parentId": "metro.detail.cat.食.asian_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.dim_sum_restaurant",
    "name": "点心茶楼",
    "parentId": "metro.detail.cat.食.chinese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.indian_restaurant",
    "name": "印度餐厅",
    "parentId": "metro.detail.cat.食.asian_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.korean_restaurant",
    "name": "韩式餐厅",
    "parentId": "metro.detail.cat.食.asian_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.nepalese_restaurant",
    "name": "尼泊尔餐厅",
    "parentId": "metro.detail.cat.食.asian_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.taiwanese_restaurant",
    "name": "台湾料理餐厅",
    "parentId": "metro.detail.cat.食.asian_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.thai_restaurant",
    "name": "泰式餐厅",
    "parentId": "metro.detail.cat.食.asian_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.turkish_restaurant",
    "name": "土耳其餐厅",
    "parentId": "metro.detail.cat.食.asian_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.vietnamese_restaurant",
    "name": "越南餐厅",
    "parentId": "metro.detail.cat.食.asian_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.bar_and_grill_restaurant",
    "name": "酒吧烧烤餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.barbecue_restaurant",
    "name": "烧烤店",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.breakfast_and_brunch_restaurant",
    "name": "早餐早午餐店",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.burger_restaurant",
    "name": "汉堡店",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.chicken_restaurant",
    "name": "鸡肉料理店",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.dumpling_restaurant",
    "name": "饺子馆",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.european_restaurant",
    "name": "欧洲料理餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.french_restaurant",
    "name": "法式餐厅",
    "parentId": "metro.detail.cat.食.european_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.italian_restaurant",
    "name": "意式餐厅",
    "parentId": "metro.detail.cat.食.european_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.spanish_restaurant",
    "name": "西班牙餐厅",
    "parentId": "metro.detail.cat.食.european_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.family_restaurant",
    "name": "家庭餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.fast_food",
    "name": "快餐店",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.health_food_restaurant",
    "name": "健康餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.hotpot_restaurant",
    "name": "锅物料理店",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.international_fusion_restaurant",
    "name": "国际融合料理餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.japanese_restaurant",
    "name": "日式餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.donburi_restaurant",
    "name": "盖饭店",
    "parentId": "metro.detail.cat.食.japanese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.okonomiyaki_restaurant",
    "name": "什锦烧店",
    "parentId": "metro.detail.cat.食.japanese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "大阪烧店",
      "御好烧店",
      "お好み焼き"
    ],
    "description": "提供日式什锦煎饼料理的餐饮店。"
  },
  {
    "id": "metro.detail.cat.食.sushi_restaurant",
    "name": "寿司店",
    "parentId": "metro.detail.cat.食.japanese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.tempura_restaurant",
    "name": "天妇罗店",
    "parentId": "metro.detail.cat.食.japanese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.teppanyaki_restaurant",
    "name": "铁板烧店",
    "parentId": "metro.detail.cat.食.japanese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.tonkatsu_restaurant",
    "name": "炸猪排店",
    "parentId": "metro.detail.cat.食.japanese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.unagi_restaurant",
    "name": "鳗鱼料理店",
    "parentId": "metro.detail.cat.食.japanese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.western_restaurant",
    "name": "日式洋食店",
    "parentId": "metro.detail.cat.食.japanese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.yakiniku_restaurant",
    "name": "烤肉店",
    "parentId": "metro.detail.cat.食.japanese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.yakitori_restaurant",
    "name": "烤鸡串店",
    "parentId": "metro.detail.cat.食.japanese_restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.mexican_restaurant",
    "name": "墨西哥餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.pizza_restaurant",
    "name": "披萨店",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.seafood_restaurant",
    "name": "海鲜餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.steakhouse",
    "name": "牛排馆",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.theme_restaurant",
    "name": "主题餐厅",
    "parentId": "in.food.restaurant",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.food.sweets-bakery",
    "name": "甜品与烘焙店",
    "parentId": "in.food",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "甜品与面包店"
    ],
    "description": "甜品、面包和糕点等店铺。"
  },
  {
    "id": "metro.detail.cat.svc.confectionery",
    "name": "糖果糕点店",
    "parentId": "in.food.sweets-bakery",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.包.bakery",
    "name": "面包店",
    "parentId": "in.food.sweets-bakery",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.pastry",
    "name": "糕点店",
    "parentId": "in.food.sweets-bakery",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.dessert_shop",
    "name": "甜品店",
    "parentId": "in.food.sweets-bakery",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.ice_cream",
    "name": "冰淇淋店",
    "parentId": "in.food.sweets-bakery",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.japanese_confectionery_shop",
    "name": "和式点心店",
    "parentId": "in.food.sweets-bakery",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.shaved_ice_shop",
    "name": "刨冰店",
    "parentId": "in.food.sweets-bakery",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.drinking",
    "name": "饮酒与酒吧场所",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.drinking.brewpub",
    "name": "酿造与饮酒结合场所",
    "parentId": "in.drinking",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.drinking.community-bar",
    "name": "社群酒吧",
    "parentId": "in.drinking",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.gay_bar",
    "name": "同志酒吧",
    "parentId": "in.drinking.community-bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.drinking.girls-bar",
    "name": "女郎酒吧",
    "parentId": "in.drinking",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "ガールズバー"
    ],
    "description": "吧台型饮酒交谈场所，不由名称推断法定接待或性服务。"
  },
  {
    "id": "in.drinking.music-bar",
    "name": "音乐酒吧",
    "parentId": "in.drinking",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.drinking.snack-bar",
    "name": "小酒吧",
    "parentId": "in.drinking",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "スナック"
    ],
    "description": "小型夜间饮酒交谈场所，不由名称推断法定接待。"
  },
  {
    "id": "in.drinking.standing",
    "name": "立饮店",
    "parentId": "in.drinking",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.drinking.tasting",
    "name": "酒类品饮空间",
    "parentId": "in.drinking",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.food.bar",
    "name": "酒吧与小酒馆",
    "parentId": "in.drinking",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.bar",
    "name": "酒吧",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.beer_bar",
    "name": "啤酒吧",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.beer_garden",
    "name": "啤酒花园",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.cocktail_bar",
    "name": "鸡尾酒吧",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.hookah_bar",
    "name": "水烟吧",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.hotel_bar",
    "name": "酒店酒吧",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.irish_pub",
    "name": "爱尔兰酒馆",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.lounge",
    "name": "休闲酒廊",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.pub",
    "name": "酒馆",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.sake_bar",
    "name": "清酒吧",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "居酒屋",
      "日本酒吧"
    ],
    "description": "以清酒品饮为主要形态的酒吧，与居酒屋分别保留。"
  },
  {
    "id": "metro.detail.cat.酒.speakeasy",
    "name": "隐蔽酒吧",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.sports_bar",
    "name": "体育酒吧",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.whiskey_bar",
    "name": "威士忌酒吧",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.wine_bar",
    "name": "葡萄酒吧",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.gastropub",
    "name": "餐饮酒馆",
    "parentId": "in.food.bar",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.food.hosted-bar",
    "name": "接待型酒吧",
    "parentId": "in.drinking",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.food.hosted-bar.host-club",
    "name": "男公关俱乐部",
    "parentId": "in.food.hosted-bar",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "ホストクラブ"
    ],
    "description": "以男公关接待交谈和饮酒为主要经营形态的场所。"
  },
  {
    "id": "in.food.hosted-bar.hostess-lounge",
    "name": "陪侍酒廊",
    "parentId": "in.food.hosted-bar",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "ラウンジ",
      "接待型クラブ"
    ],
    "description": "具有陪侍交谈经营形态的酒廊或俱乐部，不代表所有同名场所。"
  },
  {
    "id": "in.food.hosted-bar.kyabakura",
    "name": "女公关俱乐部",
    "parentId": "in.food.hosted-bar",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "キャバクラ"
    ],
    "description": "以女公关接待交谈和饮酒为主要经营形态的场所。"
  },
  {
    "id": "in.food.izakaya",
    "name": "居酒屋",
    "parentId": "in.drinking",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail",
    "name": "日常零售与市场",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail.convenience",
    "name": "便利店",
    "parentId": "in.retail",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail.daily-goods",
    "name": "日用品店",
    "parentId": "in.retail",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.discount_store",
    "name": "折扣店",
    "parentId": "in.retail.daily-goods",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.home_goods_store",
    "name": "家居用品店",
    "parentId": "in.retail.daily-goods",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.houseware",
    "name": "家庭用品店",
    "parentId": "in.retail.daily-goods",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.variety_store",
    "name": "杂货百货店",
    "parentId": "in.retail.daily-goods",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail.direct-sales",
    "name": "农水产品直卖所",
    "parentId": "in.retail",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.办.agricultural_cooperative",
    "name": "农业合作社",
    "parentId": "in.retail.direct-sales",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.farmers_market",
    "name": "农畜产品直卖店",
    "parentId": "in.retail.direct-sales",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail.drugstore",
    "name": "药妆店",
    "parentId": "in.retail",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.pharmacy_and_drug_store",
    "name": "药妆店",
    "parentId": "in.retail.drugstore",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail.food-shop",
    "name": "食品专门店",
    "parentId": "in.retail",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.alcohol",
    "name": "酒类专卖店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.beverages",
    "name": "饮料店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.butcher",
    "name": "肉店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.cheese_shop",
    "name": "奶酪店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.coffee",
    "name": "咖啡豆店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.deli",
    "name": "熟食店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.fishmonger",
    "name": "鲜鱼店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.food_and_beverage_store",
    "name": "食品饮料店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.greengrocer",
    "name": "蔬果店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.grocery_store",
    "name": "食品杂货店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.health_food",
    "name": "健康食品店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.organic_grocery_store",
    "name": "有机食品店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "以有机食品零售为主的店铺，不限定为超市形态。"
  },
  {
    "id": "metro.detail.cat.店.produce_store",
    "name": "生鲜农产品店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.rice",
    "name": "米店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.seafood",
    "name": "海鲜店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.seafood_market",
    "name": "海鲜市场",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.specialty_foods_store",
    "name": "特色食品店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.tea",
    "name": "茶叶店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.食.candy_store",
    "name": "糖果店",
    "parentId": "in.retail.food-shop",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail.home-hardware",
    "name": "家居与五金店",
    "parentId": "in.retail",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail.furnishings",
    "name": "家具与家居装饰店",
    "parentId": "in.retail.home-hardware",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "家具、床品、地毯与室内装饰商品的零售。"
  },
  {
    "id": "metro.detail.cat.svc.furniture",
    "name": "家具店",
    "parentId": "in.retail.furnishings",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.bed",
    "name": "床品店",
    "parentId": "in.retail.furnishings",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.carpet_store",
    "name": "地毯店",
    "parentId": "in.retail.furnishings",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.interior_decoration",
    "name": "室内装饰用品店",
    "parentId": "in.retail.furnishings",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.linen_store",
    "name": "家纺店",
    "parentId": "in.retail.furnishings",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.mattress_store",
    "name": "床垫店",
    "parentId": "in.retail.furnishings",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.appliance",
    "name": "家电店",
    "parentId": "in.retail.home-hardware",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.building_supply_store",
    "name": "建材店",
    "parentId": "in.retail.home-hardware",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.doityourself",
    "name": "家居建材店",
    "parentId": "in.retail.home-hardware",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.hardware",
    "name": "五金店",
    "parentId": "in.retail.home-hardware",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.hardware_home_and_garden_store",
    "name": "家居园艺五金店",
    "parentId": "in.retail.home-hardware",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.home_improvement_store",
    "name": "家装用品店",
    "parentId": "in.retail.home-hardware",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.lumber_store",
    "name": "木材店",
    "parentId": "in.retail.home-hardware",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail.mall-department",
    "name": "商场与百货",
    "parentId": "in.retail",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.商.commercial_complex",
    "name": "商业综合体",
    "parentId": "in.retail.mall-department",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.商.department_store",
    "name": "百货",
    "parentId": "in.retail.mall-department",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.商.mall",
    "name": "商场",
    "parentId": "in.retail.mall-department",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail.market",
    "name": "市场与集市",
    "parentId": "in.retail",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "公共市场"
    ],
    "description": "由多个摊商组成的市场与集市。"
  },
  {
    "id": "metro.detail.cat.商.marketplace",
    "name": "市场",
    "parentId": "in.retail.market",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.flea_market",
    "name": "跳蚤市场",
    "parentId": "in.retail.market",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.retail.supermarket",
    "name": "超市与综合卖场",
    "parentId": "in.retail",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "超市"
    ],
    "description": "超市、大型综合卖场和会员仓储卖场。"
  },
  {
    "id": "metro.detail.cat.店.superstore",
    "name": "大型综合商店",
    "parentId": "in.retail.supermarket",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.warehouse_club_store",
    "name": "会员仓储商店",
    "parentId": "in.retail.supermarket",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.超.supermarket",
    "name": "超市",
    "parentId": "in.retail.supermarket",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty",
    "name": "专业、兴趣与二手商店",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.adult-goods",
    "name": "成人商店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "成人商品商店"
    ],
    "description": "成人用品、影像或书刊零售的分类中层。"
  },
  {
    "id": "in.specialty.adult-goods.books",
    "name": "成人书刊店",
    "parentId": "in.specialty.adult-goods",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "成人向け書店",
      "アダルト書店"
    ],
    "description": "以成人书刊零售为主要用途的商店。"
  },
  {
    "id": "in.specialty.adult-goods.supplies",
    "name": "成人用品店",
    "parentId": "in.specialty.adult-goods",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "アダルトショップ",
      "大人のおもちゃ店"
    ],
    "description": "以成人用品零售为主要经营用途的商店。"
  },
  {
    "id": "in.specialty.adult-goods.video",
    "name": "成人影像店",
    "parentId": "in.specialty.adult-goods",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "成人向けDVD店",
      "アダルトDVD店"
    ],
    "description": "以成人影像制品销售或租赁为主要用途的商店。"
  },
  {
    "id": "in.specialty.anime",
    "name": "动漫与角色商品店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.anime",
    "name": "动漫商品店",
    "parentId": "in.specialty.anime",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.antiques",
    "name": "古董与古旧物商店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "旧家具与古道具店"
    ],
    "description": "以古董、古旧家具和收藏旧物为主的商店。"
  },
  {
    "id": "metro.detail.cat.店.antique_store",
    "name": "古董店",
    "parentId": "in.specialty.antiques",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.baby-family",
    "name": "母婴用品店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "婴幼儿与育儿相关用品的零售。"
  },
  {
    "id": "in.specialty.beauty-supplies",
    "name": "美容与护理用品店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "化妆品、香水、美发及美容护理用品的零售。"
  },
  {
    "id": "metro.detail.cat.店.beauty_supply_store",
    "name": "美容用品店",
    "parentId": "in.specialty.beauty-supplies",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.cosmetics",
    "name": "化妆品店",
    "parentId": "in.specialty.beauty-supplies",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.cosmetics_and_fragrance_store",
    "name": "化妆品香水店",
    "parentId": "in.specialty.beauty-supplies",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.hair_supply_store",
    "name": "美发用品店",
    "parentId": "in.specialty.beauty-supplies",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.books",
    "name": "书店与旧书店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.书.books",
    "name": "书店",
    "parentId": "in.specialty.books",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.书.comic_books_store",
    "name": "漫画书店",
    "parentId": "in.specialty.books",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.书.used_bookstore",
    "name": "旧书店",
    "parentId": "in.specialty.books",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.camera-electronics",
    "name": "相机与电子商品店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.camera",
    "name": "相机店",
    "parentId": "in.specialty.camera-electronics",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.camera_and_photography_store",
    "name": "相机摄影器材店",
    "parentId": "in.specialty.camera-electronics",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.computer",
    "name": "电脑店",
    "parentId": "in.specialty.camera-electronics",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.electronics",
    "name": "电子产品店",
    "parentId": "in.specialty.camera-electronics",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.mobile_phone",
    "name": "手机店",
    "parentId": "in.specialty.camera-electronics",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.clothes",
    "name": "服装与服饰店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "服装店"
    ],
    "description": "服装、鞋帽、箱包和服饰配件等商店。"
  },
  {
    "id": "in.specialty.vintage",
    "name": "二手服装店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "古着店"
    ],
    "description": "以二手服装为主要商品的店铺。"
  },
  {
    "id": "metro.detail.cat.店.second_hand_clothing_store",
    "name": "二手服装店",
    "parentId": "in.specialty.vintage",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.bag",
    "name": "箱包店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.costume_store",
    "name": "戏服装扮用品店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.fashion_accessories",
    "name": "服饰配件店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.fashion_boutique",
    "name": "时装精品店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.hat_store",
    "name": "帽子店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.leather_goods_store",
    "name": "皮具店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.mens_clothing_store",
    "name": "男装店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.shoe_store",
    "name": "鞋店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.wig_store",
    "name": "假发店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.womens_clothing_store",
    "name": "女装店",
    "parentId": "in.specialty.clothes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.craft-supplies",
    "name": "手作与兴趣材料店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "手作材料店"
    ],
    "description": "手工制作、缝纫和兴趣创作所需材料与用品的商店。"
  },
  {
    "id": "metro.detail.cat.店.arts_crafts_and_hobby_store",
    "name": "工艺兴趣用品店",
    "parentId": "in.specialty.craft-supplies",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.fabric",
    "name": "布料店",
    "parentId": "in.specialty.craft-supplies",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.hobby",
    "name": "兴趣用品店",
    "parentId": "in.specialty.craft-supplies",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.sewing",
    "name": "缝纫用品店",
    "parentId": "in.specialty.craft-supplies",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.eyewear-jewelry",
    "name": "眼镜、珠宝与钟表店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "眼镜、珠宝首饰和钟表等专业零售。"
  },
  {
    "id": "metro.detail.cat.svc.optician",
    "name": "眼镜店",
    "parentId": "in.specialty.eyewear-jewelry",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.jewelry",
    "name": "珠宝店",
    "parentId": "in.specialty.eyewear-jewelry",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.watch_store",
    "name": "钟表店",
    "parentId": "in.specialty.eyewear-jewelry",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.flowers-gardening",
    "name": "花卉与园艺店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "鲜花、植物、苗木及园艺用品的零售。"
  },
  {
    "id": "metro.detail.cat.店.florist",
    "name": "花店",
    "parentId": "in.specialty.flowers-gardening",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.flowers_and_gifts_store",
    "name": "鲜花礼品店",
    "parentId": "in.specialty.flowers-gardening",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.garden_centre",
    "name": "园艺店",
    "parentId": "in.specialty.flowers-gardening",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.nursery_and_gardening_store",
    "name": "苗圃园艺店",
    "parentId": "in.specialty.flowers-gardening",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.games",
    "name": "电子游戏商品店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "电子游戏软件、主机及周边商品的零售。"
  },
  {
    "id": "metro.detail.cat.书.video_game_store",
    "name": "电子游戏店",
    "parentId": "in.specialty.games",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.gifts-souvenirs",
    "name": "礼品与纪念品店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "礼品与纪念品的零售。"
  },
  {
    "id": "metro.detail.cat.店.gift",
    "name": "礼品店",
    "parentId": "in.specialty.gifts-souvenirs",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.souvenir_store",
    "name": "纪念品店",
    "parentId": "in.specialty.gifts-souvenirs",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.instruments",
    "name": "乐器店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.musical_instrument_store",
    "name": "乐器店",
    "parentId": "in.specialty.instruments",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.other",
    "name": "其他专业商店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.art",
    "name": "艺术品商店",
    "parentId": "in.specialty.other",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.framing_store",
    "name": "装裱店",
    "parentId": "in.specialty.other",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.outlet_store",
    "name": "奥特莱斯折扣店",
    "parentId": "in.specialty.other",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.pets-aquatics",
    "name": "宠物与水族用品店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "宠物、水族及相关饲养用品的零售。"
  },
  {
    "id": "metro.detail.cat.店.aquatic_pet_store",
    "name": "观赏水族店",
    "parentId": "in.specialty.pets-aquatics",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.pet",
    "name": "宠物店",
    "parentId": "in.specialty.pets-aquatics",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.records",
    "name": "唱片与音像店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.书.music_and_dvd_store",
    "name": "音乐影音店",
    "parentId": "in.specialty.records",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.书.vinyl_record_store",
    "name": "黑胶唱片店",
    "parentId": "in.specialty.records",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.music",
    "name": "音乐商店",
    "parentId": "in.specialty.records",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.secondhand",
    "name": "综合二手商店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "以多种二手物品为主的商店，与古董和旧书等专门店分别保留。"
  },
  {
    "id": "metro.detail.cat.店.pawn_shop",
    "name": "典当行",
    "parentId": "in.specialty.secondhand",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.second_hand",
    "name": "二手商店",
    "parentId": "in.specialty.secondhand",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.sports-outdoor",
    "name": "运动与户外用品店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "运动、户外活动及钓鱼等相关器材和用品的零售。"
  },
  {
    "id": "metro.detail.cat.店.fishing",
    "name": "钓具店",
    "parentId": "in.specialty.sports-outdoor",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "销售钓鱼器材和用品的商店，不归体育练习场所。"
  },
  {
    "id": "metro.detail.cat.店.golf_equipment_store",
    "name": "高尔夫用品店",
    "parentId": "in.specialty.sports-outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.hunting_and_fishing_store",
    "name": "狩猎钓鱼用品店",
    "parentId": "in.specialty.sports-outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.outdoor",
    "name": "户外用品店",
    "parentId": "in.specialty.sports-outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.skate_store",
    "name": "滑板用品店",
    "parentId": "in.specialty.sports-outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.ski_and_snowboard_store",
    "name": "滑雪用品店",
    "parentId": "in.specialty.sports-outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.sporting_goods_store",
    "name": "体育用品店",
    "parentId": "in.specialty.sports-outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.surf_store",
    "name": "冲浪用品店",
    "parentId": "in.specialty.sports-outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.stationery-office",
    "name": "文具与办公用品店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "文具、办公耗材及相关用品的零售。"
  },
  {
    "id": "metro.detail.cat.书.newspaper_and_magazines_store",
    "name": "报刊店",
    "parentId": "in.specialty.stationery-office",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.office_supply_store",
    "name": "办公用品店",
    "parentId": "in.specialty.stationery-office",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.stationery",
    "name": "文具店",
    "parentId": "in.specialty.stationery-office",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.tobacco",
    "name": "烟草与吸烟用品店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "烟草、电子烟和相关吸烟用品的零售。"
  },
  {
    "id": "metro.detail.cat.店.smoke_and_vape_store",
    "name": "烟草电子烟店",
    "parentId": "in.specialty.tobacco",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.tobacco",
    "name": "烟草店",
    "parentId": "in.specialty.tobacco",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.toys-models",
    "name": "玩具与模型店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.toy_store",
    "name": "玩具店",
    "parentId": "in.specialty.toys-models",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.specialty.vehicles",
    "name": "车辆与船艇商店",
    "parentId": "in.specialty",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "车辆、船艇及其配件的销售用途。"
  },
  {
    "id": "metro.detail.cat.svc.tire_shop",
    "name": "轮胎店",
    "parentId": "in.specialty.vehicles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.auto_dealer",
    "name": "汽车销售店",
    "parentId": "in.specialty.vehicles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.auto_parts_store",
    "name": "汽车配件店",
    "parentId": "in.specialty.vehicles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.bicycle",
    "name": "自行车店",
    "parentId": "in.specialty.vehicles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.boat_dealer",
    "name": "船艇销售店",
    "parentId": "in.specialty.vehicles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.boat_parts_store",
    "name": "船艇配件店",
    "parentId": "in.specialty.vehicles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.motorcycle",
    "name": "摩托车店",
    "parentId": "in.specialty.vehicles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.motorcycle_dealer",
    "name": "摩托车销售店",
    "parentId": "in.specialty.vehicles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.truck_dealer",
    "name": "卡车销售店",
    "parentId": "in.specialty.vehicles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.used_auto_dealer",
    "name": "二手车销售店",
    "parentId": "in.specialty.vehicles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture",
    "name": "文化、展览与学习场馆",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture.archives",
    "name": "档案馆",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "保存、整理并提供档案查阅的机构。"
  },
  {
    "id": "in.culture.art-museum",
    "name": "美术馆",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture.convention",
    "name": "会展设施",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.建.conference_centre",
    "name": "会议中心",
    "parentId": "in.culture.convention",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.建.exhibition_centre",
    "name": "展览中心",
    "parentId": "in.culture.convention",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.exhibition_and_trade_fair_venue",
    "name": "展览会场",
    "parentId": "in.culture.convention",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture.cultural-hall",
    "name": "文化会馆",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.艺.arts_centre",
    "name": "艺术中心",
    "parentId": "in.culture.cultural-hall",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.艺.cultural_center",
    "name": "文化中心",
    "parentId": "in.culture.cultural-hall",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture.gallery",
    "name": "画廊",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture.history",
    "name": "历史资料馆",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.艺.history_museum",
    "name": "历史博物馆",
    "parentId": "in.culture.history",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture.library",
    "name": "图书馆",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture.memorial",
    "name": "纪念馆",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture.museum",
    "name": "博物馆",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.艺.community_museum",
    "name": "地方博物馆",
    "parentId": "in.culture.museum",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture.science",
    "name": "科学馆与天文设施",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.景.observatory",
    "name": "天文观测设施",
    "parentId": "in.culture.science",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "观测设施"
    ],
    "description": "以天文观测为主要用途的设施，与一般观景台分别分类。"
  },
  {
    "id": "metro.detail.cat.游.observatory",
    "name": "观测设施",
    "parentId": "in.culture.science",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.艺.science_museum",
    "name": "科学博物馆",
    "parentId": "in.culture.science",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.馆.planetarium",
    "name": "天文馆",
    "parentId": "in.culture.science",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.culture.workshop",
    "name": "工坊与制作体验空间",
    "parentId": "in.culture",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment",
    "name": "演出、娱乐与夜间场所",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.adult-theater",
    "name": "成人演艺剧场",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.adult-theater.strip-theater",
    "name": "脱衣舞剧场",
    "parentId": "in.entertainment.adult-theater",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "ストリップ劇場"
    ],
    "description": "成人舞台演出场所，与普通综艺表演酒吧分别分类。"
  },
  {
    "id": "in.entertainment.adult-viewing",
    "name": "成人影像观赏场所",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "成人影片放映和到店影像观赏的分类中层。"
  },
  {
    "id": "in.entertainment.adult-viewing.cinema",
    "name": "成人影院",
    "parentId": "in.entertainment.adult-viewing",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "成人映画館"
    ],
    "description": "以成人影片放映为主要用途的影院。"
  },
  {
    "id": "in.entertainment.adult-viewing.viewing-room",
    "name": "成人影像观赏间",
    "parentId": "in.entertainment.adult-viewing",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "個室ビデオ",
      "ビデオボックス"
    ],
    "description": "提供独立空间供到店观赏成人影像的场所。"
  },
  {
    "id": "in.entertainment.arcade",
    "name": "游戏厅",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "电子游戏厅"
    ]
  },
  {
    "id": "metro.detail.cat.游.adult_gaming_centre",
    "name": "成人游戏厅",
    "parentId": "in.entertainment.arcade",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.cinema",
    "name": "电影院",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.concert-hall",
    "name": "音乐厅",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.gambling",
    "name": "博彩与投注场所",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "博彩、投注和彩票等用途的场所与服务点。"
  },
  {
    "id": "in.entertainment.betting",
    "name": "赛马等公营竞技场外设施",
    "parentId": "in.entertainment.gambling",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.betting_center",
    "name": "博彩投注场所",
    "parentId": "in.entertainment.betting",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.lottery",
    "name": "彩票销售点",
    "parentId": "in.entertainment.gambling",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.casino",
    "name": "赌场",
    "parentId": "in.entertainment.gambling",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.gambling",
    "name": "博彩场所",
    "parentId": "in.entertainment.gambling",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.karaoke",
    "name": "卡拉OK",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "卡拉OK场所"
    ]
  },
  {
    "id": "metro.detail.cat.歌.karaoke_box",
    "name": "卡拉OK包厢店",
    "parentId": "in.entertainment.karaoke",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.live-music",
    "name": "现场音乐场所",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "音乐演出场所"
    ]
  },
  {
    "id": "in.entertainment.live-music.live-house",
    "name": "现场音乐俱乐部",
    "parentId": "in.entertainment.live-music",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "Live House",
      "ライブハウス",
      "ライヴハウス"
    ],
    "description": "以现场音乐演出为主要用途的俱乐部式场馆，与音乐厅分别分类。"
  },
  {
    "id": "in.entertainment.live-music.performance-bar",
    "name": "现场演出酒吧",
    "parentId": "in.entertainment.live-music",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "以现场音乐演出与饮酒结合为主要形态的场所。"
  },
  {
    "id": "metro.detail.cat.艺.jazz_and_blues_venue",
    "name": "爵士与蓝调演出场所",
    "parentId": "in.entertainment.live-music",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.mahjong-games",
    "name": "麻将与桌游场所",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.board-games",
    "name": "桌游店",
    "parentId": "in.entertainment.mahjong-games",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "提供桌面游戏活动与交流空间的场所。"
  },
  {
    "id": "in.entertainment.mahjong",
    "name": "麻将馆",
    "parentId": "in.entertainment.mahjong-games",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "提供麻将活动空间的场所。"
  },
  {
    "id": "in.entertainment.nightclub",
    "name": "夜店与舞厅",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.nightclub",
    "name": "夜店",
    "parentId": "in.entertainment.nightclub",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.dance_club",
    "name": "舞厅",
    "parentId": "in.entertainment.nightclub",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.pachinko",
    "name": "柏青哥店",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "柏青哥",
      "弹珠机店",
      "パチンコ"
    ],
    "description": "以柏青哥等弹珠游艺为主要形态的店铺。"
  },
  {
    "id": "in.entertainment.show-pub",
    "name": "表演酒吧",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "ショーパブ"
    ],
    "description": "舞台节目和饮食相结合的表演场所。"
  },
  {
    "id": "in.entertainment.theater",
    "name": "剧场",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.剧.theatre_venue",
    "name": "剧场演出场所",
    "parentId": "in.entertainment.theater",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.艺.performing_arts_venue",
    "name": "表演艺术场所",
    "parentId": "in.entertainment.theater",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.entertainment.themed",
    "name": "主题娱乐设施",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.indoor_playcenter",
    "name": "室内游乐场",
    "parentId": "in.entertainment.themed",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.escape_game",
    "name": "密室逃脱场所",
    "parentId": "in.entertainment.themed",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.pool_billiards",
    "name": "台球厅",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "提供台球活动空间的场所，与麻将和桌游分别分类。"
  },
  {
    "id": "metro.detail.cat.咖.internet_cafe",
    "name": "网吧与网络咖啡馆",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "网吧咖啡馆",
      "网咖"
    ],
    "description": "提供电脑上网等使用空间的场所，不默认归普通咖啡馆。"
  },
  {
    "id": "metro.detail.cat.酒.adult_entertainment_venue",
    "name": "成人娱乐场所",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.nightlife_venue",
    "name": "夜间娱乐场所",
    "parentId": "in.entertainment",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.adult-services",
    "name": "成人服务",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "成人服务业态的类型中层；不据此建立具名单店清单。",
    "catalogRole": "type_label_only_not_named_shop_inventory"
  },
  {
    "id": "in.adult-services.adult-massage",
    "name": "情趣按摩",
    "parentId": "in.adult-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "ファッションヘルス",
      "ヘルス",
      "成人按摩店"
    ],
    "description": "成人服务业态的情趣按摩标签，与普通健康生活服务中的保健按摩分别分类。",
    "catalogRole": "type_label_only_not_named_shop_inventory"
  },
  {
    "id": "in.adult-services.dating-cafe",
    "name": "约会咖啡厅",
    "parentId": "in.adult-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "出会い系喫茶",
      "成人交友咖啡馆"
    ],
    "description": "以成人约会交友为经营形态的咖啡厅类型。",
    "catalogRole": "type_label_only_not_named_shop_inventory"
  },
  {
    "id": "in.adult-services.other",
    "name": "其他成人服务",
    "parentId": "in.adult-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "承接确属成人服务且现有具体标签尚不适用的类型。",
    "catalogRole": "type_label_only_not_named_shop_inventory"
  },
  {
    "id": "in.adult-services.outcall",
    "name": "上门成人服务",
    "parentId": "in.adult-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "デリバリーヘルス",
      "派遣型"
    ],
    "description": "采用派遣或上门形态的成人服务类型。",
    "catalogRole": "type_label_only_not_named_shop_inventory"
  },
  {
    "id": "in.adult-services.roleplay-club",
    "name": "角色扮演俱乐部",
    "parentId": "in.adult-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "イメージクラブ",
      "成人コスプレクラブ",
      "成人角色扮演俱乐部"
    ],
    "description": "以成人情境角色扮演为经营形态的俱乐部类型，与普通角色体验分别分类。",
    "catalogRole": "type_label_only_not_named_shop_inventory"
  },
  {
    "id": "in.adult-services.service-bar",
    "name": "成人服务酒吧",
    "parentId": "in.adult-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "ピンクサロン"
    ],
    "description": "与普通饮酒场所区分的成人服务酒吧类型。",
    "catalogRole": "type_label_only_not_named_shop_inventory"
  },
  {
    "id": "in.adult-services.sm-club",
    "name": "SM俱乐部",
    "parentId": "in.adult-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "SMクラブ"
    ],
    "description": "以SM主题为经营形态的成人服务俱乐部类型。",
    "catalogRole": "type_label_only_not_named_shop_inventory"
  },
  {
    "id": "in.adult-services.soapland",
    "name": "泡泡浴",
    "parentId": "in.adult-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "ソープランド"
    ],
    "description": "泡泡浴成人服务业态标签。",
    "catalogRole": "type_label_only_not_named_shop_inventory"
  },
  {
    "id": "in.adult-services.telephone-dating",
    "name": "电话交友俱乐部",
    "parentId": "in.adult-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "テレクラ"
    ],
    "description": "以电话交友为经营形态的俱乐部类型。",
    "catalogRole": "type_label_only_not_named_shop_inventory"
  },
  {
    "id": "in.care-learning",
    "name": "教育与照护",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.education",
    "name": "教育设施",
    "parentId": "in.care-learning",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "教育机构",
      "教育服务机构"
    ]
  },
  {
    "id": "in.education.classes",
    "name": "兴趣与语言教育",
    "parentId": "in.education",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.adult_education_center",
    "name": "成人教育中心",
    "parentId": "in.education.classes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.art_school",
    "name": "艺术学校",
    "parentId": "in.education.classes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.computer_coaching",
    "name": "电脑培训机构",
    "parentId": "in.education.classes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.cooking_school",
    "name": "烹饪学校",
    "parentId": "in.education.classes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.language_school",
    "name": "语言学校",
    "parentId": "in.education.classes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.music_school",
    "name": "音乐学校",
    "parentId": "in.education.classes",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.education.cram-school",
    "name": "补习教育",
    "parentId": "in.education",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.建.prep_school",
    "name": "升学预备学校",
    "parentId": "in.education.cram-school",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.test_preparation",
    "name": "考试辅导机构",
    "parentId": "in.education.cram-school",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.tutoring_service",
    "name": "课外辅导机构",
    "parentId": "in.education.cram-school",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.education.nursery",
    "name": "幼儿园与保育设施",
    "parentId": "in.education",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.child_care_and_day_care",
    "name": "儿童日托机构",
    "parentId": "in.education.nursery",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "儿童托育机构"
    ]
  },
  {
    "id": "metro.detail.cat.校.kindergarten",
    "name": "幼儿园",
    "parentId": "in.education.nursery",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.preschool",
    "name": "学前教育机构",
    "parentId": "in.education.nursery",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "日托学前教育机构"
    ]
  },
  {
    "id": "in.education.school",
    "name": "中小学",
    "parentId": "in.education",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.elementary_school",
    "name": "小学",
    "parentId": "in.education.school",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.high_school",
    "name": "高中",
    "parentId": "in.education.school",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.middle_school",
    "name": "初中",
    "parentId": "in.education.school",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.政.private_school",
    "name": "私立办学",
    "parentId": "in.education.school",
    "layer": "IN",
    "nodeRole": "material_tag",
    "aliases": [
      "私立学校"
    ],
    "description": "资料属性：记录学校的办学属性，不替代学校层级和用途。"
  },
  {
    "id": "metro.detail.cat.校.public_school",
    "name": "公立办学",
    "parentId": "in.education.school",
    "layer": "IN",
    "nodeRole": "material_tag",
    "aliases": [
      "公立学校"
    ],
    "description": "资料属性：记录学校的办学属性，不替代学校层级和用途。"
  },
  {
    "id": "in.education.special-needs",
    "name": "特殊教育学校",
    "parentId": "in.education",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "面向特殊教育需要设置的学校。"
  },
  {
    "id": "in.education.university",
    "name": "大学",
    "parentId": "in.education",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.大.college",
    "name": "学院",
    "parentId": "in.education.university",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.大.college_university",
    "name": "高等院校",
    "parentId": "in.education.university",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.medical_school",
    "name": "医学院",
    "parentId": "in.education.university",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.education.vocational",
    "name": "专门学校",
    "parentId": "in.education",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.cosmetology_school",
    "name": "美容学校",
    "parentId": "in.education.vocational",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.vocational_and_technical_school",
    "name": "专业培训学校",
    "parentId": "in.education.vocational",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.校.nursing_school",
    "name": "护理教育机构",
    "parentId": "in.education",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "护理学校"
    ],
    "description": "开展护理专业教育的机构，具体学校层级另行判断。"
  },
  {
    "id": "in.health.child-services",
    "name": "儿童服务设施",
    "parentId": "in.care-learning",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.health.elder-services",
    "name": "老年服务设施",
    "parentId": "in.care-learning",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.care-learning.elder-day-care",
    "name": "老年日间照护",
    "parentId": "in.health.elder-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "为老年人提供日间照护与活动支持的设施。"
  },
  {
    "id": "metro.detail.cat.svc.senior_citizen_service",
    "name": "老年服务机构",
    "parentId": "in.health.elder-services",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.health.nursing",
    "name": "照护设施",
    "parentId": "in.care-learning",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.assisted_living_facility",
    "name": "辅助生活照护设施",
    "parentId": "in.health.nursing",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.retirement_home",
    "name": "养老设施",
    "parentId": "in.health.nursing",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.住.nursing_home",
    "name": "护理养老院",
    "parentId": "in.health.nursing",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.disability_services_and_support_organization",
    "name": "残障支持服务",
    "parentId": "in.care-learning",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "残障服务机构"
    ],
    "description": "为残障人士提供生活和参与活动支持的服务设施。"
  },
  {
    "id": "metro.detail.cat.svc.social_facility",
    "name": "社会福利设施",
    "parentId": "in.care-learning",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.health",
    "name": "医疗与生活服务",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.health.body-care",
    "name": "身体护理与放松",
    "parentId": "in.health",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "保健按摩、整体和水疗等身体护理用途，与医疗、美容和浴场分别归类。"
  },
  {
    "id": "in.health.bodywork",
    "name": "整体与身体调理",
    "parentId": "in.health.body-care",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "整体护理",
      "整体"
    ],
    "description": "以身体姿态和手法调理等为主要服务的场所，不与保健按摩或医疗机构混为同一标签。"
  },
  {
    "id": "metro.detail.cat.svc.day_spa",
    "name": "水疗护理馆",
    "parentId": "in.health.body-care",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "日间水疗馆"
    ],
    "description": "以水疗和身体护理为主要服务的场所，与公共浴场和桑拿分别归类。"
  },
  {
    "id": "metro.detail.cat.svc.massage_therapy",
    "name": "保健按摩店",
    "parentId": "in.health.body-care",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "按摩店",
      "保健按摩"
    ],
    "description": "以保健按摩和身体放松为主要服务的场所；与医疗、美容及成人服务分别分类。"
  },
  {
    "id": "in.health.medical",
    "name": "医疗机构",
    "parentId": "in.health",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "提供诊疗、检查、康复和相关医疗服务的机构。"
  },
  {
    "id": "in.health.clinic",
    "name": "诊所",
    "parentId": "in.health.medical",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.医.acupuncture",
    "name": "针灸机构",
    "parentId": "in.health.clinic",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.医.outpatient_care_facility",
    "name": "门诊机构",
    "parentId": "in.health.clinic",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.医.public_health_clinic",
    "name": "公共卫生门诊",
    "parentId": "in.health.clinic",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.health.dental",
    "name": "牙科",
    "parentId": "in.health.medical",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.teeth_whitening",
    "name": "牙齿美白机构",
    "parentId": "in.health.dental",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.政.歯科医院",
    "name": "牙科诊所",
    "parentId": "in.health.dental",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.health.hospital",
    "name": "医院",
    "parentId": "in.health.medical",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.医.maternity_center",
    "name": "产科中心",
    "parentId": "in.health.hospital",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.health.pharmacy",
    "name": "药房",
    "parentId": "in.health.medical",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "药局"
    ],
    "description": "提供药品调剂与销售等药房服务，与综合药妆零售分别分类。"
  },
  {
    "id": "in.health.rehabilitation",
    "name": "康复设施",
    "parentId": "in.health.medical",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.health.photography-service",
    "name": "摄影服务",
    "parentId": "in.health",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.photo_booth_rental",
    "name": "照相亭租赁服务",
    "parentId": "in.health.photography-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.photographer",
    "name": "摄影工作室",
    "parentId": "in.health.photography-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.办.event_photography_service",
    "name": "活动摄影机构",
    "parentId": "in.health.photography-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.photo",
    "name": "摄影店",
    "parentId": "in.health.photography-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.photo_booth",
    "name": "自动照相亭",
    "parentId": "in.health.photography-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.health.printing-service",
    "name": "印刷与复印服务",
    "parentId": "in.health",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.commercial_printer",
    "name": "商业印刷店",
    "parentId": "in.health.printing-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.printing_service",
    "name": "印刷服务店",
    "parentId": "in.health.printing-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.t_shirt_printing_service",
    "name": "T恤印花店",
    "parentId": "in.health.printing-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.店.copyshop",
    "name": "复印店",
    "parentId": "in.health.printing-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.health.vehicle-care",
    "name": "车辆维修与养护",
    "parentId": "in.health",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "汽车、摩托车等车辆的维修、改装与养护服务。"
  },
  {
    "id": "metro.detail.cat.svc.auto_body_shop",
    "name": "汽车钣金维修店",
    "parentId": "in.health.vehicle-care",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.auto_customization",
    "name": "汽车改装店",
    "parentId": "in.health.vehicle-care",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.auto_glass_service",
    "name": "汽车玻璃维修店",
    "parentId": "in.health.vehicle-care",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.auto_restoration_service",
    "name": "汽车修复店",
    "parentId": "in.health.vehicle-care",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.automotive_repair",
    "name": "汽车维修店",
    "parentId": "in.health.vehicle-care",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.motorcycle_repair",
    "name": "摩托车维修店",
    "parentId": "in.health.vehicle-care",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.tire_dealer_and_repair",
    "name": "轮胎销售维修店",
    "parentId": "in.health.vehicle-care",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.hair-beauty",
    "name": "理发与美容",
    "parentId": "in.health",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.beauty",
    "name": "美容店",
    "parentId": "in.public.hair-beauty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.hair_removal",
    "name": "脱毛机构",
    "parentId": "in.public.hair-beauty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.hair_salon",
    "name": "美发店",
    "parentId": "in.public.hair-beauty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.hairdresser",
    "name": "理发店",
    "parentId": "in.public.hair-beauty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.laser_hair_removal",
    "name": "激光脱毛机构",
    "parentId": "in.public.hair-beauty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.nail_salon",
    "name": "美甲店",
    "parentId": "in.public.hair-beauty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.skin_care_and_makeup",
    "name": "护肤化妆机构",
    "parentId": "in.public.hair-beauty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.tanning_salon",
    "name": "美黑沙龙",
    "parentId": "in.public.hair-beauty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.tattoo_and_piercing",
    "name": "纹身穿孔店",
    "parentId": "in.public.hair-beauty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.waxing",
    "name": "蜜蜡脱毛机构",
    "parentId": "in.public.hair-beauty",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.laundry",
    "name": "洗衣设施",
    "parentId": "in.health",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.dry_cleaning",
    "name": "干洗店",
    "parentId": "in.public.laundry",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.laundromat",
    "name": "自助洗衣店",
    "parentId": "in.public.laundry",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.laundry_service",
    "name": "洗衣店",
    "parentId": "in.public.laundry",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.pets",
    "name": "宠物与动物照护",
    "parentId": "in.health",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "宠物服务"
    ],
    "description": "动物医疗、寄养、训练、收容与照护等服务。"
  },
  {
    "id": "metro.detail.cat.svc.animal_shelter",
    "name": "动物收容所",
    "parentId": "in.public.pets",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.dog_trainer",
    "name": "训犬机构",
    "parentId": "in.public.pets",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.horse_boarding",
    "name": "马匹寄养场",
    "parentId": "in.public.pets",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "提供马匹寄养与日常照护的机构。"
  },
  {
    "id": "metro.detail.cat.svc.pet_boarding",
    "name": "宠物寄养机构",
    "parentId": "in.public.pets",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.pet_breeder",
    "name": "宠物繁育机构",
    "parentId": "in.public.pets",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.pet_groomer",
    "name": "宠物美容店",
    "parentId": "in.public.pets",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.pet_sitting",
    "name": "宠物看护机构",
    "parentId": "in.public.pets",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.veterinarian",
    "name": "兽医诊所",
    "parentId": "in.public.pets",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "动物诊所"
    ]
  },
  {
    "id": "metro.detail.cat.建.animal_boarding",
    "name": "动物寄养机构",
    "parentId": "in.public.pets",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.repair",
    "name": "生活用品维修与修补",
    "parentId": "in.health",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "日常修理服务"
    ],
    "description": "锁具、鞋履、服装和日常用品的修理与修补。"
  },
  {
    "id": "metro.detail.cat.svc.key_and_locksmith",
    "name": "配钥匙锁匠店",
    "parentId": "in.public.repair",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.locksmith",
    "name": "锁匠店",
    "parentId": "in.public.repair",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.sewing_and_alterations",
    "name": "服装修补店",
    "parentId": "in.public.repair",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.shoe_repair",
    "name": "修鞋店",
    "parentId": "in.public.repair",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.tailor",
    "name": "裁缝店",
    "parentId": "in.public.repair",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.办.it_service_and_computer_repair",
    "name": "电脑维修与技术服务店",
    "parentId": "in.public.repair",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public",
    "name": "公共与社区服务",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.administration",
    "name": "行政办事设施",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.housing_authority",
    "name": "住房管理机构",
    "parentId": "in.public.administration",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.政.courthouse",
    "name": "法院",
    "parentId": "in.public.administration",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.政.embassy",
    "name": "使领馆",
    "parentId": "in.public.administration",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.政.government_office",
    "name": "行政办公室",
    "parentId": "in.public.administration",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.政.town_hall",
    "name": "市区町村政府机关",
    "parentId": "in.public.administration",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "市町村政厅",
      "行政设施"
    ],
    "description": "市、区、町、村等地方政府机关。"
  },
  {
    "id": "metro.detail.cat.政.government_department",
    "name": "政府部门",
    "parentId": "in.public.administration",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录政府部门，不作为独立场所的主要用途。"
  },
  {
    "id": "in.public.bank",
    "name": "银行与金融服务机构",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "银行",
      "银行与信用合作社"
    ],
    "description": "银行、信用合作社及相关金融服务机构。"
  },
  {
    "id": "in.public.atm",
    "name": "自动取款机",
    "parentId": "in.public.bank",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "独立的自动取款与银行自助服务设备。"
  },
  {
    "id": "metro.detail.cat.svc.credit_union",
    "name": "信用合作社",
    "parentId": "in.public.bank",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.community",
    "name": "社区中心与公民馆",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.政.community_centre",
    "name": "社区设施",
    "parentId": "in.public.community",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.政.social_centre",
    "name": "社会活动中心",
    "parentId": "in.public.community",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.funeral-service",
    "name": "殡葬服务",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.funeral_service",
    "name": "殡葬服务机构",
    "parentId": "in.public.funeral-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.mortuary_service",
    "name": "遗体安置服务机构",
    "parentId": "in.public.funeral-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宗.crematorium",
    "name": "火葬场",
    "parentId": "in.public.funeral-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.建.funeral_hall",
    "name": "殡仪馆",
    "parentId": "in.public.funeral-service",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.parcel-service",
    "name": "快递与包裹服务点",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "快递包裹的寄送、领取和相关服务。"
  },
  {
    "id": "in.public.police-fire",
    "name": "警察与消防设施",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.fire-station",
    "name": "消防设施",
    "parentId": "in.public.police-fire",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "消防机构和具有独立身份的消防设施。"
  },
  {
    "id": "metro.detail.cat.政.police",
    "name": "警察设施",
    "parentId": "in.public.police-fire",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.post",
    "name": "邮局",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.toilets",
    "name": "公共厕所",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.public.youth",
    "name": "青年活动空间",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.政.youth_organization",
    "name": "青年团体",
    "parentId": "in.public.youth",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录青年团体，不作为独立场所的主要用途。"
  },
  {
    "id": "metro.detail.cat.svc.social_and_human_service",
    "name": "社会援助机构",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.community",
    "name": "社群交流与服务用途",
    "parentId": "in.public",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录社群交流与服务用途，不作为独立场所的主要用途。"
  },
  {
    "id": "in.community.families",
    "name": "家庭与育儿交流",
    "parentId": "in.community",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录家庭与育儿交流，不作为独立场所的主要用途。"
  },
  {
    "id": "in.community.language-culture",
    "name": "语言与文化社群交流",
    "parentId": "in.community",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录语言与文化社群交流，不作为独立场所的主要用途。"
  },
  {
    "id": "in.community.lgbtq",
    "name": "LGBTQ社群交流与服务",
    "parentId": "in.community",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录LGBTQ社群交流与服务，不作为独立场所的主要用途。"
  },
  {
    "id": "in.community.multicultural",
    "name": "多文化交流",
    "parentId": "in.community",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录多文化交流，不作为独立场所的主要用途。"
  },
  {
    "id": "in.community.older-adults",
    "name": "老年交流",
    "parentId": "in.community",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录老年交流，不作为独立场所的主要用途。"
  },
  {
    "id": "in.community.residents",
    "name": "居民交流",
    "parentId": "in.community",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录居民交流，不作为独立场所的主要用途。"
  },
  {
    "id": "in.community.students",
    "name": "学生交流",
    "parentId": "in.community",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录学生交流，不作为独立场所的主要用途。"
  },
  {
    "id": "in.transport",
    "name": "交通与出行设施",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.airport",
    "name": "机场",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.交.airport_terminal",
    "name": "航站楼",
    "parentId": "in.transport.airport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.bicycles",
    "name": "自行车停放与租赁点",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.交.bike_parking",
    "name": "自行车停车设施",
    "parentId": "in.transport.bicycles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.bike_rental",
    "name": "自行车租赁点",
    "parentId": "in.transport.bicycles",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.bus",
    "name": "公交枢纽与站点",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.交.bus_station",
    "name": "公交总站",
    "parentId": "in.transport.bus",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.concourse",
    "name": "站厅与闸区",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.entrance-transfer",
    "name": "站口与换乘通道",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.ferry",
    "name": "客船码头",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.fueling",
    "name": "加油站",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.parking",
    "name": "停车设施",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.交.motorcycle_parking",
    "name": "摩托车停车设施",
    "parentId": "in.transport.parking",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.passenger-services",
    "name": "旅客服务与休息设施",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "面向旅客的休息和配套服务设施。"
  },
  {
    "id": "metro.detail.cat.酒.airport_lounge",
    "name": "机场贵宾休息室",
    "parentId": "in.transport.passenger-services",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "机场贵宾室"
    ],
    "description": "面向机场旅客的贵宾休息设施，不归普通酒吧。"
  },
  {
    "id": "in.transport.platform",
    "name": "站台",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.road-services",
    "name": "道路服务区",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.station",
    "name": "铁路车站",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.交.metro_station",
    "name": "地铁站",
    "parentId": "in.transport.station",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.transport.taxi",
    "name": "出租车乘降点",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "出租车乘降处"
    ],
    "description": "出租车上下客和候车的设施或地点。"
  },
  {
    "id": "in.transport.vehicle-rental",
    "name": "车辆租赁",
    "parentId": "in.transport",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.car_rental",
    "name": "租车店",
    "parentId": "in.transport.vehicle-rental",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "租车服务店"
    ]
  },
  {
    "id": "in.living-work",
    "name": "住宿、居住与工作设施",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.accommodation",
    "name": "住宿设施",
    "parentId": "in.living-work",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "酒店、旅舍、民宿和露营等住宿用途。"
  },
  {
    "id": "in.living-work.camping",
    "name": "露营住宿设施",
    "parentId": "in.living-work.accommodation",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.alpine_hut",
    "name": "山间小屋",
    "parentId": "in.living-work.camping",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.camp_site",
    "name": "露营地",
    "parentId": "in.living-work.camping",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.caravan_site",
    "name": "房车营地",
    "parentId": "in.living-work.camping",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.wilderness_hut",
    "name": "野外山屋",
    "parentId": "in.living-work.camping",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.capsule",
    "name": "胶囊旅馆",
    "parentId": "in.living-work.accommodation",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.guesthouse",
    "name": "民宿与度假出租屋",
    "parentId": "in.living-work.accommodation",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "民宿"
    ],
    "description": "民宿、整栋短租和度假出租屋等住宿形态。"
  },
  {
    "id": "metro.detail.cat.宿.cabin",
    "name": "住宿小屋",
    "parentId": "in.living-work.guesthouse",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "小木屋"
    ]
  },
  {
    "id": "metro.detail.cat.宿.chalet",
    "name": "度假木屋",
    "parentId": "in.living-work.guesthouse",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.cottage",
    "name": "度假小屋",
    "parentId": "in.living-work.guesthouse",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.holiday_rental_home",
    "name": "度假出租屋",
    "parentId": "in.living-work.guesthouse",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.hostel",
    "name": "青年旅舍",
    "parentId": "in.living-work.accommodation",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.hotel-ryokan",
    "name": "酒店与旅馆",
    "parentId": "in.living-work.accommodation",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.bed_and_breakfast",
    "name": "家庭旅馆",
    "parentId": "in.living-work.hotel-ryokan",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.hotel",
    "name": "酒店",
    "parentId": "in.living-work.hotel-ryokan",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.inn",
    "name": "旅馆",
    "parentId": "in.living-work.hotel-ryokan",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.lodge",
    "name": "小旅馆",
    "parentId": "in.living-work.hotel-ryokan",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.motel",
    "name": "汽车旅馆",
    "parentId": "in.living-work.hotel-ryokan",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宿.resort",
    "name": "度假村",
    "parentId": "in.living-work.hotel-ryokan",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.love_hotel",
    "name": "情侣酒店",
    "parentId": "in.living-work.hotel-ryokan",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.residential",
    "name": "住宅与居住设施",
    "parentId": "in.living-work",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "住宅、宿舍及其有明确身份的公共空间。"
  },
  {
    "id": "in.living-work.dorm-shared-home",
    "name": "宿舍与共享住宅",
    "parentId": "in.living-work.residential",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.residential-common",
    "name": "集合住宅公共部分",
    "parentId": "in.living-work.residential",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.workplaces",
    "name": "办公与生产设施",
    "parentId": "in.living-work",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "办公、共享工作、生产与仓储用途。"
  },
  {
    "id": "in.living-work.coworking",
    "name": "共享办公",
    "parentId": "in.living-work.workplaces",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.factory-workshop",
    "name": "工厂与作业场",
    "parentId": "in.living-work.workplaces",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.brewing",
    "name": "酿酒与酒庄设施",
    "parentId": "in.living-work.factory-workshop",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "酒类生产和酒庄设施，可另有参观与品饮用途。"
  },
  {
    "id": "metro.detail.cat.酒.brewery",
    "name": "酿酒厂",
    "parentId": "in.living-work.brewing",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.distillery",
    "name": "蒸馏酒厂",
    "parentId": "in.living-work.brewing",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.酒.winery",
    "name": "葡萄酒庄",
    "parentId": "in.living-work.brewing",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.stone-workshop",
    "name": "石材加工工坊",
    "parentId": "in.living-work.factory-workshop",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "从事石材加工与制作的工坊。"
  },
  {
    "id": "in.living-work.offices",
    "name": "办公楼",
    "parentId": "in.living-work.workplaces",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.办.office",
    "name": "办公设施",
    "parentId": "in.living-work.offices",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.living-work.warehouse",
    "name": "仓库",
    "parentId": "in.living-work.workplaces",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.self_storage_facility",
    "name": "自助仓储设施",
    "parentId": "in.living-work.warehouse",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.storage_facility",
    "name": "仓储设施",
    "parentId": "in.living-work.warehouse",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.leisure-faith",
    "name": "运动与休闲",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports",
    "name": "体育运动设施",
    "parentId": "in.leisure-faith",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "运动与休闲设施"
    ],
    "description": "体育比赛、练习、训练和运动俱乐部等设施。"
  },
  {
    "id": "in.sports.ball-games",
    "name": "球类运动设施",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "棒球、足球、网球等球类运动的比赛和练习设施。"
  },
  {
    "id": "in.sports.basketball",
    "name": "篮球场",
    "parentId": "in.sports.ball-games",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "用于篮球比赛与练习的场地。"
  },
  {
    "id": "metro.detail.cat.体.baseball_field",
    "name": "棒球场",
    "parentId": "in.sports.ball-games",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.baseball_stadium",
    "name": "棒球体育场",
    "parentId": "in.sports.ball-games",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.batting_cage",
    "name": "棒球打击练习场",
    "parentId": "in.sports.ball-games",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.soccer_field",
    "name": "足球场",
    "parentId": "in.sports.ball-games",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.soccer_stadium",
    "name": "足球体育场",
    "parentId": "in.sports.ball-games",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.tennis_court",
    "name": "网球场",
    "parentId": "in.sports.ball-games",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.fitness",
    "name": "健身与身体训练",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "健身与练习设施"
    ],
    "description": "健身、瑜伽、普拉提等身体训练设施。"
  },
  {
    "id": "metro.detail.cat.svc.weight_loss_center",
    "name": "体重管理机构",
    "parentId": "in.sports.fitness",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.dance_studio",
    "name": "舞蹈工作室",
    "parentId": "in.sports.fitness",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.fitness_centre",
    "name": "健身设施",
    "parentId": "in.sports.fitness",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.fitness_station",
    "name": "户外健身器械",
    "parentId": "in.sports.fitness",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.fitness_trainer",
    "name": "健身教练机构",
    "parentId": "in.sports.fitness",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.gymnastics_center",
    "name": "体操馆",
    "parentId": "in.sports.fitness",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.pilates_studio",
    "name": "普拉提馆",
    "parentId": "in.sports.fitness",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.yoga_studio",
    "name": "瑜伽馆",
    "parentId": "in.sports.fitness",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.bowling_alley",
    "name": "保龄球馆",
    "parentId": "in.sports.fitness",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.golf",
    "name": "高尔夫设施",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "高尔夫球场、练习场和教学设施。"
  },
  {
    "id": "metro.detail.cat.体.driving_range",
    "name": "高尔夫练习场",
    "parentId": "in.sports.golf",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.golf_course",
    "name": "高尔夫球场",
    "parentId": "in.sports.golf",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.golf_instructor",
    "name": "高尔夫教学机构",
    "parentId": "in.sports.golf",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.miniature_golf",
    "name": "迷你高尔夫球场",
    "parentId": "in.sports.golf",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.gym-ground",
    "name": "综合体育场馆",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "体育馆与运动场"
    ],
    "description": "综合体育馆、体育中心和体育场等场馆。"
  },
  {
    "id": "metro.detail.cat.体.pitch",
    "name": "运动场",
    "parentId": "in.sports.gym-ground",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.sports_centre",
    "name": "体育中心",
    "parentId": "in.sports.gym-ground",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.sports_hall",
    "name": "体育馆",
    "parentId": "in.sports.gym-ground",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.stadium",
    "name": "体育场",
    "parentId": "in.sports.gym-ground",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.stadium_arena",
    "name": "体育场馆",
    "parentId": "in.sports.gym-ground",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.track",
    "name": "运动跑道",
    "parentId": "in.sports.gym-ground",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.track_stadium",
    "name": "田径体育场",
    "parentId": "in.sports.gym-ground",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.ice-rink",
    "name": "溜冰场",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "用于滑冰活动的冰场。"
  },
  {
    "id": "in.sports.martial-arts",
    "name": "武术与格斗训练",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "武道、拳击和相关格斗训练场所。"
  },
  {
    "id": "metro.detail.cat.体.boxing_class",
    "name": "拳击训练场所",
    "parentId": "in.sports.martial-arts",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.dojo",
    "name": "武道馆",
    "parentId": "in.sports.martial-arts",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.martial_arts_club",
    "name": "武术俱乐部",
    "parentId": "in.sports.martial-arts",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.outdoor",
    "name": "户外运动设施",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "攀岩、骑马、射击、滑板和垂钓等户外运动设施。"
  },
  {
    "id": "metro.detail.cat.体.equestrian_facility",
    "name": "马术设施",
    "parentId": "in.sports.outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.fishing",
    "name": "垂钓场所",
    "parentId": "in.sports.outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.horse_riding",
    "name": "骑马场",
    "parentId": "in.sports.outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.rock_climbing_spot",
    "name": "攀岩场地",
    "parentId": "in.sports.outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.shooting_range",
    "name": "射击场",
    "parentId": "in.sports.outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.skate_park",
    "name": "滑板公园",
    "parentId": "in.sports.outdoor",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.swimming",
    "name": "游泳设施",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.swimming_instructor",
    "name": "游泳教学机构",
    "parentId": "in.sports.swimming",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.water-sports",
    "name": "水上运动设施",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type",
    "description": "潜水、冲浪等水上运动的活动与训练设施。"
  },
  {
    "id": "metro.detail.cat.体.scuba_diving_center",
    "name": "潜水中心",
    "parentId": "in.sports.water-sports",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.surfing",
    "name": "冲浪场所",
    "parentId": "in.sports.water-sports",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.sport_or_fitness_facility",
    "name": "体育健身设施",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.sport_or_recreation_club",
    "name": "运动休闲俱乐部",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.体.sports_and_recreation",
    "name": "运动休闲场所",
    "parentId": "in.sports",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.amusement-park",
    "name": "游乐园",
    "parentId": "in.leisure-faith",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.theme_park",
    "name": "主题乐园",
    "parentId": "in.sports.amusement-park",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.baths-onsen",
    "name": "公共浴场与温泉",
    "parentId": "in.leisure-faith",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.svc.onsen",
    "name": "温泉浴场",
    "parentId": "in.sports.baths-onsen",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.hot_springs",
    "name": "温泉",
    "parentId": "in.sports.baths-onsen",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.public_bath",
    "name": "公共浴场",
    "parentId": "in.sports.baths-onsen",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.botanical",
    "name": "植物园",
    "parentId": "in.leisure-faith",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.sauna",
    "name": "桑拿",
    "parentId": "in.leisure-faith",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.sauna",
    "name": "桑拿浴场",
    "parentId": "in.sports.sauna",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.sports.zoo-aquarium",
    "name": "动物园与水族馆",
    "parentId": "in.leisure-faith",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.aquarium",
    "name": "水族馆",
    "parentId": "in.sports.zoo-aquarium",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.游.zoo",
    "name": "动物园",
    "parentId": "in.sports.zoo-aquarium",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.religion",
    "name": "宗教与纪念设施",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.religion.cemetery",
    "name": "墓地",
    "parentId": "in.religion",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "墓园"
    ]
  },
  {
    "id": "metro.detail.cat.景.tomb",
    "name": "陵墓",
    "parentId": "in.religion.cemetery",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.religion.church",
    "name": "基督教教堂",
    "parentId": "in.religion",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "教会",
      "教堂",
      "基督教礼拜场所"
    ],
    "description": "基督教礼拜和相关宗教活动的场所。"
  },
  {
    "id": "metro.detail.cat.宗.baptist_place_of_worship",
    "name": "浸礼会教堂",
    "parentId": "in.religion.church",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宗.protestant_place_of_worship",
    "name": "新教礼拜场所",
    "parentId": "in.religion.church",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宗.roman_catholic_place_of_worship",
    "name": "天主教堂",
    "parentId": "in.religion.church",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.religion.memorial",
    "name": "纪念设施",
    "parentId": "in.religion",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.religion.other-faith",
    "name": "其他宗教设施",
    "parentId": "in.religion",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宗.muslim_place_of_worship",
    "name": "清真寺",
    "parentId": "in.religion.other-faith",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.religion.shrine",
    "name": "神社",
    "parentId": "in.religion",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "in.religion.temple",
    "name": "寺院",
    "parentId": "in.religion",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.宗.religious_landmark",
    "name": "宗教地标",
    "parentId": "in.religion",
    "layer": "IN",
    "nodeRole": "place_type"
  },
  {
    "id": "metro.detail.cat.寺.place_of_worship",
    "name": "宗教礼拜场所",
    "parentId": "in.religion",
    "layer": "IN",
    "nodeRole": "place_type",
    "aliases": [
      "宗教场所"
    ],
    "description": "宗教礼拜用途的通用场所标签，不预设为佛教寺院。"
  },
  {
    "id": "metro.detail.cat.宗.religious_organization",
    "name": "宗教机构",
    "parentId": "in.religion",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录宗教机构，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts",
    "name": "内容部位",
    "parentId": null,
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录内容部位，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.display",
    "name": "陈列",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录陈列，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.entrance",
    "name": "入口",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录入口，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.equipment",
    "name": "设备",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录设备，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.exterior",
    "name": "外观",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录外观，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.floors",
    "name": "楼层与分区",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录楼层与分区，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.introduction",
    "name": "简介与身份",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录简介与身份，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.layout",
    "name": "内部布局",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录内部布局，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.light",
    "name": "光线",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录光线，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.people",
    "name": "使用人群",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录使用人群，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.seating",
    "name": "座位",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录座位，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.signage",
    "name": "标识",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录标识，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.smell",
    "name": "气味",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录气味，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.sound",
    "name": "声音",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录声音，不作为独立场所的主要用途。"
  },
  {
    "id": "in.content-parts.usage",
    "name": "使用方式",
    "parentId": "in.content-parts",
    "layer": "IN",
    "nodeRole": "material_tag",
    "description": "资料标签：记录使用方式，不作为独立场所的主要用途。"
  }
];
