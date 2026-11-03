// LJ-MATERIAL-CATALOG-01: empty classification paths and explicit climate regions share stable identities.
export const MATERIAL_LAYER_LABELS = {
  TN: '天气与四季',
  EX: '街区与户外',
  IN: '场馆与店铺',
  EV: '节庆与活动',
};

// LJ-EVENT-DATE-DEFAULTS-20261103: initial writing windows shared by event bodies and new fragments.
const eventDateDefaults = new Map(Object.entries({
  'ev.calendar.new-year': { months: [1], monthParts: [0] },
  'ev.calendar.coming-of-age': { months: [1], monthParts: [0, 1] },
  'ev.calendar.setsubun': { months: [2], monthParts: [0] },
  'ev.calendar.hina-matsuri': { startDate: '02-21', endDate: '03-10' },
  'ev.calendar.equinox': { months: [3, 9], monthParts: [1, 2] },
  'ev.calendar.childrens-day': { startDate: '04-25', endDate: '05-10' },
  'ev.calendar.tanabata': { months: [7, 8], monthParts: [0] },
  'ev.calendar.obon': { months: [7, 8], monthParts: [1] },
  'ev.calendar.moon-viewing': { months: [9, 10] },
  'ev.calendar.shichi-go-san': { months: [10, 11] },
  'ev.calendar.year-end': { months: [12], monthParts: [2] },
  'ev.calendar.christmas': { months: [12] },
  'ev.calendar.halloween': { months: [10] },
  'ev.traditional.setsubun': { months: [2], monthParts: [0] },
  'ev.traditional.new-year': { startDate: '12-21', endDate: '01-10' },
}));

export function defaultMaterialConditions(categoryId) {
  const conditions = eventDateDefaults.get(categoryId);
  return conditions ? structuredClone(conditions) : {};
}

const family = (id, name, layer, children, options = {}) => [
  { id, name, parentId: null, layer, ...options },
  ...children.map(([suffix, label, parentId = id]) => ({ id: `${id}.${suffix}`, name: label, parentId, layer })),
];

export const BUILTIN_MATERIAL_CATEGORIES = [
  ...family('tn.light', '天光与昼夜', 'TN', [
    ['dawn', '破晓与晨光'], ['sunrise', '日出前后'], ['morning', '上午天光'], ['noon', '正午天光'],
    ['afternoon', '午后天光'], ['sunset', '日落前后'], ['twilight', '暮色'], ['night', '夜间天光'],
    ['moonlight', '月光'], ['daylength', '昼夜长短'],
  ], { autoRegional: true }),
  ...family('tn.temperature', '温度与体感', 'TN', [
    ['severe-cold', '严寒'], ['cold', '寒冷'], ['cool', '凉意'], ['mild', '温和'], ['warm', '暖意'],
    ['hot', '炎热'], ['extreme-heat', '酷热'], ['humid-heat', '湿热'], ['wind-chill', '风中寒意'],
    ['day-night-difference', '昼夜温差'], ['indoor-outdoor-difference', '室内外温差'],
  ], { autoRegional: true }),
  ...family('tn.weather', '天气与空气', 'TN', [
    ['clear', '晴朗'], ['cloudy', '多云'], ['overcast', '阴天'], ['rain', '降雨'], ['showers', '阵雨'],
    ['heavy-rain', '强降雨'], ['snow', '降雪'], ['blizzard', '风雪'], ['wind', '风'], ['strong-wind', '强风'],
    ['typhoon', '台风天气'], ['thunder', '雷雨'], ['fog', '雾'], ['humidity', '潮湿空气'], ['dry-air', '干燥空气'],
  ], { autoRegional: true }),
  ...family('tn.seasonal', '季节生活', 'TN', [
    ['spring-transition', '春季换季生活'], ['rainy-season', '梅雨期生活'], ['summer-cooling', '盛夏避暑与降温'],
    ['summer-evening', '夏季晚间生活'], ['typhoon-season', '台风季生活'], ['autumn-transition', '秋季换季生活'],
    ['winter-heating', '冬季取暖'], ['snow-season', '积雪期生活'], ['snow-removal', '冬季除雪'],
    ['seasonal-household', '季节家务与居家用品'], ['seasonal-street-use', '季节性街边停留'],
  ], { autoRegional: true }),
  ...family('tn.clothing', '季节衣着', 'TN', [
    ['light', '轻薄衣着'], ['layers', '换季叠穿'], ['coat', '秋冬外套'], ['heavy-winter', '严寒防寒衣着'],
    ['rainwear', '雨具与防雨衣着'], ['snowwear', '雪天衣着与鞋履'], ['sun-protection', '防晒衣着与用品'],
    ['summer-fabrics', '夏季衣料'], ['winter-accessories', '围巾手套等冬季配件'], ['indoor-adjustment', '进出室内时的衣着调整'],
  ], { autoRegional: true }),
  ...family('tn.surface', '地表与路面', 'TN', [
    ['dry', '干燥地面'], ['wet', '湿润路面'], ['puddles', '积水'], ['mud', '泥泞'],
    ['fresh-snow', '新雪覆盖'], ['packed-snow', '压实积雪'], ['ice', '路面结冰'], ['snowmelt', '融雪与雪水'],
    ['frost', '霜'], ['fallen-leaves', '落叶覆盖'], ['heat', '受热路面'], ['sand-dust', '浮沙与尘土'],
  ], { autoRegional: true }),
  ...family('tn.plants', '植物与植被', 'TN', [
    ['sakura', '樱花'], ['ume', '梅花'], ['peach', '桃花'], ['magnolia', '木兰与玉兰'], ['camellia', '山茶'],
    ['azalea', '杜鹃'], ['wisteria', '紫藤'], ['hydrangea', '绣球'], ['iris', '鸢尾与花菖蒲'], ['lotus', '荷花与睡莲'],
    ['sunflower', '向日葵'], ['cosmos', '波斯菊'], ['red-spider-lily', '彼岸花'], ['osmanthus', '桂花'],
    ['ginkgo', '银杏'], ['maple', '枫与槭'], ['pine', '松树'], ['cedar-cypress', '杉与桧'], ['bamboo', '竹'],
    ['evergreen-broadleaf', '常绿阔叶树'], ['subtropical', '亚热带植物'], ['reeds', '芦苇与水边草本'],
    ['grass', '草地与野草'], ['moss-ferns', '苔藓与蕨类'], ['street-trees', '行道树'], ['garden-flowers', '花坛与庭院花草'],
  ]),
  ...family('tn.wildlife', '生物与动物活动', 'TN', [
    ['birds', '鸟类'], ['insects', '昆虫'], ['mammals', '哺乳动物'], ['amphibians-reptiles', '两栖与爬行动物'],
    ['freshwater', '淡水生物'], ['marine', '海岸与海洋生物'],
  ]),
  ...family('tn.wildlife.birds.common', '常见鸟类细目', 'TN', [
    ['sparrow', '麻雀'], ['crow', '乌鸦'], ['pigeon', '鸽'], ['swallow', '燕'], ['kite', '鸢'],
    ['heron', '鹭'], ['duck', '鸭与水鸟'], ['gull', '鸥'], ['migratory', '迁徙鸟类'],
  ], { parentId: 'tn.wildlife.birds' }),
  ...family('tn.wildlife.insects.common', '常见昆虫细目', 'TN', [
    ['cicada', '蝉'], ['cricket', '蟋蟀与鸣虫'], ['firefly', '萤火虫'], ['butterfly', '蝴蝶'],
    ['dragonfly', '蜻蜓'], ['bee', '蜂'], ['mosquito', '蚊'],
  ], { parentId: 'tn.wildlife.insects' }),

  ...family('ex.residential', '居住街区', 'EX', [
    ['detached', '独栋住宅街区'], ['low-rise', '低层公寓街区'], ['high-rise', '中高层住宅街区'],
    ['danchi', '团地与集合住宅区'], ['new-town', '新城住宅区'], ['mixed', '商住混合街区'],
    ['old-settlement', '旧聚落与农村住区'], ['hillside', '山坡与谷地住宅区'],
  ]),
  ...family('ex.commercial', '日常商业与购物街区', 'EX', [
    ['station-front', '站前商店街'], ['local', '生活商店街'], ['arcade', '拱廊商店街'], ['market', '市场周边街区'],
    ['specialty', '专业商品街'], ['wholesale', '批发街'], ['secondhand', '古着与二手商品街'],
    ['pedestrian', '商业步行街'], ['roadside', '沿路商业带'],
  ]),
  ...family('ex.nightlife', '餐饮与夜间街区', 'EX', [
    ['restaurants', '餐饮店集中街区'], ['izakaya', '居酒屋街'], ['yokocho', '横丁与小巷饮食街'],
    ['bars', '酒吧街'], ['music-clubs', '现场音乐与夜店集中区'], ['theaters', '剧场周边街区'],
    ['adult', '成人娱乐店集中街区'], ['day-night', '昼夜用途转换街区'],
  ]),
  ...family('ex.center', '城市中心与工作街区', 'EX', [
    ['business', '商业中心街区'], ['offices', '办公街区'], ['station-square', '车站前广场及周边'],
    ['administration', '行政中心周边'], ['complex', '商业综合体周边'], ['campus', '大学与研究机构周边'],
    ['work-life', '办公和生活混合街区'],
  ]),
  ...family('ex.historic', '历史街区与传统町场', 'EX', [
    ['post-town', '宿场旧街'], ['castle-town', '城下町街区'], ['temple-town', '门前町与参道'],
    ['merchant', '历史商家街区'], ['craft', '传统工艺街区'], ['former-yukaku', '旧游郭建筑街区'],
    ['port-town', '旧港町与渔村街区'], ['warehouse', '历史仓储街区'],
  ]),
  ...family('ex.industry', '工业、物流与港区', 'EX', [
    ['factories', '工厂集中区'], ['workshops', '町工场混合街区'], ['industrial-park', '工业园区'],
    ['logistics', '仓库物流区'], ['freight', '货运场站周边'], ['port', '商业港区'], ['fishing-port', '渔港周边'],
    ['coastal', '临海工业地带'], ['reuse', '工业设施再利用区'],
  ]),
  ...family('ex.open-space', '公园、绿地与公共开放空间', 'EX', [
    ['city-park', '城市公园'], ['neighborhood-park', '邻里公园'], ['playground', '儿童游园'], ['garden', '庭园'],
    ['square', '广场'], ['waterfront-park', '滨水公园'], ['greenway', '绿道与步行带'], ['sports', '运动开放空间'],
    ['memorial', '墓园与纪念绿地'], ['courtyard', '建筑间公共空地'],
  ]),
  ...family('ex.streets', '道路与日常通行空间', 'EX', [
    ['arterial', '干道沿线'], ['local-road', '生活道路'], ['alley', '窄巷'], ['slope', '坡道与阶梯路'],
    ['under-viaduct', '高架下街道'], ['bridge', '桥梁与桥头空间'], ['underground', '地下通道及出入口周边'],
    ['footbridge', '步行天桥'], ['cycleway', '骑行通路'], ['junction', '路口与道路交会处'],
  ]),
  ...family('ex.rural', '乡村、农地与山地户外', 'EX', [
    ['farmland', '田园与农地'], ['village-edge', '村落外围'], ['satoyama', '里山'], ['forest-path', '森林步道'],
    ['mountain-path', '山路与登山口'], ['mountain-rest', '山地休憩空间'], ['plateau', '高原'], ['valley', '溪谷'],
    ['wetland', '湿地'], ['pasture', '牧场与乡村开放地'],
  ]),
  ...family('ex.waterfront', '河湖、海岸与岛屿户外', 'EX', [
    ['riverbank', '河岸与堤防'], ['floodplain', '河川敷'], ['estuary', '河口与潮滩'], ['lakeside', '湖岸'],
    ['canal', '水乡与运河岸'], ['beach', '沙滩'], ['rocks-cliffs', '岩岸与海崖'], ['cape', '海岬'],
    ['island', '岛屿聚落及外围'], ['coast', '海岸步道与开放海岸'],
  ]),
  ...family('ex.architecture', '建筑外观', 'EX', [
    ['height', '楼层与建筑高度'], ['wood', '木造外观'], ['brick', '砖砌外观'], ['concrete', '混凝土外观'],
    ['glass', '玻璃外墙'], ['nagaya', '长屋'], ['machiya', '町家'], ['mixed-use', '商住楼'],
    ['aged', '老旧建筑外观'], ['renovated', '翻修后的外观'], ['roof', '屋顶与檐口'], ['facade', '立面与墙面'],
    ['windows', '窗户与阳台'], ['fences', '围墙与院门'],
  ]),
  ...family('ex.greenery', '植物与绿化', 'EX', [
    ['street-trees', '行道树'], ['garden-trees', '庭院树'], ['hedges', '绿篱'], ['flowerbeds', '花坛'],
    ['potted-plants', '盆栽'], ['lawn', '草地'], ['flowers', '草花'], ['vines', '藤蔓与攀援植物'],
    ['community-gardens', '社区种植'], ['waterside-plants', '水边植被'],
  ]),
  ...family('ex.street-objects', '街面物件', 'EX', [
    ['signboards', '招牌'], ['shop-signs', '店招'], ['shop-lights', '店铺灯具'], ['streetlights', '路灯'],
    ['utility-poles', '电线杆与架空线'], ['vending-machines', '自动贩卖机'], ['benches', '长椅'],
    ['guardrails', '护栏'], ['bicycles', '停放的自行车'], ['awnings', '遮雨棚'], ['shutters', '卷帘门'],
    ['noticeboards', '告示板'], ['mailboxes', '邮筒'], ['bins', '垃圾容器与收集点'], ['cones', '路锥与临时围挡'],
  ]),
  ...family('ex.daily-use', '日常使用', 'EX', [
    ['shopping', '日常采购'], ['commuting', '通勤'], ['after-school', '放学时的使用'], ['walking', '散步'],
    ['running', '跑步'], ['cycling', '骑行'], ['dog-walking', '遛狗'], ['waiting', '等候'], ['queuing', '排队'],
    ['delivery', '送货与装卸'], ['cleaning', '清扫'], ['staying', '停留与休息'], ['meeting', '约见与交谈'],
    ['playing', '日常玩耍'], ['practice', '日常练习'], ['viewing', '观看与观赏'],
  ]),
  ...family('ex.users', '使用人群', 'EX', [
    ['residents', '居民'], ['students', '学生'], ['office-workers', '上班族'], ['shopkeepers', '店主与店员'],
    ['workers', '工人与作业人员'], ['audiences', '观众'], ['domestic-visitors', '国内游客'],
    ['foreign-visitors', '外国游客'], ['families', '亲子与家庭'], ['older-adults-living-alone', '独居长者'],
    ['children', '儿童'], ['young-adults', '青年'], ['older-adults', '长者'],
  ]),
  ...family('ex.communities', '社区与社群', 'EX', [
    ['long-term-residents', '长期居住群体'], ['student-renters', '学生租住群体'], ['older-residents', '老龄居民群体'],
    ['multinational', '多国居民与交流'], ['music', '音乐社群'], ['art', '艺术社群'], ['lgbtq', 'LGBTQ社群'],
    ['resident-organizations', '町会、自治会与居民组织'], ['language-culture', '语言与文化社群'],
    ['mutual-aid', '社区互助'],
  ]),
  ...family('ex.living-conditions', '居住与生活状况', 'EX', [
    ['housing-cost', '居住成本'], ['rental', '租住状况'], ['short-stay', '短期居住'], ['simple-lodging', '简易住宿'],
    ['public-housing', '公共住宅'], ['income', '收入状况'], ['employment', '就业状况'],
    ['student-housing', '学生居住'], ['company-housing', '企业宿舍与社宅'], ['housing-tenure', '自有与租赁居住'],
  ]),
  ...family('ex.sounds-smells', '声音与气味', 'EX', [
    ['traffic', '车辆声音'], ['railway', '铁路声音'], ['shops', '店铺声音'], ['music', '音乐'], ['voices', '人声'],
    ['school', '学校声音'], ['machinery', '机器与作业声音'], ['cooking', '烹饪气味'], ['seaside', '海边气味'],
    ['plants', '植物气味'], ['water', '水声'], ['animals', '动物与鸣虫声音'],
  ]),
  ...family('ex.operating-state', '营业与维护状态', 'EX', [
    ['open', '营业期间'], ['closed-hours', '休息与闭店时段'], ['vacant-shop', '空铺'], ['construction', '施工期间'],
    ['cleaning', '清扫维护'], ['repairs', '修缮期间'], ['seasonal-decoration', '季节装饰'],
    ['permanent-closure', '停业后的状态'], ['opening-preparation', '开业准备'],
  ]),

  ...family('in.food', '餐饮场所', 'IN', [
    ['diner', '食堂与定食店'], ['restaurant', '餐厅'], ['noodles', '面食店'], ['curry', '咖喱店'],
    ['cafe', '咖啡馆与喫茶店'], ['sweets-bakery', '甜品与面包店'], ['izakaya', '居酒屋', 'in.drinking'],
    ['bar', '酒吧与小酒馆', 'in.drinking'], ['hosted-bar', '接待型酒吧', 'in.drinking'], ['food-hall', '餐饮集合设施'],
  ]),
  ...family('in.drinking', '饮酒与酒吧场所', 'IN', [
    ['standing', '立饮店'], ['tasting', '酒类品饮空间'], ['brewpub', '酿造与饮酒结合场所'],
    ['music-bar', '音乐酒吧'], ['community-bar', '社群酒吧'],
  ]),
  ...family('in.retail', '日常零售与市场', 'IN', [
    ['convenience', '便利店'], ['supermarket', '超市'], ['food-shop', '食品专门店'], ['mall-department', '商场与百货'],
    ['market', '公共市场'], ['drugstore', '药妆店'], ['daily-goods', '日用品店'], ['home-hardware', '家居与五金店'],
    ['direct-sales', '农水产品直卖所'],
  ]),
  ...family('in.specialty', '专业、兴趣与二手商店', 'IN', [
    ['clothes', '服装店'], ['vintage', '古着店'], ['books', '书店与旧书店'], ['records', '唱片与音像店'],
    ['instruments', '乐器店'], ['anime', '动漫与角色商品店'], ['toys-models', '玩具与模型店'],
    ['camera-electronics', '相机与电子商品店'], ['craft-supplies', '手作材料店'], ['antiques', '旧家具与古道具店'],
    ['other', '其他专业商店'],
  ]),
  ...family('in.culture', '文化、展览与学习场馆', 'IN', [
    ['museum', '博物馆'], ['art-museum', '美术馆'], ['gallery', '画廊'], ['history', '历史资料馆'],
    ['memorial', '纪念馆'], ['science', '科学馆与天文设施'], ['library', '图书馆'], ['cultural-hall', '文化会馆'],
    ['convention', '会展设施'], ['workshop', '工坊与制作体验空间'],
  ]),
  ...family('in.entertainment', '演出、娱乐与夜间场所', 'IN', [
    ['theater', '剧场'], ['cinema', '电影院'], ['live-music', '现场音乐场所'], ['concert-hall', '音乐厅'],
    ['nightclub', '夜店与舞厅'], ['karaoke', '卡拉OK'], ['arcade', '游戏厅'], ['pachinko', '柏青哥'],
    ['betting', '赛马等公营竞技场外设施'], ['mahjong-games', '麻将与桌游场所'], ['adult-theater', '成人演艺剧场'],
    ['themed', '主题娱乐设施'],
  ]),
  ...family('in.care-learning', '教育与照护', 'IN', []),
  ...family('in.education', '教育设施', 'IN', [
    ['nursery', '幼儿园与保育设施'], ['school', '中小学'], ['university', '大学'], ['vocational', '专门学校'],
    ['cram-school', '补习教育'], ['classes', '兴趣与语言教育'],
  ], { parentId: 'in.care-learning' }),
  ...family('in.health', '医疗与生活服务', 'IN', [
    ['hospital', '医院'], ['clinic', '诊所'], ['dental', '牙科'], ['pharmacy', '药局'], ['rehabilitation', '康复设施'],
    ['nursing', '照护设施', 'in.care-learning'], ['child-services', '儿童服务设施', 'in.care-learning'],
    ['elder-services', '老年服务设施', 'in.care-learning'],
  ]),
  ...family('in.public', '公共与社区服务', 'IN', [
    ['administration', '行政办事设施'], ['police-fire', '警察与消防设施'], ['post', '邮局'], ['bank', '银行'],
    ['community', '社区中心与公民馆'], ['youth', '青年活动空间'], ['hair-beauty', '理发与美容', 'in.health'],
    ['laundry', '洗衣设施', 'in.health'], ['repair', '日常修理服务', 'in.health'], ['pets', '宠物服务', 'in.health'],
    ['toilets', '公共厕所'],
  ]),
  ...family('in.community', '社群交流与服务用途', 'IN', [
    ['residents', '居民交流'], ['students', '学生交流'], ['families', '家庭与育儿交流'], ['older-adults', '老年交流'],
    ['lgbtq', 'LGBTQ社群交流与服务'], ['language-culture', '语言与文化社群交流'], ['multicultural', '多文化交流'],
  ], { parentId: 'in.public' }),
  ...family('in.transport', '交通与出行设施', 'IN', [
    ['station', '铁路车站'], ['concourse', '站厅与闸区'], ['platform', '站台'], ['entrance-transfer', '站口与换乘通道'],
    ['bus', '公交枢纽与站点'], ['ferry', '客船码头'], ['airport', '机场'], ['taxi', '出租车乘降处'],
    ['bicycles', '自行车停放与租赁点'], ['parking', '停车设施'], ['road-services', '道路服务区'],
  ]),
  ...family('in.living-work', '住宿、居住与工作设施', 'IN', [
    ['hotel-ryokan', '酒店与旅馆'], ['capsule', '胶囊旅馆'], ['hostel', '青年旅舍'], ['guesthouse', '民宿'],
    ['camping', '露营住宿设施'], ['dorm-shared-home', '宿舍与共享住宅'], ['residential-common', '集合住宅公共部分'],
    ['offices', '办公楼'], ['coworking', '共享办公'], ['factory-workshop', '工厂与作业场'], ['warehouse', '仓库'],
  ]),
  ...family('in.leisure-faith', '运动与休闲', 'IN', []),
  ...family('in.sports', '运动与休闲设施', 'IN', [
    ['gym-ground', '体育馆与运动场'], ['fitness', '健身与练习设施'], ['swimming', '游泳设施'],
    ['baths-onsen', '公共浴场与温泉'], ['sauna', '桑拿'], ['zoo-aquarium', '动物园与水族馆'],
    ['botanical', '植物园'], ['amusement-park', '游乐园'],
  ], { parentId: 'in.leisure-faith' }),
  ...family('in.religion', '宗教与纪念设施', 'IN', [
    ['shrine', '神社'], ['temple', '寺院'], ['church', '教会'], ['other-faith', '其他宗教设施'],
    ['cemetery', '墓地'], ['memorial', '纪念设施'],
  ]),
  ...family('in.content-parts', '内容部位', 'IN', [
    ['introduction', '简介与身份'], ['exterior', '外观'], ['entrance', '入口'], ['layout', '内部布局'],
    ['floors', '楼层与分区'], ['seating', '座位'], ['display', '陈列'], ['equipment', '设备'], ['signage', '标识'],
    ['light', '光线'], ['sound', '声音'], ['smell', '气味'], ['usage', '使用方式'], ['people', '使用人群'],
  ]),

  ...family('ev.calendar', '年中行事', 'EV', [
    ['new-year', '正月与新年行事'], ['coming-of-age', '成人行事'], ['setsubun', '节分'], ['hina-matsuri', '女儿节'],
    ['equinox', '春秋彼岸'], ['childrens-day', '端午与儿童节'], ['tanabata', '七夕'], ['obon', '盂兰盆行事'],
    ['moon-viewing', '赏月行事'], ['shichi-go-san', '七五三'], ['year-end', '岁末行事'],
    ['christmas', '圣诞季活动'], ['halloween', '万圣节活动'],
  ]),
  ...family('ev.traditional', '传统祭礼与宗教活动', 'EV', [
    ['shrine-festival', '神社祭礼'], ['mikoshi-floats', '神轿与山车巡行'], ['temple-rites', '寺院法会与参拜活动'],
    ['setsubun', '节分撒豆'], ['bon-dance', '盆踊'], ['traditional-dance', '传统舞蹈巡演'],
    ['new-year', '年末年初行事'], ['local-rites', '地方传统仪式'],
  ]),
  ...family('ev.seasonal', '季节观赏与户外活动', 'EV', [
    ['flowers', '花季活动'], ['autumn-leaves', '红叶活动'], ['illumination', '灯光与点灯活动'], ['fireworks', '烟火大会'],
    ['snow-ice', '雪冰活动'], ['waterfront', '海岸与水边季节活动'], ['stargazing', '观星活动'], ['seasonal-opening', '季节性户外开放'],
  ]),
  ...family('ev.performance', '音乐、戏剧与街头演出', 'EV', [
    ['music-festival', '音乐祭'], ['theater-festival', '剧场节'], ['street-music', '街头音乐'], ['marching', '巡行演奏'],
    ['dance', '舞蹈演出'], ['street-artists', '街头艺人活动'], ['public-performance', '公共空间表演'], ['open-air-film', '露天电影与放映'],
  ]),
  ...family('ev.art', '艺术、展览与创作交流', 'EV', [
    ['art-festival', '艺术节'], ['neighborhood-exhibition', '街区展览'], ['gallery-events', '画廊联合活动'],
    ['open-studio', '开放工作室'], ['craft-exhibition', '工艺展示'], ['creative-workshop', '创作体验'],
    ['books-authors', '读书与作者活动'], ['local-history', '历史与地方文化展示'],
  ]),
  ...family('ev.food', '饮食、物产与店铺联动', 'EV', [
    ['food-festival', '饮食节'], ['themed-food', '咖喱等主题饮食活动'], ['tasting', '酒类品鉴'], ['regional-products', '地方物产活动'],
    ['market-festival', '市场节庆'], ['shop-tour', '店铺巡游活动'], ['shopping-street', '商店街联合活动'], ['temporary-dining', '期间限定餐饮空间'],
  ]),
  ...family('ev.markets', '市集、交易与交换', 'EV', [
    ['weekend', '周末市集'], ['antiques', '古物市'], ['flea-market', '跳蚤市场'], ['handmade', '手作市集'],
    ['farmers', '农产品市集'], ['books-records', '书市与唱片市'], ['exchange', '社区交换活动'], ['temporary', '临时集市'],
  ]),
  ...family('ev.sports', '运动、游憩与竞赛', 'EV', [
    ['community-sports', '地区运动会'], ['running-cycling', '跑步与自行车活动'], ['ball-games', '球类比赛'],
    ['traditional-games', '传统竞技'], ['walking', '街区步行活动'], ['outdoor-experience', '户外体验'],
    ['family-play', '亲子游憩'], ['open-practice', '公开练习与表演赛'],
  ]),
  ...family('ev.community', '社区、教育与公共参与', 'EV', [
    ['neighborhood', '町会与自治会活动'], ['school-festival', '学校文化祭'], ['campus-open', '校园开放'],
    ['residents', '居民交流'], ['cleanup', '社区清扫'], ['gardening', '园艺与绿地维护'], ['disaster-drill', '防灾演练'],
    ['lectures', '公共讲座'], ['volunteering', '志愿服务'],
  ]),
  ...family('ev.civic', '社群、纪念与公共表达', 'EV', [
    ['pride', 'Pride与LGBTQ社群活动'], ['language-culture', '国别或语言社群文化活动'], ['local-anniversary', '地方纪念活动'],
    ['remembrance', '追悼活动'], ['celebration', '公共庆祝'], ['issue-exhibition', '议题展览'],
    ['assembly-parade', '集会与游行'], ['cross-community', '跨社群交流'],
  ]),
];

export const MATERIAL_REGIONS = [
  { id: 'jp', name: '明确适用全国', parentId: null },
  { id: 'hokkaido', name: '北海道', parentId: 'jp', prefectureCodes: ['01'] },
  { id: 'tohoku', name: '东北', parentId: 'jp', prefectureCodes: ['02', '03', '04', '05', '06', '07'] },
  { id: 'kanto', name: '关东甲信', parentId: 'jp', prefectureCodes: ['08', '09', '10', '11', '12', '13', '14', '19', '20'] },
  { id: 'hokuriku', name: '北陆', parentId: 'jp', prefectureCodes: ['15', '16', '17', '18'] },
  { id: 'tokai', name: '东海', parentId: 'jp', prefectureCodes: ['21', '22', '23', '24'] },
  { id: 'kinki', name: '近畿', parentId: 'jp', prefectureCodes: ['25', '26', '27', '28', '29', '30'] },
  { id: 'chugoku', name: '中国地方', parentId: 'jp', prefectureCodes: ['31', '32', '33', '34'] },
  { id: 'shikoku', name: '四国', parentId: 'jp', prefectureCodes: ['36', '37', '38', '39'] },
  { id: 'kyushu-n', name: '九州北部与山口', parentId: 'jp', prefectureCodes: ['35', '40', '41', '42', '43', '44'] },
  { id: 'kyushu-s', name: '九州南部', parentId: 'jp', prefectureCodes: ['45', '46'] },
  { id: 'okinawa', name: '冲绳', parentId: 'jp', prefectureCodes: ['47'] },
  { id: 'metro', name: '首都圈', parentId: 'kanto', prefectureCodes: ['11', '12', '13', '14'] },
  { id: 'amami', name: '奄美', parentId: 'kyushu-s' },
];
