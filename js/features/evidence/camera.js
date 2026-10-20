
function cameraLocationMessage(location) {
  const messages={denied:'Chưa cấp quyền vị trí. Bật quyền vị trí cho trang rồi thử lại.',timeout:'Lấy vị trí quá thời gian. Bật định vị trên thiết bị rồi thử lại.',unavailable:'Chưa lấy được vị trí. Kiểm tra định vị trên thiết bị.',unsupported:'Thiết bị không hỗ trợ định vị.',insecure:'Định vị cần mở trang qua HTTPS.',invalid:'Thiết bị trả về vị trí không hợp lệ.'};
  if(!location?.coords)return messages[location?.status]||messages.unavailable;
  const accuracy=location.coords.accuracy;
  return location.address?(location.hasWard===false?location.address+' · Chưa xác định phường/xã':location.address):`Đã có GPS${Number.isFinite(accuracy)?' · ±'+Math.ceil(accuracy)+' m':''} · Chưa tra được tên địa điểm`;
}

function updateCameraLocationUI(location,pending=false) {
  const status=document.getElementById('cameraLocationStatus'),detail=document.getElementById('cameraLocationDetail');
  if(!status||!detail)return;
  status.dataset.state=pending?'pending':location?.address&&location.hasWard!==false?'ready':location?.coords?'partial':'error';
  detail.textContent=pending?'Đang lấy vị trí và địa chỉ…':cameraLocationMessage(location);
  detail.title=detail.textContent;
  const label=status.querySelector('strong');if(label)label.textContent=pending?'Đang định vị':location?.address?(location.hasWard===false?'Thiếu phường/xã':'Địa điểm chụp'):location?.coords?'GPS đã sẵn sàng':'Cần kiểm tra vị trí';
  const credit=document.getElementById('cameraLocationCredit');if(credit){credit.textContent=location?.provider==='bigdatacloud'?'BigDataCloud':['nominatim','overpass'].includes(location?.provider)?'© OpenStreetMap':'';credit.href=location?.provider==='bigdatacloud'?'https://www.bigdatacloud.com/':'https://www.openstreetmap.org/copyright';credit.hidden=!location?.address;}
}

function cameraPositionDistance(a,b) {
  const radians=Math.PI/180,dLat=(Number(b.latitude)-Number(a.latitude))*radians,dLon=(Number(b.longitude)-Number(a.longitude))*radians;
  const value=Math.sin(dLat/2)**2+Math.cos(Number(a.latitude)*radians)*Math.cos(Number(b.latitude)*radians)*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,value)),Math.sqrt(Math.max(0,1-value)));
}

function cameraAddressKey(value) {return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().trim();}

function cameraAddressResult(fields,provider,fallback='') {
  const parts=[];
  for(const value of [fields.street,fields.ward,fields.district,fields.city,fields.province]){
    if(typeof value==='string'&&value.trim()&&!parts.some(part=>cameraAddressKey(part)===cameraAddressKey(value)))parts.push(value.trim());
  }
  const address=parts.join(', ')||String(fallback||'').trim();if(!address)return null;
  const hasWard=Boolean(fields.ward)||/(?:^|,\s*)(?:phuong|xa|thi tran)\s/.test(cameraAddressKey(address));
  return {address,provider,hasWard,complete:hasWard&&Boolean(fields.province),fields};
}

function cameraNominatimAddress(data) {
  if(!data||data.error)return null;
  const addr=data.address||{};
  const road=addr.road||addr.pedestrian||addr.residential||addr.footway||addr.path;
  const house=addr.house_number;
  return cameraAddressResult({street:house&&road?house+' '+road:road||house,ward:addr.ward||addr.suburb||addr.quarter||addr.village,district:addr.city_district||addr.district||addr.county||addr.borough,city:addr.city||addr.town||addr.municipality,province:addr.state||addr.province||addr.region},'nominatim',data.display_name);
}

function cameraFormatAddress(data) {return cameraNominatimAddress(data)?.address||null;}

function cameraLocalityAddress(data,coords) {
  if(!data||data.error||/ip/i.test(data.lookupSource||''))return null;
  if(!Number.isFinite(data.latitude)||!Number.isFinite(data.longitude)||cameraPositionDistance(coords,{latitude:data.latitude,longitude:data.longitude})>10)return null;
  const administrative=Array.isArray(data.localityInfo?.administrative)?data.localityInfo.administrative:[];
  const selected={};
  for(const row of [...administrative].sort((a,b)=>(b.order||0)-(a.order||0))){
    if(!row.name||Number(row.adminLevel)<4)continue;
    const description=cameraAddressKey(row.description),name=String(row.name).trim(),key=cameraAddressKey(name);let kind='',prefix='';
    if(/\b(?:former|historical)\b|\b(?:cu|truoc day)\b/.test(description))continue;
    if(/\b(?:phuong|ward)\b/.test(key+' '+description)){kind='ward';prefix='Phường ';}
    else if(/\b(?:xa|commune)\b/.test(key+' '+description)){kind='ward';prefix='Xã ';}
    else if(/\b(?:thi tran|township)\b/.test(key+' '+description)){kind='ward';prefix='Thị trấn ';}
    else if(/^(quan|huyen|thi xa|district)(\s|$)/.test(key)||/^(quan|huyen|thi xa|district)(\s|$)/.test(description)){kind='district';}
    else if(Number(row.adminLevel)===4){kind='province';}
    else if(/^(thanh pho|city)(\s|$)/.test(key)||/^(thanh pho|city)(\s|$)/.test(description)){kind='city';}
    else if(Number(row.adminLevel)>=8){kind='ward';}
    else if(Number(row.adminLevel)>=6){kind='district';}
    if(kind&&!selected[kind])selected[kind]=prefix&&!/^(phuong|xa|thi tran)(\s|$)/.test(key)&&!/\b(?:ward|commune|township)\b/.test(key)?prefix+name:name;
  }
  if(!selected.ward&&/^(phuong|xa|thi tran)(\s|$)/.test(cameraAddressKey(data.locality)))selected.ward=data.locality;
  const result=cameraAddressResult({...selected,city:selected.city||data.city,province:selected.province||data.principalSubdivision},'bigdatacloud');
  // A city name in `locality` is not evidence of a ward/commune boundary.
  if(result&&!selected.ward&&data.locality&&cameraAddressKey(data.locality)!==cameraAddressKey(data.city))result.address=data.locality+', '+result.address;
  return result;
}

function cameraFormatLocality(data,coords) {return cameraLocalityAddress(data,coords)?.address||null;}

function cameraBoundaryAddress(data) {
  if(!Array.isArray(data?.elements)||data.remark)return null;
  const fields={},wards=[];
  for(const element of data.elements){
    const tags=element.tags||{},name=tags['name:vi']||tags.name,level=Number(tags.admin_level);
    if(!name||tags.boundary!=='administrative'||tags.end_date||tags['disused:boundary'])continue;
    const key=cameraAddressKey(name);
    if(/^(phuong|xa|thi tran)(\s|$)/.test(key))wards.push({name,level});
    else if(level===4)fields.province=name;
    else if(level===6){if(/^(thanh pho)(\s|$)/.test(key))fields.city=name;else fields.district=name;}
    else if(level===8)wards.push({name,level});
  }
  // Prefer a current ward at level 6 over an old level-8 boundary; never combine two wards.
  wards.sort((a,b)=>a.level-b.level);const chosen=wards.filter(row=>row.level===wards[0]?.level);
  const unique=[...new Map(chosen.map(row=>[cameraAddressKey(row.name),row])).values()];
  if(unique.length===1){fields.ward=unique[0].name;if(unique[0].level===6){delete fields.city;delete fields.district;}}
  return cameraAddressResult(fields,'overpass');
}

function cameraAddressScore(result) {return result?(result.hasWard?100:0)+(result.fields?.province?20:0)+(result.fields?.district?5:0)+(result.fields?.city?3:0)+(result.fields?.street?1:0):0;}

async function requestCameraAddress(url,timeout=5000,options={}) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try {const response=await fetch(url,{...options,signal:controller.signal,mode:'cors',credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'});if(!response.ok)throw new Error('HTTP '+response.status);return await response.json();}
  finally {clearTimeout(timer);}
}

async function reverseGeocodeAddress(lat,lon,options={}) {
  lat=Number(lat);lon=Number(lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
  const coords={latitude:lat,longitude:lon},now=Date.now();
  const findCache=()=>!options.force&&cameraLocationState.addressCache.find(entry=>Date.now()-entry.at<(entry.result.complete?180000:15000)&&cameraPositionDistance(coords,entry.coords)<=8);
  const cached=findCache();if(cached)return cached.result;
  const key=lat.toFixed(6)+','+lon.toFixed(6);
  if(cameraLocationState.addressRequests.has(key))return cameraLocationState.addressRequests.get(key);
  const task=cameraLocationState.addressQueue.catch(()=>{}).then(async()=>{
    const cache=findCache();if(cache)return cache.result;
    const delay=Math.max(0,1100-(Date.now()-cameraLocationState.lastAddressRequestAt));
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    cameraLocationState.lastAddressRequestAt=Date.now();
    let result=null;
    const consider=candidate=>{if(cameraAddressScore(candidate)>cameraAddressScore(result))result=candidate;};
    // This client endpoint receives only fresh coordinates from the device's Geolocation API.
    try {const query=new URLSearchParams({latitude:String(lat),longitude:String(lon),localityLanguage:'vi'});consider(cameraLocalityAddress(await requestCameraAddress('https://api.bigdatacloud.net/data/reverse-geocode-client?'+query),coords));}catch(_){}
    if(!result?.complete){
      try {
        const query='[out:json][timeout:8];is_in('+lat.toFixed(6)+','+lon.toFixed(6)+')->.areas;area.areas[boundary=administrative][admin_level~"^(4|6|8)$"];out tags;';
        consider(cameraBoundaryAddress(await requestCameraAddress('https://overpass-api.de/api/interpreter',10000,{method:'POST',body:new URLSearchParams({data:query})})));
      }catch(_){}
    }
    if(!result?.complete){
      try {const query=new URLSearchParams({lat:String(lat),lon:String(lon),format:'jsonv2','accept-language':'vi',addressdetails:'1',zoom:'18',layer:'address'});consider(cameraNominatimAddress(await requestCameraAddress('https://nominatim.openstreetmap.org/reverse?'+query,6000)));}catch(_){}
    }
    if(result){cameraLocationState.addressCache.unshift({coords,result,at:Date.now()});cameraLocationState.addressCache=cameraLocationState.addressCache.slice(0,30);}
    return result;
  });
  cameraLocationState.addressRequests.set(key,task);
  cameraLocationState.addressQueue=task.then(()=>{},()=>{});
  try{return await task;}finally{if(cameraLocationState.addressRequests.get(key)===task)cameraLocationState.addressRequests.delete(key);}
}

async function acquireCameraPosition() {
  if(cameraLocationState.positionRequest)return cameraLocationState.positionRequest;
  if(!window.isSecureContext)return cameraLocationError('insecure');
  if(!navigator.geolocation)return cameraLocationError('unsupported');
  const request=new Promise(resolve=>{
    let settled=false;
    const timer=setTimeout(()=>finish(cameraLocationError('timeout')),16000);
    function finish(result){if(settled)return;settled=true;clearTimeout(timer);resolve(result);}
    try {
      navigator.geolocation.getCurrentPosition(position=>{
        if(settled)return;
        const lat=position?.coords?.latitude,lon=position?.coords?.longitude,accuracy=position?.coords?.accuracy,timestamp=Number(position?.timestamp);
        if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!Number.isFinite(timestamp)||Date.now()-timestamp>15000||timestamp>Date.now()+5000){finish(cameraLocationError('invalid'));return;}
        gpsPermissionDenied=false;
        finish({coords:{latitude:lat.toFixed(6),longitude:lon.toFixed(6),accuracy:Number.isFinite(accuracy)&&accuracy>=0?accuracy:null},timestamp,address:null,status:'ready'});
      },error=>{if(settled)return;gpsPermissionDenied=error?.code===1;finish(cameraLocationError(error?.code===1?'denied':error?.code===3?'timeout':'unavailable'));},{enableHighAccuracy:true,timeout:12000,maximumAge:0});
    }catch(_){finish(cameraLocationError('unavailable'));}
  });
  cameraLocationState.positionRequest=request;
  try{return await request;}finally{if(cameraLocationState.positionRequest===request)cameraLocationState.positionRequest=null;}
}

async function ensureRealtimeGpsCoordinates(options={}) {
  const revision=++cameraLocationState.uiRevision;
  updateCameraLocationUI(null,true);
  const position=options.background&&cameraLocationState.latest&&Date.now()-cameraLocationState.latest.timestamp<10000?cameraLocationState.latest:await acquireCameraPosition();
  const snapshot={...position,coords:position.coords?{...position.coords}:null,address:null};
  if(snapshot.coords){
    const resolved=await reverseGeocodeAddress(snapshot.coords.latitude,snapshot.coords.longitude,{force:options.forceAddress});
    snapshot.address=typeof resolved==='string'?resolved:resolved?.address||null;snapshot.provider=resolved?.provider||null;
    snapshot.hasWard=typeof resolved==='string'?true:Boolean(resolved?.hasWard);
    snapshot.addressStatus=snapshot.address?(snapshot.hasWard?'ready':'partial'):'unavailable';
  }
  // Keep one immutable coordinate/address pair. An older response cannot overwrite a newer fix.
  if(!cameraLocationState.latest||snapshot.timestamp>=cameraLocationState.latest.timestamp){
    cameraLocationState.latest=snapshot;
    lastFetchedGpsCoords=snapshot.coords?{...snapshot.coords}:null;lastFetchedAddress=snapshot.address||null;
  }
  if(revision===cameraLocationState.uiRevision)updateCameraLocationUI(snapshot);
  return snapshot;
}

function prefetchGpsCoordinates() {return ensureRealtimeGpsCoordinates({background:true}).catch(()=>cameraLocationError('unavailable'));}

function retryCameraLocation() {return ensureRealtimeGpsCoordinates({forceAddress:true}).catch(()=>{const result=cameraLocationError('unavailable');updateCameraLocationUI(result);return result;});}

function createCameraPhotoMetadata(capturedAt=Date.now()) {
  return {capturedAt,source:'camera',locationPromise:ensureRealtimeGpsCoordinates().catch(()=>cameraLocationError('unavailable'))};
}

function cameraWatermarkLines(location,time,source) {
  const when=new Date(time),pad=value=>String(value).padStart(2,'0');
  const lines=['TASCO DLK',pad(when.getDate())+'/'+pad(when.getMonth()+1)+'/'+when.getFullYear()+' '+pad(when.getHours())+':'+pad(when.getMinutes())+':'+pad(when.getSeconds())];
  if(location?.address)lines.push((source==='gallery'?'Vị trí tải ảnh: ':'')+location.address);
  else if(location?.coords)lines.push('Chưa tra được tên địa điểm');
  if(location?.address&&location.hasWard===false)lines.push('Chưa xác định phường/xã');
  if(!location?.coords){
    const labels={denied:'Chưa cấp quyền vị trí',timeout:'Định vị quá thời gian',insecure:'Trang chưa hỗ trợ quyền định vị',unsupported:'Thiết bị không hỗ trợ định vị',invalid:'Vị trí không hợp lệ',unavailable:'Chưa lấy được vị trí'};
    lines.push(labels[location?.status]||labels.unavailable);
  }
  return lines;
}

function wrapCameraWatermarkText(ctx,text,maxWidth) {
  const lines=[];let line='';
  for(const word of String(text).split(/\s+/)){
    const next=line?line+' '+word:word;
    if(ctx.measureText(next).width<=maxWidth){line=next;continue;}
    if(line){lines.push(line);line='';}
    for(const character of word){if(line&&ctx.measureText(line+character).width>maxWidth){lines.push(line);line='';}line+=character;}
  }
  if(line)lines.push(line);return lines;
}

async function addWatermarkToImageFile(file,categoryName,options={}) {
  const metadata=cameraPhotoMetadata.get(file)||{capturedAt:Date.now(),source:options.isCameraSource?'camera':'gallery',locationPromise:ensureRealtimeGpsCoordinates().catch(()=>cameraLocationError('unavailable'))};
  const location=await metadata.locationPromise;
  return new Promise(resolve=>{
    const reader=new FileReader();reader.onerror=()=>resolve(file);
    reader.onload=event=>{
      const img=new Image();img.onerror=()=>resolve(file);
      img.onload=()=>{
        try {
          const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
          const ctx=canvas.getContext('2d');if(!ctx){resolve(file);return;}ctx.drawImage(img,0,0);
          const w=canvas.width,h=canvas.height,padding=Math.max(8,Math.round(w/45)),fontSize=Math.max(10,Math.round(w/56)),lineHeight=fontSize*1.35;
          ctx.font='bold '+fontSize+'px sans-serif';ctx.fillStyle='#fff';ctx.textBaseline='bottom';ctx.textAlign='right';
          ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=Math.max(3,Math.round(w/350));ctx.shadowOffsetX=Math.max(1,Math.round(w/600));ctx.shadowOffsetY=ctx.shadowOffsetX;
          const lines=cameraWatermarkLines(location,metadata.capturedAt,metadata.source).flatMap(line=>wrapCameraWatermarkText(ctx,line,Math.max(20,w-padding*2)));
          let y=h-padding;
          for(let index=lines.length-1;index>=0;index--){ctx.fillText(lines[index],w-padding,y);y-=lineHeight;}
          canvas.toBlob(blob=>{if(!blob){resolve(file);return;}const stamped=new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:metadata.capturedAt});cameraPhotoMetadata.set(stamped,metadata);resolve(stamped);},'image/jpeg',.92);
        }catch(_){resolve(file);}
      };img.src=event.target.result;
    };reader.readAsDataURL(file);
  });
}

function cameraHandleDeviceOrientation(event) {
  if(!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
  const beta=event.beta*Math.PI/180,gamma=event.gamma*Math.PI/180;
  const x=Math.sin(gamma)*Math.cos(beta),y=Math.sin(beta);
  let physical=null;
  if(Math.abs(x)>.45&&Math.abs(x)>Math.abs(y)*1.25)physical={orientation:'landscape',angle:x>0?270:90,at:Date.now()};
  else if(Math.abs(y)>.45&&Math.abs(y)>Math.abs(x)*1.25)physical={orientation:'portrait',angle:y>0?0:180,at:Date.now()};
  if(physical)cameraUiState.physicalOrientation=physical;
}

function startCameraOrientationSensor() {
  const Sensor=window.DeviceOrientationEvent;if(!Sensor)return;
  const session=cameraUiState.session;
  const listen=()=>{if(session===cameraUiState.session&&document.getElementById('customCameraModal')?.style.display!=='none')window.addEventListener('deviceorientation',cameraHandleDeviceOrientation);};
  if(typeof Sensor.requestPermission!=='function'){listen();return;}
  // Called synchronously from the camera-opening tap, as Safari requires a user gesture.
  if(!cameraUiState.sensorPermission){try{cameraUiState.sensorPermission=Sensor.requestPermission().catch(()=>'denied');}catch(_){return;}}
  cameraUiState.sensorPermission.then(permission=>{if(permission==='granted')listen();});
}

function cameraFrameOrientation(video,usePhysical=true) {
  const viewport=window.visualViewport,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
  const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.maxTouchPoints>0&&matchMedia('(pointer:coarse)').matches);
  const legacyAngle=typeof window.orientation==='number'?window.orientation:null;
  const physical=usePhysical&&mobile&&cameraUiState.physicalOrientation&&Date.now()-cameraUiState.physicalOrientation.at<2500?cameraUiState.physicalOrientation:null;
  const angle=((physical?.angle??legacyAngle??screen.orientation?.angle??0)%360+360)%360;
  const landscape=physical?physical.orientation==='landscape':width>height,nativeLandscape=video.videoWidth>video.videoHeight;
  // Rotate pixels only when a mobile browser keeps the previous orientation's frame size.
  // Matching frames already include the browser's rotation and must pass through unchanged.
  const rotation=!mobile||landscape===nativeLandscape||video.videoWidth===video.videoHeight?0:landscape?(angle===270?90:-90):(angle===180?-90:90);
  return {orientation:landscape?'landscape':'portrait',angle,rotation,width:rotation?video.videoHeight:video.videoWidth,height:rotation?video.videoWidth:video.videoHeight};
}

function syncCameraFramePreview(video) {
  if(!video)return;
  // A screen locked in portrait keeps its visual coordinates; the saved photo can still be landscape.
  const frame=cameraFrameOrientation(video,false),container=video.parentElement;
  video.dataset.rotation=String(frame.rotation);
  if(frame.rotation&&container){
    video.style.position='absolute';video.style.left='50%';video.style.top='50%';
    video.style.width=container.clientHeight+'px';video.style.height=container.clientWidth+'px';
    video.style.transform='translate(-50%,-50%) rotate('+frame.rotation+'deg)';
  }else{for(const property of ['position','left','top','width','height','transform'])video.style.removeProperty(property);}
}

function syncCameraViewport() {
  const modal=document.getElementById('customCameraModal');if(!modal||modal.style.display==='none')return;
  const viewport=window.visualViewport,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
  modal.style.setProperty('--camera-viewport-width',width+'px');modal.style.setProperty('--camera-viewport-height',height+'px');
  modal.dataset.orientation=width>height?'landscape':'portrait';
  const video=document.getElementById('customCameraVideo'),shutter=document.getElementById('cameraCaptureButton');
  syncCameraFramePreview(video);
  if(shutter)shutter.disabled=cameraUiState.captureBusy||!customCameraStream||!video?.videoWidth||!video?.videoHeight;
}

function syncCameraPhotoTray() {
  const tray=document.querySelector('#customCameraModal .camera-preview-container'),count=document.getElementById('cameraPhotoCount');
  if(tray)tray.hidden=!customCameraPhotos.length;
  if(count)count.textContent=customCameraPhotos.length?customCameraPhotos.length+' ảnh':'Chạm để chụp';
  const category=document.getElementById('cameraActiveCategoryText');if(category)category.title=category.textContent;
}

function onCustomCameraOpen() {
  cameraUiState.session++;cameraUiState.captureBusy=false;
  cameraUiState.previousOverflow=document.body.style.overflow;cameraUiState.previousFocus=document.activeElement;
  cameraUiState.physicalOrientation=null;startCameraOrientationSensor();
  document.body.style.overflow='hidden';
  updateCameraLocationUI(null,true);syncCameraPhotoTray();syncCameraViewport();
  document.querySelector('#customCameraModal .btn-close-cam')?.focus({preventScroll:true});
}

function onCustomCameraClose() {
  cameraUiState.session++;cameraUiState.captureBusy=false;
  window.removeEventListener('deviceorientation',cameraHandleDeviceOrientation);cameraUiState.physicalOrientation=null;
  if(cameraUiState.previousOverflow!==null)document.body.style.overflow=cameraUiState.previousOverflow;
  cameraUiState.previousOverflow=null;
  cameraUiState.previousFocus?.focus?.({preventScroll:true});cameraUiState.previousFocus=null;
  cameraUiState.photoUrls.forEach(url=>URL.revokeObjectURL(url));cameraUiState.photoUrls.clear();
}

function renderCustomCameraPreviewStrip() {
  syncCameraPhotoTray();const strip=document.getElementById('cameraPreviewStrip');if(!strip)return;
  for(const [file,url] of cameraUiState.photoUrls){if(!customCameraPhotos.includes(file)){URL.revokeObjectURL(url);cameraUiState.photoUrls.delete(file);}}
  strip.replaceChildren();
  customCameraPhotos.forEach((file,index)=>{
    let url=cameraUiState.photoUrls.get(file);if(!url){url=URL.createObjectURL(file);cameraUiState.photoUrls.set(file,url);}
    const wrapper=document.createElement('div');wrapper.className='camera-preview-wrapper';
    const image=document.createElement('img');image.className='camera-preview-thumbnail';image.src=url;image.alt='Ảnh đã chụp '+(index+1);
    const badge=document.createElement('span');badge.className='camera-thumb-badge';badge.textContent=String(index+1);
    const remove=document.createElement('button');remove.type='button';remove.className='camera-thumb-delete';remove.setAttribute('aria-label','Bỏ ảnh '+(index+1));remove.innerHTML=SVGS.CLOSE;remove.onclick=event=>{event.stopPropagation();deleteCapturedPhotoFromCamera(index);};
    wrapper.append(image,badge,remove);strip.append(wrapper);
  });
  strip.scrollLeft=strip.scrollWidth;
}

function triggerCustomCameraCapture() {
  const video=document.getElementById('customCameraVideo');if(!video||!customCameraStream||cameraUiState.captureBusy)return;
  if(!video.videoWidth||!video.videoHeight){triggerToast('Camera đang khởi động, vui lòng thử lại sau giây lát!','warning');video.play().catch(()=>{});return;}
  const session=cameraUiState.session,frame=cameraFrameOrientation(video),photoMetadata=createCameraPhotoMetadata(),canvas=document.createElement('canvas');
  photoMetadata.frame={...frame,nativeWidth:video.videoWidth,nativeHeight:video.videoHeight};
  cameraUiState.captureBusy=true;syncCameraViewport();
  const flash=document.getElementById('cameraFlashEffect');if(flash){flash.classList.add('flash-active');setTimeout(()=>flash.classList.remove('flash-active'),90);}
  canvas.width=frame.width;canvas.height=frame.height;
  try {
    const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
    context.translate(canvas.width/2,canvas.height/2);context.rotate(frame.rotation*Math.PI/180);
    context.drawImage(video,-video.videoWidth/2,-video.videoHeight/2,video.videoWidth,video.videoHeight);
    canvas.toBlob(blob=>{
      if(session!==cameraUiState.session)return;
      cameraUiState.captureBusy=false;syncCameraViewport();
      if(!blob){triggerToast('Chưa tạo được ảnh, vui lòng chụp lại.','warning');return;}
      const file=new File([blob],'capture_'+photoMetadata.capturedAt+'.jpg',{type:'image/jpeg',lastModified:photoMetadata.capturedAt});cameraPhotoMetadata.set(file,photoMetadata);
      customCameraPhotos.push(file);renderCustomCameraPreviewStrip();updateCustomCameraDoneBtn();
    },'image/jpeg',.92);
  }catch(_){cameraUiState.captureBusy=false;syncCameraViewport();triggerToast('Chưa tạo được ảnh, vui lòng chụp lại.','warning');}
}


    async function openCustomCameraModal(requestIndex) {
      customCameraRequestIndex = requestIndex;
      customCameraPhotos = [];
      
      const activeCategoryText = document.getElementById('cameraActiveCategoryText');
      if (activeCategoryText) {
        const item = localActiveRequestedItems[requestIndex];
        activeCategoryText.textContent = `Đang chụp: ${item?.tenHangMuc || `Hạng mục ${requestIndex + 1}`}`;
      }
      
      renderCustomCameraPreviewStrip();
      updateCustomCameraDoneBtn();
      
      const modal = document.getElementById('customCameraModal');
      if (modal) modal.style.display = 'flex';
      onCustomCameraOpen();
      await startCustomCameraStream();
    }


    async function startCustomCameraStream() {
      stopCustomCameraStream();
      
      const video = document.getElementById('customCameraVideo');
      if (!video) return;
      
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.muted = true;

      const constraintOptions = [
        { video: { facingMode: customCameraFacingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
        { video: { facingMode: customCameraFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: customCameraFacingMode }, audio: false },
        { video: true, audio: false }
      ];

      let stream = null;
      for (const option of constraintOptions) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(option);
          if (stream) break;
        } catch (e) {
          console.warn('Camera constraint option failed:', option, e);
        }
      }

      if (!stream) {
        triggerToast('Không thể kết nối camera. Chuyển sang trình chọn tệp mặc định!', 'warning');
        const fallbackRequestIndex=customCameraRequestIndex;
        closeCustomCameraModal(false);
        const fileInput = document.getElementById(`garageEvidenceInput_${fallbackRequestIndex}`);
        if (fileInput) {
          fileInput.setAttribute('capture', 'environment');
          fileInput.dataset.sourceType = 'camera';
          fileInput.click();
          fileInput.removeAttribute('capture');
        }
        return;
      }

      customCameraStream = stream;
      video.srcObject = stream;
      syncCameraViewport();

      try {
        await video.play();
      } catch (playErr) {
        console.warn('video.play() failed:', playErr);
      }

      setTimeout(() => {
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.warn('Video stream width is 0, attempting video.play() retry...');
          video.play().catch(() => {});
        }
        // Fetch fresh real-time GPS in background AFTER camera is already displaying video smoothly
        prefetchGpsCoordinates();
      }, 500);

      if (customCameraTorchActive) {
        setTimeout(async () => {
          try {
            const track = customCameraStream.getVideoTracks()[0];
            if (track && track.getCapabilities) {
              const capabilities = track.getCapabilities();
              if (capabilities.torch) {
                await track.applyConstraints({ advanced: [{ torch: true }] });
              } else {
                customCameraTorchActive = false;
              }
            }
          } catch (e) {
            console.warn('Torch activation failed:', e);
          }
        }, 400);
      }
    }


    function stopCustomCameraStream() {
      if (customCameraStream) {
        customCameraStream.getTracks().forEach(track => track.stop());
        customCameraStream = null;
      }
      const video = document.getElementById('customCameraVideo');
      if (video) video.srcObject = null;
      
      // Reset torch active state & button UI styles
      customCameraTorchActive = false;
      const flashBtn = document.getElementById('btnToggleCameraFlash');
      if (flashBtn) {
        flashBtn.classList.remove('active');
        flashBtn.style.color = '#ffffff';
        flashBtn.style.background = 'rgba(15, 12, 8, 0.6)';
        flashBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      }
    }


    async function switchCustomCamera() {
      customCameraFacingMode = (customCameraFacingMode === 'environment') ? 'user' : 'environment';
      await startCustomCameraStream();
    }


    async function toggleCustomCameraTorch() {
      if (!customCameraStream) {
        triggerToast('Camera chưa hoạt động!', 'warning');
        return;
      }
      const track = customCameraStream.getVideoTracks()[0];
      if (!track) return;
      
      try {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (!capabilities.torch) {
          triggerToast('Đèn Flash không hỗ trợ trên camera này!', 'warning');
          return;
        }
        
        customCameraTorchActive = !customCameraTorchActive;
        await track.applyConstraints({
          advanced: [{ torch: customCameraTorchActive }]
        });
        
        const flashBtn = document.getElementById('btnToggleCameraFlash');
        if (flashBtn) {
          flashBtn.classList.toggle('active', customCameraTorchActive);
          flashBtn.style.color = customCameraTorchActive ? '#ffca28' : '#ffffff';
          flashBtn.style.background = customCameraTorchActive ? 'rgba(255, 202, 40, 0.2)' : 'rgba(15, 12, 8, 0.6)';
          flashBtn.style.borderColor = customCameraTorchActive ? '#ffca28' : 'rgba(255, 255, 255, 0.2)';
        }
      } catch (err) {
        console.error('Torch toggle failed:', err);
        triggerToast('Không điều khiển được đèn Flash trên thiết bị này!', 'warning');
      }
    }


    async function triggerCustomCameraFocus(event) {
      const video = document.getElementById('customCameraVideo');
      const container = video.parentElement;
      const ring = document.getElementById('cameraFocusRing');
      if (!container || !ring) return;
      
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      
      if (customCameraFocusTimeout) {
        clearTimeout(customCameraFocusTimeout);
      }
      
      ring.classList.remove('active');
      void ring.offsetWidth; // Force layout reflow
      ring.classList.add('active');
      
      customCameraFocusTimeout = setTimeout(() => {
        ring.classList.remove('active');
        customCameraFocusTimeout = null;
      }, 1500);
      
      if (customCameraStream) {
        const track = customCameraStream.getVideoTracks()[0];
        if (track) {
          try {
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
              await track.applyConstraints({
                advanced: [{ focusMode: 'continuous' }]
              });
            }
          } catch (e) {
            console.warn('Hardware focus failed:', e);
          }
        }
      }
    }


    function deleteCapturedPhotoFromCamera(index) {
      customCameraPhotos.splice(index, 1);
      renderCustomCameraPreviewStrip();
      updateCustomCameraDoneBtn();
    }


    function updateCustomCameraDoneBtn() {
      const btn = document.getElementById('btnSaveCustomCameraPhotos');
      if (btn) {
        btn.textContent = `Xong (${customCameraPhotos.length})`;
        btn.disabled = (customCameraPhotos.length === 0);
      }
    }


    async function closeCustomCameraModal(savePhotos = false) {
      if (!savePhotos && customCameraPhotos.length > 0) {
        const count = customCameraPhotos.length;
        const item = (customCameraRequestIndex !== null && typeof localActiveRequestedItems !== 'undefined') ? localActiveRequestedItems[customCameraRequestIndex] : null;
        const itemName = item?.tenHangMuc || (customCameraRequestIndex !== null ? `Hạng mục ${customCameraRequestIndex + 1}` : 'hạng mục này');
        
        const confirmExit = await showConfirmModal(
          'HỦY BỎ ẢNH ĐÃ CHỤP?',
          `Bạn đã chụp ${count} ảnh cho "${itemName}" nhưng chưa bấm "Xong". Thoát ngay bây giờ sẽ HỦY BỎ toàn bộ ${count} ảnh vừa chụp!`,
          'Hủy ảnh & Thoát',
          'Tiếp tục chụp'
        );
        
        if (!confirmExit) return;
      }

      stopCustomCameraStream();
      
      const modal = document.getElementById('customCameraModal');
      if (modal) modal.style.display = 'none';
      onCustomCameraClose();
      if (savePhotos && customCameraPhotos.length > 0 && customCameraRequestIndex !== null) {
        await handleGarageEvidenceFiles(customCameraRequestIndex, customCameraPhotos, true);
      }
      
      customCameraRequestIndex = null;
      customCameraPhotos = [];
    }
