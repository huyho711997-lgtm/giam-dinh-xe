const ClaimReductionNotice = (() => {
  const stages = ['Đang xem xét','Dự kiến áp dụng','Đã phê duyệt','Đã áp dụng'];
  const fields = {reason:'Lý do giảm trừ / chế tài',impact:'Mức giảm trừ / chế tài',basis:'Căn cứ / ghi nhận hồ sơ',stage:'Trạng thái xử lý'};
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
  const envelope = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>';
  function refreshStage() {
    const badge = document.getElementById('claimReductionStage');
    const stage = document.getElementById('modalPendingReduction_stage')?.value || stages[0];
    if (badge) { badge.textContent = stage; badge.dataset.stage = String(stages.indexOf(stage)); }
  }
  function close() { if (dialog?.open) dialog.close(); }
  function load(data) {
    if (dialog) dialog.dataset.discard = 'true';
    close(); draft = {};
    for (const key of ['reason','impact','basis','stage','to','cc','subject','body','signature']) {
      draft[key] = typeof data?.[key] === 'string' ? data[key].slice(0,key === 'signature' ? 16000 : 6000) : '';
    }
    if (!stages.includes(draft.stage)) draft.stage = stages[0];
    for (const key of Object.keys(fields)) {
      const input = document.getElementById('modalPendingReduction_' + key);
      if (input) input.value = draft[key] || '';
    }
    const section = document.getElementById('claimReductionSection');
    if (section) SharedFormsControls.enhance(section);
    refreshStage();
  }
  function getState() {
    for (const key of Object.keys(fields)) {
      const input = document.getElementById('modalPendingReduction_' + key);
      if (input) draft[key] = input.value.trim();
    }
    return {...draft};
  }
  function mount() {
    const pane = document.getElementById('tabPane_Financial');
    if (!pane || document.getElementById('claimReductionSection')) return;
    const section = node('section',null,'claim-editor-form-section claim-reduction-section'); section.id = 'claimReductionSection';
    const header = node('header'), title = node('div',null,'claim-reduction-heading');
    const emblem = node('span',null,'claim-reduction-emblem'); emblem.innerHTML = envelope;
    title.append(node('small','PHỐI HỢP ĐƠN VỊ CẤP ĐƠN'),node('h4','Thông báo giảm trừ / chế tài'),node('p','Ghi nhận nội dung xử lý và soạn thông báo cho đơn vị cấp đơn.'));
    const badge = node('span',null,'claim-reduction-stage'); badge.id = 'claimReductionStage';
    header.append(emblem,title,badge);
    const context = node('div',null,'claim-reduction-context');
    for (const [label,id,empty] of [['Phương tiện','modalPendingBienSo','Chưa có biển số'],['Đơn vị nhận thông tin','modalPendingDonViCapDon','Chưa có đơn vị cấp đơn']]) {
      const item = node('div'), text = node('strong'); text.dataset.claimSummary = id; text.dataset.empty = empty;
      text.textContent = document.getElementById(id)?.value || empty; item.append(node('span',label),text); context.append(item);
    }
    const grid = node('div',null,'claim-editor-form-grid claim-reduction-fields');
    const details = node('section',null,'claim-reduction-panel'), application = node('section',null,'claim-reduction-panel');
    for (const [panel,number,label] of [[details,'01','Nội dung xử lý'],[application,'02','Mức áp dụng & trạng thái']]) {
      const caption = node('h5'); caption.append(node('span',number),document.createTextNode(label)); panel.append(caption);
    }
    for (const [key,label] of Object.entries(fields)) {
      const group = node('div',null,'form-group'), caption = node('label',label);
      const input = node(key === 'stage' ? 'select' : ['reason','basis'].includes(key) ? 'textarea' : 'input');
      input.id = 'modalPendingReduction_' + key; caption.htmlFor = input.id;
      input.className = key === 'stage' ? '' : 'input-premium';
      if (key === 'stage') {
        stages.forEach(stage => { const option = node('option',stage); option.value = stage; input.append(option); });
        input.dataset.sfSelect = ''; input.dataset.sfLabel = label; input.dataset.sfIcon = 'shield';
        input.dataset.sfDescription = 'Trạng thái này được đưa vào nội dung thông báo.';
        input.addEventListener('change',refreshStage);
      } else {
        input.maxLength = key === 'impact' ? 200 : 1500;
        if (input.tagName === 'TEXTAREA') input.rows = 3;
        input.placeholder = ({reason:'Nhập lý do được ghi nhận trong hồ sơ',impact:'Nhập tỷ lệ (%) hoặc số tiền (VNĐ)',basis:'Điều khoản / tài liệu liên quan (nếu có)'})[key];
      }
      input.value = draft[key] || (key === 'stage' ? stages[0] : '');
      group.append(caption,input); (['reason','basis'].includes(key) ? details : application).append(group);
    }
    const note = node('p','Nhập tỷ lệ hoặc số tiền theo hồ sơ. Trạng thái đã chọn sẽ xuất hiện trong thư để đơn vị cấp đơn nắm đúng tiến độ.','claim-reduction-panel-note'); application.append(note); grid.append(details,application);
    const footer = node('div',null,'claim-reduction-footer');
    const help = node('div'); help.append(node('strong','Xem lại nội dung trước khi gửi'),node('p','Thông tin được lưu khi bấm Lưu cập nhật hồ sơ.','claim-editor-hint'));
    const create = button('',compose,true); create.innerHTML = envelope; create.append(node('span','Soạn thông báo cấp đơn'));
    footer.append(help,create);
    section.append(header,context,grid,footer); pane.append(section); SharedFormsControls.enhance(section); refreshStage();
  }
  function show() {
    switchEditClaimTab('Financial'); ClaimEditorWorkspace.showMain();
    document.getElementById('claimReductionSection')?.scrollIntoView({block:'start'});
    document.getElementById('modalPendingReduction_reason')?.focus({preventScroll:true});
  }
  function template() {
    const state = getState();
    const info = {
      plate:value('BienSo'),customer:value('KhachHang'),hsbt:value('SoHoSoBoiThuong'),vtt:value('MaVuTonThat'),
      policy:value('SoHd'),certificate:value('SoGcn'),unit:value('DonViCapDon'),issuer:value('NguoiCapDon'),
      date:value('NgayVTT'),assessor:value('GdvTiepNhan'),reason:state.reason,impact:state.impact,basis:state.basis,stage:state.stage,
      sender:String(activeUserProfile?.displayName || firebase.auth().currentUser?.displayName || value('GdvTiepNhan') || '')
    };
    const facts = [
      ['Biển số xe',info.plate],['Khách hàng',info.customer],['Số HSBT',info.hsbt],['Mã vụ tổn thất',info.vtt],
      ['Hợp đồng bảo hiểm',info.policy],['Số GCNBH',info.certificate],['Ngày xảy ra tổn thất',info.date],
      ['Đơn vị cấp đơn',info.unit],['Người cấp đơn',info.issuer],['Giám định viên',info.assessor]
    ].filter(([,text]) => text && text !== '—').map(([label,text]) => '- ' + label + ': ' + text);
    const body = [
      'Kính gửi ' + (info.unit || 'Anh/Chị phụ trách cấp đơn') + ',', '',
      'Bộ phận giám định gửi thông tin giảm trừ / chế tài của hồ sơ sau để đơn vị cấp đơn nắm thông tin:',
      '',...facts,'','NỘI DUNG GIẢM TRỪ / CHẾ TÀI',
      '- Trạng thái: ' + info.stage,'- Lý do: ' + info.reason,
      '- Mức giảm trừ / chế tài: ' + (info.impact || 'Chưa xác định'),
      ...(info.basis ? ['- Căn cứ / ghi nhận: ' + info.basis] : []),'',
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
  function compose() {
    if (!owner()) return triggerToast('Vui lòng đăng nhập để soạn thông báo.','warning');
    if (!value('BienSo')) return triggerToast('Nhập biển số xe trước khi soạn thông báo.','warning');
    const state = getState();
    if (!state.reason) { document.getElementById('modalPendingReduction_reason')?.focus(); return triggerToast('Nhập lý do giảm trừ / chế tài.','warning'); }
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
  return {mount,load,getState,close,show};
})();
