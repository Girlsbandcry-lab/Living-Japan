const step = (page, target, title, text, options = {}) => ({ page, target, title, text, ...options });
const editorEntry = '[data-action="browse-edit"],[data-action="browse-add"]';
const regionEntry = '#loc10List,#regionList';
const editing = tab => ({ open:'place:'+tab, fallbackTarget:editorEntry, missingHint:'先打开当前地点编辑，或在地区页新增空白草稿。已有草稿会保留；不需要填写或保存，也可略过。' });
const reading = {open:'reader',fallbackTarget:['[data-material-action="read"]','[data-material-read]','.lj-material-search input'],missingHint:'先选一个实际词条并打开正文；无内容也能查看。没有适合的条目可略过，不必建立教学资料。'};
const condition = {open:'conditions',fallbackTarget:['[data-reader="conditions"]','[data-reader-info] > summary','[data-material-read]'],missingHint:'先打开词条正文，再从“资料信息”打开适用条件。当前为通用时条件项收起；固定地域正文没有地域下拉。导览不替你改值，可略过不适用项。'};
const narrow = ui => ui.layout !== 'desktop';

// LJ-DETAILED-GUIDE-20261103: ten live walkthroughs share safe entry actions and host/modal-aware highlighting.
export const GUIDE_CHAPTERS = [
  {id:'interface',label:'入口、窗口与布局'},{id:'map',label:'地图、搜索与路线'},
  {id:'locations',label:'地点浏览与识别'},{id:'edit',label:'新增和编辑地点'},
  {id:'bindings',label:'附加资料的选择'},{id:'packages',label:'资料目录与正文'},
  {id:'conditions',label:'有效词与适用条件'},{id:'places',label:'设置与取用数量'},
  {id:'check',label:'检查与实际正文'},{id:'save',label:'备份、资料包与更新'},
];
const groups = {
  interface:[
    step('map','#living-japan-open','从达摩入口打开','点击达摩打开 Living Japan。它是入口，不会追加聊天文字，也不会替你发送消息。窗口打开后仍可随时结束导览。',{surface:'host'}),
    step('map','#living-japan-open','拖动入口和贴边收起','按住达摩拖到顺手的位置，松开后记住位置。靠近屏幕边缘时会贴边，闲置后缩成窄条；移入或点它即可使用。手机上拖动和长按是不同操作。',{surface:'host'}),
    step('map','#living-japan-floating-menu','右键或长按看快捷开关','电脑右键、手机长按打开快捷菜单。背景、简写、标准、细写控制上下提示词的描写要求；点选立即保存。下面分别控制地点正文，以及天气与四季、街区与户外、场馆与店铺、节庆与活动。',{surface:'host',open:'quick-menu',fallbackTarget:'#living-japan-open'}),
    step('map','.nav7,.top .nav','五个页面各管一件事','地图用于选择和路线；地点／地区用于浏览和编辑具体对象；资料管理可复用词条；检查／诊断看读取结果；齿轮进入设置。高亮底色表示当前页。'),
    step('map','[data-window-grip]','按六点柄移动窗口','横版和竖版顶栏左侧的六点柄可以拖动整个窗口，各自记住位置。拖标题空白处也可移动；普通按钮仍按按钮用途操作。',{when:ui=>ui.layout!=='mobile'}),
    step('map','[data-resize-edge]','拖边缘调整大小','右边、底边和右下角可调整大小；双击恢复适配。也可聚焦缩放柄，用方向键调整、回车复原。窗口位置与大小按横版、竖版分别记住。',{key:'window-resize',surface:'host',when:ui=>ui.layout!=='mobile'}),
    step('map','#lockButton,.tools7 button[title^="锁定界面"]','锁定、主题和关闭','锁定只决定点面板外是否关闭，不会冻结地点或开关。明暗按钮切主题；×关闭面板。有未保存内容时沿用原来的保存、放弃或继续编辑提示。'),
    step('settings','[data-settings-common="layout"]','选择适合屏幕的布局',ui=>ui.layout==='mobile'?'手机自动用手机布局，聊天输入框保留在下方；键盘弹出时面板整体上移。手机没有窗口拖动缩放柄，地图与内容之间仍可调比例。':'横版适合并排阅读，竖版集中成一列。切布局会保留地点草稿；正文和设置若有未保存内容，先按提示处理。导览不会自动替你切换。',{tab:'common'}),
  ],
  map:[
    step('map','[data-map-query],[data-map-region]','先选地区，再搜地点','输入已登记名称、别名或类型，地区框控制搜索范围。未载入地区先去资料包管理；地图搜索用于找对象，不等于聊天激活。'),
    step('map','[data-map-search-page],[data-lj-map="search-fit"]','分页与总览本页','结果编号对应本页地图落点。可用上一页、下一页或输入页码跳转；“总览本页”把本页结果收进视野。退出搜索恢复普通地图。',{fallbackTarget:'[data-map-query]',missingHint:'先搜索一个名称或类型，分页和总览本页才会显示。可略过。'}),
    step('map','[data-lj-map="search-choose"],[data-lj-map="locate"]','选中与只定位分开','点击结果名称选中地点；图钉只移动地图。选中后才查看详情、设起终点或追加。单纯选中不会发送消息。',{fallbackTarget:'[data-map-query]'}),
    step('map','[data-lj-map="append"],[data-map-title]','追加带行政归属的名称','追加按钮、双击地点或大标题把有效完整称呼放到聊天框。已登记归属时自动带都道府县、市及所属区町村，不夹生活带；无归属时会提示。正文标题仍用地点外显名。',{fallbackTarget:'[data-map-query]'}),
    step('map','[data-lj-map="read"],[data-lj-map="details"]','查看正文与相关地点','详情可以读当前地点的一句话和正文。相关地点可切换或追加；列表中的名字不代表它们的全部正文都进入本次宏。',{fallbackTarget:'[data-map-query]'}),
    step('map','[data-map-mode],[data-lj-map="zoom-in"]','地图呈现和视野','示意、地图、精细、超精细切换呈现；加减号缩放，圆点复原视野。拖动地图只改变视野。普通地图收拢模式栏时，先点当前模式展开其他选项。'),
    step('map',ui=>ui.layout==='desktop'?'[data-lj-map="full"]':'#brandButton,#fullMapReturn','全地图与返回',ui=>ui.layout==='desktop'?'顶栏“全地图”扩大地图区，左缘“返回”恢复内容区。全地图也能搜索、选地点、设路线和查看详情。':'左上角四角框里的“大”进入全地图，左缘竖排“返回”恢复普通地图。全地图时百合只作标识，详情可收起或恢复。'),
    step('map','[data-lj-map="origin"],[data-lj-map="destination"]','设置起点与终点','先选一处地点设为起点，再选另一处设为终点。清空端点只清路线，不删除地点或搜索内容。坐标改动保存后，路线按当前端点重新估算。',{fallbackTarget:'[data-map-query]'}),
    step('map','[data-lj-map="travel"],[data-lj-map="depart"]','选择方式，再追加出发参考','可选公共交通、驾车、步行、自行车。结果是写作参考估算；“出发”把两端行政区、地点、方式和时间追加到聊天框。按钮不可用时先看路线提示，不会凭空补出可用路线。'),
    step('map','[data-map-favorites]','四个常用位置','点常用位置会选中并定位，空槽进入设置。四槽与地点星形收藏分开保存；它们服务快速找回和路线，并不直接发送正文。'),
    step('map',ui=>ui.layout==='mobile'?'[data-lj-map="history-menu"],[data-lj-map="stash-menu"]':'[data-map-history]','最近地点与手机暂存',ui=>ui.layout==='mobile'?'“最近”找回本次浏览记录；“暂存”可加入当前地点，也可逐项移除。它们不是星形收藏，也不是四个常用位置。':'浏览过的地点会进入最近列表。手机另有“最近／暂存”菜单；这些记录与收藏分开。',{fallbackTarget:'[data-map-query]'}),
    step('map','.lj-map-splitter','拖双线柄分配地图与阅读空间','上下拖动双线柄，调整地图和下方详情的比例。也可聚焦后用上下方向键，Home／End调到两端；竖版和手机版分别记住高度。全地图无需这个分隔柄。',{when:narrow,fallbackTarget:'#mainPlaceDetail'}),
  ],
  locations:[
    step('region','#loc10Search,#regionSearch','浏览、搜索与只看更改','名称、别名和类型都可搜索。“只看更改”集中显示个人修改稿和自建地点。清空搜索返回原浏览位置，长列表按页显示。'),
    step('region',regionEntry,'名称、查看、下级不是一件事','点名称选中对象；“查看”打开正文；“下级”进入直接包含的地点。没有正文也仍可查看对象资料，不必为浏览而新建内容。'),
    step('region','#regionCrumb,#loc10ListHead,.lj-detail-path','沿真实归属返回','祖先路径可逐级返回。横版显示路径，窄屏祖先按钮会缩短显示，停留提示和详情链接保留全名。生活片区、设施、内部店铺沿真实空间关系浏览。'),
    step('region','[data-action="browse-favorite"]','收藏和同级优先','星形收藏让同级清单靠前，也让符合范围的同级介绍优先抽选。收藏地区不会自动收藏其内部地点，不能突破N或绕过0。',{fallbackTarget:regionEntry}),
    step('region','[data-action="browse-hidden"]','隐藏只影响这个地点自身','隐藏去掉自身地图点位及宏中的名称、介绍、正文；目录、识别、父子关系保留，不连带隐藏后代。独立附加词条仍按条件工作，同一按钮可恢复。',{fallbackTarget:regionEntry}),
    step('region','.lj-detail-path,'+regionEntry,'地点和行政区怎样配对','先从文本末尾确定完整地点名或已登记组合，再核所属行政区；明确的新区优先，也可沿用回看范围内最近前文。裸“南区”等同名区要有市县上下文，不能跨区任选。'),
    step('region',editorEntry,'名称、归属和无行政地点','完整激活词只登记明确称呼，不是任意半词扫描。分店名中明确的位置段可参与配对；普通名字里的区名不自动定位。无行政归属的自建点仍可浏览、选地图，但不能靠裸名自动激活。'),
    step('region',editorEntry,'已有地点与新增地点','已有对象从详情打开编辑；“＋新增”打开空白草稿，默认采用当前目录。保存后回到实际父级并选中对象。下一篇会进入真实表单，但不会替你保存。'),
  ],
  edit:[
    step('region','.lj-place-editor nav','三页共用一份地点草稿','地点资料、附加资料、正文与介绍共用一份草稿。切页、去地图、切布局保留输入；下方保存一次提交。已有草稿会继续使用，不会为导览换成另一处。',editing('data')),
    step('region','[data-place-field="name"]','名称与修改权限','地点名称是外显名称，完整激活词用于识别。普通内置地点可改个人资料但坐标锁定；内置电车站身份和交通结构保持内置，仅正文与一句话可改；自建地点可改全套资料。',editing('data')),
    step('region','[data-place-type]','主要类型只选一个','主要类型决定地点分类、地图分类显示及同级介绍所属类别。附加资料是可复用背景词条，不是给此处多选主要类型。',editing('data')),
    step('region','[data-place-field="fullNames"]','登记完整激活词','每行填写一个明确完整称呼。清空后保存是明确空值；不要用普通连词或随意截断的字串代替店名。运行还会核行政归属和原有名称边界。',editing('data')),
    step('region','#lj-place-parent-query','选择直接上级','搜索地区或地点，再从结果选直接上级；它决定目录位置和实际空间关系。归属信息用于行政及地域条件，行政祖先不因此自动展开挂词条。清空归属前看清对取用的影响。',editing('data')),
    step('region','[data-place-edit="pick"]','自建地点到地图选位置','只有自建地点可从这里去全地图选点。地图单击放临时标记，可拖动缩放后重选；此时没有保存地点。内置地点坐标锁定时可以略过。',{...editing('data'),open:'pick'}),
    step('map','[data-lj-map="pick-confirm"],[data-lj-map="pick-cancel"]','确认位置仍只是回填草稿','确认位置把临时点填回地点草稿，仍要回编辑页保存。取消选点保留原坐标和其他输入；两种返回都恢复原地图视野。导览不会替你确认。',{retainPages:['region','map'],fallbackTarget:'[data-place-edit="pick"],'+editorEntry}),
    step('region','[data-place-field="summary"],[data-place-body]','一句话和正文分别填写','一句话用于卡片与同级参考，正文用于主体详细资料。有多个正文分支时先选对应版本；明确留空并保存就是采用空内容。',editing('text')),
    step('region','[data-place-edit="save"],[data-place-edit="cancel"]','保存、取消和未完成选择','保存才把地点草稿落盘；取消有实际修改时会先询问。待选词条也属于未保存内容，“保存并关闭”会一并添加；选继续编辑则保留原输入。',editing('data')),
    step('region','[data-place-state],[data-place-edit="restore-all"]','恢复内置也要最终保存','字段恢复或整体恢复先回填草稿，保存后才撤回个人覆盖并读取最新内置。整体恢复会先列范围；收藏、隐藏和额外独立正文槽保留。自建地点没有内置恢复。',editing('data')),
  ],
  bindings:[
    step('region','[data-place-edit="tab"][data-tab="bindings"],.lj-material-toolbar','已挂清单先看归类与状态','附加资料页列出名称、完整分类路径及本地点启用／暂停；同名词条可凭路径区分。顶部数量包含暂停项。挂接不会把同级地点的词条也展开。',editing('bindings')),
    step('region','[data-pm-action="more"]','暂停与移除的区别','“更多”展开本地点暂停／恢复或移除挂接。暂停保留联系，只影响当前地点；移除解除这条联系，不删除共享词条。都要最终保存地点才生效。',{...editing('bindings'),fallbackTarget:'.lj-material-toolbar,'+editorEntry}),
    step('region','[data-pm-action="add"],.lj-material-layer-grid,[data-pm-query]','打开添加词条','点击添加进入同一区域的选择界面。地点原保存栏会暂时收起，选择界面有自己的返回、取消和完成选择。已有地点草稿一直保留。',{...editing('bindings'),open:'bindings-add'}),
    step('region','.lj-material-layer-grid,.lj-material-type-entry','四类资料与单独的类型词条','天气与四季、街区与户外、场馆与店铺、节庆与活动是普通入口。类型词条单独放最后：不了解展开机制，不建议勾选，与本地点性质类型无关。',{...editing('bindings'),open:'bindings-add'}),
    step('region','[data-pm-choice],[data-pm-action="children"]','勾选自身，另点下级','复选框或名称只选当前词条，不级联下级；“下级”才进入下一层，“查看”读正文。上级分类即使没有自身正文，也可以作为真实挂接对象。',{fallbackTarget:'.lj-material-layer-grid',missingHint:'进入一个分类后即可看到词条行；不用实际勾选，可略过。'}),
    step('region','[data-pm-query],[data-pm-action="pending"]','搜索和待选跨页保留','搜索名称及完整分类路径，全库普通词条在前、类型在后；可翻页。待选只统计本次新增，换分类、搜索或翻页不丢勾选。再次勾选可反选。',{...editing('bindings'),open:'bindings-add'}),
    step('region','[data-pm-choice]:disabled,[data-pm-action="complete"]','已挂不重复，完成还需保存','已挂词条包含暂停项，都不可重复添加，不会意外启用。“完成选择”合并进地点草稿；返回／取消丢弃本次待选，保留原地点输入。之后仍需保存地点。',{fallbackTarget:'[data-pm-action="pending"],.lj-material-toolbar'}),
    step('region','[data-pm-action="preview"],.lj-material-preview-title','查看真实正文与版本','查看只读共享资料，不按当前聊天条件临时隐藏正文。多版本先选择地域／适用情况；条件摘要帮助判断用途。暂无正文与此版本暂无正文分别表示不同情况。',{fallbackTarget:'.lj-material-toolbar',open:'binding-preview'}),
    step('region','[data-pm-version],[data-pm-action="edit-material"]','去资料页编辑，再回地点','“在资料页编辑”打开当前选定版本。共享正文单独保存，可能影响其他使用它的地点；地点草稿、待选、搜索位置保留，资料页有“返回地点编辑”。',{fallbackTarget:'[data-pm-action="preview"]',open:'binding-preview'}),
  ],
  packages:[
    step('package','#pkg10Roots,#packageRoots','四类词条目录','这里管理可复用词条，不展开具体地点树。父项名称进入下级，旁边正文读它自己；末级名称直接阅读。词条能写活动、性质、设施、植物等背景。'),
    step('package','[data-material-scope="branch"],#pkg10CurrentSwitch,#packageCurrentSwitch','整支暂停与本级正文','整支控制本项及后代，保留各自选择；本级正文只管这一个词条自己的文字。上级关着时本级开着也暂不生效，但仍能查看、编辑和保存。'),
    step('package','.lj-material-search input','搜索与只看更改','可搜名称、别名、类型；清空恢复原位置。只看更改用于找个人修改稿。地点编辑跳来时，上方返回条可以回到保留的地点草稿。'),
    step('package','[data-material-action="multi"],[data-material-pick]','搜索后批量控制正文','多选、全选匹配、取消勾选用于当前搜索结果。开启／关闭所选只改勾中的正文，不替你打开父分支；换搜索词会清掉本次临时勾选。',{fallbackTarget:'.lj-material-search input'}),
    step('package','.lj-reader-overlay','阅读、内置原文与修改稿','横版在右侧读，窄屏进入阅读页。可切正文、内置原文或修改稿；查看原文不撤销修改。地点正文进入地点编辑，通用词条在此编辑。',{...reading,key:'reader'}),
    step('package','[data-reader="edit"],[data-reader="save"]','保存当前版本或恢复原版','编辑后点保存修改稿；清空并保存表示明确空内容。恢复原版只撤回当前版本的个人修改，内置为空时恢复为空。离开有修改时先选择保存、放弃或继续。',reading),
    step('package','[data-material-action="add"]','新增分类还是一种适用情况','当前分类的“＋新增”可建立下级词条或添加一种适用情况；TN根另有新增适用地域。分类自身已有正文入口，不必为了写一段话强行增建子片段。',{open:'material-add',fallbackTarget:'#pkg10Roots,#packageRoots'}),
    step('package','dialog[open] [data-choice="category"],dialog[open]:has([data-dialog-title="新增分类"]) [name="name"]','新建下级词条的表单','先选新增下级词条，再填写分类名称。TN根可选地点挂接后适用或按地域与时间适用；保存会建立词条，正文可以以后补。导览不替你建立。',{open:'category-form',fallbackTarget:'[data-material-action="add"]'}),
    step('package','dialog[open] [data-choice="fragment"],dialog[open]:has([data-dialog-title="添加一种适用情况"]) [name="title"]','增加一种适用情况','给情况起可辨名称并选适用地域。“建立并编辑”会先建立记录，再打开正文；之后从资料信息编辑条件。不要把这一步当成仅预览。',{open:'fragment-form',fallbackTarget:'[data-material-action="add"]'}),
    step('package','dialog[open] [data-choice="region"],dialog[open]:has([data-dialog-title="新增适用地域"]) [name="name"]','TN新增适用地域','只有TN根新增菜单提供此项。地域是资料适用版本，不等于给行政地点库新增一座城市；实际地点归属仍在地点页管理。没有此入口可略过。',{open:'region-form',fallbackTarget:'[data-material-action="add"]'}),
  ],
  conditions:[
    step('package','[data-material-action="keywords"],[data-reader="keywords"],dialog[open] [name="activationKeywords"]','可选的独立有效词','每行一个。命中后取本词条本级正文及直接适用情况，仍检查条件与开关；不会递归取全部孩子。留空仍保留原挂接入口。',{open:'keywords',fallbackTarget:['[data-reader-info] > summary','[data-material-read]']}),
    step('package','[data-reader-info] > summary,[data-reader="conditions"]','从资料信息进入条件','先选准确的正文版本，再展开资料信息打开适用条件。它们约束这份文字，不改变地点身份；保存条件和保存正文是各自的操作。',{open:'reader-info',...{fallbackTarget:'[data-material-read]'}}),
    step('package',['dialog[open] [name="applicability"]','dialog[open].lj-condition-dialog'],'通用与按条件','通用表示不限地域、日期、时段和天气，但仍需独立有效词、地点挂接或原有取用入口。按条件时各项须同时满足；导览不会替你切换或清条件。',condition),
    step('package','dialog[open] [name="regionId"],dialog[open] [data-choice="unrestricted"]','不限地域不等于全国','不限地域无需地点提供适用地域；旧全国仍是地域版本，没有自动改为不限地域。TN本级正文的地域随版本固定，可用“打开不限地域正文”前往对应版本。',condition),
    step('package','dialog[open] [name="months"],dialog[open] [name="monthParts"]','月份和上中下旬','月份可填多个，留空不限；旬可勾上旬1—10日、中旬11—20日、下旬21日至月底。聊天只给明确旬时不会补造具体日，诊断会保留这个精度。',condition),
    step('package','dialog[open] [name="startDate"],dialog[open] [name="endDate"]','起止月日可跨年','日期窗填写月日，例如12-20至01-10可跨年。它与月份、旬等已有条件一起筛选；活动默认日期只是可修改的初值，打开旧内容不会替你改写。',condition),
    step('package','dialog[open] [name="timePreset"]','三小时时段只是填写辅助','八段从00:00—02:59到21:00—23:59。选择后回填原起止时刻，仍能继续改；保存重开只有精确对应才显示预设，其余显示自定。辅助选项本身不写进资料。',condition),
    step('package','dialog[open] [name="startTime"],dialog[open] [name="endTime"]','自定、跨夜和不限时刻','可以自定分钟，也支持22:00至02:00这样的跨夜范围。不限时刻会清空起止，含义不同于00:00—23:59。仅切自定而未改端点，不会凭空制造未保存修改。',condition),
    step('package','dialog[open] [name="weatherTypes"]','天气与保存条件','不勾天气表示不限；勾选后仍同时检查日期、时段和地域。点保存才生效，取消有改动会询问；可继续保留表单。导览结束不会替你保存或放弃。',condition),
  ],
  places:[
    step('settings','[data-settings-common="masterEnabled"]','先看每组怎样保存','常用开关、主题、地图分类和配额即时保存；读取设置和四个常用位置各用自己的保存按钮。不要把在页面里填写过当成已经保存。',{tab:'common'}),
    step('settings','[data-settings-common="namedPlaceBodiesEnabled"],[data-settings-common="layer:TN"]','总提示、具名正文与四通道','提示注入控制自动读取；具名地点正文和四条资料通道分别控制，暂停保留子项选择。手动追加名称和路线独立；同级其他大生活带开关不等于分类配额。',{tab:'common'}),
    step('settings','[data-settings-common="skipUserLocationInput"]','跳过用户地点不跳过时间天气','开启后地点改读回看范围内AI回复，时间天气仍读本轮输入；独立资料有效词也沿原通道读取。它不关闭地图或整条资料通道。',{tab:'common'}),
    step('settings','[data-settings-reading="textScript"],[data-settings-reading="wrapperMode"],[data-settings-reading="historyDepth"]','文字、包裹档位和回看层数','简繁输出、描写档位及回看多少层AI回复在此设置。0表示不回看。包裹提示词强调资料调用程度和使用方式，不等于另设地点识别规则。',{tab:'reading'}),
    step('settings','[data-settings-boundary],[data-settings-channel]','输入边界与通道标签','本轮输入开始／结束标签要成对填写或一起留空。AI回复有优先标签时取标签内，排除标签跳过；多标签可用顿号或逗号分隔，最后保存读取设置。',{tab:'reading'}),
    step('settings','[data-place-category-mode]','地图显隐和同级数量分开','地点设置内切换地图显示或同级介绍。地图分类显隐只管显示，不删资料、不关闭正文；单点隐藏回地点详情处理。',{tab:'favorites'}),
    step('settings','[data-peer-place-quota]','0/N只管同级介绍','每行默认最多5个，0是不附带该类同级介绍，N是该行上限；分组没有总额度。“未细分”只管没有落入子类的地点。主体和最多两层真实空间上级挂词条不受这个数字预算。',{tab:'favorites',open:'quotas',fallbackTarget:'[data-place-category-mode="introductions"]'}),
    step('settings','[data-peer-place-quota]','收藏先取，余额随机补足','N=3且合格收藏2个时先取2个，再随机补1个；收藏超N也只抽N，不能绕过0。隐藏项先排除；同次宏复用本次选择，新一轮或刷新预览可重抽。',{tab:'favorites',open:'quotas',fallbackTarget:'[data-place-category-mode="introductions"]'}),
    step('settings','[data-favorite-index],[data-settings-action="save-favorites"]','保存四个常用位置','填写已有地点全名和自定义短名，也可使用当前地点。保存常用地点只保存这一组，它们服务地图快速定位和路线，与星形收藏分别管理。',{tab:'favorites'}),
  ],
  check:[
    step('diagnostic','[data-lj-diag-record]','实际记录和当前预览','实际记录保留本聊天上一轮宏情况；预览按当前内容与设置试算。刷新预览不覆盖实际记录，也不会发送聊天；随机同级介绍可能重新抽取。'),
    step('diagnostic','.lj-diagnostic-reading-summary','本次读到了什么','摘要分别列日期、时刻、天气和地点，并注明各自来源。几项可以来自不同消息；只读到旬时没有具体日，跨午夜的时间会保留原来读取结果。'),
    step('diagnostic','.lj-diagnostic-reading-place,[data-lj-diag-place-match]','未命中地点先看行政原因','未读到行政区、同名区不唯一、区与地点不符、新区阻断前文、地点未登记归属，是不同原因。先确定最近名称候选再核行政，不能因失败把内嵌短名当成新地点。'),
    step('diagnostic','[data-lj-diag-filter],[data-lj-diag-query]','筛结果、搜原因、定位正文','可筛拼接、开关限制、空正文、候选／选中、合并，再搜名称、类型、来源或原因。点结果进入对应正文；候选或选中不一定代表最后已经拼接。'),
    step('diagnostic','[data-lj-diag-tab="channels"]','读取通道看详细证据','通道页可查本轮输入、AI回复、优先排除标签和取材过程；读取设置入口会转到对应通道。诊断只说明当前记录，不会替你改设置。'),
    step('diagnostic','[data-lj-diag-tab="prompt"],[data-lj-diag-tab="raw"]','提示词全文和原始报告','全文页显示该记录实际组装文字，可单独复制提示词或JSON。完整诊断复制的是当前选择记录，不会混用上一轮与预览。'),
    step('diagnostic','[data-lj-diag-action="copy"]','宏展开与模型使用分开','宏已展开只证明扩展组装了资料，不证明目标模型已收到或采用。把Living Japan宏放入实际生成用的提示词或世界书后，再到酒馆Main Prompt核实际展开。需要帮助可复制完整诊断。'),
  ],
  save:[
    step('settings','[data-settings-action="export"]','完整个人备份的范围','包含自建地点、个人地点修改、正文修改稿与空位、资料分类地域片段挂接、收藏隐藏和全部设置；不包含内置地区资料包。导览不自动导出或导入。',{tab:'backup'}),
    step('settings','[data-settings-action="export"]','生成备份后保存实际文件','导出生成的是已保存资料，未保存草稿不在备份中。生成后点“保存备份文件”取得JSON；需要时可再次点保存链接重试。确认浏览器实际保存了文件，再放到自己能找到的位置。',{tab:'backup'}),
    step('settings','[data-settings-action="import"]','导入先看预览再确认','选择自己的备份文件后先预览新增、覆盖与未对应范围；取消不导入，确认才合并。相同标识可能覆盖目标端内容，目标端独有内容继续保留，不是整库重置。',{tab:'backup'}),
    step('settings','[data-settings-action="import"]','旧稿、重复页面和未保存内容','未对应旧稿仍保留在备份中。另一页面已保存新内容时，先保护自己未保存的文字，关闭重复页面再刷新；导入前也要按现有提示处理正在编辑的内容。',{tab:'backup'}),
    step('settings','[data-settings-action="check-update"],[data-settings-action="update"]','程序更新与资料更新分开','检查程序更新只检查扩展框架；更新程序是另一个操作。内置更新保留个人覆盖，未覆盖字段读取新内置。导览不会检查、下载或安装更新。',{tab:'backup'}),
    step('settings','[data-settings-action="region-packs"]','打开地区资料包管理','首都圈是必需常驻资料，其他地区按需下载后启用。程序已安装不等于地区资料已下载；检查资料更新和更新记录是独立入口。',{tab:'backup',open:'packs'}),
    step('settings','#living-japan-region-pack-panel [data-pack-id]','下载、启停和移除','资料包卡片显示版本、下载进度及状态。暂停使用不删除个人内容；移除公共下载也保留个人正文、开关和收藏，重新使用仍需下载。导览只讲入口，不执行这些动作。',{tab:'backup',surface:'host',open:'packs',fallbackTarget:'#living-japan-region-pack-panel'}),
    step('settings','[data-settings-action="guide-all"]','随时重播任一篇','可从这里完整顺读或只看一篇，结束导览不替你处理业务草稿。学会操作后再自行保存需要的修改；空白教学草稿可按原取消流程关闭。',{tab:'backup'}),
  ],
};

export function guideStepsFor(ui, scope='all') {
  const chapters=scope==='all'?GUIDE_CHAPTERS:GUIDE_CHAPTERS.filter(chapter=>chapter.id===scope);
  const value=entry=>typeof entry==='function'?entry(ui):entry;
  return chapters.flatMap(chapter=>{
    const entries=(groups[chapter.id]||[]).filter(entry=>!entry.when||entry.when(ui));
    return entries.map((entry,index)=>({...entry,id:chapter.id+':'+(entry.key||index),chapterId:chapter.id,chapterLabel:chapter.label,chapterIndex:index+1,chapterCount:entries.length,target:value(entry.target),title:value(entry.title),text:value(entry.text)}));
  });
}

export function guideLayerHost(doc) {
  return [...doc.querySelectorAll('dialog[open]')].filter(dialog=>dialog.open&&!dialog.hidden).at(-1)||doc.body;
}

export function guideRectInDocument(target, destination) {
  let doc=target.ownerDocument,rect=target.getBoundingClientRect();
  let box={left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height};
  while(doc&&doc!==destination){
    const frame=doc.defaultView?.frameElement;if(!frame)break;
    const outer=frame.getBoundingClientRect(),sx=outer.width/frame.clientWidth,sy=outer.height/frame.clientHeight;
    box={left:outer.left+box.left*sx,top:outer.top+box.top*sy,right:outer.left+box.right*sx,bottom:outer.top+box.bottom*sy,width:box.width*sx,height:box.height*sy};
    doc=frame.ownerDocument;
  }
  return box;
}

export async function openGuideStep(ui, entry, {document:doc=globalThis.document}={}) {
  const action=entry.open;
  const note=message=>{ui.notify?.(message);return false;};
  if(ui.state.placeEditor?.picker)return note('请先确认位置或取消选点，地点草稿仍保留。');
  const selectors={reader:'[data-material-action="read"],[data-material-read]',conditions:'[data-reader="conditions"]',keywords:'[data-material-action="keywords"],[data-reader="keywords"]',
    'material-add':'[data-material-action="add"]','category-form':'dialog[open] [data-choice="category"]','fragment-form':'dialog[open] [data-choice="fragment"]','region-form':'dialog[open] [data-choice="region"]',
    'bindings-add':'[data-pm-action="add"]','binding-preview':'[data-pm-action="preview"]',pick:'[data-place-edit="pick"]',quotas:'[data-place-category-mode="introductions"]'};
  const target=selectors[action]&&doc?.querySelector(selectors[action]);
  const modal=[ui.bridge?.guideHost?.document,doc].filter(Boolean).map(owner=>owner.querySelectorAll?[...owner.querySelectorAll('dialog[open]')].at(-1):owner.querySelector('dialog[open]')).find(Boolean);
  if(modal){
    if(action==='packs'&&modal.matches?.('[data-lj-region-panel]'))return true;
    if(!target||!modal.contains(target))return note('先用当前表单自己的取消或关闭处理，导览不会代替你放弃内容。');
  }
  if(action==='quick-menu'){ui.bridge.guideHost?.openQuickMenu?.();return Boolean(ui.bridge.guideHost?.openQuickMenu);}
  if(action==='packs'){await ui.bridge.openPackages?.();return true;}
  if(action?.startsWith('place:')){
    const tab=action.slice(6),draft=ui.state.placeEditor;
    if(draft){
      if(tab==='new')return note('已有地点草稿，请先完成或按原取消流程处理；导览不会替换它。');
      if((await ui.showPage('region'))===false)return false;
      draft.tab=tab;ui.placeEditor.render();return true;
    }
    if(tab==='new'){await ui.placeEditor.open(null,{isNew:true});return Boolean(ui.state.placeEditor);}
    const entity=ui.state.selected;
    if(!entity)return note('先在地点清单选中一个对象，或点“＋新增”查看空白表单。');
    await ui.placeEditor.open(entity,{tab});return Boolean(ui.state.placeEditor);
  }
  if(action==='reader-info'){
    const info=doc.querySelector('[data-reader-info]');if(!info)return note('先打开一个词条正文。');info.open=true;return true;
  }
  if(!target||target.disabled)return note('请先打开当前步骤所需的入口；已有草稿保持原样，也可略过此项。');
  const info=target.closest('details');if(info)info.open=true;
  target.click();return true;
}
export function guideStepTarget(entry, find) {
  for(const selector of Array.isArray(entry.target)?entry.target:[entry.target]) {
    const target=find(selector);
    if(target)return {target,missing:false,hint:''};
  }
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
export function createGuideSession(ui, { settings, currentSettingsTab, canNavigate = () => true, onStep = () => {}, onClose = () => {} } = {}) {
  let steps = [], index = -1, scope = 'all', busy = false, epoch = 0, shownTab = '';
  async function move(nextIndex, nextSteps = steps, nextScope = scope) {
    if (busy || nextIndex < 0 || nextIndex >= nextSteps.length) return false;
    busy = true; const ticket = epoch;
    try {
      const next = nextSteps[nextIndex];
      const picker=Boolean(ui.state.placeEditor?.picker),samePage=(next.retainPages||[next.page]).includes(ui.state.page),changeTab=next.tab&&next.tab!==(currentSettingsTab?.()||shownTab);
      if(!canNavigate(next,{samePage,changeTab}))return false;
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
    const choice = await ui.ask({ title: '熟悉 Living Japan 的实际操作', message: '按十篇查看每个页面、新建编辑表单、拖动按钮和实际取用效果。可点“打开此界面”跟着看，也可略过；导览不替你保存、改值或改开关。设置 → 备份与说明可重播全部或任一篇。', choices: [{ id: 'start', label: '开始引导', primary: true }, { id: 'later', label: '稍后再看' }, { id: 'never', label: '不再自动提示' }] });
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
  const doc=document,hostDoc=ui.bridge.guideHost?.document||doc,view=hostDoc.defaultView;
  const documents=[...new Set([doc,hostDoc])];
  for(const owner of documents)if(!owner.getElementById('ljGuideStyle')){
    const link=owner.createElement('link');link.id='ljGuideStyle';link.rel='stylesheet';link.href=new URL('./guide.css',import.meta.url).href;owner.head.append(link);
  }
  let layer,card,ring,activeStep,priorFocus,frame,lastTarget,blockedBy,actionBusy=false,navigationHint='';
  const visible=node=>{
    if(!node||node.closest('[hidden]'))return false;
    for(let details=node.parentElement?.closest('details:not([open])');details;details=details.parentElement?.closest('details:not([open])'))if(!details.querySelector(':scope > summary')?.contains(node))return false;
    const rect=node.getBoundingClientRect();return Boolean(node.getClientRects().length&&rect.width&&rect.height);
  };
  const modalIn=owner=>[...owner.querySelectorAll('dialog[open]')].filter(visible).at(-1);
  function findVisible(selector){
    if(!selector)return null;
    const owner=activeStep?.surface==='host'?hostDoc:doc,modal=modalIn(owner);
    const editors=[...owner.querySelectorAll('.lj-reader-overlay,.lj-place-editor')].filter(visible);
    return [...owner.querySelectorAll(selector)].find(node=>{
      if(!visible(node))return false;
      if(modal){if(modal.contains(node))return true;blockedBy=modal;return false;}
      const cover=guideCoveringEditor(node,editors);if(cover){blockedBy ||= cover;return false;}return true;
    })||null;
  }
  function targetFor(entry){
    blockedBy=null;
    const resolved=guideStepTarget(entry,findVisible),cover=blockedBy;
    if(resolved.missing&&cover){
      if(cover.matches('dialog')){
        resolved.target=cover.querySelector('[data-dialog-title],h3,h2')||cover;
        resolved.hint='当前表单仍打开。可以继续阅读本表单的步骤；要看其他界面，请先用表单自己的取消或关闭处理。导览不会替你保存或放弃。';
      }else{
        const reader=cover.classList.contains('lj-reader-overlay');
        resolved.target=cover.querySelector(reader?'[data-reader="close"]':'[data-place-edit="cancel"]')||cover;
        resolved.hint=reader?'阅读器覆盖了这个入口。请用返回回清单；未保存内容按原提示处理，也可略过。':'地点编辑页覆盖了入口。原草稿保持不动；可继续编辑，或用取消按提示处理后再看本项。';
      }
    }
    if(resolved.missing&&ui.state.placeEditor?.picker){resolved.target=doc.querySelector('[data-lj-map="pick-confirm"],[data-lj-map="pick-cancel"]')||resolved.target;resolved.hint='地图仍在选点。先确认位置或取消选点，再继续；导览不会代替操作，也可略过。';}
    return resolved;
  }
  function theme(){
    const source=doc.defaultView.getComputedStyle(doc.body);
    for(const name of ['--accent','--panel','--ink','--muted','--soft','--line','--control-line']){const value=source.getPropertyValue(name).trim();if(value)layer.style.setProperty(name,value);}
  }
  function position(){
    frame=null;if(!layer||!activeStep)return;
    const parent=guideLayerHost(hostDoc);if(layer.parentNode!==parent)parent.append(layer);
    theme();
    const {target,missing,hint}=targetFor(activeStep),viewport={width:view.innerWidth,height:view.innerHeight};
    const note=card.querySelector('[data-guide-hint]');note.hidden=!missing&&!navigationHint;note.textContent=navigationHint||hint;
    const next=card.querySelector('[data-guide="next"]');next.textContent=next.dataset.last==='true'?'完成导览':missing?'略过本项':'下一步';
    card.style.maxHeight=`${Math.min(440,viewport.height-16,Math.max(190,viewport.height*.64))}px`;
    ring.hidden=!target;
    if(!target){card.style.left=`${Math.max(8,(viewport.width-card.getBoundingClientRect().width)/2)}px`;card.style.top='12px';lastTarget=null;return;}
    if(lastTarget!==target){lastTarget=target;target.scrollIntoView({block:'nearest',inline:'nearest'});}
    const rect=guideRectInDocument(target,hostDoc);
    Object.assign(ring.style,{left:`${Math.max(0,rect.left-3)}px`,top:`${Math.max(0,rect.top-3)}px`,width:`${Math.min(viewport.width,rect.width+6)}px`,height:`${Math.min(viewport.height,rect.height+6)}px`});
    const avoidance=target.closest('dialog[open]')||target;
    const box=placeGuideCard(guideRectInDocument(avoidance,hostDoc),card.getBoundingClientRect(),viewport);Object.assign(card.style,{left:`${box.left}px`,top:`${box.top}px`});
  }
  const schedule=()=>{if(layer&&frame==null)frame=view.requestAnimationFrame(position);};
  function hide(){
    if(frame!=null)view.cancelAnimationFrame(frame);frame=null;layer?.remove();layer=card=ring=activeStep=lastTarget=null;
    if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true});priorFocus=null;
  }
  const run=operation=>Promise.resolve().then(operation).catch(error=>ui.notify(error.message||String(error),'error'));
  const session=createGuideSession(ui,{...options,
    currentSettingsTab:()=>doc.querySelector('[data-lj-settings-tab][aria-pressed="true"]')?.dataset.ljSettingsTab,
    canNavigate(next,{samePage,changeTab}){
      if((!samePage||changeTab)&&documents.some(modalIn)){navigationHint='当前表单尚未关闭。请先按它自己的取消或关闭流程处理，再继续下一篇；导览不会放弃内容。';schedule();return false;}
      return true;
    },onClose:hide,onStep(step,index,count){
      activeStep=step;navigationHint='';
      if(!layer){
        priorFocus=doc.activeElement;layer=hostDoc.createElement('div');layer.className='lj-guide-layer';layer.dataset.ljGuide='true';
        ring=hostDoc.createElement('div');ring.className='lj-guide-ring';ring.setAttribute('aria-hidden','true');
        card=hostDoc.createElement('aside');card.className='lj-guide-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','false');card.setAttribute('aria-label','操作引导');
        layer.append(ring,card);guideLayerHost(hostDoc).append(layer);
        card.addEventListener('click',event=>{
          const button=event.target.closest('[data-guide]');if(!button)return;event.stopPropagation();
          const action=button.dataset.guide;
          if(action==='close'){session.close();return;}
          if(action==='open'){
            if(actionBusy)return;actionBusy=true;button.disabled=true;
            run(async()=>{try{await openGuideStep(ui,activeStep,{document:doc});}finally{actionBusy=false;if(button.isConnected)button.disabled=false;schedule();}});return;
          }
          run(()=>action==='previous'?session.previous():session.next());
        });
      }
      card.innerHTML=`<header><div><span class="lj-guide-chapter">${ui.esc(step.chapterLabel)} · ${step.chapterIndex}/${step.chapterCount}</span><strong>${ui.esc(step.title)}</strong></div><span>${index+1}/${count}</span></header><div class="lj-guide-copy"><p>${ui.esc(step.text)}</p><p class="lj-guide-hint" data-guide-hint role="status" hidden></p>${step.open?'<button type="button" class="lj-button lj-guide-open" data-guide="open">打开此界面</button>':''}</div><footer><button type="button" class="lj-button" data-guide="close">结束引导</button><button type="button" class="lj-button" data-guide="previous" ${index?'':'disabled'}>上一步</button><button type="button" class="lj-button primary" data-guide="next" data-last="${index===count-1}">下一步</button></footer>`;
      lastTarget=null;position();card.querySelector('[data-guide="next"]').focus({preventScroll:true});
    }});
  const escape=event=>{if(documents.some(modalIn))return;if(layer&&event.key==='Escape'){event.preventDefault();event.stopPropagation();session.close();}};
  const observers=[];
  for(const owner of documents){
    owner.addEventListener('keydown',escape);owner.addEventListener('scroll',schedule,true);owner.defaultView.addEventListener('resize',schedule);
    const observer=new owner.defaultView.MutationObserver(records=>{if(layer&&records.some(record=>!layer.contains(record.target)))schedule();});
    observer.observe(owner.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open','class','aria-pressed','style']});observers.push(observer);
  }
  return {...session,destroy(){session.close();observers.forEach(observer=>observer.disconnect());for(const owner of documents){owner.removeEventListener('keydown',escape);owner.removeEventListener('scroll',schedule,true);owner.defaultView.removeEventListener('resize',schedule);}}};
}
