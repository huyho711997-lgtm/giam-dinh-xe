const ClaimReductionNotice = (() => {
  // Một luồng nhập duy nhất: chọn vi phạm theo quy tắc (ClaimReductionRules) → lý do, mức áp dụng, căn cứ
  // được TỰ SINH khi soạn thư. Người dùng chỉ nhập thêm điều máy không biết: ghi nhận thực tế & tài liệu.
  const stages = ['Đang xem xét','Dự kiến áp dụng','Đã phê duyệt','Đã áp dụng'];
  const defaultStage = stages[1]; // 'Dự kiến áp dụng' – trạng thái mặc định khi hồ sơ chưa có thông báo giảm trừ
  const MAIL_KEYS = ['to','cc','subject','body','signature'];
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
    for (const key of MAIL_KEYS) draft[key] = clip(data?.[key], key === 'signature' ? 16000 : 6000);
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
  function template() {
    const state = getState();
    const info = {
      plate:value('BienSo'),customer:value('KhachHang'),hsbt:value('SoHoSoBoiThuong'),vtt:value('MaVuTonThat'),
      policy:value('SoHd'),certificate:value('SoGcn'),unit:value('DonViCapDon'),issuer:value('NguoiCapDon'),
      date:value('NgayVTT'),assessor:value('GdvTiepNhan'),reason:state.reason,impact:state.impact,basis:state.basis,stage:state.stage,
      notes:state.notes,evidence:state.evidence,
      sender:String(activeUserProfile?.displayName || firebase.auth().currentUser?.displayName || value('GdvTiepNhan') || '')
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
    return {subject:'[Thông tin giảm trừ/chế tài] ' + info.plate + (info.hsbt ? ' – ' + info.hsbt : ''),body,signature:JSON.stringify(info)};
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
    const unit = value('DonViCapDon'), issuer = value('NguoiCapDon'), dept = value('Ttkd'), uk = slug(unit);
    const rows = [
      {id:'unit', label:'Đơn vị cấp đơn', name:unit, key:uk, path:'units', prop:'to', note:'Gửi tới (To)'},
      {id:'issuer', label:'Cán bộ cấp đơn', name:issuer, key:uk && issuer ? uk + '__' + slug(issuer) : '', path:'issuers', prop:'email', note:'Tự thêm vào CC'},
      {id:'dept', label:'TPKD phụ trách phòng KD', name:dept, key:uk && dept ? uk + '__' + slug(dept) : '', path:'departments', prop:'email', note:'Tự thêm vào CC'}
    ];
    const details = node('details',null,'crr-directory'), summary = node('summary','Email đã lưu cho đơn vị này'), status = node('span',null,'crr-directory-status');
    summary.append(status); details.append(summary);
    const grid = node('div',null,'crr-directory-grid'), fields = {};
    for (const row of rows) {
      const wrapper = node('label'), input = node('input'), caption = node('span',row.label + (row.name ? ' · ' + row.name : ''));
      input.id = 'claimReductionDirectory_' + row.id; wrapper.htmlFor = input.id;
      input.className = 'input-premium'; input.maxLength = 1000; input.autocomplete = 'off'; input.inputMode = 'email';
      input.placeholder = row.key ? 'email@donvi.vn; emailkhac@donvi.vn' : (uk ? 'Hồ sơ chưa có thông tin này' : 'Hồ sơ chưa có đơn vị cấp đơn');
      input.disabled = !row.key; fields[row.id] = input;
      wrapper.append(caption,input,node('em',row.note)); grid.append(wrapper);
    }
    const canEdit = typeof hasUserPermission !== 'function' || hasUserPermission('pending','edit');
    const save = button('Lưu vào danh bạ',async () => {
      if (!sameContext()) return;
      let values;
      try { values = Object.fromEntries(rows.filter(row => row.key).map(row => [row.id, addresses(fields[row.id].value).join('; ')])); }
      catch (error) { feedback.textContent = error.message; return; }
      const now = Date.now(), by = String(firebase.auth().currentUser?.email || '').slice(0,200), updates = {};
      for (const row of rows.filter(item => item.key)) {
        updates[row.path + '/' + row.key] = values[row.id] ? {name:row.name.slice(0,200), [row.prop]:values[row.id], updatedAt:now, updatedBy:by} : null;
      }
      save.disabled = true;
      try {
        await dbNodeInstance.ref(DIRECTORY_PATH).update(updates);
        if (!sameContext()) return;
        inputs.to.value = mergeAddresses(inputs.to.value, values.unit);
        inputs.cc.value = mergeAddresses(inputs.cc.value, values.issuer, values.dept);
        remember(); status.textContent = 'Đã lưu';
        feedback.textContent = 'Đã lưu email vào danh bạ. Lần sau soạn thông báo cho ' + (unit || 'đơn vị này') + ' sẽ được điền sẵn.';
      } catch (error) {
        feedback.textContent = error?.code === 'PERMISSION_DENIED'
          ? 'Chưa lưu được: cần gộp firebase/email-directory.rules.json vào Firebase Rules.'
          : 'Chưa lưu được danh bạ email: ' + (error?.message || 'lỗi không xác định');
      } finally { save.disabled = false; }
    },true);
    save.disabled = !uk || !canEdit; if (!canEdit) save.title = 'Bạn không có quyền chỉnh sửa hồ sơ.';
    const footer = node('div',null,'crr-directory-footer');
    footer.append(save,node('span','Dùng chung cho mọi người dùng. Để trống ô nào thì xóa email đã lưu của mục đó.'));
    details.append(grid,footer);
    // Nạp danh bạ rồi điền sẵn To / CC (chỉ khi ô còn trống, không ghi đè nội dung đã sửa).
    const apply = directory => {
      if (!sameContext()) return;
      const stored = row => (row.key && directory?.[row.path]?.[row.key]?.[row.prop]) || '';
      for (const row of rows) fields[row.id].value = stored(row);
      if (!fields.unit.value && inputs.to.value.trim()) fields.unit.value = inputs.to.value.trim();  // gợi ý: lưu luôn email đang nhập
      let filled = false;
      if (!inputs.to.value.trim() && stored(rows[0])) { inputs.to.value = stored(rows[0]); filled = true; }
      const cc = mergeAddresses(stored(rows[1]), stored(rows[2]));
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
    const recipientGrid = node('div',null,'claim-reduction-recipients'); const inputs = {};
    for (const [key,label] of [['to','Email đơn vị cấp đơn'],['cc','CC (nếu có)'],['subject','Tiêu đề'],['body','Nội dung thông báo']]) {
      const wrapper = node('label',label), input = node(key === 'body' ? 'textarea' : 'input');
      input.id = 'claimReductionMail_' + key; wrapper.htmlFor = input.id;
      input.maxLength = key === 'body' ? 6000 : key === 'subject' ? 250 : 1000;
      if (key === 'body') input.rows = 15;
      input.value = key === 'subject' || key === 'body' ? (draft.signature === generated.signature && draft[key] ? draft[key] : generated[key]) : draft[key] || '';
      if (key === 'to' || key === 'cc') { input.placeholder = 'email@donvi.vn; emailkhac@donvi.vn'; input.autocomplete = 'off'; input.inputMode = 'email'; }
      inputs[key] = input; wrapper.append(input); (key === 'to' || key === 'cc' ? recipientGrid : form).append(wrapper);
    }
    form.prepend(header,recipientGrid);
    const feedback = node('p',null,'sf-feedback'); feedback.setAttribute('role','status');
    const sameContext = () => owner() === uid && editingPendingClaimId === claim && sheet.dataset.discard !== 'true';
    const remember = () => { if (!sameContext()) return false; for (const key of Object.keys(inputs)) draft[key] = inputs[key].value; draft.signature = generated.signature; return true; };
    form.addEventListener('input',remember);
    recipientGrid.after(directoryPanel(inputs,remember,feedback,sameContext));
    const footer = node('footer');
    const copy = button('Sao chép nội dung',async () => {
      if (!sameContext()) return close();
      remember();
      try { await navigator.clipboard.writeText(inputs.body.value); feedback.textContent = 'Đã sao chép nội dung thông báo.'; }
      catch (_) { inputs.body.focus(); inputs.body.select(); feedback.textContent = 'Nhấn Ctrl+C để sao chép nội dung đã chọn.'; }
    });
    const outlook = button('Mở thư Outlook',() => {
      if (!sameContext()) return close();
      try {
        const to = addresses(inputs.to.value), cc = addresses(inputs.cc.value);
        if (!to.length) throw new Error('Nhập email đơn vị cấp đơn trước khi mở Outlook.');
        if (!inputs.subject.value.trim() || !inputs.body.value.trim()) throw new Error('Nhập tiêu đề và nội dung thông báo.');
        const params = {to:to.join(';'),subject:inputs.subject.value.replace(/[\r\n]/g,' '),body:inputs.body.value};
        if (cc.length) params.cc = cc.join(';');
        // Outlook's compose route keeps form-encoded '+' characters as literal text.
        // Encode spaces as %20 and actual plus signs as %2B in every parameter.
        const query = Object.entries(params).map(([key,text]) => encodeURIComponent(key) + '=' + encodeURIComponent(text)).join('&');
        const url = 'https://outlook.cloud.microsoft/mail/deeplink/compose?' + query;
        if (url.length > 12000) throw new Error('Nội dung dài. Dùng Sao chép nội dung rồi dán vào Outlook.');
        remember(); window.open(url,'_blank','noopener,noreferrer');
        feedback.textContent = 'Đã yêu cầu mở cửa sổ soạn thư. Kiểm tra tài khoản gửi, người nhận và bấm Gửi trong Outlook. Nếu chưa thấy thư, cho phép mở cửa sổ mới hoặc sao chép nội dung.';
      } catch (error) { feedback.textContent = error.message; }
    },true);
    footer.append(button('Tạo lại nội dung mẫu',() => { inputs.subject.value = generated.subject; inputs.body.value = generated.body; remember(); feedback.textContent = 'Đã tạo lại nội dung từ thông tin hồ sơ.'; }),copy,outlook);
    form.append(node('p','Có thể sửa nội dung trước khi gửi. Thông tin được lưu cùng hồ sơ khi bạn bấm Lưu cập nhật hồ sơ.','claim-reduction-note'),feedback,footer);
    form.onsubmit = event => event.preventDefault(); sheet.append(form);
    const returnFocus = document.activeElement;
    sheet.addEventListener('keydown',event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); sheet.close(); } });
    sheet.addEventListener('cancel',event => { event.preventDefault(); sheet.close(); });
    sheet.addEventListener('close',() => { remember(); if (dialog === sheet) dialog = null; sheet.remove(); if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true}); },{once:true});
    document.body.append(sheet); sheet.showModal(); inputs.to.focus();
  }
  return {mount,load,getState,close,show,directory:{slug,mergeAddresses}};
})();
