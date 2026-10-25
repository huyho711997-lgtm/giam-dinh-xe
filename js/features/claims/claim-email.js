// Tab "Email" của hồ sơ: nơi tập trung mọi loại thư gửi đơn vị cấp đơn. Mỗi loại thư là một "spec" (tiêu đề + hàm dựng nội dung + nơi lưu bản nháp)
// và dùng chung hộp soạn thư của ClaimReductionNotice.compose(spec) (người nhận, danh bạ email, thời hạn phản hồi, chân email, xuất Outlook/.eml).
// Muốn thêm loại thư mới: thêm một mục vào TEMPLATES và một thẻ trong render().
const ClaimEmail = (() => {
  const IMAGE_ITEMS = [
    ['body','Hình ảnh các mặt xe lúc cấp đơn (đầu, đuôi, hai bên)'],
    ['chassis','Hình ảnh số khung, số máy'],
    ['odometer','Hình ảnh đồng hồ công-tơ-mét (số km)'],
    ['certificate','Giấy chứng nhận bảo hiểm (GCNBH) đã cấp'],
    ['registration','Giấy đăng ký xe và giấy chứng nhận kiểm định']
  ];
  const MAIL_KEYS = ['to','cc','subject','body','signature','deadline'];
  const clip = (text, max) => typeof text === 'string' ? text.slice(0,max) : '';
  let state = emptyState();
  function emptyState() { return {imageRequest:{items:IMAGE_ITEMS.map(([key]) => key),note:'',mail:{}}}; }
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text) element.textContent = text; if (className) element.className = className; return element; };

  function load(data) {
    state = emptyState();
    const saved = data?.imageRequest;
    if (saved && typeof saved === 'object') {
      if (Array.isArray(saved.items)) state.imageRequest.items = IMAGE_ITEMS.map(([key]) => key).filter(key => saved.items.includes(key));
      state.imageRequest.note = clip(saved.note,1000);
      for (const key of MAIL_KEYS) state.imageRequest.mail[key] = clip(saved.mail?.[key],key === 'signature' ? 16000 : key === 'deadline' ? 40 : 6000);
    }
    render();
  }
  function getState() {
    readForm();
    return JSON.parse(JSON.stringify(state));
  }
  function readForm() {
    const list = document.getElementById('claimEmailImageItems');
    if (list) state.imageRequest.items = [...list.querySelectorAll('input[type=checkbox]')].filter(input => input.checked).map(input => input.value);
    const note = document.getElementById('claimEmailImageNote');
    if (note) state.imageRequest.note = note.value.trim().slice(0,1000);
  }

  // Nội dung thư "Yêu cầu cung cấp hình ảnh cấp đơn": liệt kê đúng những mục đã tích + yêu cầu khác.
  function buildImageRequest(ctx, request) {
    const wanted = IMAGE_ITEMS.filter(([key]) => request.items.includes(key)).map(([,label]) => '- ' + label);
    const extra = request.note ? request.note.split('\n').map(line => line.trim()).filter(Boolean).map(line => '- ' + line.replace(/^[-+•]\s*/,'')) : [];
    const body = [
      'Kính gửi ' + (ctx.unit || 'Anh/Chị phụ trách cấp đơn') + ',','',
      'Để có cơ sở xem xét và giải quyết hồ sơ bồi thường, Bộ phận giám định đề nghị đơn vị cấp đơn cung cấp hình ảnh tại thời điểm cấp đơn của hồ sơ sau:','',
      ...ctx.facts,'','NỘI DUNG ĐỀ NGHỊ CUNG CẤP',
      ...wanted,...extra,'',
      'Hình ảnh cần rõ nét, đầy đủ góc chụp và có thể gửi lại trực tiếp qua email này. Kính đề nghị đơn vị cấp đơn phối hợp cung cấp sớm.',
      '','Trân trọng,',ctx.sender
    ].join('\n').trim();
    return {subject:'[Yêu cầu cung cấp hình ảnh cấp đơn] ' + ctx.plate + (ctx.hsbt ? ' – ' + ctx.hsbt : ''),body,signature:JSON.stringify({kind:'imageRequest',items:request.items,note:request.note,facts:ctx.facts,unit:ctx.unit,sender:ctx.sender})};
  }
  function imageSpec() {
    readForm();
    const request = state.imageRequest;
    return {eyebrow:'YÊU CẦU HÌNH ẢNH CẤP ĐƠN',title:'Yêu cầu cung cấp hình ảnh cấp đơn',store:request.mail,
      precheck() {
        if (!request.items.length && !request.note) { document.getElementById('claimEmailImageItems')?.querySelector('input')?.focus(); triggerToast('Chọn ít nhất một loại hình ảnh cần yêu cầu.','warning'); return true; }
        return false;
      },
      build:ctx => buildImageRequest(ctx,request)};
  }

  const icons = {
    mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/></svg>',
    image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>'
  };
  function card(id, icon, title, description) {
    const section = node('section',null,'cem-card'); section.id = id;
    const head = node('header',null,'cem-card-head'), mark = node('span',null,'cem-card-icon'); mark.innerHTML = icon;
    const copy = node('div'); copy.append(node('h4',title),node('p',description));
    head.append(mark,copy); section.append(head);
    return section;
  }
  function actionButton(label, onClick, primary = false) {
    const button = node('button',label,'cem-button' + (primary ? ' is-primary' : '')); button.type = 'button'; button.onclick = onClick; return button;
  }
  function render() {
    const pane = document.getElementById('tabPane_Email');
    if (!pane) return;
    readForm();
    pane.replaceChildren();
    const intro = node('div',null,'cem-intro');
    intro.append(node('h3','Soạn email gửi đơn vị cấp đơn'),node('p','Chọn loại thư, kiểm tra nội dung rồi gửi qua Outlook. Người nhận, CC, thời hạn phản hồi và chân email được điền sẵn.'));
    const grid = node('div',null,'cem-grid');

    // Thẻ 1: thông báo giảm trừ / chế tài (nội dung thiết lập ở mục Giảm trừ trong tab Bồi thường).
    const reduction = card('claimEmailCardReduction',icons.mail,'Thông báo giảm trừ / chế tài','Thông báo mức giảm trừ, căn cứ và số tiền bồi thường sau giảm trừ.');
    const reductionState = typeof ClaimReductionNotice !== 'undefined' ? ClaimReductionNotice.getState() : {};
    const ready = Boolean(reductionState.reason || reductionState.notes);
    const status = node('p',ready ? 'Trạng thái: ' + (reductionState.stage || '—') + ' · ' + (reductionState.impact || 'Đã có ghi nhận') : 'Chưa chọn vi phạm. Thiết lập ở mục Giảm trừ / chế tài trong tab Bồi thường.','cem-status' + (ready ? ' is-ready' : ''));
    const reductionActions = node('div',null,'cem-actions');
    reductionActions.append(actionButton('Thiết lập giảm trừ',() => ClaimReductionNotice.show()),actionButton('Soạn thư',() => ClaimReductionNotice.compose(),true));
    reduction.append(status,reductionActions);

    // Thẻ 2: yêu cầu cung cấp hình ảnh cấp đơn.
    const image = card('claimEmailCardImage',icons.image,'Yêu cầu cung cấp hình ảnh cấp đơn','Đề nghị đơn vị cấp đơn gửi hình ảnh xe và giấy tờ tại thời điểm cấp đơn.');
    const list = node('div',null,'cem-checks'); list.id = 'claimEmailImageItems';
    IMAGE_ITEMS.forEach(([key,label]) => {
      const row = node('label',null,'cem-check'), input = node('input'); input.type = 'checkbox'; input.value = key; input.checked = state.imageRequest.items.includes(key);
      const mark = node('span',null,'cem-check-mark'); mark.setAttribute('aria-hidden','true');
      row.append(input,mark,node('span',label)); list.append(row);
    });
    const noteLabel = node('label','Yêu cầu khác (mỗi dòng một ý)','cem-field-label'), note = node('textarea'); note.id = 'claimEmailImageNote'; note.rows = 2; note.maxLength = 1000; note.value = state.imageRequest.note;
    note.placeholder = 'Ví dụ: Hình ảnh xe trước và sau khi sửa chữa gần nhất'; noteLabel.htmlFor = note.id; note.className = 'input-premium';
    const imageActions = node('div',null,'cem-actions'); imageActions.append(actionButton('Soạn thư',() => ClaimReductionNotice.compose(imageSpec()),true));
    image.append(list,noteLabel,note,imageActions);
    grid.append(reduction,image); pane.append(intro,grid);
  }
  function mount() { render(); }
  return {load,getState,render,mount,buildImageRequest,IMAGE_ITEMS};
})();
