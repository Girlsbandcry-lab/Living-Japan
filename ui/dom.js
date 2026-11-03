export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const button = (text, action, extra = '') => `<button type="button" class="lj-button" data-action="${action}" ${extra}>${esc(text)}</button>`;
export const switchButton = (on, label, action, extra = '') => `<button type="button" class="lj-switch" aria-pressed="${on}" aria-label="${esc(label)}" title="${esc(label)}" data-action="${action}" ${extra}></button>`;
export function setText(selector, text) { $$(selector).forEach(node => { node.textContent = text; }); }
export function ask({ title, message, choices, fields = [], confirmDiscard = false, layout = '', discardChoices = [], onFieldChange = null }) {
  return new Promise(resolve => {
    const dialog=document.createElement('dialog');dialog.className='lj-dialog'+(layout==='conditions'?' lj-condition-dialog':'');
    // LJ-MATERIAL-DIALOG-20261030: existing dialogs retain values and accept readable condition fields.
    Object.assign(dialog.style,{maxHeight:'85dvh',overflowY:'auto'});
    const fieldHTML=field=>{
      if(field.options&&field.multiple)return `<fieldset style="margin:${layout==='conditions'?'0':'8px 0'};padding:8px;border:1px solid var(--line)"><legend>${esc(field.label)}</legend><div style="display:flex;flex-wrap:wrap;gap:8px">${field.options.map(option=>`<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" name="${esc(field.id)}" value="${esc(option.value)}" ${Array.isArray(field.value)&&field.value.includes(option.value)?'checked':''} style="width:auto;margin:0">${esc(option.label)}</label>`).join('')}</div></fieldset>`;
      const control=field.options?`<select name="${esc(field.id)}">${field.options.map(option=>`<option value="${esc(option.value)}" ${String(option.value)===String(field.value??'')?'selected':''}>${esc(option.label)}</option>`).join('')}</select>`:field.multiline?`<textarea name="${esc(field.id)}" rows="4" style="width:100%;box-sizing:border-box;font:inherit">${esc(field.value||'')}</textarea>`:`<input name="${esc(field.id)}" type="${esc(field.type||'text')}" value="${esc(field.value||'')}" autocomplete="off">`;
      return `<label>${esc(field.label)}${control}</label>`;
    };
    const fieldsHTML=layout==='conditions'?`<div class="lj-condition-grid">${fields.map(field=>`<div class="lj-condition-field${field.half?' half':''}" data-condition-field="${esc(field.id)}">${fieldHTML(field)}</div>`).join('')}</div>`:fields.map(fieldHTML).join('');
    dialog.innerHTML=`<h3 data-dialog-title="${esc(title)}">${esc(title)}</h3><p>${esc(message||'')}</p>${fieldsHTML}<div class="lj-dialog-actions">${choices.map(c=>`<button type="button" class="lj-button ${c.primary?'primary':''}" data-choice="${esc(c.id)}">${esc(c.label)}</button>`).join('')}</div>`;
    const readValues=()=>{const values={};for(const field of fields){const inputs=$$('[name]',dialog).filter(node=>node.name===field.id);values[field.id]=field.multiple?inputs.filter(node=>node.checked).map(node=>node.value):inputs[0]?.value||'';}return values;};
    const updateVisibility=()=>{const values=readValues();for(const node of $$('[data-condition-field]',dialog)){const condition=fields.find(field=>field.id===node.dataset.conditionField)?.visibleWhen;node.hidden=Boolean(condition&&values[condition.id]!==condition.value);}};
    const updateFields=event=>{
      if(onFieldChange&&!event.isComposing&&fields.some(field=>field.id===event.target.name)){
        const patch=onFieldChange(event.target.name,readValues())||{};
        for(const [id,value]of Object.entries(patch)){
          const field=fields.find(field=>field.id===id);if(!field)continue;
          for(const input of $$('[name]',dialog).filter(node=>node.name===id)){
            if(field.multiple)input.checked=Array.isArray(value)&&value.map(String).includes(input.value);
            else input.value=String(value??'');
          }
        }
      }
      if(layout==='conditions')updateVisibility();
    };
    if(layout==='conditions')updateVisibility();
    if(onFieldChange)dialog.addEventListener('input',updateFields);
    if(onFieldChange||layout==='conditions')dialog.addEventListener('change',updateFields);
    const dirtyValues=()=>{const values=readValues();return JSON.stringify(Object.fromEntries(fields.filter(field=>!field.transient).map(field=>[field.id,values[field.id]])));};
    const initialValues=dirtyValues();let confirming=false,finished=false;
    const finish=id=>{if(finished)return;finished=true;const values=readValues();dialog.close();dialog.remove();resolve(fields.length?{id,values}:id);};
    // LJ-DIALOG-DISCARD-20261102: opted-in input dialogs retain the same live form while asking about changed input.
    const cancel=async(id='cancel')=>{
      if(confirming||finished)return;
      if(!confirmDiscard||dirtyValues()===initialValues){finish(id);return;}
      confirming=true;
      try{const answer=await ask({title:'放弃未保存的填写？',message:'已填写的内容尚未保存。可以继续编辑，或放弃本次填写。',choices:[{id:'cancel',label:'继续编辑',primary:true},{id:'discard',label:'放弃草稿'}]});if(answer==='discard')finish(id);}
      finally{confirming=false;}
    };
    dialog.addEventListener('click',event=>{const target=event.target.closest('[data-choice]');if(!target||confirming||finished)return;if(target.dataset.choice==='cancel'||discardChoices.includes(target.dataset.choice))void cancel(target.dataset.choice);else finish(target.dataset.choice);});
    dialog.addEventListener('cancel',event=>{event.preventDefault();void cancel();});document.body.append(dialog);dialog.showModal();
  });
}
export function status(message, type='') {
  let node=$('#ljRuntimeStatus');if(!node){node=document.createElement('div');node.id='ljRuntimeStatus';node.setAttribute('role','status');Object.assign(node.style,{position:'fixed',bottom:'10px',left:'50%',transform:'translateX(-50%)',zIndex:100000,maxWidth:'85%',padding:'8px 12px',borderRadius:'4px',background:'#23362fee',color:'white',fontSize:'13px',pointerEvents:'none'});document.body.append(node);}
  node.textContent=message;node.hidden=false;clearTimeout(status.timer);status.timer=setTimeout(()=>{node.hidden=true;},type==='error'?7000:3500);
}
export function applyTheme(theme='auto') {
  const current=theme==='auto'?(matchMedia('(prefers-color-scheme:dark)').matches?'night':'day'):theme;
  document.body.dataset.theme=current;
  $$('.v7').forEach(node=>{node.dataset.theme=current;});
  $$('.device').forEach(node=>node.classList.toggle('night',current==='night'));
}
