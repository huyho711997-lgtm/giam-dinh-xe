
function collectionDocumentDraftIdentity(snapshot) {
  const normalized=structuredClone(snapshot);
  normalized.state.meta.signerTitle=collectionGuideSignerTitle(normalized.state.meta.signerTitle);
  if(normalized.state.meta.address===collectionGuidePreviousAddress)normalized.state.meta.address=collectionGuideBranchAddress;
  if(normalized.state.meta.hotline==='19001562')normalized.state.meta.hotline=collectionGuideFindAssessorPhone(normalized.state.meta.assessor).phone;
  normalized.state.contactPhoneManual=normalized.state.contactPhoneManual===true;
  if(normalized.state.tndsAdvance)normalized.state.tndsAdvance.signerTitle=collectionGuideSignerTitle(normalized.state.tndsAdvance.signerTitle);
  const source=JSON.stringify({template:collectionGuideAssets().sha256,snapshot:normalized});
  const key='tasco.collection-document.v1.'+encodeURIComponent((snapshot.claim.number||'')+'|'+snapshot.claim.plate);
  return {source,key};
}

function collectionDocumentReadEdits(snapshot) {
  const {source,key}=collectionDocumentDraftIdentity(snapshot);
  let record=collectionDocumentDraftCache.get(key);
  if(!record) {try {record=JSON.parse(localStorage.getItem(key)||'null');} catch {record=null;}}
  if(record?.source!==source) {
    try {
      const previous=JSON.parse(record?.source);
      if(previous.template!==collectionGuideAssets().sha256 || collectionDocumentDraftIdentity(previous.snapshot).source!==source)return {};
    } catch {return {};}
  }
  if(!record.edits || typeof record.edits!=='object')return {};
  return Object.fromEntries(Object.entries(record.edits).filter(([id,value])=>/^\d+$/.test(id)&&typeof value==='string'&&value.length<=100000&&!value.includes(collectionGuidePreviousAddress)&&!value.includes('Điện thoại tổng đài giải đáp thông tin: 19001562')));
}

function collectionDocumentWriteEdits(snapshot,edits) {
  const {source,key}=collectionDocumentDraftIdentity(snapshot),record={source,edits:structuredClone(edits),savedAt:Date.now()};
  collectionDocumentDraftCache.set(key,record);
  if(collectionDocumentDraftCache.size>64) collectionDocumentDraftCache.delete(collectionDocumentDraftCache.keys().next().value);
  queueMicrotask(scheduleCollectionGuideAutoSave);
  try {if(Object.keys(edits).length) localStorage.setItem(key,JSON.stringify(record));else localStorage.removeItem(key);return true;} catch {return false;}
}

function collectionDocumentEditableParagraph(p) {
  return !collectionGuideDesc(p,'drawing').length && !collectionGuideDesc(p,'pict').length;
}

function collectionDocumentMarkParagraphs(doc) {
  collectionGuideDesc(doc,'p').forEach((p,index)=>{if(collectionDocumentEditableParagraph(p)) p.setAttribute('data-guide-edit-id',String(index));});
}

function collectionDocumentApplyEdits(doc,edits,preview=false) {
  if(!edits || !Object.keys(edits).length) return;
  const paragraphs=collectionGuideDesc(doc,'p');
  for(const [id,html] of Object.entries(edits)) {
    const p=paragraphs[Number(id)];
    if(!/^\d+$/.test(id)||!p||!collectionDocumentEditableParagraph(p)||typeof html!=='string') continue;
    const originalRuns=collectionGuideChildren(p,'r');
    const template=document.createElement('template');template.innerHTML=html;
    const runs=[];
    const append=(text,context,breakType=null)=>{
      if(!text && !breakType) return;
      const run=doc.createElementNS(collectionGuideW,'w:r');
      const original=originalRuns[context.source]||originalRuns[0];
      let properties=original&&collectionGuideChildren(original,'rPr')[0]?.cloneNode(true);
      const setProperty=(name,value)=>{
        if(!properties) properties=doc.createElementNS(collectionGuideW,'w:rPr');
        let property=collectionGuideChildren(properties,name)[0];
        if(!property){property=doc.createElementNS(collectionGuideW,'w:'+name);properties.append(property);}
        property.setAttributeNS(collectionGuideW,'w:val',String(value));
      };
      if(context.bold!==undefined)setProperty('b',context.bold?1:0);
      if(context.italic!==undefined)setProperty('i',context.italic?1:0);
      if(context.underline!==undefined)setProperty('u',context.underline?'single':'none');
      if(context.size)setProperty('sz',Math.round(context.size*2));
      if(properties)run.append(properties);
      const leaf=doc.createElementNS(collectionGuideW,'w:'+(breakType||'t'));
      if(!breakType){leaf.textContent=text;leaf.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');}
      run.append(leaf);
      if(preview)run.setAttribute('data-guide-run-source',String(context.source||0));
      runs.push(run);
    };
    const visit=(node,inherited={source:0})=>{
      if(node.nodeType===Node.TEXT_NODE){
        const pieces=node.textContent.split(/([\n\t])/);
        pieces.forEach(piece=>piece==='\n'?append('',inherited,'br'):piece==='\t'?append('',inherited,'tab'):append(piece,inherited));return;
      }
      if(node.nodeType!==Node.ELEMENT_NODE && node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE) return;
      if(node.nodeType===Node.ELEMENT_NODE && ['SCRIPT','STYLE','IMG','OBJECT','IFRAME','SVG'].includes(node.tagName))return;
      const context={...inherited};
      if(node.nodeType===Node.ELEMENT_NODE){
        const index=node.getAttribute('data-guide-run');
        if(index!==null && /^\d+$/.test(index))context.source=Number(index);
        if(['B','STRONG'].includes(node.tagName))context.bold=true;
        if(['I','EM'].includes(node.tagName))context.italic=true;
        if(node.tagName==='U')context.underline=true;
        const style=node.style;
        if(style.fontWeight)context.bold=style.fontWeight==='bold'||Number(style.fontWeight)>=600;
        if(style.fontStyle)context.italic=style.fontStyle==='italic';
        if(style.textDecorationLine)context.underline=style.textDecorationLine.includes('underline');
        const size=style.fontSize?.match(/^(\d+(?:\.\d+)?)pt$/);
        if(size&&Number(size[1])>=6&&Number(size[1])<=72)context.size=Number(size[1]);
        if(node.tagName==='BR'){append('',context,'br');return;}
        if(['DIV','P'].includes(node.tagName)&&runs.length&&runs[runs.length-1].lastElementChild?.localName!=='br')append('',context,'br');
      }
      node.childNodes.forEach(child=>visit(child,context));
    };
    visit(template.content);
    originalRuns.forEach(run=>run.remove());
    if(!runs.length){const run=doc.createElementNS(collectionGuideW,'w:r');run.append(doc.createElementNS(collectionGuideW,'w:t'));runs.push(run);}
    p.append(...runs);
  }
}


function createCollectionDocumentEditor(snapshot) {
  let edits=collectionDocumentReadEdits(snapshot),editing=false,overlay,frame,editButton,status,toolbar,timer,ready=false,storageSaved=true;
  const baselineHtml=buildCollectionGuidePrintHtml(snapshot,{});
  const parsed=new DOMParser().parseFromString(baselineHtml,'text/html'),baseline=new Map();
  parsed.querySelectorAll('p[data-guide-edit-id]').forEach(p=>baseline.set(p.dataset.guideEditId,p.innerHTML));
  const editor={
    get editing(){return editing;},
    html(){return Object.keys(edits).length?buildCollectionGuidePrintHtml(snapshot,edits):baselineHtml;},
    attach(elements){
      ({overlay,frame,editButton}=elements);overlay._guideEditor=editor;
      status=overlay.querySelector('.collection-guide-preview-format');
      const subtitle=overlay.querySelector('.collection-guide-preview-subtitle');
      subtitle.textContent='Sửa nội dung trên trang A4, sau đó xuất Word hoặc in tài liệu.';
      toolbar=collectionGuideElement('div','collection-document-editor-toolbar');toolbar.hidden=true;
      const tools=collectionGuideElement('div','collection-document-editor-tools');
      const action=(label,icon,callback)=>{
        const button=collectionGuideElement('button','btn-premium btn-secondary');button.type='button';button.setAttribute('aria-label',label);
        const symbol=collectionGuideElement('span');symbol.setAttribute('aria-hidden','true');symbol.innerHTML=icon;
        button.append(symbol,collectionGuideElement('span','',label));button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',callback);tools.append(button);return button;
      };
      const undoIcon='<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5-5 5 5 5M4 10h10a6 6 0 0 1 0 12"/></svg>';
      const redoIcon=undoIcon.replace('m9 5-5 5 5 5M4 10h10a6 6 0 0 1 0 12','m15 5 5 5-5 5M20 10H10a6 6 0 0 0 0 12');
      action('Hoàn tác',undoIcon,()=>editor.command('undo'));
      action('Làm lại',redoIcon,()=>editor.command('redo'));
      action('Dùng mẫu gốc',SVGS.REFRESH||undoIcon,()=>{
        clearTimeout(timer);edits={};collectionDocumentWriteEdits(snapshot,edits);ready=false;frame.srcdoc=baselineHtml;updateStatus();
      });
      toolbar.append(tools,collectionGuideElement('p','','Chọn đoạn văn hoặc ô trong bảng để sửa. Bản nháp tự lưu trên máy này.'));
      frame.before(toolbar);
      frame.addEventListener('load',initializeFrame);
      editButton.disabled=true;
      updateStatus();
    },
    toggle(){
      if(!ready)return;
      if(editing){
        editor.flush();
        let html;try{html=editor.html();}catch(error){collectionGuideReport(error);return;}
        editing=false;ready=false;frame.srcdoc=html;
      }else{editing=true;setEditable();}
      updateStatus();
    },
    flush(){
      clearTimeout(timer);if(!ready||!frame?.contentDocument)return;
      // Capture all cells as well, including the last keystroke before closing/exporting.
      const seen=new Set();
      frame.contentDocument.querySelectorAll('p[data-guide-edit-id]').forEach(p=>{
        const id=p.dataset.guideEditId;if(seen.has(id))return;seen.add(id);
        if(p.innerHTML!==baseline.get(id))edits[id]=p.innerHTML;else delete edits[id];
      });
      storageSaved=collectionDocumentWriteEdits(snapshot,edits);updateStatus();
    },
    command(name){
      if(!editing||!ready)return;
      frame.contentDocument.execCommand(name);
      editor.flush();
    },
    export(){editor.flush();return exportCollectionGuideWord(snapshot);},
    print(){editor.flush();try{return printCollectionDocumentHtml(editor.html(),'Hướng dẫn thu thập hồ sơ');}catch(error){collectionGuideReport(error);}}
  };
  function updateStatus(){
    if(!overlay)return;
    overlay.classList.toggle('collection-document-editing',editing);toolbar.hidden=!editing;
    const label=editing?'Hoàn tất chỉnh sửa':'Chỉnh sửa nội dung';editButton.querySelector('span:last-child').textContent=label;editButton.setAttribute('aria-label',label);editButton.setAttribute('aria-pressed',String(editing));editButton.disabled=!ready;
    status.textContent=(Object.keys(edits).length?(storageSaved?'Bản nháp đã lưu trên máy':'Bản nháp trong phiên hiện tại'):'Mẫu gốc')+' · Khổ A4 dọc';
  }
  function setEditable(){
    const doc=frame.contentDocument;
    doc.body.classList.toggle('collection-document-edit-mode',editing);
    doc.querySelectorAll('p[data-guide-edit-id]').forEach(p=>{
      p.setAttribute('contenteditable',String(editing));
      if(editing){p.setAttribute('role','textbox');p.setAttribute('aria-label',p.closest('table')?'Sửa nội dung ô bảng':'Sửa đoạn văn');p.setAttribute('aria-multiline','true');}
      else{p.removeAttribute('role');p.removeAttribute('aria-label');p.removeAttribute('aria-multiline');}
    });
  }
  function initializeFrame(){
    const doc=frame.contentDocument;if(!doc?.querySelector('.guide-page'))return;
    ready=true;
    const style=doc.createElement('style');style.dataset.collectionDocumentEditor='true';
    style.textContent='@media screen{.collection-document-edit-mode p[data-guide-edit-id]{cursor:text;min-height:1em;border-radius:2px;transition:background .15s,box-shadow .15s}.collection-document-edit-mode p[data-guide-edit-id]:hover{background:rgba(216,180,109,.08);box-shadow:0 0 0 1px rgba(179,140,67,.2)}.collection-document-edit-mode p[data-guide-edit-id]:focus{outline:none;background:rgba(216,180,109,.1);box-shadow:0 0 0 2px rgba(179,140,67,.45)}}';
    doc.head.append(style);setEditable();updateStatus();
    doc.addEventListener('input',event=>{
      const p=event.target.closest?.('p[data-guide-edit-id]');if(!editing||!p)return;
      // Table headings repeated on multiple A4 pages stay synchronized.
      doc.querySelectorAll('p[data-guide-edit-id="'+p.dataset.guideEditId+'"]').forEach(other=>{if(other!==p)other.innerHTML=p.innerHTML;});
      clearTimeout(timer);status.textContent='Đang lưu bản nháp… · Khổ A4 dọc';timer=setTimeout(()=>editor.flush(),400);
    });
    const plainInsert=event=>{
      if(!editing||!event.target.closest?.('p[data-guide-edit-id]'))return;
      event.preventDefault();const text=(event.clipboardData||event.dataTransfer)?.getData('text/plain')||'';
      if(text)doc.execCommand('insertText',false,text);
    };
    doc.addEventListener('paste',plainInsert);doc.addEventListener('drop',plainInsert);
    doc.addEventListener('keydown',event=>{
      if(editing&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();editor.flush();}
    });
  }
  return editor;
}
