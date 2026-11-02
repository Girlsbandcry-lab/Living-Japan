import { createUserStore, createSillyTavernTransport } from './storage.js';
import { createFloatingEntry } from './floating-entry.js';
import { registerHostEntries } from './host-entries.js';
import { createRegionPackManager, createPackResourceFetcher } from './region-pack-manager.js';
import { composeRegionIndex, createRuntimeFetcher } from './region-pack-runtime.js';
import { createRegionPackPanel } from './region-pack-panel.js';
import { createUpdateManager } from './updates.js';

// LJ-FRAMEWORK-BOOT-20261031: launcher and setup are independent of downloaded regional data.
export async function startLivingJapan({baseUrl,context:givenContext,sourceUrl}={}) {
  const context=givenContext || globalThis.SillyTavern?.getContext?.();
  if(!context) throw new Error('请在 SillyTavern 中启用扩展，或打开独立预览入口');
  const root=new URL('./',baseUrl), store=createUserStore({transport:createSillyTavernTransport({context,fetcher:fetch})});
  await store.load();
  let workspace, ready, manager, panel, core, emptyRuntime, updates, rebuilding=false;
  const open=async()=>{await ready; return packages.required ? openPackages({focusId:'metro',required:true}) : workspace?.open();};
  const entry=createFloatingEntry({store,open});
  const openPackages=async(options={})=>{await ready; if(panel) return panel.open(options); throw new Error('当前为完整资料开发目录，请使用轻框架分包候选预览');};
  const unregister=registerHostEntries({context,open,openPackages});
  const packages={get manager(){return manager;},open:openPackages,get required(){return Boolean(manager&&!manager.getState().ready);}};
  async function buildWorkspace() {
    const {startLivingJapan:mount}=await import('./app.js');
    let fetcher=fetch,snapshot,names;
    if(manager) {
      snapshot=manager.getActiveSnapshot();
      const resourceFetcher=createPackResourceFetcher({snapshot,baseUrl:root});
      const index=composeRegionIndex(core,snapshot);
      fetcher=createRuntimeFetcher({baseUrl:root,index,emptyRuntime,resourceFetcher,hasRuntime:Boolean(snapshot.files['data/runtime/runtime.json'])});
      names=snapshot.files['data/metro-names.json']?await (await fetcher(new URL('data/metro-names.json',root))).json():{};
    }
    workspace=await mount({baseUrl:root,context,store,entry,fetcher,packSnapshot:snapshot,packages:manager?packages:undefined,metroNames:names,updates});
    entry.setError?.(null); return workspace;
  }
  async function changePackages(action) {
    if(rebuilding) throw new Error('正在载入地区资料，请稍候');
    if(workspace && !(await workspace.canLeave())) return false;
    rebuilding=true;
    try {
      await action();
      const wasOpen=workspace?.isOpen();
      workspace?.destroy(); workspace=null;
      await buildWorkspace();
      if(wasOpen) await workspace.open();
      return true;
    } catch(error) {entry.setError?.(error);throw error;}
    finally {rebuilding=false;}
  }
  ready=(async()=>{
    const response=await fetch(new URL('data/region-pack-source.json',root),{cache:'no-store'});
    if(response.ok) {
      const config=await response.json();
      const [framework,runtime]=await Promise.all([fetch(new URL('data/region-framework.json',root)),fetch(new URL('data/empty-runtime.json',root))]);
      if(!framework.ok||!runtime.ok) throw new Error('程序框架资料不完整，请重新安装程序');
      core=await framework.json();emptyRuntime=await runtime.json();
      const configured=sourceUrl ?? config.catalogUrl;
      manager=createRegionPackManager({sourceUrl:configured?new URL(configured,root).href:null,requestHeaders:()=>context.getRequestHeaders?.()||{}});
      await manager.load();
      panel=createRegionPackPanel({manager,store,onChangePackages:changePackages,onContinue:()=>workspace?.open()});
    } else if(response.status!==404) throw new Error('程序框架配置读取失败：'+response.status);
    updates=createUpdateManager({context,extensionName:root.pathname.split('/').filter(Boolean).at(-1)||'Living-Japan',version:core?.version});
    return buildWorkspace();
  })();
  try {await ready;} catch(error) {entry.setError?.(error);throw error;}
  void updates.check().catch(()=>{});
  if(manager) void manager.refreshCatalog().catch(()=>{});
  return new Proxy({}, {get(_target,key){
    if(key==='open')return open;if(key==='openPackages')return openPackages;
    if(key==='packManager')return manager;
    if(key==='destroy')return ()=>{panel?.destroy();unregister();workspace?.destroy();entry.destroy();};
    return workspace?.[key];
  }});
}
