/* Official record request: source DOCX layout, explicit factual assertions and HSBT autosave. */
const authorityRequestFields = [
  ['recipient','Cơ quan nhận công văn *','text',350],
  ['documentNumber','Số thứ tự công văn (để trống nếu chưa cấp số)','text',80],
  ['city','Nơi ban hành *','text',100],['date','Ngày ban hành *','date',10],
  ['certificate','Số GCNBH dùng trong công văn *','text',150],
  ['vehicleType','Loại phương tiện được bảo hiểm *','text',80],
  ['time','Giờ xảy ra tai nạn (nếu xác định)','time',5],
  ['otherParty','Phương tiện / người liên quan khác (nếu có)','textarea',700],
  ['contact','Cán bộ liên hệ *','text',180],['phone','Số điện thoại liên hệ *','tel',80],
  ['email','Email liên hệ (nếu có)','email',150],['address','Địa chỉ nhận hồ sơ *','textarea',500]
];
const authorityRequestOptions = [
  ['vehicleDocs','Giấy tờ phương tiện và người điều khiển','Đăng ký xe; GPLX; CCCD / hộ chiếu (nếu có).'],
  ['investigationDocs','Kết quả điều tra, xác minh tai nạn','Thông báo kết quả hoặc kết luận điều tra, giải quyết tai nạn.'],
  ['settlementDocs','Thỏa thuận dân sự','Biên bản thỏa thuận, giấy bãi nại.'],
  ['examinationDocs','Khám nghiệm hiện trường, phương tiện','Hồ sơ, tài liệu, bản ảnh khám nghiệm khác (nếu có).']
];
let authorityRequestBusy=false;
let authorityRequestDownloadUrl='';
function clearAuthorityRequestFeedback(){
  const panel=document.getElementById('authorityRequestMessage');if(panel){panel.hidden=true;panel.replaceChildren();}
  for(const input of document.querySelectorAll('[data-authority-invalid]')){
    input.removeAttribute('aria-invalid');delete input.dataset.authorityInvalid;
    const hintId=input.id+'_exportError',described=(input.getAttribute('aria-describedby') || '').split(/\s+/).filter(id=>id && id!==hintId).join(' ');
    if(described)input.setAttribute('aria-describedby',described);else input.removeAttribute('aria-describedby');
  }
  document.querySelectorAll('.authority-request-field-error').forEach(hint=>hint.remove());
  if(authorityRequestDownloadUrl){const previous=authorityRequestDownloadUrl;authorityRequestDownloadUrl='';setTimeout(()=>URL.revokeObjectURL(previous),60000);}
}
function authorityRequestFeedback(type,message,download){
  const panel=document.getElementById('authorityRequestMessage');if(!panel)return;
  panel.replaceChildren();panel.hidden=false;panel.dataset.type=type;panel.setAttribute('role',type==='error'?'alert':'status');
  panel.append(collectionGuideElement('span','',message));
  if(download){const link=collectionGuideElement('a','authority-request-download','Tải tệp Word');link.href=download.url;link.download=download.filename;panel.append(link);}
}
function authorityRequestValidationError(message,fieldId,tab='AuthorityRequest'){
  const error=new Error(message);error.fieldId=fieldId;error.tab=tab;return error;
}
function authorityRequestShowError(error){
  clearAuthorityRequestFeedback();
  if(error.fieldId){closeCollectionGuidePreview();switchEditClaimTab(error.tab || 'AuthorityRequest');}
  else if(!document.getElementById('collectionGuidePreview'))switchEditClaimTab('AuthorityRequest');
  authorityRequestFeedback('error',error.message || String(error));
  const input=error.fieldId && document.getElementById(error.fieldId);
  if(input){
    input.dataset.authorityInvalid='true';input.setAttribute('aria-invalid','true');
    const hint=collectionGuideElement('div','authority-request-field-error',error.message);hint.id=input.id+'_exportError';
    const wrapper=input.closest('.authority-request-field,.authority-request-detail,.authority-request-check') || input.parentElement;
    wrapper.append(hint);input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),hint.id].filter(Boolean).join(' '));
    input.scrollIntoView({block:'center'});input.focus({preventScroll:true});
  }
  collectionGuideReport(error);
}
function authorityRequestSetBusy(busy){
  for(const button of document.querySelectorAll('[data-authority-export]')){
    button.disabled=busy;button.setAttribute('aria-busy',String(busy));
    const label=button.querySelector('[data-export-label]');
    if(label){if(!button.dataset.exportLabel)button.dataset.exportLabel=label.textContent;label.textContent=busy?'Đang tạo tệp…':button.dataset.exportLabel;}
  }
}
document.addEventListener('input',event=>{if(event.target.hasAttribute('data-authority-invalid'))clearAuthorityRequestFeedback();});
function authorityRequestMeta() {
  ensureCollectionGuide();
  const saved=collectionGuideDraft.authorityRequest || {},guide=collectionGuideDraft.meta;
  const defaults={recipient:'',documentNumber:'',city:'Đắk Lắk',date:collectionGuideToday(),
    certificate:collectionGuideValue('modalPendingSoGcn'),vehicleType:'xe ô tô',
    time:collectionGuideValue('modalPendingNgayVTT').match(/(?:T|\s)(\d{2}:\d{2})/)?.[1] || '',otherParty:'',
    contact:guide.assessor || '',phone:guide.hotline || '',email:'',address:guide.address || '',
    consequence:'',basis:AUTHORITY_REQUEST_TEMPLATE.texts.basis,extraDocs:''};
  const next={manualFields:{}};
  for(const key of ['certificate','time','contact','phone','address'])next.manualFields[key]=saved.manualFields?.[key]===true;
  for(const [key,,,limit] of [...authorityRequestFields,['consequence','','',900],['basis','','',900],['extraDocs','','',900]]){
    const useSaved=typeof saved[key]==='string' && (!(key in next.manualFields) || next.manualFields[key]);
    next[key]=String(useSaved?saved[key]:defaults[key] || '').slice(0,limit);
  }
  next.selected={};for(const [key] of authorityRequestOptions)next.selected[key]=saved.selected?.[key]===true;
  for(const key of ['includeStaff','includeConsequence','includeBasis','requestTransfer'])next[key]=saved[key]===true;
  next.reviewed=typeof saved.reviewed==='string'?saved.reviewed:'';
  collectionGuideDraft.authorityRequest=next;return next;
}
function authorityRequestClaim() {return {...tndsAdvanceClaim(),rawLossDate:collectionGuideValue('modalPendingNgayVTT')};}
function authorityRequestReviewToken(meta,claim) {
  const {reviewed,...content}=meta;
  for(const key of Object.keys(content))if(typeof content[key]==='string')content[key]=content[key].trim();
  return JSON.stringify({content,claim});
}
function authorityRequestRefresh() {
  const pane=document.getElementById('tabPane_AuthorityRequest');if(!pane || !collectionGuideDraft)return;
  const meta=authorityRequestMeta(),claim=authorityRequestClaim(),review=pane.querySelector('#authorityRequest_review');
  if(review)review.checked=meta.reviewed===authorityRequestReviewToken(meta,claim);
  const summary=document.getElementById('authorityRequestClaimSummary');
  if(summary){
    summary.replaceChildren();
    for(const [label,value] of [['Số HSBT',claim.number],['Biển số xe',claim.plate],['Ngày tai nạn',claim.lossDate],['Địa điểm',claim.location]]){
      const item=collectionGuideElement('div','authority-request-context-item');
      item.append(collectionGuideElement('span','',label),collectionGuideElement('strong','',value || 'Chưa nhập'));summary.append(item);
    }
  }
  const count=document.getElementById('authorityRequestSelectedCount');
  if(count)count.textContent=Object.values(meta.selected).filter(Boolean).length+'/4 nhóm tài liệu';
  for(const [key,manual] of Object.entries(meta.manualFields))if(!manual){const input=pane.querySelector('#authorityRequest_'+key);if(input){input.value=meta[key];input.dataset.authorityRenderedValue=input.value;}}
  for(const [checkbox,field] of [['includeConsequence','consequence'],['includeBasis','basis']]){
    const wrapper=pane.querySelector('[data-authority-detail="'+field+'"]');if(wrapper)wrapper.hidden=!meta[checkbox];
  }
}
function readAuthorityRequestForm(changedKey,silent=false) {
  const pane=document.getElementById('authorityRequestForm');if(!pane || !collectionGuideDraft)return;
  if(!silent)clearAuthorityRequestFeedback();
  const meta=authorityRequestMeta();
  const previous=authorityRequestReviewToken(meta,authorityRequestClaim());
  if(changedKey in meta.manualFields)meta.manualFields[changedKey]=true;
  for(const input of pane.querySelectorAll('[data-authority-field]')){
    const key=input.dataset.authorityField;
    if(input.type==='checkbox'){
      if(key in meta.selected)meta.selected[key]=input.checked;else meta[key]=input.checked;
    }else{
      // Read autofill too; untouched automatic fields keep following the main claim.
      if(key in meta.manualFields && !meta.manualFields[key]){
        if(input.value===input.dataset.authorityRenderedValue)continue;
        meta.manualFields[key]=true;
      }
      meta[key]=input.value.slice(0,input.maxLength>0?input.maxLength:1000);
      input.dataset.authorityRenderedValue=input.value;
    }
  }
  const changed=previous!==authorityRequestReviewToken(meta,authorityRequestClaim());
  if(changed)meta.reviewed='';collectionGuideDraft.authorityRequest=meta;
  if(!silent)authorityRequestRefresh();
  if(changed || !silent)scheduleCollectionGuideAutoSave();
  return meta;
}
function initializeAuthorityRequest() {
  const host=document.getElementById('authorityRequestForm');if(!host)return;
  clearAuthorityRequestFeedback();
  const meta=authorityRequestMeta();host.replaceChildren();
  const icons={
    document:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
    vehicle:'<path d="m5 7 2-4h10l2 4M4 7h16v10H4zM7 17v3M17 17v3M4 11h16M7 14h1M16 14h1"/>',
    contact:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 6h4M17 10h4M18 16h3"/>',
    papers:'<path d="M9 5H5v16h14V5h-4M9 3h6v4H9zM8 12h8M8 16h5"/>',
    confirm:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>'
  };
  function section(title,description,icon){
    const card=collectionGuideElement('section','authority-request-card'),heading=collectionGuideElement('div','authority-request-card-heading');
    const symbol=collectionGuideElement('span','authority-request-card-icon');symbol.setAttribute('aria-hidden','true');
    symbol.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[icon]+'</svg>';
    const copy=collectionGuideElement('div');copy.append(collectionGuideElement('h4','',title),collectionGuideElement('p','',description));heading.append(symbol,copy);card.append(heading);return card;
  }
  const layout=collectionGuideElement('div','authority-request-layout'),primary=collectionGuideElement('div','authority-request-primary'),aside=collectionGuideElement('div','authority-request-aside');
  const groups=[
    ['Thông tin công văn','Đơn vị nhận và thông tin ban hành.','document',['recipient','documentNumber','city','date']],
    ['Thông tin vụ tai nạn','Thông tin dùng để đề nghị cung cấp hồ sơ.','vehicle',['certificate','vehicleType','time','otherParty']],
    ['Thông tin liên hệ','Cán bộ và địa chỉ tiếp nhận phản hồi.','contact',['contact','phone','email','address']]
  ];
  const grids=new Map();
  for(const [title,description,icon,keys] of groups){const card=section(title,description,icon),grid=collectionGuideElement('div','authority-request-grid');card.append(grid);primary.append(card);for(const key of keys)grids.set(key,grid);}
  for(const [key,label,type,limit] of authorityRequestFields){
    const wrap=collectionGuideElement('div','authority-request-field'+(type==='textarea' || key==='recipient'?' authority-request-wide':'')),caption=collectionGuideElement('label');
    const displayLabel=label.replace(/ \*$/,'').replace(/ \(.*\)$/,'');caption.append(collectionGuideElement('span','',displayLabel));
    if(label.endsWith(' *'))caption.append(collectionGuideElement('span','authority-request-required',' *'));
    const input=collectionGuideElement(type==='textarea'?'textarea':'input','input-premium');
    if(type!=='textarea')input.type=type;else input.rows=2;
    input.id='authorityRequest_'+key;input.dataset.authorityField=key;input.maxLength=limit;input.value=meta[key];input.dataset.authorityRenderedValue=input.value;caption.htmlFor=input.id;
    if(key==='recipient')input.placeholder='Ví dụ: Cơ quan Cảnh sát điều tra – Công an tỉnh…';
    if(key==='documentNumber')input.placeholder='Ví dụ: 123';
    if(key==='otherParty')input.placeholder='Ví dụ: xe mô tô do ông / bà… điều khiển';
    if(key==='certificate')input.placeholder='Kiểm tra đúng GCNBH của nghiệp vụ cần trưng cầu';
    wrap.append(caption,input);
    const hints={documentNumber:'Để trống nếu chưa cấp số công văn.',time:'Có thể để trống nếu chưa xác định.',email:'Không bắt buộc.',otherParty:'Bổ sung phương tiện, người liên quan nếu có.'};
    if(hints[key]){const hint=collectionGuideElement('small','authority-request-field-hint',hints[key]);hint.id=input.id+'_hint';input.setAttribute('aria-describedby',hint.id);wrap.append(hint);}
    grids.get(key).append(wrap);
  }
  const details=section('Nội dung xác nhận','Chỉ chọn những nội dung đã xác minh.','confirm');
  function checkbox(key,label,description,parent=details){
    const line=collectionGuideElement('label','authority-request-check'),input=collectionGuideElement('input');input.type='checkbox';input.id='authorityRequest_'+key;input.dataset.authorityField=key;
    input.checked=key in meta.selected?meta.selected[key]:meta[key]===true;
    const copy=collectionGuideElement('span');copy.append(collectionGuideElement('strong','',label));if(description)copy.append(collectionGuideElement('small','',description));line.append(input,copy);parent.append(line);
  }
  function detail(key,label,placeholder=''){
    const wrap=collectionGuideElement('div','authority-request-detail');wrap.dataset.authorityDetail=key;
    const caption=collectionGuideElement('label','',label),input=collectionGuideElement('textarea','input-premium');input.id='authorityRequest_'+key;caption.htmlFor=input.id;input.rows=3;input.maxLength=900;input.dataset.authorityField=key;input.value=meta[key];input.placeholder=placeholder;wrap.append(caption,input);details.append(wrap);
  }
  checkbox('includeStaff','Đã cử cán bộ tiếp nhận, hướng dẫn / phối hợp thu thập hồ sơ','Chỉ chọn nếu đã thực hiện; đoạn xác nhận sẽ được đưa vào công văn.');
  checkbox('includeConsequence','Đưa thông tin hậu quả tai nạn đã xác minh vào công văn','Nhập đúng thông tin từ thông báo tai nạn / tài liệu đã nhận.');
  detail('consequence','Thông tin hậu quả và nguồn xác nhận *','Ví dụ: Theo thông báo tai nạn của chủ xe, ông / bà… bị…');
  checkbox('includeBasis','Đưa căn cứ về bảo hiểm TNDS bắt buộc theo mẫu','Kiểm tra căn cứ phù hợp với hồ sơ trước khi chọn. Có thể sửa nội dung bên dưới.');
  detail('basis','Nội dung căn cứ *');
  const documents=section('Tài liệu đề nghị cung cấp','Chọn các nhóm tài liệu cần thu thập.','papers');
  const count=collectionGuideElement('span','authority-request-count');count.id='authorityRequestSelectedCount';documents.append(count);
  for(const [key,label,description] of authorityRequestOptions)checkbox(key,label,description,documents);
  checkbox('requestTransfer','Đề nghị thông tin cơ quan đang tiếp tục thụ lý','Dùng khi vụ việc có thể đã chuyển cơ quan khác hoặc Tòa án.',documents);
  const extraWrap=collectionGuideElement('div','authority-request-extra'),extraLabel=collectionGuideElement('label','','Tài liệu bổ sung khác'),extra=collectionGuideElement('textarea','input-premium');extraLabel.htmlFor=extra.id='authorityRequest_extraDocs';extra.rows=3;extra.maxLength=900;extra.dataset.authorityField='extraDocs';extra.value=meta.extraDocs;extra.placeholder='Mỗi dòng một tài liệu cần bổ sung…';extraWrap.append(extraLabel,extra);documents.append(extraWrap);
  const review=collectionGuideElement('label','authority-request-check authority-request-review'),check=collectionGuideElement('input');check.id='authorityRequest_review';check.type='checkbox';
  const reviewCopy=collectionGuideElement('span');reviewCopy.append(collectionGuideElement('strong','','Xác nhận nội dung công văn'),collectionGuideElement('small','','Tôi đã kiểm tra cơ quan nhận, thông tin vụ tai nạn, GCNBH và các nội dung được chọn trước khi xuất.'));review.append(check,reviewCopy);
  check.addEventListener('change',()=>{clearAuthorityRequestFeedback();const current=readAuthorityRequestForm(undefined,true) || authorityRequestMeta();current.reviewed=check.checked?authorityRequestReviewToken(current,authorityRequestClaim()):'';scheduleCollectionGuideAutoSave();});
  aside.append(documents,details);layout.append(primary,aside);host.append(layout,review);
  host.oninput=event=>{if(event.target.dataset.authorityField && event.target.type!=='checkbox')readAuthorityRequestForm(event.target.dataset.authorityField);};
  host.onchange=event=>{if(event.target.dataset.authorityField)readAuthorityRequestForm(event.target.dataset.authorityField);};
  authorityRequestRefresh();
}
function openAuthorityRequestTab(){closeCollectionWordMenu();switchEditClaimTab('AuthorityRequest');document.getElementById('authorityRequest_recipient')?.focus();}
function authorityRequestSnapshot(requireReview=true) {
  const meta=structuredClone(readAuthorityRequestForm(undefined,true) || authorityRequestMeta()),claim=authorityRequestClaim();
  for(const key of Object.keys(meta))if(typeof meta[key]==='string' && key!=='reviewed')meta[key]=meta[key].trim();
  if(!claim.number)throw authorityRequestValidationError('Vui lòng nhập số HSBT của hồ sơ.','modalPendingSoHoSoBoiThuong','Policy');
  if(!claim.plate)throw authorityRequestValidationError('Vui lòng nhập biển số xe của hồ sơ.','modalPendingBienSo','Policy');
  if(!claim.lossDate)throw authorityRequestValidationError('Vui lòng nhập ngày tổn thất hợp lệ.','modalPendingNgayVTT','Event');
  if(!claim.location)throw authorityRequestValidationError('Vui lòng nhập địa điểm chi tiết tổn thất.','modalPendingDiaDiemVTT','Event');
  for(const [key,label] of authorityRequestFields)if(label.endsWith(' *') && !meta[key])throw authorityRequestValidationError('Vui lòng nhập '+label.replace(' *','').toLocaleLowerCase('vi')+'.','authorityRequest_'+key);
  if(!collectionGuideDate(meta.date))throw authorityRequestValidationError('Ngày ban hành không hợp lệ.','authorityRequest_date');
  if(meta.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(meta.email))throw authorityRequestValidationError('Email liên hệ không hợp lệ.','authorityRequest_email');
  if(meta.includeConsequence && !meta.consequence)throw authorityRequestValidationError('Vui lòng nhập thông tin hậu quả tai nạn đã xác minh.','authorityRequest_consequence');
  if(meta.includeBasis && !meta.basis)throw authorityRequestValidationError('Vui lòng nhập nội dung căn cứ đã chọn.','authorityRequest_basis');
  if(!Object.values(meta.selected).some(Boolean) && !meta.extraDocs)throw authorityRequestValidationError('Vui lòng chọn ít nhất một nhóm tài liệu hoặc nhập tài liệu bổ sung.','authorityRequest_vehicleDocs');
  const snapshot={meta,claim};if(requireReview)authorityRequestAssertReviewed(snapshot);return snapshot;
}
function authorityRequestAssertReviewed(snapshot){if(snapshot.meta.reviewed!==authorityRequestReviewToken(snapshot.meta,snapshot.claim))throw authorityRequestValidationError('Vui lòng tích xác nhận đã kiểm tra nội dung công văn trước khi xuất.','authorityRequest_review');}
function buildAuthorityRequestWordXml(snapshot) {
  const {meta,claim}=snapshot,doc=collectionGuideParse(AUTHORITY_REQUEST_TEMPLATE.documentXml),texts=AUTHORITY_REQUEST_TEMPLATE.texts;
  const date=meta.date.split('-'),loss=claim.lossDate.split('/');
  const event=`Liên quan tới vụ tai nạn giao thông xảy ra ${meta.time?'vào khoảng '+meta.time.replace(':',' giờ ')+' phút ':''}ngày ${loss[0]} tháng ${loss[1]} năm ${loss[2]} tại ${claim.location}, liên quan đến ${meta.vehicleType} BKS ${claim.plate}${meta.otherParty?' với '+meta.otherParty:''}. Bảo hiểm Tasco là đơn vị bảo hiểm cho ${meta.vehicleType} BKS ${claim.plate}, Giấy chứng nhận bảo hiểm số: ${meta.certificate}.`;
  const values={numberLine:`Số: ${meta.documentNumber || '…'}/${date[0]}/CV-BHTASCO           ${meta.city}, ngày ${Number(date[2])} tháng ${Number(date[1])} năm ${date[0]}`,
    recipient:'Kính gửi: '+meta.recipient,event,staff:meta.includeStaff?texts.staff:null,
    consequence:meta.includeConsequence?meta.consequence:null,basis:meta.includeBasis?meta.basis:null,
    vehicleDocs:meta.selected.vehicleDocs?texts.vehicleDocs:null,investigationDocs:meta.selected.investigationDocs?texts.investigationDocs:null,
    settlementDocs:meta.selected.settlementDocs?texts.settlementDocs:null,
    otherDocs:[meta.selected.examinationDocs?texts.examinationDocs:'',meta.requestTransfer?texts.transfer:''].filter(Boolean).join(' ') || null,
    contact:meta.contact+' - Công ty TNHH Bảo hiểm Tasco',contactChannels:'SĐT: '+meta.phone+(meta.email?' – Email: '+meta.email:''),address:'Địa chỉ: '+meta.address};
  const paragraphs=collectionGuideDesc(doc,'p'),last=paragraphs.find(p=>collectionGuideDesc(p,'t').some(t=>t.textContent==='{{otherDocs}}'));
  const afterLast=last.nextSibling;
  for(const line of meta.extraDocs.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)){
    const clone=last.cloneNode(true);for(const name of ['paraId','textId'])clone.removeAttributeNS('http://schemas.microsoft.com/office/word/2010/wordml',name);
    collectionGuideSetText(clone,line);last.parentNode.insertBefore(clone,afterLast);
  }
  const found=new Set();for(const p of paragraphs){
    const marker=collectionGuideDesc(p,'t').map(t=>t.textContent).join('').match(/^\{\{(\w+)\}\}$/);if(!marker)continue;
    const key=marker[1];if(!(key in values))throw new Error('Vị trí dữ liệu không hợp lệ trong mẫu trưng cầu.');found.add(key);
    if(values[key]===null)p.remove();else collectionGuideSetText(p,values[key]);
  }
  if(found.size!==Object.keys(values).length)throw new Error('Mẫu trưng cầu thiếu vị trí dữ liệu.');
  return doc;
}
async function buildAuthorityRequestWord(snapshot){
  const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+new XMLSerializer().serializeToString(buildAuthorityRequestWordXml(snapshot).documentElement);
  return collectionGuideZip({'word/document.xml':new TextEncoder().encode(xml)},AUTHORITY_REQUEST_TEMPLATE.zipUrl);
}
async function exportAuthorityRequestWord(savedSnapshot){
  if(authorityRequestBusy)return;
  const driveContext=typeof ClaimDocuments !== 'undefined' ? ClaimDocuments.capture() : null;
  const draft=collectionGuideDraft;authorityRequestBusy=true;clearAuthorityRequestFeedback();authorityRequestSetBusy(true);
  try{
    const snapshot=savedSnapshot || authorityRequestSnapshot();authorityRequestAssertReviewed(snapshot);
    authorityRequestFeedback('loading','Đang tạo tệp Word, vui lòng đợi…');
    const blob=await buildAuthorityRequestWord(snapshot),url=URL.createObjectURL(blob),link=document.createElement('a');
    const filename=('Trung_cau_ho_so_'+snapshot.claim.number).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,180)+'.docx';
    if(collectionGuideDraft===draft){authorityRequestDownloadUrl=url;authorityRequestFeedback('success','Đã tạo công văn. Nếu trình duyệt chưa tự tải, bấm Tải tệp Word.',{url,filename});}
    else setTimeout(()=>URL.revokeObjectURL(url),60000);
    link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
    const preview=document.getElementById('collectionGuidePreview');
    if(preview && collectionGuideDraft===draft)closeCollectionGuidePreview();
    if(collectionGuideDraft===draft){switchEditClaimTab('AuthorityRequest');document.getElementById('authorityRequestMessage')?.scrollIntoView({block:'center'});}
    triggerToast('Đã tạo công văn Word. Có thể bấm Tải tệp Word để tải lại.','success');
    if(driveContext) await ClaimDocuments.saveWord(blob,filename,driveContext);
  }catch(error){if(collectionGuideDraft===draft)authorityRequestShowError(error);else collectionGuideReport(error);}
  finally{authorityRequestBusy=false;authorityRequestSetBusy(false);}
}
function buildAuthorityRequestPrintHtml(snapshot){
  const doc=buildAuthorityRequestWordXml(snapshot),body=doc.getElementsByTagNameNS(collectionGuideW,'body')[0],counters={};let tableIndex=0;
  const content=[...body.children].map(n=>n.localName==='p'?tndsAdvanceParagraphHtml(n,counters,AUTHORITY_REQUEST_TEMPLATE):n.localName==='tbl'?tndsAdvanceTableHtml(n,tableIndex++,counters,AUTHORITY_REQUEST_TEMPLATE):'').join('');
  const styles=tndsAdvancePageStyles()+`.tnds-page{padding:20.07mm}.tnds-page-content{width:169.86mm}body{font-size:13pt}.tnds-logo{width:37.89mm;height:15.24mm}.tnds-footer{left:20.07mm;right:20.07mm}.tnds-page-content>p:has(+ p){overflow-wrap:break-word}`;
  return '<!DOCTYPE html><html lang="vi" class="'+(document.body.classList.contains('light-mode')?'light-mode':'dark-mode')+'"><head><meta charset="UTF-8"><title>Trưng cầu hồ sơ</title><style>'+styles+'</style></head><body>'+tndsAdvancePaginate(content,'Quy trình giám định bồi thường bảo hiểm xe cơ giới – BM.TASCO.XCG.01.11',styles)+'</body></html>';
}
function previewAuthorityRequest(){
  try{
    const snapshot=authorityRequestSnapshot(false),html=buildAuthorityRequestPrintHtml(snapshot),title='Trưng cầu hồ sơ từ cơ quan chức năng';
    openCollectionDocumentPreview({title,html,claim:snapshot.claim,onExport:()=>exportAuthorityRequestWord(snapshot),onPrint:()=>{try{authorityRequestAssertReviewed(snapshot);printCollectionDocumentHtml(html,title);}catch(error){authorityRequestShowError(error);}},onEdit:()=>{closeCollectionGuidePreview();openAuthorityRequestTab();}});
    const exportButton=document.querySelector('#collectionGuidePreview .collection-guide-preview-export');
    if(exportButton){exportButton.dataset.authorityExport='';exportButton.lastElementChild.dataset.exportLabel='';}
  }catch(error){authorityRequestShowError(error);}
}
