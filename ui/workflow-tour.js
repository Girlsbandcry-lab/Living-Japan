import { startLivingJapan } from '../src/app.js';
import { createWorkflowData, createWorkflowStore, DEMO_CHAT } from '../src/workflow-demo-data.js';
import { createWorkflowDriver, waitForWorkflow } from './workflow-actions.js';
import { WORKFLOW_CHAPTERS } from './workflow-chapters.js';
import { guideRectInDocument } from './guide.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const scope=params.get('scope')||'all',layout=['desktop','portrait','mobile'].includes(params.get('layout'))?params.get('layout'):'desktop';
const chapters=scope==='all'?WORKFLOW_CHAPTERS:WORKFLOW_CHAPTERS.filter(row=>row.id===scope);
let chapterIndex=0,stepIndex=-1,pendingStep=0,bridge,driver,context,busy=false,exited=false,currentTarget=null,ready=false,runNumber=0;
const outer=window.frameElement,source=outer?.workflowConfig||parent.LivingJapanBridge?.engine?.data;
const signal=(name,detail)=>outer?.dispatchEvent(new CustomEvent(name,{detail}));
const renderSize=()=>document.documentElement.style.setProperty('--workflow-top',$('workflowChrome').getBoundingClientRect().height+'px');
new ResizeObserver(renderSize).observe($('workflowChrome'));
function blocker(event){
  if(!event.isTrusted)return;
  if(event.type==='keydown'&&event.key==='Tab'){
    const buttons=[...$('workflowChrome').querySelectorAll('button')].filter(node=>!node.disabled&&!node.hidden),index=buttons.indexOf(event.target);
    const next=index<0?(event.shiftKey?buttons.length-1:0):(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length;
    event.preventDefault();event.stopImmediatePropagation();buttons[next]?.focus();return;
  }
  const allowed=event.target.closest?.('#workflowChrome,#workflowIllustration');if(allowed)return;
  const interactive=event.target.closest?.('input,select,textarea,button,[contenteditable]');
  if(event.type==='keydown'&&!interactive&&['PageUp','PageDown','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();event.stopImmediatePropagation();
}
function protect(owner){for(const type of ['click','pointerdown','keydown','cancel'])owner.addEventListener(type,blocker,true);}
protect(document);
function showIllustration(value){const host=$('workflowIllustration');host.hidden=!value;if(!value){host.replaceChildren();return;}const panel=document.createElement('article');panel.className='workflow-illustration';const label=document.createElement('small');label.textContent='操作示意 · 浏览器或宿主中的后续步骤';const title=document.createElement('h2');title.textContent=value.title||'操作流程';const stages=document.createElement('div');stages.className='workflow-stages';for(const [index,item] of (value.stages||[]).entries()){const stage=document.createElement('section');stage.className='workflow-stage'+(index===(value.active||0)?' active':'');const count=document.createElement('span');count.textContent=index+1;const heading=document.createElement('b');heading.textContent=item.title;const text=document.createElement('p');text.textContent=item.text;stage.append(count,heading,text);stages.append(stage);}panel.append(label,title,stages);host.replaceChildren(panel);}
const updates={getState:()=>({supported:false,version:'演示',available:false}),subscribe:()=>()=>{},check:async()=>({supported:false,available:false})};
async function reset(){
  currentTarget=null;$('workflowRing').hidden=true;showIllustration(null);bridge?.destroy();bridge=null;
  const fixture=createWorkflowData({wrappers:source?.wrappers,defaultSettings:source?.defaultSettings,layout});
  const store=await createWorkflowStore(fixture.user);context={chat:[{is_user:true,mes:DEMO_CHAT}]};$('send_textarea').value=DEMO_CHAT;
  bridge=await startLivingJapan({baseUrl:new URL('../',import.meta.url),store,context,fetcher:fixture.fetcher,metroNames:{},updates,workflowDemo:true});
  await bridge.open();
  const frame=await waitForWorkflow(()=>document.querySelector('#living-japan-shell iframe'),'打开演示页面');
  const view=await waitForWorkflow(()=>frame.contentWindow?.LivingJapanView,'准备真实页面');
  await waitForWorkflow(()=>!frame.contentDocument.getElementById('ljLoading'),'载入演示界面');
  protect(frame.contentDocument);
  driver=createWorkflowDriver({bridge,getView:()=>({...frame.contentWindow.LivingJapanView,uiDocument:frame.contentDocument}),hostDocument:document,context,showIllustration});
  window.workflowDemo={bridge,fixture,get driver(){return driver;},get progress(){return {chapterIndex,stepIndex,busy};},go};
  renderSize();return view;
}
function positionRing(){
  const ring=$('workflowRing');if(!currentTarget?.isConnected||busy||!$('workflowIllustration').hidden){ring.hidden=true;return;}
  const rect=guideRectInDocument(currentTarget,document),chromeBottom=$('workflowChrome').getBoundingClientRect().bottom;
  const left=Math.max(2,Math.min(innerWidth-2,rect.left-3)),top=Math.max(chromeBottom,rect.top-3),right=Math.min(innerWidth-2,rect.right+3),bottom=Math.min(innerHeight-2,rect.bottom+3);
  ring.hidden=right<=left||bottom<=top;if(ring.hidden)return;
  Object.assign(ring.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});
}
function controls(){const chapter=chapters[chapterIndex],last=stepIndex===chapter.steps.length-1;$('workflowPrevious').disabled=busy||stepIndex<=0;$('workflowNext').disabled=busy||last;$('workflowNext').hidden=last;$('workflowNextChapter').hidden=!last||chapterIndex===chapters.length-1;$('workflowNextChapter').disabled=busy;$('workflowExit').disabled=false;$('workflowPosition').textContent=`第 ${chapterIndex+1} / ${chapters.length} 章 · ${Math.max(1,stepIndex+1)} / ${chapter.steps.length}`;}
async function go(next,{restart=false}={}){
  if(busy||exited)return false;const chapter=chapters[chapterIndex];if(next<0||next>=chapter.steps.length)return false;
  busy=true;pendingStep=next;const ticket=++runNumber;$('workflowRetry').hidden=true;$('workflowStatus').className='';$('workflowStatus').textContent='正在演示操作…';currentTarget=null;controls();positionRing();
  try{
    const rebuild=restart||!driver||next!==stepIndex+1;
    if(rebuild){await reset();for(let index=0;index<next;index++){if(exited||ticket!==runNumber)return false;await driver.perform(chapter.steps[index]);}}
    if(exited||ticket!==runNumber)return false;
    const step=chapter.steps[next];$('workflowChapter').textContent=chapter.label||chapter.title;$('workflowTitle').textContent=step.title;$('workflowText').textContent=step.text;renderSize();
    const result=await driver.perform(step);if(exited||ticket!==runNumber)return false;
    stepIndex=next;currentTarget=result.target;$('workflowStatus').textContent=next===chapter.steps.length-1?'本章已完成，可回看或结束':'请看已打开的界面，再继续下一步';
    if(!ready){ready=true;signal('lj-workflow-ready');}
    if(scope==='all'&&chapterIndex===chapters.length-1&&next===chapter.steps.length-1)signal('lj-workflow-complete');
    return true;
  }catch(error){$('workflowStatus').className='workflow-error';$('workflowStatus').textContent=error.message||String(error);$('workflowRetry').hidden=false;signal('lj-workflow-error',{message:error.message||String(error),chapter:chapter.id,step:next});return false;}
  finally{busy=false;controls();positionRing();}
}
$('workflowPrevious').addEventListener('click',()=>void go(stepIndex-1));$('workflowNext').addEventListener('click',()=>void go(stepIndex+1));$('workflowRetry').addEventListener('click',()=>void go(pendingStep,{restart:true}));
$('workflowNextChapter').addEventListener('click',()=>{if(busy)return;chapterIndex++;stepIndex=-1;void go(0,{restart:true});});
$('workflowExit').addEventListener('click',()=>{exited=true;runNumber++;bridge?.destroy();signal('lj-workflow-exit');});
window.addEventListener('resize',()=>{renderSize();positionRing();});document.addEventListener('scroll',positionRing,true);
setInterval(positionRing,300);
if(!chapters.length){$('workflowStatus').textContent='没有找到这篇导览';signal('lj-workflow-error',{message:'没有找到这篇导览'});}else void go(0,{restart:true});
