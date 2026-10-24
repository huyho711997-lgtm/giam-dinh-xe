

function genShapeId() {
  return 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}


function cloneSceneTemplateMeta(meta) {
  const source = meta && typeof meta === 'object' ? meta : {};
  return {
    accidentDateTime: String(source.accidentDateTime || ''),
    accidentLocation: String(source.accidentLocation || ''),
    reportPlace: String(source.reportPlace || ''),
    reportDate: String(source.reportDate || '')
  };
}


function getTodaySceneDateString() {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
}


function getDefaultSceneTemplateMeta() {
  const dateInput = document.getElementById('modalPendingNgayVTT');
  const locInput = document.getElementById('modalPendingDiaDiemVTT');
  const accidentDateTime = dateInput ? String(dateInput.value || '').trim() : '';
  const accidentLocation = locInput ? String(locInput.value || '').trim() : '';
  return {
    accidentDateTime,
    accidentLocation,
    reportPlace: accidentLocation,
    reportDate: getTodaySceneDateString()
  };
}


function ensureSceneTemplateMeta(refreshEmptyFromForm = false) {
  const defaults = getDefaultSceneTemplateMeta();
  if (!sceneTemplateMeta || typeof sceneTemplateMeta !== 'object') {
    sceneTemplateMeta = cloneSceneTemplateMeta(defaults);
  } else {
    sceneTemplateMeta = cloneSceneTemplateMeta(sceneTemplateMeta);
    if (refreshEmptyFromForm) {
      if (!sceneTemplateMeta.accidentDateTime && defaults.accidentDateTime) sceneTemplateMeta.accidentDateTime = defaults.accidentDateTime;
      if (!sceneTemplateMeta.accidentLocation && defaults.accidentLocation) sceneTemplateMeta.accidentLocation = defaults.accidentLocation;
      if (!sceneTemplateMeta.reportPlace && defaults.reportPlace) sceneTemplateMeta.reportPlace = defaults.reportPlace;
    }
    if (!sceneTemplateMeta.reportDate) sceneTemplateMeta.reportDate = defaults.reportDate;
  }
  return sceneTemplateMeta;
}


function parseSceneDateParts(value, includeTime = false) {
  const raw = String(value || '').trim();
  let dd = '', mo = '', yyyy = '', hh = '', mm = '';
  let match = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (match) {
    dd = match[1]; mo = match[2]; yyyy = match[3]; hh = match[4] || ''; mm = match[5] || '';
  } else {
    match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?/);
    if (match) {
      yyyy = match[1]; mo = match[2]; dd = match[3]; hh = match[4] || ''; mm = match[5] || '';
    }
  }
  return {
    dd: dd ? String(dd).padStart(2, '0') : '......',
    mo: mo ? String(mo).padStart(2, '0') : '......',
    yyyy: yyyy || '......',
    hh: includeTime && hh ? String(hh).padStart(2, '0') : '......',
    mm: includeTime && mm ? String(mm).padStart(2, '0') : '......'
  };
}


function getSceneTemplateHotspot(x, y) {
  if (x >= 245 && x <= 755 && y >= 40 && y <= 78) return 'accident';
  if (x >= 660 && x <= 975 && y >= 558 && y <= 598) return 'report';
  return null;
}


function ensureSceneTemplateMetaEditor() {
  let overlay = document.getElementById('sceneTemplateMetaOverlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'sceneTemplateMetaOverlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:100500;background:rgba(7,10,15,.66);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="sceneTemplateMetaTitle" style="width:min(520px,96vw);border:1px solid rgba(216,180,109,.42);border-radius:20px;background:var(--modal-bg,#111722);box-shadow:0 30px 90px rgba(0,0,0,.5);color:var(--text-main,#f7f8fb);overflow:hidden;">
      <div style="padding:20px 22px 15px;border-bottom:1px solid var(--border,rgba(255,255,255,.1));display:flex;align-items:flex-start;justify-content:space-between;gap:15px;">
        <div><div id="sceneTemplateMetaTitle" style="font-size:17px;font-weight:850;">Chỉnh thông tin sơ đồ</div><div id="sceneTemplateMetaSubtitle" style="font-size:12px;color:var(--text-muted,#94a3b8);margin-top:5px;">Dữ liệu này sẽ xuất hiện trên bản in.</div></div>
        <button type="button" id="btnCloseSceneTemplateMeta" aria-label="Đóng" style="width:34px;height:34px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.12));background:var(--surface-soft,rgba(255,255,255,.06));color:inherit;cursor:pointer;font-size:20px;line-height:1;">×</button>
      </div>
      <div style="padding:20px 22px;display:grid;gap:15px;">
        <div id="sceneMetaAccidentFields" style="display:grid;gap:14px;">
          <label style="display:grid;gap:7px;font-size:12px;font-weight:750;">Ngày giờ xảy ra tai nạn
            <input id="sceneMetaAccidentDateTime" type="text" placeholder="Ví dụ: 25/09/2026 14:00" style="width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--border-strong,rgba(255,255,255,.16));background:var(--input-bg,rgba(0,0,0,.25));color:inherit;font:inherit;outline:none;" />
          </label>
          <label style="display:grid;gap:7px;font-size:12px;font-weight:750;">Địa điểm xảy ra tai nạn
            <input id="sceneMetaAccidentLocation" type="text" placeholder="Nhập địa điểm" style="width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--border-strong,rgba(255,255,255,.16));background:var(--input-bg,rgba(0,0,0,.25));color:inherit;font:inherit;outline:none;" />
          </label>
        </div>
        <div id="sceneMetaReportFields" style="display:grid;gap:14px;">
          <label style="display:grid;gap:7px;font-size:12px;font-weight:750;">Địa danh lập sơ đồ
            <input id="sceneMetaReportPlace" type="text" placeholder="Ví dụ: Đắk Nông" style="width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--border-strong,rgba(255,255,255,.16));background:var(--input-bg,rgba(0,0,0,.25));color:inherit;font:inherit;outline:none;" />
          </label>
          <label style="display:grid;gap:7px;font-size:12px;font-weight:750;">Ngày lập sơ đồ
            <input id="sceneMetaReportDate" type="text" placeholder="Ví dụ: 03/10/2026" style="width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--border-strong,rgba(255,255,255,.16));background:var(--input-bg,rgba(0,0,0,.25));color:inherit;font:inherit;outline:none;" />
          </label>
        </div>
      </div>
      <div style="padding:14px 22px 20px;display:flex;justify-content:flex-end;gap:12px;">
        <button type="button" id="btnCancelSceneTemplateMeta" class="btn-premium btn-secondary" style="width:auto !important;padding:0 20px;height:42px;cursor:pointer;">Hủy</button>
        <button type="button" id="btnApplySceneTemplateMeta" class="btn-premium" style="width:auto !important;padding:0 28px;height:42px;font-weight:800;background:var(--primary-gradient);color:#080b11;border:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;">Cập nhật</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('mousedown', function(event) {
    if (event.target === overlay) closeSceneTemplateMetaEditor();
  });
  document.getElementById('btnCloseSceneTemplateMeta').onclick = closeSceneTemplateMetaEditor;
  document.getElementById('btnCancelSceneTemplateMeta').onclick = closeSceneTemplateMetaEditor;
  document.getElementById('btnApplySceneTemplateMeta').onclick = applySceneTemplateMetaEditor;
  return overlay;
}


function openSceneTemplateMetaEditor(section) {
  const meta = ensureSceneTemplateMeta(true);
  const overlay = ensureSceneTemplateMetaEditor();
  overlay.dataset.section = section === 'report' ? 'report' : 'accident';
  document.getElementById('sceneTemplateMetaTitle').textContent = section === 'report' ? 'Chỉnh nơi và ngày lập sơ đồ' : 'Chỉnh thời gian và địa điểm tai nạn';
  document.getElementById('sceneMetaAccidentFields').style.display = section === 'report' ? 'none' : 'grid';
  document.getElementById('sceneMetaReportFields').style.display = section === 'report' ? 'grid' : 'none';
  document.getElementById('sceneMetaAccidentDateTime').value = meta.accidentDateTime;
  document.getElementById('sceneMetaAccidentLocation').value = meta.accidentLocation;
  document.getElementById('sceneMetaReportPlace').value = meta.reportPlace;
  document.getElementById('sceneMetaReportDate').value = meta.reportDate;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    const focusId = section === 'report' ? 'sceneMetaReportPlace' : 'sceneMetaAccidentDateTime';
    document.getElementById(focusId)?.focus();
  }, 40);
}


function closeSceneTemplateMetaEditor() {
  const overlay = document.getElementById('sceneTemplateMetaOverlay');
  if (!overlay) return;
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
}


function applySceneTemplateMetaEditor() {
  const overlay = document.getElementById('sceneTemplateMetaOverlay');
  const section = overlay && overlay.dataset.section === 'report' ? 'report' : 'accident';
  const nextMeta = cloneSceneTemplateMeta(ensureSceneTemplateMeta());
  if (section === 'report') {
    nextMeta.reportPlace = String(document.getElementById('sceneMetaReportPlace')?.value || '').trim();
    nextMeta.reportDate = String(document.getElementById('sceneMetaReportDate')?.value || '').trim() || getTodaySceneDateString();
  } else {
    nextMeta.accidentDateTime = String(document.getElementById('sceneMetaAccidentDateTime')?.value || '').trim();
    nextMeta.accidentLocation = String(document.getElementById('sceneMetaAccidentLocation')?.value || '').trim();
    const dateInput = document.getElementById('modalPendingNgayVTT');
    const locInput = document.getElementById('modalPendingDiaDiemVTT');
    if (dateInput) dateInput.value = nextMeta.accidentDateTime;
    if (locInput) locInput.value = nextMeta.accidentLocation;
  }
  sceneTemplateMeta = nextMeta;
  closeSceneTemplateMetaEditor();
  redrawSceneCanvas(true);
  saveDrawingState();
  if (typeof showToast === 'function') showToast('Đã cập nhật thông tin trên sơ đồ', 'success');
}


function initSceneDrawing() {
  if (!sceneCanvas) return;
  ensureSceneTemplateMeta(true);
  sceneShapes = [];
  selectedShapeId = null;
  drawingHistory = [];
  historyIndex = -1;

  const performInitialDraw = () => {
    redrawSceneCanvas(false);
    saveDrawingState();
  };

  performInitialDraw();
  
  setupDrawingToolListeners();
}


function getToolDef(toolId) {
  for (const gKey in TOOL_GROUPS_CONFIG) {
    const t = TOOL_GROUPS_CONFIG[gKey].tools.find(x => x.id === toolId);
    if (t) return t;
  }
  return null;
}


function closeAllToolSubmenus() {
  const popover = document.getElementById('toolSubmenuPopover');
  if (popover) popover.style.display = 'none';
  activeSubmenuGroup = null;
}


function toggleToolSubmenu(event, groupKey) {
  if (event) event.stopPropagation();
  if (typeof closeStrokeWidthPopover === 'function') closeStrokeWidthPopover();

  const popover = document.getElementById('toolSubmenuPopover');
  if (!popover) return;

  if (activeSubmenuGroup === groupKey && popover.style.display === 'flex') {
    closeAllToolSubmenus();
    return;
  }

  const currentToolInGroup = groupActiveTools[groupKey] || TOOL_GROUPS_CONFIG[groupKey].defaultTool;
  if (currentDrawTool !== currentToolInGroup) {
    setActiveDrawTool(currentToolInGroup);
  }

  const isLight = document.body && document.body.classList.contains('light-mode');
  if (isLight) {
    popover.style.background = '#ffffff';
    popover.style.border = '1px solid rgba(0, 0, 0, 0.14)';
    popover.style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.06)';
    popover.style.color = '#1c1f26';
    const headerBorder = document.getElementById('toolSubmenuHeader');
    if (headerBorder) headerBorder.style.borderBottom = '1px solid rgba(0, 0, 0, 0.08)';
  } else {
    popover.style.background = 'rgba(18, 22, 31, 0.98)';
    popover.style.border = '1px solid rgba(216, 180, 109, 0.45)';
    popover.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)';
    popover.style.color = '#f7f8fb';
    const headerBorder = document.getElementById('toolSubmenuHeader');
    if (headerBorder) headerBorder.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
  }

  renderSubmenu(groupKey);

  const btn = document.getElementById('btnGroup_' + groupKey) || (event ? event.currentTarget : null);
  if (btn) {
    const rect = btn.getBoundingClientRect();
    popover.style.display = 'flex';
    popover.style.position = 'fixed';
    popover.style.left = (rect.right + 10) + 'px';
    const popoverHeight = popover.offsetHeight;
    const topPos = Math.max(15, Math.min(window.innerHeight - popoverHeight - 15, rect.top - 6));
    popover.style.top = topPos + 'px';
  }
  activeSubmenuGroup = groupKey;
}


function renderSubmenu(groupKey) {
  const group = TOOL_GROUPS_CONFIG[groupKey];
  if (!group) return;

  const isLight = document.body && document.body.classList.contains('light-mode');
  const titleEl = document.getElementById('toolSubmenuTitle');
  if (titleEl) {
    titleEl.textContent = group.name;
    titleEl.style.color = isLight ? '#9e7123' : '#d8b46d';
  }
  const hintEl = document.getElementById('toolSubmenuHint');
  if (hintEl) {
    hintEl.style.color = isLight ? '#717d96' : '#a0aec0';
  }

  const itemsContainer = document.getElementById('toolSubmenuItems');
  if (!itemsContainer) return;
  itemsContainer.innerHTML = '';

  group.tools.forEach(tool => {
    const isToolActive = (currentDrawTool === tool.id);
    const itemBtn = document.createElement('button');
    itemBtn.type = 'button';
    itemBtn.className = 'tool-submenu-item' + (isToolActive ? ' active-item' : '');
    itemBtn.dataset.active = isToolActive ? 'true' : 'false';
    itemBtn.onclick = function(e) {
      e.stopPropagation();
      selectSubmenuTool(groupKey, tool.id);
    };

    const bgItem = isToolActive 
      ? (isLight ? 'rgba(216, 180, 109, 0.18)' : 'rgba(216, 180, 109, 0.2)')
      : 'transparent';
    const borderItem = isToolActive 
      ? (isLight ? '#b38c43' : '#d8b46d') 
      : 'transparent';
    const iconBg = isToolActive
      ? (isLight ? 'rgba(216, 180, 109, 0.28)' : 'rgba(216, 180, 109, 0.3)')
      : (isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)');
    const iconColor = isToolActive
      ? (isLight ? '#9e7123' : '#d8b46d')
      : (isLight ? '#1c1f26' : '#f7f8fb');
    const titleColor = isToolActive
      ? (isLight ? '#9e7123' : '#d8b46d')
      : (isLight ? '#1c1f26' : '#f7f8fb');
    const descColor = isLight ? '#64748b' : '#94a3b8';
    const checkColor = isLight ? '#9e7123' : '#d8b46d';

    itemBtn.style.background = bgItem;
    itemBtn.style.border = '1px solid ' + borderItem;

    const checkHtml = isToolActive 
      ? `<span style="color: ${checkColor}; font-weight: 850; font-size: 14px; margin-left: auto;">✓</span>` 
      : '';

    itemBtn.innerHTML = `
      <span class="submenu-item-icon-box" style="width: 32px; height: 32px; border-radius: 8px; background: ${iconBg}; display: grid; place-items: center; color: ${iconColor}; flex-shrink: 0; transition: all 0.15s;">
        ${TOOL_ICONS_MAP[tool.id] || ''}
      </span>
      <div style="display: flex; flex-direction: column; flex: 1; min-width: 0; text-align: left;">
        <div class="submenu-item-title" style="font-size: 12.5px; font-weight: 700; color: ${titleColor}; line-height: 1.25;">${tool.name}</div>
        <div class="submenu-item-desc" style="font-size: 10.5px; color: ${descColor}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tool.desc}</div>
      </div>
      ${checkHtml}
    `;

    itemBtn.onmouseenter = function() {
      if (!isToolActive) {
        this.style.background = isLight ? 'rgba(216, 180, 109, 0.12)' : 'rgba(216, 180, 109, 0.14)';
        this.style.borderColor = isLight ? 'rgba(216, 180, 109, 0.35)' : 'rgba(216, 180, 109, 0.4)';
        this.style.transform = 'translateX(2px)';
      }
    };
    itemBtn.onmouseleave = function() {
      if (!isToolActive) {
        this.style.background = 'transparent';
        this.style.borderColor = 'transparent';
        this.style.transform = 'none';
      }
    };

    itemsContainer.appendChild(itemBtn);
  });
}


function selectSubmenuTool(groupKey, toolId) {
  groupActiveTools[groupKey] = toolId;
  setActiveDrawTool(toolId);
  closeAllToolSubmenus();
}


function setActiveDrawTool(toolName) {
  currentDrawTool = toolName;
  closeAllToolSubmenus();
  roadIntersectionHoverPos = null;
  if (toolName === 'road_intersection') clearSelection();
  if (toolName !== 'tire_track') tireTrackPendingStart = null;
  if (toolName !== 'eraser') {
    eraserHoverPos = null;
    eraserTargetShapeId = null;
  }

  // Find if toolName belongs to a group
  let foundGroupKey = null;
  for (const gKey in TOOL_GROUPS_CONFIG) {
    if (TOOL_GROUPS_CONFIG[gKey].tools.some(t => t.id === toolName)) {
      foundGroupKey = gKey;
      break;
    }
  }

  if (foundGroupKey) {
    groupActiveTools[foundGroupKey] = toolName;
    const iconSlot = document.getElementById('groupIcon_' + foundGroupKey);
    if (iconSlot && TOOL_ICONS_MAP[toolName]) {
      iconSlot.innerHTML = TOOL_ICONS_MAP[toolName];
    }
    const btn = document.getElementById('btnGroup_' + foundGroupKey);
    if (btn) {
      btn.dataset.tool = toolName;
      const def = getToolDef(toolName);
      if (def) {
        const shortcutHint = btn.dataset.shortcut ? ' — phím ' + btn.dataset.shortcut : '';
        btn.title = def.name + shortcutHint + ' (' + def.desc + ')';
      }
    }
  }

  // Update button highlights
  document.querySelectorAll('.draw-tool-btn').forEach(btn => {
    const btnTool = btn.dataset.tool;
    const btnGroup = btn.dataset.group;
    const isActive = (btnTool === toolName || (btnGroup && foundGroupKey === btnGroup));
    if (isActive) {
      btn.style.border = '1px solid var(--primary)';
      btn.style.background = 'rgba(216,180,109,0.15)';
      btn.classList.add('active');
    } else {
      btn.style.border = '1px solid transparent';
      btn.style.background = 'transparent';
      btn.classList.remove('active');
    }
  });

  if (sceneCanvas) {
    sceneCanvas.style.cursor = toolName === 'eraser' ? 'none' : (toolName === 'select' ? 'default' : 'crosshair');
  }

  // Update canvas rendering and selection badge
  updateSelectionBadge();
  redrawSceneCanvas(toolName === 'select');
}


function setupDrawingToolListeners() {
  const tools = document.querySelectorAll('.draw-tool-btn:not(.draw-tool-group-btn)');
  tools.forEach(btn => {
    btn.onclick = function() {
      if (this.dataset.tool) {
        closeAllToolSubmenus();
        setActiveDrawTool(this.dataset.tool);
      }
    };
  });

  const groupBtns = document.querySelectorAll('.draw-tool-group-btn');
  groupBtns.forEach(btn => {
    btn.onclick = function(e) {
      if (this.dataset.group) {
        toggleToolSubmenu(e, this.dataset.group);
      }
    };
  });

  if (!sceneCanvas || isDrawingListenersAttached) return;
  isDrawingListenersAttached = true;

  sceneCanvas.onmousedown = onCanvasMouseDown;
  sceneCanvas.onmousemove = onCanvasMouseMove;
  sceneCanvas.onmouseup = onCanvasMouseUp;
  sceneCanvas.onmouseleave = function() {
    if (currentDrawTool === 'road_intersection') {
      roadIntersectionHoverPos = null;
      redrawSceneCanvas(false);
    }
    if (currentDrawTool === 'eraser') {
      eraserHoverPos = null;
      eraserTargetShapeId = null;
      redrawSceneCanvas(false);
    }
  };
  sceneCanvas.ondblclick = function(e) {
    const pos = getMousePos(sceneCanvas, e);
    for (let i = sceneShapes.length - 1; i >= 0; i--) {
      if (isTrafficSignPostType(sceneShapes[i].type) && hitTestShape(sceneShapes[i], pos.x, pos.y)) {
        setSelectedShapes([sceneShapes[i].id]);
        updateSelectionBadge();
        redrawSceneCanvas(true);
        openTrafficSignEditor(sceneShapes[i]);
        return;
      }
      if ((sceneShapes[i].type === 'text' || sceneShapes[i].type === 'number_note') && hitTestShape(sceneShapes[i], pos.x, pos.y)) {
        setSelectedShapes([sceneShapes[i].id]);
        updateSelectionBadge();
        redrawSceneCanvas(true);
        if (sceneShapes[i].type === 'number_note') openSceneNumberNoteModal(sceneShapes[i]);
        else openSceneTextModal(sceneShapes[i]);
        return;
      }
    }
  };

  // Touch Support for Tablet / Mobile Canvas
  sceneCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      sceneCanvas.dispatchEvent(mouseEvent);
    }
  }, { passive: false });

  sceneCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      sceneCanvas.dispatchEvent(mouseEvent);
    }
  }, { passive: false });

  sceneCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touch = e.changedTouches && e.changedTouches[0];
    const mouseEvent = new MouseEvent('mouseup', {
      clientX: touch ? touch.clientX : 0,
      clientY: touch ? touch.clientY : 0,
      bubbles: true
    });
    sceneCanvas.dispatchEvent(mouseEvent);
  }, { passive: false });

  // Keep an active gesture attached to the pointer even if it briefly leaves
  // the canvas. Committing on `mouseleave` made the endpoint jump to the leave
  // event instead of the real release position.
  const hasActiveSceneGesture = () => (
    isDrawing || isDraggingShape || isRotatingShape ||
    isDraggingCurveControl || isDraggingCurveStart || isDraggingCurveEnd ||
    isResizingLinearStart || isResizingLinearEnd || isResizingInfraBand || isResizingNumberNote || isResizingVehicle ||
    !!roadIntersectionResizeState
  );
  window.addEventListener('mousemove', (e) => {
    if (e.target !== sceneCanvas && hasActiveSceneGesture()) onCanvasMouseMove(e);
  });
  window.addEventListener('mouseup', (e) => {
    if (hasActiveSceneGesture()) onCanvasMouseUp(e);
  });

  document.addEventListener('click', function(e) {
    const popover = document.getElementById('toolSubmenuPopover');
    if (!popover || popover.style.display === 'none') return;
    if (!popover.contains(e.target) && !e.target.closest('.draw-tool-group-btn')) {
      closeAllToolSubmenus();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeAllToolSubmenus();
  });
}


function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const touchPoint = evt && evt.touches && evt.touches[0]
    ? evt.touches[0]
    : (evt && evt.changedTouches && evt.changedTouches[0] ? evt.changedTouches[0] : null);
  const clientX = touchPoint ? touchPoint.clientX : evt && evt.clientX;
  const clientY = touchPoint ? touchPoint.clientY : evt && evt.clientY;

  if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || rect.width <= 0 || rect.height <= 0) {
    return { x: currentX || 0, y: currentY || 0 };
  }

  // Use the same viewport coordinates for mouse, touch, synthetic events and
  // releases outside the canvas. The live rectangle includes CSS resizing,
  // zoom, pan and page scrolling; the bitmap's DPI is unrelated to input.
  // offsetX/offsetY can change coordinate systems when the event target changes.
  return {
    x: (clientX - rect.left) * (SCENE_LOGICAL_WIDTH / rect.width),
    y: (clientY - rect.top) * (SCENE_LOGICAL_HEIGHT / rect.height)
  };
}


function constrainSceneDrawPoint(toolName, sx, sy, px, py, shiftPressed) {
  let x = px;
  let y = py;
  if (!shiftPressed) return { x, y };

  if (toolName === 'rect') {
    const side = Math.max(Math.abs(x - sx), Math.abs(y - sy));
    x = sx + (x >= sx ? side : -side);
    y = sy + (y >= sy ? side : -side);
    return { x, y };
  }

  if (Math.abs(x - sx) >= Math.abs(y - sy)) y = sy;
  else x = sx;
  return { x, y };
}


// ------------------------------------------
// REDRAW & RENDERING PIPELINE
// ------------------------------------------
function getSceneDrawingAreaBounds() {
  const gridX = 20;
  const gridY = 85;
  const legendX = SCENE_LOGICAL_WIDTH - 180;
  const gridHeight = SCENE_LOGICAL_HEIGHT - 225;
  const inset = 1.6;
  return {
    x: gridX + inset,
    y: gridY + inset,
    width: legendX - gridX - inset * 2,
    height: gridHeight - inset * 2
  };
}


function applySceneDrawingAreaClip(ctx) {
  if (!ctx) return;
  const bounds = getSceneDrawingAreaBounds();
  ctx.beginPath();
  ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.clip();
}


function isPointInsideSceneDrawingArea(x, y) {
  const bounds = getSceneDrawingAreaBounds();
  return x >= bounds.x && x <= bounds.x + bounds.width &&
    y >= bounds.y && y <= bounds.y + bounds.height;
}


function clampPointToSceneDrawingArea(x, y, inset = 0) {
  const bounds = getSceneDrawingAreaBounds();
  const left = bounds.x + inset;
  const top = bounds.y + inset;
  const right = bounds.x + bounds.width - inset;
  const bottom = bounds.y + bounds.height - inset;
  return {
    x: Math.max(left, Math.min(right, Number(x) || 0)),
    y: Math.max(top, Math.min(bottom, Number(y) || 0))
  };
}


function getVisibleLinearResizeEndpoints(shape) {
  if (!isLinearResizableShape(shape)) return null;
  return {
    start: clampPointToSceneDrawingArea(shape.x1, shape.y1, 1),
    end: clampPointToSceneDrawingArea(shape.x2, shape.y2, 1)
  };
}


function getMaximumLinearResizeLengthInDrawingArea(anchorX, anchorY, dirX, dirY) {
  if (!isPointInsideSceneDrawingArea(anchorX, anchorY)) return Infinity;
  const bounds = getSceneDrawingAreaBounds();
  const left = bounds.x + 1;
  const top = bounds.y + 1;
  const right = bounds.x + bounds.width - 1;
  const bottom = bounds.y + bounds.height - 1;
  const limits = [];
  if (dirX > 0.000001) limits.push((right - anchorX) / dirX);
  else if (dirX < -0.000001) limits.push((left - anchorX) / dirX);
  if (dirY > 0.000001) limits.push((bottom - anchorY) / dirY);
  else if (dirY < -0.000001) limits.push((top - anchorY) / dirY);
  const validLimits = limits.filter(value => Number.isFinite(value) && value >= 0);
  return validLimits.length ? Math.min(...validLimits) : Infinity;
}


function renderInsideSceneDrawingArea(ctx, callback) {
  if (!ctx || typeof callback !== 'function') return;
  ctx.save();
  applySceneDrawingAreaClip(ctx);
  callback();
  ctx.restore();
}


// A preset uses the existing road vectors so saved diagrams, printing and
// ungrouping remain compatible with the rest of the drawing engine.
function makeSceneRoadIntersection(x, y, commit = false) {
  if (!isPointInsideSceneDrawingArea(x, y)) return [];
  const bounds = getSceneDrawingAreaBounds();
  const color = document.getElementById('drawColorPicker')?.value || '#000000';
  const width = Math.max(0.5, Number(document.getElementById('drawStrokeWidth')?.value) || 1.5);
  const available = Math.min(x - bounds.x, bounds.x + bounds.width - x,
    y - bounds.y, bounds.y + bounds.height - y) - width / 2 - 3;
  const extent = Math.min(160, available);
  if (extent < 50) return [];
  // Fit near the edges by shrinking around the exact pointer position.
  const scale = extent / 160;
  const halfRoad = 44 * scale;
  const centerGap = halfRoad + 10 * scale;
  const groupId = commit ? 'road_intersection_' + genShapeId() : null;
  const shapes = [];
  const addLine = (type, x1, y1, x2, y2) => shapes.push({
    id: commit ? genShapeId() : '', type,
    x1: x + x1, y1: y + y1, x2: x + x2, y2: y + y2,
    color, width, groupId, presetType: 'road_intersection', presetScale: scale
  });
  for (const side of [-1, 1]) {
    for (const edge of [-1, 1]) {
      addLine('road_line', side * halfRoad, edge * halfRoad, side * extent, edge * halfRoad);
      addLine('road_line', edge * halfRoad, side * halfRoad, edge * halfRoad, side * extent);
    }
    addLine('road_dashed', side * centerGap, 0, side * extent, 0);
    addLine('road_dashed', 0, side * centerGap, 0, side * extent);
  }
  return shapes;
}


function placeSceneRoadIntersection(x, y) {
  const shapes = makeSceneRoadIntersection(x, y, true);
  if (!shapes.length) {
    if (typeof showToast === 'function') showToast('Đặt tâm ngã tư xa mép khung sơ đồ hơn để đủ bốn nhánh', 'info');
    return;
  }
  // Road geometry belongs beneath vehicles and other existing scene objects.
  sceneShapes.unshift(...shapes);
  setSelectedShapes(shapes.map(shape => shape.id));
  saveDrawingState();
  setActiveDrawTool('select');
  if (typeof showToast === 'function') showToast('Đã tạo ngã tư. Kéo để di chuyển, dùng +/− đổi kích thước hoặc R để xoay', 'success');
}


function getSelectedRoadIntersectionShapes() {
  const shapes = getSelectedShapes();
  if (shapes.length !== 12 || !shapes[0].groupId) return [];
  const groupId = shapes[0].groupId;
  return shapes.every(shape => shape.groupId === groupId && shape.presetType === 'road_intersection' &&
    (shape.type === 'road_line' || shape.type === 'road_dashed')) &&
    sceneShapes.filter(shape => shape.groupId === groupId).length === shapes.length ? shapes : [];
}


function redrawSceneCanvas(includeSelectionUI = true) {
  if (!sceneCanvas || !sceneCtx) return;

  // High-DPI & Zoom-aware vector buffer scaling (prevents blurriness at any zoom)
  const dpr = window.devicePixelRatio || 1;
  const zoom = (typeof currentSceneZoom === 'number' && currentSceneZoom > 0) ? currentSceneZoom : 1.0;
  const renderScale = Math.min(4.0, Math.max(1.0, zoom * dpr));
  const targetW = Math.round(SCENE_LOGICAL_WIDTH * renderScale);
  const targetH = Math.round(SCENE_LOGICAL_HEIGHT * renderScale);

  if (sceneCanvas.width !== targetW || sceneCanvas.height !== targetH) {
    sceneCanvas.width = targetW;
    sceneCanvas.height = targetH;
    sceneCanvas.style.width = `${SCENE_LOGICAL_WIDTH}px`;
    sceneCanvas.style.height = `${SCENE_LOGICAL_HEIGHT}px`;
  }

  // Clear in bitmap pixels, then keep the context in logical diagram units.
  // Live previews are drawn after this function returns, so restoring an
  // identity transform here would displace them whenever zoom * DPR exceeds 1.
  sceneCtx.setTransform(1, 0, 0, 1, 0, 0);
  sceneCtx.clearRect(0, 0, sceneCanvas.width, sceneCanvas.height);
  sceneCtx.setTransform(
    sceneCanvas.width / SCENE_LOGICAL_WIDTH, 0,
    0, sceneCanvas.height / SCENE_LOGICAL_HEIGHT, 0, 0
  );
  sceneCtx.save();
  sceneCtx.imageSmoothingEnabled = true;
  sceneCtx.imageSmoothingQuality = 'high';

  drawTemplate(sceneCtx, SCENE_LOGICAL_WIDTH, SCENE_LOGICAL_HEIGHT);

  // Chỉ lớp nội dung do người dùng vẽ mới bị cắt theo ô sơ đồ bên trái.
  // Tiêu đề, chú thích và chữ ký thuộc mẫu biểu nên không nằm trong clip này.
  sceneCtx.save();
  applySceneDrawingAreaClip(sceneCtx);

  for (let i = 0; i < sceneShapes.length; i++) {
    renderShape(sceneCtx, sceneShapes[i]);
  }

  if (currentDrawTool === 'road_intersection' && roadIntersectionHoverPos && !isPanning) {
    sceneCtx.save();
    sceneCtx.globalAlpha = 0.5;
    makeSceneRoadIntersection(roadIntersectionHoverPos.x, roadIntersectionHoverPos.y)
      .forEach(shape => renderShape(sceneCtx, shape));
    sceneCtx.restore();
  }

  // Khôi phục clip ngay sau khi vẽ xong các đối tượng, giúp khung chọn (bounding box),
  // các điểm chốt điều chỉnh kích thước (resize handles) và tay nắm xoay (rotation stem/handle)
  // luôn hiển thị đầy đủ trên cùng mà không bị che khuất khi đối tượng nằm sát mép ô sơ đồ.
  sceneCtx.restore();

  // Draw active smart snapping alignment guidelines
  if (typeof drawActiveSnapGuides === 'function') {
    drawActiveSnapGuides(sceneCtx);
  }
  
  if (includeSelectionUI && selectedShapeIds && selectedShapeIds.length > 0) {
    const selShapes = getSelectedShapes();
    if (selShapes.length > 1) {
      drawMultiSelectionBox(sceneCtx, selShapes);
    } else if (selShapes.length === 1) {
      drawShapeSelectionBox(sceneCtx, selShapes[0]);
    }
  } else if (includeSelectionUI && selectedShapeId) {
    const sel = sceneShapes.find(s => s.id === selectedShapeId);
    if (sel) {
      drawShapeSelectionBox(sceneCtx, sel);
    }
  }

  // Khung vuông của cục tẩy luôn nằm trên cùng để người dùng thấy chính xác
  // đối tượng đang được nhắm tới trước khi nhấp xóa.
  drawEraserPreview(sceneCtx);

  sceneCtx.restore();
}


function getTireTrackSpacing(shape) {
  return Math.max(10, Math.min(34, Number(shape && shape.trackSpacing) || (shape && shape.width ? shape.width * 5 : 12)));
}


function getOffsetFreehandPoints(points, offset) {
  if (!Array.isArray(points) || points.length === 0) return [];
  return points.map((point, index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    return {
      x: point.x - (dy / length) * offset,
      y: point.y + (dx / length) * offset
    };
  });
}


function strokeSmoothScenePath(ctx, points) {
  if (!Array.isArray(points) || points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) {
    ctx.lineTo(points[0].x + 0.01, points[0].y + 0.01);
  } else {
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }
  ctx.stroke();
}


function drawTireTrackShape(ctx, shape) {
  if (!shape || !Array.isArray(shape.points) || shape.points.length === 0) return;
  const spacing = getTireTrackSpacing(shape);
  const leftTrack = getOffsetFreehandPoints(shape.points, -spacing / 2);
  const rightTrack = getOffsetFreehandPoints(shape.points, spacing / 2);
  const trackWidth = Math.max(1.8, Math.min(7, (shape.width || 1.5) * 1.35));

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(15,23,42,.16)';
  ctx.shadowBlur = Math.max(1, trackWidth * 0.8);
  ctx.strokeStyle = 'rgba(17,24,39,.78)';
  ctx.lineWidth = trackWidth;
  ctx.setLineDash([]);
  strokeSmoothScenePath(ctx, leftTrack);
  strokeSmoothScenePath(ctx, rightTrack);

  // Lớp gai lốp ngắt quãng giúp phân biệt với hai nét vẽ thông thường.
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#000000';
  ctx.globalAlpha = 0.86;
  ctx.lineWidth = Math.max(0.75, trackWidth * 0.42);
  ctx.setLineDash([Math.max(4, trackWidth * 2.2), Math.max(3, trackWidth * 1.7)]);
  strokeSmoothScenePath(ctx, leftTrack);
  ctx.lineDashOffset = -Math.max(2, trackWidth);
  strokeSmoothScenePath(ctx, rightTrack);
  ctx.restore();
}


function renderShape(ctx, shape) {
  if (!shape) return;
  const color = shape.color || '#000000';
  const width = shape.width || 1.5;
  
  if (shape.type === 'tire_track') {
    drawTireTrackShape(ctx, shape);
  } else if (shape.type === 'pen') {
    if (!shape.points || shape.points.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  } else if (shape.type === 'eraser') {
    if (!shape.points || shape.points.length === 0) return;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = (shape.width || 2) * 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  } else if (shape.type === 'curve') {
    drawCurveLine(ctx, shape.x1, shape.y1, shape.cx, shape.cy, shape.x2, shape.y2, color, width, false, shape.hasArrow);
  } else if (shape.type === 'curve_dashed') {
    drawCurveLine(ctx, shape.x1, shape.y1, shape.cx, shape.cy, shape.x2, shape.y2, color, width, true, shape.hasArrow);
  } else if (shape.type === 'road_line') {
    drawRoadLine(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width, false);
  } else if (shape.type === 'road_dashed') {
    drawRoadLine(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width, true);
  } else if (shape.type === 'road_edge') {
    drawRoadEdge(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width, shape.sizeScale || 1);
  } else if (shape.type === 'crosswalk') {
    drawCrosswalk(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width, shape.sizeScale || 1);
  } else if (shape.type === 'traffic_light') {
    drawTrafficLight(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width, shape.sizeScale || 1);
  } else if (shape.type === 'median') {
    drawMedianStrip(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width, shape.sizeScale || 1);
  } else if (shape.type === 'median_blocks') {
    drawModularMedianStrip(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width, shape.sizeScale || 1);
  } else if (shape.type === 'line') {
    drawArrowLine(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width, false);
  } else if (shape.type === 'dashed_line') {
    drawArrowLine(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width, true);
  } else if (shape.type === 'rect') {
    ctx.save();
    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(shape.angle || 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash([]);
    ctx.strokeRect(-shape.w / 2, -shape.h / 2, shape.w, shape.h);
    ctx.restore();
  } else if (shape.type === 'car') {
    ctx.save();
    ctx.translate(shape.startX, shape.startY);
    ctx.rotate(shape.angle);
    drawTemplateCar(ctx, shape.carW / 2, 0, color, width, shape.carW, getVehicleDimensions(shape).h, !!shape.dashed);
    ctx.restore();
  } else if (shape.type === 'container') {
    ctx.save();
    ctx.translate(shape.startX, shape.startY);
    ctx.rotate(shape.angle);
    drawTemplateContainer(ctx, shape.containerW / 2, 0, color, width, shape.containerW, getVehicleDimensions(shape).h, !!shape.dashed);
    ctx.restore();
  } else if (shape.type === 'bike') {
    ctx.save();
    ctx.translate(shape.startX, shape.startY);
    ctx.rotate(shape.angle);
    drawTemplateBike(ctx, shape.bikeW / 2, 0, color, width, shape.bikeW, getVehicleDimensions(shape).h, !!shape.dashed);
    ctx.restore();
  } else if (shape.type === 'fallen_bike') {
    const fallenBikeW = shape.fallenBikeW || 42;
    ctx.save();
    ctx.translate(shape.startX, shape.startY);
    ctx.rotate(shape.angle || 0);
    drawFallenBike(ctx, fallenBikeW / 2, 0, color, width, fallenBikeW, getVehicleDimensions(shape).h, !!shape.dashed);
    ctx.restore();
  } else if (isSceneryAssetType(shape.type)) {
    const assetDimensions = getVehicleDimensions(shape);
    if (isTrafficSignPostType(shape.type) && !shape.signOrientationVersion) {
      // Chuyển các biển đã tạo bằng phiên bản cũ từ tư thế ngang sang đứng,
      // đồng thời giữ nguyên tâm để chúng không nhảy sang vị trí khác.
      const oldAngle = shape.angle || 0;
      const centerX = shape.startX + (assetDimensions.w / 2) * Math.cos(oldAngle);
      const centerY = shape.startY + (assetDimensions.w / 2) * Math.sin(oldAngle);
      shape.startX = centerX - assetDimensions.w / 2;
      shape.startY = centerY;
      shape.angle = 0;
      shape.signOrientationVersion = 1;
    }
    ctx.save();
    ctx.translate(shape.startX, shape.startY);
    ctx.rotate(shape.angle || 0);
    drawSceneryAsset(ctx, shape.type, assetDimensions.w / 2, 0, color, width, assetDimensions.w, assetDimensions.h, shape);
    ctx.restore();
  } else if (shape.type === 'person') {
    drawTemplatePerson(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width);
  } else if (shape.type === 'measure') {
    drawMeasureLine(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, width);
  } else if (shape.type === 'xmark') {
    drawXMark(ctx, shape.x, shape.y, color, width, shape.size || 8);
  } else if (shape.type === 'number_note') {
    drawNumberNoteMarker(ctx, shape);
  } else if (shape.type === 'text') {
    ctx.save();
    ctx.translate(shape.x, shape.y);
    ctx.rotate(shape.angle || 0);
    
    let fontStyle = '';
    if (shape.isItalic) fontStyle += 'italic ';
    if (shape.isBold) fontStyle += 'bold ';
    const fontSize = shape.fontSize || shape.size || 16;
    const fontFamily = shape.fontFamily || 'Arial';
    
    ctx.font = `${fontStyle}${fontSize}px ${fontFamily}, sans-serif`;
    ctx.fillStyle = shape.color || '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = (shape.text || '').split('\n');
    const lineHeight = fontSize * 1.25;
    lines.forEach((lineText, lineIdx) => {
      ctx.fillText(lineText, 0, lineIdx * lineHeight);
      if (shape.isUnderline) {
        const textWidth = ctx.measureText(lineText).width;
        ctx.beginPath();
        ctx.strokeStyle = shape.color || '#000000';
        ctx.lineWidth = Math.max(1, fontSize / 14);
        ctx.moveTo(0, lineIdx * lineHeight + fontSize + 2);
        ctx.lineTo(textWidth, lineIdx * lineHeight + fontSize + 2);
        ctx.stroke();
      }
    });

    ctx.restore();
  }
}
