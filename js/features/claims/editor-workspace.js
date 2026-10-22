const ClaimEditorWorkspace = (() => {
  let opened = false, returnFocus = null, historySignature = '';
  const overlay = () => document.getElementById('addPendingClaimModalOverlay');
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
    if (status) status.textContent = !claim ? 'Hồ sơ mới' : typeof PENDING_STATUS_MAP !== 'undefined' ? PENDING_STATUS_MAP[claim.trangThai]?.label || claim.trangThai || 'Mới' : claim.trangThai || 'Mới';
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
    showMain();
    refreshSummary();
    refreshNotes();
    root.querySelectorAll('.claim-editor-sidebar,.claim-editor-content').forEach(element => { element.scrollTop = 0; });
    document.getElementById('addPendingClaimModalTitle')?.focus({preventScroll:true});
  }
  function close() {
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
