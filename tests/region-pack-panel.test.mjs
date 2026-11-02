import test from 'node:test';
import assert from 'node:assert/strict';
import { entryDOM, entryStore } from './helpers/entry-dom.mjs';

import { createRegionPackPanel as create } from '../src/region-pack-panel.js';
const settle = () => new Promise(resolve => setImmediate(resolve));
function managerFixture() {
  let state = { loaded: true, sourceUrl: 'https://packs.test/catalog.json', catalog: { packages: [{ id: 'common', name: '基础资料', version: '1', manifestUrl: 'common/manifest.json', dependencies: [], downloadBytes: 500 }, { id: 'metro', name: '首都圈', version: '1', manifestUrl: 'metro/manifest.json', dependencies: ['common'], downloadBytes: 1000 }] }, packages: {}, operation: null };
  const subscribers = new Set(), calls = []; let resolveInstall, rejectInstall;
  const manager = {
    getState: () => structuredClone(state), subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    async refreshCatalog() { return state.catalog; },
    install(id) { calls.push(['install', id]); manager.emit({ operation: { packId: id, phase: 'downloading', downloadedBytes: 10, downloadTotalBytes: 1000 } }); return new Promise((resolve, reject) => { resolveInstall = resolve; rejectInstall = reject; }); },
    cancel(id) { calls.push(['cancel', id]); manager.emit({ operation: { ...state.operation, phase: 'paused' } }); resolveInstall?.(); },
    async setEnabled(id, enabled) { calls.push(['enabled', id, enabled]); state.packages[id].enabled = enabled; manager.emit({}); },
    async remove(id) { calls.push(['remove', id]); delete state.packages[id]; manager.emit({}); },
    emit(patch) { state = { ...state, ...patch }; for (const fn of subscribers) fn(structuredClone(state)); },
    complete() { manager.emit({ packages: { metro: { enabled: true, installed: { version: '1', bytes: 1000 } } }, operation: { ...state.operation, phase: 'ready', receivedBytes: 1000 } }); resolveInstall?.(); },
    fail() { manager.emit({ operation: { ...state.operation, phase: 'error', error: '连接中断' } }); rejectInstall?.(new Error('连接中断')); },
  };
  return { manager, calls, subscribers };
}

test('download waits for the workspace guard and displays manager byte progress without closing the panel', async () => {
  const env = entryDOM(), f = managerFixture(); let allow;
  const panel = create({ ...env, manager: f.manager, store: entryStore(), onChangePackages: async operation => { if (await new Promise(resolve => { allow = resolve; })) await operation(); } });
  await panel.open({ required: true });
  const dialog = env.document.getElementById('living-japan-region-pack-panel');
  assert.equal(dialog.querySelector('[data-pack-id="common"]'), null);
  assert.equal(dialog.querySelector('[data-pack-action="install:metro"]').disabled, false);
  dialog.querySelector('[data-pack-action="install:metro"]').fire('click'); assert.deepEqual(f.calls, []);
  allow(true); await settle(); assert.deepEqual(f.calls, [['install', 'metro']]); assert.equal(dialog.hidden, false);
  const progress = dialog.querySelector('[data-pack-progress="metro"]'); assert.equal(progress.value, 10); assert.equal(progress.max, 1000);
  f.manager.emit({ operation: { packId: 'metro', phase: 'saving', downloadedBytes: 250, downloadTotalBytes: 1000 } });
  assert.equal(progress.value, 250); assert.match(dialog.querySelector('[data-pack-phase="metro"]').textContent, /保存/);
  const count = [...progress.parentNode.children].find(node => node.className === 'lj-pack-count');
  assert.equal(count.textContent, '25% · 已下载 250 B / 1.0 kB');
  f.manager.emit({ operation: { packId: 'metro', phase: 'verifying', downloadedBytes: 1_000_000, downloadTotalBytes: 95_781_149, reusedBytes: 40_000_000 } });
  assert.equal(count.textContent, '1% · 已下载 1.0 MB / 95.8 MB');
  f.manager.complete(); await settle(); panel.destroy(); assert.equal(f.subscribers.size, 0);
});

test('required download offers continue only after installed enabled data and callback completion', async () => {
  const env = entryDOM(), f = managerFixture(); let continued = 0, finishRuntime;
  const panel = create({ ...env, manager: f.manager, store: entryStore(), onContinue: () => continued++, onChangePackages: async operation => { await operation(); await new Promise(resolve => { finishRuntime = resolve; }); } });
  await panel.open({ required: true });
  const dialog = env.document.getElementById('living-japan-region-pack-panel'), go = dialog.querySelector('[data-pack-action="continue"]');
  assert.equal(go.disabled, true); dialog.querySelector('[data-pack-action="install:metro"]').fire('click');
  f.manager.complete(); await settle(); assert.equal(go.disabled, true);
  finishRuntime(); await settle(); assert.equal(go.disabled, false);
  go.fire('click'); await settle(); assert.equal(continued, 1); assert.equal(dialog.hidden, true); panel.destroy();
});

test('unconfigured download source is explicit and unavailable rather than a simulated success', async () => {
  const env = entryDOM(), f = managerFixture(); f.manager.emit({ sourceUrl: null, catalog: null });
  const panel = create({ ...env, manager: f.manager, store: entryStore() }); await panel.open({ required: true });
  const dialog = env.document.getElementById('living-japan-region-pack-panel');
  assert.match(dialog.querySelector('[data-pack-notice]').textContent, /尚未配置/);
  assert.equal(dialog.querySelector('[data-pack-action="install:metro"]').disabled, true);
  assert.equal(dialog.querySelector('[data-pack-action="continue"]').disabled, true); assert.deepEqual(f.calls, []); panel.destroy();
});

test('remove requires its own second confirmation and never writes personal settings or prose', async () => {
  const env = entryDOM(), f = managerFixture(), store = entryStore({ livingJapanSettings: { masterEnabled: false }, livingJapanTextOverrides: { records: { own: 'personal' } } });
  f.manager.emit({packages:{other:{enabled:false,usable:true,installed:{version:'1',bytes:1000}}}}); const before = store.read();
  const panel = create({ ...env, manager: f.manager, store, onChangePackages: operation => operation() }); await panel.open();
  const dialog = env.document.getElementById('living-japan-region-pack-panel');
  dialog.querySelector('[data-pack-action="remove:other"]').fire('click'); assert.deepEqual(f.calls, []);
  const confirm = dialog.querySelector('[data-pack-action="confirm-remove:other"]'); assert.equal(confirm.parentNode.hidden, false);
  confirm.fire('click'); await settle(); assert.deepEqual(f.calls, [['remove', 'other']]); assert.deepEqual(store.read(), before); panel.destroy();
});

test('cancel interrupts the running download without waiting behind the workspace operation', async () => {
  const env = entryDOM(), f = managerFixture();
  const panel = create({ ...env, manager: f.manager, store: entryStore(), onChangePackages: operation => operation() }); await panel.open();
  const dialog = env.document.getElementById('living-japan-region-pack-panel');
  dialog.querySelector('[data-pack-action="install:metro"]').fire('click'); await settle();
  assert.equal(dialog.querySelector('[data-pack-action="close"]').disabled,true);
  dialog.fire('cancel',{preventDefault(){}});assert.equal(dialog.hidden,false);
  dialog.querySelector('[data-pack-action="cancel:metro"]').fire('click'); await settle();
  assert.equal(dialog.querySelector('[data-pack-action="close"]').disabled,false);
  assert.deepEqual(f.calls, [['install', 'metro'], ['cancel', 'metro']]);
  assert.match(dialog.querySelector('[data-pack-action="install:metro"]').textContent, /继续|重试/); panel.destroy();
});

test('a failed download shows its error and can retry without marking data as installed', async () => {
  const env = entryDOM(), f = managerFixture();
  const panel = create({ ...env, manager: f.manager, store: entryStore(), onChangePackages: operation => operation() }); await panel.open({ required: true });
  const dialog = env.document.getElementById('living-japan-region-pack-panel'), install = dialog.querySelector('[data-pack-action="install:metro"]');
  install.fire('click'); await settle(); f.manager.fail(); await settle();
  assert.match(dialog.querySelector('[data-pack-phase="metro"]').textContent, /连接中断/);
  assert.equal(install.disabled, false); assert.match(install.textContent, /重试/);
  assert.equal(dialog.querySelector('[data-pack-action="continue"]').disabled, true);
  install.fire('click'); await settle(); assert.equal(f.calls.filter(([action]) => action === 'install').length, 2);
  f.manager.complete(); await settle(); panel.destroy();
});

test('panel uses content update summary, hides internal packs, and shows actual accepted coverage without hashes', async () => {
  const env = entryDOM(), f = managerFixture(), digest = 'a'.repeat(64);
  f.manager.emit({ catalog: { packages: [
    { id: 'metro', name: '首都圈', version: '2', manifestUrl: 'metro.json', downloadBytes: 1000, contentSha256: digest, coverage: { description: '已审收22个行政区点位' } },
    { id: 'index', name: '内部检索', version: '2', manifestUrl: 'index.json', hidden: true },
  ] }, packages: { metro: { enabled: true, installed: { version: '1', bytes: 1000 } } }, updates: { available: false, items: [] } });
  const panel = create({ ...env, manager: f.manager, store: entryStore() }); await panel.open({ required: true });
  const dialog = env.document.getElementById('living-japan-region-pack-panel'), card = dialog.querySelector('[data-pack-id="metro"]');
  assert.equal(Boolean(dialog.querySelector('[data-pack-id="index"]')), false);
  assert.equal(dialog.querySelector('[data-pack-action="install:metro"]').hidden, true);
  assert.match(card.querySelectorAll('p').find(node => node.className === 'lj-pack-description').textContent, /22/);
  f.manager.emit({ updates: { available: true, items: [{ id: 'metro', changes: ['indexes'] }], downloads: {metro: 250} } });
  assert.equal(dialog.querySelector('[data-pack-action="install:metro"]').hidden, false);
  const details = card.querySelectorAll('p').find(node => node.className === 'lj-pack-details');
  assert.equal(details.textContent, '版本 2 · 本次下载 250 B');
  assert.doesNotMatch(details.textContent, /检索目录|保留文件|下载包/);
  f.manager.emit({ operation: { packId: 'metro', phase: 'error', error: '校验失败 ' + digest } });
  assert.doesNotMatch(dialog.querySelector('[data-pack-phase="metro"]').textContent, /[a-f0-9]{64}/);
  panel.destroy();
});

test('opening packages never rechecks a completed or failed startup check; the manual button still checks', async () => {
  const env = entryDOM(), f = managerFixture(); let checks = 0;
  f.manager.refreshCatalog = async () => { checks++; return f.manager.getState().catalog; };
  const panel = create({ ...env, manager: f.manager, store: entryStore() });
  await panel.open(); await panel.open(); assert.equal(checks, 0);
  f.manager.emit({catalog:null,updates:{checking:false,checkedAt:null,error:'启动检查失败',items:[]}});
  await panel.open(); assert.equal(checks, 0);
  env.document.getElementById('living-japan-region-pack-panel').querySelector('[data-pack-action="refresh"]').fire('click');
  await settle(); assert.equal(checks, 1); panel.destroy();
});

test('metro cannot be stopped or removed and an old disabled download has one recovery action', async () => {
  const env=entryDOM(),f=managerFixture();f.manager.complete();
  const panel=create({...env,manager:f.manager,store:entryStore()});await panel.open({required:true});
  const dialog=env.document.getElementById('living-japan-region-pack-panel');
  assert.equal(dialog.querySelector('[data-pack-action="enable:metro"]').hidden,true);
  assert.equal(dialog.querySelector('[data-pack-action="remove:metro"]').hidden,true);
  f.manager.emit({ready:false,packages:{metro:{enabled:false,usable:true,installed:{version:'1',bytes:1000}}}});
  const recover=dialog.querySelector('[data-pack-action="enable:metro"]');
  assert.equal(recover.hidden,false);assert.equal(recover.textContent,'启用首都圈');assert.equal(dialog.querySelector('[data-pack-action="install:metro"]').hidden,true);
  assert.equal(dialog.querySelector('[data-pack-action="continue"]').disabled,true);recover.fire('click');await settle();
  assert.deepEqual(f.calls,[['enabled','metro',true]]);panel.destroy();
});

test('inactive download bypasses workspace leave and rebuild while activation uses the existing gate', async () => {
  const env=entryDOM(),f=managerFixture(),store=entryStore({draft:'未保存草稿'});let gates=0;
  f.manager.emit({catalog:{packages:[{id:'other',name:'其他大区',version:'1',manifestUrl:'other.json'}]}});
  f.manager.installChangesActive=()=>false;
  const panel=create({...env,manager:f.manager,store,onChangePackages:async operation=>{gates++;await operation();}});await panel.open();
  const dialog=env.document.getElementById('living-japan-region-pack-panel');dialog.querySelector('[data-pack-action="install:other"]').fire('click');await settle();
  assert.equal(gates,0);assert.deepEqual(f.calls,[['install','other']]);
  assert.equal(dialog.hidden,false);assert.notEqual(dialog.getAttribute('open'),null);
  f.manager.complete();f.manager.emit({packages:{other:{enabled:false,usable:true,installed:{version:'1',bytes:1000}}},operation:{packId:'other',phase:'ready',downloadedBytes:1000,downloadTotalBytes:1000}});await settle();
  assert.deepEqual(store.read(),{draft:'未保存草稿'});assert.equal(dialog.querySelector('[data-pack-phase="other"]').textContent,'下载与校验完成');
  dialog.querySelector('[data-pack-action="enable:other"]').fire('click');await settle();assert.equal(gates,1);assert.deepEqual(f.calls.at(-1),['enabled','other',true]);panel.destroy();
});

test('active change releases the parent modal for draft confirmation and restores it on cancel, acceptance and failure', async () => {
  const env=entryDOM(),f=managerFixture(),createElement=env.document.createElement;
  env.document.createElement=tag=>{const node=createElement(tag);if(tag==='dialog'){node.open=false;node.showModal=function(){this.open=true;this.setAttribute('open','');};node.close=function(){this.open=false;this.removeAttribute('open');};}return node;};
  f.manager.emit({packages:{other:{enabled:false,usable:true,installed:{version:'1',bytes:1000}}}});
  let choose,dialog;
  const originalEnable=f.manager.setEnabled;
  f.manager.setEnabled=async(...args)=>{assert.equal(dialog.open,true,'progress modal returns before changing data');assert.equal(dialog.hidden,false);await originalEnable(...args);};
  const panel=create({...env,manager:f.manager,store:entryStore(),onChangePackages:async operation=>{
    assert.equal(dialog.open,false,'parent modal must let the iframe confirmation become interactive');assert.equal(dialog.hidden,true);
    const decision=await new Promise(resolve=>{choose=resolve;});if(decision==='cancel')return false;if(decision==='error')throw new Error('确认未完成');await operation();
  }});
  await panel.open();dialog=env.document.getElementById('living-japan-region-pack-panel');
  const enable=dialog.querySelector('[data-pack-action="enable:other"]');
  for(const decision of ['cancel','accept','error']){
    enable.focus();enable.fire('click');await settle();assert.equal(dialog.open,false);assert.equal(dialog.hidden,true);
    choose(decision);await settle();assert.equal(dialog.open,true);assert.equal(dialog.hidden,false);
    assert.equal(dialog.querySelector('[data-pack-action="close"]').disabled,false);
    assert.equal(env.document.activeElement,enable);
  }
  assert.deepEqual(f.calls,[['enabled','other',true]]);
  enable.fire('click');await settle();panel.destroy();choose('cancel');await settle();
  assert.equal(dialog.open,false);assert.equal(dialog.hidden,true);assert.equal(Boolean(dialog.parentNode),false,'a destroyed panel must not reopen');
});
