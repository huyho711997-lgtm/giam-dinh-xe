const SharedFormsControls = (() => {
  const widgets = new WeakMap();
  let active = null, sequence = 0, frame = null;
  const paths = {
    folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10H3z"/>',
    file:'<path d="M14 3H6v18h12V7zM14 3v5h5M9 12h6M9 16h6"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    chevron:'<path d="m8 10 4 4 4-4"/>',check:'<path d="m5 12 4 4L19 6"/>',
    sort:'<path d="M4 6h16M4 12h11M4 18h6m7-3 3 3 3-3m-3 3V9"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    refresh:'<path d="M20 7A9 9 0 1 0 21 14M20 3v5h-5"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
    print:'<path d="M7 8V3h10v5M7 17H3V9h18v8h-4M7 14h10v7H7zM17 11h1"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    tag:'<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/>',
    zoom:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.file) + '</svg>';
  const normalize = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().trim();
  function close(returnFocus = false) {
    if (!active) return;
    const widget = active;
    active = null;
    widget.menu.remove();
    widget.trigger.setAttribute('aria-expanded','false');
    if (returnFocus && widget.trigger.isConnected) widget.trigger.focus({preventScroll:true});
  }
  function place() {
    if (!active) return;
    if (!active.trigger.isConnected || active.select.disabled || active.select.hidden) { close(); return; }
    const rect = active.trigger.getBoundingClientRect();
    const width = Math.min(340,document.documentElement.clientWidth - 24);
    const height = window.visualViewport ? Math.min(window.innerHeight,window.visualViewport.height) : window.innerHeight;
    const topEdge = window.visualViewport?.offsetTop || 0;
    const below = height + topEdge - rect.bottom - 20;
    const above = rect.top - topEdge - 20;
    const upward = below < 300 && above > below;
    const space = Math.max(150,Math.min(460,upward ? above : below));
    const menu = active.menu;
    menu.style.width = width + 'px';
    menu.style.maxHeight = space + 'px';
    menu.querySelector('.sf-select-options').style.maxHeight = Math.max(45,space - 140) + 'px';
    menu.style.left = Math.max(12,Math.min(rect.left,document.documentElement.clientWidth - width - 12)) + 'px';
    menu.style.top = (upward ? Math.max(topEdge + 12,rect.top - Math.min(menu.scrollHeight,space) - 8) : rect.bottom + 8) + 'px';
  }
  function schedulePlace() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; place(); });
  }
  function options(widget) {
    return [...widget.menu.querySelectorAll('[role="option"]')].filter(option => !option.hidden && !option.disabled);
  }
  function choose(widget,value) {
    widget.select.value = value;
    refresh(widget);
    close(true);
    widget.select.dispatchEvent(new Event('input',{bubbles:true}));
    widget.select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function renderOptions(widget) {
    const body = widget.menu.querySelector('.sf-select-options');
    const search = widget.menu.querySelector('input');
    const text = normalize(search.value);
    body.replaceChildren();
    let count = 0;
    for (const option of widget.select.options) {
      if (option.hidden || (text && !normalize(option.textContent).includes(text))) continue;
      count++;
      const button = document.createElement('button');
      button.className = 'sf-select-option';
      button.type = 'button';
      button.setAttribute('role','option');
      button.setAttribute('aria-selected',String(option.selected));
      button.disabled = option.disabled || option.parentElement.disabled || false;
      const label = document.createElement('span');
      label.textContent = option.textContent;
      button.appendChild(label);
      if (option.selected) button.insertAdjacentHTML('beforeend',icon('check'));
      button.onclick = () => choose(widget,option.value);
      body.appendChild(button);
    }
    if (!count) {
      const empty = document.createElement('p');
      empty.className = 'sf-select-empty';
      empty.textContent = 'Không tìm thấy lựa chọn phù hợp.';
      body.appendChild(empty);
    }
    if (widget.select.dataset.allowCustom && search.value.trim() && ![...widget.select.options].some(option => normalize(option.textContent) === text)) {
      const create = document.createElement('button');
      create.type = 'button'; create.className = 'sf-select-option sf-select-create'; create.setAttribute('role','option');
      create.textContent = '＋ Thêm phân loại “' + search.value.trim() + '”';
      create.onclick = () => { const option = new Option(search.value.trim(),search.value.trim()); widget.select.add(option); choose(widget,option.value); };
      body.appendChild(create);
    }
    widget.menu.querySelector('[data-sf-option-count]').textContent = count + '/' + widget.select.options.length;
    place();
  }
  function open(widget,keyboard = false) {
    if (widget.select.disabled || widget.select.hidden) return;
    close();
    const menu = widget.menu;
    menu.classList.toggle('sf-menu-dark',!document.body.classList.contains('light-mode'));
    const layer = widget.trigger.closest('dialog[open]') || document.body;
    layer.appendChild(menu);
    active = widget;
    widget.trigger.setAttribute('aria-expanded','true');
    const search = menu.querySelector('input');
    search.value = '';
    renderOptions(widget);
    if (keyboard) search.focus({preventScroll:true});
  }
  function refresh(widget) {
    widget.wrapper.hidden = widget.select.hidden;
    widget.trigger.disabled = widget.select.disabled;
    const text = widget.select.selectedOptions[0]?.textContent || widget.select.dataset.sfLabel || 'Chọn giá trị';
    widget.trigger.querySelector('.sf-select-label').textContent = text;
    widget.trigger.title = text;
    const signature = widget.select.innerHTML + '|' + widget.select.value;
    if (widget.signature !== signature) {
      widget.signature = signature;
      if (active === widget) renderOptions(widget);
    }
  }
  function enhance(root) {
    root.querySelectorAll('select[data-sf-select]').forEach(select => {
      let widget = widgets.get(select);
      if (widget) { refresh(widget); return; }
      const wrapper = document.createElement('span'); wrapper.className = 'sf-select-wrap';
      select.before(wrapper); wrapper.appendChild(select); select.classList.add('sf-select-native'); select.tabIndex = -1; select.setAttribute('aria-hidden','true');
      const title = select.dataset.sfLabel || select.getAttribute('aria-label') || 'Chọn giá trị';
      const description = select.dataset.sfDescription || 'Tìm và chọn giá trị cần sử dụng';
      const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'sf-select-trigger';
      trigger.setAttribute('aria-label',title); trigger.setAttribute('aria-haspopup','dialog'); trigger.setAttribute('aria-expanded','false');
      trigger.innerHTML = '<span class="sf-control-icon">' + icon(select.dataset.sfIcon || 'tag') + '</span><span class="sf-select-label"></span>' + icon('chevron');
      const menu = document.createElement('div'); menu.className = 'sf-select-menu'; menu.id = 'sfSelectMenu' + (++sequence); menu.setAttribute('role','dialog'); menu.setAttribute('aria-label',title);
      trigger.setAttribute('aria-controls',menu.id);
      menu.innerHTML = '<header class="sf-select-head"><span class="sf-control-icon">' + icon(select.dataset.sfIcon || 'tag') + '</span><div><strong></strong><small></small></div></header><label class="sf-select-search">' + icon('search') + '<input type="search" autocomplete="off"><span data-sf-option-count></span></label><div class="sf-select-options" role="listbox"></div>';
      menu.querySelector('strong').textContent = title; menu.querySelector('small').textContent = description;
      menu.querySelector('input').setAttribute('aria-label','Tìm ' + title.toLowerCase()); menu.querySelector('input').placeholder = 'Tìm lựa chọn…';
      menu.querySelector('[role="listbox"]').setAttribute('aria-label',title);
      widget = {select,wrapper,trigger,menu}; widgets.set(select,widget); wrapper.appendChild(trigger);
      trigger.onclick = event => active === widget ? close() : open(widget,event.detail === 0);
      trigger.onkeydown = event => { if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); open(widget,true); } };
      menu.querySelector('input').oninput = () => renderOptions(widget);
      menu.onkeydown = event => {
        if (event.defaultPrevented) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
        if (event.key === 'Tab') { close(true); return; }
        const search = menu.querySelector('input');
        const buttons = options(widget);
        if (event.key === 'Enter' && document.activeElement === search) { event.preventDefault(); buttons[0]?.click(); return; }
        const index = buttons.indexOf(document.activeElement);
        if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
          if (document.activeElement === search && ['Home','End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
          buttons[next]?.focus({preventScroll:true}); buttons[next]?.scrollIntoView({block:'nearest'});
        }
      };
      select.addEventListener('change',() => refresh(widget));
      new MutationObserver(() => refresh(widget)).observe(select,{attributes:true,childList:true,subtree:true});
      refresh(widget);
    });
  }
  document.addEventListener('pointerdown',event => { if (active && !active.menu.contains(event.target) && !active.trigger.contains(event.target)) close(); });
  document.addEventListener('scroll',event => { if (active && !active.menu.contains(event.target)) schedulePlace(); },true);
  window.addEventListener('resize',schedulePlace);
  window.visualViewport?.addEventListener('resize',schedulePlace);
  window.visualViewport?.addEventListener('scroll',schedulePlace);
  return {enhance,close,icon};
})();
