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

  function init() {
    const doc = root.document;
    if (!doc) return;
    initSectionToggles(doc.getElementById('sceneToolRail'));
  }

  const api = { SECTIONS_KEY, buildSections, parseCollapsed, normalizeLabel, initSectionToggles, init };
  root.SceneToolbarUI = api;

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
