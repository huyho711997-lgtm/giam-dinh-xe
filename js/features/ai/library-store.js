// Kho tài liệu nghiệp vụ dùng chung: Firebase doc_library/{docId} = {meta, chunks, createdAt, createdBy}.
// Chỉ lưu chữ đã trích (không lưu file gốc); meta.nguon là đường dẫn tới bản gốc (Drive/SharePoint).
const TascoLibStore = (() => {
  const PATH = 'doc_library', CACHE_MS = 5 * 60 * 1000;
  let cache = null, loadedAt = 0, indexCache = null;

  const db = () => { if (typeof dbNodeInstance === 'undefined' || !dbNodeInstance) throw new Error('Chưa kết nối cơ sở dữ liệu.'); return dbNodeInstance; };
  const asList = value => !value ? [] : Array.isArray(value) ? value : Object.keys(value).sort((first, second) => Number(first) - Number(second)).map(key => value[key]);
  const str = (value, max) => String(value ?? '').trim().slice(0, max);
  const safeUrl = value => { try { const url = new URL(String(value || '').trim()); return /^https?:$/.test(url.protocol) ? url.href.slice(0, 500) : ''; } catch (_) { return ''; } };

  function cleanMeta(meta = {}) {
    const out = {ten: str(meta.ten, 160) || 'Tài liệu', trangThai: ['dang_hieu_luc', 'het_hieu_luc', 'da_thay_the'].includes(meta.trangThai) ? meta.trangThai : 'dang_hieu_luc'};
    if (meta.soHieu) out.soHieu = str(meta.soHieu, 80);
    if (/^\d{4}-\d{2}-\d{2}$/.test(meta.hieuLucTu || '')) out.hieuLucTu = meta.hieuLucTu;
    if (meta.thayThe) out.thayThe = str(meta.thayThe, 80);
    const link = safeUrl(meta.nguon);
    if (link) out.nguon = link;
    return out;
  }
  const cleanChunks = chunks => asList(chunks).filter(chunk => chunk && typeof chunk.x === 'string' && chunk.x.trim()).slice(0, 600).map(chunk => ({t: str(chunk.t, 200) || 'Nội dung', x: String(chunk.x).slice(0, 6000)}));

  async function list(force = false) {
    if (!force && cache && Date.now() - loadedAt < CACHE_MS) return cache;
    const value = (await db().ref(PATH).once('value')).val() || {};
    cache = Object.keys(value).map(id => ({id, meta: cleanMeta(value[id]?.meta), chunks: cleanChunks(value[id]?.chunks), createdAt: Number(value[id]?.createdAt) || 0, createdBy: str(value[id]?.createdBy, 120)}))
      .filter(doc => doc.chunks.length).sort((first, second) => second.createdAt - first.createdAt);
    loadedAt = Date.now(); indexCache = null;
    return cache;
  }
  const invalidate = () => { cache = null; indexCache = null; };

  async function save({meta, chunks}) {
    const clean = cleanChunks(chunks);
    if (!clean.length) throw new Error('Tài liệu không có nội dung để lưu.');
    const user = typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
    const ref = db().ref(PATH).push();
    await ref.set({meta: cleanMeta(meta), chunks: clean, createdAt: Date.now(), createdBy: user?.email || user?.uid || ''});
    invalidate();
    return ref.key;
  }
  async function remove(id) { await db().ref(PATH + '/' + id).remove(); invalidate(); }
  async function setStatus(id, status) {
    if (!['dang_hieu_luc', 'het_hieu_luc', 'da_thay_the'].includes(status)) throw new Error('Trạng thái không hợp lệ.');
    await db().ref(PATH + '/' + id + '/meta/trangThai').set(status);
    invalidate();
  }
  async function index() {
    const docs = await list();
    return indexCache && indexCache.docs === docs ? indexCache.value : (indexCache = {docs, value: TascoLibSearch.build(docs)}).value;
  }
  async function find(docId) { return (await list()).find(doc => doc.id === docId) || null; }

  return {list, save, remove, setStatus, index, find, invalidate, cleanMeta, cleanChunks, safeUrl};
})();
