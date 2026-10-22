/* One popover structure for the pending register's existing filter handlers. */
const pendingDropdownUI = { queries: new Map(), scroll: new Map(), listening: false, frame: null };
const PENDING_DROPDOWN_UI = {
  menuCustomStatusDropdown: { title: 'Trạng thái hồ sơ', subtitle: 'Chọn một hoặc nhiều trạng thái', multi: true, search: 'Tìm trạng thái...' },
  menuCustomCoverageDropdown: { title: 'Phạm vi bảo hiểm', subtitle: 'Chọn nghiệp vụ cần theo dõi' },
  menuCustomGdvDropdown: { title: 'Giám định viên', subtitle: 'Chọn một hoặc nhiều cán bộ xử lý', multi: true, search: 'Tìm giám định viên...' },
  menuCustomPeriodDropdown: { title: 'Khoảng thời gian', subtitle: 'Chọn kỳ theo dõi hồ sơ' },
  menuCustomPerPageDropdown: { title: 'Số dòng hiển thị', subtitle: 'Số hồ sơ trên mỗi trang', width: 260 }
};

function capturePendingDropdownFocus() {
  const active = document.activeElement;
  const menu = active?.closest('.pending-workspace .pending-filter-menu');
  const item = active?.closest('.pending-filter-option');
  return menu && item ? { id: menu.id, label: item.querySelector('.pending-filter-option__label')?.textContent } : null;
}

function positionPendingRegisterDropdown(menu) {
  if (menu.style.display !== 'block' || !menu.isConnected) return;
  const config = PENDING_DROPDOWN_UI[menu.id];
  if (!config) return;
  const parent = menu.parentElement;
  const trigger = parent.querySelector('.pending-filter-trigger');
  const rect = trigger.getBoundingClientRect(), parentRect = parent.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.visualViewport ? Math.min(window.innerHeight, window.visualViewport.height) : window.innerHeight;
  const width = Math.min(config.width || 340, vw - 24);
  const end = menu.classList.contains('pending-filter-menu--right');
  const left = Math.max(12, Math.min(end ? rect.right - width : rect.left, vw - width - 12));
  menu.style.width = width + 'px';
  menu.style.left = left - parentRect.left + 'px';
  menu.style.right = 'auto';
  const body = menu.querySelector('.pending-dropdown-body');
  const below = Math.max(0, vh - rect.bottom - 20), above = Math.max(0, rect.top - 20);
  const upwards = below < 240 && above > below;
  const chrome = menu.offsetHeight - body.offsetHeight;
  body.style.maxHeight = Math.max(48, Math.min(460, upwards ? above : below) - chrome) + 'px';
  menu.style.top = (upwards ? rect.top - menu.offsetHeight - 8 : rect.bottom + 8) - parentRect.top + 'px';
  menu.style.bottom = 'auto';
}

function togglePendingRegisterDropdown(id, event) {
  event?.stopPropagation();
  const menu = document.getElementById(id);
  if (!menu) return;
  const open = menu.style.display === 'block';
  closeAllCustomDropdowns();
  if (open) return;
  enhancePendingRegisterDropdowns();
  menu.style.display = 'block';
  menu.parentElement.classList.add('is-open');
  const trigger = menu.parentElement.querySelector('.pending-filter-trigger');
  trigger.setAttribute('aria-expanded', 'true');
  positionPendingRegisterDropdown(menu);
  const search = menu.querySelector('input');
  if (search && (window.innerWidth > 760 || event?.type === 'keydown')) search.focus({ preventScroll: true });
  else if (event?.detail === 0 || event?.type === 'keydown') (menu.querySelector('.selected') || menu.querySelector('.pending-filter-option'))?.focus({ preventScroll: true });
}

function enhancePendingRegisterDropdowns(focus = null) {
  const root = document.querySelector('.pending-workspace');
  if (!root) return;
  root.querySelectorAll('.pending-filter-menu').forEach(menu => {
    const config = PENDING_DROPDOWN_UI[menu.id];
    if (!config || menu.querySelector(':scope > .pending-dropdown-body')) return;
    const trigger = menu.parentElement.querySelector('.pending-filter-trigger');
    trigger.setAttribute('aria-controls', menu.id);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', String(menu.style.display === 'block'));
    const items = Array.from(menu.querySelectorAll('.pending-filter-option'));
    const body = document.createElement('div');
    body.className = 'pending-dropdown-body';
    body.setAttribute('role', 'listbox');
    body.setAttribute('aria-label', config.title);
    if (config.multi) body.setAttribute('aria-multiselectable', 'true');
    items.forEach(item => { item.setAttribute('role', 'option'); item.tabIndex = -1; if (config.multi) { const check = item.querySelector('.pending-filter-option__check'); if (check) item.querySelector('.pending-filter-option__main')?.prepend(check); } body.appendChild(item); });
    const head = document.createElement('div');
    head.className = 'pending-dropdown-head';
    const icon = trigger.querySelector('.pending-filter-trigger__icon')?.cloneNode(true);
    if (icon) { icon.className = 'pending-dropdown-symbol'; head.appendChild(icon); }
    const copy = document.createElement('div');
    const title = document.createElement('strong'), subtitle = document.createElement('small');
    title.textContent = config.title; title.id = menu.id + 'Title'; subtitle.textContent = config.subtitle;
    copy.append(title, subtitle); head.appendChild(copy);
    if (config.multi) {
      const count = document.createElement('span'); count.className = 'pending-dropdown-count';
      count.textContent = items.filter(item => item.classList.contains('selected')).length + '/' + items.length;
      head.appendChild(count);
    }
    menu.replaceChildren(head);
    menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-labelledby', title.id);
    menu.removeAttribute('aria-multiselectable');
    menu.classList.toggle('pending-dropdown-multiple', Boolean(config.multi));
    if (config.search) {
      const search = document.createElement('div'); search.className = 'pending-dropdown-search';
      const input = document.createElement('input');
      input.type = 'search'; input.placeholder = config.search; input.autocomplete = 'off'; input.spellcheck = false;
      input.setAttribute('aria-label', config.search); input.value = pendingDropdownUI.queries.get(menu.id) || '';
      const counter = document.createElement('span');
      const empty = document.createElement('div'); empty.className = 'pending-dropdown-empty'; empty.textContent = 'Không tìm thấy kết quả phù hợp';
      body.appendChild(empty);
      const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
      const filter = () => {
        const query = normalize(input.value);
        items.forEach(item => { item.hidden = !normalize(item.querySelector('.pending-filter-option__label')?.textContent || '').includes(query); });
        const visible = items.filter(item => !item.hidden).length;
        counter.textContent = visible + '/' + items.length; empty.hidden = visible > 0;
        pendingDropdownUI.queries.set(menu.id, input.value);
        positionPendingRegisterDropdown(menu);
      };
      input.addEventListener('input', filter);
      search.append(input, counter); menu.appendChild(search); menu.appendChild(body); filter();
    } else menu.appendChild(body);
    body.scrollTop = pendingDropdownUI.scroll.get(menu.id) || 0;
    body.addEventListener('scroll', () => pendingDropdownUI.scroll.set(menu.id, body.scrollTop), { passive: true });
    if (!trigger.dataset.pendingKeyboard) {
      trigger.addEventListener('keydown', event => {
        if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (menu.style.display !== 'block') togglePendingRegisterDropdown(menu.id, event);
        const options = Array.from(menu.querySelectorAll('.pending-filter-option')).filter(item => !item.hidden);
        (event.key === 'ArrowUp' ? options[options.length - 1] : options[0])?.focus({ preventScroll: true });
      });
      trigger.dataset.pendingKeyboard = '1';
    }
    if (!menu.dataset.pendingKeyboard) {
      menu.addEventListener('keydown', event => {
        // These menus own their key handling; the legacy document listener must
        // not move focus a second time or intercept Home/End in the search field.
        if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation(); closeAllCustomDropdowns(); trigger.focus({ preventScroll: true }); return;
        }
        const input = event.target.matches('input');
        if (['ArrowDown', 'ArrowUp'].includes(event.key) || (!input && ['Home', 'End'].includes(event.key))) {
          event.preventDefault(); event.stopPropagation();
          const options = Array.from(menu.querySelectorAll('.pending-filter-option')).filter(item => !item.hidden && !item.disabled);
          if (!options.length) return;
          const index = options.indexOf(event.target.closest('.pending-filter-option'));
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : index < 0 ? (event.key === 'ArrowUp' ? options.length - 1 : 0) : (index + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
          options[next]?.focus({ preventScroll: true });
        } else if (input && ['Home', 'End'].includes(event.key)) event.stopPropagation();
      });
      menu.addEventListener('click', event => {
        if (config.multi || !event.target.closest('.pending-filter-option')) return;
        queueMicrotask(() => document.getElementById(trigger.id)?.focus({ preventScroll: true }));
      });
      menu.dataset.pendingKeyboard = '1';
    }
    positionPendingRegisterDropdown(menu);
    if (focus?.id === menu.id && menu.style.display === 'block') items.find(item => item.querySelector('.pending-filter-option__label')?.textContent === focus.label)?.focus({ preventScroll: true });
  });
  if (!pendingDropdownUI.listening) {
    pendingDropdownUI.listening = true;
    const reposition = event => {
      if (event?.target?.closest?.('.pending-dropdown-body')) return;
      if (pendingDropdownUI.frame) return;
      pendingDropdownUI.frame = requestAnimationFrame(() => {
        pendingDropdownUI.frame = null;
        document.querySelectorAll('.pending-workspace .pending-filter-menu').forEach(positionPendingRegisterDropdown);
      });
    };
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
  }
}
