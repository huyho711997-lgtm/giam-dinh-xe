const ClaimDocuments = (() => {
  const maxBytes = 10 * 1024 * 1024;
  const accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt';
  const pending = new Map();
  let generation = 0, busy = false;
  const claimId = () => typeof editingPendingClaimId === 'undefined' ? '' : String(editingPendingClaimId || '');
  const endpoint = () => typeof CONFIG === 'undefined' ? '' : String(CONFIG.CLAIM_DOCUMENTS_ENDPOINT || '').trim();
  const currentUser = () => firebase.auth().currentUser;
  const element = (tag, text, className) => { const node=document.createElement(tag); if(text) node.textContent=text; if(className) node.className=className; return node; };
  function message(text) { const node=document.getElementById('claimDocumentsMessage'); if(node) node.textContent=text; }
  async function request(action, id, payload = {}, owner = currentUser()?.uid, signal) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint())) throw new Error('Kho Drive hồ sơ chưa được kích hoạt. Quản trị viên cần kết nối dịch vụ lưu tài liệu.');
    const user=currentUser(); if (!user || user.uid !== owner) throw new Error('Phiên đăng nhập đã thay đổi.');
    const token=await user.getIdToken();
    const timeout=AbortSignal.timeout(180000);
    const response=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,action,claimId:id,token}),credentials:'omit',redirect:'follow',signal:signal ? AbortSignal.any([signal,timeout]) : timeout});
    if(!response.ok) throw new Error('Không kết nối được kho Drive. Vui lòng thử lại.');
    let result; try { result=await response.json(); } catch (_) { throw new Error('Dịch vụ Drive chưa được triển khai đúng. Liên hệ quản trị viên.'); }
    if(currentUser()?.uid !== owner) throw new Error('Phiên đăng nhập đã thay đổi.');
    if(!result.ok) throw new Error(result.error || 'Không thể xử lý tài liệu.');
    return result;
  }
  function base64(blob) { return new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]); reader.onerror=()=>reject(new Error('Không đọc được tệp.')); reader.readAsDataURL(blob); }); }
  async function send(item) {
    const data=await base64(item.blob);
    return request('upload',item.claimId,{name:item.name,source:item.source,requestId:item.requestId,data},item.owner);
  }
  function validate(blob,name) {
    if(!blob.size || blob.size > maxBytes) throw new Error('Mỗi file cần có nội dung và tối đa 10 MB.');
    if(!accept.split(',').includes('.'+name.split('.').pop().toLowerCase())) throw new Error('Chọn tài liệu PDF, Word, Excel, TXT hoặc ảnh JPG, PNG, WebP.');
  }
  function makeItem(blob,name,id,source) { validate(blob,name); return {blob,name,claimId:id,source,owner:currentUser()?.uid,requestId:crypto.randomUUID()}; }
  function failure(item,error) { pending.set(item.requestId,item); message(item.name + ': ' + error.message + ' Có thể thử lại trong danh sách bên dưới.'); }
  function retryRows(list,id) {
    for(const item of pending.values()) {
      if(item.claimId !== id || item.owner !== currentUser()?.uid) continue;
      const row=element('div',null,'claim-document-row');
      row.append(element('span',item.name+' · Chưa xác nhận lưu trên Drive'));
      const button=element('button','Thử lưu lại','sf-button'); button.type='button';
      button.onclick=async()=>{button.disabled=true;try{await send(item);pending.delete(item.requestId);await render();}catch(error){failure(item,error);button.disabled=false;}};
      row.append(button);list.append(row);
    }
  }
  async function download(id,file,button) {
    button.disabled=true;
    try {
      const result=await request('download',id,{fileId:file.id});
      const bytes=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0));
      const url=URL.createObjectURL(new Blob([bytes],{type:result.mimeType}));
      const link=element('a');link.href=url;link.download=result.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch(error) {message(error.message);} finally {button.disabled=false;}
  }
  function preview(id,file) {
    const owner=currentUser()?.uid;
    let unsubscribe;
    SharedFormsViewer.open({...file,source:'drive',originalName:file.name},null,{
      onClose:()=>unsubscribe?.(),
      loadBytes:async signal => {
        const result=await request('download',id,{fileId:file.id},owner,signal);
        const bytes=Uint8Array.from(atob(result.data),character=>character.charCodeAt(0));
        return bytes.buffer;
      }
    });
    unsubscribe=firebase.auth().onAuthStateChanged?.(user=>{if(user?.uid !== owner)SharedFormsViewer.close();});
  }
  async function upload(files,id) {
    if(busy)return; busy=true;
    let count=0;const errors=[];
    const picker=document.getElementById('claimDocumentsFiles');if(picker)picker.disabled=true;
    try {
      for(const file of files) {
        message('Đang lưu '+(++count)+'/'+files.length+': '+file.name);
        let item;
        try {item=makeItem(file,file.name,id,'upload');await send(item);}
        catch(error){if(item)pending.set(item.requestId,item);errors.push(file.name+': '+error.message);}
      }
    } finally {busy=false;await render();message(errors.length ? errors.join(' · ') : 'Đã lưu '+count+' tệp vào Drive.');}
  }
  async function render() {
    const host=document.getElementById('tabPane_Documents');if(!host)return;
    const version=++generation,id=claimId();host.replaceChildren();
    const card=element('section',null,'claim-editor-form-section claim-documents');
    const header=element('header');header.append(element('h4','Tài liệu hồ sơ'));
    const body=element('div',null,'claim-documents-body');
    body.append(element('p','Tài liệu và bản Word được lưu trong thư mục riêng của hồ sơ trên Google Drive.'));
    const status=element('p');status.id='claimDocumentsMessage';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
    const tools=element('div',null,'claim-documents-tools');
    const label=element('label','Tải tài liệu lên','sf-button sf-primary');
    const input=element('input');input.id='claimDocumentsFiles';input.type='file';input.multiple=true;input.accept=accept;input.disabled=busy || !id || !endpoint();
    input.onchange=()=>{const files=[...input.files];if(files.length)upload(files,id);};label.append(input);tools.append(label);
    const refresh=element('button','Làm mới','sf-button');refresh.type='button';refresh.onclick=render;tools.append(refresh);body.append(tools);
    body.append(element('p','PDF, Word, Excel, TXT, ảnh · Tối đa 10 MB/file. File chưa lưu có thể thử lại trong phiên này.','claim-editor-hint'));
    const list=element('div',null,'claim-documents-list');body.append(list);card.append(header,body);host.append(card);
    retryRows(list,id);
    if(!id){message('Lưu hồ sơ trước khi thêm tài liệu.');return;}
    if(!endpoint()){message('Kho Drive hồ sơ đang chờ quản trị viên cấp quyền và kết nối.');return;}
    message('Đang tải danh sách tài liệu…');
    try {
      const result=await request('list',id);
      if(version !== generation || claimId() !== id)return;
      for(const file of result.files.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))) {
        const row=element('div',null,'claim-document-row'),copy=element('div');
        copy.append(element('strong',file.name),element('p',(file.source === 'word' ? 'Word đã xuất' : 'Tài liệu tải lên')+' · '+Math.ceil(file.size/1024)+' KB · '+new Date(file.createdAt).toLocaleString('vi-VN')));
        const actions=element('div',null,'claim-document-actions');
        const view=element('button','Xem','sf-button');view.type='button';view.title='Xem '+file.name;view.onclick=()=>preview(id,file);
        const button=element('button','Tải xuống','sf-button');button.type='button';button.onclick=()=>download(id,file,button);actions.append(view,button);row.append(copy,actions);list.append(row);
      }
      message(result.files.length ? result.files.length+' tệp đã lưu trên Drive.' : 'Chưa có tài liệu trên Drive.');
    } catch(error){if(version === generation)message(error.message);}
  }
  async function saveWord(blob,name,context) {
    if(!endpoint())return;
    if(context.owner !== currentUser()?.uid)return;
    const id=context.id;
    if(!id){triggerToast('Word đã tải về máy. Lưu hồ sơ trước để có thể lưu bản Word lên Drive.','warning');return;}
    let item;
    try {item=makeItem(blob,name,id,'word');await send(item);triggerToast('Đã lưu bản Word vào Drive của hồ sơ.','success');}
    catch(error){if(item)failure(item,error);triggerToast('Word đã tải về máy nhưng chưa xác nhận lưu Drive. Mở Tài liệu hồ sơ để thử lại.','warning');}
  }
  return {render,saveWord,capture:()=>({id:claimId(),owner:currentUser()?.uid})};
})();
