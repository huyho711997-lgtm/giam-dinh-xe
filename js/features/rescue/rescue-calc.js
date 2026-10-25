// Tính chi phí cứu hộ phương tiện: đơn giá (trần nội bộ, chưa VAT), quy tắc tính và cấp phê duyệt.
// Module thuần dữ liệu + hàm tính, không đụng DOM để kiểm thử được (xem tests/rescue-calc.test.mjs).
// Giao diện nằm ở rescue-page.js.
const RescueCalc = (() => {
  // Kéo xe: 10 km đầu tính trọn gói (base), từ km thứ 11 tính theo km (km), phần lẻ làm tròn lên.
  const TOW = [
    {label:'≤ 12 chỗ hoặc ≤ 1,4 tấn',base:800000,km:30000},
    {label:'Trên 12–30 chỗ hoặc >1,4–3 tấn',base:1300000,km:35000},
    {label:'Trên 30–39 chỗ hoặc >3–5 tấn',base:1690000,km:40000},
    {label:'Trên 39–45 chỗ hoặc >5–8 tấn',base:1820000,km:45000},
    {label:'Trên 45–54 chỗ hoặc >8–13 tấn',base:1820000,km:50000},
    {label:'Trên 54–80 chỗ hoặc >13–18 tấn',base:2340000,km:60000},
    {label:'Trên 80 chỗ hoặc >18 tấn',base:3250000,km:70000}
  ];
  // Nhóm xe cẩu (cột của bảng đơn giá cẩu).
  const CLASSES = [
    {key:'A',range:'≤12 chỗ / ≤2 tấn'},
    {key:'B',range:'>12–30 chỗ / >2–3,5 tấn'},
    {key:'C',range:'>30–45 chỗ / >3,5–8 tấn'},
    {key:'D',range:'>45–54 chỗ / >8–13 tấn'},
    {key:'E',range:'>54–80 chỗ / >13–18 tấn'},
    {key:'F',range:'>80 chỗ / >18 tấn, đầu kéo, container'}
  ];
  // Cẩu xe: price theo từng nhóm xe (null = báo giá riêng).
  const CRANE = [
    {label:'Lật trên mặt đường hoặc dưới taluy ≤ 5 m',price:[1700000,2200000,5000000,7000000,8500000,10500000]},
    {label:'Dưới taluy >5–10 m',price:[2300000,3600000,5500000,8000000,9500000,11500000]},
    {label:'Dưới taluy >10–30 m',price:[3500000,5000000,7000000,10500000,12500000,15500000]},
    {label:'Dưới taluy >30–50 m',price:[4500000,7000000,9500000,14500000,18000000,22500000]},
    {label:'Dưới taluy >50–100 m',price:[7000000,10000000,13000000,18500000,22000000,30000000]},
    {label:'Trên 100 m hoặc cần >1 xe cẩu',price:null}
  ];
  // Hệ số vùng (không cộng dồn).
  const REGIONS = [
    {key:'A',name:'Vùng A',pct:0,desc:'Hà Nội, TP.HCM, Hải Phòng, Đà Nẵng, Cần Thơ, Bình Dương, Đồng Nai, đô thị loại I'},
    {key:'B',name:'Vùng B',pct:10,desc:'Tỉnh đồng bằng, trung du'},
    {key:'C',name:'Vùng C',pct:15,desc:'Miền núi, Tây Nguyên, biên giới, hải đảo'}
  ];
  // Phụ phí điều kiện: pct tính trên giá cứu hộ sau hệ số vùng; fix là số tiền cố định.
  const SURCHARGES = [
    {key:'night',label:'Ban đêm 18h00–06h00',note:'+15% trên giá cứu hộ',pct:15},
    {key:'disaster',label:'Thiên tai / ngập diện rộng',note:'+30% · theo thông báo cơ quan có thẩm quyền',pct:30},
    {key:'highway',label:'Đường cao tốc',note:'+35% trên giá cứu hộ',pct:35},
    {key:'dolly',label:'Dolly / kích đôi',note:'+200.000đ · khóa 4 bánh, xe điện…',fix:200000}
  ];
  const SURCHARGE_CAP = 0.5;  // tổng phụ phí điều kiện ≤ 50% giá cứu hộ
  const APPROVAL = [
    ['Trong barem ≤ 3 triệu','Trưởng Zone'],
    ['Trong barem >3 – ≤5 triệu','Chuyên quản'],
    ['Trong barem >5 – ≤20 triệu','TP KSVH / Giám đốc Trung tâm DVGĐBT'],
    ['Trong barem >20 triệu','Giám đốc Ban GĐBT'],
    ['Vượt barem, tổng ≤ 5 triệu','Chuyên quản'],
    ['Vượt barem hoặc tổng >5 triệu','TP KSVH / Giám đốc Trung tâm DVGĐBT'],
    ['Xe điện, container, rơi vực/sông, cháy, cứu hộ đặc biệt','Giám đốc Ban GĐBT']
  ];
  const EVIDENCE = [
    'Ảnh hiện trường trước khi cứu hộ','Ảnh phương tiện cứu hộ (biển số xe cứu hộ)','Ảnh bàn giao xe sau cứu hộ',
    'Định vị GPS / lộ trình di chuyển','Xác nhận sử dụng dịch vụ của khách hàng/chủ xe'
  ];
  const CONTROL = [
    {title:'Thứ tự ưu tiên đơn vị cứu hộ',text:'VETC cứu hộ miễn phí → đối tác được Tasco duyệt → gara/đối tác chiến lược trong barem → đơn vị ngoài (khẩn cấp, có xác nhận lãnh đạo Zone/Trung tâm).'},
    {title:'Cảnh báo kiểm soát',text:'Giá/km cao hơn >20% mức trung bình cùng tỉnh/loại xe/cự ly; đơn vị cứu hộ vượt barem >15%/tháng.'},
    {title:'Trường hợp báo giá riêng',text:'Container, đầu kéo, rơ-moóc, siêu trường siêu trọng, xe chuyên dùng, máy công trình, xe điện, rơi vực/sông/biển/hồ, cháy pin, đảo/hầm mỏ/địa điểm đặc biệt.'},
    {title:'Nguyên tắc',text:'Đơn giá là trần nội bộ chưa VAT; thanh toán theo hóa đơn hợp lệ, không vượt số được duyệt.'}
  ];
  const MAX_KM = 10000;
  const FREE_KM = 10;

  const vnd = amount => Math.round(Number(amount) || 0).toLocaleString('vi-VN') + 'đ';
  const pick = (index, list) => { const n = Math.trunc(Number(index)); return Number.isInteger(n) && n >= 0 && n < list.length ? n : 0; };

  function approver(total, over, special, quote) {
    if (special) return 'Giám đốc Ban GĐBT';
    if (quote) return 'TP KSVH / Giám đốc Trung tâm DVGĐBT (tối thiểu) · tổng chi phí theo báo giá';
    if (over) return total <= 5000000 ? 'Chuyên quản' : 'TP KSVH / Giám đốc Trung tâm DVGĐBT';
    if (total <= 3000000) return 'Trưởng Zone';
    if (total <= 5000000) return 'Chuyên quản';
    if (total <= 20000000) return 'TP KSVH / Giám đốc Trung tâm DVGĐBT';
    return 'Giám đốc Ban GĐBT';
  }

  // input: {service:'tow'|'crane'|'both', towGroup, km, cranePos, craneClass, region, surcharges:{key:true}, special, over}
  function calculate(input = {}) {
    const service = input.service === 'crane' || input.service === 'both' ? input.service : 'tow';
    const region = REGIONS[pick(input.region,REGIONS)];
    const lines = [];
    let base = 0, quote = false, extraKm = 0, kmClamped = false;
    if (service !== 'crane') {
      const group = TOW[pick(input.towGroup,TOW)];
      const rawKm = Number(input.km);
      const km = Number.isNaN(rawKm) ? 0 : Math.max(0,rawKm);  // vô cực vẫn bị chặn ở MAX_KM bên dưới
      kmClamped = km > MAX_KM;
      extraKm = Math.ceil(Math.max(0,Math.min(km,MAX_KM) - FREE_KM));
      lines.push({label:'Kéo xe · ' + FREE_KM + ' km đầu',amount:group.base});
      if (extraKm) lines.push({label:'Thêm ' + extraKm + ' km × ' + vnd(group.km),amount:extraKm * group.km});
      base += group.base + extraKm * group.km;
    }
    if (service !== 'tow') {
      const row = CRANE[pick(input.cranePos,CRANE)], classIndex = pick(input.craneClass,CLASSES);
      const price = row.price ? row.price[classIndex] : null;
      if (price == null) { quote = true; lines.push({label:'Cẩu xe · ' + row.label,amount:null}); }
      else { lines.push({label:'Cẩu xe · nhóm ' + CLASSES[classIndex].key,amount:price}); base += price; }
    }
    const regionAmount = Math.round(base * (1 + region.pct / 100)) - base;
    const rescue = base + regionAmount;
    let pctSum = 0, fixSum = 0;
    const surcharges = [];
    for (const item of SURCHARGES) {
      if (!input.surcharges?.[item.key]) continue;
      if (item.pct) { pctSum += item.pct; surcharges.push({label:item.label + ' (+' + item.pct + '%)',amount:Math.round(rescue * item.pct / 100)}); }
      else { fixSum += item.fix; surcharges.push({label:item.label,amount:item.fix}); }
    }
    const cap = Math.round(rescue * SURCHARGE_CAP);
    let surchargeTotal = Math.round(rescue * pctSum / 100) + fixSum, capped = false;
    if (surchargeTotal > cap) { surchargeTotal = cap; capped = true; }
    const total = rescue + surchargeTotal, special = !!input.special, over = !!input.over;
    return {service,lines,base,region,regionAmount,rescue,surcharges,surchargeTotal,cap,capped,total,quote,special,over,extraKm,kmClamped,
      approver:approver(total,over,special,quote)};
  }

  // Cảnh báo kèm kết quả (tách riêng để giao diện và bản sao chép dùng chung).
  function warnings(result) {
    const list = [];
    if (result.kmClamped) list.push('Số km vượt ' + MAX_KM.toLocaleString('vi-VN') + ' km, kết quả chỉ tính tối đa ' + MAX_KM.toLocaleString('vi-VN') + ' km. Kiểm tra lại số km nhập.');
    if (result.capped) list.push('Tổng phụ phí điều kiện đã chạm trần 50% giá cứu hộ (' + vnd(result.cap) + '). Vượt mức này phải được Giám đốc Ban GĐBT phê duyệt.');
    if (result.special) list.push('Tình huống đặc biệt: cần báo giá/duyệt riêng, kết quả chỉ mang tính tham khảo.');
    if (result.quote) list.push('Chưa tính chi phí cẩu trên 100 m hoặc cần nhiều hơn 1 xe cẩu.');
    return list;
  }
  const NOTES = [
    'Nhiều tiêu chí (chỗ ngồi/tải trọng) cùng áp dụng: chọn nhóm có mức rủi ro cao hơn. Không cộng dồn nhiều hệ số vùng.',
    'Phụ phí không tính phí BOT, cẩu, phà/phao, bãi đỗ; các khoản này theo chứng từ.'
  ];

  const totalText = result => result.quote ? (result.total ? vnd(result.total) + ' + báo giá' : 'Báo giá') : vnd(result.total);

  // Bản văn bản để dán vào email / tờ trình.
  function summaryText(result) {
    const rows = ['TÍNH CHI PHÍ CỨU HỘ (trần nội bộ, chưa VAT)'];
    for (const line of result.lines) rows.push('- ' + line.label + ': ' + (line.amount == null ? 'Báo giá' : vnd(line.amount)));
    if (result.region.pct) rows.push('- Hệ số ' + result.region.name + ' (+' + result.region.pct + '%): +' + vnd(result.regionAmount));
    if (!result.quote || result.rescue) rows.push('- Giá cứu hộ sau hệ số vùng: ' + vnd(result.rescue));
    for (const line of result.surcharges) rows.push('- ' + line.label + ': +' + vnd(line.amount));
    if (result.capped) rows.push('- Phụ phí đã chạm trần 50% giá cứu hộ: ' + vnd(result.surchargeTotal));
    rows.push('TỔNG TRẦN CHI PHÍ: ' + totalText(result),'Cấp phê duyệt: ' + result.approver);
    for (const warning of warnings(result)) rows.push('Lưu ý: ' + warning);
    return rows.join('\n');
  }

  return {TOW,CLASSES,CRANE,REGIONS,SURCHARGES,APPROVAL,EVIDENCE,CONTROL,NOTES,SURCHARGE_CAP,MAX_KM,FREE_KM,vnd,calculate,warnings,summaryText,totalText,approver};
})();
