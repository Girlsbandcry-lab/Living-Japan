import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../ui/guide.js').catch(() => ({}));
function fixture() {
  assert.equal(typeof module.createGuideSession, 'function');
  let accepted = true, settingAccepted = true, shown = [], opened = [], writes = 0;
  const data = { extensionUi: { theme: 'night', guide: {} } };
  const ui = { layout: 'desktop', state: { page: 'settings' }, ask: async () => 'later', bridge: { store: { read: () => data, update: async callback => { writes++; callback(data); } } }, showPage: async page => { if (!accepted) return false; ui.state.page = page; return true; } };
  const settings = { requestLeave: async () => settingAccepted, openTab: tab => opened.push(tab) };
  const guide = module.createGuideSession(ui, { settings, onStep: (step, index) => shown.push([step, index]) });
  return { ui, data, guide, shown, opened, writes: () => writes, cancelPage: () => { accepted = false; }, cancelSettings: () => { settingAccepted = false; } };
}
test('guide navigation respects a cancelled reader/page leave and does not advance', async () => {
  const f = fixture(); await f.guide.start('map'); assert.equal(f.shown.length, 1);
  f.ui.state.page='region';f.cancelPage(); assert.equal(await f.guide.next(), false); assert.equal(f.shown.length, 1); assert.equal(f.writes(), 0);
});
test('guide cannot switch a settings group after the user chooses to keep unsaved input', async () => {
  const f = fixture(); f.cancelSettings(); assert.equal(await f.guide.start('save'), false);
  assert.deepEqual(f.opened, []); assert.deepEqual(f.shown, []);
});
test('first offer supports later and persistent opt-out, and manual replay still works', async () => {
  const later = fixture(); await later.guide.offer(); await later.guide.offer(); assert.equal(later.writes(), 0); assert.equal(later.shown.length, 0);
  const never = fixture(); never.ui.ask = async () => 'never'; await never.guide.offer();
  assert.equal(never.data.extensionUi.guide.autoPrompt, false); assert.equal(never.data.extensionUi.theme, 'night');
  await never.guide.start('map'); assert.equal(never.shown.length, 1);
});
test('ending the guide during page loading prevents the next callout reopening', async () => {
  const f = fixture(); await f.guide.start('map');
  let finish; f.ui.showPage = () => new Promise(resolve => { finish = resolve; });
  f.ui.state.page='region';const pending = f.guide.next(); f.guide.close(); finish(true); await pending;
  assert.equal(f.shown.length, 1);
});
test('guide placement keeps a visible input outside the guide card in a short narrow viewport', () => {
  assert.equal(typeof module.placeGuideCard, 'function');
  const target = { left: 20, right: 410, top: 70, bottom: 110 }, box = module.placeGuideCard(target, { width: 330, height: 180 }, { width: 430, height: 483 });
  assert(box.left >= 8 && box.left + 330 <= 422); assert(box.top >= target.bottom + 8); assert(box.top + 180 <= 475);
});
test('all guide chapters are reachable with unique IDs and layout-aware text', () => {
  assert.equal(module.GUIDE_CHAPTERS.length, 7);
  for (const layout of ['desktop', 'portrait', 'mobile']) {
    const ui = { layout, engine: { data: { macroName: 'living_japan' } } };
    const all = module.guideStepsFor(ui);
    assert.equal(new Set(all.map(step => step.id)).size, all.length);
    assert.equal(module.GUIDE_CHAPTERS.flatMap(chapter => module.guideStepsFor(ui, chapter.id)).length, all.length);
    assert(all.every(step => step.target && step.text && step.title && step.chapterLabel));
  }
});
test('advancing within an open editor does not route or close its page', async () => {
  const f = fixture();f.ui.state.page = 'region';f.ui.state.placeEditor = { values: { name: '未保存草稿' } };
  let routes = 0;f.ui.showPage = async page => { routes++;f.ui.state.page = page;return true; };
  assert.equal(await f.guide.start('edit'), true);assert.equal(await f.guide.next(), true);
  assert.equal(routes, 0);assert.equal(f.ui.state.placeEditor.values.name, '未保存草稿');assert.equal(f.writes(), 0);
});
test('a guide never navigates away from unfinished map picking or commits its draft', async () => {
  const f = fixture();f.ui.state.page = 'map';f.ui.state.placeEditor = { picker: { candidate: { longitude: 139, latitude: 35 } } };
  let routes = 0;f.ui.showPage = async () => { routes++;return true; };
  await f.guide.start('packages');await f.guide.next();
  assert.equal(routes,0);assert(f.ui.state.placeEditor.picker);assert.equal(f.writes(),0);
});
test('missing-field guidance uses a visible entry and follows the real field when it appears', () => {
  const step = { target: '[data-real-field]', fallbackTarget: '[data-entry]', missingHint: '先点击编辑地点资料，也可略过。' };
  const entry={name:'编辑入口'},field={name:'实际字段'};let ready=false;
  const find=selector=>selector==='[data-real-field]'?(ready?field:null):entry;
  let state=module.guideStepTarget(step,find);assert.equal(state.target,entry);assert.equal(state.missing,true);assert.equal(state.hint,step.missingHint);
  ready=true;state=module.guideStepTarget(step,find);assert.equal(state.target,field);assert.equal(state.missing,false);assert.equal(state.hint,'');
});
test('reader guidance prioritizes a visible result button over earlier search input and leaves it clickable', () => {
  const step=module.guideStepsFor({layout:'mobile'},'packages').find(item=>item.chapterIndex===5);
  const search={kind:'search'},read={kind:'read'},reader={kind:'reader'};
  let hasResult=true,opened=false;
  const find=selector=>selector==='.lj-reader-overlay'?(opened?reader:null)
    :selector==='[data-material-action="read"]'?(hasResult?read:null)
    :selector==='.lj-material-search input'?search:null;
  let state=module.guideStepTarget(step,find);
  assert.equal(state.target,read,'the actual read action takes precedence even when the search input appears first in the document');
  assert.equal(state.missing,true);
  const target={left:328.14,right:377.28,top:290.91,bottom:330.91};
  const card={width:360,height:303.49};
  const box=module.placeGuideCard(target,card,{width:430,height:844});
  const center={x:(target.left+target.right)/2,y:(target.top+target.bottom)/2};
  assert.ok(!(center.x>=box.left&&center.x<=box.left+card.width&&center.y>=box.top&&center.y<=box.top+card.height),'guide card must not cover the read button center');
  hasResult=false;state=module.guideStepTarget(step,find);assert.equal(state.target,search);
  opened=true;state=module.guideStepTarget(step,find);assert.equal(state.target,reader);assert.equal(state.missing,false);
});
test('only the existing editor layers block a covered target, while their own controls and exposed navigation remain reachable',()=>{
  const area={left:0,right:430,top:48,bottom:700};const inside={getBoundingClientRect:()=>({left:280,right:400,top:500,bottom:540})};
  const editor={contains:node=>node===inside,getBoundingClientRect:()=>area};
  const behind={getBoundingClientRect:()=>({left:20,right:90,top:180,bottom:220})};
  const topNavigation={getBoundingClientRect:()=>({left:20,right:90,top:0,bottom:40})};
  assert.equal(module.guideCoveringEditor(behind,[editor]),editor);
  assert.equal(module.guideCoveringEditor(inside,[editor]),null);
  assert.equal(module.guideCoveringEditor(topNavigation,[editor]),null);
});
