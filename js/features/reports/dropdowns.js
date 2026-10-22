const tonReportDropdownState = { queries: new Map(), listening: false, frame: null };
const TON_REPORT_DROPDOWNS = {
  ddReportGdvMenu: { title: 'Giám định viên', subtitle: 'Chọn một hoặc nhiều cán bộ xử lý', search: 'Tìm giám định viên...', multi: true },
  ddReportGaraMenu: { title: 'Gara sửa chữa', subtitle: 'Chọn gara cần theo dõi', search: 'Tìm tên gara...' },
  ddReportDaysRangeMenu: { title: 'Thời gian đã duyệt', subtitle: 'Tính từ ngày phê duyệt HSBT' },
  ddReportClaimTypeMenu: { title: 'Loại hồ sơ', subtitle: 'Lọc theo nghiệp vụ bảo hiểm' },
  ddReportMonthMenu: { title: 'Tháng báo cáo', subtitle: 'Chọn tháng duyệt hồ sơ' },
  ddReportYearMenu: { title: 'Năm báo cáo', subtitle: 'Chọn năm duyệt hồ sơ' },
  ddReportViewSelectorMenu: { title: 'Chọn báo cáo', subtitle: 'Các góc nhìn báo cáo nghiệp vụ', search: 'Tìm báo cáo...', width: 380 },
  ddReportFavFiltersMenu: { title: 'Bộ lọc ưa thích', subtitle: 'Lưu và mở nhanh bộ lọc của bạn', width: 360, mode: 'favorites' },
  ddExportOptions: { title: 'Tải báo cáo Excel', subtitle: 'Chọn nội dung cần xuất', mode: 'actions', action: true },
  ddTonColsMenu: { title: 'Cột hiển thị', subtitle: 'Tùy chỉnh thông tin trong danh sách', multi: true, mode: 'columns' },
  ddTonImageExportMenu: { title: 'Xuất ảnh báo cáo', subtitle: 'Chọn phạm vi hồ sơ cần tải', mode: 'actions', action: true }
};

function normalizeTonDropdownText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function getTonDropdownOptions(menu) {
  return Array.from(menu.querySelectorAll('.ton-dropdown-option')).filter(item => !item.hidden && !item.disabled);
}

function syncTonReportDropdownState() {
  document.querySelectorAll('.ton-dropdown').forEach(menu => {
    const trigger = menu.parentElement.querySelector(':scope > button');
    const open = menu.style.display === 'block';
    menu.parentElement.classList.toggle('ton-dropdown-host--open', open);
    if (trigger) {
      trigger.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
    }
  });
}

function closeTonReportDropdown(menu, restoreFocus = false) {
  menu.style.display = 'none';
  if (typeof activeOpenDropdownId !== 'undefined' && activeOpenDropdownId === menu.id) activeOpenDropdownId = null;
  syncTonReportDropdownState();
  if (restoreFocus) menu.parentElement.querySelector(':scope > button')?.focus({ preventScroll: true });
}

function positionTonReportDropdown(menu, trigger) {
  if (!menu || !trigger || !menu.isConnected || menu.style.display !== 'block') return;
  const config = TON_REPORT_DROPDOWNS[menu.id];
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.visualViewport ? Math.min(window.innerHeight, window.visualViewport.height) : window.innerHeight;
  const width = Math.min(config.width || 340, viewportWidth - 24);
  const parentRect = menu.parentElement.getBoundingClientRect();
  const rect = trigger.getBoundingClientRect();
  const alignEnd = config.action || config.mode === 'favorites' || menu.id === 'ddReportViewSelectorMenu' || config.mode === 'columns';
  const preferredLeft = alignEnd ? rect.right - width : rect.left;
  const left = Math.max(12, Math.min(preferredLeft, viewportWidth - width - 12));
  menu.style.setProperty('width', width + 'px', 'important');
  menu.style.setProperty('left', left - parentRect.left + 'px', 'important');
  menu.style.setProperty('right', 'auto', 'important');

  const body = menu.querySelector('.ton-dropdown-body');
  const below = Math.max(0, viewportHeight - rect.bottom - 20);
  const above = Math.max(0, rect.top - 20);
  const showAbove = below < 240 && above > below;
  const available = Math.min(460, showAbove ? above : below);
  const chrome = menu.offsetHeight - body.offsetHeight;
  body.style.setProperty('max-height', Math.max(64, available - chrome) + 'px', 'important');
  const top = showAbove ? rect.top - parentRect.top - menu.offsetHeight - 8 : rect.bottom - parentRect.top + 8;
  menu.style.setProperty('top', top + 'px', 'important');
  menu.style.setProperty('bottom', 'auto', 'important');
}

function openTonReportDropdown(menu, trigger, event) {
  syncTonReportDropdownState();
  positionTonReportDropdown(menu, trigger);
  const body = menu.querySelector('.ton-dropdown-body');
  const selected = body.querySelector('.is-selected, .is-active, .active, input:checked');
  if (selected) {
    const itemRect = selected.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    if (itemRect.top < bodyRect.top || itemRect.bottom > bodyRect.bottom) body.scrollTop += itemRect.top - bodyRect.top - 8;
  }
  const search = menu.querySelector('.ton-dropdown-search input');
  if (search && (window.innerWidth > 760 || event?.type === 'keydown')) search.focus({ preventScroll: true });
}

function enhanceTonReportDropdowns(root = document) {
  const shell = root.matches?.('.gdv-report-premium-shell') ? root : root.querySelector('.gdv-report-premium-shell:has(.ton-report-card)');
  if (!shell || !shell.querySelector('.ton-report-card')) return;
  shell.querySelectorAll('.custom-select-menu').forEach(menu => {
    const config = TON_REPORT_DROPDOWNS[menu.id];
    if (!config || (menu.dataset.tonReady === '1' && menu.querySelector(':scope > .ton-dropdown-head'))) return;
    const trigger = menu.parentElement.querySelector(':scope > button');
    if (!trigger) return;
    const display = menu.style.display || 'none';
    menu.removeAttribute('style');
    menu.style.display = display;
    menu.style.setProperty('min-width', '0', 'important');
    menu.classList.add('ton-dropdown');
    menu.dataset.tonReady = '1';
    menu.dataset.tonMode = config.mode || (config.multi ? 'multiple' : 'single');
    trigger.classList.add('ton-dropdown-trigger');
    trigger.classList.toggle('ton-dropdown-trigger--action', Boolean(config.action));
    const chevron = trigger.querySelector(':scope > svg:last-child');
    if (chevron?.querySelector('polyline[points="6 9 12 15 18 9"]')) chevron.classList.add('ton-dropdown-chevron');
    trigger.setAttribute('aria-controls', menu.id);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', String(display === 'block'));
    trigger.title = trigger.textContent.trim();

    let tools = menu.querySelector(':scope > .report-filter-gdv-toolbar');
    if (config.mode === 'columns') {
      tools = menu.firstElementChild;
      tools.querySelector(':scope > span')?.remove();
    }
    menu.querySelector(':scope > .report-filter-menu-head')?.remove();
    let body = menu.querySelector(':scope > .report-filter-menu-body, :scope > .report-filter-check-list, :scope > .report-picker__body');
    if (!body) {
      body = document.createElement('div');
      Array.from(menu.childNodes).forEach(node => { if (node !== tools) body.appendChild(node); });
    }
    body.classList.add('ton-dropdown-body');
    menu.appendChild(body);
    if (tools) {
      tools.classList.add('ton-dropdown-tools');
      menu.insertBefore(tools, body);
    }

    const head = document.createElement('div');
    head.className = 'ton-dropdown-head';
    const icon = document.createElement('span');
    icon.className = 'ton-dropdown-icon';
    const svg = trigger.querySelector('svg');
    if (svg) icon.appendChild(svg.cloneNode(true));
    const copy = document.createElement('div');
    copy.className = 'ton-dropdown-head-copy';
    const title = document.createElement('strong');
    title.id = menu.id + 'Title';
    title.textContent = config.title;
    const subtitle = document.createElement('span');
    subtitle.textContent = config.subtitle;
    copy.append(title, subtitle);
    head.append(icon, copy);
    menu.prepend(head);
    menu.setAttribute('aria-labelledby', title.id);
    menu.setAttribute('role', 'dialog');
    menu.removeAttribute('aria-multiselectable');
    body.setAttribute('role', config.multi || config.mode === 'favorites' ? 'group' : config.mode === 'actions' ? 'menu' : 'listbox');
    body.setAttribute('aria-labelledby', title.id);

    const options = Array.from(body.querySelectorAll('.custom-select-item, .report-filter-check-item, .report-picker__item, .ton-favorite-apply, label'));
    options.forEach(item => {
      item.classList.add('ton-dropdown-option');
      const checked = Boolean(item.querySelector('input:checked'));
      const selected = checked || item.classList.contains('active') || item.classList.contains('is-active') || item.classList.contains('is-selected');
      item.classList.toggle('is-selected', selected);
      item.tabIndex = -1;
      if (!config.multi) {
        item.setAttribute('role', config.mode === 'favorites' ? 'button' : config.mode ? 'menuitem' : 'option');
        if (!config.mode) item.setAttribute('aria-selected', String(selected));
      }
      if (!config.multi && !config.mode) {
        const oldCheck = item.lastElementChild;
        if (oldCheck?.tagName.toLowerCase() === 'svg' && oldCheck.querySelector('polyline[points="20 6 9 17 4 12"]')) oldCheck.remove();
        const mark = document.createElement('span');
        mark.className = 'ton-option-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.innerHTML = '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 10 4 4 8-8"/></svg>';
        item.appendChild(mark);
      }
      item.dataset.tonSearch = normalizeTonDropdownText(item.textContent);
    });
    if (config.multi) {
      const count = document.createElement('span');
      count.className = 'ton-dropdown-selection-count';
      count.textContent = options.filter(item => item.classList.contains('is-selected')).length + '/' + options.length;
      head.appendChild(count);
    }

    if (config.search) {
      const search = document.createElement('div');
      search.className = 'ton-dropdown-search';
      search.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>';
      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = config.search;
      input.setAttribute('aria-label', config.search.replace(/\.+$/, ''));
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.value = tonReportDropdownState.queries.get(menu.id) || '';
      const count = document.createElement('span');
      count.className = 'ton-dropdown-search-count';
      const empty = document.createElement('div');
      empty.className = 'ton-dropdown-empty';
      empty.textContent = 'Không tìm thấy kết quả phù hợp';
      body.appendChild(empty);
      search.append(input, count);
      menu.insertBefore(search, tools || body);
      const filter = () => {
        const query = normalizeTonDropdownText(input.value);
        let visible = 0;
        options.forEach(item => { item.hidden = !item.dataset.tonSearch.includes(query); if (!item.hidden) visible++; });
        empty.hidden = visible > 0;
        count.textContent = visible + '/' + options.length;
        tonReportDropdownState.queries.set(menu.id, input.value);
        if (menu.style.display === 'block') positionTonReportDropdown(menu, trigger);
      };
      input.addEventListener('input', filter);
      filter();
    }

    if (config.mode === 'favorites') {
      body.classList.add('ton-dropdown-favorites');
      const form = body.querySelector('#txtNewFavFilterName')?.parentElement;
      form?.classList.add('ton-favorite-form');
      if (form) {
        form.previousElementSibling?.classList.add('ton-favorite-heading');
        form.nextElementSibling?.classList.add('ton-favorite-heading');
        form.nextElementSibling?.nextElementSibling?.classList.add('ton-favorite-list');
      }
    }

    if (!trigger.dataset.tonKeyboardBound) trigger.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      if (menu.style.display !== 'block') toggleCustomDropdownMenu(menu.id, event);
      const list = getTonDropdownOptions(menu);
      (event.key === 'ArrowUp' ? list[list.length - 1] : list[0])?.focus({ preventScroll: true });
    });
    trigger.dataset.tonKeyboardBound = '1';
    if (!menu.dataset.tonEventsBound) menu.addEventListener('keydown', event => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeTonReportDropdown(menu, true); return; }
      const list = getTonDropdownOptions(menu);
      const current = event.target.closest('.ton-dropdown-option');
      const textInput = event.target.matches('input:not([type="checkbox"])');
      if (['ArrowDown', 'ArrowUp'].includes(event.key) || (!textInput && ['Home', 'End'].includes(event.key))) {
        event.preventDefault();
        const index = list.indexOf(current);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : index < 0 ? (event.key === 'ArrowUp' ? list.length - 1 : 0) : (index + (event.key === 'ArrowUp' ? -1 : 1) + list.length) % list.length;
        list[next]?.focus();
      } else if (current && ['Enter', ' '].includes(event.key) && !event.target.matches('button, input')) {
        event.preventDefault();
        current.click();
      }
    });
    if (!menu.dataset.tonEventsBound) menu.addEventListener('click', () => queueMicrotask(syncTonReportDropdownState));
    menu.dataset.tonEventsBound = '1';
    if (display === 'block') openTonReportDropdown(menu, trigger);
  });
  syncTonReportDropdownState();
  if (!tonReportDropdownState.listening) {
    tonReportDropdownState.listening = true;
    const reposition = event => {
      if (event?.target?.closest?.('.ton-dropdown-body')) return;
      if (tonReportDropdownState.frame) return;
      tonReportDropdownState.frame = requestAnimationFrame(() => {
        tonReportDropdownState.frame = null;
        document.querySelectorAll('.ton-dropdown').forEach(menu => positionTonReportDropdown(menu, menu.parentElement.querySelector(':scope > button')));
      });
    };
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    document.addEventListener('click', event => {
      if (!event.target.closest('.custom-select-wrapper')) document.querySelectorAll('.ton-dropdown').forEach(menu => { if (menu.style.display === 'block') closeTonReportDropdown(menu); });
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') document.querySelectorAll('.ton-dropdown').forEach(menu => { if (menu.style.display === 'block') closeTonReportDropdown(menu, true); });
    });
  }
}
