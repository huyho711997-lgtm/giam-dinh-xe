/* Adapt only the remaining reports' native selects to the existing dropdown primitive. */
function enhanceRemainingReportControls(root = document) {
  const shell = root.querySelector?.('.report-pending-premium');
  if (!shell) return;
  const controls = [
    { match: 'activeGarageChartTopN', id: 'ddGarageReportTopMenu', title: 'Số gara hiển thị', subtitle: 'Chọn phạm vi xếp hạng gara' },
    { match: 'activeCarBrandChartTopN', id: 'ddBrandReportTopMenu', title: 'Số hãng xe hiển thị', subtitle: 'Chọn phạm vi thống kê hãng xe' },
    { match: 'setTndsStatusFilter', id: 'ddTndsReportStatusMenu', title: 'Trạng thái hồ sơ', subtitle: 'Chọn trạng thái TNDS cần theo dõi', search: 'Tìm trạng thái...' }
  ];
  shell.querySelectorAll('select').forEach(select => {
    if (select.dataset.rpSelectReady === '1') return;
    const config = controls.find(item => (select.getAttribute('onchange') || '').includes(item.match));
    if (!config) return;
    TON_REPORT_DROPDOWNS[config.id] = config;
    const host = document.createElement('div');
    host.className = 'custom-select-wrapper rp-select-host';
    select.before(host);
    host.appendChild(select);
    select.dataset.rpSelectReady = '1';
    select.hidden = true;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger rp-select-trigger';
    trigger.disabled = select.disabled;
    const label = document.createElement('span');
    label.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-linecap="round"/></svg>';
    const labelText = document.createElement('span');
    labelText.textContent = select.selectedOptions[0]?.textContent || config.title;
    label.appendChild(labelText);
    trigger.appendChild(label);
    trigger.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>');
    trigger.addEventListener('click', event => toggleCustomDropdownMenu(config.id, event));
    const menu = document.createElement('div');
    menu.id = config.id;
    menu.className = 'custom-select-menu';
    menu.style.display = 'none';
    Array.from(select.options).forEach(option => {
      const item = document.createElement('div');
      item.className = 'custom-select-item' + (option.selected ? ' active' : '');
      const text = document.createElement('span');
      text.textContent = option.textContent;
      item.appendChild(text);
      item.disabled = option.disabled;
      if (option.disabled) item.setAttribute('aria-disabled', 'true');
      item.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (option.disabled || select.disabled) return;
        activeOpenDropdownId = null;
        menu.style.display = 'none';
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      menu.appendChild(item);
    });
    host.append(trigger, menu);
  });
  enhanceTonReportDropdowns(shell);
}

function prepareRemainingReportImageClone(target, width) {
  target.style.width = width + 'px';
  target.style.maxWidth = 'none';
  target.style.setProperty('overflow', 'visible', 'important');
  target.style.setProperty('box-shadow', 'none', 'important');
  target.querySelectorAll('.rp-table-scroll, div[style*="overflow-x"]').forEach(scroll => {
    scroll.style.setProperty('overflow', 'visible', 'important');
    scroll.style.width = '100%';
    scroll.scrollLeft = 0;
  });
}
