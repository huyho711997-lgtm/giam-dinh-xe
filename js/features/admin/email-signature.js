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
    const font = 'font-family:Calibri,Arial,sans-serif;font-size:14px;';
    const row = (content, style = '') => content ? '<div style="' + font + style + '">' + content + '</div>' : '';
    const site = sig.website ? '<a href="' + escapeHtml(safeUrl(sig.website,{allowBare:true}) || '#') + '" style="color:#1f5fa8;">' + escapeHtml(websiteText(sig)) + '</a>' : '';
    const phone = sig.phone ? 'T: ' + escapeHtml(sig.phone) : '';
    const mail = sig.email ? 'E: <a href="mailto:' + escapeHtml(sig.email) + '" style="color:#1f5fa8;text-decoration:none;">' + escapeHtml(sig.email) + '</a>' : '';
    const web = site ? 'W: ' + site : '';
    return '<div class="email-signature">'
      + row(escapeHtml(sig.name),'font-weight:700;font-size:16px;color:#1f5fa8;')
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
  return {FIELDS,DEFAULT_WEBSITE,normalize,resolve,text,html,safeUrl,readForm,fillForm,preview,collect,escapeHtml};
})();
