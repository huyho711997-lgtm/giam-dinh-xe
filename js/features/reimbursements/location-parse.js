// Đọc vị trí khách gửi qua Zalo/Messenger/Google Maps: link Google Maps, toạ độ thập phân, độ-phút-giây hoặc cả đoạn tin nhắn có chứa link/toạ độ.
// Hàm thuần (không DOM) → kiểm thử được: tests/location-parse.test.mjs.
// parse(text) → {point:{lat,lon}, source} | {shortLink:true, url} | {note} | null (không giống vị trí).
const FieldLocationParse = (() => {
  const validLat = value => Number.isFinite(value) && Math.abs(value) <= 90;
  const validLon = value => Number.isFinite(value) && Math.abs(value) <= 180;
  const pair = (lat, lon) => { lat = Number(lat); lon = Number(lon); return validLat(lat) && validLon(lon) && !(lat === 0 && lon === 0) ? {lat,lon} : null; };
  // Toạ độ thập phân: "12.686955, 108.054487" / "12,686955 108,054487" (dấu phẩy thập phân kiểu VN chỉ nhận khi cách bằng khoảng trắng hoặc ;)
  const NUM = '-?\\d{1,3}(?:\\.\\d+)?';
  const PAIR_RE = new RegExp('(' + NUM + ')\\s*[,;]\\s*(' + NUM + ')');
  const SHORT_HOSTS = /(?:^|\.)(?:maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google|app\.goo\.gl)$/i;

  function dms(text) {
    const m = text.match(/(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:\.\d+)?)\s*(?:["″”]|'')?\s*([NSns])[\s,;]+(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:\.\d+)?)\s*(?:["″”]|'')?\s*([EWew])/);
    if (!m) return null;
    const lat = (Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600) * (/s/i.test(m[4]) ? -1 : 1);
    const lon = (Number(m[5]) + Number(m[6]) / 60 + Number(m[7]) / 3600) * (/w/i.test(m[8]) ? -1 : 1);
    return pair(lat,lon);
  }
  // Các dạng link: ...@lat,lon | q= / query= / ll= / destination= / center= / daddr= = lat,lon | !3dLAT!4dLON | /place|search|dir/lat,lon | mlat=&mlon= | #map=z/lat/lon | cp=lat~lon | geo:lat,lon
  function fromUrl(raw) {
    let text = raw; try { text = decodeURIComponent(raw); } catch (_) { /* giữ nguyên */ }
    const tries = [
      /[?&#](?:q|query|ll|sll|destination|daddr|saddr|center|viewpoint|coord|cbll)=\s*\+?(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)/i,
      /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
      /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
      /\/(?:place|search|dir|maps)\/[^?#]*?(-?\d{1,3}\.\d+),\s*\+?(-?\d{1,3}\.\d+)/,
      /[?&]mlat=(-?\d{1,3}(?:\.\d+)?)&(?:amp;)?mlon=(-?\d{1,3}(?:\.\d+)?)/i,
      /#map=\d+\/(-?\d{1,3}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)/,
      /[?&]cp=(-?\d{1,3}(?:\.\d+)?)~(-?\d{1,3}(?:\.\d+)?)/i,
      /^geo:(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i
    ];
    for (const re of tries) { const m = text.match(re); if (m) { const point = pair(m[1],m[2]); if (point) return point; } }
    return null;
  }

  function parse(input) {
    const text = String(input ?? '').trim();
    if (!text) return null;
    // 1) Có link (Zalo gửi kèm chữ như "Vị trí của tôi: https://...") → lấy link đầu tiên
    const url = (text.match(/(?:https?:\/\/|geo:)[^\s<>"']+/i) || [])[0];
    if (url) {
      const point = fromUrl(url.replace(/[)\].,;]+$/,''));
      if (point) return {point,source:'link'};
      const host = (url.match(/^https?:\/\/([^\/?#:]+)/i) || [])[1] || '';
      if (SHORT_HOSTS.test(host) || /google\.[a-z.]+\/maps\/?$/i.test(url)) return {shortLink:true,url};
      if (/maps|goo\.gl|zalo\.me|here\.com|waze|bing\.com\/maps|openstreetmap/i.test(url)) return {note:'Link này không chứa toạ độ. Hãy mở link, bấm giữ vào ghim để lấy toạ độ rồi dán lại.'};
    }
    // 2) Độ-phút-giây
    const d = dms(text); if (d) return {point:d,source:'dms'};
    // 3) Toạ độ thập phân trần hoặc nằm trong đoạn chữ ("12.68, 108.05"); trong đoạn chữ chỉ nhận khi nằm trong khu vực Việt Nam để tránh nhầm số khác
    const m = text.match(PAIR_RE) || text.match(/(-?\d{1,3}\.\d{3,})\s+(-?\d{1,3}\.\d{3,})/);
    if (m) {
      const point = pair(m[1],m[2]);
      const bare = /^\s*[-+\d.,;\s]+$/.test(text);
      if (point && (bare || (point.lat >= 6 && point.lat <= 24 && point.lon >= 100 && point.lon <= 118))) return {point,source:'coords'};
    }
    return null;
  }
  return {parse};
})();
