const ClaimDocuments = (() => {
  const maxBytes=10*1024*1024, cacheLimit=40*1024*1024;
  const accept='.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt';
  const pending=new Map(), listings=new Map(), binary=new Map();
  let busy=false,operationId='',generation=0,observer=null,sessionOwner='',authUnsubscribe=null,confirmDialog=null;
  const thumbnailQueue=[];let thumbnailWorkers=0;
  let layout='cards',filter='all';
  try { layout=localStorage.getItem('claim-documents-layout')==='list'?'list':'cards'; } catch (_) {}
  const claimId=()=>typeof editingPendingClaimId==='undefined'?'':String(editingPendingClaimId||'');
  const currentUser=()=>firebase.auth().currentUser;
  const endpoint=()=>typeof CONFIG==='undefined'?'':String(CONFIG.CLAIM_DOCUMENTS_ENDPOINT||'').trim();
  const key=id=>(currentUser()?.uid||'')+':'+id;
  const entry=id=>{const idKey=key(id);if(!listings.has(idKey))listings.set(idKey,{files:[],selected:new Set(),loadedAt:0,notice:''});return listings.get(idKey);};
  const isImage=file=>/^image\//i.test(file.mimeType||'')||/\.(jpe?g|png|webp)$/i.test(file.name);
  const fileKind=file=>{const ext=String(file.name||'').split('.').pop().toLowerCase();return isImage(file)?'image':/^(doc|docx)$/.test(ext)?'word':/^(xls|xlsx)$/.test(ext)?'excel':ext==='pdf'?'pdf':ext==='txt'?'text':'other';};
  const element=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
  const button=(text,action,className='sf-button')=>{const node=element('button',text,className);node.type='button';node.onclick=action;return node;};
  const icon=name=>typeof SharedFormsControls==='undefined'?'':SharedFormsControls.icon(name);
  function message(id,text){entry(id).notice=text;if(claimId()===id){const node=document.getElementById('claimDocumentsMessage');if(node)node.textContent=text;}}
  function purge(){confirmDialog?.close('cancel');for(const item of binary.values()){item.disposed=true;if(item.url)URL.revokeObjectURL(item.url);}binary.clear();listings.clear();pending.clear();thumbnailQueue.length=0;observer?.disconnect();}
  function watchAuth(){
    if(authUnsubscribe)return;
    sessionOwner=currentUser()?.uid||'';
    authUnsubscribe=firebase.auth().onAuthStateChanged?.(user=>{
      if((user?.uid||'')===sessionOwner)return;
      sessionOwner=user?.uid||'';purge();generation++;
      SharedFormsViewer.close();
      if(document.getElementById('lightbox')?.classList.contains('claim-document-lightbox'))closeLightbox();
    });
  }
  async function request(action,id,payload={},owner=currentUser()?.uid,signal){
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint()))throw new Error('Kho Drive hồ sơ chưa được kích hoạt.');
    const user=currentUser();if(!user||user.uid!==owner)throw new Error('Phiên đăng nhập đã thay đổi.');
    const token=await user.getIdToken(),timeout=AbortSignal.timeout(180000);
    const response=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,action,claimId:id,token}),credentials:'omit',redirect:'follow',signal:signal?AbortSignal.any([signal,timeout]):timeout});
    if(!response.ok)throw new Error('Không kết nối được kho Drive. Vui lòng thử lại.');
    let result;try{result=await response.json();}catch(_){throw new Error('Dịch vụ Drive chưa được triển khai đúng.');}
    if(currentUser()?.uid!==owner)throw new Error('Phiên đăng nhập đã thay đổi.');
    if(!result.ok)throw new Error(result.error||'Không thể xử lý tài liệu.');
    return result;
  }
  function base64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Không đọc được tệp.'));reader.readAsDataURL(blob);});}
  function validate(blob,name){if(!blob.size||blob.size>maxBytes)throw new Error('Mỗi file cần có nội dung và tối đa 10 MB.');if(!accept.split(',').includes('.'+name.split('.').pop().toLowerCase()))throw new Error('Chọn PDF, Word, Excel, TXT hoặc ảnh JPG, PNG, WebP.');}
  function makeItem(blob,name,id,source){validate(blob,name);return {blob,name,claimId:id,source,owner:currentUser()?.uid,requestId:crypto.randomUUID()};}
  function putFile(id,file){const state=entry(id);state.files=[file,...state.files.filter(item=>item.id!==file.id)];if(state.loadedAt)state.loadedAt=Date.now();}
  function invalidate(id,fileId){for(const [idKey,item]of binary){if(idKey.startsWith(key(id)+':'+fileId+':')){item.disposed=true;if(item.url)URL.revokeObjectURL(item.url);binary.delete(idKey);}}}
  function trimCache(){let total=[...binary.values()].reduce((sum,item)=>sum+(item.blob?.size||0),0);for(const [idKey,item]of binary){if(total<=cacheLimit)break;if(!item.blob)continue;total-=item.blob.size;item.disposed=true;if(item.url)URL.revokeObjectURL(item.url);binary.delete(idKey);}}
  async function readFile(id,file,thumbnail=false,signal){
    const idKey=key(id)+':'+file.id+':'+(thumbnail?'thumb':'original');
    if(binary.has(idKey)){const item=binary.get(idKey);binary.delete(idKey);binary.set(idKey,item);return item.promise;}
    const item={};binary.set(idKey,item);
    item.promise=(async()=>{
      const result=await request(thumbnail?'thumbnail':'download',id,{fileId:file.id},currentUser()?.uid,signal);
      const bytes=Uint8Array.from(atob(result.data),character=>character.charCodeAt(0));
      if(bytes.length>maxBytes)throw new Error('Tệp vượt giới hạn 10 MB.');
      const blob=new Blob([bytes],{type:result.mimeType||file.mimeType});
      if(item.disposed)throw new DOMException('Đã đóng phiên xem','AbortError');
      item.blob=blob;trimCache();return blob;
    })().catch(error=>{if(binary.get(idKey)===item)binary.delete(idKey);throw error;});
    return item.promise;
  }
  async function imageUrl(id,file,thumbnail=false){const blob=await readFile(id,file,thumbnail);const item=binary.get(key(id)+':'+file.id+':'+(thumbnail?'thumb':'original'));if(!item)throw new Error('Ảnh chưa sẵn sàng. Vui lòng thử lại.');return item.url||=(URL.createObjectURL(blob));}
  async function send(item){
    const data=await base64(item.blob),result=await request('upload',item.claimId,{name:item.name,source:item.source,requestId:item.requestId,data},item.owner);
    putFile(item.claimId,result.file);
    binary.set(key(item.claimId)+':'+result.file.id+':original',{blob:item.blob,promise:Promise.resolve(item.blob)});
    if(isImage(result.file))binary.set(key(item.claimId)+':'+result.file.id+':thumb',{blob:item.blob,promise:Promise.resolve(item.blob)});
    trimCache();return result;
  }
  async function download(id,file,node){node.disabled=true;try{const blob=await readFile(id,file),url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(error){message(id,error.message);}finally{node.disabled=false;}}
  function preview(id,file){
    if(isImage(file)){
      const gallery=entry(id).files.filter(isImage),index=gallery.findIndex(item=>item.id===file.id),owner=currentUser()?.uid;
      const container=document.getElementById('lightbox');
      openLightbox(gallery.map(item=>binary.get(key(id)+':'+item.id+':original')?.url||binary.get(key(id)+':'+item.id+':thumb')?.url||''),Math.max(0,index),null,{
        labels:gallery.map(item=>item.name),loadImage:async position=>{if(currentUser()?.uid!==owner)throw new Error('Phiên đăng nhập đã thay đổi.');return imageUrl(id,gallery[position]);},
        onClose:()=>container?.classList.remove('claim-document-lightbox')
      });container?.classList.add('claim-document-lightbox');return;
    }
    const owner=currentUser()?.uid;
    SharedFormsViewer.open({...file,source:'drive',originalName:file.name},null,{loadBytes:async signal=>{if(currentUser()?.uid!==owner)throw new Error('Phiên đăng nhập đã thay đổi.');return (await readFile(id,file,false,signal)).arrayBuffer();}});
  }
  function confirmRemoval(files){
    return new Promise(resolve=>{
      const dialog=element('dialog',null,'sf-dialog claim-document-confirm');
      dialog.setAttribute('aria-labelledby','claimDocumentConfirmTitle');
      dialog.setAttribute('aria-describedby','claimDocumentConfirmMessage');
      const form=element('form',null,'sf-dialog-form'),header=element('header'),titles=element('div');
      titles.append(element('small','TÀI LIỆU HỒ SƠ'));
      const title=element('h2','Xóa '+files.length+' tệp?');title.id='claimDocumentConfirmTitle';titles.append(title);
      const close=button('×',()=>dialog.close('cancel'));close.setAttribute('aria-label','Đóng xác nhận');header.append(titles,close);
      const description=element('p','Các tệp sau sẽ được chuyển vào Thùng rác Google Drive. Bạn có thể khôi phục từ Drive.','claim-document-confirm-note');description.id='claimDocumentConfirmMessage';
      const names=element('ul',null,'claim-document-confirm-files');
      files.slice(0,5).forEach(file=>names.append(element('li',file.name)));
      if(files.length>5)names.append(element('li','Và '+(files.length-5)+' tệp khác…'));
      const footer=element('footer'),cancel=button('Hủy bỏ',()=>dialog.close('cancel'));
      const confirm=button('Chuyển vào Thùng rác',()=>dialog.close('confirm'),'sf-button claim-document-confirm-submit');footer.append(cancel,confirm);
      form.onsubmit=event=>event.preventDefault();form.append(header,description,names,footer);dialog.append(form);
      const returnFocus=document.activeElement;
      dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close('cancel');}});
      dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close('cancel');});
      dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close('cancel');}});
      dialog.addEventListener('close',()=>{if(confirmDialog===dialog)confirmDialog=null;dialog.remove();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});resolve(dialog.returnValue==='confirm');},{once:true});
      document.body.append(dialog);confirmDialog=dialog;dialog.showModal();cancel.focus();
    });
  }
  async function processFiles(id,files,owner,action){
    const state=entry(id),failures=[];let cursor=0;state.total=files.length;state.done=0;
    const worker=async()=>{while(cursor<files.length){
      if(currentUser()?.uid!==owner)return;
      const file=files[cursor++];
      try{await action(file);}catch(error){if(currentUser()?.uid!==owner)return;failures.push({file,error});}
      state.done++;message(id,'Đã xử lý '+state.done+'/'+files.length+' tệp…');paintIfCurrent(id);
    }};
    await Promise.all([worker(),worker()]);return failures;
  }
  async function removeFiles(id,files){
    if(busy||confirmDialog)return;
    const owner=currentUser()?.uid,state=entry(id),allowed=files.filter(canDelete);
    if(!allowed.length)return;
    if(!await confirmRemoval(allowed)||currentUser()?.uid!==owner||claimId()!==id)return;
    busy=true;operationId=id;generation++;state.total=allowed.length;state.done=0;message(id,'Đang chuyển '+allowed.length+' tệp vào Thùng rác…');paintIfCurrent(id);
    try{
      const failures=await processFiles(id,allowed,owner,async file=>{
        await request('remove',id,{fileId:file.id},owner);
        state.files=state.files.filter(item=>item.id!==file.id);state.selected.delete(file.id);invalidate(id,file.id);
      });
      if(currentUser()?.uid!==owner)return;
      message(id,'Đã xóa '+(allowed.length-failures.length)+'/'+allowed.length+' tệp.'+(failures.length?' Chưa xóa được: '+failures.map(item=>item.file.name+' ('+item.error.message+')').join(' · '):' Có thể khôi phục trong Thùng rác Drive.'));
    }finally{busy=false;if(currentUser()?.uid===owner)paintIfCurrent(id);}
  }
  function archiveName(name,used){
    const cleaned=String(name||'tep').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/^\.+/,'_').trim()||'tep';
    let result=cleaned,index=2;const dot=cleaned.lastIndexOf('.'),stem=dot>0?cleaned.slice(0,dot):cleaned,ext=dot>0?cleaned.slice(dot):'';
    while(used.has(result.toLowerCase()))result=stem+' ('+(index++)+')'+ext;
    used.add(result.toLowerCase());return result;
  }
  function saveBlob(blob,name){const url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function downloadSelected(id){
    if(busy)return;
    const owner=currentUser()?.uid,state=entry(id),files=state.files.filter(file=>state.selected.has(file.id));
    if(!files.length)return;
    if(typeof JSZip==='undefined'){message(id,'Chưa tải được công cụ ZIP. Vui lòng tải lại trang.');return;}
    busy=true;operationId=id;generation++;state.total=files.length;state.done=0;message(id,'Đang chuẩn bị '+files.length+' tệp…');paintIfCurrent(id);
    const zip=new JSZip(),used=new Set();let saved=0;
    const names=new Map(files.map(file=>[file.id,archiveName(file.name,used)]));
    try{
      const failures=await processFiles(id,files,owner,async file=>{
        const blob=await readFile(id,file);
        if(currentUser()?.uid!==owner)throw new Error('Phiên đăng nhập đã thay đổi.');
        const bytes=await blob.arrayBuffer();zip.file(names.get(file.id),bytes);saved++;
      });
      if(currentUser()?.uid!==owner)return;
      if(saved){
        message(id,'Đang đóng gói '+saved+' tệp…');
        const blob=await zip.generateAsync({type:'blob',compression:'STORE'});
        if(currentUser()?.uid!==owner)return;
        saveBlob(blob,'Tai-lieu-ho-so_'+id.replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+Date.now()+'.zip');
      }
      message(id,(saved?'Đã tạo ZIP gồm '+saved+'/'+files.length+' tệp.':'Chưa tải được tệp nào.')+(failures.length?' Tệp lỗi: '+failures.map(item=>item.file.name+' ('+item.error.message+')').join(' · '):''));
    }catch(error){if(currentUser()?.uid===owner)message(id,error.message);}
    finally{busy=false;if(currentUser()?.uid===owner)paintIfCurrent(id);}
  }
  function canDelete(file){return !!currentUser()&&(file.uploadedBy===currentUser().uid||(typeof hasUserPermission==='function'&&hasUserPermission('users','admin')));}
  function paintIfCurrent(id){if(claimId()===id)paint(id);}
  function queueThumbnails(tasks){thumbnailQueue.push(...tasks);while(thumbnailWorkers<2&&thumbnailQueue.length){thumbnailWorkers++;void(async()=>{try{while(thumbnailQueue.length)await thumbnailQueue.shift()();}finally{thumbnailWorkers--;}})();}}
  function paint(id){
    observer?.disconnect();const host=document.getElementById('tabPane_Documents');if(!host)return;
    host.replaceChildren();const state=entry(id),files=state.files,images=files.filter(isImage),docs=files.filter(file=>!isImage(file));
    for(const selected of state.selected)if(!files.some(file=>file.id===selected))state.selected.delete(selected);
    const visible=files.filter(file=>filter==='all'||(filter==='images')===isImage(file));
    const card=element('section',null,'claim-editor-form-section claim-documents');
    const header=element('header',null,'claim-documents-heading'),heading=element('div');heading.append(element('h4','Tài liệu hồ sơ'),element('p','Lưu riêng theo hồ sơ trên Google Drive'));header.append(heading);
    const totals=element('span',files.length+' tệp · '+images.length+' ảnh · '+docs.length+' tài liệu','claim-documents-total');header.append(totals);
    const body=element('div',null,'claim-documents-body'),tools=element('div',null,'claim-documents-tools');
    const label=element('label',null,'sf-button sf-primary');label.innerHTML=icon('upload');label.append(element('span','Tải file lên'));
    const input=element('input');input.id='claimDocumentsFiles';input.type='file';input.multiple=true;input.accept=accept;input.disabled=busy||!id||!endpoint()||!state.loadedAt;
    input.onchange=()=>{const selected=[...input.files];if(selected.length)void upload(selected,id);};label.append(input);
    const refresh=button('Làm mới',()=>render(true));refresh.disabled=busy;tools.append(label,refresh);
    const modes=element('div',null,'claim-documents-modes');modes.setAttribute('aria-label','Kiểu hiển thị');
    for(const [mode,name,glyph]of[['list','Danh sách','sort'],['cards','Thẻ','grid']]){const toggle=button('',()=>{layout=mode;try{localStorage.setItem('claim-documents-layout',mode);}catch(_){}paint(id);});toggle.innerHTML=icon(glyph);toggle.append(element('span',name));toggle.setAttribute('aria-pressed',String(layout===mode));modes.append(toggle);}tools.append(modes);body.append(tools);
    const tabs=element('div',null,'claim-documents-filters');for(const [value,name,count]of[['all','Tất cả',files.length],['images','Hình ảnh',images.length],['documents','Tài liệu',docs.length]]){const tab=button(name+' ('+count+')',()=>{filter=value;paint(id);});tab.setAttribute('aria-pressed',String(filter===value));tabs.append(tab);}body.append(tabs);
    const selection=element('div',null,'claim-documents-selection'),selectLabel=element('label',null,'claim-documents-select-all'),selectAll=element('input');
    selectAll.type='checkbox';selectAll.disabled=busy||!visible.length;selectAll.setAttribute('aria-label','Chọn tất cả tệp đang hiển thị');selectLabel.append(selectAll,element('span','Chọn tất cả đang hiển thị'));
    const count=element('span',null,'claim-documents-selection-count'),clear=button('Bỏ chọn',()=>{state.selected.clear();syncSelection();});
    const zip=button('',()=>downloadSelected(id),'sf-button sf-primary');zip.innerHTML=icon('download');zip.append(element('span','Tải ZIP'));
    const trash=button('',()=>removeFiles(id,files.filter(file=>state.selected.has(file.id))),'sf-button claim-documents-bulk-delete');
    selection.append(selectLabel,count,clear,zip,trash);body.append(selection);
    function syncSelection(){
      const selected=files.filter(file=>state.selected.has(file.id)),deletable=selected.filter(canDelete).length,visibleSelected=visible.filter(file=>state.selected.has(file.id)).length;
      selectAll.checked=!!visible.length&&visibleSelected===visible.length;selectAll.indeterminate=visibleSelected>0&&visibleSelected<visible.length;
      count.textContent='Đã chọn '+selected.length+(selected.length>visibleSelected?' · '+(selected.length-visibleSelected)+' ngoài bộ lọc':'');
      clear.disabled=busy||!selected.length;zip.disabled=busy||!selected.length;trash.disabled=busy||!deletable;trash.textContent='Xóa'+(deletable?' ('+deletable+')':'');
      trash.title=selected.length>deletable?'Chỉ xóa '+deletable+' tệp bạn có quyền xóa':'Chuyển tệp đã chọn vào Thùng rác';
      for(const checkbox of body.querySelectorAll('[data-claim-file]')){checkbox.checked=state.selected.has(checkbox.dataset.claimFile);checkbox.closest('.claim-document-item').classList.toggle('is-selected',checkbox.checked);}
    }
    selectAll.onchange=()=>{for(const file of visible)if(selectAll.checked)state.selected.add(file.id);else state.selected.delete(file.id);syncSelection();};
    const status=element('p',state.notice||files.length+' tệp đã lưu trên Drive.','claim-documents-status');status.id='claimDocumentsMessage';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
    if(busy){const progress=element('progress');progress.max=state.total||1;progress.value=state.done||0;progress.setAttribute('aria-label','Tiến trình xử lý tệp');body.append(progress);}
    body.append(element('p','PDF, Word, Excel, TXT và ảnh · Tối đa 10 MB/file · Giữ nguyên file gốc','claim-editor-hint'));
    const thumbTasks=[];
    const list=element('div',null,'claim-documents-groups');
    for(const [type,title,items]of[['images','Hình ảnh',images],['documents','Tài liệu',docs]]){
      if(filter!=='all'&&filter!==type)continue;
      const section=element('section',null,'claim-documents-group');section.append(element('h5',title+' · '+items.length));
      const rows=element('div',null,'claim-documents-items is-'+layout);
      if(!items.length)rows.append(element('p','Chưa có '+title.toLowerCase()+'.','claim-documents-empty'));
      for(const file of items){
        const row=element('article',null,'claim-document-item file-kind-'+fileKind(file)),visual=button('',()=>preview(id,file),'claim-document-visual');visual.setAttribute('aria-label','Xem '+file.name);
        const select=element('label',null,'claim-document-select'),checkbox=element('input');checkbox.type='checkbox';checkbox.dataset.claimFile=file.id;checkbox.setAttribute('aria-label','Chọn '+file.name);checkbox.disabled=busy;checkbox.onchange=()=>{if(checkbox.checked)state.selected.add(file.id);else state.selected.delete(file.id);syncSelection();};select.append(checkbox);
        if(type==='images'){
          const img=element('img');img.alt=file.name;img.loading='lazy';visual.append(img);
          const task=async()=>{if(!row.isConnected)return;try{const url=await imageUrl(id,file,true);if(row.isConnected)img.src=url;}catch(_){if(row.isConnected){visual.textContent='Ảnh';visual.title='Bấm Xem để mở ảnh gốc';}}};
          thumbTasks.push({visual,task});
        }else{const glyph=element('span',null,'claim-document-file-icon');glyph.innerHTML=icon('file');glyph.append(element('b',({word:'W',excel:'X',pdf:'PDF',text:'TXT'})[fileKind(file)]||'FILE'));visual.append(glyph);visual.append(element('span',(file.name.split('.').pop()||'FILE').toUpperCase()));}
        const copy=element('div',null,'claim-document-copy');copy.append(element('strong',file.name),element('p',Math.ceil(file.size/1024)+' KB · '+new Date(file.createdAt).toLocaleString('vi-VN')),element('span',file.source==='word'?'Word đã xuất':'Tải lên','claim-document-source'));
        const actions=element('div',null,'claim-document-actions');actions.append(button('Xem',()=>preview(id,file)));
        const save=button('Tải xuống',()=>download(id,file,save));save.disabled=busy;actions.append(save);
        if(canDelete(file)){const trash=button('',()=>removeFiles(id,[file]),'sf-button claim-document-delete');trash.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';trash.title='Xóa '+file.name;trash.setAttribute('aria-label','Xóa '+file.name);trash.disabled=busy;actions.append(trash);}
        row.append(select,visual,copy,actions);rows.append(row);
      }section.append(rows);list.append(section);
    }body.append(list);
    for(const item of pending.values())if(item.claimId===id&&item.owner===currentUser()?.uid){const row=element('div',null,'claim-document-pending');row.append(element('span',item.name+' · Chưa lưu Drive'));const retry=button('Thử lại',async()=>{retry.disabled=true;try{await send(item);pending.delete(item.requestId);message(id,'Đã lưu tệp.');paintIfCurrent(id);}catch(error){message(id,error.message);retry.disabled=false;}});retry.disabled=busy;row.append(retry);body.append(row);}
    syncSelection();card.append(header,body);host.append(card);
    if(typeof IntersectionObserver==='function'){const jobs=new Map(thumbTasks.map(item=>[item.visual,item.task]));let jobsPending=[],scheduled=false;observer=new IntersectionObserver(entries=>{for(const item of entries)if(item.isIntersecting){observer?.unobserve(item.target);const task=jobs.get(item.target);if(task){jobs.delete(item.target);jobsPending.push(task);}}if(!scheduled){scheduled=true;queueMicrotask(()=>{const current=jobsPending;jobsPending=[];scheduled=false;queueThumbnails(current);});}},{rootMargin:'100px'});thumbTasks.forEach(item=>observer.observe(item.visual));}
    else queueThumbnails(thumbTasks.map(item=>item.task));
  }
  async function render(force=false){
    watchAuth();const id=claimId();if(busy&&operationId===id){paint(id);return;}const version=++generation,state=entry(id);paint(id);
    if(!id){message(id,'Lưu hồ sơ trước khi thêm tài liệu.');return;}
    if(!endpoint()){message(id,'Kho Drive hồ sơ đang chờ kết nối.');return;}
    if(!force&&state.loadedAt&&Date.now()-state.loadedAt<60000)return;
    message(id,state.loadedAt?'Đang cập nhật danh sách…':'Đang tải danh sách…');
    try{const result=await request('list',id);if(version!==generation||claimId()!==id)return;state.files=result.files.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));state.loadedAt=Date.now();state.notice='';paint(id);}
    catch(error){if(version===generation)message(id,error.message);}
  }
  async function upload(files,id){
    if(busy)return;busy=true;operationId=id;generation++;const owner=currentUser()?.uid,state=entry(id);state.total=files.length;state.done=0;let cursor=0;const errors=[];
    message(id,'Đang tải '+files.length+' file lên Drive…');paintIfCurrent(id);
    const worker=async()=>{while(cursor<files.length){if(currentUser()?.uid!==owner)return;const file=files[cursor++];let item;try{item=makeItem(file,file.name,id,'upload');await send(item);}catch(error){if(currentUser()?.uid!==owner)return;if(item)pending.set(item.requestId,item);errors.push(file.name+': '+error.message);}state.done++;message(id,'Đã xử lý '+state.done+'/'+files.length+' file');paintIfCurrent(id);}};
    try{await Promise.all([worker(),worker()]);}finally{busy=false;if(currentUser()?.uid===owner){message(id,errors.length?errors.join(' · '):'Đã lưu '+files.length+' file vào Drive.');paintIfCurrent(id);}}
  }
  async function saveWord(blob,name,context){
    if(!endpoint()||context.owner!==currentUser()?.uid)return;
    if(!context.id){triggerToast('Word đã tải về máy. Lưu hồ sơ trước để lưu thêm lên Drive.','warning');return;}
    let item;try{item=makeItem(blob,name,context.id,'word');await send(item);paintIfCurrent(context.id);triggerToast('Đã lưu Word vào Drive của hồ sơ.','success');}
    catch(error){if(context.owner!==currentUser()?.uid)return;if(item)pending.set(item.requestId,item);message(context.id,error.message);paintIfCurrent(context.id);triggerToast('Word chưa lưu Drive. Mở Tài liệu hồ sơ để thử lại.','warning');}
  }
  return {render,saveWord,capture:()=>({id:claimId(),owner:currentUser()?.uid})};
})();
