// Trang "Chi phí cứu hộ": tính nhanh chi phí kéo xe / cẩu xe theo barem nội bộ + tra cứu đơn giá, quy định.
// Số liệu và công thức nằm ở rescue-calc.js (RescueCalc). Giao diện dùng chung bộ token --sf-* và component
// của trang Biểu mẫu (đầu trang, thẻ thư viện, dropdown SharedFormsControls) để đồng bộ với các trang khác.
const RescuePage = (() => {
  const icons = {
    truck:'<path d="M3 16V8h11v8M14 11h4l3 3v2h-7M3 16h18"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    crane:'<path d="M4 20h16M7 20V8l10-4M17 4v7"/><path d="M17 11v3a1.6 1.6 0 1 1-1.6 1.6"/>',
    both:'<path d="M3 17V9h8v8M11 12h3l3 3v2h-6M3 17h14"/><circle cx="6.5" cy="18" r="1.5"/><circle cx="14.5" cy="18" r="1.5"/><path d="M19 4v8"/><path d="M19 12a1.5 1.5 0 1 1-1.5 1.5"/>',
    calc:'<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/>',
    book:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
    reset:'<path d="M20 7A9 9 0 1 0 21 14M20 3v5h-5"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    alert:'<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4M12 17.2v.1"/>',
    user:'<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.7-3.6 3.2-5.5 6.5-5.5s5.8 1.9 6.5 5.5"/>',
    receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    image:'<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="m4 17 5-4.5 3.5 3L16 12l4 4.5"/>',
    pin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'
  };
  const svg = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || '') + '</svg>';
  const esc = text => String(text ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const vnd = amount => RescueCalc.vnd(amount);
  const SERVICES = [['tow','Kéo xe','truck'],['crane','Cẩu xe','crane'],['both','Kéo + cẩu','both']];
  const REF_TABS = [['tow','Kéo xe'],['crane','Cẩu xe'],['surcharge','Phụ phí & vùng'],['approval','Phê duyệt'],['control','Hồ sơ & kiểm soát']];
  const DEFAULTS = () => ({service:'tow',towGroup:0,km:'10',cranePos:0,craneClass:0,region:0,surcharges:{},special:false,over:false});

  let host = null, state = DEFAULTS(), tab = 'calc', refTab = 'tow', kmMode = 'manual', locate = null, geoClient = null;

  const options = (items, label) => items.map((item,index) => '<option value="' + index + '">' + esc(label(item,index)) + '</option>').join('');
  const select = (id, label, description, icon, html) => '<label class="rc-field"><span class="rc-label">' + esc(label) + '</span><select id="' + id + '" data-rc="' + id + '" data-sf-select data-sf-label="' + esc(label) + '" data-sf-description="' + esc(description) + '" data-sf-icon="' + icon + '">' + html + '</select></label>';
  const check = (attr, title, note) => '<label class="rc-check"><input type="checkbox" ' + attr + '><span class="rc-box" aria-hidden="true">' + svg('check') + '</span><span class="rc-check-copy"><strong>' + esc(title) + '</strong><small>' + esc(note) + '</small></span></label>';
  const block = (number, title, note, body) => '<section class="rc-block"><header><span class="rc-step">' + number + '</span><div><h2>' + esc(title) + '</h2><p>' + esc(note) + '</p></div></header><div class="rc-block-body">' + body + '</div></section>';

  function calcPane() {
    const R = RescueCalc;
    const service = '<div class="rc-seg" role="group" aria-label="Hạng mục cứu hộ">' + SERVICES.map(([key,label,icon]) => '<button type="button" class="sf-source-tab" data-rc-service="' + key + '" aria-pressed="' + (state.service === key) + '">' + svg(icon) + esc(label) + '</button>').join('') + '</div>';
    const tow = '<div data-rc-block="tow">' + select('towGroup','Nhóm xe (kéo)','Chọn theo số chỗ hoặc tải trọng','truck',options(R.TOW,item => item.label)) +
      '<label class="rc-field"><span class="rc-label">Quãng đường kéo</span><span class="rc-unit"><input id="km" data-rc="km" type="number" inputmode="decimal" min="0" max="' + R.MAX_KM + '" step="0.1" placeholder="Ví dụ 25" value="' + esc(state.km) + '"><i>km</i></span><small class="rc-hint" data-rc-kmhint></small></label>' +
      '<div class="rc-seg" role="group" aria-label="Cách xác định quãng đường"><button type="button" class="sf-source-tab" data-rc-kmmode="manual" aria-pressed="true">Nhập số km</button><button type="button" class="sf-source-tab" data-rc-kmmode="locate" aria-pressed="false">' + svg('pin') + 'Định vị tính km</button></div>' +
      '<div class="rl-root" data-rc-locate hidden></div></div>';
    const crane = '<div data-rc-block="crane">' + select('craneClass','Nhóm xe (cẩu)','Chọn theo số chỗ hoặc tải trọng','crane',options(R.CLASSES,item => 'Nhóm ' + item.key + ' · ' + item.range)) +
      select('cranePos','Vị trí xe cần cẩu','Mức độ khó của hiện trường','pin',options(R.CRANE,item => item.label)) + '</div>';
    const region = select('region','Vùng địa lý','Hệ số vùng áp dụng cho giá cứu hộ','globe',options(R.REGIONS,item => item.name + ' · +' + item.pct + '%')) + '<p class="rc-hint" data-rc-regionhint></p>';
    const surcharges = '<div class="rc-checks">' + R.SURCHARGES.map(item => check('data-rc-sur="' + item.key + '"',item.label,item.note)).join('') + '</div>';
    const special = '<div class="rc-checks">' +
      check('data-rc-flag="special"','Xe đặc biệt / sự cố nghiêm trọng','Xe điện, container, đầu kéo, rơi vực/sông/biển, cháy pin, siêu trường siêu trọng, máy công trình, đảo/hầm mỏ') +
      check('data-rc-flag="over"','Chi phí đề xuất vượt barem','Dùng để xác định cấp phê duyệt') + '</div>';
    return '<div class="rc-calc"><div class="rc-form">' +
      block('01','Hạng mục & phương tiện','Chọn dịch vụ, nhóm xe và quãng đường',service + tow + crane) +
      block('02','Vùng & điều kiện','Hệ số vùng và các phụ phí điều kiện',region + '<span class="rc-label">Phụ phí điều kiện</span>' + surcharges) +
      block('03','Tình huống đặc biệt','Ảnh hưởng đến cấp phê duyệt',special) +
      '</div><aside class="rc-result" aria-label="Kết quả tính chi phí" aria-live="polite"></aside></div>';
  }

  const table = (head, rows, firstWide = true) => '<div class="rc-table-wrap"><table class="rc-table' + (firstWide ? ' is-first-wide' : '') + '"><thead><tr>' + head.map(cell => '<th>' + esc(cell) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(row => '<tr>' + row.map(cell => '<td' + (cell === 'Báo giá' ? ' class="rc-quote"' : '') + '>' + esc(cell) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  const refList = items => '<ul class="rc-ref-list">' + items.map(item => '<li><strong>' + esc(item[0]) + '</strong><span>' + esc(item[1]) + '</span></li>').join('') + '</ul>';

  function refBody() {
    const R = RescueCalc;
    if (refTab === 'tow') return table(['Nhóm xe','10 km đầu','Từ km thứ 11 (mỗi km)'],R.TOW.map(item => [item.label,vnd(item.base),vnd(item.km)])) +
      '<p class="rc-ref-note"><b>Quy tắc:</b> phần km vượt 10 km làm tròn lên số nguyên; khoảng cách theo bản đồ/GPS. Kéo xe và cẩu xe là hai hạng mục độc lập.</p>';
    if (refTab === 'crane') return table(['Vị trí xe'].concat(R.CLASSES.map(item => 'Nhóm ' + item.key)),R.CRANE.map(row => [row.label].concat(row.price ? row.price.map(vnd) : R.CLASSES.map(() => 'Báo giá')))) +
      '<p class="rc-ref-note">' + R.CLASSES.map(item => '<b>' + item.key + '</b>: ' + esc(item.range)).join(' · ') + '</p>';
    if (refTab === 'surcharge') return '<h3 class="rc-ref-title">Phụ phí điều kiện</h3>' + refList(R.SURCHARGES.map(item => [item.label,item.note]).concat([['Giới hạn','Tổng phụ phí điều kiện (trừ BOT, cẩu, phà/phao, bãi) ≤ ' + R.SURCHARGE_CAP * 100 + '% đơn giá cứu hộ, trừ khi Giám đốc Ban GĐBT duyệt.']])) +
      '<h3 class="rc-ref-title">Hệ số vùng (không cộng dồn)</h3>' + refList(R.REGIONS.map(item => [item.name + ' · +' + item.pct + '%',item.desc]));
    if (refTab === 'approval') return table(['Trường hợp','Cấp phê duyệt'],R.APPROVAL,false);
    return '<h3 class="rc-ref-title">Hồ sơ chứng từ bắt buộc</h3><ul class="rc-ref-list rc-ref-plain">' + R.EVIDENCE.map(item => '<li><span>' + esc(item) + '</span></li>').join('') + '</ul>' +
      '<h3 class="rc-ref-title">Kiểm soát</h3>' + refList(R.CONTROL.map(item => [item.title,item.text]));
  }
  function refPane() {
    return '<div class="rc-ref"><div class="rc-refnav" role="group" aria-label="Nhóm tra cứu">' + REF_TABS.map(([key,label]) => '<button type="button" class="sf-source-tab" data-rc-ref="' + key + '" aria-pressed="' + (refTab === key) + '">' + esc(label) + '</button>').join('') + '</div><div class="rc-ref-body" data-rc-refbody>' + refBody() + '</div></div>';
  }

  function read() {
    const value = key => host.querySelector('[data-rc="' + key + '"]');
    const surcharges = {};
    host.querySelectorAll('[data-rc-sur]').forEach(input => { surcharges[input.dataset.rcSur] = input.checked; });
    state = {
      service:state.service,towGroup:+value('towGroup').value,km:value('km').value,cranePos:+value('cranePos').value,craneClass:+value('craneClass').value,
      region:+value('region').value,surcharges,special:host.querySelector('[data-rc-flag=special]').checked,over:host.querySelector('[data-rc-flag=over]').checked
    };
  }

  function resultHtml(result) {
    const R = RescueCalc, lines = result.lines.map(line => '<li><span>' + esc(line.label) + '</span><b>' + (line.amount == null ? 'Báo giá' : vnd(line.amount)) + '</b></li>');
    if (result.region.pct) lines.push('<li><span>Hệ số ' + esc(result.region.name) + ' (+' + result.region.pct + '%)</span><b>+' + vnd(result.regionAmount) + '</b></li>');
    if (!result.quote || result.rescue) lines.push('<li class="rc-sub"><span>Giá cứu hộ sau hệ số vùng</span><b>' + vnd(result.rescue) + '</b></li>');
    for (const line of result.surcharges) lines.push('<li><span>' + esc(line.label) + '</span><b>+' + vnd(line.amount) + '</b></li>');
    if (result.capped) lines.push('<li class="rc-sub"><span>Phụ phí sau khi áp trần ' + R.SURCHARGE_CAP * 100 + '%</span><b>+' + vnd(result.surchargeTotal) + '</b></li>');
    const warnings = R.warnings(result), notes = warnings.length ? warnings : [];
    return '<div class="rc-total"><small>TỔNG TRẦN CHI PHÍ · CHƯA VAT</small><strong>' + esc(R.totalText(result)) + '</strong><em>' +
      (result.quote ? 'Hạng mục cẩu trên 100 m / nhiều xe cẩu không có đơn giá cố định, cần báo giá riêng.' : 'Thanh toán theo hóa đơn hợp lệ, không vượt số tiền được duyệt.') + '</em></div>' +
      '<ul class="rc-lines">' + lines.join('') + '</ul>' +
      '<div class="rc-approval"><span class="rc-approval-icon">' + svg('user') + '</span><div><small>CẤP PHÊ DUYỆT</small><strong>' + esc(result.approver) + '</strong><em>Căn cứ tổng chi phí một sự kiện cứu hộ, không tách nhỏ để giảm cấp duyệt.</em></div></div>' +
      (notes.length ? '<div class="rc-notice" data-tone="warn"><span class="rc-notice-icon">' + svg('alert') + '</span><ul>' + notes.map(text => '<li>' + esc(text) + '</li>').join('') + '</ul></div>' : '') +
      '<details class="rc-more"><summary>Lưu ý & hồ sơ bắt buộc</summary><ul>' + R.NOTES.map(text => '<li>' + esc(text) + '</li>').join('') + '</ul><h4>Hồ sơ bắt buộc</h4><ul>' + R.EVIDENCE.map(text => '<li>' + esc(text) + '</li>').join('') + '</ul></details>';
  }

  let lastResult = null;
  function update() {
    if (!host || tab !== 'calc') return;
    read();
    const R = RescueCalc;
    host.querySelector('[data-rc-block=tow]').hidden = state.service === 'crane';
    syncLocate();
    host.querySelector('[data-rc-block=crane]').hidden = state.service === 'tow';
    host.querySelectorAll('[data-rc-service]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.rcService === state.service)));
    const result = lastResult = R.calculate({...state,service:state.service});
    host.querySelector('.rc-result').innerHTML = resultHtml(result);
    const hint = host.querySelector('[data-rc-kmhint]');
    if (hint) {
      const group = R.TOW[state.towGroup] || R.TOW[0];
      hint.textContent = result.kmClamped ? 'Số km quá lớn, chỉ tính tối đa ' + R.MAX_KM.toLocaleString('vi-VN') + ' km.' :
        result.extraKm ? R.FREE_KM + ' km đầu trọn gói; thêm ' + result.extraKm + ' km × ' + vnd(group.km) + '.' : R.FREE_KM + ' km đầu tính trọn gói; từ km thứ ' + (R.FREE_KM + 1) + ' tính theo km, phần lẻ làm tròn lên.';
    }
    const regionHint = host.querySelector('[data-rc-regionhint]');
    if (regionHint) regionHint.textContent = result.region.desc;
    const km = host.querySelector('#km'); if (km) km.setAttribute('aria-invalid',String(result.kmClamped));
  }

  function syncLocate() {
    const box = host.querySelector('[data-rc-locate]');
    host.querySelectorAll('[data-rc-kmmode]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.rcKmmode === kmMode)));
    const active = kmMode === 'locate' && state.service !== 'crane' && tab === 'calc';
    box.hidden = kmMode !== 'locate';
    if (!locate) return;
    if (active) locate.show(); else locate.hide();
  }
  function setKmMode(mode) {
    kmMode = mode;
    if (mode === 'locate' && !locate) locate = RescueLocate.create(host.querySelector('[data-rc-locate]'),{kmInput:host.querySelector('#km'),geo:geoClient,garages:RescueGarages,onManage:() => { tab = 'garage'; paint(); }});
    update();
  }

  function setValue(id, value) {
    const element = host.querySelector('[data-rc="' + id + '"]'); element.value = value;
    element.dispatchEvent(new Event('change',{bubbles:true}));  // dropdown dùng chung cập nhật nhãn hiển thị
  }
  function reset() {
    state = DEFAULTS();
    ['towGroup','craneClass','cranePos','region'].forEach(id => setValue(id,'0'));
    host.querySelector('#km').value = '10';
    locate?.reset(); kmMode = 'manual';
    host.querySelectorAll('.rc-check input').forEach(input => { input.checked = false; });
    update();
  }
  async function copy() {
    if (!lastResult) return;
    try { const source = state.service !== 'crane' && kmMode === 'locate' ? locate?.describe() : ''; await navigator.clipboard.writeText(RescueCalc.summaryText(lastResult) + (source ? '\n' + source : '')); triggerToast('Đã sao chép kết quả tính chi phí cứu hộ.','success'); }
    catch (_) { triggerToast('Không sao chép được. Hãy cho phép trình duyệt truy cập bộ nhớ tạm.','warning'); }
  }

  // Xuất ảnh PNG của bảng tính: tải xuống (trên điện thoại dùng bảng chia sẻ nếu có).
  function exportModel() {
    const R = RescueCalc, result = lastResult, input = state, tow = input.service !== 'crane', crane = input.service !== 'tow';
    const lines = result.lines.map(line => ({label:line.label,value:line.amount == null ? 'Báo giá' : vnd(line.amount)}));
    if (result.region.pct) lines.push({label:'Hệ số ' + result.region.name + ' (+' + result.region.pct + '%)',value:'+' + vnd(result.regionAmount)});
    if (!result.quote || result.rescue) lines.push({label:'Giá cứu hộ sau hệ số vùng',value:vnd(result.rescue),sub:true});
    for (const line of result.surcharges) lines.push({label:line.label,value:'+' + vnd(line.amount)});
    if (result.capped) lines.push({label:'Phụ phí sau khi áp trần ' + R.SURCHARGE_CAP * 100 + '%',value:'+' + vnd(result.surchargeTotal),sub:true});
    const picked = R.SURCHARGES.filter(item => input.surcharges[item.key]).map(item => item.label);
    const kmSource = tow && kmMode === 'locate' ? locate?.describe() : '';
    const info = [['Hạng mục',(SERVICES.find(item => item[0] === input.service) || SERVICES[0])[1]]];
    if (tow) { info.push(['Nhóm xe (kéo)',(R.TOW[input.towGroup] || R.TOW[0]).label],['Quãng đường kéo',(input.km || '0') + ' km' + (kmSource ? '\n' + kmSource.replace(/^Quãng đường: [^ ]+ km /,'') : '')]); }
    if (crane) { const group = R.CLASSES[input.craneClass] || R.CLASSES[0]; info.push(['Nhóm xe (cẩu)','Nhóm ' + group.key + ' · ' + group.range],['Vị trí xe cần cẩu',(R.CRANE[input.cranePos] || R.CRANE[0]).label]); }
    info.push(['Vùng địa lý',result.region.name + ' · +' + result.region.pct + '%'],['Phụ phí điều kiện',picked.length ? picked.join('; ') : 'Không'],['Tình huống đặc biệt',[input.special ? 'Xe đặc biệt / sự cố nghiêm trọng' : '',input.over ? 'Chi phí đề xuất vượt barem' : ''].filter(Boolean).join('; ') || 'Không']);
    return {title:'Bảng tính chi phí cứu hộ',time:'Lập lúc ' + new Date().toLocaleString('vi-VN'),info,lines,total:R.totalText(result),
      totalNote:result.quote ? 'Hạng mục cẩu trên 100 m / nhiều xe cẩu cần báo giá riêng.' : '',approver:result.approver,warnings:R.warnings(result),
      footer:'Trần nội bộ, chưa VAT. Thanh toán theo hóa đơn hợp lệ, không vượt số tiền được duyệt. Kết quả chỉ mang tính tham khảo theo barem nội bộ.'};
  }
  async function exportImage(button) {
    if (!lastResult) return;
    button.disabled = true;
    try {
      const blob = await RescueExport.render(exportModel()), stamp = new Date(), pad = number => String(number).padStart(2,'0');
      const name = 'chi-phi-cuu-ho-' + stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) + '-' + pad(stamp.getHours()) + pad(stamp.getMinutes()) + '.png';
      const file = new File([blob],name,{type:'image/png'});
      if (matchMedia('(pointer:coarse)').matches && navigator.canShare?.({files:[file]})) {
        try { await navigator.share({files:[file],title:'Chi phí cứu hộ'}); return; } catch (error) { if (error?.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),4000);
      triggerToast('Đã xuất ảnh bảng tính chi phí.','success');
    } catch (error) { triggerToast('Không xuất được ảnh: ' + (error?.message || 'lỗi không xác định'),'error'); }
    finally { button.disabled = false; }
  }

  function paint() {
    const calc = tab === 'calc';
    host.querySelector('[data-rc-pane=calc]').hidden = !calc;
    host.querySelector('[data-rc-pane=ref]').hidden = tab !== 'ref';
    host.querySelector('[data-rc-pane=garage]').hidden = tab !== 'garage';
    host.querySelectorAll('[data-rc-tab]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.rcTab === tab)));
    host.querySelectorAll('[data-rc-actions] button').forEach(button => { button.hidden = !calc; });
    if (tab !== 'garage') RescueGarages.unmountManager();
    if (calc) update(); else { locate?.hide(); if (tab === 'ref') host.querySelector('[data-rc-pane=ref]').innerHTML = refPane(); else RescueGarages.mountManager(host.querySelector('[data-rc-pane=garage]'),geoClient); }
  }

  function mount(container) {
    leave(); state = DEFAULTS(); tab = 'calc'; refTab = 'tow'; kmMode = 'manual';
    geoClient = RescueGeo.createClient({fetch:(...args) => fetch(...args)});
    host = document.createElement('section');
    host.className = 'sf-workspace rc-workspace';
    host.setAttribute('aria-label','Chi phí cứu hộ');
    host.innerHTML = '<header class="sf-page-head"><div class="sf-page-title"><span class="sf-page-emblem" aria-hidden="true">' + svg('truck') + '</span><div><div class="sf-eyebrow">NGHIỆP VỤ · CỨU HỘ PHƯƠNG TIỆN</div><h1>Chi phí cứu hộ</h1><p>Tính nhanh chi phí kéo xe, cẩu xe theo barem nội bộ và xác định cấp phê duyệt.</p></div></div>' +
      '<div class="sf-toolbar" data-rc-actions><button type="button" class="sf-button" data-rc-reset>' + svg('reset') + 'Đặt lại</button><button type="button" class="sf-button" data-rc-export>' + svg('image') + 'Xuất ảnh</button><button type="button" class="sf-button sf-primary" data-rc-copy>' + svg('copy') + 'Sao chép kết quả</button></div></header>' +
      '<section class="sf-library rc-card"><div class="sf-library-bar"><div class="sf-sources" role="group" aria-label="Chế độ"><button type="button" class="sf-source-tab" data-rc-tab="calc" aria-pressed="true">' + svg('calc') + 'Tính chi phí</button><button type="button" class="sf-source-tab" data-rc-tab="ref" aria-pressed="false">' + svg('book') + 'Đơn giá & quy định</button><button type="button" class="sf-source-tab" data-rc-tab="garage" aria-pressed="false">' + svg('pin') + 'Gara</button></div>' +
      '<span class="sf-count">' + svg('receipt') + 'Trần nội bộ · chưa VAT</span></div>' +
      '<div data-rc-pane="calc">' + calcPane() + '</div><div data-rc-pane="ref" hidden></div><div data-rc-pane="garage" hidden></div></section>';
    host.addEventListener('click',event => {
      const target = event.target.closest('[data-rc-tab],[data-rc-service],[data-rc-ref],[data-rc-reset],[data-rc-copy],[data-rc-export],[data-rc-kmmode]');
      if (!target) return;
      if (target.dataset.rcKmmode) setKmMode(target.dataset.rcKmmode);
      else if (target.dataset.rcTab) { tab = target.dataset.rcTab; paint(); }
      else if (target.dataset.rcService) { state.service = target.dataset.rcService; update(); }
      else if (target.dataset.rcRef) { refTab = target.dataset.rcRef; paint(); }
      else if (target.hasAttribute('data-rc-reset')) reset();
      else if (target.hasAttribute('data-rc-copy')) copy();
      else if (target.hasAttribute('data-rc-export')) exportImage(target);
    });
    host.addEventListener('input',event => { if (event.target.closest('[data-rc],[data-rc-sur],[data-rc-flag]')) update(); });
    host.addEventListener('change',event => { if (event.target.closest('[data-rc],[data-rc-sur],[data-rc-flag]')) update(); });
    container.replaceChildren(host);
    SharedFormsControls.enhance(host);
    update();
  }

  // Rời trang: huỷ bản đồ, ngừng nghe danh sách gara.
  function leave() {
    locate?.destroy(); locate = null;
    if (host) { RescueGarages.unmountManager(); RescueGarages.stop(); }
    host = null;
  }

  return {mount,leave};
})();
