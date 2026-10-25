
function closeAdminSelect(returnFocus = false) {
  if (!activeAdminSelect) return;
  const widget = activeAdminSelect;
  activeAdminSelect = null;
  widget.menu.remove();
  widget.dialog?.removeAttribute('aria-owns');
  widget.trigger.setAttribute('aria-expanded', 'false');
  if (returnFocus && widget.trigger.isConnected) widget.trigger.focus();
}

function syncAdminSelects(root = document) {
  root.querySelectorAll('#systemAdminSubTabContainer select, #createUserModalOverlay select, #editUserModalOverlay select, .accounting-transfer-register select[data-premium-select], .inspection-register select[data-premium-select]').forEach(select => {
    let widget = adminSelectWidgets.get(select);
    if (!widget) {
      const wrapper = document.createElement('div');
      wrapper.className = 'admin-select';
      select.before(wrapper);
      wrapper.append(select);
      select.classList.add('admin-select-native');
      select.tabIndex = -1;
      select.setAttribute('aria-hidden', 'true');
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'admin-select-trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      const menuId = 'adminSelectMenu' + (++adminSelectSequence);
      trigger.setAttribute('aria-controls', menuId);
      const fieldLabel = select.labels?.[0]?.textContent || select.getAttribute('aria-label') || select.parentElement.parentElement.querySelector('label')?.textContent || 'Chọn giá trị';
      trigger.setAttribute('aria-label', fieldLabel.replace(/[:*()]/g, '').trim());
      const menu = document.createElement('div');
      menu.id = menuId;
      menu.className = 'admin-select-menu';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', trigger.getAttribute('aria-label'));
      widget = { select, wrapper, trigger, menu };
      adminSelectWidgets.set(select, widget);
      wrapper.append(trigger);
      trigger.addEventListener('click', () => activeAdminSelect === widget ? closeAdminSelect() : openAdminSelect(widget));
      trigger.addEventListener('keydown', event => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
          event.preventDefault();
          openAdminSelect(widget, event.key === 'ArrowUp' ? -1 : 1);
        }
      });
      select.addEventListener('change', () => refreshAdminSelect(widget));
      new MutationObserver(() => refreshAdminSelect(widget)).observe(select, { attributes:true, childList:true, subtree:true });
    }
    refreshAdminSelect(widget);
  });
}

function refreshAdminSelect(widget) {
  const selected = widget.select.selectedOptions[0];
  const signature = String(widget.select.selectedIndex) + '|' + String(widget.select.disabled) + '|' + (selected?.textContent || '');
  if (widget.signature === signature) return;
  widget.signature = signature;
  widget.trigger.replaceChildren();
  const label = document.createElement('span');
  label.className = 'admin-select-label';
  label.textContent = selected?.textContent || 'Chọn giá trị';
  widget.trigger.append(label);
  widget.trigger.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');
  widget.trigger.disabled = widget.select.disabled;
}

function openAdminSelect(widget, direction = 1) {
  if (widget.select.disabled) return;
  closeAdminSelect();
  refreshAdminSelect(widget);
  widget.menu.replaceChildren();
  Array.from(widget.select.options).forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-select-option';
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(index === widget.select.selectedIndex));
    button.tabIndex = -1;
    button.disabled = option.disabled || option.parentElement?.disabled || false;
    button.hidden = option.hidden;
    const text = document.createElement('span');
    text.textContent = option.textContent;
    button.append(text);
    if (index === widget.select.selectedIndex) button.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>');
    button.addEventListener('click', () => {
      widget.select.selectedIndex = index;
      refreshAdminSelect(widget);
      closeAdminSelect(true);
      widget.select.dispatchEvent(new Event('input', { bubbles:true }));
      widget.select.dispatchEvent(new Event('change', { bubbles:true }));
    });
    widget.menu.append(button);
  });
  // Portal avoids the panel's transforms and clipping; aria-owns keeps dialog semantics.
  widget.dialog = widget.trigger.closest('[role="dialog"]');
  widget.dialog?.setAttribute('aria-owns', widget.menu.id);
  document.body.append(widget.menu);
  const rect = widget.trigger.getBoundingClientRect();
  const menuHeight = Math.min(280, widget.menu.scrollHeight);
  const below = window.innerHeight - rect.bottom - 16;
  const above = rect.top - 16;
  const upward = below < menuHeight && above > below;
  const available = Math.max(50, upward ? above : below);
  widget.menu.style.width = Math.min(rect.width, window.innerWidth - 24) + 'px';
  widget.menu.style.maxHeight = Math.min(280, available) + 'px';
  widget.menu.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - rect.width - 12)) + 'px';
  widget.menu.style.top = (upward ? Math.max(12, rect.top - Math.min(menuHeight, available) - 7) : rect.bottom + 7) + 'px';
  widget.trigger.setAttribute('aria-expanded', 'true');
  activeAdminSelect = widget;
  const buttons = Array.from(widget.menu.querySelectorAll('button:not(:disabled):not([hidden])'));
  const selected = buttons.find(button => button.getAttribute('aria-selected') === 'true');
  (selected || (direction < 0 ? buttons[buttons.length - 1] : buttons[0]))?.focus({ preventScroll:true });
  let searchText = '', searchTime = 0;
  widget.menu.onkeydown = event => {
    const current = buttons.indexOf(document.activeElement);
    let next = current;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeAdminSelect(true); return; }
    if (event.key === 'Tab') { closeAdminSelect(true); return; }
    if (event.key === 'ArrowDown') next = (current + 1) % buttons.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey) {
      const now = Date.now();
      searchText = (now - searchTime < 700 ? searchText : '') + event.key.toLocaleLowerCase('vi');
      searchTime = now;
      next = buttons.findIndex(button => button.textContent.toLocaleLowerCase('vi').startsWith(searchText));
      if (next < 0) return;
    } else return;
    event.preventDefault(); buttons[next]?.focus({ preventScroll:true }); buttons[next]?.scrollIntoView({ block:'nearest' });
  };
}

function readUserPhone(inputId) {
  const input = document.getElementById(inputId);
  const phone = String(input?.value || '').trim();
  const digits = phone.replace(/\D/g, '');
  if (phone && (!/^\+?[\d\s().-]+$/.test(phone) || digits.length < 8 || digits.length > 15)) {
    triggerToast('Số điện thoại cần có 8–15 chữ số, có thể bắt đầu bằng + và mã quốc gia.', 'warning');
    input?.focus();
    return null;
  }
  return phone;
}


function refreshPermissionSummary(prefix) {
  const form = document.getElementById(prefix === 'new' ? 'createUserModalOverlay' : 'editUserModalOverlay');
  if (!form) return;
  const controls = Array.from(form.querySelectorAll('.permission-matrix input[type="checkbox"]'));
  const selected = controls.filter(input => input.checked).length;
  const count = document.getElementById(prefix + 'PermissionCount');
  if (count) count.textContent = selected + ' / ' + controls.length + ' quyền đã chọn';
  const tabBadge = document.getElementById(prefix + 'PermissionTabBadge');
  if (tabBadge) tabBadge.textContent = selected + '/' + controls.length;
  const note = document.getElementById(prefix + 'PermissionAdminNote');
  if (note) note.hidden = document.getElementById(prefix + 'AdminRole')?.value !== 'Admin';
}

function setAllFormPermissions(prefix, checked) {
  const form = document.getElementById(prefix === 'new' ? 'createUserModalOverlay' : 'editUserModalOverlay');
  form?.querySelectorAll('.permission-matrix input[type="checkbox"]').forEach(input => { input.checked = Boolean(checked); });
  refreshPermissionSummary(prefix);
}

function resetPermissionPreset(prefix) {
  const role = document.getElementById(prefix + 'AdminRole')?.value || 'Giám định viên';
  setFormUserPermissions(prefix, null, role);
}
