import test from 'node:test';
import assert from 'node:assert/strict';
import { injectionEndpoints, injectionName, qualifiedInjectionName } from '../src/injection-names.js';
import transitMap from '../src/legacy/transit-map.js';

const nodes = [
  { id: 'admin:jp', name: '日本', kind: 'country' },
  { id: 'pref_tokyo', name: '东京都', kind: 'prefecture', parentId: 'admin:jp' },
  { id: 'tokyo_chuo', name: '中央区', kind: 'special_ward', parentId: 'pref_tokyo' },
  { id: 'pref_saitama', name: '埼玉县', kind: 'prefecture', parentId: 'admin:jp' },
  { id: 'saitama_city', name: '埼玉市', kind: 'city', parentId: 'pref_saitama' },
  { id: 'saitama_chuo', name: '中央区', kind: 'ward', parentId: 'saitama_city' },
];
const data = { adminNodes: nodes };
const tokyo = {
  id: 'shop-tokyo', name: '花店', shortName: '花店', originalName: 'はなの店', fullNames: ['柳枝花店'],
  activationName: '柳枝花店', adminNodeId: 'tokyo_chuo', adminPath: ['admin:jp', 'pref_tokyo', 'tokyo_chuo'],
};
const saitama = {
  id: 'shop-saitama', name: '柳枝花店', originalName: 'はなの店', fullNames: ['柳枝花店'],
  adminNodeId: 'saitama_chuo', adminPath: ['admin:jp', 'pref_saitama', 'saitama_city', 'saitama_chuo'],
};

test('qualified append pairs the verified administration with the existing complete activation name', () => {
  assert.equal(injectionName(tokyo, data), '柳枝花店');
  assert.equal(qualifiedInjectionName(tokyo, data), '东京都 中央区 柳枝花店');
  assert.equal(qualifiedInjectionName(saitama, data), '埼玉县 埼玉市 中央区 柳枝花店');
  assert.equal(qualifiedInjectionName({ id: 'personal', name: '新花店', regionCode: '13', adminPath: [] }, data), '新花店');
});

test('traffic pairs both original selected places, preserving the estimate anchors and unqualified fallback', () => {
  const route = {
    origin: { id: 'navigation-anchor', label: '接驳站' },
    destination: { id: 'other-anchor', label: '另一接驳站' },
    mode: 'walking', estimate: { minutes: 8 },
  };
  const selection = { origin: tokyo, destination: saitama };
  const result = injectionEndpoints(route, selection, data);
  assert.equal(result.origin.id, 'navigation-anchor');
  assert.equal(result.destination.id, 'other-anchor');
  assert.equal(route.origin.label, '接驳站');
  assert.equal(route.destination.label, '另一接驳站');
  const comment = transitMap._test.buildTrafficComment(result);
  assert.match(comment, /从 东京都 中央区 柳枝花店处出发.*至 埼玉县 埼玉市 中央区 柳枝花店（目的地）/);
  assert.doesNotMatch(comment, /接驳站|はなの店/);
  const unqualified = injectionEndpoints(route, { ...selection, origin: { id: 'personal', name: '新花店' } }, data);
  assert.match(transitMap._test.buildTrafficComment(unqualified), /从 新花店处出发/);
});

test('the traffic prefix skips living areas while preserving both selected place names', () => {
  const mixed = { adminNodes: [...nodes, { id: 'life-area', name: '旧街生活带', kind: 'life_area', parentId: 'pref_tokyo' }] };
  const areaWard = { ...nodes[2], parentId: 'life-area' };
  mixed.adminNodes[2] = areaWard;
  const origin = { ...tokyo, name: '柳枝花店', adminPath: ['admin:jp', 'pref_tokyo', 'life-area', 'tokyo_chuo'] };
  const destination = { ...saitama, id: 'scene-area', name: '河畔生活带', fullNames: ['河畔生活带'] };
  const result = injectionEndpoints({ origin: { label: '起点锚' }, destination: { label: '终点锚' } }, { origin, destination }, mixed);
  assert.equal(result.origin.label, '东京都 中央区 柳枝花店');
  assert.equal(result.destination.label, '埼玉县 埼玉市 中央区 河畔生活带');
});
