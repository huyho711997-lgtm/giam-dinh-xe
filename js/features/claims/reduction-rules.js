// Đối chiếu Quy tắc bảo hiểm cho phần "Thông báo giảm trừ / chế tài".
// - Phần tính toán (normalize/evaluate/texts) là hàm thuần, không đụng DOM → có unit test.
// - Phần giao diện được ClaimReductionNotice gắn vào section của nó qua mount().
const ClaimReductionRules = (() => {
  const RULES = typeof INSURANCE_REDUCTION_RULES === 'undefined' ? null : INSURANCE_REDUCTION_RULES;
  const itemById = id => RULES?.items.find(item => item.id === id) || null;
  const toNumber = value => {
    const text = String(value ?? '').trim().replace(/\s/g,'');
    if (!text) return null;
    const number = Number(text.replace(',', '.'));
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  const digits = value => String(value ?? '').replace(/\D/g,'').slice(0,15);
  const money = value => (Number(value) || 0).toLocaleString('vi-VN') + ' đ';
  const round1 = value => Math.round(value * 10) / 10;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // ---- Trạng thái lưu cùng hồ sơ ------------------------------------------------------------
  function normalize(raw) {
    const scope = raw?.scope === 'hh' ? 'hh' : 'vcx';
    const seen = new Set(), items = [];
    for (const entry of Array.isArray(raw?.items) ? raw.items.slice(0,20) : []) {
      const item = itemById(entry?.id);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      const rate = toNumber(entry.rate), actual = toNumber(entry.actual), limit = toNumber(entry.limit);
      items.push({id:item.id, rate:rate === null ? null : clamp(rate,item.min,item.max), actual:actual === null ? '' : String(actual), limit:limit === null ? '' : String(limit)});
    }
    // Trường hợp khác ngoài danh mục Điều 14/24 (mô tả + mức % tùy chọn).
    const customRate = toNumber(raw?.custom?.rate);
    const custom = {on:raw?.custom?.on === true, title:String(raw?.custom?.title || '').slice(0,600), rate:customRate === null ? null : clamp(customRate,0,100)};
    return {scope, items, base:digits(raw?.base), custom};
  }
  const CUSTOM = {id:'custom', title:'Trường hợp khác ngoài danh mục quy tắc', tier:'custom', point:'', clause:'', min:0, max:100};

  // Tỷ lệ vượt (%) khi đã nhập đủ số đo thực tế và mức cho phép.
  function overPercent(entry) {
    const actual = toNumber(entry.actual), limit = toNumber(entry.limit);
    if (actual === null || !limit) return null;
    return round1((actual - limit) / limit * 100);
  }

  // ---- Tính toán theo quy tắc --------------------------------------------------------------
  // Trả về từng vi phạm (hợp lệ / dưới ngưỡng / thuộc loại trừ) và tỷ lệ áp dụng theo khoản 2.1 (cao nhất).
  function evaluate(raw) {
    const state = normalize(raw), rows = [];
    for (const entry of state.items) {
      const item = itemById(entry.id), over = item.measure ? overPercent(entry) : null;
      const row = {item, entry, over, status:'ok', rate:null, message:''};
      if (item.measure && over !== null) {
        if (item.exclusion && over > item.exclusion.above) { row.status = 'excluded'; row.message = item.exclusion.text; }
        else if (over <= item.min) { row.status = 'below'; row.message = 'Vượt ' + over + '%: chưa tới ngưỡng "trên ' + item.min + '%" nên không áp dụng giảm trừ theo điểm này.'; }
      }
      if (row.status === 'ok') {
        if (item.min === item.max) row.rate = item.min;
        else if (item.proportional && over !== null) row.rate = clamp(over, item.min, item.max);
        else row.rate = entry.rate === null ? item.min : entry.rate;
      }
      rows.push(row);
    }
    if (state.custom.on && state.custom.title.trim()) {
      rows.push({item:{...CUSTOM, title:state.custom.title.trim()}, entry:{}, over:null, custom:true,
        status:state.custom.rate === null ? 'norate' : 'ok', rate:state.custom.rate, message:state.custom.rate === null ? 'Chưa nhập mức áp dụng – chỉ ghi nhận trong thông báo.' : ''});
    }
    // Luôn theo thứ tự điều khoản trong quy tắc (không theo thứ tự người dùng bấm chọn).
    const order = row => row.custom ? RULES.items.length : RULES.items.indexOf(row.item);
    rows.sort((a,b) => order(a) - order(b));
    const eligible = rows.filter(row => row.status === 'ok');
    const applied = eligible.reduce((best,row) => !best || row.rate > best.rate ? row : best, null);
    const base = Number(state.base) || 0, excluded = rows.filter(row => row.status === 'excluded');
    // Điểm loại trừ (Điều 10) đứng trên giảm trừ: đã thuộc loại trừ thì từ chối bồi thường, không tính giảm trừ.
    const refused = excluded.length > 0;
    const deduction = !refused && applied && base ? Math.round(base * applied.rate / 100) : 0;
    return {state, rows, applied:refused ? null : applied, candidate:applied, refused, excluded, base, deduction, remain:!refused && applied && base ? base - deduction : 0};
  }

  function citation(item, scope) {
    const article = RULES.scopes[scope].article;
    return (item.point ? 'điểm ' + item.point + ' ' : '') + 'khoản ' + item.clause + ' mục 1 Điều ' + article;
  }
  // "điểm a khoản 1.1, điểm b khoản 1.2 mục 1 Điều 14" – gộp theo điều thay vì lặp "Điều 14" ở từng ý.
  function citeGroup(items, scope) {
    const parts = [...new Set(items.map(item => (item.point ? 'điểm ' + item.point + ' ' : '') + 'khoản ' + item.clause))];
    return parts.join(', ') + ' mục 1 Điều ' + RULES.scopes[scope].article;
  }
  const rateLabel = rate => rate >= 100 ? 'toàn bộ (100%)' : String(rate).replace('.',',') + '%';

  // Nội dung điền sẵn vào Lý do / Căn cứ / Mức giảm trừ (người dùng vẫn sửa được).
  function texts(raw) {
    const result = evaluate(raw), scope = result.state.scope, article = RULES.scopes[scope].article;
    const reason = result.rows.map(row => {
      const measure = row.item.measure && row.over !== null
        ? ' (' + (row.item.measure === 'speed' ? 'tốc độ ' + row.entry.actual + '/' + row.entry.limit + ' km/h' : 'thực tế ' + row.entry.actual + '/' + row.entry.limit + ' theo đăng kiểm') + ', vượt ' + String(row.over).replace('.',',') + '%)'
        : '';
      const outcome = row.status === 'excluded' ? ' → thuộc điểm loại trừ mục ' + row.item.exclusion.item + ' Điều ' + row.item.exclusion.article
        : row.status === 'below' ? ' → dưới ngưỡng giảm trừ' : ' → ' + rateLabel(row.rate);
      if (row.custom) return '- ' + row.item.title + ' (ngoài danh mục quy tắc)' + (row.rate === null ? '' : ' → ' + rateLabel(row.rate)) + '.';
      return '- ' + row.item.title + measure + outcome + '.';
    }).join('\n');
    const okRows = result.rows.filter(row => row.status === 'ok' && !row.custom), source = ' ' + RULES.source.title + ' (ban hành kèm ' + RULES.source.decision + ').';
    let basis = '';
    if (result.refused) {
      const items = [...new Set(result.excluded.map(row => row.item.exclusion.item))].sort((a,b) => a - b);
      basis = 'Căn cứ mục ' + items.join(', mục ') + ' Điều 10 (các điểm loại trừ chung)' + source;
    } else if (okRows.length) {
      const multiple = result.rows.filter(row => row.status === 'ok').length > 1;
      basis = 'Căn cứ ' + citeGroup(okRows.map(row => row.item), scope) + (multiple ? ' và khoản 2.1 mục 2 Điều ' + article + ' (áp dụng tỷ lệ cao nhất)' : '') + source;
    }
    if (result.rows.some(row => row.custom)) basis += (basis ? ' ' : '') + 'Trường hợp ngoài danh mục: theo hợp đồng bảo hiểm/ GCNBH và tài liệu ghi nhận trong hồ sơ.';
    let impact = '';
    if (result.refused) impact = 'Thuộc điểm loại trừ – đề xuất từ chối bồi thường (không áp dụng giảm trừ)';
    else if (result.applied) {
      impact = 'Giảm trừ ' + rateLabel(result.applied.rate) + ' số tiền bồi thường';
      if (result.base) impact += ': ' + money(result.deduction) + ' trên ' + money(result.base) + ', còn ' + money(result.remain);
    }
    return {reason, basis, impact, result};
  }

  // ---- Giao diện -----------------------------------------------------------------------------
  let state = normalize({}), host = null, live = null, slots = {}, onChange = null;
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text) element.textContent = text; if (className) element.className = className; return element; };
  const svg = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  const ICON = {
    scale:svg('<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0Zm14 0-3 6a3 3 0 0 0 6 0Z"/>'),
    alert:svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/>'),
    check:svg('<path d="m5 12 5 5 9-10"/>')
  };
  const sources = [['PASC duyệt','modalPendingPascSoTienDuyet'],['Tổng tiền BT','modalPendingTtbtTongSoTienBoiThuong'],['Ước thiệt hại','modalPendingUocThietHai'],['Dự phòng','modalPendingDuPhongBoiThuong']];

  function entryFor(id) { return state.items.find(entry => entry.id === id); }
  function toggle(id, on) {
    if (on && !entryFor(id)) state.items.push({id, rate:null, actual:'', limit:''});
    if (!on) state.items = state.items.filter(entry => entry.id !== id);
    render();
  }

  function renderItem(item) {
    const entry = entryFor(item.id), row = node('article', null, 'crr-item' + (entry ? ' is-on' : ''));
    const head = node('label', null, 'crr-item-head');
    const box = node('input'); box.type = 'checkbox'; box.checked = !!entry; box.dataset.crrFocus = 'pick-' + item.id;
    box.onchange = () => toggle(item.id, box.checked);
    const copy = node('span', null, 'crr-item-copy');
    const ref = node('small', (item.point ? 'Điểm ' + item.point + ' · ' : '') + 'Khoản ' + item.clause);
    copy.append(ref, node('strong', item.title));
    const badge = node('span', item.min === item.max ? item.min + '%' : item.max >= 100 ? item.min + '% – toàn bộ' : item.proportional ? 'theo % quá tải' : item.min + '–' + item.max + '%', 'crr-rate-badge');
    head.append(box, node('span', null, 'crr-check-box'), copy, badge);
    row.append(head);
    const detail = node('div', null, 'crr-item-detail');
    detail.append(node('p', (item.scopeText?.[state.scope]) || item.text, 'crr-text'));
    if (item.exception) detail.append(node('p', 'Ngoại lệ: ' + item.exception, 'crr-exception'));
    if (entry) {
      const controls = node('div', null, 'crr-controls');
      if (item.measure) {
        const unit = item.measure === 'speed' ? 'km/h' : 'tấn / người';
        for (const [key,label] of [['actual', item.measure === 'speed' ? 'Tốc độ thực tế' : 'Thực tế chở'], ['limit', item.measure === 'speed' ? 'Tốc độ cho phép' : 'Theo đăng kiểm']]) {
          const field = node('label', null, 'crr-field'), input = node('input');
          input.type = 'text'; input.inputMode = 'decimal'; input.value = entry[key]; input.placeholder = unit; input.dataset.crrFocus = key + '-' + item.id;
          input.oninput = () => { entry[key] = input.value.replace(/[^\d.,]/g,'').slice(0,8); if (input.value !== entry[key]) input.value = entry[key]; update(); };
          field.append(node('span', label), input); controls.append(field);
        }
      }
      if (item.min !== item.max && !item.proportional) {
        const field = node('label', null, 'crr-field is-rate'), input = node('input');
        input.type = 'number'; input.min = item.min; input.max = item.max; input.step = 5; input.value = entry.rate ?? item.min; input.dataset.crrFocus = 'rate-' + item.id;
        input.oninput = () => { const value = toNumber(input.value); entry.rate = value === null ? null : value; update(); };
        input.onblur = () => { if (entry.rate !== null) { entry.rate = clamp(entry.rate, item.min, item.max); input.value = entry.rate; update(); } };
        const chips = node('span', null, 'crr-chips');
        for (const value of [...new Set([item.min, Math.round((item.min + item.max) / 2 / 5) * 5, item.max])]) {
          const chip = node('button', value >= 100 ? 'Toàn bộ' : value + '%', 'crr-chip'); chip.type = 'button';
          chip.onclick = () => { entry.rate = value; input.value = value; update(); };
          chips.append(chip);
        }
        field.append(node('span', 'Mức giảm trừ (%)'), input); controls.append(field, chips);
      }
      const verdict = node('p', null, 'crr-verdict'); verdict.dataset.crrVerdict = item.id;
      detail.append(controls, verdict);
    }
    row.append(detail);
    return row;
  }

  function renderCustom() {
    const custom = state.custom, row = node('article', null, 'crr-item is-custom' + (custom.on ? ' is-on' : ''));
    const head = node('label', null, 'crr-item-head');
    const box = node('input'); box.type = 'checkbox'; box.checked = custom.on; box.dataset.crrFocus = 'pick-custom';
    box.onchange = () => { custom.on = box.checked; render(); if (custom.on) host.querySelector('[data-crr-focus="custom-title"]')?.focus(); };
    const copy = node('span', null, 'crr-item-copy'); copy.append(node('small', 'Ngoài Điều ' + RULES.scopes[state.scope].article), node('strong', CUSTOM.title));
    head.append(box, node('span', null, 'crr-check-box'), copy, node('span', 'tự nhập', 'crr-rate-badge'));
    row.append(head);
    const detail = node('div', null, 'crr-item-detail');
    if (custom.on) {
      const titleField = node('label', null, 'crr-field is-wide'), title = node('textarea');
      title.rows = 2; title.maxLength = 600; title.value = custom.title; title.placeholder = 'Mô tả vi phạm / chế tài theo HĐ, GCNBH hoặc thỏa thuận riêng'; title.dataset.crrFocus = 'custom-title';
      title.oninput = () => { custom.title = title.value; update(); };
      titleField.append(node('span', 'Nội dung vi phạm / chế tài'), title);
      const rateField = node('label', null, 'crr-field is-rate'), rate = node('input');
      rate.type = 'number'; rate.min = 0; rate.max = 100; rate.step = 5; rate.value = custom.rate ?? ''; rate.placeholder = '%'; rate.dataset.crrFocus = 'custom-rate';
      rate.oninput = () => { const value = toNumber(rate.value); custom.rate = value === null ? null : clamp(value, 0, 100); update(); };
      rateField.append(node('span', 'Mức áp dụng (%)'), rate);
      const controls = node('div', null, 'crr-controls'); controls.append(titleField, rateField);
      const verdict = node('p', null, 'crr-verdict'); verdict.dataset.crrVerdict = 'custom';
      detail.append(controls, verdict);
    }
    row.append(detail);
    return row;
  }

  function fillPreview(target, result) {
    const text = texts(state);
    target.replaceChildren();
    if (!result.rows.length) { target.append(node('p', 'Chọn vi phạm để xem nội dung sẽ đưa vào thông báo.', 'crr-preview-empty')); return; }
    for (const [label, value] of [['Kết luận', text.impact || 'Chưa xác định mức áp dụng'], ['Vi phạm ghi nhận', text.reason], ['Căn cứ', text.basis || '—']]) {
      const item = node('div'); item.append(node('dt', label), node('dd', value)); target.append(item);
    }
  }

  function render() {
    if (!host || !RULES) return;
    const focused = document.activeElement?.dataset?.crrFocus, caret = document.activeElement?.selectionStart;
    host.replaceChildren();
    const scope = RULES.scopes[state.scope];

    // Cột trái: 01 vi phạm theo quy tắc (+ trường hợp khác), 02 ghi nhận thực tế (slot của thông báo)
    const main = node('div', null, 'crr-main');
    const header = node('header', null, 'crr-header'), title = node('div', null, 'crr-title');
    const step = node('span', '01', 'crr-step');
    const heading = node('div'); heading.append(node('h5', 'Vi phạm ghi nhận theo Quy tắc bảo hiểm'), node('p', scope.heading + ' · ' + RULES.source.short));
    title.append(step, heading);
    const segments = node('div', null, 'crr-segments'); segments.setAttribute('role','group'); segments.setAttribute('aria-label','Phạm vi áp dụng');
    for (const [key, value] of Object.entries(RULES.scopes)) {
      const option = node('button', value.label + ' · Điều ' + value.article, 'crr-segment'); option.type = 'button'; option.dataset.crrFocus = 'scope-' + key;
      option.setAttribute('aria-pressed', String(state.scope === key));
      option.onclick = () => { state.scope = key; render(); };
      segments.append(option);
    }
    header.append(title, segments);
    const list = node('div', null, 'crr-list');
    for (const tier of RULES.tiers) {
      const group = node('section', null, 'crr-tier'); group.append(node('h6', 'Khoản ' + tier.clause + ' · ' + tier.label));
      for (const item of RULES.items.filter(item => item.tier === tier.id)) group.append(renderItem(item));
      list.append(group);
    }
    const other = node('section', null, 'crr-tier'); other.append(node('h6', 'Khác · ngoài danh mục quy tắc'), renderCustom()); list.append(other);
    main.append(header, list);
    if (slots.left) main.append(slots.left);

    // Cột phải: kết quả + số tiền + trạng thái/gửi (slot) + xem trước nội dung
    const summary = node('aside', null, 'crr-summary');
    const big = node('div', null, 'crr-applied');
    const why = node('p', null, 'crr-applied-note');
    const warn = node('div', null, 'crr-warning');
    const calc = node('div', null, 'crr-calc');
    const baseField = node('label', null, 'crr-field is-money'), baseInput = node('input');
    baseInput.type = 'text'; baseInput.inputMode = 'numeric'; baseInput.placeholder = 'VNĐ'; baseInput.dataset.crrFocus = 'base';
    baseInput.value = state.base ? Number(state.base).toLocaleString('vi-VN') : '';
    baseInput.oninput = () => { state.base = digits(baseInput.value); const text = state.base ? Number(state.base).toLocaleString('vi-VN') : ''; if (baseInput.value !== text) baseInput.value = text; update(); };
    baseField.append(node('span', 'Số tiền bồi thường trước giảm trừ'), baseInput);
    const quick = node('div', null, 'crr-chips');
    for (const [label, id] of sources) {
      const value = digits(document.getElementById(id)?.value);
      if (!Number(value)) continue;
      const chip = node('button', label + ': ' + Number(value).toLocaleString('vi-VN'), 'crr-chip'); chip.type = 'button';
      chip.onclick = () => { state.base = value; baseInput.value = Number(value).toLocaleString('vi-VN'); update(); };
      quick.append(chip);
    }
    const figures = node('dl', null, 'crr-figures');
    calc.append(baseField); if (quick.childElementCount) calc.append(quick); calc.append(figures);
    const previewBox = node('details', null, 'crr-preview'); previewBox.append(node('summary', 'Nội dung sẽ đưa vào thông báo'));
    const preview = node('dl'); previewBox.append(preview);
    const principle = node('p', null, 'crr-principle');
    principle.textContent = RULES.principles.filter(item => !item.scopes || item.scopes.includes(state.scope)).map(item => 'Khoản ' + item.clause + ' mục 2: ' + item.text).join(' ') + ' ' + RULES.deductibleNote;
    summary.append(node('span', 'KẾT QUẢ ĐỐI CHIẾU', 'crr-eyebrow'), big, why, warn, calc);
    if (slots.summary) summary.append(slots.summary);
    previewBox.append(principle);  // nguyên tắc 2.1/2.2 + ghi chú khấu trừ nằm trong phần mở rộng để thẻ gọn
    summary.append(previewBox);

    const body = node('div', null, 'crr-body'); body.append(main, summary);
    host.append(body);
    live = {big, why, warn, figures, preview};
    update();
    if (focused) { const target = host.querySelector('[data-crr-focus="' + focused + '"]'); if (target) { target.focus({preventScroll:true}); if (typeof caret === 'number' && ['text','textarea'].includes(target.type)) try { target.setSelectionRange(caret, caret); } catch (_) {} } }
  }

  // Cập nhật các con số tại chỗ (không dựng lại ô nhập → không mất con trỏ khi gõ).
  function update() {
    if (!live) return;
    const result = evaluate(state);
    for (const row of result.rows) {
      const verdict = host.querySelector('[data-crr-verdict="' + (row.custom ? 'custom' : row.item.id) + '"]');
      if (!verdict) continue;
      verdict.className = 'crr-verdict is-' + row.status + (result.applied === row ? ' is-applied' : '') + (result.refused && row.status === 'ok' ? ' is-superseded' : '');
      verdict.textContent = row.status === 'ok'
        ? (row.over !== null ? 'Vượt ' + String(row.over).replace('.',',') + '% · ' : row.item.measure ? 'Nhập số đo để kiểm tra ngưỡng · ' : '') + 'Giảm trừ ' + rateLabel(row.rate) + (result.applied === row ? ' · đang áp dụng' : result.refused ? ' · không áp dụng do hồ sơ thuộc loại trừ' : '')
        : row.message;
    }
    const customVerdict = host.querySelector('[data-crr-verdict="custom"]');
    if (customVerdict && !result.rows.some(row => row.custom)) { customVerdict.className = 'crr-verdict is-below'; customVerdict.textContent = 'Nhập nội dung vi phạm để đưa vào thông báo.'; }
    onChange?.(result);
    live.big.textContent = result.refused ? 'Từ chối' : result.applied ? rateLabel(result.applied.rate) : '—';
    live.big.classList.toggle('is-empty', !result.applied && !result.refused);
    live.big.classList.toggle('is-refused', result.refused);
    live.preview && fillPreview(live.preview, result);
    live.why.textContent = result.refused
      ? 'Có vi phạm thuộc điểm loại trừ chung (Điều 10): đề xuất từ chối bồi thường, không tính giảm trừ' + (result.candidate ? ' (nếu không thuộc loại trừ, mức giảm trừ sẽ là ' + rateLabel(result.candidate.rate) + ').' : '.')
      : result.applied
      ? 'Theo ' + citation(result.applied.item, result.state.scope) + (result.rows.filter(row => row.status === 'ok').length > 1 ? ' – tỷ lệ cao nhất trong các vi phạm (khoản 2.1).' : '.')
      : result.rows.length ? 'Chưa có mức áp dụng cụ thể.' : 'Chọn vi phạm ở danh sách bên cạnh.';
    live.warn.hidden = !result.excluded.length;
    live.warn.innerHTML = result.excluded.length ? ICON.alert : '';
    if (result.excluded.length) live.warn.append(node('span', result.excluded.map(row => row.message).join(' ')));
    live.figures.replaceChildren();
    if (result.applied && result.base) {
      for (const [label, value, className] of [['Giảm trừ', '− ' + money(result.deduction), 'is-cut'], ['Còn lại', money(result.remain), 'is-remain']]) {
        const item = node('div', null, className); item.append(node('dt', label), node('dd', value)); live.figures.append(item);
      }
    }
  }

  // slots.left: nội dung thêm dưới danh sách vi phạm; slots.summary: thêm vào thẻ kết quả. onChange(result) khi số liệu đổi.
  function mount(container, options = {}) { host = container; slots = {left:options.left || null, summary:options.summary || null}; onChange = options.onChange || null; render(); }
  function load(raw) { state = normalize(raw); render(); }
  function getState() { return normalize(state); }
  const current = () => texts(state);
  return {mount, load, getState, evaluate, texts, current, citation, normalize};
})();
