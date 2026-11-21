// Lưu / mở sơ đồ hiện trường trên Cloudinary cho trang vẽ ĐỘC LẬP (so-do-hien-truong.html).
// Dùng đúng cấu hình Cloudinary của app (CONFIG.CLOUDINARY_* hoặc localStorage claimvision-cloudinary-*), upload preset
// không ký (unsigned) nên KHÔNG cần đăng nhập. File là JSON thuần (cùng định dạng "Lưu file"), tải lên dạng `raw`.
//  • Mỗi lần Lưu tạo một bản mới; danh sách "đã lưu" (tên, giờ, liên kết) ghi trong localStorage của máy này.
//  • Liên kết chia sẻ: so-do-hien-truong.html?cloud=<đường dẫn> → ai mở cũng thấy đúng sơ đồ đó (chỉ đọc, bản sao).
//  • Chỉ nhận đường dẫn thuộc thư mục <folder>/scene_diagrams của cloud đã cấu hình, nên liên kết lạ không tải được URL tuỳ ý.
// Lưu ý: ai có liên kết đều xem được (Cloudinary raw công khai); trình duyệt không giữ API secret nên không xoá được file trên Cloudinary.
const SceneCloud = (() => {
  const INDEX_KEY = 'sceneStandalone.cloud.v1', SUBFOLDER = 'scene_diagrams';
  const MAX_INDEX = 50, MAX_BYTES = 8 * 1024 * 1024, UPLOAD_TIMEOUT = 60000;
  const REF_PATTERN = /^(?:v\d{1,12}\/)?[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)+$/;

  function settings() {
    const read = key => { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } };
    const cfg = typeof CONFIG !== 'undefined' && CONFIG ? CONFIG : {};
    return {
      cloudName: read('claimvision-cloudinary-cloud') || cfg.CLOUDINARY_CLOUD_NAME || '',
      preset: read('claimvision-cloudinary-preset') || cfg.CLOUDINARY_UPLOAD_PRESET || '',
      folder: (read('claimvision-cloudinary-folder') || cfg.CLOUDINARY_FOLDER || 'giam_dinh_xe').replace(/^\/+|\/+$/g, '')
    };
  }
  const configured = () => { const s = settings(); return !!(s.cloudName && s.preset && !/PASTE_/.test(s.cloudName)); };

  // ---- Đường dẫn (ref) <-> URL ----
  // ref = phần sau "/raw/upload/" của secure_url, vd "v1730/giam_dinh_xe/scene_diagrams/abc123.json".
  function isValidRef(ref) {
    return typeof ref === 'string' && ref.length <= 240 && !ref.includes('..') && REF_PATTERN.test(ref) && ref.split('/').includes(SUBFOLDER);
  }
  function refFromUrl(url, cloudName) {
    let parsed;
    try { parsed = new URL(String(url || '')); } catch (_) { return ''; }
    const prefix = '/' + encodeURIComponent(cloudName) + '/raw/upload/';
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' || !parsed.pathname.startsWith(prefix)) return '';
    const ref = decodeURIComponent(parsed.pathname.slice(prefix.length));
    return isValidRef(ref) ? ref : '';
  }
  const urlFromRef = (ref, cloudName) => 'https://res.cloudinary.com/' + encodeURIComponent(cloudName) + '/raw/upload/' + String(ref).split('/').map(encodeURIComponent).join('/');
  // base: địa chỉ trang (không kèm ?query/#hash)
  const shareLink = (base, ref) => String(base).split(/[?#]/)[0] + '?cloud=' + encodeURIComponent(ref);
  // Nhận: liên kết đầy đủ, chuỗi "?cloud=…" hoặc chính ref. Trả '' nếu không hợp lệ.
  function refFromInput(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const match = text.match(/[?&]cloud=([^&#\s]+)/);
    let candidate = text;
    if (match) { try { candidate = decodeURIComponent(match[1]); } catch (_) { return ''; } }
    else if (/^https?:\/\//i.test(text)) return refFromUrl(text, settings().cloudName);
    return isValidRef(candidate) ? candidate : '';
  }

  // ---- Danh sách đã lưu (cục bộ) ----
  function readIndex() {
    try {
      const list = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
      return (Array.isArray(list) ? list : []).filter(item => item && isValidRef(item.ref)).map(item => ({
        ref: item.ref, name: String(item.name || 'Sơ đồ hiện trường').slice(0, 120), savedAt: Number(item.savedAt) || 0, shapes: Number(item.shapes) || 0, bytes: Number(item.bytes) || 0
      }));
    } catch (_) { return []; }
  }
  function writeIndex(list) {
    try { localStorage.setItem(INDEX_KEY, JSON.stringify(list.slice(0, MAX_INDEX))); return true; } catch (_) { return false; }
  }
  // Ghi một bản vừa lưu lên đầu danh sách; `replaceRef` = bản cũ của cùng sơ đồ (thay thế để danh sách không phình ra).
  function remember(entry, replaceRef) {
    const list = readIndex().filter(item => item.ref !== entry.ref && item.ref !== replaceRef);
    list.unshift(entry); writeIndex(list); return list.slice(0, MAX_INDEX);
  }
  function rename(ref, name) {
    const clean = String(name || '').trim().slice(0, 120);
    if (!clean) return readIndex();
    const list = readIndex().map(item => item.ref === ref ? {...item, name: clean} : item); writeIndex(list); return list;
  }
  function forget(ref) { const list = readIndex().filter(item => item.ref !== ref); writeIndex(list); return list; }

  // ---- Mạng ----
  async function withTimeout(run, ms) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), ms);
    try { return await run(controller && controller.signal); } finally { clearTimeout(timer); }
  }
  // text: nội dung JSON đã dựng; trả {ref, url, bytes}
  async function upload(text, fileName) {
    const s = settings();
    if (!configured()) throw new Error('Chưa cấu hình Cloudinary (cloud name / upload preset).');
    const bytes = new Blob([text]).size;
    if (bytes > MAX_BYTES) throw new Error('Sơ đồ quá lớn để lưu lên đám mây (tối đa 8 MB).');
    const body = new FormData();
    body.append('file', new Blob([text], {type: 'application/json'}), (fileName || 'so-do-hien-truong') + '.json');
    body.append('upload_preset', s.preset);
    body.append('folder', s.folder + '/' + SUBFOLDER);
    let response;
    try { response = await withTimeout(signal => fetch('https://api.cloudinary.com/v1_1/' + encodeURIComponent(s.cloudName) + '/raw/upload', {method: 'POST', body, signal}), UPLOAD_TIMEOUT); }
    catch (error) { throw new Error(error && error.name === 'AbortError' ? 'Tải lên quá lâu, vui lòng kiểm tra mạng rồi thử lại.' : 'Mất kết nối khi lưu lên đám mây.'); }
    let data = null;
    try { data = await response.json(); } catch (_) { /* xử lý bên dưới */ }
    if (!response.ok || !data) throw new Error((data && data.error && data.error.message) || 'Cloudinary từ chối file (kiểm tra upload preset cho phép tài liệu raw).');
    const ref = refFromUrl(data.secure_url, s.cloudName);
    if (!ref) throw new Error('Cloudinary trả về đường dẫn không nằm trong thư mục ' + SUBFOLDER + ' — kiểm tra upload preset/thư mục.');
    return {ref, url: data.secure_url, bytes};
  }
  async function download(ref) {
    if (!isValidRef(ref)) throw new Error('Liên kết sơ đồ không hợp lệ.');
    const s = settings();
    if (!s.cloudName) throw new Error('Chưa cấu hình Cloudinary.');
    let response;
    try { response = await withTimeout(signal => fetch(urlFromRef(ref, s.cloudName), {cache: 'no-store', signal}), UPLOAD_TIMEOUT); }
    catch (_) { throw new Error('Không tải được sơ đồ từ đám mây (mất kết nối).'); }
    if (response.status === 404) throw new Error('Không tìm thấy sơ đồ này trên đám mây (có thể đã bị xoá).');
    if (!response.ok) throw new Error('Đám mây trả lỗi ' + response.status + ' khi tải sơ đồ.');
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_BYTES) throw new Error('File sơ đồ quá lớn.');
    const text = await response.text();
    if (text.length > MAX_BYTES) throw new Error('File sơ đồ quá lớn.');
    return text;
  }

  return {settings, configured, isValidRef, refFromUrl, urlFromRef, shareLink, refFromInput, readIndex, remember, rename, forget, upload, download, INDEX_KEY, SUBFOLDER, MAX_BYTES};
})();
