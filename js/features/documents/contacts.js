
function collectionGuideContactName(value) {
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').trim().toLowerCase().replace(/\s+/g,' ');
}

function collectionGuideContactUserId() {try{return firebase.auth().currentUser?.uid||'';}catch{return '';}}

function collectionGuideFindAssessorPhone(name) {
  const target=collectionGuideContactName(name);if(!target)return {matched:false,phone:''};
  const directory=collectionGuideContactDirectoryUser===collectionGuideContactUserId()?collectionGuideContactDirectory||{}:{};
  const users={...directory,...(cachedUsersPayload||{})},uid=collectionGuideContactUserId();
  if(uid && activeUserProfile && (users[uid] || collectionGuideContactName(activeUserProfile.role)==='giam dinh vien'))users[uid]={profile:activeUserProfile};
  let matches=Object.values(users).map(user=>user.profile||user).filter(profile=>
    [profile.displayName,profile.email,profile.employeeId].some(value=>value&&collectionGuideContactName(value)===target));
  if(matches.length>1){const assessors=matches.filter(profile=>collectionGuideContactName(profile.role)==='giam dinh vien');if(assessors.length)matches=assessors;}
  if(matches.length!==1)return {matched:matches.length>0,ambiguous:matches.length>1,phone:''};
  return {matched:true,phone:String(matches[0].phone??matches[0].phoneNumber??'').trim()};
}

function collectionGuideContactStatus(result) {
  if(result.phone)return 'Tự lấy từ thông tin tài khoản giám định viên.';
  if(result.ambiguous)return 'Có nhiều tài khoản trùng tên. Vui lòng nhập số điện thoại của giám định viên phụ trách.';
  return 'Giám định viên chưa cập nhật số điện thoại. Có thể bổ sung tại đây.';
}

function collectionGuideSyncContactPhone(reset=false) {
  const draft=collectionGuideDraft;if(!draft)return;
  let state=collectionGuideContactState.get(draft);
  if(!state){state={assessor:draft.meta.assessor,manual:draft.contactPhoneManual===true};collectionGuideContactState.set(draft,state);}
  if(reset||collectionGuideContactName(state.assessor)!==collectionGuideContactName(draft.meta.assessor)){state.assessor=draft.meta.assessor;state.manual=false;draft.contactPhoneManual=false;draft.meta.hotline='';}
  const result=collectionGuideFindAssessorPhone(draft.meta.assessor);
  if(!state.manual){
    draft.meta.hotline=result.phone||'';
  }
  const input=document.getElementById('collectionGuideMeta_hotline');
  if(input){input.value=draft.meta.hotline||'';input.placeholder='Số điện thoại của giám định viên';}
  const hint=document.getElementById('collectionGuidePhoneHint');
  if(hint)hint.textContent=state.manual?'Số điện thoại liên hệ đã nhập.':collectionGuideContactStatus(result);
  return result;
}

async function collectionGuidePrepareContact() {
  if(!collectionGuideDraft)return;
  const draft=collectionGuideDraft,result=collectionGuideSyncContactPhone();
  if(result?.matched||!draft.meta.assessor)return;
  const uid=collectionGuideContactUserId();
  if(collectionGuideContactDirectoryUser!==uid){collectionGuideContactDirectory=null;collectionGuideContactDirectoryPromise=null;collectionGuideContactDirectoryUser=uid;}
  if(collectionGuideContactDirectory===null&&!collectionGuideContactDirectoryPromise){
    collectionGuideContactDirectoryPromise=(async()=>{
      try {
        if(!dbNodeInstance)return;
        const snapshot=await dbNodeInstance.ref('users').once('value');
        if(collectionGuideContactDirectoryUser===uid)collectionGuideContactDirectory=snapshot.val()||{};
      }catch {if(collectionGuideContactDirectoryUser===uid)collectionGuideContactDirectory={};}
    })();
  }
  if(collectionGuideContactDirectoryPromise)await collectionGuideContactDirectoryPromise;
  if(collectionGuideDraft&&collectionGuideContactUserId()===uid)collectionGuideSyncContactPhone();
}

function collectionGuideBindContactFields() {
  const input=document.getElementById('collectionGuideMeta_hotline');
  if(input){
    input.type='tel';input.autocomplete='tel';
    const hint=collectionGuideElement('small','collection-guide-phone-hint');hint.id='collectionGuidePhoneHint';
    hint.style.cssText='display:block;margin-top:5px;color:var(--text-muted);font-size:10px;line-height:1.5';
    input.setAttribute('aria-describedby',hint.id);input.after(hint);
    input.addEventListener('input',()=>{
      if(!collectionGuideDraft)return;
      const state=collectionGuideContactState.get(collectionGuideDraft)||{assessor:collectionGuideDraft.meta.assessor};
      state.manual=true;collectionGuideDraft.contactPhoneManual=true;collectionGuideContactState.set(collectionGuideDraft,state);hint.textContent='Số điện thoại liên hệ đã nhập.';
    });
  }
  document.getElementById('collectionGuideMeta_assessor')?.addEventListener('input',()=>{
    collectionGuideSyncContactPhone(true);void collectionGuidePrepareContact();
  });
  collectionGuideSyncContactPhone();void collectionGuidePrepareContact();
}
