
// One export entry point for all claim document templates.
let collectionWordMenuAnchor = null;
let collectionWordMenuAbort = null;
function closeCollectionWordMenu(restoreFocus=false) {
  const anchor=collectionWordMenuAnchor;
  document.getElementById('collectionWordMenu')?.remove();
  collectionWordMenuAbort?.abort();collectionWordMenuAbort=null;collectionWordMenuAnchor=null;
  if(anchor) anchor.setAttribute('aria-expanded','false');
  if(restoreFocus && anchor?.isConnected && anchor.getClientRects().length) anchor.focus({preventScroll:true});
}
function toggleCollectionWordMenu(anchor) {
  if(document.getElementById('collectionWordMenu')) {closeCollectionWordMenu(true);return;}
  collectionWordMenuAnchor=anchor;collectionWordMenuAbort=new AbortController();
  const signal=collectionWordMenuAbort.signal;
  const menu=collectionGuideElement('div','collection-word-menu ce-document-menu');menu.id='collectionWordMenu';menu.style.visibility='hidden';
  menu.setAttribute('role','dialog');menu.setAttribute('aria-modal','false');menu.setAttribute('aria-labelledby','collectionWordMenuTitle');
  menu.setAttribute('aria-describedby','collectionWordMenuContext');
  const heading=collectionGuideElement('div','collection-word-menu-heading');
  const headingIcon=collectionGuideElement('span','collection-word-menu-heading-icon');headingIcon.setAttribute('aria-hidden','true');headingIcon.innerHTML=SVGS.SAVE;
  const headingCopy=collectionGuideElement('div','collection-word-menu-heading-copy');
  const title=collectionGuideElement('strong','','Xuất tài liệu');title.id='collectionWordMenuTitle';
  const claimNumber=collectionGuideValue('modalPendingSoHoSoBoiThuong'),plate=collectionGuideValue('modalPendingBienSo');
  const context=collectionGuideElement('span','collection-word-menu-context',claimNumber?'Số HSBT: '+claimNumber:plate?'Hồ sơ xe: '+plate:'Chọn mẫu tài liệu cần xuất');context.id='collectionWordMenuContext';
  headingCopy.append(title,context);
  heading.append(headingIcon,headingCopy,collectionGuideElement('span','collection-word-menu-format','DOCX'));menu.append(heading);
  const searchWrap=collectionGuideElement('label','ce-document-search');
  searchWrap.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>';
  const search=collectionGuideElement('input');search.type='search';search.placeholder='Tìm mẫu tài liệu…';search.autocomplete='off';search.setAttribute('aria-label','Tìm mẫu tài liệu');
  const counter=collectionGuideElement('span');counter.setAttribute('aria-live','polite');searchWrap.append(search,counter);menu.append(searchWrap);
  const list=collectionGuideElement('div','collection-word-menu-list');
  const guideIcon='<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6m-12 5 1.5 1.5L12 12m2 1h3m-9 5h9"/></svg>';
  const advanceIcon='<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6m-5 4-6 6"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
  const downloadIcon='<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M5 17v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"/></svg>';
  const documents=[
    ['Hướng dẫn thu thập hồ sơ','Danh sách giấy tờ và tình trạng bổ sung',guideIcon,previewCollectionGuide,exportCollectionGuideWord],
    ['Thông báo tạm ứng TNDS','Thông tin và phương án tạm ứng bồi thường',advanceIcon,previewTndsAdvance,openTndsAdvanceDialog],
    ['Trưng cầu hồ sơ từ cơ quan chức năng','Công văn đề nghị cung cấp tài liệu vụ tai nạn',guideIcon,previewAuthorityRequest,exportAuthorityRequestWord]
  ];
  counter.textContent=documents.length+'/'+documents.length;
  for(const [name,description,documentIcon,preview,download] of documents) {
    const row=collectionGuideElement('section','collection-word-menu-document');
    const summary=collectionGuideElement('div','collection-word-menu-document-heading');
    const symbol=collectionGuideElement('span','collection-word-menu-icon');symbol.setAttribute('aria-hidden','true');symbol.innerHTML=documentIcon;
    const copy=collectionGuideElement('div');copy.append(collectionGuideElement('h4','',name),collectionGuideElement('p','',description));summary.append(symbol,copy);
    const actions=collectionGuideElement('div','collection-word-menu-document-actions');
    for(const [label,icon,action] of [['Xem trước',SVGS.EYE,preview],['Xuất Word',downloadIcon,download]]) {
      const button=collectionGuideElement('button',label==='Xuất Word'?'collection-word-download':'');button.type='button';
      const image=collectionGuideElement('span');image.setAttribute('aria-hidden','true');image.innerHTML=icon;
      button.append(image,collectionGuideElement('span','',label));button.setAttribute('aria-label',label+' '+name);
      button.addEventListener('click',()=>{closeCollectionWordMenu(true);action();});actions.append(button);
    }
    row.append(summary,actions);list.append(row);
  }
  const empty=collectionGuideElement('p','ce-document-empty','Không tìm thấy mẫu tài liệu.');empty.hidden=true;list.append(empty);
  search.addEventListener('input',()=>{
    const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().trim();
    const query=normalize(search.value);let count=0;
    list.querySelectorAll('.collection-word-menu-document').forEach(row=>{row.hidden=!normalize(row.querySelector('.collection-word-menu-document-heading').textContent).includes(query);if(!row.hidden)count++;});
    counter.textContent=count+'/'+documents.length;empty.hidden=count>0;
  });
  menu.append(list);document.body.append(menu);anchor.setAttribute('aria-expanded','true');
  // Measure the untransformed panel before the opening animation starts.
  menu.style.animation='none';
  const rect=anchor.getBoundingClientRect(),bounds=menu.getBoundingClientRect(),gap=10;
  const left=Math.max(12,Math.min(rect.right-bounds.width,window.innerWidth-bounds.width-12));
  const below=window.innerHeight-rect.bottom-gap-12,above=rect.top-gap-12;
  const useAbove=below<bounds.height && above>below;
  const available=Math.max(100,useAbove?above:below);
  menu.dataset.placement=useAbove?'above':'below';menu.style.maxHeight=available+'px';
  menu.style.left=left+'px';menu.style.top=Math.max(12,useAbove?rect.top-gap-Math.min(bounds.height,available):rect.bottom+gap)+'px';
  menu.style.visibility='';menu.style.animation='';
  document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target) && !anchor.contains(event.target)) closeCollectionWordMenu();},{signal});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape') {event.preventDefault();event.stopPropagation();closeCollectionWordMenu(true);}
  },{signal,capture:true});
  document.addEventListener('scroll',event=>{if(event.target!==menu && !menu.contains(event.target)) closeCollectionWordMenu();},{signal,capture:true});
  window.addEventListener('resize',()=>closeCollectionWordMenu(),{signal});
  menu.addEventListener('focusout',event=>{if(event.relatedTarget && !menu.contains(event.relatedTarget) && event.relatedTarget!==anchor) closeCollectionWordMenu();});
  menu.addEventListener('keydown',event=>{
    if(event.defaultPrevented)return;
    if(event.key==='Tab') {
      const buttons=[...menu.querySelectorAll('button')].filter(button=>button.getClientRects().length&&!button.disabled);
      const last=buttons.at(-1)||search;
      if(event.shiftKey && document.activeElement===search){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();search.focus();}
      return;
    }
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    if(event.target===search && ['Home','End'].includes(event.key))return;
    const buttons=[...menu.querySelectorAll('button')].filter(button=>button.getClientRects().length&&!button.disabled),index=buttons.indexOf(document.activeElement);
    if(!buttons.length)return;
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
    event.preventDefault();buttons[next]?.focus();
  });
  if(window.matchMedia('(hover: hover) and (pointer: fine)').matches)search.focus({preventScroll:true});
  else menu.querySelector('button')?.focus({preventScroll:true});
}

function openCollectionDocumentPreview({title,html,claim,onExport,onPrint,onEdit,guideEditor}) {
  const previous=document.getElementById('collectionGuidePreview');
  const returnFocus=previous?previous._returnFocus:document.activeElement;previous?._guideEditor?.flush();previous?.remove();
  const overlay=collectionGuideElement('div','p-modal-overlay collection-guide-preview');overlay.id='collectionGuidePreview';overlay.style.zIndex='100003';overlay._returnFocus=returnFocus;
  const panel=collectionGuideElement('section','profile-modal-panel');
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-labelledby','collectionGuidePreviewTitle');panel.setAttribute('aria-describedby','collectionGuidePreviewDescription');
  const header=collectionGuideElement('div','collection-guide-preview-header');
  const heading=collectionGuideElement('div','collection-guide-preview-heading');
  const icon=collectionGuideElement('span','collection-guide-preview-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML=SVGS.SCROLL;
  const copy=collectionGuideElement('div','collection-guide-preview-copy');
  const eyebrow=collectionGuideElement('span','collection-guide-preview-eyebrow','Tài liệu hồ sơ');
  const caption=collectionGuideElement('h3','',title);caption.id='collectionGuidePreviewTitle';
  const subtitle=collectionGuideElement('p','collection-guide-preview-subtitle','Kiểm tra nội dung trước khi xuất hoặc in tài liệu.');subtitle.id='collectionGuidePreviewDescription';
  copy.append(eyebrow,caption,subtitle);heading.append(icon,copy);
  const actions=collectionGuideElement('div','collection-guide-actions');
  const printIcon='<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6zM17 12h.01"/></svg>';
  const buttons=[['Xuất Word','btn-premium collection-guide-preview-export',SVGS.SAVE,onExport],['In tài liệu','btn-premium btn-secondary collection-guide-preview-print',printIcon,onPrint]];
  if(guideEditor) buttons.unshift(['Chỉnh sửa nội dung','btn-premium btn-secondary collection-guide-direct-edit',SVGS.EDIT,()=>guideEditor.toggle()]);
  if(onEdit) buttons.unshift(['Chỉnh sửa','btn-premium btn-secondary collection-guide-preview-edit',SVGS.EDIT,onEdit]);
  buttons.push(['Đóng','btn-premium btn-secondary collection-guide-preview-close',SVGS.CLOSE,closeCollectionGuidePreview]);
  for(const [label,className,buttonIcon,action] of buttons) {
    const button=collectionGuideElement('button',className);button.type='button';button.title=label==='Xuất Word'?'Tải tệp Word (.docx)':label;button.setAttribute('aria-label',label);
    // Cấu trúc chung với nhóm nút ở header hồ sơ: chip icon + nhãn (css/document-preview.css).
    const image=collectionGuideElement('span','cgp-icon');image.setAttribute('aria-hidden','true');image.innerHTML=buttonIcon;
    button.append(image,collectionGuideElement('span','cgp-label',label));button.addEventListener('click',()=>action());
    if(label==='Đóng') actions.append(collectionGuideElement('span','cgp-divider'));
    actions.append(button);
  }
  header.append(heading,actions);
  const context=collectionGuideElement('div','collection-guide-preview-context');
  const format=collectionGuideElement('span','collection-guide-preview-format','Bản xem trước · Khổ A4 dọc');
  const caseLabel=collectionGuideElement('span','collection-guide-preview-case',claim.number?'Số HSBT: '+claim.number:'Biển số: '+claim.plate);caseLabel.id='collectionGuidePreviewCase';context.append(format,caseLabel);
  const frame=collectionGuideElement('iframe');frame.id='collectionGuidePreviewFrame';frame.title='Bản xem trước '+title;frame.setAttribute('sandbox','allow-same-origin');frame.srcdoc=html;
  panel.append(header,context,frame);overlay.append(panel);document.body.append(overlay);overlay.style.display='grid';
  if(guideEditor) guideEditor.attach({overlay,frame,editButton:overlay.querySelector('.collection-guide-direct-edit')});
  overlay.addEventListener('click',event=>{if(event.target===overlay) closeCollectionGuidePreview();});
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape') {event.preventDefault();event.stopPropagation();closeCollectionGuidePreview();return;}
    if(event.key!=='Tab') return;
    const focusable=[...panel.querySelectorAll('button:not(:disabled),iframe')].filter(el=>el.getClientRects().length),first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
  });
  // Keyboard events within an iframe do not bubble to the parent dialog.
  frame.addEventListener('load',()=>frame.contentDocument?.addEventListener('keydown',event=>{
    if(event.key==='Escape') {event.preventDefault();closeCollectionGuidePreview();}
    if(event.key==='Tab' && !guideEditor?.editing) {event.preventDefault();const buttons=[...actions.querySelectorAll('button')];(event.shiftKey?buttons[buttons.length-1]:buttons[0])?.focus();}
  }));
  overlay.querySelector('.collection-guide-preview-close').focus();
}

// Export the supplied TNDS advance notice using the current claim.
let tndsAdvanceAssetsCache = null;
let tndsAdvanceBusy = false;
const tndsAdvanceFields = [
  ['city','Nơi lập thông báo','text',160],
  ['date','Ngày lập thông báo','date',10],
  ['assessor','Giám định viên liên hệ','text',200],
  ['hotline','Số điện thoại giám định viên','tel',80],
  ['signerTitle','Chức danh người ký','text',160],
  ['signerName','Họ tên người ký (nếu có)','text',200]
];
const tndsAdvanceOptions = [
  ['', 'Chưa đánh dấu phương án', 'Giữ cả bốn phương án chưa đánh dấu như mẫu Word.'],
  ['70', '70% mức bồi thường ước tính', '70% mức bồi thường ước tính (trường hợp tử vong đã xác định thuộc phạm vi bảo hiểm);'],
  ['50', '50% mức bồi thường ước tính', '50% mức bồi thường ước tính (trường hợp tổn thương đã xác định thuộc phạm vi bảo hiểm);'],
  ['30', '30% giới hạn trách nhiệm bảo hiểm', '30% giới hạn trách nhiệm bảo hiểm (trường hợp chưa xác định phạm vi, tử vong hoặc tổn thương ≥81%);'],
  ['10', '10% giới hạn trách nhiệm bảo hiểm', '10% giới hạn trách nhiệm bảo hiểm (trường hợp chưa xác định phạm vi, tổn thương 31%–<81%).']
];
function tndsAdvanceAssets() {
  return tndsAdvanceAssetsCache || (tndsAdvanceAssetsCache=TNDS_ADVANCE_TEMPLATE);
}
function tndsAdvanceDefaults() {
  const state=getCollectionGuideState(),saved=state.tndsAdvance;
  const defaults={
    city:state.meta.city || 'Hà Nội',date:state.meta.date || collectionGuideToday(),
    assessor:state.meta.assessor || collectionGuideValue('modalPendingCanBoXuLy') || collectionGuideValue('modalPendingGdvTiepNhan'),
    hotline:state.meta.hotline || '',
    signerTitle:state.meta.signerTitle || '',signerName:state.meta.signerName || ''
  };
  const next={};
  for(const [key,,,limit] of tndsAdvanceFields) {
    const raw=saved && typeof saved[key]==='string'?saved[key]:defaults[key];
    next[key]=(key==='signerTitle'?collectionGuideSignerTitle(raw):String(raw || '')).slice(0,limit);
  }
  const contact=collectionGuideFindAssessorPhone(next.assessor);
  if(contact.matched)next.hotline=contact.phone;
  else if(next.hotline==='19001562')next.hotline=state.meta.hotline || '';
  next.option=tndsAdvanceOptions.some(item=>item[0]===saved?.option)?saved.option:'';
  collectionGuideDraft.tndsAdvance=next;
  return next;
}
function tndsAdvanceLossDate(value) {
  const raw=String(value || '').trim();
  const local=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const iso=local?local[3]+'-'+local[2].padStart(2,'0')+'-'+local[1].padStart(2,'0'):raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return collectionGuideDisplayDate(iso || '');
}
function tndsAdvanceClaim() {
  const plate=collectionGuideValue('modalPendingBienSo'),chassis=collectionGuideValue('modalPendingSoKhungSoMay');
  return {
    number:collectionGuideValue('modalPendingSoHoSoBoiThuong'),customer:collectionGuideValue('modalPendingKhachHang'),
    plate,vehicle:plate+(chassis && chassis.toLocaleUpperCase('vi')!==plate.toLocaleUpperCase('vi')?' / '+chassis:''),
    lossDate:tndsAdvanceLossDate(collectionGuideValue('modalPendingNgayVTT')),
    location:collectionGuideValue('modalPendingDiaDiemVTT')
  };
}
function readTndsAdvanceDialog() {
  const meta=tndsAdvanceDefaults();
  for(const [key,,,limit] of tndsAdvanceFields) {
    const input=document.getElementById('tndsAdvance_'+key);
    if(input) meta[key]=input.value.trim().slice(0,limit);
  }
  const option=document.getElementById('tndsAdvance_option');
  if(option) meta.option=option.value;
  collectionGuideDraft.tndsAdvance=meta;
  return meta;
}
function tndsAdvanceSnapshot() {
  const meta=readTndsAdvanceDialog(),claim=tndsAdvanceClaim();
  if(!claim.customer || !claim.plate) throw new Error('Vui lòng nhập khách hàng và biển số ở tab Hợp đồng & Khách hàng.');
  if(!claim.lossDate || !claim.location) throw new Error('Vui lòng nhập ngày và địa điểm tổn thất ở tab Vụ tổn thất & Diễn biến.');
  if(!meta.city || !collectionGuideDate(meta.date)) throw new Error('Vui lòng nhập nơi lập và ngày lập thông báo hợp lệ.');
  if(!meta.assessor) throw new Error('Vui lòng nhập giám định viên liên hệ trong thông báo.');
  return {meta:{...meta},claim};
}
function openTndsAdvanceDialog() {
  try {
    const meta=tndsAdvanceDefaults(),claim=tndsAdvanceClaim();
    const previous=document.getElementById('tndsAdvanceDialog');
    if(previous) {previous.querySelector('input')?.focus();return;}
    const overlay=collectionGuideElement('div','p-modal-overlay tnds-advance-overlay');overlay.id='tndsAdvanceDialog';
    overlay.style.display='grid';overlay._returnFocus=document.activeElement;
    const panel=collectionGuideElement('section','profile-modal-panel tnds-advance-panel');
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
    panel.setAttribute('aria-labelledby','tndsAdvanceTitle');panel.setAttribute('aria-describedby','tndsAdvanceDescription');
    const header=collectionGuideElement('div','tnds-advance-header');
    const heading=collectionGuideElement('div','tnds-advance-heading');
    const symbol=collectionGuideElement('span','tnds-advance-symbol');symbol.setAttribute('aria-hidden','true');symbol.innerHTML=SVGS.SCROLL;
    const copy=collectionGuideElement('div');
    const title=collectionGuideElement('h3','','Thông báo tạm ứng TNDS');title.id='tndsAdvanceTitle';
    const description=collectionGuideElement('p','','Điền thông tin, xem trước và xuất Word theo mẫu thông báo.');description.id='tndsAdvanceDescription';
    copy.append(title,description);heading.append(symbol,copy);
    const close=collectionGuideElement('button','tnds-advance-close');close.type='button';close.setAttribute('aria-label','Đóng');close.innerHTML=SVGS.CLOSE;
    close.addEventListener('click',closeTndsAdvanceDialog);header.append(heading,close);
    const form=collectionGuideElement('form','tnds-advance-form');form.addEventListener('submit',event=>{event.preventDefault();exportTndsAdvanceWord();});
    const body=collectionGuideElement('div','tnds-advance-body');
    const summary=collectionGuideElement('div','tnds-advance-summary');
    for(const [label,value] of [
      ['Số HSBT',claim.number || 'Chưa có số hồ sơ'],['Khách hàng',claim.customer || 'Chưa nhập'],
      ['Phương tiện',claim.vehicle || 'Chưa nhập'],['Ngày tổn thất',claim.lossDate || 'Chưa nhập']
    ]) {
      const item=collectionGuideElement('div');item.append(collectionGuideElement('span','',label),collectionGuideElement('strong','',value));summary.append(item);
    }
    const location=collectionGuideElement('p','tnds-advance-location','Địa điểm tổn thất: '+(claim.location || 'Chưa nhập trong hồ sơ'));
    const grid=collectionGuideElement('div','tnds-advance-grid');
    for(const [key,label,type,limit] of tndsAdvanceFields) {
      const wrap=collectionGuideElement('div'),caption=collectionGuideElement('label','',label);
      const input=collectionGuideElement('input','input-premium');input.id='tndsAdvance_'+key;input.name=key;input.type=type;input.maxLength=limit;input.value=meta[key];caption.htmlFor=input.id;
      if(['city','date','assessor'].includes(key)) input.required=true;
      input.addEventListener('input',readTndsAdvanceDialog);wrap.append(caption,input);grid.append(wrap);
    }
    const choice=collectionGuideElement('div','tnds-advance-choice');
    const caption=collectionGuideElement('label','','Phương án tạm ứng cần đánh dấu trong mẫu');caption.htmlFor='tndsAdvance_option';
    const select=collectionGuideElement('select','input-premium');select.id='tndsAdvance_option';
    select.dataset.sfSelect='';select.dataset.sfLabel='Phương án tạm ứng';select.dataset.sfDescription='Tìm và chọn phương án cần đánh dấu trong mẫu';select.dataset.sfIcon='file';
    for(const [value,label] of tndsAdvanceOptions) {const option=collectionGuideElement('option','',label);option.value=value;select.append(option);}
    select.value=meta.option;
    const note=collectionGuideElement('p','tnds-advance-choice-note');
    const updateChoice=()=>{note.textContent=tndsAdvanceOptions.find(item=>item[0]===select.value)[2];readTndsAdvanceDialog();};
    select.addEventListener('change',updateChoice);choice.append(caption,select,note);
    const hint=collectionGuideElement('p','tnds-advance-hint','Thông tin khách hàng, xe và vụ tổn thất được lấy từ hồ sơ đang mở.');
    body.append(summary,location,grid,choice,hint);
    const footer=collectionGuideElement('div','tnds-advance-footer');
    const cancel=collectionGuideElement('button','btn-premium btn-secondary','Đóng');cancel.type='button';cancel.addEventListener('click',closeTndsAdvanceDialog);
    const download=collectionGuideElement('button','btn-premium');download.type='submit';download.id='tndsAdvanceExportButton';
    const saveIcon=collectionGuideElement('span');saveIcon.setAttribute('aria-hidden','true');saveIcon.innerHTML=SVGS.SAVE;
    const preview=collectionGuideElement('button','btn-premium btn-secondary');preview.type='button';
    const previewIcon=collectionGuideElement('span');previewIcon.setAttribute('aria-hidden','true');previewIcon.innerHTML=SVGS.EYE;
    preview.append(previewIcon,collectionGuideElement('span','','Xem trước'));preview.addEventListener('click',()=>previewTndsAdvance());
    download.append(saveIcon,collectionGuideElement('span','','Xuất Word (.docx)'));footer.append(cancel,preview,download);
    form.append(body,footer);panel.append(header,form);overlay.append(panel);document.body.append(overlay);
    if(typeof SharedFormsControls!=='undefined')SharedFormsControls.enhance(panel);
    overlay.addEventListener('click',event=>{if(event.target===overlay) closeTndsAdvanceDialog();});
    overlay.addEventListener('keydown',event=>{
      if(event.defaultPrevented)return;
      if(event.key==='Escape') {event.preventDefault();closeTndsAdvanceDialog();return;}
      if(event.key!=='Tab') return;
      const focusable=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(el=>el.getClientRects().length);
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
    });
    updateChoice();document.getElementById('tndsAdvance_city').focus();
  } catch(error) {collectionGuideReport(error);}
}
function closeTndsAdvanceDialog() {
  const overlay=document.getElementById('tndsAdvanceDialog');
  if(overlay) {
    if(typeof SharedFormsControls!=='undefined')SharedFormsControls.close();
    readTndsAdvanceDialog();const returnFocus=overlay._returnFocus;overlay.remove();
    if(returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus();
  }
}
function tndsAdvanceReplaceExact(doc,source,value) {
  const nodes=collectionGuideDesc(doc,'t').filter(node=>node.textContent===source);
  if(nodes.length!==1) throw new Error('Không tìm thấy vị trí '+source+' trong mẫu thông báo.');
  nodes[0].textContent=value;nodes[0].setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
}
function buildTndsAdvanceWordXml(snapshot) {
  const assets=tndsAdvanceAssets(),doc=collectionGuideParse(assets.documentXml),{meta,claim}=snapshot,parts=meta.date.split('-');
  // Edit template literals before inserting claim values that may match them.
  tndsAdvanceReplaceExact(doc,'Hà Nội',meta.city);
  tndsAdvanceReplaceExact(doc,'CÔNG TY TNHH BẢO HIỂM TASCO',collectionGuideBranchName);
  const branchParagraph=collectionGuideDesc(doc,'p').find(p=>collectionGuideDesc(p,'t').map(t=>t.textContent).join('')===collectionGuideBranchName);
  collectionGuideSetBranchText(branchParagraph);
  tndsAdvanceReplaceExact(doc,'BAN GIÁM ĐỊNH BỒI THƯỜNG','');
  tndsAdvanceReplaceExact(doc,'GĐ.CAO CẤP',collectionGuideSignerTitle(meta.signerTitle));
  tndsAdvanceReplaceExact(doc,'NGUYỄN ĐỨC CÔNG',meta.signerName.toLocaleUpperCase('vi'));
  const phoneNodes=collectionGuideDesc(doc,'t').filter(node=>node.textContent.includes('19001562'));
  if(phoneNodes.length!==1) throw new Error('Không tìm thấy số điện thoại trong mẫu thông báo.');
  phoneNodes[0].textContent=phoneNodes[0].textContent.replace('19001562',meta.hotline);
  const boxes=collectionGuideDesc(doc,'t').filter(node=>node.textContent.includes('☐'));
  if(boxes.length!==4) throw new Error('Các phương án tạm ứng trong mẫu không hợp lệ.');
  const codes=['70','50','30','10'];
  boxes.forEach((node,index)=>{if(meta.option===codes[index]) node.textContent=node.textContent.replace('☐','☒');});
  collectionGuidePopulateFields(doc,{
    'Số_hồ_sơ_bồi_thường':claim.number,'Ngày_HS':Number(parts[2]),'Tháng_HS':Number(parts[1]),'Năm_HS':parts[0],
    'Khách_hàng':claim.customer,'Ngày_tổn_thất_rút_gọn':claim.lossDate,'Địa_điểm_tổn_thất':claim.location,
    'Biển_xesố_khungsố_máy':claim.vehicle,'GĐV_HO':meta.assessor
  });
  return doc;
}
function buildTndsAdvanceWord(snapshot) {
  const doc=buildTndsAdvanceWordXml(snapshot);
  const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+new XMLSerializer().serializeToString(doc.documentElement);
  return collectionGuideZip({'word/document.xml':new TextEncoder().encode(xml)},tndsAdvanceAssets().zipUrl);
}
function tndsAdvanceFilename(claim) {
  return ('TB_Tam_ung_TNDS_'+(claim.number || claim.plate)).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,180)+'.docx';
}
async function exportTndsAdvanceWord(savedSnapshot) {
  if(tndsAdvanceBusy) return;
  const driveContext=typeof ClaimDocuments !== 'undefined' ? ClaimDocuments.capture() : null;
  tndsAdvanceBusy=true;const button=document.getElementById('tndsAdvanceExportButton');if(button) button.disabled=true;
  try {
    if(!savedSnapshot){const draft=collectionGuideDraft;await collectionGuidePrepareContact();if(draft && collectionGuideDraft!==draft)return;}
    const snapshot=savedSnapshot || tndsAdvanceSnapshot(),blob=await buildTndsAdvanceWord(snapshot),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=tndsAdvanceFilename(snapshot.claim);document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);closeTndsAdvanceDialog();
    if(typeof triggerToast==='function') triggerToast('Đã xuất thông báo tạm ứng TNDS.','success');
    if(driveContext) await ClaimDocuments.saveWord(blob,tndsAdvanceFilename(snapshot.claim),driveContext);
  } catch(error) {collectionGuideReport(error);}
  finally {tndsAdvanceBusy=false;if(button?.isConnected) button.disabled=false;}
}

// The preview reads the populated XML used by the Word export.
function tndsAdvanceParagraphHtml(p,counters,assets=tndsAdvanceAssets()) {
  const props=collectionGuideChildren(p,'pPr')[0];
  const property=name=>props && collectionGuideChildren(props,name)[0];
  const align=collectionGuideAttr(property('jc'),'val'),spacing=property('spacing'),indent=property('ind');
  const num=property('numPr'),numId=collectionGuideAttr(num && collectionGuideChildren(num,'numId')[0],'val');
  const level=collectionGuideAttr(num && collectionGuideChildren(num,'ilvl')[0],'val') || '0';
  const numbering=assets.numbering[numId+':'+level];
  let left=numbering?.left || 0,hanging=numbering?.hanging || 0,firstLine=0;
  if(indent) {
    if(collectionGuideAttr(indent,'left')!=='') left=Number(collectionGuideAttr(indent,'left'));
    if(collectionGuideAttr(indent,'hanging')!=='') hanging=Number(collectionGuideAttr(indent,'hanging'));
    firstLine=Number(collectionGuideAttr(indent,'firstLine')) || 0;
  }
  const styles=[`text-align:${align==='both'?'justify':['center','right'].includes(align)?align:'left'}`,
    `margin:${Number(collectionGuideAttr(spacing,'before'))/20 || 0}pt ${Number(collectionGuideAttr(indent,'right'))/20 || 0}pt ${Number(collectionGuideAttr(spacing,'after'))/20 || 0}pt ${left/20}pt`,
    `text-indent:${(firstLine-hanging)/20}pt`];
  const line=Number(collectionGuideAttr(spacing,'line')),lineRule=collectionGuideAttr(spacing,'lineRule');
  if(line) styles.push('line-height:'+(lineRule==='auto'?line/240:line/20+'pt'));
  const mark=property('rPr'),emptySize=collectionGuideAttr(mark && collectionGuideChildren(mark,'sz')[0],'val');
  let html='';
  if(numbering) {
    const key=numId+':'+level,count=(counters[key] ?? numbering.start-1)+1;counters[key]=count;
    const label=numbering.format==='bullet'?numbering.text:numbering.text.replace(/%\d+/g,numbering.format==='lowerLetter'?String.fromCharCode(96+count):String(count));
    html+='<span class="tnds-list-marker">'+collectionGuideEscape(label)+'</span>';
  }
  for(const run of collectionGuideChildren(p,'r')) {
    const rp=collectionGuideChildren(run,'rPr')[0],runProp=name=>rp && collectionGuideChildren(rp,name)[0],rs=[];
    const enabled=name=>{const node=runProp(name);return node && !['0','false','off'].includes(collectionGuideAttr(node,'val'));};
    if(enabled('b')) rs.push('font-weight:bold');if(enabled('i')) rs.push('font-style:italic');
    const underline=runProp('u');if(underline && collectionGuideAttr(underline,'val')!=='none') rs.push('text-decoration:underline');
    const size=Number(collectionGuideAttr(runProp('sz'),'val'));if(size) rs.push(`font-size:${size/2}pt`);
    const characterSpacing=collectionGuideAttr(runProp('spacing'),'val');if(characterSpacing) rs.push(`letter-spacing:${Number(characterSpacing)/20}pt`);
    const color=collectionGuideAttr(runProp('color'),'val');if(/^[\da-f]{6}$/i.test(color)) rs.push('color:#'+color);
    const font=collectionGuideAttr(runProp('rFonts'),'ascii');if(font==='Segoe UI Symbol') rs.push('font-family:"Segoe UI Symbol",sans-serif');
    const text=[...run.children].map(node=>{
      if(node.namespaceURI!==collectionGuideW) return '';
      if(node.localName==='t') return collectionGuideEscape(node.textContent);
      if(node.localName==='br') return '<br>';
      if(node.localName==='tab') return '<span class="tnds-tab"></span>';
      if(node.localName==='drawing') return `<img class="tnds-logo" alt="Tasco Insurance" src="${TascoAssets.url(assets.logoUrl)}">`;
      return '';
    }).join('');
    if(text) html+=`<span style="${rs.join(';')}">${text}</span>`;
  }
  const text=collectionGuideDesc(p,'t').map(node=>node.textContent).join('');
  if(!html && emptySize) styles.push(`font-size:${Number(emptySize)/2}pt`);
  const keepNext=property('keepNext') || /^\d+\.\s/.test(text);
  return `<p${keepNext?' class="tnds-keep-next"':''} style="${styles.join(';')}">${html || '&nbsp;'}</p>`;
}
function tndsAdvanceTableHtml(table,index,counters,assets=tndsAdvanceAssets()) {
  const props=collectionGuideChildren(table,'tblPr')[0],width=collectionGuideChildren(props,'tblW')[0],indent=collectionGuideChildren(props,'tblInd')[0];
  const grid=collectionGuideChildren(collectionGuideChildren(table,'tblGrid')[0],'gridCol').map(node=>Number(collectionGuideAttr(node,'w')));
  const total=grid.reduce((sum,value)=>sum+value,0);
  const styles=[`width:${(Number(collectionGuideAttr(width,'w')) || total)/20}pt`,`margin-left:${Number(collectionGuideAttr(indent,'w'))/20 || 0}pt`];
  let html=`<table class="tnds-${index===0?'letterhead':'signature'}" style="${styles.join(';')}"><colgroup>${grid.map(value=>`<col style="width:${value/total*100}%">`).join('')}</colgroup><tbody>`;
  for(const row of collectionGuideChildren(table,'tr')) {
    html+='<tr>';
    for(const cell of collectionGuideChildren(row,'tc')) {
      const cellProps=collectionGuideChildren(cell,'tcPr')[0],span=collectionGuideAttr(cellProps && collectionGuideChildren(cellProps,'gridSpan')[0],'val');
      html+=`<td${span?' colspan="'+Number(span)+'"':''}>${collectionGuideChildren(cell,'p').map(p=>tndsAdvanceParagraphHtml(p,counters,assets)).join('')}</td>`;
    }
    html+='</tr>';
  }
  return html+'</tbody></table>';
}
function tndsAdvancePageStyles() {
  return `
    @page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#000;background:#fff}
    body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.15}
    .tnds-page{position:relative;width:210mm;height:297mm;padding:15mm 20mm 20mm 25mm;break-after:page;page-break-after:always;break-inside:avoid}
    .tnds-page:last-child{break-after:auto;page-break-after:auto}.tnds-page-content{display:flow-root;width:165mm}
    p{overflow-wrap:anywhere;white-space:pre-wrap;orphans:2;widows:2}.tnds-keep-next{break-after:avoid}
    table{border-collapse:collapse;table-layout:fixed;break-inside:avoid}td{padding:0 1.5pt;vertical-align:top;border:0}
    .tnds-logo{display:inline-block;width:45.367mm;height:18.312mm;object-fit:contain;vertical-align:top}
    .tnds-list-marker{display:inline-block;min-width:18pt;text-indent:0;white-space:normal}.tnds-tab{display:inline-block;width:12pt}
    .tnds-signature p{white-space:normal}.tnds-signature{margin-top:0}
    .tnds-footer{position:absolute;left:25mm;right:20mm;bottom:5mm;font-size:10pt;color:#999;font-style:italic}
    .tnds-footer p{white-space:normal}
    @media screen{
      html{background:radial-gradient(circle at 20% 0,rgba(216,180,109,.10),transparent 38%),#111923}
      html.light-mode{background:radial-gradient(circle at 20% 0,rgba(179,140,67,.10),transparent 42%),#eae8e1}
      body{background:transparent;padding:28px 24px}.tnds-page{background:#fff;margin:0 auto 28px;border:1px solid rgba(216,180,109,.30);box-shadow:0 24px 70px rgba(0,0,0,.38),0 2px 8px rgba(0,0,0,.14)}
      html.light-mode .tnds-page{box-shadow:0 24px 64px rgba(31,39,51,.20),0 2px 8px rgba(31,39,51,.10)}
    }`;
}
function tndsAdvancePaginate(content,footer,styles) {
  const frame=document.createElement('iframe');frame.title='Đo bố cục thông báo';frame.style.cssText='position:fixed;left:-12000px;top:0;width:210mm;height:297mm;border:0;visibility:hidden;';document.body.append(frame);
  try {
    const doc=frame.contentDocument;doc.open();doc.write('<!DOCTYPE html><html><head><style>'+styles+'body{padding:0}.tnds-page{margin:0;border:0;box-shadow:none}</style></head><body></body></html>');doc.close();
    const source=doc.createElement('div');source.innerHTML=content;const nodes=[...source.children],pages=[];let current,wrapper;
    const nextPage=()=>{wrapper=doc.createElement('section');wrapper.className='tnds-page';current=doc.createElement('div');current.className='tnds-page-content';wrapper.append(current);doc.body.append(wrapper);pages.push(current);};
    const overflow=()=>current.getBoundingClientRect().bottom>wrapper.getBoundingClientRect().bottom-20*96/25.4+.5;
    nextPage();
    for(let index=0;index<nodes.length;index++) {
      const group=[nodes[index]];
      while(group[group.length-1].classList.contains('tnds-keep-next') && index+1<nodes.length) group.push(nodes[++index]);
      current.append(...group);
      if(overflow()) {
        group.forEach(node=>node.remove());
        if(current.children.length) nextPage();current.append(...group);
        if(overflow()) throw new Error('Nội dung thông báo quá dài để vừa trang A4. Vui lòng rút gọn thông tin đã nhập.');
      }
    }
    return pages.filter(page=>page.children.length).map(page=>`<section class="tnds-page"><div class="tnds-page-content">${page.innerHTML}</div><footer class="tnds-footer">${footer}</footer></section>`).join('');
  } finally {frame.remove();}
}
function buildTndsAdvancePrintHtml(snapshot) {
  const doc=buildTndsAdvanceWordXml(snapshot),body=doc.getElementsByTagNameNS(collectionGuideW,'body')[0],counters={};let index=0;
  const content=[...body.children].map(node=>node.localName==='p'?tndsAdvanceParagraphHtml(node,counters):node.localName==='tbl'?tndsAdvanceTableHtml(node,index++,counters):'').join('');
  const footerDoc=collectionGuideParse(tndsAdvanceAssets().footerXml);
  const footer=collectionGuideChildren(footerDoc.documentElement,'p').filter(p=>collectionGuideDesc(p,'t').some(node=>node.textContent.trim())).map(p=>tndsAdvanceParagraphHtml(p,{})).join('');
  const styles=tndsAdvancePageStyles(),theme=document.body.classList.contains('light-mode')?'light-mode':'dark-mode';
  return `<!DOCTYPE html><html lang="vi" class="${theme}"><head><meta charset="UTF-8"><title>${collectionGuideEscape('Thông báo tạm ứng TNDS - '+snapshot.claim.plate)}</title><style>${styles}</style></head><body>${tndsAdvancePaginate(content,footer,styles)}</body></html>`;
}
async function previewTndsAdvance() {
  try {
    const draft=collectionGuideDraft;await collectionGuidePrepareContact();if(draft && collectionGuideDraft!==draft)return;
    const snapshot=tndsAdvanceSnapshot(),html=buildTndsAdvancePrintHtml(snapshot),title='Thông báo tạm ứng TNDS';
    openCollectionDocumentPreview({title,html,claim:snapshot.claim,onExport:()=>exportTndsAdvanceWord(snapshot),onPrint:()=>printCollectionDocumentHtml(html,title),
      onEdit:()=>{closeCollectionGuidePreview();openTndsAdvanceDialog();}});
  } catch(error) {
    if(!document.getElementById('tndsAdvanceDialog')) openTndsAdvanceDialog();
    collectionGuideReport(error);
  }
}
