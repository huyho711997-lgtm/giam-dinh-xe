
/* Collection guide: retained Tasco template, offline DOCX packaging and A4 print. */
const collectionGuideW = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
let collectionGuideAssetsCache = null;
let collectionGuideDraft = null;
let collectionGuideBusy = false;
let collectionGuideView = {group:'all', query:'', filter:'all'};
let collectionGuideRows = new Map();
let collectionGuideUndoSelection = null;
const collectionGuideGroupLabels = {all:'Tất cả giấy tờ', common:'Thông báo tai nạn', I:'Giấy tờ xe', II:'Hồ sơ Công an', III:'Chứng từ y tế', IV:'Tài sản / bên thứ ba', V:'Hàng hóa', VI:'Giấy tờ khác', extra:'Bổ sung khác'};
const collectionGuideBranchName = 'CÔNG TY TNHH BẢO HIỂM TASCO CHI NHÁNH ĐẮK LẮK';
function collectionGuideSignerTitle(value) {
  const title=String(value || '').toLocaleUpperCase('vi');
  return ['GIÁM ĐỐC CAO CẤP','GĐ.CAO CẤP'].includes(title)?'':title;
}
function collectionGuideSetBranchText(paragraph) {
  collectionGuideSetText(paragraph,collectionGuideBranchName);
  const text=collectionGuideDesc(paragraph,'t')[0],doc=paragraph.ownerDocument;
  text.textContent='CÔNG TY TNHH BẢO HIỂM TASCO';
  const lineBreak=doc.createElementNS(collectionGuideW,'w:br'),branch=doc.createElementNS(collectionGuideW,'w:t');
  branch.textContent=' CHI NHÁNH ĐẮK LẮK';branch.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
  text.parentNode.insertBefore(lineBreak,text.nextSibling);text.parentNode.insertBefore(branch,lineBreak.nextSibling);
}
const collectionGuideMetaFields = [
  ['city','Nơi lập hướng dẫn','text'], ['date','Ngày lập hướng dẫn','date'],
  ['assessor','Giám định viên / người liên hệ','text'], ['recipient','Đơn vị nhận hồ sơ','text'],
  ['address','Địa chỉ nhận hồ sơ','text'], ['hotline','Số điện thoại giám định viên','tel'],
  ['signerTitle','Chức danh người ký','text'], ['signerName','Họ tên người ký (nếu có)','text']
];
function collectionGuideAssets() {
  return collectionGuideAssetsCache || (collectionGuideAssetsCache = COLLECTION_GUIDE_TEMPLATE);
}
function collectionGuideValue(id) { return String(document.getElementById(id)?.value || '').trim(); }
function collectionGuideToday() {
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const p = type => parts.find(part => part.type === type).value;
  return `${p('year')}-${p('month')}-${p('day')}`;
}
function collectionGuideDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value ? value : '';
}
function collectionGuideDisplayDate(value) {
  return collectionGuideDate(value) ? value.split('-').reverse().join('/') : '';
}
function initializeCollectionGuide(item = {}) {
  const saved = item.huongDanThuThapHoSo;
  const valid = saved && typeof saved === 'object' && saved.version === 1;
  const defaults = {
    city: collectionGuideValue('modalPendingTinhTonThat'), date: collectionGuideToday(),
    assessor: collectionGuideValue('modalPendingCanBoXuLy') || collectionGuideValue('modalPendingGdvTiepNhan'),
    recipient: 'Công ty TNHH Bảo hiểm Tasco',
    address: collectionGuideBranchAddress,
    hotline: collectionGuideFindAssessorPhone(collectionGuideValue('modalPendingCanBoXuLy') || collectionGuideValue('modalPendingGdvTiepNhan')).phone, signerTitle: '', signerName: ''
  };
  document.getElementById('tndsAdvanceDialog')?.remove();
  collectionGuideDraft = {version:1, meta:{}, items:{}, extras:[],authorityRequest:valid && saved.authorityRequest && typeof saved.authorityRequest==='object'?JSON.parse(JSON.stringify(saved.authorityRequest)):null,tndsAdvance:valid && saved.tndsAdvance && typeof saved.tndsAdvance==='object'?JSON.parse(JSON.stringify(saved.tndsAdvance)):null};
  collectionGuideDraft.contactPhoneManual=valid && saved.contactPhoneManual===true;
  for (const [key] of collectionGuideMetaFields) {
    const raw = valid && typeof saved.meta?.[key] === 'string' ? saved.meta[key] : defaults[key];
    collectionGuideDraft.meta[key] = key === 'date' ? collectionGuideDate(raw) : key === 'signerTitle' ? collectionGuideSignerTitle(raw).slice(0,1000) : String(raw || '').slice(0,1000);
  }
  if(collectionGuideDraft.meta.address===collectionGuidePreviousAddress)collectionGuideDraft.meta.address=collectionGuideBranchAddress;
  collectionGuideSyncContactPhone();
  void collectionGuidePrepareContact();
  for (const group of collectionGuideAssets().groups) for (const item of group.items) {
    const state = valid ? saved.items?.[item.id] : null;
    collectionGuideDraft.items[item.id] = {selected: state?.selected === true, status: state?.status === 'have' ? 'have' : 'missing', date: collectionGuideDate(state?.date)};
  }
  for (let i=0; i<2; i++) {
    const state = valid ? saved.extras?.[i] : null;
    collectionGuideDraft.extras.push({text:String(state?.text || '').slice(0,2000),selected:state?.selected === true,status:state?.status === 'have' ? 'have' : 'missing',date:collectionGuideDate(state?.date)});
  }
  collectionGuideView = {group:'all', query:'', filter:'all'};
  collectionGuideUndoSelection = null;
  const settings=document.getElementById('collectionGuideSettings');if(settings) settings.open=false;
  document.querySelectorAll('.collection-guide-mobile-bulk').forEach(menu=>menu.open=false);
  renderCollectionGuide();
  if(typeof initializeAuthorityRequest==='function')initializeAuthorityRequest();
}
function ensureCollectionGuide() { if (!collectionGuideDraft) initializeCollectionGuide(); }
function collectionGuideElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function renderCollectionGuide() {
  const meta = document.getElementById('collectionGuideMeta'), list = document.getElementById('collectionGuideChecklist');
  if (!meta || !list) return;
  meta.replaceChildren(); list.replaceChildren(); collectionGuideRows=new Map();
  const search=document.getElementById('collectionGuideSearch');if(search) search.value='';
  for (const [key,label,type] of collectionGuideMetaFields) {
    const wrap = collectionGuideElement('div'), caption = collectionGuideElement('label','',label), input = collectionGuideElement('input','input-premium');
    input.id = `collectionGuideMeta_${key}`; input.type = type; input.value = collectionGuideDraft.meta[key]; input.maxLength = 1000;
    caption.htmlFor = input.id;
    if (key === 'signerName') input.placeholder = 'Để trống nếu chưa xác định người ký';
    input.addEventListener('input', () => {collectionGuideDraft.meta[key] = type === 'date' ? collectionGuideDate(input.value) : input.value;refreshCollectionGuideMetaSummary();});
    wrap.append(caption,input); meta.append(wrap);
  }
  collectionGuideBindContactFields();
  for (const group of collectionGuideAssets().groups) {
    const block = collectionGuideElement('section','collection-guide-group'), head = collectionGuideElement('div','collection-guide-group-heading');block.dataset.group=group.id;
    head.append(collectionGuideElement('h4','',(group.id === 'common' ? '' : `${group.id}. `) + group.title));
    const btn=collectionGuideElement('button','','Chọn cả nhóm');btn.type='button';btn.dataset.groupSelect=group.id;
    btn.addEventListener('click',()=>{const states=group.items.map(item=>collectionGuideDraft.items[item.id]);setCollectionGuideSelection(group.id,!states.every(item=>item.selected));});head.append(btn);
    block.append(head);
    for (const item of group.items) block.append(collectionGuideRow(item.id,item.text,collectionGuideDraft.items[item.id],undefined,group.id));
    list.append(block);
  }
  const extra = collectionGuideElement('section','collection-guide-group'), head = collectionGuideElement('div','collection-guide-group-heading');
  extra.dataset.group='extra';head.append(collectionGuideElement('h4','','Giấy tờ bổ sung khác (2 dòng trống của mẫu)')); extra.append(head);
  collectionGuideDraft.extras.forEach((state,i)=>extra.append(collectionGuideRow(`extra-${i}`,`Giấy tờ bổ sung ${i+1}`,state,i,'extra')));
  list.append(extra);renderCollectionGuideNavigation();clearCollectionGuideUndo();refreshCollectionGuideSummary();refreshCollectionGuideMetaSummary();updateCollectionGuideCount();
}
function collectionGuideShortTitle(text) {
  if(text.startsWith('Thông báo tai nạn và yêu cầu bồi thường')) return 'Thông báo tai nạn và yêu cầu bồi thường';
  return text.match(/^(.*?)\s*\(/)?.[1]?.trim() || text;
}
function collectionGuideStatusIcon(value) {
  const ns='http://www.w3.org/2000/svg',icon=document.createElementNS(ns,'svg'),circle=document.createElementNS(ns,'circle'),path=document.createElementNS(ns,'path');
  icon.setAttribute('viewBox','0 0 20 20');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.75');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');icon.setAttribute('aria-hidden','true');icon.classList.add('collection-guide-status-icon');
  circle.setAttribute('cx','10');circle.setAttribute('cy','10');circle.setAttribute('r','8');
  path.setAttribute('d',value==='have'?'m6.5 10 2.4 2.5 4.7-5':'M10 6.5v4M10 13.5h.01');icon.append(circle,path);return icon;
}
function collectionGuideRow(id,text,state,extraIndex,groupId) {
  const row = collectionGuideElement('div','collection-guide-row'), checkLabel = collectionGuideElement('label','collection-guide-check');
  row.dataset.item=id;row.dataset.selected=String(state.selected);row.dataset.status=state.status;
  const check = collectionGuideElement('input'), caption = collectionGuideElement('span','collection-guide-check-copy');
  const short=collectionGuideShortTitle(text);caption.append(collectionGuideElement('span','collection-guide-check-title',short));
  if(short!==text) caption.append(collectionGuideElement('span','collection-guide-check-description',text.slice(short.length).trim()));
  const marker=collectionGuideElement('span','collection-guide-check-marker','Đã chọn');marker.hidden=!state.selected;
  check.type='checkbox'; check.id=`collectionGuideCheck_${id}`; check.checked=state.selected;
  checkLabel.htmlFor=check.id;checkLabel.title=text;checkLabel.append(check,caption,marker);row.append(checkLabel);
  if (extraIndex !== undefined) {
    const input=collectionGuideElement('input','input-premium collection-guide-custom-text');
    input.id=`collectionGuideText_${id}`; input.type='text'; input.value=state.text; input.maxLength=2000; input.placeholder='Nhập tên chứng từ cần bổ sung';
    input.setAttribute('aria-label',text);const editor=collectionGuideElement('div','collection-guide-custom-editor');editor.append(input);row.append(editor);
    input.addEventListener('input',()=>{state.text=input.value;updateCollectionGuideCount();});
  }
  const controls=collectionGuideElement('div','collection-guide-row-controls'),status=collectionGuideElement('div','collection-guide-status'),statusButtons=[];
  controls.hidden=!state.selected;status.dataset.state=state.status;status.setAttribute('role','group');status.setAttribute('aria-label','Tình trạng: '+short);
  for(const [value,name] of [['missing','Thiếu'],['have','Đã có']]) {
    const button=collectionGuideElement('button');button.type='button';button.id=`collectionGuide_status_${id}_${value}`;button.dataset.status=value;
    button.append(collectionGuideStatusIcon(value),collectionGuideElement('span','',name));button.title=value==='have'?'Đánh dấu giấy tờ đã có':'Đánh dấu giấy tờ còn thiếu';
    button.setAttribute('aria-pressed',String(state.status===value));button.disabled=!state.selected;
    button.addEventListener('click',()=>{state.status=value;clearCollectionGuideUndo();updateCollectionGuideCount();});status.append(button);statusButtons.push(button);
  }
  const dateWrap=collectionGuideElement('div','collection-guide-control'),dateLabel=collectionGuideElement('label','','Ngày bổ sung'),date=collectionGuideElement('input','input-premium');
  date.id=`collectionGuide_date_${id}`;date.type='date';date.value=state.date;date.disabled=!state.selected;dateLabel.htmlFor=date.id;date.title='Ngày bổ sung (không bắt buộc)';
  date.addEventListener('change',()=>{state.date=collectionGuideDate(date.value);updateCollectionGuideCount();});dateWrap.append(dateLabel,date);controls.append(status,dateWrap);row.append(controls);
  collectionGuideRows.set(id,{id,groupId,text,state,row,check,marker,controls,status,statusButtons,date});
  check.addEventListener('change',()=>{state.selected=check.checked;clearCollectionGuideUndo();updateCollectionGuideCount();});
  row.addEventListener('click',event=>{if(!event.target.closest('label,input,button,.collection-guide-row-controls,.collection-guide-custom-editor')) check.click();});
  return row;
}
function renderCollectionGuideNavigation() {
  const nav=document.getElementById('collectionGuideGroups');if(!nav) return;nav.replaceChildren();
  for(const id of ['all',...collectionGuideAssets().groups.map(group=>group.id),'extra']) {
    const button=collectionGuideElement('button','collection-guide-group-link');button.type='button';button.dataset.group=id;button.setAttribute('aria-pressed','false');
    button.append(collectionGuideElement('span','collection-guide-group-number',id==='all'?'≡':id==='common'?'!':id==='extra'?'+':id),collectionGuideElement('span','collection-guide-group-title',collectionGuideGroupLabels[id]),collectionGuideElement('span','collection-guide-group-badge'));
    button.addEventListener('click',()=>{collectionGuideView.group=id;collectionGuideView.query='';collectionGuideView.filter='all';const search=document.getElementById('collectionGuideSearch');if(search) search.value='';applyCollectionGuideFilters(true);});nav.append(button);
  }
}
function refreshCollectionGuideMetaSummary() {
  const el=document.getElementById('collectionGuideMetaSummary');if(el && collectionGuideDraft) el.textContent=[collectionGuideDraft.meta.city,collectionGuideDisplayDate(collectionGuideDraft.meta.date),collectionGuideDraft.meta.assessor].filter(Boolean).join(' · ');
}
function updateCollectionGuideCount() {
  if (!collectionGuideDraft) return;
  const states=[...Object.values(collectionGuideDraft.items),...collectionGuideDraft.extras];
  const selected=states.filter(item=>item.selected), have=selected.filter(item=>item.status==='have').length;
  const el=document.getElementById('collectionGuideCount');
  if(el) el.textContent=`Đã chọn ${selected.length} giấy tờ · Thiếu ${selected.length-have} · Đã có ${have}`;
  for(const record of collectionGuideRows.values()) {
    const {state,row,check,controls,marker,status,statusButtons,date}=record;check.checked=state.selected;row.dataset.selected=String(state.selected);row.dataset.status=state.status;status.dataset.state=state.status;controls.hidden=!state.selected;marker.hidden=!state.selected;date.disabled=!state.selected;
    statusButtons.forEach(button=>{button.disabled=!state.selected;button.setAttribute('aria-pressed',String(state.status===button.dataset.status));});
  }
  for(const button of document.querySelectorAll('#collectionGuideGroups > button')) {
    const group=button.dataset.group,records=[...collectionGuideRows.values()].filter(record=>group==='all'||record.groupId===group),count=records.filter(record=>record.state.selected).length;
    button.querySelector('.collection-guide-group-badge').textContent=`${count}/${records.length}`;button.dataset.hasSelection=String(count>0);button.title=`${collectionGuideGroupLabels[group]}: đã chọn ${count}/${records.length}`;
  }
  for(const button of document.querySelectorAll('[data-group-select]')) {
    const records=[...collectionGuideRows.values()].filter(record=>record.groupId===button.dataset.groupSelect),all=records.every(record=>record.state.selected);
    button.textContent=all?'Bỏ chọn nhóm':'Chọn cả nhóm';button.setAttribute('aria-label',`${all?'Bỏ chọn':'Chọn'} cả nhóm ${collectionGuideGroupLabels[button.dataset.groupSelect]}`);
  }
  for(const [id,text] of [['collectionGuideSelectionTotal',String(selected.length)],['collectionGuideFilterCount',String(selected.length)],['collectionGuideMissingCount',`Thiếu ${selected.length-have}`],['collectionGuideHaveCount',`Đã có ${have}`]]) {const node=document.getElementById(id);if(node) node.textContent=text;}
  renderCollectionGuideSelectedList();applyCollectionGuideFilters();
  scheduleCollectionGuideAutoSave();
}
function renderCollectionGuideSelectedList() {
  const list=document.getElementById('collectionGuideSelectedList');if(!list) return;list.replaceChildren();
  const selected=[...collectionGuideRows.values()].filter(record=>record.state.selected);
  if(!selected.length) {list.append(collectionGuideElement('p','collection-guide-selected-placeholder','Chưa chọn giấy tờ.\nChọn thẻ ở danh sách bên cạnh để bắt đầu.'));return;}
  for(const record of selected) {
    const text=record.state.text?.trim() || collectionGuideShortTitle(record.text),wrap=collectionGuideElement('div','collection-guide-selected-item'),go=collectionGuideElement('button','collection-guide-selected-title');go.type='button';go.title=text;
    const badge=collectionGuideElement('small','collection-guide-selected-status');badge.dataset.status=record.state.status;
    badge.append(collectionGuideStatusIcon(record.state.status),collectionGuideElement('span','',(record.state.status==='have'?'Đã có':'Thiếu')+(record.state.date?' · '+collectionGuideDisplayDate(record.state.date):'')));
    go.append(collectionGuideElement('span','',text),badge);
    go.addEventListener('click',()=>focusCollectionGuideItem(record.id));
    const remove=collectionGuideElement('button','collection-guide-selected-remove','×');remove.type='button';remove.setAttribute('aria-label','Bỏ chọn '+text);
    remove.addEventListener('click',()=>{record.state.selected=false;clearCollectionGuideUndo();updateCollectionGuideCount();document.getElementById('collectionGuideFilter_selected')?.focus({preventScroll:true});});wrap.append(go,remove);list.append(wrap);
  }
}
function collectionGuideNormalize(value) { return String(value||'').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d'); }
function applyCollectionGuideFilters(resetScroll=false) {
  const active=document.activeElement,query=collectionGuideNormalize(collectionGuideView.query.trim()),tokens=query.split(/\s+/).filter(Boolean);let visible=0;
  for(const record of collectionGuideRows.values()) {
    const haystack=collectionGuideNormalize(record.text+' '+(record.state.text||''));
    const matches=(collectionGuideView.group==='all'||record.groupId===collectionGuideView.group) && (collectionGuideView.filter==='all'||(collectionGuideView.filter==='selected'?record.state.selected:!record.state.selected)) && tokens.every(token=>haystack.includes(token));
    record.row.hidden=!matches;if(matches) visible++;
  }
  for(const block of document.querySelectorAll('#collectionGuideChecklist > .collection-guide-group')) block.hidden=![...block.querySelectorAll('.collection-guide-row')].some(row=>!row.hidden);
  for(const button of document.querySelectorAll('#collectionGuideGroups > button')) button.setAttribute('aria-pressed',String(button.dataset.group===collectionGuideView.group));
  for(const mode of ['all','selected','unselected']) document.getElementById('collectionGuideFilter_'+mode)?.setAttribute('aria-pressed',String(mode===collectionGuideView.filter));
  const result=document.getElementById('collectionGuideResults');if(result) result.textContent=`${collectionGuideGroupLabels[collectionGuideView.group]} · ${visible} mục hiển thị`;
  const empty=document.getElementById('collectionGuideEmpty');if(empty) empty.hidden=visible>0;
  const clear=document.getElementById('collectionGuideClearSearch');if(clear) clear.hidden=!collectionGuideView.query;
  const select=document.getElementById('collectionGuideSelectVisible');if(select) select.disabled=![...collectionGuideRows.values()].some(record=>!record.row.hidden&&!record.state.selected&&(record.groupId!=='extra'||record.state.text.trim()));
  const scroll=document.querySelector('.collection-guide-list-scroll');if(resetScroll && scroll) scroll.scrollTop=0;
  if(active?.closest('.collection-guide-row')?.hidden) {
    const next=[...collectionGuideRows.values()].find(record=>!record.row.hidden);if(next) next.check.focus({preventScroll:true});else document.getElementById('collectionGuideFilter_all')?.focus({preventScroll:true});
  }
}
function setCollectionGuideSearch(value) {collectionGuideView.query=value;applyCollectionGuideFilters(true);}
function clearCollectionGuideSearch() {const input=document.getElementById('collectionGuideSearch');if(input) {input.value='';input.focus();}setCollectionGuideSearch('');}
function setCollectionGuideFilter(mode) {if(!['all','selected','unselected'].includes(mode)) return;collectionGuideView.filter=mode;if(mode==='selected') collectionGuideView.group='all';applyCollectionGuideFilters(true);}
function resetCollectionGuideFilters() {collectionGuideView={group:'all',query:'',filter:'all'};const input=document.getElementById('collectionGuideSearch');if(input) input.value='';applyCollectionGuideFilters(true);}
function focusCollectionGuideItem(id) {
  const record=collectionGuideRows.get(id);if(!record) return;collectionGuideView={group:record.groupId,query:'',filter:'all'};const input=document.getElementById('collectionGuideSearch');if(input) input.value='';applyCollectionGuideFilters();record.row.scrollIntoView({block:'nearest'});record.check.focus({preventScroll:true});
}
function rememberCollectionGuideSelection() {collectionGuideUndoSelection=[...collectionGuideRows.values()].map(record=>[record.id,record.state.selected]);const undo=document.getElementById('collectionGuideUndo');if(undo) undo.hidden=false;}
function clearCollectionGuideUndo() {collectionGuideUndoSelection=null;const undo=document.getElementById('collectionGuideUndo');if(undo) undo.hidden=true;}
function undoCollectionGuideSelection() {if(!collectionGuideUndoSelection) return;for(const [id,selected] of collectionGuideUndoSelection) {const record=collectionGuideRows.get(id);if(record) record.state.selected=selected;}clearCollectionGuideUndo();updateCollectionGuideCount();}
function selectVisibleCollectionGuideItems() {ensureCollectionGuide();rememberCollectionGuideSelection();for(const record of collectionGuideRows.values()) if(!record.row.hidden && (record.groupId!=='extra'||record.state.text.trim())) record.state.selected=true;updateCollectionGuideCount();}
function setCollectionGuideSelection(groupId,selected) {
  ensureCollectionGuide();
  rememberCollectionGuideSelection();
  for(const group of collectionGuideAssets().groups) if(groupId===null || group.id===groupId) for(const item of group.items) collectionGuideDraft.items[item.id].selected=selected;
  if(groupId===null) collectionGuideDraft.extras.forEach(item=>item.selected=selected && !!item.text.trim());
  updateCollectionGuideCount();
}
function getCollectionGuideState() {
  ensureCollectionGuide();
  // Read inputs as well as events so browser autofill/programmatic updates are included.
  for(const [key] of collectionGuideMetaFields) {
    const el=document.getElementById(`collectionGuideMeta_${key}`);
    if(el) collectionGuideDraft.meta[key]=key==='date'?collectionGuideDate(el.value):el.value.trim();
  }
  collectionGuideSyncContactPhone();
  if(collectionGuideDraft.authorityRequest && typeof authorityRequestMeta==='function')authorityRequestMeta();
  return JSON.parse(JSON.stringify(collectionGuideDraft));
}
function refreshCollectionGuideSummary() {
  const el=document.getElementById('collectionGuideSummary'); if(!el) return;
  el.textContent=`Số HSBT: ${collectionGuideValue('modalPendingSoHoSoBoiThuong') || 'Chưa nhập'} · Khách hàng: ${collectionGuideValue('modalPendingKhachHang') || 'Chưa nhập'} · Biển số: ${collectionGuideValue('modalPendingBienSo') || 'Chưa nhập'} · Ngày tổn thất: ${collectionGuideValue('modalPendingNgayVTT') || 'Chưa nhập'}`;
}
function collectionGuideSnapshot() {
  const state=getCollectionGuideState();
  const selected=Object.values(state.items).some(item=>item.selected) || state.extras.some(item=>item.selected && item.text.trim());
  if(!selected) throw new Error('Vui lòng chọn ít nhất một giấy tờ cần thu thập.');
  if(state.extras.some(item=>item.selected && !item.text.trim())) throw new Error('Vui lòng nhập tên giấy tờ bổ sung đã chọn.');
  const claim={number:collectionGuideValue('modalPendingSoHoSoBoiThuong'),customer:collectionGuideValue('modalPendingKhachHang'),plate:collectionGuideValue('modalPendingBienSo'),chassis:collectionGuideValue('modalPendingSoKhungSoMay'),lossDate:collectionGuideValue('modalPendingNgayVTT')};
  if(!claim.customer || !claim.plate) throw new Error('Vui lòng nhập tên khách hàng và biển số ở tab Hợp đồng & Khách hàng.');
  return {state:JSON.parse(JSON.stringify(state)),claim};
}
function collectionGuideBytes(base64) { return Uint8Array.from(atob(base64),c=>c.charCodeAt(0)); }
function collectionGuideParse(base64) {
  const doc=new DOMParser().parseFromString(new TextDecoder().decode(collectionGuideBytes(base64)),'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('Không thể đọc cấu trúc mẫu Word.');
  return doc;
}
function collectionGuideChildren(node,name) { return [...node.children].filter(el=>el.namespaceURI===collectionGuideW && el.localName===name); }
function collectionGuideDesc(node,name) { return [...node.getElementsByTagNameNS(collectionGuideW,name)]; }
function collectionGuideAttr(node,name) { return node?.getAttributeNS(collectionGuideW,name) || ''; }
function collectionGuideSetText(node,value) {
  const texts=collectionGuideDesc(node,'t');
  if(texts.length) { texts[0].textContent=String(value || ''); texts[0].setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve'); texts.slice(1).forEach(t=>t.textContent=''); }
  else {
    const doc=node.ownerDocument, p=node.localName==='p'?node:collectionGuideChildren(node,'p')[0];
    if(!p) throw new Error('Thiếu vị trí điền dữ liệu trong mẫu.');
    const run=doc.createElementNS(collectionGuideW,'w:r'),t=doc.createElementNS(collectionGuideW,'w:t');t.textContent=String(value||'');run.append(t);p.append(run);
  }
}
function collectionGuidePopulateFields(doc,values) {
  for(const p of collectionGuideDesc(doc,'p')) {
    let field=null;
    for(const run of collectionGuideChildren(p,'r')) {
      const chars=collectionGuideDesc(run,'fldChar');
      if(chars.some(c=>collectionGuideAttr(c,'fldCharType')==='begin')) field={runs:[],instruction:'',result:[],separated:false};
      if(!field) continue;
      field.runs.push(run); field.instruction+=collectionGuideDesc(run,'instrText').map(t=>t.textContent).join('');
      if(chars.some(c=>collectionGuideAttr(c,'fldCharType')==='separate')) field.separated=true;
      if(field.separated) field.result.push(...collectionGuideDesc(run,'t'));
      if(chars.some(c=>collectionGuideAttr(c,'fldCharType')==='end')) {
        const match=field.instruction.match(/MERGEFIELD\s+([^\s\\]+)/i),key=match?.[1];
        if(key && Object.prototype.hasOwnProperty.call(values,key)) {
          if(!field.result.length) throw new Error(`Thiếu vùng dữ liệu ${key} trong mẫu.`);
          field.result[0].textContent=String(values[key] || ''); field.result[0].setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
          field.result.slice(1).forEach(t=>t.textContent='');
          field.runs.forEach(r=>[...collectionGuideDesc(r,'instrText'),...collectionGuideDesc(r,'fldChar')].forEach(el=>el.remove()));
        }
        field=null;
      }
    }
  }
}
function buildCollectionGuideWordXml(snapshot) {
  const assets=collectionGuideAssets(),doc=collectionGuideParse(assets.documentXml),body=doc.getElementsByTagNameNS(collectionGuideW,'body')[0],blocks=[...body.children];
  const {state,claim}=snapshot,parts=collectionGuideDate(state.meta.date)?state.meta.date.split('-'):['','',''];
  let vehicle=claim.plate;
  if(claim.chassis && claim.chassis.toLocaleUpperCase('vi')!==claim.plate.toLocaleUpperCase('vi')) vehicle+=' / '+claim.chassis;
  const loss=claim.lossDate.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] || claim.lossDate.match(/^\d{4}-\d{2}-\d{2}/)?.[0]?.split('-').reverse().join('/') || claim.lossDate;
  collectionGuidePopulateFields(doc,{'Số_hồ_sơ_bồi_thường':claim.number,'Ngày_HS':parts[2]?Number(parts[2]):'','Tháng_HS':parts[1]?Number(parts[1]):'','Năm_HS':parts[0],'Khách_hàng':claim.customer,'Biển_xesố_khungsố_máy':vehicle,'Ngày_tổn_thất':loss,'GĐV_HO':state.meta.assessor});
  // These editable slots retain their existing paragraph/run formatting.
  collectionGuideSetText(blocks[4],(state.meta.city ? state.meta.city+', ' : '')+(parts[0]?`ngày ${Number(parts[2])} tháng ${Number(parts[1])} năm ${parts[0]}.`:'Ngày lập: ................................'));
  collectionGuideSetText(blocks[16],'Người nhận: '+state.meta.recipient+'.');
  collectionGuideSetText(blocks[18],'Địa chỉ: '+state.meta.address+'.');
  collectionGuideSetText(blocks[19],'Điện thoại giám định viên: '+(state.meta.hotline || 'Chưa cập nhật'));
  const rows=collectionGuideChildren(blocks[14],'tr');
  const fillRow=(row,state)=>{
    const cells=collectionGuideChildren(row,'tc');
    for(let i=2;i<5;i++) collectionGuideSetText(cells[i],'');
    if(state?.selected) {collectionGuideSetText(cells[state.status==='have'?2:3],'X');collectionGuideSetText(cells[4],collectionGuideDisplayDate(state.date));}
  };
  for(const group of assets.groups) for(const item of group.items) fillRow(rows[item.row],state.items[item.id]);
  state.extras.forEach((extra,i)=>{const cells=collectionGuideChildren(rows[42+i],'tc');collectionGuideSetText(cells[0],extra.selected?String(i+1):'');collectionGuideSetText(cells[1],extra.selected?extra.text:'');fillRow(rows[42+i],extra);});
  const signature=collectionGuideChildren(collectionGuideChildren(blocks[22],'tr')[0],'tc')[1],paras=collectionGuideChildren(signature,'p');
  collectionGuideSetBranchText(paras[0]);
  collectionGuideSetText(paras[1],collectionGuideSignerTitle(state.meta.signerTitle));
  collectionGuideSetText(paras[paras.length-1],state.meta.signerName.toLocaleUpperCase('vi'));
  return doc;
}
function collectionGuideCRC(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes) {crc^=byte;for(let b=0;b<8;b++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
async function collectionGuideZip(replacements,templateUrl) {
  const original=await TascoAssets.binary(templateUrl || collectionGuideAssets().zipUrl),view=new DataView(original.buffer);
  let end=-1;for(let i=original.length-22;i>=Math.max(0,original.length-65557);i--) if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0) throw new Error('Mẫu Word không hợp lệ.');
  const count=view.getUint16(end+10,true);let cursor=view.getUint32(end+16,true),offset=0;const locals=[],central=[];
  for(let i=0;i<count;i++) {
    if(view.getUint32(cursor,true)!==0x02014b50) throw new Error('Thiếu thành phần của mẫu Word.');
    const nameLen=view.getUint16(cursor+28,true),extraLen=view.getUint16(cursor+30,true),commentLen=view.getUint16(cursor+32,true),name=original.slice(cursor+46,cursor+46+nameLen);
    const path=new TextDecoder().decode(name),localOffset=view.getUint32(cursor+42,true),localNameLen=view.getUint16(localOffset+26,true),localExtraLen=view.getUint16(localOffset+28,true),compressedSize=view.getUint32(cursor+20,true);
    const replacement=replacements[path],data=replacement||original.slice(localOffset+30+localNameLen+localExtraLen,localOffset+30+localNameLen+localExtraLen+compressedSize);
    const crc=replacement?collectionGuideCRC(data):view.getUint32(cursor+16,true),method=replacement?0:view.getUint16(cursor+10,true),rawSize=replacement?data.length:view.getUint32(cursor+24,true),flags=view.getUint16(cursor+8,true)&~8;
    const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,flags,true);lv.setUint16(8,method,true);lv.setUint16(10,view.getUint16(cursor+12,true),true);lv.setUint16(12,view.getUint16(cursor+14,true),true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,rawSize,true);lv.setUint16(26,name.length,true);local.set(name,30);
    const entry=original.slice(cursor,cursor+46+nameLen+extraLen+commentLen),cv=new DataView(entry.buffer);
    cv.setUint16(8,flags,true);cv.setUint16(10,method,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,rawSize,true);cv.setUint32(42,offset,true);
    locals.push(local,data);central.push(entry);offset+=local.length+data.length;cursor+=entry.length;
  }
  const centralSize=central.reduce((sum,bytes)=>sum+bytes.length,0),tail=new Uint8Array(22),tv=new DataView(tail.buffer);
  tv.setUint32(0,0x06054b50,true);tv.setUint16(8,count,true);tv.setUint16(10,count,true);tv.setUint32(12,centralSize,true);tv.setUint32(16,offset,true);
  return new Blob([...locals,...central,tail],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function buildCollectionGuideWord(snapshot,documentEdits) {
  const serializer=new XMLSerializer(),xml=buildCollectionGuideWordXml(snapshot),settings=collectionGuideParse(collectionGuideAssets().settingsXml);
  collectionDocumentApplyEdits(xml,documentEdits===undefined?collectionDocumentReadEdits(snapshot):documentEdits);
  let update=collectionGuideDesc(settings,'updateFields')[0];
  if(!update) {update=settings.createElementNS(collectionGuideW,'w:updateFields');settings.documentElement.append(update);}
  update.setAttributeNS(collectionGuideW,'w:val','true');
  const encode=doc=>new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+serializer.serializeToString(doc.documentElement));
  return collectionGuideZip({'word/document.xml':encode(xml),'word/settings.xml':encode(settings)});
}
function collectionGuideEscape(value) { return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function collectionGuideParagraphHtml(p,inTable) {
  const prop=collectionGuideChildren(p,'pPr')[0],align=collectionGuideAttr(prop && collectionGuideChildren(prop,'jc')[0],'val'),spacing=prop && collectionGuideChildren(prop,'spacing')[0];
  const before=Number(collectionGuideAttr(spacing,'before'))/20,after=Number(collectionGuideAttr(spacing,'after'))/20;
  const styles=[`text-align:${align==='both'?'justify':align==='center'?'center':align==='right'?'right':'left'}`,`margin:${before||0}pt 0 ${after||0}pt`];
  if(collectionGuideChildren(prop||p,'keepNext').length) styles.push('break-after:avoid');
  let html='';
  for(const [runIndex,run] of collectionGuideChildren(p,'r').entries()) {
    const rp=collectionGuideChildren(run,'rPr')[0],rs=[];
    if(rp && collectionGuideChildren(rp,'b').some(el=>collectionGuideAttr(el,'val')!=='0')) rs.push('font-weight:bold');
    if(rp && collectionGuideChildren(rp,'i').some(el=>collectionGuideAttr(el,'val')!=='0')) rs.push('font-style:italic');
    const size=rp && collectionGuideAttr(collectionGuideChildren(rp,'sz')[0],'val');if(size) rs.push(`font-size:${Number(size)/2}pt`);
    const text=[...run.children].map(el=>el.localName==='t'?collectionGuideEscape(el.textContent):el.localName==='br'?'<br>':el.localName==='tab'?'&emsp;':'').join('');
    html+=`<span ${p.hasAttribute('data-guide-edit-id')?'data-guide-run="'+(run.getAttribute('data-guide-run-source')||runIndex)+'"':''} style="${rs.join(';')}">${text}</span>`;
  }
  return `<p ${p.hasAttribute('data-guide-edit-id')?'data-guide-edit-id="'+p.getAttribute('data-guide-edit-id')+'"':''} style="${styles.join(';')}">${html || '&nbsp;'}</p>`;
}
function collectionGuideTableHtml(table,index) {
  const rows=collectionGuideChildren(table,'tr'),grid=collectionGuideChildren(collectionGuideChildren(table,'tblGrid')[0],'gridCol'),widths=grid.map(el=>Number(collectionGuideAttr(el,'w'))),total=widths.reduce((a,b)=>a+b,0);
  let html=`<table class="${index===0?'checklist':'signature'}"><colgroup>${widths.map(w=>`<col style="width:${w/total*100}%">`).join('')}</colgroup>`;
  rows.forEach((row,i)=>{
    if(index===0 && i===0) html+='<thead>';if(index===0 && i===1) html+='<tbody>';
    const cells=collectionGuideChildren(row,'tc'),heading=index===0 && /^(I|II|III|IV|V|VI)$/.test(collectionGuideDesc(cells[0],'t').map(el=>el.textContent).join('').trim());
    html+=`<tr${heading?' class="section-row"':''}>`;
    cells.forEach(cell=>{
      const props=collectionGuideChildren(cell,'tcPr')[0],span=collectionGuideAttr(props && collectionGuideChildren(props,'gridSpan')[0],'val');
      const tag=index===0 && i===0?'th':'td';
      html+=`<${tag}${span?' colspan="'+Number(span)+'"':''}>${collectionGuideChildren(cell,'p').map(p=>collectionGuideParagraphHtml(p,true)).join('')}</${tag}>`;
    });
    html+='</tr>';if(index===0 && i===0) html+='</thead>';
  });
  if(index===0) html+='</tbody>';return html+'</table>';
}
function buildCollectionGuidePrintHtml(snapshot,documentEdits) {
  const doc=buildCollectionGuideWordXml(snapshot),body=doc.getElementsByTagNameNS(collectionGuideW,'body')[0];let tableIndex=0;
  collectionDocumentApplyEdits(doc,documentEdits===undefined?collectionDocumentReadEdits(snapshot):documentEdits,true);
  collectionDocumentMarkParagraphs(doc);
  const content=[...body.children].map(el=>el.localName==='p'?collectionGuideParagraphHtml(el,false):el.localName==='tbl'?collectionGuideTableHtml(el,tableIndex++):'').join('');
  const title='Hướng dẫn thu thập hồ sơ - '+snapshot.claim.plate;
  const previewTheme=document.body.classList.contains('light-mode')?'light-mode':'dark-mode';
  return `<!DOCTYPE html><html lang="vi" class="${previewTheme}"><head><meta charset="UTF-8"><title>${collectionGuideEscape(title)}</title><style>
    @page {size:A4 portrait;margin:0;}
    * {box-sizing:border-box;} html,body {margin:0;padding:0;color:#000;background:#fff;}
    body {font-family:"Times New Roman",serif;font-size:12pt;line-height:1.15;}
    .guide-page {display:block;position:relative;width:210mm;height:296mm;padding:15mm 20mm 17.5mm 30mm;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always;}
    .guide-page:not(:first-child) {padding-top:25mm;break-before:page;page-break-before:always;}
    .guide-page:last-child {break-after:auto;page-break-after:auto;}
    .letterhead {position:absolute;z-index:0;left:0;top:0;width:210mm;height:297mm;pointer-events:none;}
    .guide-page-content {position:relative;width:160mm;z-index:1;}
    p {overflow-wrap:anywhere;orphans:2;widows:2;}
    table {border-collapse:collapse;table-layout:fixed;width:100%;margin:8pt 0;}
    .checklist th,.checklist td {border:.5pt solid #000;padding:3pt 4pt;vertical-align:middle;font-weight:normal;overflow-wrap:anywhere;}
    .checklist td:nth-child(1),.checklist td:nth-child(3),.checklist td:nth-child(4),.checklist td:nth-child(5) {text-align:center;}
    thead {display:table-header-group;} tr {break-inside:avoid;page-break-inside:avoid;}
    .section-row {break-after:avoid;page-break-after:avoid;} .signature {break-inside:avoid;page-break-inside:avoid;margin-top:4pt;}
    .signature td {border:0;vertical-align:top;} .signature p {text-align:center;}
    @media screen {
      html {background:radial-gradient(circle at 20% 0,rgba(216,180,109,.10),transparent 38%),#111923;}
      html.light-mode {background:radial-gradient(circle at 20% 0,rgba(179,140,67,.10),transparent 42%),#eae8e1;}
      body {background:transparent;padding:28px 24px;}
      .guide-page {background:#fff;margin:0 auto 28px;border:1px solid rgba(216,180,109,.30);box-shadow:0 24px 70px rgba(0,0,0,.38),0 2px 8px rgba(0,0,0,.14);}
      html.light-mode .guide-page {box-shadow:0 24px 64px rgba(31,39,51,.20),0 2px 8px rgba(31,39,51,.10);}
    }
    </style></head><body>${collectionGuidePaginate(content)}</body></html>`;
}
function collectionGuidePaginate(content) {
  // Paginate in an isolated document so application styles cannot affect the form.
  const frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-12000px;top:0;width:210mm;height:297mm;border:0;visibility:hidden;';frame.title='Đo bố cục hướng dẫn';document.body.append(frame);
  try {
    const doc=frame.contentDocument;doc.open();doc.write(`<!DOCTYPE html><html><head><style>*{box-sizing:border-box}body{margin:0;font-family:"Times New Roman",serif;font-size:12pt;line-height:1.15}.page{width:210mm;height:296mm;padding:15mm 20mm 17.5mm 30mm}.page:not(:first-child){padding-top:25mm}.content{width:160mm}p{overflow-wrap:anywhere}table{border-collapse:collapse;table-layout:fixed;width:100%;margin:8pt 0}.checklist th,.checklist td{border:.5pt solid #000;padding:3pt 4pt;vertical-align:middle;font-weight:normal;overflow-wrap:anywhere}.signature td{border:0;vertical-align:top}.signature{margin-top:4pt}.signature p{text-align:center}</style></head><body></body></html>`);doc.close();
    const source=doc.createElement('div');source.innerHTML=content;const nodes=[...source.children],pages=[];let current,wrapper;
    const nextPage=()=>{const page=doc.createElement('div');page.className='page';current=doc.createElement('div');current.className='content';page.append(current);doc.body.append(page);pages.push(current);wrapper=page;};
    const overflow=()=>current.getBoundingClientRect().bottom>wrapper.getBoundingClientRect().bottom-17.5*96/25.4+0.5;
    nextPage();
    for(const node of nodes) {
      if(node.matches('table.checklist')) {
        const rows=[...node.querySelectorAll('tbody > tr')];let table,tbody;
        const newTable=()=>{table=node.cloneNode(false);table.append(node.querySelector('colgroup').cloneNode(true),node.querySelector('thead').cloneNode(true));tbody=doc.createElement('tbody');table.append(tbody);current.append(table);};
        newTable();
        for(const row of rows) {
          tbody.append(row);
          if(overflow()) {
            row.remove();let heading=null;
            if(tbody.lastElementChild?.classList.contains('section-row')) {heading=tbody.lastElementChild;heading.remove();}
            if(!tbody.children.length) table.remove();
            nextPage();newTable();if(heading) tbody.append(heading);tbody.append(row);
            if(overflow()) throw new Error('Một dòng chứng từ quá dài để vừa trang A4. Vui lòng rút gọn tên chứng từ.');
          }
        }
      } else {
        current.append(node);
        if(overflow()) {
          node.remove();nextPage();current.append(node);
          if(overflow()) throw new Error('Thông tin hướng dẫn quá dài để vừa trang A4. Vui lòng rút gọn nội dung.');
        }
      }
    }
    return pages.filter(page=>page.children.length).map(page=>`<section class="guide-page"><img class="letterhead" alt="" src="${TascoAssets.url(collectionGuideAssets().backgroundUrl)}"><div class="guide-page-content">${page.innerHTML}</div></section>`).join('');
  } finally {frame.remove();}
}
function collectionGuideReport(error) { if(typeof triggerToast==='function') triggerToast(error.message||String(error),'warning');else alert(error.message||String(error)); }
function collectionGuideFilename(snapshot) { return ('Huong-dan-thu-thap-ho-so_'+(snapshot.claim.number||snapshot.claim.plate)).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,180)+'.docx'; }
async function exportCollectionGuideWord(savedSnapshot) {
  if(collectionGuideBusy) return;
  collectionGuideBusy=true;
  try {
    if(!savedSnapshot){const draft=collectionGuideDraft;await collectionGuidePrepareContact();if(draft && collectionGuideDraft!==draft)return;}
    const snapshot=savedSnapshot || collectionGuideSnapshot(),blob=await buildCollectionGuideWord(snapshot),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=collectionGuideFilename(snapshot);document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  } catch(error) {collectionGuideReport(error);} finally {collectionGuideBusy=false;}
}
async function previewCollectionGuide() {
  try {
    const draft=collectionGuideDraft;
    await collectionGuidePrepareContact();
    if(draft && collectionGuideDraft!==draft)return;
    const snapshot=collectionGuideSnapshot(),guideEditor=createCollectionDocumentEditor(snapshot),html=guideEditor.html(),title='Hướng dẫn thu thập hồ sơ';
    openCollectionDocumentPreview({title,html,claim:snapshot.claim,onExport:()=>guideEditor.export(),onPrint:()=>guideEditor.print(),guideEditor});
  } catch(error) {collectionGuideReport(error);}
}
function closeCollectionGuidePreview() {
  const overlay=document.getElementById('collectionGuidePreview');
  if(overlay) {
    overlay._guideEditor?.flush();
    const returnFocus=overlay._returnFocus;overlay.remove();
    if(returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus();
  }
}
function clearCollectionGuideDraft() {closeCollectionWordMenu();collectionGuideDraft=null;collectionGuideRows.clear();collectionGuideUndoSelection=null;closeCollectionGuidePreview();document.getElementById('tndsAdvanceDialog')?.remove();}
async function printCollectionGuide() {
  if(collectionGuideBusy) return;
  try {const draft=collectionGuideDraft;await collectionGuidePrepareContact();if(draft && collectionGuideDraft!==draft)return;await printCollectionDocumentHtml(buildCollectionGuidePrintHtml(collectionGuideSnapshot()),'Hướng dẫn thu thập hồ sơ');}
  catch(error) {collectionGuideReport(error);}
}
async function printCollectionDocumentHtml(html,title) {
  if(collectionGuideBusy) return;
  collectionGuideBusy=true;let frame=null;
  try {
    frame=document.createElement('iframe');
    frame.title='In '+title;frame.style.cssText='position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;';
    const loaded=new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(new Error('Không thể mở bản in.'));});
    frame.srcdoc=html;document.body.append(frame);await loaded;
    await frame.contentDocument.fonts.ready;
    await Promise.all([...frame.contentDocument.images].map(img=>img.decode().catch(()=>{})));
    const cleanup=()=>{frame?.remove();collectionGuideBusy=false;};
    frame.contentWindow.addEventListener('afterprint',cleanup,{once:true});
    // Keep the document alive until the print dialog is finished, including cancellation.
    setTimeout(cleanup,300000);frame.contentWindow.focus();frame.contentWindow.print();
  } catch(error) {frame?.remove();collectionGuideBusy=false;collectionGuideReport(error);}
}
