const step = (id, title, text, action, params = {}, options = {}) => ({ id, title, text, action, params, ...options });
const scene = '4月12日，傍晚18:00，小雨。我们在示例县示例市木窗咖啡店。';
const rainScene = `${scene} 我们走到雨天檐下。`;
const dryScene = '7月12日，下午15:00，晴天。我们在示例县示例市木窗咖啡店，望向雨天檐下。';

export const WORKFLOW_CHAPTERS = [
  {
    id: 'interface', label: '先看它怎样帮你写作',
    summary: '从一句聊天开始，看背景资料怎样被找到，再交给写文 AI。',
    steps: [
      step('purpose', '它会替你找相关背景资料', 'Living Japan 会从聊天里读出地点、日期和天气，再从资料库取出合适的背景文字，交给写文 AI。这里用虚构示例带你走一遍：点下一步，页面会自动打开并演示；结束本章回到原工作。', 'map.select', { entity: 'cafe' }),
      step('story', '先有一段正在写的场景', '这是示例聊天：人物在示例市的木窗咖啡店，时间是四月傍晚，天气是小雨。你平常照常聊天写作，扩展会按读取设置寻找这些信息。', 'host.chat', { text: scene }, { surface: 'host' }),
      step('read', '到检查页，看它读到了什么', '现在打开检查页并刷新预览。这里把地点、日期、时刻和天气分别列出来，也显示各条资料为什么被选中。这次只是预览，还没有让 AI 写故事。', 'diagnostic.preview'),
      step('assembled', '看看准备交给 AI 的文字', '提示词全文里放着本次选出的地点和附加资料，前后还有指导 AI 怎样使用它们的提示词。想知道“这轮到底带了什么”，就看这里。', 'diagnostic.show', { tab: 'prompt' }),
      step('pages', '以后去哪里做哪件事', '地图帮你找位置和安排出行；地点页管理具体场所；资料页管理多个地点共用的文字；检查页查看取用结果；设置页调整长期习惯。现在打开的就是设置页。', 'settings.open', { tab: 'common' }),
      step('entry', '平常从达摩入口回来', '点击达摩打开扩展，电脑右键或手机长按可打开这个快捷窗。这里有总开关、描写档位和几类资料开关。导览中用上一步、下一步继续，结束本章后回到你原来的工作。', 'host.quickMenu', {}, { surface: 'host' }),
    ],
  },
  {
    id: 'map', label: '找地点，再安排一次出行',
    summary: '搜索地点，把完整称呼放进聊天，再从咖啡店走到庭院。',
    steps: [
      step('search', '先在地图上找咖啡店', '在地图搜索框输入木窗咖啡店。平常也可以搜类型，再缩小地区范围。搜索结果用来帮你找到对象；接下来选中其中一个。', 'map.search', { query: '木窗咖啡店' }),
      step('choose', '选中以后，操作都围绕它', '现在选中了木窗咖啡店。地图和详情指向同一个地点；从这里可以看正文、追加名称，或把它设为路线的一端。', 'map.select', { entity: 'cafe' }),
      step('append', '把完整地点名放进聊天框', '追加名称后，聊天框里会出现带行政归属的完整称呼。这样能帮助扩展分清同名地点。你可以接着写自己的句子，再按平常的方式发送。', 'map.append', {}, { surface: 'host' }),
      step('origin', '把咖啡店设为起点', '现在把刚选中的咖啡店设为起点。路线会记住它，接着可以搜索或选择另一处地点作为终点。', 'map.origin'),
      step('other-place', '再选择要去的庭院', '这次选中林荫庭院。详情已经换成庭院，之前设好的起点仍然保留。选择地点和设置路线端点是两个连续动作。', 'map.select', { entity: 'court' }),
      step('destination', '把庭院设为终点', '现在两端都已确定：从木窗咖啡店到林荫庭院。想换目的地时，可以另选一个地点，再把它设为终点。', 'map.destination'),
      step('travel', '选一种出行方式', '这里选择步行，查看估算用时。驾车、自行车等方式也在这里切换；哪种方式有结果，以当前资料和路线提示为准。', 'map.travel', { mode: 'walking' }),
      step('depart', '把出行参考接到聊天后面', '点出发后，聊天框会添上两端地点、方式和估算时间。你可以据此继续写路上的场景；这一步把参考文字放进输入框，发送仍由你决定。', 'map.depart', {}, { surface: 'host' }),
      step('favorite', '常走的地点可以放进快捷位置', '地图上的四个常用位置在这里设置。选用已有地点、填写短名，再点保存常用地点，下次就能从地图快速选回它。这与地点旁的星形收藏分别管理。', 'settings.set', { scope: 'favorite', index: 0, entity: 'cafe', label: '木窗', save: true }),
    ],
  },
  {
    id: 'locations', label: '看清地点属于哪里',
    summary: '从会馆找到里面的咖啡店，读资料，再沿原路返回。',
    steps: [
      step('hall', '先找到整座会馆', '地点页按归属组织场所。现在选中庭院会馆，先看它是谁、属于哪里，再进入里面的地点。', 'browse.locate', { entity: 'hall' }),
      step('children', '进入会馆里面的地点', '点下级后，清单显示会馆直接包含的地点。下级是进入里面继续找；查看正文则是阅读当前对象自己的资料。', 'browse.children', { entity: 'hall' }),
      step('cafe', '选中里面的咖啡店', '这里选中木窗咖啡店。归属路径说明它位于会馆内，而会馆又位于庭院里。以后给它配资料时，这条真实空间关系也会参与取用。', 'browse.locate', { entity: 'cafe' }),
      step('read', '读这家店自己的正文', '现在打开咖啡店正文。一句话适合快速辨认，正文用来了解空间和特色。想改这家店独有的文字，从地点编辑进入；多个地点共用的背景文字在资料页管理。', 'place.read', { entity: 'cafe' }),
      step('return', '沿归属回到会馆', '读完后回到庭院会馆。查看内部地点不会把原来的层级关系改掉；你随时可以沿归属路径回到外面的场所。', 'browse.locate', { entity: 'hall' }),
      step('star', '把常找的咖啡店收藏起来', '给咖啡店点星形收藏后，它会在同一上级里的地点清单中靠前；这一类允许附带介绍时，也优先选收藏项。收藏仍受数量设置限制。', 'browse.favorite', { entity: 'cafe', value: true }),
      step('hide', '暂时不想显示这个地点时', '隐藏后，这个地点自己的地图标记、名字、介绍和正文会暂停显示或输出。它仍留在地点目录中，内部地点也不会跟着一起隐藏。', 'browse.hidden', { entity: 'cafe', value: true }),
      step('restore', '从同一处恢复显示', '再次操作即可恢复咖啡店。收藏和隐藏各管自己的事：星形表示优先参考，隐藏控制这个地点自身是否显示和输出。', 'browse.hidden', { entity: 'cafe', value: false }),
    ],
  },
  {
    id: 'edit', label: '建立一个自己的地点',
    summary: '填地点资料，到地图选位置，回来写正文，最后保存。',
    steps: [
      step('new', '从地点页新增一个地点', '现在打开空白地点草稿。我们建一间虚构的临街小书屋。地点资料、附加资料、正文与介绍共用这一份草稿，最后一起保存。', 'place.open', { isNew: true, tab: 'data' }),
      step('identity', '写清名字、类型和直接上级', '示例已经填好名称、完整称呼，并选庭院会馆作为直接上级。直接上级表示它实际属于哪里；主要类型决定它放在哪一类。自己的地点可按实际情况修改。', 'place.fill', { fields: { name: '临街小书屋', fullNames: '临街小书屋' }, parent: 'hall', type: '书店' }),
      step('pick', '从编辑页去地图选位置', '点地图选点后，进入全地图。移动或缩放地图，再点书屋所在的位置。这里放的是临时标记，地点草稿还没有保存。', 'place.pick'),
      step('back', '确认位置后，回到同一份草稿', '确认位置会把坐标带回书屋草稿，刚才填的名字和归属都在。选错可以再去地图重选；取消选点则保留原坐标。', 'place.confirmPosition', { longitude: 139.7042, latitude: 35.6899 }),
      step('text', '分别写一句话和正文', '一句话用于清单和顺带介绍；正文写这个场所独有的空间与特色。这里填入示例文字，仍属于同一份地点草稿。', 'place.fill', { fields: { summary: '会馆临街一侧的小书屋，靠窗设有阅读座位。', body: '临街小书屋在会馆一层，书架沿墙排开，中央留出通道。玻璃窗旁放着两张阅读桌，门口与会馆走廊相接。' }, tab: 'text' }),
      step('save', '现在保存，地点才正式留下', '保存后，编辑页关闭，目录回到书屋实际所属的位置，并选中这个新地点。去地图选点、切编辑页签都只是准备，保存这一步才提交整份地点资料。', 'place.save'),
      step('reopen', '重新打开，确认保存后的内容', '再次打开书屋的正文与介绍，可以看到刚才保存的内容。以后修改同一个地点，也从这里进入；取消有改动的草稿时，会让你选择怎样处理。', 'place.open', { entity: 'new', tab: 'text' }),
    ],
  },
  {
    id: 'bindings', label: '给地点配上附加资料',
    summary: '给咖啡店加一份雨天资料，保存后看它如何参与本轮场景。',
    steps: [
      step('open', '先打开咖啡店的附加资料', '附加资料是多个地点可以共用的背景文字。咖啡店已经配有木窗与长桌；这次再加雨天檐下。每项都有分类路径，方便分清同名资料。', 'place.open', { entity: 'cafe', tab: 'bindings' }),
      step('add', '进入添加词条', '这里可以按分类找，也可以直接搜名称。天气与四季、街区与户外、场馆与店铺、节庆与活动是查找入口；选到的文字是否适用，还要看它自己的条件。', 'bindings.add'),
      step('choose', '把雨天檐下放入待选', '勾选只选择当前这一项。换分类、搜索或翻页，待选内容都会保留；不会因为选了一个分类，就把下面全部资料一起加入。', 'bindings.choose', { material: 'rain' }),
      step('complete', '完成选择，回到地点草稿', '完成选择后，雨天檐下出现在咖啡店的附加资料清单里。此时只是加入草稿，接下来还要保存地点。', 'bindings.complete'),
      step('preview', '先读一遍准备加的文字', '现在打开雨天檐下的正文和适用说明。有多个版本时，可以分别查看。暂停只让这家店暂时不用它，移除则解除这家店与它的联系；共享文字仍留在资料库。', 'bindings.preview', { material: 'rain' }),
      step('save', '保存地点，让这份联系生效', '返回清单后保存咖啡店。以后读到这家店时，扩展会检查它配的资料，也会检查最近最多两层真实空间上级所配的资料。', 'place.save'),
      step('scene', '回到一个符合条件的场景', '示例聊天写明四月傍晚、小雨和咖啡店。现在回到检查页，就能看到刚才配上的雨天资料是否适合这轮场景。', 'host.chat', { text: scene }, { surface: 'host' }),
      step('result', '看这份资料实际怎样被选入', '刷新预览后，检查雨天檐下的结果。地点与资料的联系只是入口，日期、天气和各项开关仍会参与选择。同级地点顺带出现时，只附名字与一句话。', 'diagnostic.preview'),
    ],
  },
  {
    id: 'packages', label: '修改共享文字，再回地点',
    summary: '从咖啡店进入它使用的词条，保存正文，再回到原地点草稿。',
    steps: [
      step('place', '从正在编辑的地点出发', '现在打开咖啡店的附加资料。我们要改木窗与长桌的共享文字，因此先从这家店正在使用的那一项进入。', 'place.open', { entity: 'cafe', tab: 'bindings' }),
      step('read', '先确认要改的是这一份', '查看正文与适用情况，确认选对词条和版本。同一份共享文字可以被多处地点使用；只想改咖啡店独有的描述，应回地点正文里修改。', 'bindings.preview', { material: 'wood' }),
      step('go-material', '去资料页编辑，地点草稿留在原处', '点在资料页编辑，来到同一词条的正文。页面上会出现返回地点编辑；咖啡店草稿、已经选择的资料和原来的查找位置都会保留。', 'bindings.edit'),
      step('edit', '在资料页修改共享正文', '现在进入编辑。这份文字讲木窗与长桌这一类共同特征，可以供多个地点使用。目录用于找词条，正文区用于读写选中的文字。', 'material.edit'),
      step('save', '保存这份文字自己的修改稿', '这里保存的是共享正文。以后其他地点使用同一个版本时，也会读到这份修改；你可以随时查看内置原文，或只恢复当前版本。', 'material.save', { text: '木框窗旁摆着一张长桌，桌面留出写字和放杯子的空处。靠窗座位朝向庭院，坐下后可以看见窗外的步道。' }),
      step('return', '返回原来的咖啡店编辑', '现在点返回地点编辑，回到刚才那份咖啡店草稿。共享正文刚才已经独立保存；若同时改了地点资料，还要在地点这里保存一次。', 'material.returnPlace'),
      step('verify', '在地点侧看到同一份新文字', '重新查看木窗与长桌，已经能读到刚保存的内容。地点页负责这家店配了哪些资料，资料页负责这些共享文字写什么，两边始终使用同一份内容。', 'bindings.preview', { material: 'wood' }),
    ],
  },
  {
    id: 'conditions', label: '让文字在合适的时候出现',
    summary: '为一份资料设适用情况，再用两段聊天对照结果。',
    steps: [
      step('reader', '先选中要设置的那份文字', '现在在资料页打开雨天檐下。条件属于当前这份文字；如果词条有多个版本，要先选对版本，再修改它的适用情况。', 'material.reader', { material: 'rain' }),
      step('keyword', '也可以用一个明确的词来调用它', '这里给这份资料登记雨天檐下这个有效词。聊天里出现它时，也可以找到这份资料。留空时仍可通过地点所配资料等已有入口使用。', 'material.keywords', { keywords: ['雨天檐下'] }),
      step('open', '从资料信息打开适用条件', '正文负责写内容，适用条件负责何时采用它。两处分别保存。现在从资料信息打开条件表单。', 'conditions.open'),
      step('fill', '示例设成四月傍晚的小雨天', '这里选择按条件取用，填写四月、15:00至20:59和小雨，地域留为不限。这几项要同时符合。通用文字则不限制地区、日期、时段和天气，但仍需要一个使用入口。', 'conditions.fill', { applicability: 'conditional', months: [4], startTime: '15:00', endTime: '20:59', weatherTypes: ['light_rain'], regionId: 'unrestricted' }),
      step('save', '保存条件，再回到正文', '保存后返回这份文字。需要时还可以按上中下旬、起止月日或跨夜时段进一步填写；三小时时段选项只是帮你快速填入时间。', 'conditions.save'),
      step('match', '先看符合条件的聊天', '这段聊天同时写到有效词、四月、傍晚和小雨。我们保留这些信息，去检查页看结果。', 'host.chat', { text: rainScene }, { surface: 'host' }),
      step('included', '符合时，资料可以进入全文', '现在刷新预览。雨天檐下可以通过登记的有效词被找到，再通过刚才保存的条件，成为本轮背景文字。', 'diagnostic.preview'),
      step('change', '把场景换成七月晴天', '这次仍提到雨天檐下，但日期和天气换了。资料被找到以后，还会继续核对条件，所以出现有效词并不等于每次都采用全文。', 'host.chat', { text: dryScene }, { surface: 'host' }),
      step('excluded', '回检查页，看到没有采用的原因', '刷新后查看雨天檐下的结果：这段场景不符合刚才设定的月份和天气。以后资料没有出现，可以按这条路线回查条件，而不用反复重建词条。', 'diagnostic.preview'),
    ],
  },
  {
    id: 'places', label: '调整取用数量与描写详略',
    summary: '改变同级介绍数量和描写档位，再看这些设置分别影响哪里。',
    steps: [
      step('scene', '用同一段场景比较设置', '先保留这段咖啡店场景。接下来只调整设置，便于看清同级介绍数量与描写档位各自改变什么。', 'host.chat', { text: scene }, { surface: 'host' }),
      step('before', '先看默认附带了哪些同级地点', '同级地点就是归在同一直接上级下的地点。刷新预览后，能看到当前咖啡店的资料，以及按数量选出的同级地点名字与一句话。接下来到地点设置，把咖啡馆这一类的数量改为0。', 'diagnostic.preview'),
      step('zero', '到地点设置，把同级介绍改为零', '现在打开地点设置的同级介绍，咖啡馆这一行已改为0并即时保存。每行通常默认最多5个，收藏也不能超过该行数量。旁边的地图显示只管地图上显示哪些类别。', 'settings.set', { scope: 'quota', key: 'in.food.cafe', value: 0 }),
      step('result', '回检查页，看看它影响哪部分', '刷新预览后，这一类同级介绍不再附带。当前咖啡店自己的正文，以及它和最近两层空间上级所配的资料，仍由各自条件和开关决定。', 'diagnostic.preview'),
      step('quick', '描写详略可以从快捷窗切换', '现在打开达摩快捷窗。背景、简写、标准、细写是同一组描写档位：它们改变包在背景文字前后的使用提示，告诉写文 AI 怎样使用资料。', 'host.quickMenu', {}, { surface: 'host' }),
      step('detailed', '这次切到细写', '点细写后立即保存。它会更强调资料的详细使用方式；地点怎么识别、哪些资料符合条件，仍按原来的规则判断。', 'host.quickMode', { mode: 'detailed' }, { surface: 'host' }),
      step('sync', '到读取设置，看到同一个选择', '读取设置里的描写档位也已经是细写。快捷窗和这里控制同一项。简繁输出、回看多少层 AI 回复等长期习惯，也在这一页调整。', 'settings.open', { tab: 'reading' }),
      step('history', '顺便调整回看范围', '这里把回看 AI 回复层数设为2，让扩展在当前输入之外，按既有规则回看最近两层 AI 回复。0表示不回看；这一页填完后，要点保存读取设置。', 'settings.set', { scope: 'reading', key: 'historyDepth', value: 2 }),
      step('save', '保存这一页的读取设置', '现在保存读取设置。地点数量和快捷档位是即时保存，这组填写项则由自己的保存按钮一起提交。以后修改时，留意每组旁边的保存说明即可。', 'settings.save', { scope: 'reading' }),
      step('prompt', '回到全文，查看新档位的提示', '再次试算并打开全文，可以查看细写档位对应的上下提示词和本轮背景资料。档位表达的是使用要求，实际写作效果还要看你使用的 AI 如何回应。', 'diagnostic.preview', { tab: 'prompt' }),
    ],
  },
  {
    id: 'check', label: '资料没出现时，怎样查明原因',
    summary: '从一次没认出地点的聊天开始，补全称呼，再查具体文字和最终全文。',
    steps: [
      step('missing', '这次只写了店名', '示例聊天只写木窗咖啡店，没有给出它所属的示例市，前文也没有可沿用的地区。先去检查页，看扩展实际读到了什么。', 'host.chat', { text: '4月12日，傍晚18:00，小雨。我们走进木窗咖啡店。', clearHistory: true }, { surface: 'host' }),
      step('reason', '先看地点结果，再看原因', '预览会列出这次读到的地点和未选中的原因。同名地点需要所属地区帮助区分；名称、行政归属和前文是否可沿用，要一起看。', 'diagnostic.preview'),
      step('source', '需要时再查看文字从哪里来', '读取通道页能看到本轮输入、前文和读取范围。若怀疑某段文字被标签排除，或回看范围不合适，可以从这里去对应的读取设置。', 'diagnostic.show', { tab: 'channels' }),
      step('settings', '从检查结果直达读取设置', '现在进入对应的读取设置。这里管理回看层数、优先读取和排除标签。这个示例的主要问题是地点称呼缺地区，因此接下来回到聊天补全它。', 'diagnostic.openSettings', { channel: 'IN' }),
      step('correct', '补全行政归属和地点名称', '聊天现在写成示例县示例市木窗咖啡店。地图或地点详情的追加名称可以帮你填写这种完整称呼，减少自己猜名字的麻烦。', 'host.chat', { text: scene }, { surface: 'host' }),
      step('retry', '回到检查页重新预览', '刷新以后，查看地点是否已经选对，再看哪些背景资料实际被采用。预览是当前聊天和设置的一次试算；上一轮实际记录会单独保留。', 'diagnostic.preview'),
      step('text', '从结果打开具体正文', '点结果中的木窗与长桌，可以直达对应正文。若某条结果是空正文或条件不符，就能从这里检查内容和适用情况；修改保存后，再回检查页刷新。', 'diagnostic.openResult', { material: 'wood' }),
      step('whole', '返回检查，读这轮完整输入', '现在回到检查页刷新，并打开提示词全文。这里能确认扩展准备了哪些文字；复制完整诊断时，也会按当前选择的预览或实际记录分别复制。', 'diagnostic.preview', { tab: 'prompt' }),
      step('macro', '让资料进入你实际使用的提示词', '下面是酒馆接入的操作示意。宏是一段固定标记，放进实际使用的提示词或世界书后，会换成本轮背景资料。生成一轮，再到酒馆的完整提示词查看页（Main Prompt）检查内容；最后看 AI 怎样写进故事。', 'illustration', { kind: 'macro', title: '把背景资料交给写文 AI', stages: [ { title: '放入固定标记', text: '在实际使用的提示词或世界书中放入 {{livingjapan}}。' }, { title: '照常生成', text: '用已写明场景的聊天生成一轮。' }, { title: '查看实际输入', text: '在酒馆的完整提示词查看页（Main Prompt）查看展开后的背景资料。' }, { title: '看写作结果', text: '阅读 AI 回复，确认它怎样采用这些背景。' } ] }, { surface: 'illustration' }),
    ],
  },
  {
    id: 'save', label: '备份自己的内容，再更新资料',
    summary: '分清个人备份、程序更新和地区资料包更新，各自走完操作顺序。',
    steps: [
      step('entry', '从设置打开备份与说明', '这里集中放个人备份、程序更新、地区资料包和使用说明。准备备份前，先把正在编辑的地点、正文和设置保存好；备份收录的是已经保存的内容。', 'settings.open', { tab: 'backup' }),
      step('export', '导出后，还要保存得到的文件', '这是导出文件的操作示意。完整个人备份包含自建地点、个人修改、附加资料、收藏和设置。生成以后点保存备份文件，确认浏览器已经把文件保存到你能找到的位置。', 'illustration', { kind: 'export', title: '保存一份个人备份', stages: [ { title: '先保存编辑', text: '地点、正文和读取设置各自完成保存。' }, { title: '生成完整备份', text: '在备份与说明中点导出用户备份。' }, { title: '保存备份文件', text: '下载生成的 JSON 文件，记住保存位置。' } ] }, { surface: 'illustration' }),
      step('import-preview', '恢复时，先选文件并阅读预览', '这是导入的操作示意。选择自己的 JSON 备份后，先查看新增、覆盖和未对应内容。取消就返回，确认后才把备份合并进当前个人资料。', 'illustration', { kind: 'import', title: '先预览，再决定是否导入', stages: [ { title: '选择备份', text: '点导入，选择之前保存的 JSON 文件。' }, { title: '阅读预览', text: '看清会新增什么、覆盖什么，哪些旧稿暂未对应。' }, { title: '取消或确认', text: '取消不写入；确认才合并到当前资料。' } ] }, { surface: 'illustration' }),
      step('import-result', '导入完成后，重新打开看一遍', '相同记录可能被备份内容覆盖，目标端独有内容继续保留。导入后重新打开你关心的地点和正文确认；未对应旧稿仍在备份中保留，可以以后再处理。', 'illustration', { kind: 'import', title: '确认导入后的内容', stages: [ { title: '确认合并', text: '程序按预览范围写入个人资料。' }, { title: '检查内容', text: '重新打开地点、正文与常用设置。' }, { title: '保留文件', text: '把原备份留好，方便以后换设备或恢复。' } ] }, { surface: 'illustration' }),
      step('program', '程序更新走自己的入口', '这是更新程序的操作示意。检查程序更新用于查看有没有新版本，确认更新后再按提示刷新。它更新扩展功能；你的个人修改会继续保留。', 'illustration', { kind: 'updates', title: '更新 Living Japan 程序', stages: [ { title: '检查程序更新', text: '在备份与说明中查看版本结果。' }, { title: '选择更新', text: '确认采用新版本后执行更新。' }, { title: '按提示刷新', text: '重新打开扩展，确认版本与个人内容。' } ] }, { surface: 'illustration' }),
      step('packages', '地区资料要到资料包管理更新', '这是地区资料包的操作示意。程序装好以后，地区资料仍需下载并启用；首都圈是常驻资料，其它地区按需使用。这个下载窗口与编辑词条文字的资料页是两个地方。', 'illustration', { kind: 'packages', title: '准备或更新地区资料', stages: [ { title: '打开地区资料包', text: '从备份与说明进入资料包管理。' }, { title: '下载或更新', text: '查看地区版本和状态，选择需要的资料。' }, { title: '启用后回地图', text: '地区资料就绪后，再搜索其中的地点。' } ] }, { surface: 'illustration' }),
      step('return', '回到这里，随时重看需要的一章', '完整流程按任务带你走一遍；页面讲解保留每个按钮的细节。以后忘记某一步，可以从备份与说明重看对应章节。点结束本章，就回到你原来的页面和草稿。', 'settings.open', { tab: 'backup' }),
    ],
  },
];

export function workflowChapters(scope = 'all') {
  return scope === 'all' ? WORKFLOW_CHAPTERS.slice() : WORKFLOW_CHAPTERS.filter(chapter => chapter.id === scope);
}

export function workflowSteps(scope = 'all') {
  return workflowChapters(scope).flatMap(chapter => chapter.steps.map((entry, index) => ({
    ...entry, id: `${chapter.id}:${entry.id}`, stepId: entry.id,
    chapterId: chapter.id, chapterLabel: chapter.label, chapterSummary: chapter.summary,
    chapterIndex: index, chapterCount: chapter.steps.length,
  })));
}

export function workflowStep(chapterId, index = 0) {
  if (!Number.isInteger(index) || index < 0) return null;
  return workflowSteps(chapterId)[index] || null;
}
