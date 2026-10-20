

    function executeImageFilesPreviewBinding() {
      clearActiveObjectUrls();
      const fileInputElement = document.getElementById('fileImageUploader');
      const filesList = Array.from(fileInputElement.files || []);
      const labelSummary = document.getElementById('lblDropzoneSummary');
      const gridHolder = document.getElementById('boxPreviewsHolder');
      gridHolder.innerHTML = '';
      if (!filesList.length) {
        labelSummary.textContent = 'Chưa chọn ảnh.';
        return;
      }
      labelSummary.textContent = `${filesList.length} ảnh đã sẵn sàng tải lên.`;
      filesList.slice(0, 16).forEach((file, index) => {
        const readerBlobUrl = URL.createObjectURL(file);
        activeObjectUrls.push(readerBlobUrl);
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'preview-thumb';
        thumbDiv.title = file.name;
        thumbDiv.innerHTML = `<img src="${readerBlobUrl}" alt="Ảnh xem trước ${index + 1}">`;
        gridHolder.appendChild(thumbDiv);
      });
      if (filesList.length > 16) {
        const remainderCounterBadge = document.createElement('div');
        remainderCounterBadge.className = 'preview-thumb';
        remainderCounterBadge.style.cssText = `display:grid;place-items:center;color:var(--primary-2);background:rgba(216,180,109,.05);`;
        remainderCounterBadge.textContent = `+${filesList.length - 16}`;
        gridHolder.appendChild(remainderCounterBadge);
      }
    }


    function parseRequestedItemNames(rawValue) {
      const seen = new Set();
      return String(rawValue || '').split(/\r?\n|;/).map(item => item.trim().replace(/^[-•\d.)\s]+/, '')).filter(Boolean).filter(item => {
        const normalized = item.toLocaleLowerCase('vi');
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
    }


    function updateRequestedItemDraft(index, value) {
      if (!caseRequestedItemsDraft[index]) return;
      caseRequestedItemsDraft[index].tenHangMuc = String(value || '').trimStart();
      if (!caseRequestedItemsDraft[index]._userSetCategory) {
        const detectedKey = getCategoryGroupInfo(value).key;
        caseRequestedItemsDraft[index].phanLoai = detectedKey;
        const catDef = EXCEL_CATEGORY_DEFS[detectedKey] || EXCEL_CATEGORY_DEFS.damages;
        const btn = document.getElementById(`excelCategoryBtn_${index}`);
        if (btn) {
          btn.style.borderColor = catDef.border;
          btn.style.background = catDef.bg;
          btn.style.color = catDef.color;
          const iconSlot = btn.querySelector('.cat-icon-slot');
          const labelSlot = btn.querySelector('.cat-label-slot');
          const codeSlot = btn.querySelector('.cat-code-slot');
          if (iconSlot) iconSlot.innerHTML = catDef.svg;
          if (labelSlot) labelSlot.textContent = catDef.label;
          if (codeSlot) codeSlot.textContent = catDef.code;
        }
      }
      updateRequestedItemsCount();
    }


    function toggleExcelCategoryDropdown(itemIndex, event) {
      if (event) event.stopPropagation();

      let menu = document.getElementById('globalExcelCategoryPopoverMenu');
      if (!menu) {
        menu = document.createElement('div');
        menu.id = 'globalExcelCategoryPopoverMenu';
        menu.className = 'custom-category-popover-menu';
        document.body.appendChild(menu);
      }

      const isCurrentOpen = (menu.style.display === 'block' && menu.dataset.activeCardIndex == itemIndex);

      if (isCurrentOpen) {
        menu.style.display = 'none';
        delete menu.dataset.activeCardIndex;
        document.querySelectorAll('[id^="excelCatArrow_"]').forEach(el => el.style.transform = 'rotate(0deg)');
        return;
      }

      const btnWrap = document.getElementById(`excelCategoryWrap_${itemIndex}`);
      const arrow = document.getElementById(`excelCatArrow_${itemIndex}`);
      if (!btnWrap) return;

      const rect = btnWrap.getBoundingClientRect();
      const currentKey = (caseRequestedItemsDraft[itemIndex] && caseRequestedItemsDraft[itemIndex].phanLoai) || 'damages';

      const categoryList = [EXCEL_CATEGORY_DEFS.damages, EXCEL_CATEGORY_DEFS.overall, EXCEL_CATEGORY_DEFS.documents];

      menu.innerHTML = `
        <div style="padding: 6px 10px; font-size: 10px; font-weight: 850; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--border); margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span>PHÂN LOẠI NHÓM HẠNG MỤC</span>
          <span style="font-weight: 750; color: var(--primary); font-size: 9.5px;">CHỌN MỤC</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 5px;">
          ${categoryList.map(cat => {
            const isSelected = (currentKey === cat.key);
            return `
              <button type="button" onclick="selectExcelCategory(${itemIndex}, '${cat.key}')" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 11px; font-size: 12px; font-weight: 750; color: ${cat.color}; background: ${isSelected ? cat.bg : 'var(--bg-soft)'}; border: 1px solid ${isSelected ? cat.border : 'var(--border)'}; border-radius: 10px; cursor: pointer; text-align: left; transition: all 0.2s ease;">
                <div style="width: 32px; height: 32px; border-radius: 9px; background: ${cat.bg}; color: ${cat.color}; display: grid; place-items: center; flex-shrink: 0; border: 1px solid ${cat.border};">
                  ${cat.svg}
                </div>
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-weight: 850; font-size: 12.5px; color: var(--text-main);">${cat.label}</span>
                    <span style="font-size: 9.5px; font-weight: 850;  padding: 1px 6px; border-radius: 5px; background: ${cat.bg}; border: 1px solid ${cat.border}; color: ${cat.color};">${cat.code}</span>
                  </div>
                  <span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat.subtitle}</span>
                </div>
                ${isSelected ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${cat.color}" stroke-width="2.8" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      `;

      menu.style.position = 'fixed';
      menu.style.top = `${rect.bottom + 6}px`;
      menu.style.left = `${rect.left}px`;
      menu.style.width = `${Math.max(rect.width, 275)}px`;
      menu.style.zIndex = '999999';
      menu.style.background = 'var(--surface)';
      menu.style.border = '1.5px solid var(--border)';
      menu.style.borderRadius = '14px';
      menu.style.padding = '8px';
      menu.style.boxShadow = '0 18px 45px rgba(0,0,0,0.28)';
      menu.style.backdropFilter = 'blur(20px)';
      menu.style.webkitBackdropFilter = 'blur(20px)';
      menu.style.boxSizing = 'border-box';
      menu.style.display = 'block';
      menu.dataset.activeCardIndex = itemIndex;

      document.querySelectorAll('[id^="excelCatArrow_"]').forEach(el => el.style.transform = 'rotate(0deg)');
      if (arrow) arrow.style.transform = 'rotate(180deg)';
    }


    function selectExcelCategory(itemIndex, categoryKey) {
      if (!caseRequestedItemsDraft[itemIndex]) return;
      caseRequestedItemsDraft[itemIndex].phanLoai = categoryKey;
      caseRequestedItemsDraft[itemIndex]._userSetCategory = true;

      const menu = document.getElementById('globalExcelCategoryPopoverMenu');
      if (menu) {
        menu.style.display = 'none';
        delete menu.dataset.activeCardIndex;
      }
      document.querySelectorAll('[id^="excelCatArrow_"]').forEach(el => el.style.transform = 'rotate(0deg)');

      renderRequestedItemsBuilder();
    }


    function removeRequestedItemDraft(index) {
      caseRequestedItemsDraft.splice(index, 1);
      if (caseRequestedItemsDraft.length === 0) {
        caseRequestedItemsDraft.push({ id: generateUniqueReqId(), tenHangMuc: '' });
      }
      renderRequestedItemsBuilder();
      const nextFocusIndex = Math.min(index, caseRequestedItemsDraft.length - 1);
      setTimeout(() => {
        const inputToFocus = document.getElementById(`excelInput_${nextFocusIndex}`);
        if (inputToFocus) inputToFocus.focus();
      }, 10);
    }


    function generateUniqueReqId() {
      return `REQ_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    }


    function renderSuggestionsSection() {}
