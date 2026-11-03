import test from 'node:test';
import assert from 'node:assert/strict';
import {mountGuide} from '../ui/guide.js';
import {ask} from '../ui/dom.js';

// Small DOM fixture: exercise the production guide mount and ask form together.
function dom(){
  const observers=[],frames=[];let doc;
  const events=node=>Object.assign(node,{handlers:{},addEventListener(type,fn){(this.handlers[type]||=[]).push(fn);},removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(row=>row!==fn);}});
  function element(tag,attrs={}){
    const node=events({tagName:tag.toUpperCase(),attributes:{...attrs},ownerDocument:doc,parentElement:null,children:[],hidden:'hidden'in attrs,open:'open'in attrs,name:attrs.name||'',value:attrs.value||'',dataset:{},style:{setProperty(key,value){this[key]=value;}},textContent:'',disabled:false});
    for(const [name,value]of Object.entries(attrs))if(name.startsWith('data-'))node.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
    node.setAttribute=(name,value)=>{node.attributes[name]=String(value);};node.getAttribute=name=>node.attributes[name]??null;
    node.classList={contains:name=>(node.className||node.attributes.class||'').split(' ').includes(name)};
    node.matches=selector=>selector.split(',').some(part=>{
      if(part.includes(' ')){const pieces=part.trim().split(/\s+/),last=pieces.pop();return node.matches(last)&&Boolean(node.parentElement?.closest(pieces.join(' ')));}
      const s=part.trim();if(s.includes(':not([open])')&&node.open)return false;
      const clean=s.replace(':not([open])','');const name=/^[a-z]+/i.exec(clean)?.[0];if(name&&node.tagName!==name.toUpperCase())return false;
      if([...clean.matchAll(/\.([\w-]+)/g)].some(([,name])=>!node.classList.contains(name)))return false;
      const id=/#([\w-]+)/.exec(clean)?.[1];if(id&&(node.id||attrs.id)!==id)return false;
      return [...clean.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)].every(([,key,value])=>key==='open'?node.open:key==='hidden'?node.hidden:key.startsWith('data-')?((value===undefined)?node.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]!==undefined:node.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]===value):key in node.attributes&&(value===undefined||node.attributes[key]===value));
    });
    node.closest=selector=>node.matches(selector)?node:node.parentElement?.closest(selector)||null;
    node.querySelectorAll=selector=>node.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);
    node.querySelector=selector=>node.querySelectorAll(selector)[0]||null;
    node.contains=other=>node===other||node.children.some(child=>child.contains(other));
    node.append=(...children)=>{for(const child of children){child.remove();child.parentElement=node;node.children.push(child);}};
    node.remove=()=>{if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(child=>child!==node);node.parentElement=null;};
    node.getBoundingClientRect=()=>({left:20,top:60,right:320,bottom:100,width:300,height:40});node.getClientRects=()=>node.hidden?[]:[node.getBoundingClientRect()];
    node.scrollIntoView=()=>{};node.focus=()=>{doc.activeElement=node;};node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;};
    node.click=()=>{const event={target:node,stopPropagation(){},preventDefault(){}};for(let parent=node;parent;parent=parent.parentElement)for(const fn of parent.handlers.click||[])fn(event);};
    Object.defineProperties(node,{parentNode:{get:()=>node.parentElement},isConnected:{get:()=>doc.body.contains(node)||doc.head.contains(node)},innerHTML:{set(html){
      node.children=[];const stack=[node];
      for(const match of html.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)){
        const name=match[1].toLowerCase();if(match[0].startsWith('</')){if(stack.at(-1).tagName===name.toUpperCase())stack.pop();continue;}
        const values=Object.fromEntries([...match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([,key,value])=>[key,value||'']));
        const child=element(name,values);stack.at(-1).append(child);if(!['input','br','hr','img','link'].includes(name))stack.push(child);
      }
    }}});
    return node;
  }
  const view=events({innerWidth:1000,innerHeight:800,frameElement:null,getComputedStyle:()=>({getPropertyValue:()=>''}),requestAnimationFrame(fn){frames.push(fn);return frames.length;},cancelAnimationFrame(){},MutationObserver:class{constructor(fn){this.fn=fn;}observe(){observers.push(this);}disconnect(){}}});
  doc=events({defaultView:view,createElement:element,activeElement:null});doc.body=element('body');doc.head=element('head');
  doc.querySelectorAll=selector=>[...doc.body.querySelectorAll(selector),...doc.head.querySelectorAll(selector)];doc.querySelector=selector=>doc.querySelectorAll(selector)[0]||null;doc.getElementById=id=>doc.querySelector('#'+id);
  return {doc,element,flush(){for(const observer of observers)observer.fn([{target:doc.body}]);while(frames.length)frames.shift()();}};
}

test('mounted guide stays above a real ask modal, preserves its draft and follows host modal lifetime',async()=>{
  const previous=globalThis.document,inside=dom(),outside=dom();globalThis.document=inside.doc;
  const frame=outside.element('iframe');frame.clientWidth=430;frame.clientHeight=860;frame.getBoundingClientRect=()=>({left:100,top:50,width:430,height:860});outside.doc.body.append(frame);inside.doc.defaultView.frameElement=frame;
  const draft={id:'draft',values:{name:'地点草稿'}};let writes=0;
  const ui={layout:'portrait',esc:value=>String(value??''),state:{page:'package',placeEditor:draft},bridge:{guideHost:{document:outside.doc},store:{read:()=>({}),update(){writes++;}}},notify(){},showPage:async page=>{ui.state.page=page;return true;}};
  const session=mountGuide(ui);
  try{
    const promise=ask({title:'正文适用情况',layout:'conditions',confirmDiscard:true,fields:[{id:'startTime',label:'起始',value:'22:00'},{id:'endTime',label:'结束',value:'02:00'}],choices:[{id:'cancel',label:'取消'},{id:'save',label:'保存'}]});
    const form=inside.doc.querySelector('dialog[open]');form.querySelector('[name="startTime"]').value='23:15';
    await session.start('conditions');await session.next();await session.next();
    const layer=outside.doc.querySelector('[data-lj-guide]');assert.ok(layer);assert.equal(inside.doc.querySelector('[data-lj-guide]'),null);
    assert.equal(form.open,true);assert.equal(form.querySelector('[name="startTime"]').value,'23:15');assert.equal(writes,0);assert.equal(ui.state.placeEditor,draft);
    assert.equal(await session.start('save'),false,'cross-page guide navigation must not close the unfinished modal');
    const hostModal=outside.element('dialog');outside.doc.body.append(hostModal);hostModal.showModal();outside.flush();assert.equal(layer.parentNode,hostModal);
    hostModal.close();outside.flush();assert.equal(layer.parentNode,outside.doc.body);
    session.close();assert.equal(form.open,true);assert.equal(form.querySelector('[name="startTime"]').value,'23:15');assert.equal(writes,0);
    form.querySelector('[data-choice="cancel"]').click();const confirmation=inside.doc.querySelectorAll('dialog[open]').at(-1);assert.notEqual(confirmation,form);
    confirmation.querySelector('[data-choice="discard"]').click();await Promise.resolve();await Promise.resolve();assert.equal((await promise).id,'cancel');
  }finally{session.destroy();globalThis.document=previous;}
});

test('mounted guide leaves a full dialog unobstructed when space exists while highlighting its own field or title',async()=>{
  const previous=globalThis.document,inside=dom(),outside=dom();globalThis.document=inside.doc;
  outside.doc.defaultView.innerWidth=1280;outside.doc.defaultView.innerHeight=720;
  const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});
  const frame=outside.element('iframe');frame.clientWidth=430;frame.clientHeight=690;frame.getBoundingClientRect=()=>rect(40,30,430,690);outside.doc.body.append(frame);inside.doc.defaultView.frameElement=frame;
  const info=inside.element('button',{'data-reader':'conditions'});inside.doc.body.append(info);
  const ui={layout:'portrait',esc:value=>String(value??''),state:{page:'package'},bridge:{guideHost:{document:outside.doc},store:{read:()=>({}),update(){throw Error('guide must not save');}}},notify(){},showPage:async()=>true};
  const session=mountGuide(ui);
  try{
    const promise=ask({title:'独立有效词',fields:[{id:'activationKeywords',label:'有效词',value:'保留'}],choices:[{id:'cancel',label:'取消'}]});
    const form=inside.doc.querySelector('dialog[open]'),field=form.querySelector('[name="activationKeywords"]'),title=form.querySelector('[data-dialog-title]');
    form.getBoundingClientRect=()=>rect(20,40,390,520);field.getBoundingClientRect=()=>rect(40,140,340,100);title.getBoundingClientRect=()=>rect(40,60,340,30);
    await session.start('conditions');
    const card=outside.doc.querySelector('.lj-guide-card'),ring=outside.doc.querySelector('.lj-guide-ring');card.getBoundingClientRect=()=>rect(0,0,360,300);outside.flush();
    assert.equal(ring.style.left,'77px');assert.equal(ring.style.top,'167px','ring stays on the actual input');
    assert.ok(parseFloat(card.style.left)>=440+10,'card must sit beside the entire iframe dialog, leaving cancel available');
    await session.next();outside.flush();assert.equal(ring.style.top,'87px','missing entry falls back to dialog title');
    assert.ok(parseFloat(card.style.left)>=440+10,'title fallback still avoids the entire form');
    outside.doc.defaultView.innerWidth=430;frame.getBoundingClientRect=()=>rect(0,0,430,690);form.getBoundingClientRect=()=>rect(10,30,410,620);card.getBoundingClientRect=()=>rect(0,0,390,220);outside.flush();
    const box={left:parseFloat(card.style.left),top:parseFloat(card.style.top)};
    assert.ok(box.left>=8&&box.left+390<=422&&box.top>=8&&box.top+220<=712,'narrow card stays in viewport');
    assert.ok(box.top>90,'the highlighted title remains exposed when full-dialog avoidance cannot fit');
    session.close();form.querySelector('[data-choice="cancel"]').click();assert.equal((await promise).id,'cancel');
  }finally{session.destroy();globalThis.document=previous;}
});

test('an open condition modal owns its visible field above a reader overlay and is the fallback only when that field is absent',async()=>{
  const previous=globalThis.document,env=dom();globalThis.document=env.doc;
  const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});
  const reader=env.element('section',{'class':'lj-reader-overlay'});reader.getBoundingClientRect=()=>rect(0,0,900,700);env.doc.body.append(reader);
  const info=env.element('button',{'data-reader':'conditions'});reader.append(info);
  const ui={layout:'desktop',esc:value=>String(value??''),state:{page:'package'},bridge:{store:{read:()=>({}),update(){throw Error('guide must not save');}}},notify(){},showPage:async()=>true};
  const session=mountGuide(ui);
  try{
    const promise=ask({title:'正文适用情况',layout:'conditions',fields:[{id:'applicability',label:'适用情况',value:'conditional'}],choices:[{id:'cancel',label:'取消'}]});
    const form=env.doc.querySelector('dialog[open]'),field=form.querySelector('[name="applicability"]');form.getBoundingClientRect=()=>rect(100,80,400,500);field.getBoundingClientRect=()=>rect(130,160,330,40);
    await session.start('conditions');await session.next();await session.next();
    const ring=env.doc.querySelector('.lj-guide-ring'),card=env.doc.querySelector('.lj-guide-card');
    assert.equal(card.querySelector('[data-guide-hint]').hidden,true,'the native modal is not hidden by the reader behind it');
    assert.equal(ring.style.left,'127px');assert.equal(ring.style.top,'157px','specific field must win over its containing dialog');
    field.remove();env.flush();assert.equal(card.querySelector('[data-guide-hint]').hidden,true);assert.equal(ring.style.left,'97px','a fixed-geography form without applicability can still show the dialog');
    session.close();form.querySelector('[data-choice="cancel"]').click();assert.equal((await promise).id,'cancel');
  }finally{session.destroy();globalThis.document=previous;}
});
