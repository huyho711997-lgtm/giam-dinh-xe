const ClaimEditorWorkspace = (() => {
  let opened = false, returnFocus = null, historySignature = '';
  const overlay = () => document.getElementById('addPendingClaimModalOverlay');
  function prepareForms() {
    const root = overlay();
    if (!root || root.dataset.premiumReady) return;
    const definitions = {
      Policy:[
        ['Thông tin hồ sơ','Định danh vụ tổn thất, phương tiện và khách hàng.',['MaVuTonThat','SoHoSoBoiThuong','BienSo','SoKhungSoMay','KhachHang']],
        ['Hợp đồng bảo hiểm','Thông tin cấp đơn và thời hạn bảo hiểm.',['SoHd','SoGcn','NguoiCapDon','NgayHieuLuc','NgayHetHan','KenhKhaiThac']],
        ['Giá trị & phí bảo hiểm','Đơn vị tiền tệ: Việt Nam đồng (VNĐ).',['GiaTriXe','SoTienBh','PhiBh']]
      ],
      Vehicle:[['Phương tiện & người liên hệ','Đặc điểm xe, người điều khiển và phạm vi bảo hiểm.']],
      Event:[['Vụ tổn thất & diễn biến','Thời gian, địa điểm và nội dung tổn thất.']],
      Unit:[['Đơn vị & người phụ trách','Thông tin cấp đơn, giám định và gara sửa chữa.']],
      Financial:[['Bồi thường & thanh toán','Theo dõi phê duyệt, dự phòng và các mốc thanh toán.']]
    };
    for (const [tab,groups] of Object.entries(definitions)) {
      const pane = document.getElementById('tabPane_' + tab);
      const originalGrid = pane?.firstElementChild;
      if (!originalGrid) continue;
      const sections = document.createElement('div');
      sections.className = 'claim-editor-sections';
      groups.forEach(([title,description,fields],index) => {
        const card = document.createElement('section');
        card.className = 'claim-editor-form-section';
        const heading = document.createElement('header');
        const badge = document.createElement('span');
        badge.className = 'claim-editor-section-number';
        badge.setAttribute('aria-hidden','true');
        badge.textContent = String(index + 1).padStart(2,'0');
        const copy = document.createElement('div');
        const caption = document.createElement('h4');
        caption.textContent = title;
        const note = document.createElement('p');
        note.textContent = description;
        copy.append(caption,note);
        heading.append(badge,copy);
        const grid = document.createElement('div');
        grid.className = 'claim-editor-form-grid';
        const items = fields ? fields.map(name => document.getElementById('modalPending' + name)?.closest('.form-group')).filter(Boolean) : [...originalGrid.children];
        items.forEach(item => grid.appendChild(item));
        card.append(heading,grid);
        sections.appendChild(card);
      });
      if (originalGrid.children.length) sections.lastElementChild.querySelector('.claim-editor-form-grid').append(...originalGrid.children);
      originalGrid.replaceWith(sections);
    }
    root.querySelectorAll('.form-group').forEach(group => {
      const caption = group.querySelector(':scope > label');
      const input = group.querySelector('input[id],textarea[id],select[id]');
      if (caption && input && !caption.htmlFor) caption.htmlFor = input.id;
    });
    root.dataset.premiumReady = 'true';
  }
  function currentClaim() {
    if (typeof editingPendingClaimId === 'undefined' || !editingPendingClaimId || typeof cachedPendingClaimsPayload === 'undefined') return null;
    return cachedPendingClaimsPayload[editingPendingClaimId] || Object.values(cachedPendingClaimsPayload).find(item => item && [item.id,item.idCa,item.maVuTonThat].includes(editingPendingClaimId)) || null;
  }
  function refreshSummary() {
    const root = overlay();
    if (!root) return;
    root.querySelectorAll('[data-claim-summary]').forEach(element => {
      const value = String(document.getElementById(element.dataset.claimSummary)?.value || '').trim();
      element.textContent = value ? value + (element.hasAttribute('data-claim-money') ? ' ₫' : '') : element.dataset.empty || '—';
    });
    const status = document.getElementById('claimEditorStatus');
    const claim = currentClaim();
    if (status) {
      // Dùng chung bảng màu trạng thái với danh sách hồ sơ (PENDING_STATUS_MAP) để màu khớp nhau ở mọi nơi.
      const map = typeof PENDING_STATUS_MAP !== 'undefined' ? PENDING_STATUS_MAP : {};
      const key = claim && map[claim.trangThai] ? claim.trangThai : 'moi';
      const config = map[key] || {};
      status.textContent = !claim ? 'Hồ sơ mới' : config.label || claim.trangThai || 'Mới';
      status.dataset.status = key;
      status.style.setProperty('--status-color', config.color || '#64748b');
      status.title = 'Trạng thái hồ sơ: ' + status.textContent;
    }
  }
  function refreshNotes() {
    if (!opened) return;
    const container = document.getElementById('claimEditorNoteHistory');
    if (!container) return;
    const claim = currentClaim();
    const identifier = String(claim?.bienSo || claim?.soHoSoBoiThuong || claim?.id || '').replace(/[^a-zA-Z0-9_-]/g,'').toUpperCase();
    const payload = typeof cachedPendingNotesPayload === 'undefined' ? {} : cachedPendingNotesPayload;
    const history = Object.values(payload[identifier]?.history || {}).filter(note => note && typeof note === 'object').sort((first,second) => Number(second.timestamp || 0) - Number(first.timestamp || 0));
    const signature = identifier + JSON.stringify(history);
    if (signature === historySignature) return;
    historySignature = signature;
    const count = document.getElementById('claimEditorNoteCount');
    if (count) count.textContent = String(history.length);
    container.replaceChildren();
    if (!history.length) {
      const empty = document.createElement('p');
      empty.className = 'claim-editor-hint';
      empty.textContent = 'Chưa có ghi chú tiến độ.';
      container.appendChild(empty);
      return;
    }
    history.forEach(note => {
      const entry = document.createElement('article');
      entry.className = 'claim-editor-history-entry';
      const header = document.createElement('header');
      const author = document.createElement('strong');
      author.textContent = note.author || 'Người cập nhật';
      const time = document.createElement('time');
      const date = new Date(Number(note.timestamp));
      if (Number.isFinite(date.getTime())) {
        time.dateTime = date.toISOString();
        time.textContent = date.toLocaleString('vi-VN');
      } else time.textContent = 'Chưa có thời gian cập nhật';
      const content = document.createElement('p');
      content.textContent = note.content || '';
      header.append(author,time);
      entry.append(header,content);
      container.appendChild(entry);
    });
  }
  function showMain() {
    overlay()?.querySelector('.claim-editor-sidebar-toggle')?.setAttribute('aria-expanded','false');
  }
  function open() {
    const root = overlay();
    if (!root) return;
    if (!opened) returnFocus = document.activeElement;
    opened = true;
    historySignature = '';
    document.body.classList.add('claim-editor-open');
    prepareForms();
    ClaimReductionNotice.mount();
    showMain();
    refreshSummary();
    refreshNotes();
    root.querySelectorAll('.claim-editor-sidebar,.claim-editor-content').forEach(element => { element.scrollTop = 0; });
    document.getElementById('addPendingClaimModalTitle')?.focus({preventScroll:true});
  }
  function close() {
    ClaimReductionNotice.close();
    opened = false;
    historySignature = '';
    document.body.classList.remove('claim-editor-open');
    if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus({preventScroll:true});
    returnFocus = null;
  }
  function tabChanged(tabName) {
    const root = overlay();
    if (!root) return;
    root.querySelectorAll('.edit-tab-btn').forEach(button => {
      const selected = button.id === 'tabBtn_' + tabName;
      button.setAttribute('role','tab');
      button.setAttribute('aria-selected',String(selected));
      button.setAttribute('aria-controls',button.id.replace('tabBtn_','tabPane_'));
      button.tabIndex = selected ? 0 : -1;
    });
    root.querySelectorAll('.edit-tab-pane').forEach(pane => {
      pane.setAttribute('role','tabpanel');
      pane.setAttribute('aria-labelledby',pane.id.replace('tabPane_','tabBtn_'));
    });
    const body = root.querySelector('.claim-editor-content');
    if (body) body.scrollTop = 0;
    refreshSummary();
  }
  document.addEventListener('input',event => {
    if (opened && overlay()?.contains(event.target)) refreshSummary();
  });
  document.addEventListener('change',event => {
    if (opened && overlay()?.contains(event.target)) refreshSummary();
  });
  document.addEventListener('keydown',event => {
    const root = overlay();
    if (!opened || event.defaultPrevented || !root?.contains(event.target)) return;
    if (document.getElementById('lightbox')?.classList.contains('show')) return;
    const tab = event.target.closest('.edit-tab-btn');
    if (tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      const buttons = [...root.querySelectorAll('.edit-tab-btn')];
      const position = buttons.indexOf(tab);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (position + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault();
      switchEditClaimTab(buttons[index].id.replace('tabBtn_',''));
      buttons[index].focus({preventScroll:true});
      buttons[index].scrollIntoView({block:'nearest',inline:'nearest'});
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAddPendingClaimModal();
    } else if (event.key === 'Tab') {
      const focusable = [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"],summary')].filter(element => element.tabIndex >= 0 && element.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement.id === 'addPendingClaimModalTitle')) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
  });
  return {open,close,refreshSummary,refreshNotes,tabChanged,showMain,toggleSidebar:button => button.setAttribute('aria-expanded',String(button.getAttribute('aria-expanded') !== 'true'))};
})();
