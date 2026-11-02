const step = (page, target, title, text, options = {}) => ({ page, target, title, text, ...options });
const editorEntry = '[data-action="browse-edit"],[data-action="browse-add"]';
const regionEntry = '#loc10List,#regionList';
const editing = { fallbackTarget: editorEntry, missingHint: '先在地区清单选一处地点，点“编辑地点资料”；也可点“＋新增”打开空白草稿。导览不会替你建立或保存地点，可略过本项。' };
const textEditing = { ...editing, fallbackTarget: '[data-place-edit="tab"][data-tab="text"],' + editorEntry, missingHint: '先打开地点编辑页，再点“正文与介绍”。不需要实际改写或保存，也可略过本项。' };

// LJ-COMPLETE-GUIDE-20261102: seven read-only walkthroughs follow real controls and explain missing prerequisites.
export const GUIDE_CHAPTERS = [
  { id: 'map', label: '地图与路线' }, { id: 'locations', label: '地区与搜索' },
  { id: 'edit', label: '新增、编辑与恢复' }, { id: 'packages', label: '资料与正文' },
  { id: 'places', label: '地点设置与配额' }, { id: 'check', label: '检查与诊断' },
  { id: 'save', label: '读取、备份与更新' },
];
const groups = {
  map: [
    step('map', '[data-map-query]', '搜索已载入的地点', '输入名称、别名或类型，旁边可选搜索地区。结果按页查看，编号对应地图上的本页落点；清空搜索会退出结果。未载入地区可先到资料包管理下载。'),
    step('map', '.map-search-name7,.search-result-name,[data-lj-map="locate"]:not(:disabled)', '选中、定位、追加各有用途', '结果名称用于选中地点，图钉只移动地图。追加名称会放进聊天输入框；双击地图地点或地点大标题也可追加。需要正文时再点“详情”。', { fallbackTarget: '[data-map-query]', missingHint: '先搜索并选中一个已有地点，结果和地点操作区才会完整出现；可略过本项。' }),
    step('map', ui => ui.layout === 'desktop' ? '[data-lj-map="full"],[data-map-mode]' : '#brandButton:not(:disabled),#fullMapReturn', '地图模式与全地图', ui => ui.layout === 'desktop' ? '顶栏“全地图”扩大地图，返回可恢复内容区。示意、地图、精细、超精细用于切换呈现；缩放和复原视野不会替你追加名称。' : '左上角四角框里的“大”进入全地图。全地图时百合只作标识，下方“返回”按钮恢复普通地图。示意、地图、精细、超精细切换呈现；加减号缩放，圆点按钮复原视野。'),
    step('map', '[data-lj-map="origin"],[data-lj-map="destination"]', '组合起点、终点和出行方式', '分别给两个地点设起点、终点，再选公共交通、驾车、步行或自行车。“出发”追加交通参考文字；不可用时按钮会停用。清空起终点不删除地点，也不清空搜索。', { fallbackTarget: '[data-map-query]', missingHint: '先选中一处已有地点，才能看到它的起点、终点按钮；可略过本项。' }),
    step('map', '[data-map-favorites] button', '四个常用位置会选中并定位', '点击快捷位置会选中并定位到保存的地点，再按需要设起点或终点。空槽会带你到地点设置填写；这四个位置与地区页的星形收藏分别保存。'),
    step('map', ui => ui.layout === 'mobile' ? '[data-lj-map="history-menu"],[data-lj-map="stash-menu"]' : '[data-map-history]', '最近地点与手机版暂存', ui => ui.layout === 'mobile' ? '搜索旁的“最近”查看本次浏览记录；“暂存”可加入当前地点，之后返回继续选。暂存与最近列表用于找回地点，不等同于星形收藏或四个常用位置。' : '选过的地点会出现在最近列表，方便返回。手机版还在搜索旁提供“最近／暂存”菜单；这些浏览记录与星形收藏、四个常用位置分开。', { fallbackTarget: '[data-map-query]', missingHint: '最近列表在已有浏览记录时显示；手机版的暂存入口只在手机版提供，可略过本项。' }),
    step('map', ui => ui.layout === 'desktop' ? '.side7,.related-list7' : '.lj-map-splitter,#mainPlaceDetail', '阅读区与地图的空间', ui => ui.layout === 'desktop' ? '横版右侧显示当前地点及相关地点，详情打开正文阅读器。点相关地点可切换对象；收起内容区可腾出地图空间。' : '竖版、手机版可拖动地图和内容之间的双线柄调整比例。下方显示地点、相关地点和路线；“详情”读取正文，全地图下也保留对应入口。'),
  ],
  locations: [
    step('region', '#loc10Search,#regionSearch', '搜索、修改稿和新增在顶部', ui => `这里是${ui.layout === 'desktop' ? '横版“地点”页' : '“地区”页'}。搜索名称、别名或类型；“只看更改”筛正文修改稿和自建／个人登记地点，“＋新增”建立地点草稿。搜索结果可翻页，清空后回到原来的浏览位置。`),
    step('region', '#loc10List,#regionList', '选中地点与进入下级分开', '点名称选中本项并查看详情；“下级”进入它直接包含的地点，“查看”打开正文。正文为空时仍能阅读资料信息，再决定是否补写。分页只改变当前清单。'),
    step('region', '#regionCrumb,#loc10ListHead,.lj-detail-path', '沿上级路径返回', ui => ui.layout === 'desktop' ? '上部路径可回到各级目录；详情里的上级名称是完整的下划线链接，可直接返回。展开下级和返回搜索结果都保留原来的层级语境。' : '上部祖先按钮横向排列、文字竖排，只显示前三字；省略号表示名字较长，停留提示可看全名。详情里的下划线名称显示全名。行政结构抽屉也使用同样路径，深链可横滑。'),
    step('region', '[data-action="browse-favorite"]', '星形收藏会在同级靠前', '收藏可标记地点或地区，先对完整同级清单排序再分页。宏展开同级介绍时，也会优先取符合条件的收藏；收藏地区不会自动收藏其内部地点，也不能突破配额或绕过 0。', { fallbackTarget: regionEntry, missingHint: '选中一个已有地点或地区，就能看到星形收藏；无需实际点击也可继续。' }),
    step('region', '[data-action="browse-hidden"]', '隐藏只针对本地点自身信息', '隐藏会去掉该地点地图点位，以及它自身的宏名称、介绍和正文。目录、搜索识别、父子和关联关系保留，独立附加词条照原条件工作；不会连带隐藏后代。同一按钮可恢复。', { fallbackTarget: regionEntry, missingHint: '先选中一个实际地点查看“隐藏”按钮；导览不会替你隐藏，可略过本项。' }),
    step('region', '[data-action="browse-edit"],[data-action="browse-add"]', '从这里新增或编辑地点', '“＋新增”默认采用当前目录为直接上级，以后可以改；已有地点从详情点“编辑地点资料”。保存后会定位到该地点实际父级清单并选中详情，不会自动打开正文阅读器。'),
  ],
  edit: [
    step('region', '.lj-place-editor nav', '两个编辑分页共用一份草稿', '“地点资料”和“正文与介绍”共用底部保存。切页、去地图、切布局保留地点草稿；有实际修改时取消会先确认，空白可直接关闭。选“继续编辑”会保留输入，导览不会替你改写。', editing),
    step('region', '.lj-place-editor [data-place-field="name"]', '先分清哪些资料可以改', '普通内置地点只锁坐标，其余可个人修改；内置电车站的身份、类型、激活词、归属和交通结构保持内置，仅正文及一句话可改。自建地点的全部资料可改。', editing),
    step('region', '[data-place-type]', '主要类型只选一个', '此项决定地点的主要性质，用于地点分类、地图分类显示与同级介绍配额。下方“附加资料词条”不是给地点多选几个主要类型，两者分别设置。', editing),
    step('region', '[data-place-field="fullNames"],#lj-place-parent-query', '完整激活词与直接上级', '完整激活词每行一个，填写你希望用于识别的完整称呼。直接上级可搜索并选中地区或地点；修改归属会影响目录位置。清空完整激活词并保存，表示采用明确的空值。', editing),
    step('region', '.lj-place-bindings', '附加资料按条件一起展开', '附加词条可多选，筛选不会丢掉已勾选项。普通资料在前，“类型词条”在最后：不了解展开机制，不建议勾选，与本地点性质类型无关。这里的多选不替代上面的主要类型。', editing),
    step('region', '[data-place-field="summary"],[data-place-body]', '一句话和正文分别编辑', '在“正文与介绍”填写卡片用的一句话和地点正文；有多个正文分支时先选择对应项。留空并保存就是明确采用空内容。底部保存一次提交本地点资料、正文与词条草稿。', textEditing),
    step('region', '[data-place-edit="pick"]', '自建地点从编辑页去选点', '自建地点点击“去全地图选点”，在地图单击放临时标记，可继续拖动、缩放后重选。普通内置和内置电车站的坐标锁定，不显示此入口；新建地点需要先选好落点。', { ...editing, fallbackTarget: '.lj-place-editor,[data-action="browse-add"]', missingHint: '选点入口只在自建地点编辑页出现。可手动点“＋新增”查看草稿，无需保存；编辑内置地点时可直接略过。' }),
    step('region', '[data-lj-map="pick-confirm"],[data-lj-map="pick-cancel"]', '确认位置还不等于保存地点', '“确认位置”把临时点回填编辑草稿，最终仍要点编辑页“保存”。“取消选点”保留原坐标和其他草稿；返回时恢复原地图视野。导览不会替你确认或取消。', { retainPages: ['region','map'], fallbackTarget: '[data-place-edit="pick"],' + editorEntry, missingHint: '先在自建地点编辑页点击“去全地图选点”，这两个按钮才会出现；可略过本项。' }),
    step('region', '[data-place-state],[data-place-edit="restore-all"]', '恢复最新内置后仍需保存', '已修改字段旁可恢复内置；整体恢复先列清单再确认。它们先回填草稿，保存才移除个人覆盖并读取最新内置；收藏、隐藏和额外独立正文槽保留。自建地点没有内置恢复。', { ...editing, retainPages: ['region','map'], fallbackTarget: '.lj-place-editor,' + editorEntry, missingHint: '先打开一个内置地点的编辑页；字段有个人修改时才显示字段恢复，也可用页头“整体恢复内置”。不用实际恢复，可略过。' }),
  ],
  packages: [
    step('package', '#pkg10Roots button,#packageRoots button', '资料按四层查找', '时间与自然、外部地域、内部场所、明确场景事件是四个入口。进入分类看下级，点最末级正文阅读；层级路径、上一级和同级选择都可帮助返回。'),
    step('package', '#pkg10CurrentSwitch,#packageCurrentSwitch', '暂停整支不会改掉下级选择', '分支开关暂停这一整支，保留下级原选择；末级开关只控制本级正文。本级开着也可能“随上级暂停”，点暂停原因即可确认挡在哪一层。'),
    step('package', '.lj-material-search input', '搜索资料与找个人修改稿', '搜索名称、别名或类型，清空恢复原浏览位置；没有搜索时可用“只看更改”找修改稿。顶部说明条里的“＋新增”属于当前资料分类，不是新增地图地点。'),
    step('package', '[data-material-action="multi"],[data-material-pick]', '批量操作只改勾选的正文', '搜索后点“多选”，再勾选正文或“全选匹配”。开启／关闭所选只改这些正文，不会顺便打开父分支。修改搜索词会清掉上一次的临时勾选，需要重新确认。', { fallbackTarget: '.lj-material-search input', missingHint: '先搜索一个资料名称，“多选”按钮才会出现；导览不替你搜索或批量修改，可略过。' }),
    step('package', '.lj-reader-overlay', '阅读、比较原文与编辑修改稿', '打开正文后可看内置原文、选正文分支并编辑。地点正文会进入统一地点编辑页；资料片段在阅读器保存。“恢复原版”经确认后立即恢复当前正文，与地点编辑页先回草稿的恢复不同。', { fallbackTarget: ['[data-material-action="read"]', '[data-material-read]', '.lj-material-search input'], missingHint: '先搜索或逐级进入，再点最末级资料的“正文”打开阅读器；只需查看，不必修改或恢复，也可略过。' }),
    step('package', '[data-material-action="add"],.lj-reader-overlay [data-reader-info] > summary', '新增分类、片段和适用条件', '分类层“＋新增”可建下级分类或片段，时间与自然根层可新增适用地域。有实际输入时取消会先确认，继续编辑保留输入，空白可直接关。读取片段后，先打开“资料信息”，再点“编辑适用条件”，可设地域、月份、日期、时段、天气和替代组，多种条件需同时满足。', { fallbackTarget: '#pkg10Roots,#packageRoots', missingHint: '先进入一个资料大项或分类查看“＋新增”；已打开片段时，先展开“资料信息”再编辑条件。无需实际建立内容，可略过。' }),
  ],
  places: [
    step('settings', '[data-place-category-mode]', '地点设置里的两个独立面板', '设置顶部四页是真分页，点一页只看该页。地点设置把“地图显示”和“同级介绍”放在同一分类浏览器中；切换面板不会把地图显隐与介绍数量混为一个开关。', { tab:'favorites' }),
    step('settings', '[data-map-point-category],[data-map-point-all]', '地图分类只管地图显示', '在“地图显示”搜索分类，再调本类、整组或全部显示。这里不删资料，不关闭正文；电车站、地形和生活片区沿用自己的显示规则。若只想隐藏一个地点，应回地区详情使用“隐藏”。', { tab:'favorites', fallbackTarget:'[data-place-category-mode="map"]', missingHint:'先点击“地图显示”面板，就能看到分类显隐开关；导览不替你修改开关，可略过。' }),
    step('settings', '[data-peer-place-quota]', '同级介绍可设 0 或 N', '“同级介绍”默认每类 5 个，可填 0 或正整数，完成输入后即时保存。0 不展开该类；每个具体类型独立，上级数量不传给子类。它只限制附带介绍，不限制点库、地图或当前主体正文。', { tab:'favorites', fallbackTarget:'[data-place-category-mode="introductions"]', missingHint:'先点击“同级介绍”，数量框才会出现；无需改数，也可略过本项。' }),
    step('settings', '[data-peer-place-quota]', '收藏优先，余额随机补足', '例如 N=3、符合范围的收藏有2个，先取2个，再随机补1个；收藏超 N 也只随机取 N，不能绕过0。隐藏地点先排除，不占数量；新一轮生成或刷新预览可重抽，同一次宏结果会复用本次选择。', { tab:'favorites', fallbackTarget:'[data-place-category-mode="introductions"]', missingHint:'切到“同级介绍”即可查看数量设置；这些规则不用改任何数字也会生效，可略过。' }),
    step('settings', '[data-favorite-index],[data-settings-action="save-favorites"]', '四个快捷位置单独保存', '为四个位置填写已有地点全名和自定义短名，也可“使用当前地点”。点“保存常用地点”保存这一组；它们服务地图定位和路线，与地区页星形收藏分开。分类显隐和配额则即时保存。', { tab:'favorites' }),
  ],
  check: [
    step('diagnostic', '[data-lj-diag-record="actual"],[data-lj-diag-record="preview"]', ui => ui.layout==='desktop'?'横版“检查”看两种记录':'“诊断”看两种记录', '上一轮实际记录保留本聊天的宏运行情况；当前聊天预览是按现在内容和设置试算。“刷新预览”不会覆盖实际记录；可重新抽取本次随机介绍。'),
    step('diagnostic', '[data-lj-diag-tab="results"],[data-lj-diag-tab="channels"]', '看命中、关闭原因和读取通道', '资料结果可筛输出、开关限制、空正文、候选和合并。读取通道说明取自本轮输入还是 AI 回复，便于检查地点、时间、天气及标签；提示词全文显示本记录的实际文本。'),
    step('diagnostic', '[data-lj-diag-action="copy"]', '需要帮助时复制完整诊断', '复制完整诊断结果会带当前选中记录的完整报告；全文页也能单独复制提示词或 JSON。试算不是发送，实际“宏已展开”也只证明扩展生成了内容，不证明模型已经收到。'),
  ],
  save: [
    step('settings', '[data-settings-common="layout"],[data-settings-common="theme"]', '切布局、主题和锁定', '常用设置里的布局、主题、锁定即时保存。锁定只控制点击面板外部是否关闭；窗口位置仍可调整。切横版、竖版或手机版后，可从本布局的备份与说明重新播放导览。', { tab:'common' }),
    step('settings', '[data-settings-common="masterEnabled"],[data-settings-common="layer:TN"]', '总提示、具名正文和四通道', '提示注入控制自动读取；手动追加名称和路线独立。具名地点正文、四条资料通道各有开关，暂停保留下级选择。“同级其他大生活带介绍”只管大生活带，不等同于地点分类配额。', { tab:'common' }),
    step('settings', '[data-settings-common="masterEnabled"]', '宏负责把资料放进生成提示', ui => `把${ui.engine?.data?.macroName?' {{'+ui.engine.data.macroName+'}} ':' Living Japan 宏 '}放在用于生成的世界书或提示词中，生成时由扩展展开符合读取与开关条件的资料。只在地图选中地点不会发送；追加名称只是先放进聊天输入框。`, { tab:'common' }),
    step('settings', '[data-settings-common="skipUserLocationInput"]', '需要时跳过本轮用户地点', '开启“跳过用户地点输入”后，地点改读 AI 回复；时间、天气继续照常读取。它不关闭地图、正文或整个资料通道。回看 AI 的范围由读取设置决定。', { tab:'common' }),
    step('settings', '[data-settings-reading="textScript"],[data-settings-reading="historyDepth"]', '文字、描写档位与回看层数', '读取设置可选简繁文字、描写档位和回看多少层 AI 回复；0 表示不回看。先在本页调整，最后用“保存读取设置”统一保存，不会连带保存四个常用位置。', { tab:'reading' }),
    step('settings', '[data-settings-boundary],[data-settings-channel],[data-settings-action="save-reading"]', '输入边界与四通道标签', '本轮用户输入的开始／结束标签要成对填写或一起留空。AI 回复按各通道的优先标签取材；有优先标签时不回退标签外，排除标签里的内容会跳过。多个标签可用顿号或逗号分隔，完成后保存本组。', { tab:'reading' }),
    step('settings', '[data-settings-action="export"],[data-settings-action="import"]', '个人备份包含哪些内容', '完整备份包括地点个人修改、自建地点、正文与额外空位、资料词条、收藏隐藏及全部设置，不包含内置资料。导入先预览合并和覆盖范围；未对应旧稿仍在备份中保留。', { tab:'backup' }),
    step('settings', '[data-settings-action="region-packs"],[data-settings-action="check-update"]', '程序更新与地区资料分开', '检查程序更新和地区资料更新分别进行；资料包管理负责下载、载入与启停，首都圈为常驻必需资料。更新内置保留个人修改，未覆盖字段读取新内置。这里也能查看更新记录，重播全部或任意分篇。', { tab:'backup' }),
  ],
};

export function guideStepsFor(ui, scope='all') {
  const chapters=scope==='all'?GUIDE_CHAPTERS:GUIDE_CHAPTERS.filter(chapter=>chapter.id===scope);
  const value=entry=>typeof entry==='function'?entry(ui):entry;
  return chapters.flatMap(chapter=>(groups[chapter.id]||[]).map((entry,index)=>({...entry,id:chapter.id+':'+index,chapterId:chapter.id,chapterLabel:chapter.label,chapterIndex:index+1,chapterCount:groups[chapter.id].length,target:value(entry.target),title:value(entry.title),text:value(entry.text)})));
}
export function guideStepTarget(entry, find) {
  const target=find(entry.target);
  if(target)return {target,missing:false,hint:''};
  // LJ-GUIDE-READER-ENTRY-20261102: ordered fallback entries keep a search result's read button clear before using the earlier search field.
  let fallback=null;
  for(const selector of Array.isArray(entry.fallbackTarget)?entry.fallbackTarget:[entry.fallbackTarget]) {
    if(selector&&(fallback=find(selector)))break;
  }
  return {target:fallback,missing:true,hint:entry.missingHint||'当前入口尚未显示，请先打开本篇对应页面或选中一个地点；也可略过本项。'};
}
export function guideCoveringEditor(target,layers) {
  const rect=target.getBoundingClientRect(),x=(rect.left+rect.right)/2,y=(rect.top+rect.bottom)/2;
  return layers.find(layer=>{if(layer===target||layer.contains(target))return false;const box=layer.getBoundingClientRect();return x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom;})||null;
}

// LJ-LIVE-GUIDE-01: live controls only; navigation uses the existing unsaved-change gates.
export function createGuideSession(ui, { settings, currentSettingsTab, onStep = () => {}, onClose = () => {} } = {}) {
  let steps = [], index = -1, scope = 'all', busy = false, epoch = 0, shownTab = '';
  async function move(nextIndex, nextSteps = steps, nextScope = scope) {
    if (busy || nextIndex < 0 || nextIndex >= nextSteps.length) return false;
    busy = true; const ticket = epoch;
    try {
      const next = nextSteps[nextIndex];
      const picker=Boolean(ui.state.placeEditor?.picker),samePage=(next.retainPages||[next.page]).includes(ui.state.page),changeTab=next.tab&&next.tab!==(currentSettingsTab?.()||shownTab);
      if (!picker && next.page === 'settings' && ui.state.page === 'settings' && changeTab && settings?.requestLeave && !(await settings.requestLeave())) return false;
      if (!picker && !samePage && ((await ui.showPage(next.page)) === false || ui.state.page !== next.page)) return false;
      if (ticket !== epoch) return false;
      if (!picker && changeTab && ui.state.page==='settings') {await settings?.openTab?.(next.tab);shownTab=next.tab;}
      if (ticket !== epoch) return false;
      steps = nextSteps; index = nextIndex; scope = nextScope;
      await onStep(next, index, steps.length); return true;
    } finally { busy = false; }
  }
  function close() { epoch++; steps = []; index = -1; shownTab=''; onClose(); }
  async function start(value = 'all') {
    const nextSteps = guideStepsFor(ui,value);
    if (!nextSteps.length) return false;
    ui.state.guideOffered = true;
    return move(0, nextSteps, value);
  }
  async function next() {
    if (busy || index < 0) return false;
    if (index < steps.length - 1) return move(index + 1);
    if (scope === 'all') await ui.bridge.store.update(data => { data.extensionUi ||= {}; data.extensionUi.guide = { ...data.extensionUi.guide, completed: true }; });
    const download=scope === 'all' && ui.bridge.packages?.required;
    close(); if(download) await ui.bridge.openPackages({focusId:'metro',required:true}); return true;
  }
  async function offer() {
    const prefs = ui.bridge.store.read().extensionUi?.guide || {};
    if(ui.bridge.packages?.required && !ui.state.guideOffered) { ui.state.guideOffered=true; return prefs.completed ? ui.bridge.openPackages({focusId:'metro',required:true}) : start('all'); }
    if (prefs.autoPrompt === false || prefs.completed || ui.state.guideOffered) return false;
    ui.state.guideOffered = true;
    const choice = await ui.ask({ title: '熟悉 Living Japan 的实际操作', message: '按七篇查看真实入口和操作效果，可只阅读并略过实践。导览不会替你保存或更改地点、收藏及开关；也能在“设置 → 备份与说明”重播全部或分篇。', choices: [{ id: 'start', label: '开始引导', primary: true }, { id: 'later', label: '稍后再看' }, { id: 'never', label: '不再自动提示' }] });
    if (choice === 'never') await ui.bridge.store.update(data => { data.extensionUi ||= {}; data.extensionUi.guide = { ...data.extensionUi.guide, autoPrompt: false }; });
    return choice === 'start' ? start('all') : false;
  }
  return { start, next, previous: () => move(index - 1), close, offer };
}

export function placeGuideCard(target, card, viewport) {
  const clamp = (value, max) => Math.max(8, Math.min(value, Math.max(8, max)));
  const left = clamp(target.left, viewport.width - card.width - 8), top = clamp(target.top, viewport.height - card.height - 8);
  const choices = [{ left, top: target.bottom + 10 }, { left, top: target.top - card.height - 10 }, { left: target.right + 10, top }, { left: target.left - card.width - 10, top }];
  const fits = box => box.left >= 8 && box.top >= 8 && box.left + card.width <= viewport.width - 8 && box.top + card.height <= viewport.height - 8;
  const fit = choices.find(fits); if (fit) return fit;
  const overlap = box => Math.max(0, Math.min(box.left + card.width, target.right) - Math.max(box.left, target.left)) * Math.max(0, Math.min(box.top + card.height, target.bottom) - Math.max(box.top, target.top));
  return choices.map(box => ({ left: clamp(box.left, viewport.width - card.width - 8), top: clamp(box.top, viewport.height - card.height - 8) })).sort((a, b) => overlap(a) - overlap(b))[0];
}

export function mountGuide(ui, options = {}) {
  const doc = document;
  if (!doc.getElementById('ljGuideStyle')) { const link = doc.createElement('link'); link.id = 'ljGuideStyle'; link.rel = 'stylesheet'; link.href = new URL('./guide.css', import.meta.url).href; doc.head.append(link); }
  let layer, card, ring, activeStep, priorFocus, frame, lastTarget, blockedBy;
  const visible = node => {
    for(let details=node.parentElement?.closest('details:not([open])');details;details=details.parentElement?.closest('details:not([open])')){
      if(!details.querySelector(':scope > summary')?.contains(node))return false;
    }
    const rect=node.getBoundingClientRect();return !node.closest('[hidden]')&&node.getClientRects().length&&rect.width&&rect.height;
  };
  const findVisible = selector => {
    const editors=[...doc.querySelectorAll('.lj-reader-overlay,.lj-place-editor')].filter(visible);
    return [...doc.querySelectorAll(selector)].find(node=>{if(!visible(node))return false;const cover=guideCoveringEditor(node,editors);if(cover){blockedBy ||= cover;return false;}return true;});
  };
  function targetFor(entry){
    blockedBy=null;
    const resolved=guideStepTarget(entry,findVisible);
    const cover=blockedBy;
    if(resolved.missing&&cover){
      const reader=cover.classList.contains('lj-reader-overlay');
      resolved.target=findVisible(reader?'.lj-reader-overlay [data-reader="close"]':'.lj-place-editor [data-place-edit="cancel"]')||resolved.target;
      resolved.hint=reader?'阅读器覆盖了这个入口。先用阅读器“返回”回到清单；如有未保存输入，按提示选择处理，也可继续编辑并略过本项。':'地点编辑页覆盖了这个入口。可用底部“取消”返回；有修改时会先确认，选“继续编辑”会保留输入。也可略过本项。';
    }
    if(resolved.missing&&ui.state.placeEditor?.picker){resolved.target=findVisible('[data-lj-map="pick-confirm"],[data-lj-map="pick-cancel"]')||resolved.target;resolved.hint='地图仍在选点。请先确认位置或取消选点，再回到本篇对应页面继续查看；也可略过本项。';}
    return resolved;
  }
  function position() {
    frame = null; if (!layer || !activeStep) return;
    const {target,missing,hint}=targetFor(activeStep),viewport = { width: innerWidth, height: innerHeight };
    const note=card.querySelector('[data-guide-hint]');note.hidden=!missing;note.textContent=hint;
    const next=card.querySelector('[data-guide="next"]');next.textContent=next.dataset.last==='true'?'完成导览':missing?'略过本项':'下一步';
    card.style.maxHeight=`${Math.min(420,viewport.height-16,Math.max(180,viewport.height*.62))}px`;
    ring.hidden = !target;
    if (!target) { card.style.left = `${Math.max(8,(viewport.width-card.getBoundingClientRect().width)/2)}px`; card.style.top = '12px'; lastTarget=null;return; }
    if(lastTarget!==target){lastTarget=target;target.scrollIntoView({block:'nearest',inline:'nearest'});}
    const rect = target.getBoundingClientRect();
    Object.assign(ring.style, { left: `${Math.max(0, rect.left - 3)}px`, top: `${Math.max(0, rect.top - 3)}px`, width: `${Math.min(viewport.width, rect.width + 6)}px`, height: `${Math.min(viewport.height, rect.height + 6)}px` });
    const box = placeGuideCard(rect, card.getBoundingClientRect(), viewport);
    Object.assign(card.style, { left: `${box.left}px`, top: `${box.top}px` });
  }
  const schedule = () => { if (layer && frame == null) frame = requestAnimationFrame(position); };
  function hide() { if (frame != null) cancelAnimationFrame(frame); frame = null; layer?.remove(); layer = card = ring = activeStep = lastTarget = null; if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true }); priorFocus = null; }
  const run = operation => Promise.resolve().then(operation).catch(error => ui.notify(error.message || String(error), 'error'));
  const session = createGuideSession(ui, { ...options, currentSettingsTab:()=>doc.querySelector('[data-lj-settings-tab][aria-pressed="true"]')?.dataset.ljSettingsTab, onClose: hide, onStep(step, index, count) {
    activeStep = step;
    if (!layer) {
      priorFocus = doc.activeElement;
      layer = doc.createElement('div'); layer.className = 'lj-guide-layer';
      ring = doc.createElement('div'); ring.className = 'lj-guide-ring'; ring.setAttribute('aria-hidden', 'true');
      card = doc.createElement('aside'); card.className = 'lj-guide-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'false'); card.setAttribute('aria-label', '操作引导');
      layer.append(ring, card); doc.body.append(layer);
      card.addEventListener('click', event => { const button = event.target.closest('[data-guide]'); if (!button) return; if (button.dataset.guide === 'close') session.close(); else run(() => button.dataset.guide === 'previous' ? session.previous() : session.next()); });
    }
    card.innerHTML = `<header><div><span class="lj-guide-chapter">${ui.esc(step.chapterLabel)} · ${step.chapterIndex}/${step.chapterCount}</span><strong>${ui.esc(step.title)}</strong></div><span>${index + 1}/${count}</span></header><div class="lj-guide-copy"><p>${ui.esc(step.text)}</p><p class="lj-guide-hint" data-guide-hint role="status" hidden></p></div><footer><button type="button" class="lj-button" data-guide="close">结束引导</button><button type="button" class="lj-button" data-guide="previous" ${index ? '' : 'disabled'}>上一步</button><button type="button" class="lj-button primary" data-guide="next" data-last="${index === count - 1}">下一步</button></footer>`;
    lastTarget=null;position();
    card.querySelector('[data-guide="next"]').focus({ preventScroll: true });
  } });
  const escape = event => { if (doc.querySelector('dialog[open]')) return;if (layer && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); session.close(); } };
  doc.addEventListener('keydown', escape); doc.addEventListener('scroll', schedule, true); window.addEventListener('resize', schedule);
  const observer = new MutationObserver(records => { if (layer && records.some(record => !layer.contains(record.target))) schedule(); });
  observer.observe(doc.body, { childList: true, subtree: true, attributes:true,attributeFilter:['hidden','open','class','aria-pressed'] });
  return { ...session, destroy() { session.close(); observer.disconnect(); doc.removeEventListener('keydown', escape); doc.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule); } };
}
