const ClaimDocuments = (() => {
  const maxBytes=10*1024*1024, cacheLimit=40*1024*1024;
  const accept='.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt';
  const LIST_FRESH_MS=60000;          // Danh sách coi là mới trong 60 giây (nút Làm mới luôn đọc lại Drive).
  const THUMB_BATCH=8, THUMB_WORKERS=2;
  const pending=new Map(), listings=new Map(), binary=new Map();
  let busy=false,operationId='',generation=0,observer=null,sessionOwner='',authUnsubscribe=null,confirmDialog=null;
  let layout='cards',filter='all',query='';
  // null = chưa biết; false = Apps Script đang chạy bản cũ chưa có thao tác 'thumbnails' → dùng từng ảnh.
  let batchThumbnails=null;
  const thumbQueue=[];let thumbWorkers=0;
  try { layout=localStorage.getItem('claim-documents-layout')==='list'?'list':'cards'; } catch (_) {}

  const claimId=()=>typeof editingPendingClaimId==='undefined'?'':String(editingPendingClaimId||'');
  const currentUser=()=>firebase.auth().currentUser;
  const endpoint=()=>typeof CONFIG==='undefined'?'':String(CONFIG.CLAIM_DOCUMENTS_ENDPOINT||'').trim();
  const key=id=>(currentUser()?.uid||'')+':'+id;
  const binaryKey=(id,fileId,thumbnail)=>key(id)+':'+fileId+':'+(thumbnail?'thumb':'original');
  const entry=id=>{const idKey=key(id);if(!listings.has(idKey))listings.set(idKey,{files:[],selected:new Set(),loadedAt:0,notice:'',loading:null,error:''});return listings.get(idKey);};
  const isImage=file=>/^image\//i.test(file.mimeType||'')||/\.(jpe?g|png|webp)$/i.test(file.name);
  const extension=file=>(String(file.name||'').split('.').pop()||'').toLowerCase();
  const fileKind=file=>{const ext=extension(file);return isImage(file)?'image':/^(doc|docx)$/.test(ext)?'word':/^(xls|xlsx)$/.test(ext)?'excel':ext==='pdf'?'pdf':ext==='txt'?'text':'other';};
  const normalize=text=>String(text||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toLowerCase();
  const formatSize=bytes=>{const n=Number(bytes)||0;return n<1024*1024?Math.max(1,Math.round(n/1024)).toLocaleString('vi-VN')+' KB':(n/1024/1024).toLocaleString('vi-VN',{maximumFractionDigits:1})+' MB';};
  const formatDate=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
  const formatTime=value=>new Date(value).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});

  const ICONS={
    upload:'<path d="M12 15V4m0 0-4 4m4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14.9-3.9L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3.9L20 15"/><path d="M20 20v-5h-5"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    eye:'<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/>',
    download:'<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    cloud:'<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18Z"/><path d="M12 11v5m0-5-2 2m2-2 2 2"/>',
    alert:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/>',
    close:'<path d="M18 6 6 18M6 6l12 12"/>',
    archive:'<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>'
  };
  const svg=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[name]||ICONS.file)+'</svg>';
  const element=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
  // Nút có icon + nhãn; data-cd-focus giúp giữ tiêu điểm bàn phím khi giao diện được vẽ lại.
  const button=(label,action,className='cd-btn',iconName='',focusKey='')=>{
    const node=element('button',null,className);node.type='button';node.onclick=action;
    if(iconName)node.insertAdjacentHTML('beforeend',svg(iconName));
    if(label)node.append(element('span',label));
    if(focusKey)node.dataset.cdFocus=focusKey;
    return node;
  };
  const iconButton=(iconName,label,action,className='cd-icon-btn',focusKey='')=>{const node=button('',action,className,iconName,focusKey);node.title=label;node.setAttribute('aria-label',label);return node;};

  function message(id,text){entry(id).notice=text;if(claimId()===id){const node=document.getElementById('claimDocumentsMessage');if(node){node.textContent=text;node.hidden=!text;}}}
  function purge(){confirmDialog?.close('cancel');for(const item of binary.values()){item.disposed=true;if(item.url)URL.revokeObjectURL(item.url);}binary.clear();listings.clear();pending.clear();thumbQueue.length=0;observer?.disconnect();}
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
  const decode=data=>Uint8Array.from(atob(data),character=>character.charCodeAt(0));
  function validate(blob,name){if(!blob.size||blob.size>maxBytes)throw new Error('Mỗi file cần có nội dung và tối đa 10 MB.');if(!accept.split(',').includes('.'+name.split('.').pop().toLowerCase()))throw new Error('Chọn PDF, Word, Excel, TXT hoặc ảnh JPG, PNG, WebP.');}
  function makeItem(blob,name,id,source){validate(blob,name);return {blob,name,claimId:id,source,owner:currentUser()?.uid,requestId:crypto.randomUUID()};}
  function putFile(id,file){const state=entry(id);state.files=[file,...state.files.filter(item=>item.id!==file.id)];if(state.loadedAt)state.loadedAt=Date.now();}
  function invalidate(id,fileId){for(const [idKey,item]of binary){if(idKey.startsWith(key(id)+':'+fileId+':')){item.disposed=true;if(item.url)URL.revokeObjectURL(item.url);binary.delete(idKey);}}}
  function trimCache(){let total=[...binary.values()].reduce((sum,item)=>sum+(item.blob?.size||0),0);for(const [idKey,item]of binary){if(total<=cacheLimit)break;if(!item.blob)continue;total-=item.blob.size;item.disposed=true;if(item.url)URL.revokeObjectURL(item.url);binary.delete(idKey);}}
  function storeBlob(idKey,blob){const item={blob,promise:Promise.resolve(blob)};binary.set(idKey,item);trimCache();return item;}
  async function readFile(id,file,thumbnail=false,signal){
    const idKey=binaryKey(id,file.id,thumbnail);
    if(binary.has(idKey)){const item=binary.get(idKey);binary.delete(idKey);binary.set(idKey,item);return item.promise;}
    const item={};binary.set(idKey,item);
    item.promise=(async()=>{
      const result=await request(thumbnail?'thumbnail':'download',id,{fileId:file.id},currentUser()?.uid,signal);
      const bytes=decode(result.data);
      if(bytes.length>maxBytes)throw new Error('Tệp vượt giới hạn 10 MB.');
      const blob=new Blob([bytes],{type:result.mimeType||file.mimeType});
      if(item.disposed)throw new DOMException('Đã đóng phiên xem','AbortError');
      item.blob=blob;trimCache();return blob;
    })().catch(error=>{if(binary.get(idKey)===item)binary.delete(idKey);throw error;});
    return item.promise;
  }
  function cachedUrl(id,file,thumbnail){const item=binary.get(binaryKey(id,file.id,thumbnail));if(!item?.blob)return '';return item.url||=(URL.createObjectURL(item.blob));}
  async function imageUrl(id,file,thumbnail=false){await readFile(id,file,thumbnail);const url=cachedUrl(id,file,thumbnail);if(!url)throw new Error('Ảnh chưa sẵn sàng. Vui lòng thử lại.');return url;}

  // ---- Ảnh thu nhỏ theo lô -------------------------------------------------------------------
  // Trước đây mỗi ảnh = 1 request Apps Script (mỗi request tự xác thực + tìm thư mục). Giờ gom tối đa
  // THUMB_BATCH ảnh/request, chạy THUMB_WORKERS lô song song; tự lùi về cách cũ nếu máy chủ chưa cập nhật.
  function thumbnailUrl(id,file){
    const ready=cachedUrl(id,file,true)||cachedUrl(id,file,false);
    if(ready)return Promise.resolve(ready);
    if(batchThumbnails===false)return imageUrl(id,file,true);
    const idKey=binaryKey(id,file.id,true);
    if(binary.has(idKey))return binary.get(idKey).promise.then(()=>cachedUrl(id,file,true));
    return new Promise((resolve,reject)=>{
      const item={};item.promise=new Promise((done,fail)=>{item.resolve=done;item.reject=fail;});item.promise.catch(()=>{});
      binary.set(idKey,item);
      thumbQueue.push({id,file,owner:currentUser()?.uid,item,resolve,reject});schedulePump();
    });
  }
  // Hoãn sang lượt kế tiếp để mọi ảnh vừa lọt khung nhìn kịp xếp hàng → gửi thành một lô thay vì 1+1+n.
  let pumpScheduled=false;
  function schedulePump(){if(pumpScheduled)return;pumpScheduled=true;setTimeout(()=>{pumpScheduled=false;pumpThumbnails();},0);}
  function pumpThumbnails(){
    while(thumbWorkers<THUMB_WORKERS&&thumbQueue.length){
      thumbWorkers++;
      void(async()=>{try{while(thumbQueue.length){
        const first=thumbQueue[0],batch=[];
        while(thumbQueue.length&&batch.length<THUMB_BATCH&&thumbQueue[0].id===first.id&&thumbQueue[0].owner===first.owner)batch.push(thumbQueue.shift());
        await runThumbnailBatch(batch);
      }}finally{thumbWorkers--;}})();
    }
  }
  async function runThumbnailBatch(batch){
    const {id,owner}=batch[0];
    const settle=(job,error)=>{if(error){if(binary.get(binaryKey(id,job.file.id,true))===job.item)binary.delete(binaryKey(id,job.file.id,true));job.item.reject(error);job.reject(error);}};
    // Lùi về thao tác 'thumbnail' từng ảnh; vẫn hoàn tất promise của mục chờ để không ai treo.
    const single=job=>{binary.delete(binaryKey(id,job.file.id,true));imageUrl(id,job.file,true).then(url=>{job.item.resolve(null);job.resolve(url);},error=>{job.item.reject(error);job.reject(error);});};
    if(batchThumbnails===false){batch.forEach(single);return;}
    try{
      const result=await request('thumbnails',id,{fileIds:batch.map(job=>job.file.id)},owner);
      batchThumbnails=true;
      const byId=new Map((result.items||[]).map(item=>[item.id,item]));
      for(const job of batch){
        const item=byId.get(job.file.id);
        if(!item?.ok){settle(job,new Error('Chưa có ảnh thu nhỏ.'));continue;}
        const blob=new Blob([decode(item.data)],{type:item.mimeType||'image/jpeg'});
        job.item.blob=blob;job.item.promise=Promise.resolve(blob);job.item.resolve(blob);trimCache();
        job.resolve(cachedUrl(id,job.file,true));
      }
    }catch(error){
      if(/Thao tác không hợp lệ/.test(error.message)&&batchThumbnails===null){
        batchThumbnails=false;batch.forEach(single);return;
      }
      for(const job of batch)settle(job,error);
    }
  }

  async function send(item){
    const data=await base64(item.blob),result=await request('upload',item.claimId,{name:item.name,source:item.source,requestId:item.requestId,data},item.owner);
    putFile(item.claimId,result.file);
    storeBlob(binaryKey(item.claimId,result.file.id,false),item.blob);
    if(isImage(result.file))storeBlob(binaryKey(item.claimId,result.file.id,true),item.blob);
    return result;
  }
  function saveBlob(blob,name){const url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function download(id,file,node){node.disabled=true;node.classList.add('is-working');try{saveBlob(await readFile(id,file),file.name);}catch(error){message(id,error.message);}finally{node.disabled=false;node.classList.remove('is-working');}}
  function preview(id,file){
    if(isImage(file)){
      const gallery=entry(id).files.filter(isImage),index=gallery.findIndex(item=>item.id===file.id),owner=currentUser()?.uid;
      const container=document.getElementById('lightbox');
      openLightbox(gallery.map(item=>cachedUrl(id,item,false)||cachedUrl(id,item,true)||''),Math.max(0,index),null,{
        labels:gallery.map(item=>item.name),loadImage:async position=>{if(currentUser()?.uid!==owner)throw new Error('Phiên đăng nhập đã thay đổi.');return imageUrl(id,gallery[position]);},
        onClose:()=>container?.classList.remove('claim-document-lightbox')
      });container?.classList.add('claim-document-lightbox');return;
    }
    const owner=currentUser()?.uid;
    SharedFormsViewer.open({...file,source:'drive',originalName:file.name},null,{loadBytes:async signal=>{if(currentUser()?.uid!==owner)throw new Error('Phiên đăng nhập đã thay đổi.');return (await readFile(id,file,false,signal)).arrayBuffer();}});
  }
  async function confirmRemoval(files){
    let dialog;
    try{return await showPremiumConfirmModal({
      eyebrow:'TÀI LIỆU HỒ SƠ',title:'Xóa '+files.length+' tệp?',
      message:'Các tệp sau sẽ được chuyển vào Thùng rác Google Drive. Bạn có thể khôi phục từ Drive.',
      items:files.map(file=>file.name),confirmText:'Chuyển vào Thùng rác',
      onOpen:node=>{dialog=node;confirmDialog=node;}
    });}finally{if(confirmDialog===dialog)confirmDialog=null;}
  }
  async function processFiles(id,files,owner,action){
    const state=entry(id),failures=[];let cursor=0;state.total=files.length;state.done=0;
    const worker=async()=>{while(cursor<files.length){
      if(currentUser()?.uid!==owner)return;
      const file=files[cursor++];
      try{await action(file);}catch(error){if(currentUser()?.uid!==owner)return;failures.push({file,error});}
      state.done++;message(id,'Đã xử lý '+state.done+'/'+files.length+' tệp…');updateProgress(id);
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
        zip.file(names.get(file.id),await blob.arrayBuffer());saved++;
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
  // Cập nhật thanh tiến trình tại chỗ, không dựng lại toàn bộ danh sách ở mỗi tệp.
  function updateProgress(id){if(claimId()!==id)return;const bar=document.getElementById('claimDocumentsProgress'),state=entry(id);if(bar){bar.max=state.total||1;bar.value=state.done||0;}else paint(id);}

  // ---- Giao diện -----------------------------------------------------------------------------
  const canUpload=(id,state)=>!busy&&!!id&&!!endpoint()&&!!state.loadedAt;
  function fileVisual(id,file,thumbTasks){
    const visual=button('',()=>preview(id,file),'cd-visual');visual.setAttribute('aria-label','Xem '+file.name);
    if(isImage(file)){
      const img=element('img');img.alt='';img.decoding='async';visual.append(img);visual.classList.add('is-loading');
      const ready=cachedUrl(id,file,true)||cachedUrl(id,file,false);
      if(ready){img.src=ready;visual.classList.remove('is-loading');}
      else thumbTasks.push({visual,task:async()=>{
        try{const url=await thumbnailUrl(id,file);if(visual.isConnected&&url){img.src=url;await img.decode?.().catch(()=>{});}}
        catch(_){if(visual.isConnected){img.remove();visual.insertAdjacentHTML('beforeend',svg('image'));visual.classList.add('is-fallback');visual.title='Bấm để mở ảnh gốc';}}
        finally{visual.classList.remove('is-loading');}
      }});
    }else{
      const glyph=element('span',null,'cd-file-glyph');glyph.innerHTML=svg('file');
      glyph.append(element('b',({word:'DOC',excel:'XLS',pdf:'PDF',text:'TXT'})[fileKind(file)]||extension(file).toUpperCase().slice(0,4)||'FILE'));
      visual.append(glyph);
    }
    return visual;
  }
  function fileItem(id,file,state,thumbTasks,onSelect){
    const kind=fileKind(file),row=element('article',null,'cd-item kind-'+kind);row.dataset.fileId=file.id;
    if(state.selected.has(file.id))row.classList.add('is-selected');
    const select=element('label',null,'cd-check'),checkbox=element('input');
    checkbox.type='checkbox';checkbox.dataset.claimFile=file.id;checkbox.checked=state.selected.has(file.id);checkbox.disabled=busy;checkbox.setAttribute('aria-label','Chọn '+file.name);
    checkbox.onchange=()=>{if(checkbox.checked)state.selected.add(file.id);else state.selected.delete(file.id);onSelect();};
    select.append(checkbox,element('span',null,'cd-check-box'));
    const badge=element('span',isImage(file)?extension(file).toUpperCase().replace('JPEG','JPG'):({word:'Word',excel:'Excel',pdf:'PDF',text:'TXT'})[kind]||extension(file).toUpperCase(),'cd-badge');
    const copy=element('div',null,'cd-copy'),name=element('strong',file.name);name.title=file.name;
    const meta=element('p',null,'cd-meta');meta.append(element('span',formatSize(file.size)),element('span',formatDate(file.createdAt)));
    copy.append(name,meta);
    const source=element('span',file.source==='word'?'Word đã xuất':'Tải lên','cd-source'+(file.source==='word'?' is-word':''));
    const actions=element('div',null,'cd-actions');
    actions.append(iconButton('eye','Xem '+file.name,()=>preview(id,file)));
    const save=iconButton('download','Tải xuống '+file.name,()=>download(id,file,save));save.disabled=busy;actions.append(save);
    if(canDelete(file)){const trash=iconButton('trash','Xóa '+file.name,()=>removeFiles(id,[file]),'cd-icon-btn is-danger');trash.disabled=busy;actions.append(trash);}
    const footer=element('div',null,'cd-item-footer');footer.append(source,actions);
    row.append(select,fileVisual(id,file,thumbTasks),badge,copy,footer);
    return row;
  }
  function skeleton(){
    const rows=element('div',null,'cd-items is-'+layout+' is-skeleton');rows.setAttribute('aria-hidden','true');
    for(let index=0;index<(layout==='list'?4:6);index++){const item=element('div',null,'cd-item cd-skeleton');item.append(element('span',null,'cd-sk-visual'),element('span',null,'cd-sk-line'),element('span',null,'cd-sk-line is-short'));rows.append(item);}
    return rows;
  }
  function emptyState(iconName,title,text,action){
    const box=element('div',null,'cd-empty');const glyph=element('span',null,'cd-empty-icon');glyph.innerHTML=svg(iconName);
    box.append(glyph,element('strong',title),element('p',text));if(action)box.append(action);return box;
  }
  function paint(id){
    observer?.disconnect();const host=document.getElementById('tabPane_Documents');if(!host)return;
    const focused=document.activeElement?.dataset?.cdFocus,caret=document.activeElement?.selectionStart;
    host.replaceChildren();
    const state=entry(id),files=state.files,images=files.filter(isImage),docs=files.filter(file=>!isImage(file));
    for(const selected of state.selected)if(!files.some(file=>file.id===selected))state.selected.delete(selected);
    const needle=normalize(query.trim());
    const visible=files.filter(file=>(filter==='all'||(filter==='images')===isImage(file))&&(!needle||normalize(file.name).includes(needle)));
    const loading=!!state.loading&&!state.loadedAt, uploadable=canUpload(id,state);

    const card=element('section',null,'claim-editor-form-section claim-documents');
    // Đầu thẻ: tiêu đề + chỉ số
    const header=element('header',null,'cd-header'),title=element('div',null,'cd-title'),emblem=element('span',null,'cd-emblem');emblem.innerHTML=svg('folder');
    const heading=element('div');heading.append(element('h4','Tài liệu hồ sơ'),element('p',state.loadedAt?'Google Drive · đồng bộ lúc '+formatTime(state.loadedAt):'Lưu riêng theo hồ sơ trên Google Drive'));
    title.append(emblem,heading);
    const stats=element('dl',null,'cd-stats');
    const totalBytes=files.reduce((sum,file)=>sum+(Number(file.size)||0),0);
    for(const [label,value]of[['Tệp',files.length],['Hình ảnh',images.length],['Tài liệu',docs.length],['Dung lượng',files.length?formatSize(totalBytes):'—']]){const stat=element('div',null,'cd-stat');stat.append(element('dt',label),element('dd',loading?'—':String(value)));stats.append(stat);}
    header.append(title,stats);

    const body=element('div',null,'cd-body');
    // Thanh công cụ
    const tools=element('div',null,'cd-toolbar');
    const uploadLabel=element('label',null,'cd-btn is-primary');uploadLabel.insertAdjacentHTML('beforeend',svg('upload'));uploadLabel.append(element('span','Tải file lên'));
    const input=element('input');input.id='claimDocumentsFiles';input.type='file';input.multiple=true;input.accept=accept;input.disabled=!uploadable;input.dataset.cdFocus='upload';
    input.onchange=()=>{const selected=[...input.files];if(selected.length)void upload(selected,id);};uploadLabel.append(input);
    const refresh=iconButton('refresh','Làm mới danh sách từ Drive',()=>render(true),'cd-icon-btn is-bordered'+(state.loading?' is-spinning':''),'refresh');refresh.disabled=busy||!!state.loading;
    const search=element('label',null,'cd-search');search.insertAdjacentHTML('beforeend',svg('search'));
    const searchInput=element('input');searchInput.type='search';searchInput.placeholder='Tìm theo tên tệp…';searchInput.value=query;searchInput.dataset.cdFocus='search';searchInput.setAttribute('aria-label','Tìm tài liệu theo tên');
    searchInput.oninput=()=>{query=searchInput.value;paint(id);};search.append(searchInput);
    const segments=element('div',null,'cd-segments');segments.setAttribute('role','group');segments.setAttribute('aria-label','Lọc loại tệp');
    for(const [value,name,count]of[['all','Tất cả',files.length],['images','Hình ảnh',images.length],['documents','Tài liệu',docs.length]]){
      const tab=button(name,()=>{filter=value;paint(id);},'cd-segment','', 'filter-'+value);tab.append(element('em',loading?'·':String(count)));tab.setAttribute('aria-pressed',String(filter===value));segments.append(tab);
    }
    const modes=element('div',null,'cd-segments is-icons');modes.setAttribute('role','group');modes.setAttribute('aria-label','Kiểu hiển thị');
    for(const [mode,name,glyph]of[['cards','Dạng thẻ','grid'],['list','Dạng danh sách','list']]){
      const toggle=iconButton(glyph,name,()=>{layout=mode;try{localStorage.setItem('claim-documents-layout',mode);}catch(_){}paint(id);},'cd-segment','layout-'+mode);toggle.setAttribute('aria-pressed',String(layout===mode));modes.append(toggle);
    }
    tools.append(uploadLabel,refresh,search,segments,modes);body.append(tools);

    // Thông báo + tiến trình
    const status=element('p',state.notice,'cd-status'+(state.error?' is-error':''));status.id='claimDocumentsMessage';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=!state.notice;body.append(status);
    if(busy&&operationId===id){const progress=element('progress');progress.id='claimDocumentsProgress';progress.max=state.total||1;progress.value=state.done||0;progress.setAttribute('aria-label','Tiến trình xử lý tệp');body.append(progress);}

    // Hàng chọn + thao tác hàng loạt
    const selectionBar=element('div',null,'cd-selection'),selectLabel=element('label',null,'cd-check is-inline'),selectAll=element('input');
    selectAll.type='checkbox';selectAll.disabled=busy||!visible.length;selectAll.dataset.cdFocus='select-all';selectAll.setAttribute('aria-label','Chọn tất cả tệp đang hiển thị');
    selectLabel.append(selectAll,element('span',null,'cd-check-box'),element('span','Chọn tất cả'));
    const count=element('span',null,'cd-selection-count');
    const bulk=element('div',null,'cd-bulk');
    const clear=button('Bỏ chọn',()=>{state.selected.clear();syncSelection();},'cd-btn is-ghost','close','bulk-clear');
    const zip=button('Tải ZIP',()=>downloadSelected(id),'cd-btn','archive','bulk-zip');
    const trash=button('Xóa',()=>removeFiles(id,files.filter(file=>state.selected.has(file.id))),'cd-btn is-danger','trash','bulk-delete');
    bulk.append(clear,zip,trash);selectionBar.append(selectLabel,count,bulk);
    const results=element('div',null,'cd-results');
    function syncSelection(){
      const selected=files.filter(file=>state.selected.has(file.id)),deletable=selected.filter(canDelete).length,visibleSelected=visible.filter(file=>state.selected.has(file.id)).length;
      selectAll.checked=!!visible.length&&visibleSelected===visible.length;selectAll.indeterminate=visibleSelected>0&&visibleSelected<visible.length;
      count.textContent=selected.length?'Đã chọn '+selected.length+' tệp'+(selected.length>visibleSelected?' · '+(selected.length-visibleSelected)+' ngoài bộ lọc':''):(needle||filter!=='all'?visible.length+'/'+files.length+' tệp':files.length+' tệp');
      selectionBar.classList.toggle('has-selection',!!selected.length);bulk.hidden=!selected.length;
      clear.disabled=busy;zip.disabled=busy;trash.disabled=busy||!deletable;trash.querySelector('span').textContent='Xóa'+(deletable?' ('+deletable+')':'');
      trash.title=selected.length>deletable?'Chỉ xóa '+deletable+' tệp bạn có quyền xóa':'Chuyển tệp đã chọn vào Thùng rác Drive';
      for(const checkbox of results.querySelectorAll('[data-claim-file]')){checkbox.checked=state.selected.has(checkbox.dataset.claimFile);checkbox.closest('.cd-item').classList.toggle('is-selected',checkbox.checked);}
      results.classList.toggle('is-selecting',!!selected.length);
    }
    selectAll.onchange=()=>{for(const file of visible)if(selectAll.checked)state.selected.add(file.id);else state.selected.delete(file.id);syncSelection();};

    // Kết quả
    const thumbTasks=[];
    if(!id)results.append(emptyState('folder','Hồ sơ chưa được lưu','Lưu hồ sơ trước khi thêm tài liệu. Tài liệu được lưu riêng theo từng hồ sơ.'));
    else if(!endpoint())results.append(emptyState('cloud','Kho Drive đang chờ kết nối','Quản trị viên cần cấu hình dịch vụ lưu trữ tài liệu hồ sơ.'));
    else if(loading)results.append(skeleton());
    else if(!state.loadedAt&&state.error)results.append(emptyState('alert','Chưa tải được tài liệu',state.error,button('Thử lại',()=>render(true),'cd-btn','refresh','retry')));
    else if(!files.length)results.append(emptyState('cloud','Chưa có tài liệu','Kéo thả tệp vào đây hoặc bấm Tải file lên. Hỗ trợ PDF, Word, Excel, TXT và ảnh JPG, PNG, WebP · tối đa 10 MB/tệp.'));
    else if(!visible.length)results.append(emptyState('search','Không có tệp phù hợp',needle?'Không tìm thấy tệp có tên chứa “'+query.trim()+'”.':'Bộ lọc hiện tại không có tệp nào.',button('Xóa bộ lọc',()=>{query='';filter='all';paint(id);},'cd-btn','close','reset-filter')));
    else{
      const groups=filter==='all'?[['Hình ảnh',visible.filter(isImage)],['Tài liệu',visible.filter(file=>!isImage(file))]]:[[filter==='images'?'Hình ảnh':'Tài liệu',visible]];
      for(const [name,items]of groups){
        if(!items.length)continue;
        const section=element('section',null,'cd-group'),head=element('h5',name);head.append(element('em',String(items.length)));section.append(head);
        const rows=element('div',null,'cd-items is-'+layout);
        for(const file of items)rows.append(fileItem(id,file,state,thumbTasks,syncSelection));
        section.append(rows);results.append(section);
      }
    }
    if(files.length&&!loading)body.append(selectionBar);
    body.append(results);
    if(id&&endpoint()&&state.loadedAt&&files.length)body.append(element('p','PDF, Word, Excel, TXT và ảnh · Tối đa 10 MB/tệp · Giữ nguyên file gốc · Kéo thả để tải lên','cd-hint'));
    for(const item of pending.values())if(item.claimId===id&&item.owner===currentUser()?.uid){
      const row=element('div',null,'cd-pending');row.insertAdjacentHTML('beforeend',svg('alert'));row.append(element('span',item.name+' · Chưa lưu lên Drive'));
      const retry=button('Thử lưu lại',async()=>{retry.disabled=true;try{await send(item);pending.delete(item.requestId);message(id,'Đã lưu tệp.');paintIfCurrent(id);}catch(error){message(id,error.message);retry.disabled=false;}},'cd-btn','refresh');retry.disabled=busy;row.append(retry);body.append(row);
    }
    syncSelection();

    // Kéo thả tải lên
    const dropHint=element('div',null,'cd-drop-overlay');dropHint.insertAdjacentHTML('beforeend',svg('upload'));dropHint.append(element('strong','Thả tệp để tải lên Drive'));
    let dragDepth=0;
    const hasFiles=event=>[...(event.dataTransfer?.types||[])].includes('Files');
    card.addEventListener('dragenter',event=>{if(!hasFiles(event)||!canUpload(id,state))return;event.preventDefault();dragDepth++;card.classList.add('is-dragging');});
    card.addEventListener('dragover',event=>{if(!hasFiles(event)||!canUpload(id,state))return;event.preventDefault();event.dataTransfer.dropEffect='copy';});
    card.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)card.classList.remove('is-dragging');});
    card.addEventListener('drop',event=>{if(!hasFiles(event))return;event.preventDefault();dragDepth=0;card.classList.remove('is-dragging');if(!canUpload(id,state))return;const dropped=[...event.dataTransfer.files];if(dropped.length)void upload(dropped,id);});

    card.append(header,body,dropHint);host.append(card);
    if(focused){const target=host.querySelector('[data-cd-focus="'+focused+'"]');if(target&&!target.disabled){target.focus({preventScroll:true});if(typeof caret==='number'&&'setSelectionRange'in target)try{target.setSelectionRange(caret,caret);}catch(_){}}}
    // Ảnh thu nhỏ: chỉ xin khi thẻ sắp vào khung nhìn; các ảnh xuất hiện cùng lúc được gom thành một lô.
    if(typeof IntersectionObserver==='function'){
      const jobs=new Map(thumbTasks.map(item=>[item.visual,item.task]));
      observer=new IntersectionObserver(entries=>{for(const item of entries)if(item.isIntersecting){observer?.unobserve(item.target);const task=jobs.get(item.target);if(task){jobs.delete(item.target);void task();}}},{rootMargin:'200px'});
      thumbTasks.forEach(item=>observer.observe(item.visual));
    }else thumbTasks.forEach(item=>void item.task());
  }

  // Tải danh sách: dùng chung một request đang chạy (prefetch + mở tab không gọi trùng).
  function load(id,force=false){
    const state=entry(id);
    if(state.loading)return state.loading;
    if(!force&&state.loadedAt&&Date.now()-state.loadedAt<LIST_FRESH_MS)return Promise.resolve();
    const version=generation,owner=currentUser()?.uid;
    state.loading=(async()=>{
      try{
        const result=await request('list',id,{},owner);
        if(currentUser()?.uid!==owner||version!==generation)return;
        state.files=result.files.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
        state.loadedAt=Date.now();state.error='';if(!busy)state.notice='';
      }catch(error){if(currentUser()?.uid===owner){state.error=error.message;state.notice=state.loadedAt?error.message:'';}}
      finally{state.loading=null;}
    })();
    return state.loading;
  }
  async function render(force=false){
    watchAuth();const id=claimId();
    if(busy&&operationId===id){paint(id);return;}
    if(!id||!endpoint()){paint(id);return;}
    const request=load(id,force);paint(id);
    await request;paintIfCurrent(id);
  }
  // Gọi khi vừa mở hồ sơ: danh sách sẵn sàng trước khi người dùng bấm sang tab Tài liệu hồ sơ.
  function prefetch(){
    const id=claimId();if(!id||!endpoint()||!currentUser())return;
    watchAuth();void load(id).then(()=>{const pane=document.getElementById('tabPane_Documents');if(pane&&pane.style.display!=='none')paintIfCurrent(id);});
  }
  async function upload(files,id){
    if(busy)return;busy=true;operationId=id;generation++;const owner=currentUser()?.uid,state=entry(id);state.total=files.length;state.done=0;let cursor=0;const errors=[];
    message(id,'Đang tải '+files.length+' tệp lên Drive…');paintIfCurrent(id);
    const worker=async()=>{while(cursor<files.length){if(currentUser()?.uid!==owner)return;const file=files[cursor++];let item;try{item=makeItem(file,file.name,id,'upload');await send(item);}catch(error){if(currentUser()?.uid!==owner)return;if(item)pending.set(item.requestId,item);errors.push(file.name+': '+error.message);}state.done++;message(id,'Đã tải '+state.done+'/'+files.length+' tệp…');updateProgress(id);}};
    try{await Promise.all([worker(),worker()]);}finally{busy=false;if(currentUser()?.uid===owner){message(id,errors.length?errors.join(' · '):'Đã lưu '+files.length+' tệp vào Drive.');paintIfCurrent(id);}}
  }
  async function saveWord(blob,name,context){
    if(!endpoint()||context.owner!==currentUser()?.uid)return;
    if(!context.id){triggerToast('Word đã tải về máy. Lưu hồ sơ trước để lưu thêm lên Drive.','warning');return;}
    let item;try{item=makeItem(blob,name,context.id,'word');await send(item);paintIfCurrent(context.id);triggerToast('Đã lưu Word vào Drive của hồ sơ.','success');}
    catch(error){if(context.owner!==currentUser()?.uid)return;if(item)pending.set(item.requestId,item);message(context.id,error.message);paintIfCurrent(context.id);triggerToast('Word chưa lưu Drive. Mở Tài liệu hồ sơ để thử lại.','warning');}
  }
  return {render,prefetch,saveWord,capture:()=>({id:claimId(),owner:currentUser()?.uid})};
})();
