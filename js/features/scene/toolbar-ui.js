// Thanh công cụ vẽ sơ đồ: thu gọn/mở từng mục (nhớ lựa chọn), ô tìm công cụ, mục "Dùng gần đây".
// Chỉ thao tác giao diện; không đổi dữ liệu bản vẽ. Dùng chung cho index.html và so-do-hien-truong.html.
(function (root) {
  'use strict';

  const SECTIONS_KEY = 'sceneToolRail.collapsed.v1';
  // "Thao tác" chỉ có nút Chọn nên không cho thu gọn.
  const LOCKED_SECTIONS = ['Thao tác'];

  function normalizeLabel(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  // Tách danh sách phần tử con của thanh công cụ thành các mục: mỗi mục bắt đầu bằng nhãn,
  // kết thúc ở vạch ngăn hoặc nhãn kế tiếp. kindOf(node) trả về 'label' | 'separator' | 'item'.
  function buildSections(nodes, kindOf, labelOf) {
    const sections = [];
    let current = null;
    for (const node of nodes) {
      const kind = kindOf(node);
      if (kind === 'label') {
        current = { label: normalizeLabel(labelOf(node)), labelNode: node, items: [] };
        sections.push(current);
      } else if (kind === 'separator') {
        current = null;
      } else if (current) {
        current.items.push(node);
      }
    }
    return sections;
  }

  function parseCollapsed(raw) {
    try {
      const value = JSON.parse(raw);
      return Array.isArray(value) ? value.filter(x => typeof x === 'string' && x).slice(0, 40) : [];
    } catch (error) {
      return [];
    }
  }

  function readStored() {
    try { return parseCollapsed(root.localStorage.getItem(SECTIONS_KEY)); } catch (error) { return []; }
  }

  function writeStored(list) {
    try { root.localStorage.setItem(SECTIONS_KEY, JSON.stringify(list)); } catch (error) { /* bộ nhớ bị chặn: bỏ qua */ }
  }

  function isLocked(label) {
    return LOCKED_SECTIONS.includes(label);
  }

  function setSectionCollapsed(section, collapsed) {
    section.labelNode.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    section.labelNode.classList.toggle('is-collapsed', collapsed);
    for (const item of section.items) item.classList.toggle('scene-section-collapsed', collapsed);
  }

  function initSectionToggles(rail) {
    if (!rail || rail.dataset.sectionsBound === 'true') return [];
    rail.dataset.sectionsBound = 'true';
    const sections = buildSections(
      Array.from(rail.children),
      node => node.classList.contains('scene-tool-section-label') ? 'label'
        : node.classList.contains('scene-tool-separator') ? 'separator' : 'item',
      node => node.textContent
    );
    const stored = new Set(readStored());

    const persist = () => writeStored(sections.filter(s => s.labelNode.classList.contains('is-collapsed')).map(s => s.label));
    const refreshScrollbar = () => {
      if (typeof root.updateSceneRailPremiumScrollbar === 'function' && root.requestAnimationFrame) {
        root.requestAnimationFrame(root.updateSceneRailPremiumScrollbar);
      }
    };

    for (const section of sections) {
      if (isLocked(section.label) || !section.items.length) continue;
      const node = section.labelNode;
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.dataset.collapsible = 'true';
      node.title = 'Nhấp để thu gọn / mở mục "' + section.label + '"';
      setSectionCollapsed(section, stored.has(section.label));
      const toggle = () => {
        setSectionCollapsed(section, !node.classList.contains('is-collapsed'));
        persist();
        refreshScrollbar();
      };
      node.addEventListener('click', toggle);
      node.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }
      });
    }
    refreshScrollbar();
    return sections;
  }


  // ---- Tìm công cụ & "Dùng gần đây" -------------------------------------------------
  const RECENT_KEY = 'sceneToolRail.recent.v1';
  const RECENT_MAX = 5;
  const SEARCH_MAX_RESULTS = 12;

  // Bỏ dấu tiếng Việt + hạ chữ thường để gõ "xe tai" vẫn ra "Xe tải".
  function normalizeSearch(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // groups: TOOL_GROUPS_CONFIG. Mọi từ khoá phải khớp (tên công cụ, mô tả, tên nhóm hoặc mã công cụ).
  // Điểm: tên bắt đầu bằng từ khoá > tên chứa > chỉ khớp mô tả/nhóm; ổn định theo thứ tự khai báo.
  function searchTools(query, groups) {
    const terms = normalizeSearch(query).split(' ').filter(Boolean);
    if (!terms.length || !groups) return [];
    const results = [];
    let order = 0;
    for (const groupId of Object.keys(groups)) {
      const group = groups[groupId];
      for (const tool of group.tools || []) {
        const name = normalizeSearch(tool.name);
        const hay = [name, normalizeSearch(tool.desc), normalizeSearch(group.name), normalizeSearch(tool.id.replace(/_/g, ' '))].join(' | ');
        if (!terms.every(term => hay.includes(term))) { order++; continue; }
        let score = 0;
        for (const term of terms) {
          if (name.startsWith(term) || name.split(' ').some(word => word.startsWith(term))) score += 3;
          else if (name.includes(term)) score += 2;
          else score += 1;
        }
        const phrase = terms.join(' ');
        if (terms.length > 1) score += name === phrase ? 6 : name.startsWith(phrase) ? 4 : name.includes(phrase) ? 2 : 0;
        else if (name === phrase) score += 2;
        results.push({ id: tool.id, name: tool.name, desc: tool.desc || '', groupId, groupName: group.name, score, order: order++ });
      }
    }
    results.sort((a, b) => b.score - a.score || a.order - b.order);
    return results.slice(0, SEARCH_MAX_RESULTS);
  }

  // Giữ vị trí ổn định: công cụ đã có trong danh sách thì không xê dịch (tránh nút nhảy dưới con trỏ).
  function pushRecent(list, id, max) {
    const limit = max || RECENT_MAX;
    const base = Array.isArray(list) ? list.filter(x => typeof x === 'string' && x) : [];
    if (!id || base.includes(id)) return base.slice(0, limit);
    return [id].concat(base).slice(0, limit);
  }

  function parseRecent(raw, isValidId) {
    try {
      const value = JSON.parse(raw);
      if (!Array.isArray(value)) return [];
      const seen = new Set();
      return value.filter(x => {
        if (typeof x !== 'string' || seen.has(x) || (isValidId && !isValidId(x))) return false;
        seen.add(x);
        return true;
      }).slice(0, RECENT_MAX);
    } catch (error) {
      return [];
    }
  }

  // TOOL_GROUPS_CONFIG / TOOL_ICONS_MAP / currentDrawTool khai báo bằng const/let ở script khác
  // nên không nằm trên window; truy cập qua tên toàn cục (typeof an toàn khi chưa nạp).
  function groupsConfig() { return typeof TOOL_GROUPS_CONFIG !== 'undefined' ? TOOL_GROUPS_CONFIG : (root.TOOL_GROUPS_CONFIG || null); }
  function iconsMap() { return typeof TOOL_ICONS_MAP !== 'undefined' ? TOOL_ICONS_MAP : (root.TOOL_ICONS_MAP || {}); }
  function currentTool() { return typeof currentDrawTool !== 'undefined' ? currentDrawTool : root.currentDrawTool; }

  function toolExists(id) {
    const groups = groupsConfig();
    return !!groups && Object.keys(groups).some(key => groups[key].tools.some(tool => tool.id === id));
  }

  function readRecent() {
    try { return parseRecent(root.localStorage.getItem(RECENT_KEY), toolExists); } catch (error) { return []; }
  }

  function writeRecent(list) {
    try { root.localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (error) { /* bỏ qua */ }
  }

  function findTool(id) {
    const groups = groupsConfig() || {};
    for (const key of Object.keys(groups)) {
      const tool = groups[key].tools.find(item => item.id === id);
      if (tool) return { tool, groupId: key, groupName: groups[key].name };
    }
    return null;
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function chooseTool(id) {
    if (!findTool(id) || typeof root.setActiveDrawTool !== 'function') return;
    root.setActiveDrawTool(id);
    recordTool(id);
  }

  function renderRecent() {
    const doc = root.document;
    const box = doc && doc.getElementById('sceneRecentTools');
    if (!box) return;
    const label = doc.getElementById('sceneRecentLabel');
    const list = readRecent();
    box.innerHTML = '';
    box.hidden = !list.length;
    if (label) label.hidden = !list.length;
    const baseStyle = (doc.getElementById('toolBtnSelect') || {}).getAttribute
      ? doc.getElementById('toolBtnSelect').getAttribute('style') : '';
    for (const id of list) {
      const found = findTool(id);
      if (!found) continue;
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'draw-tool-btn scene-recent-btn';
      btn.dataset.tool = id;
      btn.title = found.tool.name + ' — ' + found.groupName + ' (dùng gần đây)';
      if (baseStyle) btn.setAttribute('style', baseStyle);
      btn.innerHTML = (iconsMap()[id] || '') +
        '<span class="tool-rail-label">' + escapeHtml(found.tool.name) + '</span>';
      btn.addEventListener('click', () => { if (typeof root.closeAllToolSubmenus === 'function') root.closeAllToolSubmenus(); chooseTool(id); });
      box.appendChild(btn);
    }
    if (typeof currentTool() === 'string') {
      const active = box.querySelector('[data-tool="' + currentTool() + '"]');
      if (active) { active.style.border = '1px solid var(--primary)'; active.style.background = 'rgba(216,180,109,0.15)'; active.classList.add('active'); }
    }
    if (typeof root.updateSceneRailPremiumScrollbar === 'function' && root.requestAnimationFrame) root.requestAnimationFrame(root.updateSceneRailPremiumScrollbar);
  }

  // Gọi khi người dùng chủ động chọn một công cụ trong nhóm (menu con, phím tắt, ô tìm kiếm).
  function recordTool(id) {
    if (!findTool(id)) return;
    const before = readRecent();
    const after = pushRecent(before, id, RECENT_MAX);
    if (after.join('|') !== before.join('|')) writeRecent(after);
    renderRecent();
  }

  let searchState = null;

  function closeSearch() {
    const panel = root.document && root.document.getElementById('sceneToolSearchPanel');
    if (panel) panel.hidden = true;
    searchState = null;
  }

  function renderSearchResults() {
    const doc = root.document;
    const panel = doc.getElementById('sceneToolSearchPanel');
    const list = panel.querySelector('.scene-tool-search-list');
    const input = panel.querySelector('input');
    const query = input.value;
    let items = searchTools(query, groupsConfig());
    let heading = '';
    if (!normalizeSearch(query)) {
      items = readRecent().map(id => findTool(id)).filter(Boolean)
        .map(f => ({ id: f.tool.id, name: f.tool.name, desc: f.tool.desc || '', groupName: f.groupName }));
      heading = items.length ? 'Dùng gần đây' : 'Gõ tên công cụ, ví dụ: xe tải, biển báo, cống';
    } else if (!items.length) {
      heading = 'Không có công cụ khớp "' + query.trim() + '"';
    }
    searchState.items = items;
    searchState.index = Math.min(searchState.index, Math.max(0, items.length - 1));
    list.innerHTML = (heading ? '<div class="scene-tool-search-hint">' + escapeHtml(heading) + '</div>' : '') +
      items.map((item, i) =>
        '<button type="button" role="option" class="scene-tool-search-item' + (i === searchState.index ? ' is-active' : '') + '" data-id="' + escapeHtml(item.id) + '" aria-selected="' + (i === searchState.index) + '">' +
        '<span class="scene-tool-search-icon">' + (iconsMap()[item.id] || '') + '</span>' +
        '<span class="scene-tool-search-text"><b>' + escapeHtml(item.name) + '</b><small>' + escapeHtml(item.groupName) + (item.desc ? ' · ' + escapeHtml(item.desc) : '') + '</small></span></button>'
      ).join('');
    const active = list.querySelector('.is-active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  function pickSearchResult(index) {
    const item = searchState && searchState.items[index];
    if (!item) return false;
    if (typeof root.closeAllToolSubmenus === 'function') root.closeAllToolSubmenus();
    closeSearch();
    chooseTool(item.id);
    return true;
  }

  function ensureSearchPanel() {
    const doc = root.document;
    let panel = doc.getElementById('sceneToolSearchPanel');
    if (panel) return panel;
    panel = doc.createElement('div');
    panel.id = 'sceneToolSearchPanel';
    panel.className = 'scene-tool-search-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Tìm công cụ vẽ');
    panel.innerHTML = '<input type="search" autocomplete="off" spellcheck="false" placeholder="Tìm công cụ… (VD: xe tai, bien bao, cong)" aria-label="Tìm công cụ">' +
      '<div class="scene-tool-search-list" role="listbox"></div>' +
      '<div class="scene-tool-search-foot"><kbd>↑</kbd><kbd>↓</kbd> chọn · <kbd>Enter</kbd> dùng · <kbd>Esc</kbd> đóng</div>';
    // Cùng lớp với menu con của thanh công cụ: nằm trong cửa sổ vẽ (z-index 99999) nên không bị che.
    const host = doc.getElementById('sceneDrawingModalOverlay') || doc.body;
    host.appendChild(panel);
    const input = panel.querySelector('input');
    input.addEventListener('input', () => { searchState.index = 0; renderSearchResults(); });
    input.addEventListener('keydown', event => {
      event.stopPropagation();   // không cho phím tắt vẽ / Esc chung của sơ đồ chạy khi đang gõ
      if (event.key === 'Escape') { event.preventDefault(); closeSearch(); return; }
      if (event.key === 'Enter') { event.preventDefault(); pickSearchResult(searchState.index); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const n = searchState.items.length;
        if (!n) return;
        searchState.index = (searchState.index + (event.key === 'ArrowDown' ? 1 : n - 1)) % n;
        renderSearchResults();
      }
    });
    panel.querySelector('.scene-tool-search-list').addEventListener('click', event => {
      const row = event.target.closest('.scene-tool-search-item');
      if (!row) return;
      const index = searchState.items.findIndex(item => item.id === row.dataset.id);
      pickSearchResult(index);
    });
    doc.addEventListener('mousedown', event => {
      if (!panel.hidden && !panel.contains(event.target) && !(event.target.closest && event.target.closest('#toolBtnSearch'))) closeSearch();
    });
    return panel;
  }

  function openSearch() {
    const doc = root.document;
    if (!doc || !groupsConfig()) return false;
    if (typeof root.closeAllToolSubmenus === 'function') root.closeAllToolSubmenus();
    if (root.SceneSamples && root.SceneSamples.closePanel) root.SceneSamples.closePanel();
    const panel = ensureSearchPanel();
    const rail = doc.getElementById('sceneToolRail');
    const rect = rail ? rail.getBoundingClientRect() : { right: 70, top: 80 };
    panel.style.left = Math.round(rect.right + 10) + 'px';
    panel.style.top = Math.max(12, Math.round(rect.top + 8)) + 'px';
    panel.hidden = false;
    searchState = { items: [], index: 0 };
    const input = panel.querySelector('input');
    input.value = '';
    renderSearchResults();
    input.focus();
    return true;
  }

  function init() {
    const doc = root.document;
    if (!doc) return;
    initSectionToggles(doc.getElementById('sceneToolRail'));
    const searchBtn = doc.getElementById('toolBtnSearch');
    if (searchBtn) searchBtn.addEventListener('click', event => { event.stopPropagation(); openSearch(); });
    renderRecent();
  }

  const api = {
    SECTIONS_KEY, RECENT_KEY, buildSections, parseCollapsed, normalizeLabel, initSectionToggles, init,
    normalizeSearch, searchTools, pushRecent, parseRecent, recordTool, renderRecent, openSearch, closeSearch
  };
  root.SceneToolbarUI = api;

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
