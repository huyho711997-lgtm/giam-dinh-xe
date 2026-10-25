const ClaimReductionNotice = (() => {
  // Một luồng nhập duy nhất: chọn vi phạm theo quy tắc (ClaimReductionRules) → lý do, mức áp dụng, căn cứ
  // được TỰ SINH khi soạn thư. Người dùng chỉ nhập thêm điều máy không biết: ghi nhận thực tế & tài liệu.
  const stages = ['Đang xem xét','Dự kiến áp dụng','Đã phê duyệt','Đã áp dụng'];
  const defaultStage = stages[1]; // 'Dự kiến áp dụng' – trạng thái mặc định khi hồ sơ chưa có thông báo giảm trừ
  const MAIL_KEYS = ['to','cc','subject','body','signature','deadline'];
  let draft = {}, dialog = null;
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const button = (text, action, primary = false) => {
    const element = node('button',text,'sf-button' + (primary ? ' sf-primary' : ''));
    element.type = 'button'; element.onclick = action; return element;
  };
  const value = id => { const text = String(document.getElementById('modalPending' + id)?.value || '').trim(); return text === '—' ? '' : text; };
  const owner = () => firebase.auth().currentUser?.uid;
  const rules = () => typeof ClaimReductionRules === 'undefined' ? null : ClaimReductionRules;
  const clip = (text, max) => typeof text === 'string' ? text.slice(0,max) : '';
  const envelope = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>';
  function refreshStage() {
    const badge = document.getElementById('claimReductionStage');
    const stage = document.getElementById('modalPendingReduction_stage')?.value || defaultStage;
    if (badge) { badge.textContent = stage; badge.dataset.stage = String(stages.indexOf(stage)); }
  }
  function close() { if (dialog?.open) dialog.close(); }

  // Hồ sơ lưu theo mẫu cũ (tự gõ Lý do / Mức / Căn cứ) được chuyển sang mẫu mới, không mất nội dung:
  // Lý do + mức % → "Trường hợp khác"; mức không phải % → ghi nhận thực tế; Căn cứ → tài liệu căn cứ.
  function migrate(data) {
    const rule = data?.rule && typeof data.rule === 'object' ? {...data.rule} : {};
    let notes = clip(data?.notes,3000), evidence = clip(data?.evidence,1500);
    const hasRule = Array.isArray(rule.items) && rule.items.length || rule.custom?.on;
    if (!hasRule && data?.notes === undefined && (data?.reason || data?.impact || data?.basis)) {
      const percent = String(data.impact || '').match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (data.reason) rule.custom = {on:true, title:clip(data.reason,600), rate:percent ? Number(percent[1].replace(',','.')) : null};
      if (data.impact && !percent) notes = 'Mức đã ghi nhận trước đây: ' + clip(data.impact,300);
      evidence = clip(data.basis,1500);
    }
    return {rule, notes, evidence};
  }
  function load(data) {
    if (dialog) dialog.dataset.discard = 'true';
    close();
    const migrated = migrate(data);
    draft = {stage:stages.includes(data?.stage) ? data.stage : defaultStage, notes:migrated.notes, evidence:migrated.evidence};
    for (const key of MAIL_KEYS) draft[key] = clip(data?.[key], key === 'signature' ? 16000 : key === 'deadline' ? 40 : 6000);
    rules()?.load(migrated.rule);
    for (const key of ['stage','notes','evidence']) { const input = document.getElementById('modalPendingReduction_' + key); if (input) input.value = draft[key] || ''; }
    const section = document.getElementById('claimReductionSection');
    if (section) SharedFormsControls.enhance(section);
    refreshStage();
  }
  function getState() {
    for (const key of ['stage','notes','evidence']) {
      const input = document.getElementById('modalPendingReduction_' + key);
      if (input) draft[key] = input.value.trim();
    }
    const rule = rules()?.getState(), text = rules()?.current();
    // reason / impact / basis là bản tự sinh, lưu kèm để đọc nhanh ở nơi khác; nguồn gốc là "rule".
    return {...draft, ...(rule ? {rule} : {}), reason:text?.reason || '', impact:text?.impact || '', basis:text?.basis || ''};
  }
  function field(key, label, tag, options = {}) {
    const group = node('div',null,'form-group crr-note-field'), caption = node('label',label), input = node(tag);
    input.id = 'modalPendingReduction_' + key; caption.htmlFor = input.id;
    if (tag !== 'select') { input.className = 'input-premium'; input.maxLength = options.max || 1500; input.placeholder = options.placeholder || ''; if (tag === 'textarea') input.rows = options.rows || 3; }
    input.value = draft[key] || '';
    group.append(caption,input);
    if (options.hint) group.append(node('p',options.hint,'crr-field-hint'));
    return {group,input};
  }
  function mount() {
    const pane = document.getElementById('tabPane_Financial');
    if (!pane || document.getElementById('claimReductionSection')) return;
    const section = node('section',null,'claim-editor-form-section claim-reduction-section'); section.id = 'claimReductionSection';
    const header = node('header'), title = node('div',null,'claim-reduction-heading');
    const emblem = node('span',null,'claim-reduction-emblem'); emblem.innerHTML = envelope;
    title.append(node('small','PHỐI HỢP ĐƠN VỊ CẤP ĐƠN'),node('h4','Thông báo giảm trừ / chế tài'),node('p','Chọn vi phạm theo quy tắc – lý do, mức áp dụng và căn cứ được tự soạn vào thông báo cho đơn vị cấp đơn.'));
    const badge = node('span',null,'claim-reduction-stage'); badge.id = 'claimReductionStage';
    header.append(emblem,title,badge);
    const context = node('div',null,'claim-reduction-context');
    for (const [label,id,empty] of [['Phương tiện','modalPendingBienSo','Chưa có biển số'],['Đơn vị nhận thông tin','modalPendingDonViCapDon','Chưa có đơn vị cấp đơn']]) {
      const item = node('div'), text = node('strong'); text.dataset.claimSummary = id; text.dataset.empty = empty;
      text.textContent = document.getElementById(id)?.value || empty; item.append(node('span',label),text); context.append(item);
    }
    // 02 – Ghi nhận thực tế (cột trái, dưới danh sách vi phạm)
    const facts = node('section',null,'crr-facts');
    const factsHead = node('header',null,'crr-header'), factsTitle = node('div',null,'crr-title'), factsHeading = node('div');
    factsHeading.append(node('h5','Ghi nhận thực tế'),node('p','Thông tin xác minh được trong hồ sơ – đưa nguyên văn vào thông báo.'));
    factsTitle.append(node('span','02','crr-step'),factsHeading); factsHead.append(factsTitle);
    const notes = field('notes','Diễn biến / chứng cứ xác minh','textarea',{max:3000,rows:3,placeholder:'Ví dụ: Lái xe di chuyển xe về gara trước khi GĐV có mặt; camera hành trình ghi nhận tốc độ 66 km/h…'});
    const evidence = field('evidence','Tài liệu căn cứ trong hồ sơ','input',{max:1500,placeholder:'Biên bản hiện trường, ảnh, trích xuất camera hành trình, giấy đăng kiểm…'});
    facts.append(factsHead,notes.group,evidence.group);
    // Trạng thái + gửi (gắn vào thẻ kết quả bên phải)
    const actions = node('div',null,'crr-actions');
    const stage = field('stage','Trạng thái xử lý','select');
    stages.forEach(item => { const option = node('option',item); option.value = item; stage.input.append(option); });
    stage.input.value = draft.stage || defaultStage;
    Object.assign(stage.input.dataset,{sfSelect:'',sfLabel:'Trạng thái xử lý',sfIcon:'shield',sfDescription:'Trạng thái này được đưa vào nội dung thông báo.'});
    stage.input.addEventListener('change',refreshStage);
    const create = button('',compose,true); create.classList.add('crr-compose'); create.innerHTML = envelope; create.append(node('span','Soạn thông báo cấp đơn'));
    actions.append(stage.group,create,node('p','Nội dung được lưu khi bấm Lưu cập nhật hồ sơ.','crr-field-hint'));
    const ruleHost = node('div',null,'claim-reduction-rules');
    section.append(header,context,ruleHost); pane.append(section);
    if (rules()) rules().mount(ruleHost,{left:facts,summary:actions});
    else ruleHost.append(facts,actions);
    SharedFormsControls.enhance(section); refreshStage();
  }
  function show() {
    switchEditClaimTab('Financial'); ClaimEditorWorkspace.showMain();
    document.getElementById('claimReductionSection')?.scrollIntoView({block:'start'});
    document.querySelector('#claimReductionSection .crr-item-head input')?.focus({preventScroll:true});
  }
  // Thời hạn phản hồi: giá trị 'YYYY-MM-DDTHH:mm' (datetime-local). Câu đưa vào thư luôn mở đầu bằng DEADLINE_PREFIX để thay thế được khi đổi thời hạn.
  const DEADLINE_PREFIX = 'Đề nghị đơn vị cấp đơn phản hồi chậm nhất';
  function formatDeadline(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(text || ''));
    return match ? match[4] + ':' + match[5] + ' ngày ' + match[3] + '/' + match[2] + '/' + match[1] : '';
  }
  function deadlineLine(text) {
    const when = formatDeadline(text);
    return when ? DEADLINE_PREFIX + ' trước ' + when + '. Quá thời hạn trên, bộ phận bồi thường sẽ giải quyết quyền lợi của khách hàng theo quy định.' : '';
  }
  function withDeadline(body, text) {
    const line = deadlineLine(text);
    let result = String(body || '').replace(new RegExp('^' + DEADLINE_PREFIX + '.*\\n?','m'),'');
    if (line) result = /^Trân trọng,/m.test(result) ? result.replace(/^Trân trọng,/m,line + '\n\nTrân trọng,') : result.trimEnd() + '\n\n' + line;
    return result.replace(/\n{3,}/g,'\n\n').trim();
  }
  function template() {
    const state = getState();
    const info = {
      plate:value('BienSo'),customer:value('KhachHang'),hsbt:value('SoHoSoBoiThuong'),vtt:value('MaVuTonThat'),
      policy:value('SoHd'),certificate:value('SoGcn'),unit:value('DonViCapDon'),issuer:value('NguoiCapDon'),
      date:value('NgayVTT'),assessor:value('GdvTiepNhan'),reason:state.reason,impact:state.impact,basis:state.basis,stage:state.stage,
      notes:state.notes,evidence:state.evidence,
      // Chân email theo người dùng (cài ở Quản lý người dùng); chưa cài thì chỉ ký tên.
      sender:String(typeof EmailSignature !== 'undefined' && activeUserProfile ? EmailSignature.text(EmailSignature.resolve(activeUserProfile)) : '') || String(activeUserProfile?.displayName || firebase.auth().currentUser?.displayName || value('GdvTiepNhan') || '')
    };
    // Số liệu tính theo quy tắc (chỉ khi đã có tỷ lệ áp dụng và số tiền trước giảm trừ).
    const evaluated = rules() && state.rule ? rules().evaluate(state.rule) : null;
    const vnd = number => number.toLocaleString('vi-VN') + ' đ';
    const money = evaluated?.applied && evaluated.base ? [
      '- Số tiền bồi thường trước giảm trừ: ' + vnd(evaluated.base),
      '- Số tiền giảm trừ (' + evaluated.applied.rate + '%): ' + vnd(evaluated.deduction),
      '- Số tiền bồi thường sau giảm trừ: ' + vnd(evaluated.remain)
    ] : [];
    info.money = money;
    const facts = [
      ['Biển số xe',info.plate],['Khách hàng',info.customer],['Số HSBT',info.hsbt],['Mã vụ tổn thất',info.vtt],
      ['Hợp đồng bảo hiểm',info.policy],['Số GCNBH',info.certificate],['Ngày xảy ra tổn thất',info.date],
      ['Đơn vị cấp đơn',info.unit],['Người cấp đơn',info.issuer],['Giám định viên',info.assessor]
    ].filter(([,text]) => text && text !== '—').map(([label,text]) => '- ' + label + ': ' + text);
    const list = text => text.split('\n').filter(Boolean).map(line => '   + ' + line.replace(/^\s*[-+•]\s*/,''));
    const body = [
      'Kính gửi ' + (info.unit || 'Anh/Chị phụ trách cấp đơn') + ',', '',
      'Bộ phận giám định gửi thông tin giảm trừ / chế tài của hồ sơ sau để đơn vị cấp đơn nắm thông tin:',
      '',...facts,'','NỘI DUNG GIẢM TRỪ / CHẾ TÀI',
      '- Trạng thái: ' + info.stage,
      // Khi có bảng số tiền bên dưới, kết luận chỉ nêu tỷ lệ để không lặp số liệu.
      '- Kết luận: ' + ((money.length ? info.impact.split(':')[0] : info.impact) || 'Chưa xác định mức áp dụng'),
      ...(info.reason ? ['- Vi phạm ghi nhận:',...list(info.reason)] : []),
      ...(info.notes ? ['- Ghi nhận thực tế: ' + info.notes] : []),
      ...(info.basis ? ['- Căn cứ: ' + info.basis.replace(/^Căn cứ\s+/,'')] : []),
      ...(info.evidence ? ['- Tài liệu trong hồ sơ: ' + info.evidence] : []),
      ...money,'',
      'Kính đề nghị đơn vị cấp đơn nắm thông tin, phối hợp trao đổi với khách hàng và phản hồi nếu có thông tin cần bổ sung.',
      '', 'Trân trọng,', info.sender
    ].join('\n').trim();
    return {subject:'[Thông tin giảm trừ/chế tài] ' + info.plate + (info.hsbt ? ' – ' + info.hsbt : ''),body:withDeadline(body,draft.deadline),signature:JSON.stringify(info)};
  }
  // Chuyển nội dung thư sang HTML; nếu cuối thư đúng là chân email dạng văn bản thì thay bằng chân email có định dạng + banner.
  function bodyToHtml(body, signature) {
    const plain = EmailSignature.text(signature), trimmed = String(body || '').trimEnd();
    const cut = plain && trimmed.endsWith(plain);
    const main = cut ? trimmed.slice(0,trimmed.length - plain.length) : trimmed;
    const paragraphs = EmailSignature.escapeHtml(main).replace(/\n/g,'<br>');
    const banner = '<div style="margin-top:8px"><img src="' + EmailSignature.escapeHtml(signature.banner) + '" alt="" style="max-width:600px;width:100%;height:auto;border:0;display:block"></div>';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:\'Times New Roman\',Times,serif;font-size:12pt"><div style="font-family:\'Times New Roman\',Times,serif;font-size:12pt;line-height:1.4">' + paragraphs + '</div>' + (cut ? EmailSignature.html(signature) : banner) + '</body></html>';
  }
  // Thư định dạng (Times New Roman 12pt, chân chữ ký có ảnh) ở dạng HTML + văn bản thường để dán vào Outlook.
  function richMail(body) {
    const signature = typeof EmailSignature !== 'undefined' && activeUserProfile ? EmailSignature.resolve(activeUserProfile) : null;
    return signature ? bodyToHtml(body,signature) : '';
  }
  async function copyRich(html, plain) {
    try {
      if (!html || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
      await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})]);
      return true;
    } catch (_) { return false; }
  }
  function checkDeadline(text) {
    if (!text) return;
    const time = new Date(text).getTime();
    if (!Number.isFinite(time)) throw new Error('Thời hạn phản hồi không hợp lệ.');
    if (time <= Date.now()) throw new Error('Thời hạn phản hồi đã qua. Chọn thời điểm trong tương lai hoặc bấm Bỏ.');
  }
  function addresses(text) {
    const list = text.split(/[;,\n]+/).map(item => item.trim()).filter(Boolean);
    if (list.some(item => !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(item))) throw new Error('Nhập địa chỉ email hợp lệ, phân cách bằng dấu chấm phẩy.');
    return [...new Set(list)];
  }

  // ===== Danh bạ email dùng chung (Firebase: reduction_email_directory) =====
  // units/<đơn vị>            → email đơn vị cấp đơn (ô "Email đơn vị cấp đơn")
  // issuers/<đơn vị>__<người> → email cán bộ cấp đơn (tự thêm vào CC)
  // departments/<đơn vị>__<phòng KD> → email TPKD phụ trách phòng KD (tự thêm vào CC)
  // zones/<khu vực giám định>  → email quản lý khu vực giám định (tự thêm vào CC; không phụ thuộc đơn vị cấp đơn)
  // Khóa = tên đã bỏ dấu/viết thường; cán bộ và phòng KD gắn theo đơn vị để không nhầm giữa các chi nhánh.
  const DIRECTORY_PATH = 'reduction_email_directory';
  const slug = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  const splitAddresses = text => String(text || '').split(/[;,\n]+/).map(item => item.trim()).filter(Boolean);
  const mergeAddresses = (...lists) => {
    const seen = new Set(), out = [];
    for (const list of lists) for (const address of splitAddresses(list)) { const key = address.toLowerCase(); if (!seen.has(key)) { seen.add(key); out.push(address); } }
    return out.join('; ');
  };
  async function loadDirectory() {
    if (typeof dbNodeInstance === 'undefined' || !dbNodeInstance) throw new Error('Chưa kết nối cơ sở dữ liệu.');
    return (await dbNodeInstance.ref(DIRECTORY_PATH).once('value')).val() || {};
  }
  function directoryPanel(inputs, remember, feedback, sameContext) {
    const unit = value('DonViCapDon'), issuer = value('NguoiCapDon'), dept = value('Ttkd'), zone = value('ZoneBoiThuong'), uk = slug(unit);
    const rows = [
      {id:'unit', label:'Đơn vị cấp đơn', tag:'To', name:unit, key:uk, path:'units', prop:'to'},
      {id:'issuer', label:'Cán bộ cấp đơn', tag:'CC', name:issuer, key:uk && issuer ? uk + '__' + slug(issuer) : '', path:'issuers', prop:'email'},
      {id:'dept', label:'TPKD phụ trách phòng KD', tag:'CC', name:dept, key:uk && dept ? uk + '__' + slug(dept) : '', path:'departments', prop:'email'},
      {id:'zone', label:'Quản lý khu vực giám định', tag:'CC', name:zone, key:slug(zone), path:'zones', prop:'email'}
    ];
    const icon = (path) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
    const details = node('details',null,'crr-directory'), summary = node('summary',null,'crr-directory-head'), status = node('span',null,'crr-directory-status');
    const badge = node('span',null,'crr-directory-icon'), heading = node('span',null,'crr-directory-title'), chevron = node('span',null,'crr-directory-chevron');
    badge.innerHTML = icon('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><circle cx="12.5" cy="8.5" r="1.8"/><path d="M9.5 12c.6-1.2 1.7-1.8 3-1.8s2.4.6 3 1.8"/>');
    chevron.innerHTML = icon('<path d="m6 9 6 6 6-6"/>');
    heading.append(node('strong','Danh bạ email'),node('small',(unit || 'Chưa có đơn vị cấp đơn') + ' · dùng chung cho mọi người dùng'));
    summary.append(badge,heading,status,chevron); details.append(summary);
    const list = node('div',null,'crr-directory-list'), fields = {};
    for (const row of rows) {
      const line = node('label',null,'crr-directory-row'), meta = node('span',null,'crr-directory-meta'), caption = node('span',null,'crr-directory-caption'), input = node('input');
      input.id = 'claimReductionDirectory_' + row.id; line.htmlFor = input.id;
      caption.append(node('b',row.label),node('i',row.tag));
      meta.append(caption,node('span',row.name || 'Chưa có trong hồ sơ','crr-directory-name'));
      input.className = 'input-premium'; input.maxLength = 1000; input.autocomplete = 'off'; input.inputMode = 'email';
      input.placeholder = row.key ? 'email@donvi.vn; emailkhac@donvi.vn' : (row.id === 'zone' ? 'Hồ sơ chưa có Zone / Khu vực GĐ' : uk ? 'Hồ sơ chưa có thông tin này' : 'Hồ sơ chưa có đơn vị cấp đơn');
      input.disabled = !row.key; fields[row.id] = input;
      line.append(meta,input); list.append(line);
    }
    const canEdit = typeof hasUserPermission !== 'function' || hasUserPermission('pending','edit');
    const save = button('Lưu vào danh bạ',async () => {
      if (!sameContext()) return;
      let values;
      try { values = Object.fromEntries(rows.filter(row => row.key).map(row => [row.id, addresses(fields[row.id].value).join('; ')])); }
      catch (error) { feedback(error.message,'warning'); return; }
      const now = Date.now(), by = String(firebase.auth().currentUser?.email || '').slice(0,200), updates = {};
      for (const row of rows.filter(item => item.key)) {
        updates[row.path + '/' + row.key] = values[row.id] ? {name:row.name.slice(0,200), [row.prop]:values[row.id], updatedAt:now, updatedBy:by} : null;
      }
      save.disabled = true;
      try {
        await dbNodeInstance.ref(DIRECTORY_PATH).update(updates);
        if (!sameContext()) return;
        inputs.to.value = mergeAddresses(inputs.to.value, values.unit);
        inputs.cc.value = mergeAddresses(inputs.cc.value, values.issuer, values.dept, values.zone);
        remember(); status.textContent = 'Đã lưu';
        feedback('Đã lưu email vào danh bạ. Lần sau soạn thông báo cho ' + (unit || 'đơn vị này') + ' sẽ được điền sẵn.','success');
      } catch (error) {
        feedback(error?.code === 'PERMISSION_DENIED'
          ? 'Chưa lưu được: cần gộp firebase/email-directory.rules.json vào Firebase Rules.'
          : 'Chưa lưu được danh bạ email: ' + (error?.message || 'lỗi không xác định'),'error');
      } finally { save.disabled = false; }
    },true);
    save.disabled = !rows.some(row => row.key) || !canEdit; if (!canEdit) save.title = 'Bạn không có quyền chỉnh sửa hồ sơ.';
    const footer = node('div',null,'crr-directory-footer');
    footer.append(node('span','Để trống ô nào thì xóa email đã lưu của mục đó. CC sẽ tự gồm cán bộ cấp đơn, TPKD và quản lý khu vực.'),save);
    details.append(list,footer);
    // Nạp danh bạ rồi điền sẵn To / CC (chỉ khi ô còn trống, không ghi đè nội dung đã sửa).
    const apply = directory => {
      if (!sameContext()) return;
      const stored = row => (row.key && directory?.[row.path]?.[row.key]?.[row.prop]) || '';
      for (const row of rows) fields[row.id].value = stored(row);
      if (!fields.unit.value && inputs.to.value.trim()) fields.unit.value = inputs.to.value.trim();  // gợi ý: lưu luôn email đang nhập
      let filled = false;
      if (!inputs.to.value.trim() && stored(rows[0])) { inputs.to.value = stored(rows[0]); filled = true; }
      const cc = mergeAddresses(stored(rows[1]), stored(rows[2]), stored(rows[3]));
      if (!inputs.cc.value.trim() && cc) { inputs.cc.value = cc; filled = true; }
      if (filled) remember();
      const any = rows.some(row => stored(row));
      status.textContent = filled ? 'Đã điền sẵn' : any ? 'Đã có email lưu' : 'Chưa lưu';
      details.open = !any;
    };
    // Gõ email vào ô "Email đơn vị cấp đơn" phía trên → ô danh bạ của đơn vị theo luôn (trừ khi người dùng đã sửa riêng ô này).
    let unitEdited = false;
    fields.unit.addEventListener('input',() => { unitEdited = true; });
    inputs.to.addEventListener('input',() => { if (!unitEdited && !fields.unit.disabled) fields.unit.value = inputs.to.value; });
    status.textContent = 'Đang tải…';
    loadDirectory().then(apply).catch(() => { if (sameContext()) status.textContent = 'Không tải được danh bạ'; });
    return details;
  }
  function compose() {
    if (!owner()) return triggerToast('Vui lòng đăng nhập để soạn thông báo.','warning');
    if (!value('BienSo')) return triggerToast('Nhập biển số xe trước khi soạn thông báo.','warning');
    const state = getState();
    if (!state.reason && !state.notes) { document.querySelector('#claimReductionSection .crr-item-head input')?.focus(); return triggerToast('Chọn ít nhất một vi phạm hoặc nhập ghi nhận thực tế.','warning'); }
    close();
    const generated = template(), claim = editingPendingClaimId, uid = owner();
    const sheet = node('dialog',null,'sf-dialog claim-reduction-compose'); dialog = sheet;
    sheet.setAttribute('aria-labelledby','claimReductionComposeTitle');
    const form = node('form',null,'sf-dialog-form'), header = node('header'), title = node('div');
    const heading = node('h2','Thông báo đơn vị cấp đơn'); heading.id = 'claimReductionComposeTitle';
    title.append(node('small','GIẢM TRỪ / CHẾ TÀI'),heading); const dismiss = button('×',close); dismiss.setAttribute('aria-label','Đóng thông báo'); header.append(title,dismiss);
    const recipientGrid = node('div',null,'claim-reduction-recipients'), bodyBox = node('div',null,'crr-compose-body'); const inputs = {};
    for (const [key,label] of [['to','Email đơn vị cấp đơn'],['cc','CC (nếu có)'],['subject','Tiêu đề'],['body','Nội dung thông báo']]) {
      const wrapper = node('label',label), input = node(key === 'body' ? 'textarea' : 'input');
      input.id = 'claimReductionMail_' + key; wrapper.htmlFor = input.id;
      input.maxLength = key === 'body' ? 6000 : key === 'subject' ? 250 : 1000;
      if (key === 'body') input.rows = 12;
      input.value = key === 'subject' || key === 'body' ? (draft.signature === generated.signature && draft[key] ? draft[key] : generated[key]) : draft[key] || '';
      if (key === 'to' || key === 'cc') { input.placeholder = 'email@donvi.vn; emailkhac@donvi.vn'; input.autocomplete = 'off'; input.inputMode = 'email'; }
      inputs[key] = input; wrapper.append(input); (key === 'to' || key === 'cc' ? recipientGrid : bodyBox).append(wrapper);
    }
    bodyBox.prepend(recipientGrid); form.prepend(header,bodyBox);
    // Thông báo kết quả hiển thị dạng toast (góc phải trên) thay vì dòng chữ trong hộp thoại.
    const feedback = (message, type = 'warning') => { if (message) triggerToast(message,type); };
    const sameContext = () => owner() === uid && editingPendingClaimId === claim && sheet.dataset.discard !== 'true';
    const remember = () => { if (!sameContext()) return false; for (const key of Object.keys(inputs)) draft[key] = inputs[key].value; draft.signature = generated.signature; return true; };
    form.addEventListener('input',remember);
    recipientGrid.after(directoryPanel(inputs,remember,feedback,sameContext));
    // Thời hạn phản hồi chậm nhất → tự đưa vào nội dung thư.
    const deadlineCard = node('section',null,'crr-deadline'), deadlineHead = node('div',null,'crr-deadline-head');
    // Hai ô chọn dùng chung bộ SharedFormsControls (cùng giao diện với các dropdown khác) thay cho hộp chọn ngày giờ gốc của trình duyệt.
    const deadlineInput = node('input'); deadlineInput.type = 'hidden'; deadlineInput.id = 'claimReductionMail_deadline'; deadlineInput.value = draft.deadline || '';
    const deadlineLabel = node('span','Thời hạn phản hồi chậm nhất','crr-deadline-title');
    deadlineHead.append(deadlineLabel,node('small','Quá thời hạn, bộ phận bồi thường giải quyết quyền lợi theo quy định.'));
    const deadlineTools = node('div',null,'crr-deadline-tools'), chips = node('div',null,'crr-deadline-chips');
    const pad = number => String(number).padStart(2,'0'), isoDate = date => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    const weekdays = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
    const dateText = iso => { const date = new Date(iso + 'T00:00'); return Number.isNaN(date.getTime()) ? iso : weekdays[date.getDay()] + ', ' + pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear(); };
    const makeSelect = (label,icon,description,placeholder) => {
      const select = node('select'); select.setAttribute('aria-label',label);
      Object.assign(select.dataset,{sfSelect:'',sfLabel:label,sfIcon:icon,sfDescription:description});
      const empty = node('option',placeholder); empty.value = ''; select.append(empty);
      return select;
    };
    const addOption = (select,value,text) => { if (![...select.options].some(option => option.value === value)) { const option = node('option',text); option.value = value; select.append(option); } };
    const dateSelect = makeSelect('Ngày phản hồi','calendar','Chọn ngày chậm nhất đơn vị cấp đơn cần phản hồi.','Chọn ngày');
    const timeSelect = makeSelect('Giờ phản hồi','clock','Chọn giờ chậm nhất trong ngày.','Giờ');
    const today = new Date();
    for (let offset = 0; offset <= 30; offset++) { const date = new Date(today.getFullYear(),today.getMonth(),today.getDate() + offset); addOption(dateSelect,isoDate(date),dateText(isoDate(date))); }
    for (let minutes = 7 * 60; minutes <= 21 * 60; minutes += 30) { const text = pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60); addOption(timeSelect,text,text); }
    const [savedDate = '',savedTime = ''] = String(draft.deadline || '').split('T');
    if (savedDate) addOption(dateSelect,savedDate,dateText(savedDate));
    if (savedTime) addOption(timeSelect,savedTime,savedTime);
    dateSelect.value = savedDate; timeSelect.value = savedTime || '17:00';
    const syncDeadline = () => {
      deadlineInput.value = dateSelect.value ? dateSelect.value + 'T' + (timeSelect.value || '17:00') : '';
      deadlineInput.dispatchEvent(new Event('input',{bubbles:true}));
    };
    const setDeadline = (date,time = '17:00') => {
      if (date) { addOption(dateSelect,date,dateText(date)); addOption(timeSelect,time,time); }
      dateSelect.value = date; timeSelect.value = time; SharedFormsControls.enhance(deadlineTools); syncDeadline();
    };
    dateSelect.addEventListener('change',syncDeadline); timeSelect.addEventListener('change',syncDeadline);
    [1,2,3,5].forEach(days => chips.append(button(days + ' ngày',() => { const date = new Date(); date.setDate(date.getDate() + days); setDeadline(isoDate(date)); })));
    chips.append(button('Bỏ',() => setDeadline('')));
    chips.querySelectorAll('button').forEach(chip => chip.classList.add('crr-deadline-chip'));
    const pickers = node('div',null,'crr-deadline-pickers'); pickers.append(dateSelect,timeSelect);
    deadlineTools.append(pickers,chips,deadlineInput); deadlineCard.append(deadlineHead,deadlineTools);
    inputs.deadline = deadlineInput;
    deadlineInput.addEventListener('input',() => { inputs.body.value = withDeadline(inputs.body.value,deadlineInput.value); remember(); });
    bodyBox.children[1].after(deadlineCard);
    const footer = node('footer');
    const copy = button('Sao chép nội dung',async () => {
      if (!sameContext()) return close();
      remember();
      if (await copyRich(richMail(inputs.body.value),inputs.body.value)) return feedback('Đã sao chép thư định dạng (Times New Roman, kèm chân chữ ký). Dán vào thân thư bằng Ctrl+V.','success');
      try { await navigator.clipboard.writeText(inputs.body.value); feedback('Đã sao chép nội dung thông báo.','success'); }
      catch (_) { inputs.body.focus(); inputs.body.select(); feedback('Nhấn Ctrl+C để sao chép nội dung đã chọn.','warning'); }
    });
    const outlook = button('Mở Outlook',async () => {
      if (!sameContext()) return close();
      try {
        const to = addresses(inputs.to.value), cc = addresses(inputs.cc.value);
        if (!to.length) throw new Error('Nhập email đơn vị cấp đơn trước khi mở Outlook.');
        if (!inputs.subject.value.trim() || !inputs.body.value.trim()) throw new Error('Nhập tiêu đề và nội dung thông báo.');
        checkDeadline(inputs.deadline.value);
        // Thứ tự to → cc → subject → body: cc đứng trước phần nội dung dài để không bị cắt/bỏ qua.
        // Outlook web chỉ nhận danh sách địa chỉ phân cách bằng dấu phẩy.
        const params = {to:to.join(',')};
        if (cc.length) params.cc = cc.join(',');
        params.subject = inputs.subject.value.replace(/[\r\n]/g,' ');
        // Nội dung luôn đi qua link (văn bản thường) để thư không bao giờ trống; đồng thời chép bản định dạng (Times New Roman + ảnh chân chữ ký) vào clipboard để dán đè khi cần.
        const copiedRich = await copyRich(richMail(inputs.body.value),inputs.body.value);
        params.body = inputs.body.value;
        // Outlook's compose route keeps form-encoded '+' characters as literal text.
        // Encode spaces as %20 and actual plus signs as %2B in every parameter.
        const query = Object.entries(params).map(([key,text]) => encodeURIComponent(key) + '=' + encodeURIComponent(text)).join('&');
        const url = 'https://outlook.cloud.microsoft/mail/deeplink/compose?' + query;
        if (url.length > 12000) throw new Error('Nội dung dài. Dùng Sao chép nội dung rồi dán vào Outlook.');
        remember(); window.open(url,'_blank','noopener,noreferrer');
        if (copiedRich) return feedback('Đã chuyển nội dung sang Outlook. Muốn có font Times New Roman và ảnh chân chữ ký: bấm vào thân thư, nhấn Ctrl+A rồi Ctrl+V.' + (cc.length ? ' CC: bấm "Sao chép CC" rồi dán vào ô Cc.' : ''),'success');
        // Link soạn thư của Outlook web KHÔNG hỗ trợ tham số CC (Microsoft không có tài liệu) → chép sẵn CC vào clipboard để dán.
        if (cc.length) {
          const note = 'Outlook web không nhận CC qua link. Email CC đã được sao chép: bấm vào ô Cc trong Outlook rồi nhấn Ctrl+V.';
          (navigator.clipboard?.writeText(cc.join('; ')) || Promise.reject(new Error('no-clipboard')))
            .then(() => feedback(note,'warning'),() => feedback('Outlook web không nhận CC qua link. Bấm "Sao chép CC" rồi dán vào ô Cc.','warning'));
        } else feedback('Đã yêu cầu mở cửa sổ soạn thư. Kiểm tra tài khoản gửi, người nhận và bấm Gửi trong Outlook.','success');
      } catch (error) { feedback(error.message,'warning'); }
    },true);
    // Outlook web đôi khi bỏ qua tham số cc của deeplink → có 2 đường dự phòng đảm bảo CC không bị mất.
    const copyCc = button('Sao chép CC',async () => {
      const cc = addresses(inputs.cc.value);
      if (!cc.length) { feedback('Chưa có email CC để sao chép.','warning'); return; }
      try { await navigator.clipboard.writeText(cc.join('; ')); feedback('Đã sao chép ' + cc.length + ' email CC. Dán vào ô Cc trong Outlook (Ctrl+V).','success'); }
      catch (_) { inputs.cc.focus(); inputs.cc.select(); feedback('Nhấn Ctrl+C để sao chép email CC đã chọn.','warning'); }
    });
    const mailApp = button('Ứng dụng thư',() => {
      if (!sameContext()) return close();
      try {
        const to = addresses(inputs.to.value), cc = addresses(inputs.cc.value);
        if (!to.length) throw new Error('Nhập email đơn vị cấp đơn trước.');
        checkDeadline(inputs.deadline.value);
        const query = [['subject',inputs.subject.value.replace(/[\r\n]/g,' ')],['body',inputs.body.value]];
        if (cc.length) query.unshift(['cc',cc.join(',')]);
        const url = 'mailto:' + to.map(encodeURIComponent).join(',') + '?' + query.map(([key,text]) => key + '=' + encodeURIComponent(text)).join('&');
        if (url.length > 8000) throw new Error('Nội dung dài. Dùng Sao chép nội dung rồi dán vào thư.');
        remember(); window.location.href = url;
        feedback('Đã mở ứng dụng thư mặc định với đủ người nhận và CC.','success');
      } catch (error) { feedback(error.message,'warning'); }
    });
    // .eml nháp (X-Unsent) mở được bằng Outlook desktop / ứng dụng thư, giữ đủ To + Cc + nội dung.
    const emlDraft = button('Tải .eml',() => {
      if (!sameContext()) return close();
      try {
        const to = addresses(inputs.to.value), cc = addresses(inputs.cc.value);
        if (!to.length) throw new Error('Nhập email đơn vị cấp đơn trước.');
        checkDeadline(inputs.deadline.value);
        const b64 = text => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
        const wrap = text => text.replace(/.{1,76}/g,'$&\r\n').trimEnd();
        const lines = ['X-Unsent: 1','To: ' + to.join(', ')];
        if (cc.length) lines.push('Cc: ' + cc.join(', '));
        // Xuất thư HTML (Times New Roman, chữ ký có định dạng + ảnh banner).
        const signature = typeof EmailSignature !== 'undefined' && activeUserProfile ? EmailSignature.resolve(activeUserProfile) : null;
        const html = signature ? bodyToHtml(inputs.body.value,signature) : '';
        lines.push('Subject: =?UTF-8?B?' + b64(inputs.subject.value.replace(/[\r\n]/g,' ')) + '?=','MIME-Version: 1.0','Content-Type: ' + (html ? 'text/html' : 'text/plain') + '; charset=UTF-8','Content-Transfer-Encoding: base64','',wrap(b64(html || inputs.body.value)));
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'message/rfc822'}));
        link.download = 'thong-bao-giam-tru.eml';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href),10000);
        remember(); feedback('Đã tải thư nháp. Mở file .eml bằng Outlook: đủ người nhận, CC và nội dung.','success');
      } catch (error) { feedback(error.message,'warning'); }
    });
    footer.append(button('Tạo lại mẫu',() => { inputs.subject.value = generated.subject; inputs.body.value = withDeadline(generated.body,inputs.deadline.value); remember(); feedback('Đã tạo lại nội dung từ thông tin hồ sơ.','success'); }),copy,copyCc,emlDraft,mailApp,outlook);
    bodyBox.append(node('p','Có thể sửa nội dung trước khi gửi. Thông tin được lưu cùng hồ sơ khi bạn bấm Lưu cập nhật hồ sơ.','claim-reduction-note'));
    const foot = node('div',null,'crr-compose-foot'); foot.append(footer); form.append(foot);
    form.onsubmit = event => event.preventDefault(); sheet.append(form);
    const returnFocus = document.activeElement;
    sheet.addEventListener('keydown',event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); sheet.close(); } });
    sheet.addEventListener('cancel',event => { event.preventDefault(); sheet.close(); });
    sheet.addEventListener('close',() => { remember(); if (dialog === sheet) dialog = null; sheet.remove(); if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true}); },{once:true});
    SharedFormsControls.enhance(sheet);
    document.body.append(sheet); sheet.showModal(); inputs.to.focus();
  }
  return {mount,load,getState,close,show,directory:{slug,mergeAddresses},deadline:{withDeadline,format:formatDeadline}};
})();
