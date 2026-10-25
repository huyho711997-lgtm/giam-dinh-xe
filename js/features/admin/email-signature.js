// Chân email theo từng người dùng. Lưu tại users/<uid>/profile/emailSignature, quản trị viên chỉnh trong "Quản lý người dùng".
// Dùng cho: nội dung thư soạn trong hồ sơ (văn bản thường) và file thư nháp .eml (HTML, có banner).
const EmailSignature = (() => {
  const DEFAULT_WEBSITE = 'www.tascoinsurance.com.vn';
  const FIELDS = {name:80,title:120,phone:30,email:120,website:120,banner:500};
  const clip = (value, max) => String(value ?? '').replace(/[\r\n\t]+/g,' ').trim().slice(0,max);
  const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  // Chỉ nhận ảnh https công khai: chặn javascript:, data:, http không mã hóa.
  function safeUrl(value, {allowBare = false} = {}) {
    const text = clip(value,500);
    if (!text) return '';
    const candidate = allowBare && !/^[a-z][a-z0-9+.-]*:/i.test(text) ? 'https://' + text : text;
    try { const url = new URL(candidate); return url.protocol === 'https:' && url.hostname.includes('.') ? url.href : ''; } catch (_) { return ''; }
  }
  function defaults(profile = {}) {
    return {name:clip(profile.displayName,FIELDS.name),title:'',phone:clip(profile.phone ?? profile.phoneNumber,FIELDS.phone),email:clip(profile.email,FIELDS.email),website:DEFAULT_WEBSITE,banner:''};
  }
  function normalize(raw, profile = {}) {
    const base = defaults(profile), saved = raw && typeof raw === 'object' ? raw : {}, result = {};
    for (const [key,max] of Object.entries(FIELDS)) result[key] = Object.prototype.hasOwnProperty.call(saved,key) ? clip(saved[key],max) : base[key];
    result.banner = safeUrl(result.banner);
    return result;
  }
  const websiteText = sig => sig.website.replace(/^https?:\/\//i,'').replace(/\/$/,'');
  // Chưa thiết lập chân email → chỉ ký tên như trước đây (không tự thêm thông tin).
  function resolve(profile = {}) {
    return profile.emailSignature && typeof profile.emailSignature === 'object' ? normalize(profile.emailSignature,profile) : normalize({name:profile.displayName,title:'',phone:'',email:'',website:'',banner:''},profile);
  }
  function text(sig) {
    const lines = [sig.name,sig.title].filter(Boolean);
    const contact = [sig.phone ? 'T: ' + sig.phone : '',sig.email ? 'E: ' + sig.email : '',sig.website ? 'W: ' + websiteText(sig) : ''].filter(Boolean);
    return lines.concat(contact.length ? [''] : [],contact).join('\n');
  }
  function html(sig) {
    const font = 'font-family:"Times New Roman",Times,serif;font-size:12pt;';
    const row = (content, style = '') => content ? '<div style="' + font + style + '">' + content + '</div>' : '';
    const site = sig.website ? '<a href="' + escapeHtml(safeUrl(sig.website,{allowBare:true}) || '#') + '" style="color:#1f5fa8;">' + escapeHtml(websiteText(sig)) + '</a>' : '';
    const phone = sig.phone ? 'T: ' + escapeHtml(sig.phone) : '';
    const mail = sig.email ? 'E: <a href="mailto:' + escapeHtml(sig.email) + '" style="color:#1f5fa8;text-decoration:none;">' + escapeHtml(sig.email) + '</a>' : '';
    const web = site ? 'W: ' + site : '';
    return '<div class="email-signature">'
      + row(escapeHtml(sig.name),'font-weight:700;font-size:14pt;color:#1f5fa8;')
      + row(escapeHtml(sig.title),'color:#1f5fa8;')
      + (phone || mail || web ? '<div style="height:12px"></div>' : '')
      + row(phone) + row([mail,web].filter(Boolean).join('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'))
      + (sig.banner ? '<div style="margin-top:8px"><img src="' + escapeHtml(sig.banner) + '" alt="" style="max-width:600px;width:100%;height:auto;border:0;display:block"></div>' : '')
      + '</div>';
  }
  const ids = {name:'SigName',title:'SigTitle',phone:'SigPhone',email:'SigEmail',website:'SigWebsite',banner:'SigBanner'};
  const element = (prefix,key) => document.getElementById(prefix + ids[key]);
  function readForm(prefix) {
    const sig = {};
    for (const key of Object.keys(FIELDS)) sig[key] = clip(element(prefix,key)?.value,FIELDS[key]);
    return sig;
  }
  function fillForm(prefix, profile = {}) {
    const sig = normalize(profile.emailSignature,profile);
    for (const key of Object.keys(FIELDS)) { const input = element(prefix,key); if (input) input.value = sig[key]; }
    preview(prefix);
  }
  function preview(prefix) {
    const box = document.getElementById(prefix + 'SigPreview');
    if (!box) return;
    const sig = readForm(prefix); sig.banner = safeUrl(sig.banner);
    box.innerHTML = sig.name || sig.title || sig.phone || sig.email || sig.website || sig.banner ? html(sig) : '<span class="admin-signature-empty">Chưa có thông tin chân email.</span>';
    const warning = document.getElementById(prefix + 'SigBannerHint');
    const raw = clip(element(prefix,'banner')?.value,500);
    if (warning) warning.dataset.invalid = String(Boolean(raw) && !sig.banner);
  }
  // Giá trị lưu vào hồ sơ; trả về lỗi dạng chuỗi nếu dữ liệu sai (banner không phải https).
  function collect(prefix) {
    const sig = readForm(prefix);
    if (sig.banner && !safeUrl(sig.banner)) return {error:'Banner phải là đường dẫn ảnh bắt đầu bằng https://'};
    if (sig.email && !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(sig.email)) return {error:'Email trong chân email chưa hợp lệ.'};
    sig.banner = safeUrl(sig.banner);
    return {value:sig};
  }
  // ---- Tải ảnh banner trực tiếp (dùng chung cấu hình Cloudinary của hệ thống) ----
  const BANNER_TYPES = ['image/png','image/jpeg','image/webp','image/gif'], BANNER_MAX_BYTES = 5 * 1024 * 1024, BANNER_MAX_WIDTH = 1200;
  function validateBannerFile(file) {
    if (!file) return 'Chưa chọn ảnh.';
    if (!BANNER_TYPES.includes(file.type)) return 'Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF.';
    if (file.size > BANNER_MAX_BYTES) return 'Ảnh quá lớn (tối đa 5MB).';
    return '';
  }
  // Thu nhỏ ảnh rộng hơn 1200px để thư nhẹ và tải nhanh; GIF giữ nguyên để không mất hoạt ảnh.
  async function shrinkBanner(file) {
    if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file;
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch (_) { return file; }
    try {
      if (bitmap.width <= BANNER_MAX_WIDTH) return file;
      const canvas = document.createElement('canvas');
      canvas.width = BANNER_MAX_WIDTH; canvas.height = Math.round(bitmap.height * BANNER_MAX_WIDTH / bitmap.width);
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
      const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      return await new Promise(resolve => canvas.toBlob(blob => resolve(blob || file),type,0.9));
    } finally { bitmap.close?.(); }
  }
  async function uploadBanner(prefix, file) {
    const problem = validateBannerFile(file);
    if (problem) throw new Error(problem);
    if (typeof uploadSingleImageToCloudinaryEngine !== 'function') throw new Error('Chưa sẵn sàng tải ảnh. Tải lại trang rồi thử lại.');
    const url = safeUrl(await uploadSingleImageToCloudinaryEngine(await shrinkBanner(file)));
    if (!url) throw new Error('Máy chủ ảnh trả về đường dẫn không hợp lệ.');
    const input = element(prefix,'banner');
    if (input) input.value = url;
    preview(prefix);
    return url;
  }
  // Gắn vào nút "Tải ảnh lên" + ô chọn tệp (và kéo thả vào ô banner) của form.
  async function handleBannerPick(prefix, input) {
    const file = input.files?.[0]; input.value = '';
    const button = document.getElementById(prefix + 'SigBannerUpload'), hint = document.getElementById(prefix + 'SigBannerHint');
    if (!file) return;
    const label = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Đang tải…'; }
    try { await uploadBanner(prefix,file); triggerToast('Đã tải banner lên. Bấm Lưu thay đổi để áp dụng.','success'); }
    catch (error) { if (hint) hint.dataset.invalid = 'true'; triggerToast('Không tải được banner: ' + (error.message || error),'error'); }
    finally { if (button) { button.disabled = false; button.textContent = label; } }
  }
  return {FIELDS,DEFAULT_WEBSITE,validateBannerFile,uploadBanner,handleBannerPick,normalize,resolve,text,html,safeUrl,readForm,fillForm,preview,collect,escapeHtml};
})();
