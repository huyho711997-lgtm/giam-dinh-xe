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
  if(summary)summary.textContent=`HSBT: ${claim.number || 'Chưa nhập'} · Biển số: ${claim.plate || 'Chưa nhập'} · Ngày tai nạn: ${claim.lossDate || 'Chưa nhập'} · Địa điểm: ${claim.location || 'Chưa nhập'}`;
  const count=document.getElementById('authorityRequestSelectedCount');
  if(count)count.textContent=Object.values(meta.selected).filter(Boolean).length+'/4 nhóm tài liệu';
  for(const [key,manual] of Object.entries(meta.manualFields))if(!manual){const input=pane.querySelector('#authorityRequest_'+key);if(input)input.value=meta[key];}
  for(const [checkbox,field] of [['includeConsequence','consequence'],['includeBasis','basis']]){
    const wrapper=pane.querySelector('[data-authority-detail="'+field+'"]');if(wrapper)wrapper.hidden=!meta[checkbox];
  }
}
function readAuthorityRequestForm(changedKey) {
  const pane=document.getElementById('authorityRequestForm');if(!pane || !collectionGuideDraft)return;
  const meta=authorityRequestMeta();
  if(changedKey in meta.manualFields)meta.manualFields[changedKey]=true;
  for(const input of pane.querySelectorAll('[data-authority-field]')){
    const key=input.dataset.authorityField;
    if(input.type==='checkbox'){
      if(key in meta.selected)meta.selected[key]=input.checked;else meta[key]=input.checked;
    }else meta[key]=input.value.slice(0,input.maxLength>0?input.maxLength:1000);
  }
  meta.reviewed='';collectionGuideDraft.authorityRequest=meta;
  authorityRequestRefresh();scheduleCollectionGuideAutoSave();
}
function initializeAuthorityRequest() {
  const host=document.getElementById('authorityRequestForm');if(!host)return;
  const meta=authorityRequestMeta();host.replaceChildren();
  const grid=collectionGuideElement('div','authority-request-grid');
  for(const [key,label,type,limit] of authorityRequestFields){
    const wrap=collectionGuideElement('div',type==='textarea'?'authority-request-wide':''),caption=collectionGuideElement('label','',label);
    const input=collectionGuideElement(type==='textarea'?'textarea':'input','input-premium');
    if(type!=='textarea')input.type=type;else input.rows=2;
    input.id='authorityRequest_'+key;input.dataset.authorityField=key;input.maxLength=limit;input.value=meta[key];caption.htmlFor=input.id;
    if(key==='recipient')input.placeholder='Ví dụ: Cơ quan Cảnh sát điều tra – Công an tỉnh…';
    if(key==='documentNumber')input.placeholder='Ví dụ: 123 (tự thêm /năm/CV-BHTASCO)';
    if(key==='otherParty')input.placeholder='Ví dụ: xe mô tô do ông / bà… điều khiển';
    if(key==='certificate')input.placeholder='Kiểm tra đúng GCNBH của nghiệp vụ cần trưng cầu';
    wrap.append(caption,input);grid.append(wrap);
  }
  const details=collectionGuideElement('section','authority-request-section');details.append(collectionGuideElement('h4','','Nội dung cần xác nhận'));
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
  const documents=collectionGuideElement('section','authority-request-section');
  const title=collectionGuideElement('h4','','Tài liệu đề nghị cung cấp'),count=collectionGuideElement('span','authority-request-count');count.id='authorityRequestSelectedCount';documents.append(title,count);
  for(const [key,label,description] of authorityRequestOptions)checkbox(key,label,description,documents);
  checkbox('requestTransfer','Đề nghị thông tin cơ quan đang tiếp tục thụ lý','Dùng khi vụ việc có thể đã chuyển cơ quan khác hoặc Tòa án.',documents);
  const extraLabel=collectionGuideElement('label','','Tài liệu bổ sung khác (mỗi dòng một mục)'),extra=collectionGuideElement('textarea','input-premium');extraLabel.htmlFor=extra.id='authorityRequest_extraDocs';extra.rows=3;extra.maxLength=900;extra.dataset.authorityField='extraDocs';extra.value=meta.extraDocs;documents.append(extraLabel,extra);
  const review=collectionGuideElement('label','authority-request-check authority-request-review'),check=collectionGuideElement('input');check.id='authorityRequest_review';check.type='checkbox';
  review.append(check,collectionGuideElement('span','','Tôi đã kiểm tra cơ quan nhận, thông tin vụ tai nạn, GCNBH và các nội dung được chọn trước khi xuất công văn.'));
  check.addEventListener('change',()=>{const current=authorityRequestMeta();current.reviewed=check.checked?authorityRequestReviewToken(current,authorityRequestClaim()):'';scheduleCollectionGuideAutoSave();});
  host.append(grid,details,documents,review);
  host.oninput=event=>{if(event.target.dataset.authorityField && event.target.type!=='checkbox')readAuthorityRequestForm(event.target.dataset.authorityField);};
  host.onchange=event=>{if(event.target.dataset.authorityField)readAuthorityRequestForm(event.target.dataset.authorityField);};
  authorityRequestRefresh();
}
function openAuthorityRequestTab(){closeCollectionWordMenu();switchEditClaimTab('AuthorityRequest');document.getElementById('authorityRequest_recipient')?.focus();}
function authorityRequestSnapshot(requireReview=true) {
  const meta=structuredClone(authorityRequestMeta()),claim=authorityRequestClaim();
  for(const key of Object.keys(meta))if(typeof meta[key]==='string' && key!=='reviewed')meta[key]=meta[key].trim();
  if(!claim.number || !claim.plate)throw new Error('Vui lòng nhập số HSBT và biển số ở tab Hợp đồng & Khách hàng.');
  if(!claim.lossDate || !claim.location)throw new Error('Vui lòng nhập ngày và địa điểm tổn thất ở tab Vụ tổn thất & Diễn biến.');
  for(const [key,label] of authorityRequestFields)if(label.endsWith(' *') && !meta[key])throw new Error('Vui lòng nhập '+label.replace(' *','').toLocaleLowerCase('vi')+'.');
  if(!collectionGuideDate(meta.date))throw new Error('Ngày ban hành không hợp lệ.');
  if(meta.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(meta.email))throw new Error('Email liên hệ không hợp lệ.');
  if(meta.includeConsequence && !meta.consequence)throw new Error('Vui lòng nhập thông tin hậu quả tai nạn đã xác minh.');
  if(meta.includeBasis && !meta.basis)throw new Error('Vui lòng nhập nội dung căn cứ đã chọn.');
  if(!Object.values(meta.selected).some(Boolean) && !meta.extraDocs)throw new Error('Vui lòng chọn ít nhất một nhóm tài liệu hoặc nhập tài liệu bổ sung.');
  const snapshot={meta,claim};if(requireReview)authorityRequestAssertReviewed(snapshot);return snapshot;
}
function authorityRequestAssertReviewed(snapshot){if(snapshot.meta.reviewed!==authorityRequestReviewToken(snapshot.meta,snapshot.claim))throw new Error('Vui lòng tích xác nhận đã kiểm tra nội dung trong tab Trưng cầu hồ sơ.');}
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
  if(authorityRequestBusy)return;authorityRequestBusy=true;
  try{
    const snapshot=savedSnapshot || authorityRequestSnapshot();authorityRequestAssertReviewed(snapshot);
    const blob=await buildAuthorityRequestWord(snapshot),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=('Trung_cau_ho_so_'+snapshot.claim.number).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,180)+'.docx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    triggerToast('Đã xuất công văn trưng cầu hồ sơ.','success');
  }catch(error){if(!savedSnapshot)openAuthorityRequestTab();collectionGuideReport(error);}finally{authorityRequestBusy=false;}
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
    openCollectionDocumentPreview({title,html,claim:snapshot.claim,onExport:()=>exportAuthorityRequestWord(snapshot),onPrint:()=>{try{authorityRequestAssertReviewed(snapshot);printCollectionDocumentHtml(html,title);}catch(error){collectionGuideReport(error);}},onEdit:()=>{closeCollectionGuidePreview();openAuthorityRequestTab();}});
  }catch(error){openAuthorityRequestTab();collectionGuideReport(error);}
}
