

    function bindAndFetchCaseRealtimeSync(caseId, currentViewFlag) {
      renderLoadingLayoutIndicator('Đang khởi chạy luồng liên kết bảo mật dữ liệu...');

      dbNodeInstance.ref(`cases/${caseId}`).on('value', (dataSnapshot) => {
        const databaseValueObject = dataSnapshot.val();
        
        if (!databaseValueObject) {
          renderErrorLayoutState('Mã định danh ca xe không hợp lệ hoặc tài nguyên đã bị xóa trên cơ sở dữ liệu Cloud.');
          return;
        }

        const currentUser = firebase.auth().currentUser;
        const isAdmin = activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin';
        if (currentUser && currentViewFlag === 'result') {
          if (!isAdmin && databaseValueObject.nguoiTao && databaseValueObject.nguoiTao.uid !== currentUser.uid) {
            renderErrorLayoutState('Bạn không có quyền truy cập hồ sơ này (Access Denied).');
            return;
          }
        }

        localActiveCaseNode = databaseValueObject;
        localActiveImageStack = Array.isArray(databaseValueObject.hinhAnh) ? databaseValueObject.hinhAnh : Object.values(databaseValueObject.hinhAnh || {});
        localActiveRequestedItems = Array.isArray(databaseValueObject.hangMucYeuCauAnh) ? databaseValueObject.hangMucYeuCauAnh : Object.values(databaseValueObject.hangMucYeuCauAnh || {});

        const shouldForceReadOnlyResultView = currentViewFlag === 'result';
        const isCaseLockedByGarageSubmission = localActiveCaseNode.trangThai === STATUS_COMPLETED;

        if (shouldForceReadOnlyResultView || isCaseLockedByGarageSubmission) {
          garagePortalMounted = false;
          renderPortalResultReadOnlyView(shouldForceReadOnlyResultView ? 'result' : 'garage-locked');
        } else if (garagePortalMounted && document.querySelector('[data-garage-portal="active"]')) {
          refreshGarageProgressUI();
          refreshAllEvidenceCardsFromState();
        } else {
          renderPortalGarageInteractiveInputView();
        }
      }, (networkException) => {
        renderErrorLayoutState('Lỗi cổng kết nối truyền tải: ' + networkException.message);
      });
    }


    function toggleSidebarCollapse() {
      if (typeof window.sidebarCollapseState === 'undefined') {
        window.sidebarCollapseState = (window.innerWidth <= 1050);
      }
      window.sidebarCollapseState = !window.sidebarCollapseState;
      const bodyEl = document.getElementById('sidebarBodyContent');
      const chevronEl = document.getElementById('sidebarChevronIcon');
      if (bodyEl) {
        bodyEl.classList.toggle('is-hidden', window.sidebarCollapseState);
        bodyEl.style.display = window.sidebarCollapseState ? 'none' : 'block';
      }
      if (chevronEl) {
        chevronEl.style.transform = window.sidebarCollapseState ? 'rotate(-90deg)' : 'rotate(0deg)';
      }
    }


    function buildHtmlComponentSidebarCaseMetadata(viewContextMode) {
      const isReadOnlyMode = (viewContextMode === 'result' || viewContextMode === 'garage-locked');
      const showBackButton = (viewContextMode === 'result');
      const isAdjusterView = (viewContextMode === 'result');
      const node = localActiveCaseNode || {};
      const creatorName = node.nguoiTao?.tenHienThi || node.nguoiTao?.email || 'Hồ sơ trước phiên bản mới';
      const creatorMeta = [node.nguoiTao?.chucDanh, node.nguoiTao?.donVi].filter(Boolean).join(' · ');
      const createdDate = formatCaseTimestamp(node.createdAt);

      if (typeof window.sidebarCollapseState === 'undefined') {
        window.sidebarCollapseState = (window.innerWidth <= 1050);
      }
      const isCollapsed = !!window.sidebarCollapseState;

      return `
        <aside id="caseSidebarCard" class="p-card sticky-sidebar">
          <div class="p-card-head" onclick="toggleSidebarCollapse()" style="cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h2 style="margin: 0; font-size: 15px; font-weight: 800;">${isReadOnlyMode ? 'Thông tin đối chiếu' : 'Thông tin hồ sơ'}</h2>
              <p style="margin-top: 2px; font-size: 10px; color: var(--text-muted);">${isReadOnlyMode ? 'Dữ liệu đã được Garage xác nhận.' : 'Cổng khai báo dành cho Garage.'}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
              <div class="section-number">${isReadOnlyMode ? 'R' : 'G'}</div>
              <div id="sidebarChevronIcon" style="width: 26px; height: 26px; border-radius: 50%; background: var(--surface); border: 1px solid var(--border); display: grid; place-items: center; color: var(--text-muted); transition: transform 0.2s ease; transform: ${isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
          </div>
          
          <div class="collapsible-summary-tag" onclick="toggleSidebarCollapse()" style="cursor: pointer; margin-top: 8px; padding: 6px 10px; background: var(--bg-soft); border-radius: 8px; font-size: 11px; color: var(--text-soft); display: flex; align-items: center; justify-content: space-between;">
            <span>BKS: <strong style="color: var(--primary); ">${escapeHtmlOutput(node.bienSo || 'N/A')}</strong></span>
            <span>Gara: <strong style="color: var(--text-main);">${escapeHtmlOutput(node.tenGara || 'N/A')}</strong></span>
          </div>

          <div id="sidebarBodyContent" class="sidebar-body-content ${isCollapsed ? 'is-hidden' : ''}" style="display: ${isCollapsed ? 'none' : 'block'}; margin-top: 14px;">
            
            <div class="case-id-chip"><span>Mã hồ sơ</span><strong>${escapeHtmlOutput(node.idCa)}</strong></div>
            <div class="metadata-list">
              <div class="metadata-row"><span>Biển kiểm soát</span><strong>${escapeHtmlOutput(node.bienSo)}</strong></div>
              <div class="metadata-row"><span>Garage phụ trách</span><strong>${escapeHtmlOutput(node.tenGara)}</strong></div>
              <div class="metadata-row"><span>Người tạo hồ sơ</span><strong>${escapeHtmlOutput(creatorName)}${creatorMeta ? `<small style="display:block;margin-top:3px;color:var(--text-muted);font-size:8px;font-weight:700">${escapeHtmlOutput(creatorMeta)}</small>` : ``}</strong></div>
              <div class="metadata-row"><span>Thời gian khởi tạo</span><strong>${escapeHtmlOutput(createdDate.date)} · ${escapeHtmlOutput(createdDate.time)}</strong></div>
              <div class="metadata-row"><span>Ảnh cần Garage định danh</span><strong>${Number(node.soLuongAnh || localActiveImageStack.length)} ảnh</strong></div>
              <div class="metadata-row"><span>Hạng mục cần Garage cung cấp ảnh</span><strong>${Number(node.soLuongHangMucYeuCauAnh || localActiveRequestedItems.length)} hạng mục</strong></div>
              <div class="metadata-row"><span>Trạng thái</span><strong><span class="badge-status ${node.trangThai === STATUS_COMPLETED ? 'completed' : 'pending'}">${escapeHtmlOutput(node.trangThai)}</span></strong></div>
            </div>
            <div class="sidebar-tip">Hoàn thành cả hai nhóm: ghi rõ hạng mục theo ảnh hiện trạng và tải ảnh minh chứng cho từng hạng mục được yêu cầu.</div>
            ${isReadOnlyMode && !isAdjusterView ? `<div class="badge-status completed" style="width:100%;justify-content:center;padding:12px">Hồ sơ đã khóa</div>` : (!isReadOnlyMode ? `
              <button id="btnDraftGarageResponse" class="btn-premium btn-secondary" style="width:100%; margin-bottom:8px; border:1px solid rgba(179,140,67,0.3) !important;">Lưu nháp hồ sơ</button>
              <button id="btnSubmitGarageFinalResponse" class="btn-premium" style="width:100%;">${SVGS.CHECK_CIRCLE} Hoàn tất & gửi kết quả</button>
            ` : '')}
          </div>
        </aside>`;
    }


    function renderEvidenceGalleryMarkup(item, requestIndex) {
      const urls = normalizeEvidenceImageUrls(item);
      if (!urls.length) return `<div class="evidence-empty-gallery" style="color: var(--text-muted); font-size:11px; font-style:italic;">Chưa có ảnh nào được lưu cho hạng mục này.</div>`;
      return urls.map((url,imageIndex) => `<div class="evidence-preview-item">
        <img src="${escapeAttributeData(url)}" alt="Ảnh minh chứng ${imageIndex+1}" loading="lazy" onclick="openLightbox(normalizeEvidenceImageUrls(localActiveRequestedItems[${requestIndex}]), ${imageIndex}, ${requestIndex})">
        <span class="evidence-order">${String(imageIndex+1).padStart(2,'0')}</span>
        <button type="button" class="evidence-remove-btn" title="Xóa ảnh" onclick="event.stopPropagation();removeGarageEvidenceImage(${requestIndex},${imageIndex})">${SVGS.TRASH}</button>
      </div>`).join('');
    }


    function getCategoryBadgeMarkup(itemName, isGarageCustom = false) {
      if (isGarageCustom) {
        return `<span class="category-badge" style="background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; line-height: 1;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg><span>Bắt buộc chụp từ Camera</span></span>`;
      }
      const lower = normalizeVietnameseText(itemName || '');
      if (lower.includes('ca vet') || lower.includes('giay phep') || lower.includes('gplx') || lower.includes('cccd') || lower.includes('can cuoc') || lower.includes('so dang kiem')) {
        return `<span class="category-badge" style="background: rgba(59,130,246,0.12); color: #3b82f6; border: 1px solid rgba(59,130,246,0.25); font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; line-height: 1;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span>Giấy tờ xe</span></span>`;
      }
      if (lower.includes('tong the') || lower.includes('tem dang kiem') || lower.includes('so khung') || lower.includes('vin')) {
        return `<span class="category-badge" style="background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.25); font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; line-height: 1;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg><span>Ảnh tiêu chuẩn</span></span>`;
      }
      return `<span class="category-badge" style="background: rgba(216,180,109,0.12); color: var(--primary); border: 1px solid rgba(216,180,109,0.25); font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; line-height: 1;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg><span>Hạng mục tổn thất</span></span>`;
    }


    function getCategoryGroupInfo(itemName, isGarageCustom = false, itemObj = null) {
      const explicitCat = (itemObj && itemObj.phanLoai) || (typeof itemName === 'object' && itemName ? itemName.phanLoai : null);
      if (explicitCat && ['documents', 'overall', 'damages'].includes(explicitCat)) {
        if (explicitCat === 'documents') {
          return {
            key: 'documents',
            title: 'GIẤY TỜ XE & HỒ SƠ PHÁP LÝ',
            subtitle: 'Cà vẹt xe, Giấy phép lái xe, CCCD và Sổ đăng kiểm xe',
            color: '#3b82f6',
            badgeBg: 'rgba(59,130,246,0.12)',
            iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`
          };
        }
        if (explicitCat === 'overall') {
          return {
            key: 'overall',
            title: 'HÌNH ẢNH TỔNG THỂ XE',
            subtitle: 'Ảnh tổng thể 4 góc chéo của xe, Tem đăng kiểm và Số khung (VIN)',
            color: '#10b981',
            badgeBg: 'rgba(16,185,129,0.12)',
            iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`
          };
        }
        return {
          key: 'damages',
          title: 'HÌNH ẢNH GIÁM ĐỊNH TỔN THẤT',
          subtitle: 'Chi tiết vị trí va chạm, linh kiện và phụ tùng hư hỏng',
          color: 'var(--primary)',
          badgeBg: 'rgba(216,180,109,0.12)',
          iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`
        };
      }
      if (isGarageCustom) {
        return {
          key: 'damages',
          title: 'HÌNH ẢNH GIÁM ĐỊNH TỔN THẤT',
          subtitle: 'Các hạng mục tổn thất do Gara khởi tạo bổ sung tại xưởng',
          color: 'var(--primary)',
          badgeBg: 'rgba(216,180,109,0.12)',
          iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`
        };
      }
      const lower = normalizeVietnameseText(itemName || '');
      if (lower.includes('ca vet') || lower.includes('giay phep') || lower.includes('gplx') || lower.includes('cccd') || lower.includes('can cuoc') || lower.includes('so dang kiem')) {
        return {
          key: 'documents',
          title: 'GIẤY TỜ XE & HỒ SƠ PHÁP LÝ',
          subtitle: 'Cà vẹt xe, Giấy phép lái xe, CCCD và Sổ đăng kiểm xe',
          color: '#3b82f6',
          badgeBg: 'rgba(59,130,246,0.12)',
          iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`
        };
      }
      if (lower.includes('tong the') || lower.includes('hien trang tong the') || lower.includes('tem dang kiem') || lower.includes('so khung') || lower.includes('vin') || lower.includes('4 goc cheo') || lower.includes('4 goc xe')) {
        return {
          key: 'overall',
          title: 'HÌNH ẢNH TỔNG THỂ XE',
          subtitle: 'Ảnh tổng thể 4 góc chéo của xe, Tem đăng kiểm và Số khung (VIN)',
          color: '#10b981',
          badgeBg: 'rgba(16,185,129,0.12)',
          iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`
        };
      }
      return {
        key: 'damages',
        title: 'HÌNH ẢNH GIÁM ĐỊNH TỔN THẤT',
        subtitle: 'Chi tiết vị trí va chạm, linh kiện và phụ tùng hư hỏng',
        color: 'var(--primary)',
        badgeBg: 'rgba(216,180,109,0.12)',
        iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`
      };
    }


    async function triggerAddNewGarageItemFromPortal() {
      const inputEl = document.getElementById('txtGarageNewItemName');
      if (!inputEl) return;
      const itemName = inputEl.value.trim();
      if (!itemName) {
        return triggerToast('Vui lòng nhập tên hạng mục cần chụp ảnh.', 'error');
      }

      if (!Array.isArray(localActiveRequestedItems)) {
        localActiveRequestedItems = [];
      }

      const newItem = {
        id: generateUniqueReqId(),
        tenHangMuc: itemName,
        thuTu: localActiveRequestedItems.length + 1,
        hinhAnhGarage: [],
        ghiChuGarage: '',
        taoBoiGara: true
      };

      localActiveRequestedItems.push(newItem);

      try {
        toggleUploadOverlay(true, 'Đang tạo hạng mục mới...', 'Đồng bộ dữ liệu sang máy chủ Cloud...', 40);
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh`).set(localActiveRequestedItems);
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/soLuongHangMucYeuCauAnh`).set(localActiveRequestedItems.length);
        
        inputEl.value = '';
        triggerToast(`Đã tạo hạng mục "${itemName}". Bạn có thể chụp/tải ảnh ngay!`, 'success');
        
        if (!window.sectionCollapseState) window.sectionCollapseState = {};
        window.sectionCollapseState['damages'] = false;
        renderPortalGarageInteractiveInputView();
        
        setTimeout(() => {
          const newCardIndex = localActiveRequestedItems.length - 1;
          const newCard = document.getElementById(`evidenceRequestCard_${newCardIndex}`);
          if (newCard) {
            newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            newCard.style.boxShadow = '0 0 0 2px var(--primary)';
            setTimeout(() => newCard.style.boxShadow = '', 2200);
          }
        }, 120);
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi tạo hạng mục: ' + err.message, 'error');
      } finally {
        toggleUploadOverlay(false);
      }
    }


    async function triggerRemoveGarageCustomItem(itemIndex) {
      if (!localActiveRequestedItems || !localActiveRequestedItems[itemIndex]) return;
      const item = localActiveRequestedItems[itemIndex];
      const confirmAction = await showConfirmModal('Xóa hạng mục', `Bạn có chắc muốn xóa hạng mục "${item.tenHangMuc}" khỏi danh sách?`);
      if (!confirmAction) return;

      localActiveRequestedItems.splice(itemIndex, 1);
      localActiveRequestedItems.forEach((it, idx) => { it.thuTu = idx + 1; });

      try {
        toggleUploadOverlay(true, 'Đang xóa hạng mục...', 'Đồng bộ dữ liệu...', 40);
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh`).set(localActiveRequestedItems);
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/soLuongHangMucYeuCauAnh`).set(localActiveRequestedItems.length);
        
        triggerToast('Đã xóa hạng mục thành công.', 'warning');
        renderPortalGarageInteractiveInputView();
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi xóa hạng mục: ' + err.message, 'error');
      } finally {
        toggleUploadOverlay(false);
      }
    }


    function filterPortalHangMucCards(searchTerm) {
      portalSearchTerm = searchTerm;
      const term = (searchTerm || '').trim().toLowerCase();
      const sections = document.querySelectorAll('.evidence-group-section');
      
      sections.forEach(section => {
        const cards = section.querySelectorAll('.evidence-request-card');
        let visibleCardsInGroup = 0;
        
        cards.forEach(card => {
          const titleEl = card.querySelector('h3');
          if (!titleEl) return;
          const text = (titleEl.textContent || '').toLowerCase();
          
          if (!term || text.includes(term)) {
            card.style.display = '';
            visibleCardsInGroup++;
          } else {
            card.style.display = 'none';
          }
        });
        
        if (term && visibleCardsInGroup === 0) {
          section.style.display = 'none';
        } else {
          section.style.display = '';
          const body = section.querySelector('.evidence-cards-list');
          const chevron = section.querySelector('.evidence-group-header [id^="evidenceGroupChevron_"]');
          const header = section.querySelector('.evidence-group-header');
          if (term) {
            if (body) {
              body.style.display = 'flex';
              body.classList.remove('is-hidden');
            }
            if (chevron) {
              chevron.style.transform = 'rotate(0deg)';
            }
            if (header) {
              header.style.marginBottom = '8px';
            }
          } else {
            const key = header?.id?.replace('evidenceGroupHeader_', '');
            const isCollapsed = key ? !!(window.sectionCollapseState && window.sectionCollapseState[key]) : true;
            if (body) {
              body.style.display = isCollapsed ? 'none' : 'flex';
              if (isCollapsed) body.classList.add('is-hidden');
              else body.classList.remove('is-hidden');
            }
            if (chevron) {
              chevron.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
            }
            if (header) {
              header.style.marginBottom = isCollapsed ? '0' : '8px';
            }
          }
        }
      });
      
      const existingNoResult = document.getElementById('noPortalHangMucResult');
      if (existingNoResult) existingNoResult.remove();
      
      const allCards = document.querySelectorAll('.evidence-request-card');
      let totalVisible = 0;
      allCards.forEach(c => {
        if (c.style.display !== 'none') totalVisible++;
      });
      
      if (term && totalVisible === 0) {
        const noResultDiv = document.createElement('div');
        noResultDiv.id = 'noPortalHangMucResult';
        noResultDiv.style.cssText = 'padding: 24px; text-align: center; color: var(--text-soft); font-size: 13px; font-style: italic; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; margin-top: 8px;';
        noResultDiv.innerHTML = 'Không tìm thấy hạng mục nào khớp với "<strong style="color: var(--primary);">' + escapeHtmlOutput(searchTerm) + '</strong>"';
        const searchInput = document.getElementById('searchPortalHangMucInput');
        if (searchInput && searchInput.parentNode) {
          searchInput.parentNode.parentNode.insertBefore(noResultDiv, searchInput.parentNode.nextSibling);
        }
      }
      syncWorkshopDisclosures();
    }


    function toggleEvidenceGroupSection(groupKey) {
      if (!window.sectionCollapseState) window.sectionCollapseState = {};
      const currentState = !!window.sectionCollapseState[groupKey];
      const newState = !currentState;
      window.sectionCollapseState[groupKey] = newState;

      const bodyEl = document.getElementById(`evidenceGroupBody_${groupKey}`);
      const chevronEl = document.getElementById(`evidenceGroupChevron_${groupKey}`);
      const headerEl = document.getElementById(`evidenceGroupHeader_${groupKey}`);

      if (bodyEl) {
        bodyEl.classList.toggle('is-hidden', newState);
        bodyEl.style.display = newState ? 'none' : 'flex';
      }
      if (chevronEl) {
        chevronEl.style.transform = newState ? 'rotate(-90deg)' : 'rotate(0deg)';
      }
      if (headerEl) {
        headerEl.style.marginBottom = newState ? '0' : '8px';
      }
      syncWorkshopDisclosures();
    }


    function toggleAllSections(expand) {
      if (!window.sectionCollapseState) window.sectionCollapseState = {};
      if (!window.cardCollapseState) window.cardCollapseState = {};

      ['documents', 'overall', 'damages'].forEach(key => {
        window.sectionCollapseState[key] = !expand;
        const bodyEl = document.getElementById(`evidenceGroupBody_${key}`);
        const chevronEl = document.getElementById(`evidenceGroupChevron_${key}`);
        const headerEl = document.getElementById(`evidenceGroupHeader_${key}`);
        if (bodyEl) {
          bodyEl.classList.toggle('is-hidden', !expand);
          bodyEl.style.display = expand ? 'flex' : 'none';
        }
        if (chevronEl) {
          chevronEl.style.transform = expand ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
        if (headerEl) {
          headerEl.style.marginBottom = expand ? '8px' : '0';
        }
      });

      if (typeof localActiveRequestedItems !== 'undefined' && localActiveRequestedItems) {
        localActiveRequestedItems.forEach((_, idx) => {
          window.cardCollapseState[idx] = !expand;
          const bodyEl = document.getElementById(`evidenceCardBody_${idx}`);
          const chevronEl = document.getElementById(`evidenceCardChevron_${idx}`);
          if (bodyEl) bodyEl.style.display = expand ? 'block' : 'none';
          if (chevronEl) chevronEl.style.transform = expand ? 'rotate(0deg)' : 'rotate(-90deg)';
        });
      }
      syncWorkshopDisclosures();
    }


    function toggleSingleCardCollapse(index) {
      if (!window.cardCollapseState) window.cardCollapseState = {};
      const currentIsCollapsed = (index in window.cardCollapseState) ? window.cardCollapseState[index] : true;
      const newState = !currentIsCollapsed;
      window.cardCollapseState[index] = newState;

      const bodyEl = document.getElementById(`evidenceCardBody_${index}`);
      const chevronEl = document.getElementById(`evidenceCardChevron_${index}`);
      
      if (bodyEl) {
        bodyEl.style.display = newState ? 'none' : 'block';
      }
      if (chevronEl) {
        chevronEl.style.transform = newState ? 'rotate(-90deg)' : 'rotate(0deg)';
      }
      syncWorkshopDisclosures();
    }


    function triggerUploadFromGallery(index) {
      prefetchGpsCoordinates();
      const inputEl = document.getElementById(`garageEvidenceInput_${index}`);
      if (inputEl) {
        inputEl.removeAttribute('capture');
        inputEl.dataset.sourceType = 'gallery';
        inputEl.click();
      }
    }


    function openMobileCameraForEvidence(index) {
      prefetchGpsCoordinates();
      // Use the custom camera modal to allow continuous capturing on all devices
      openCustomCameraModal(index);
    }


    function closeCameraViewfinderWithGuideModal() {
      const modalEl = document.getElementById('cameraGuideModal');
      if (modalEl) modalEl.style.display = 'none';
    }


    async function toggleDamageSeverityTag(itemIndex, tag) {
      if (!localActiveRequestedItems || !localActiveRequestedItems[itemIndex]) return;
      const item = localActiveRequestedItems[itemIndex];
      let currentTags = (item.mucDoHuHong || '').split(',').map(s => s.trim()).filter(Boolean);
      if (currentTags.includes(tag)) {
        currentTags = currentTags.filter(t => t !== tag);
      } else {
        currentTags.push(tag);
      }
      item.mucDoHuHong = currentTags.join(', ');
      
      try {
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh/${itemIndex}/mucDoHuHong`).set(item.mucDoHuHong);
      } catch (e) {
        console.error(e);
      }
      renderPortalGarageInteractiveInputView();
    }


    async function setProposedAction(itemIndex, action) {
      if (!localActiveRequestedItems || !localActiveRequestedItems[itemIndex]) return;
      const item = localActiveRequestedItems[itemIndex];
      item.phuongAnDeXuat = item.phuongAnDeXuat === action ? '' : action;
      
      try {
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh/${itemIndex}/phuongAnDeXuat`).set(item.phuongAnDeXuat);
      } catch (e) {
        console.error(e);
      }
      renderPortalGarageInteractiveInputView();
    }


    async function saveDamageSeverityCustom(itemIndex, val) {
      if (!localActiveRequestedItems || !localActiveRequestedItems[itemIndex]) return;
      localActiveRequestedItems[itemIndex].mucDoHuHong = val.trim();
      try {
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh/${itemIndex}/mucDoHuHong`).set(val.trim());
      } catch (e) {
        console.error(e);
      }
    }


    function toggleCustomDamageDropdown(itemIndex, event) {
      if (event) event.stopPropagation();
      
      let menu = document.getElementById('globalDamagePopoverMenu');
      if (!menu) {
        menu = document.createElement('div');
        menu.id = 'globalDamagePopoverMenu';
        menu.className = 'custom-damage-popover-menu';
        document.body.appendChild(menu);
      }

      const isCurrentOpen = (menu.style.display === 'block' && menu.dataset.activeCardIndex == itemIndex);

      if (isCurrentOpen) {
        menu.style.display = 'none';
        delete menu.dataset.activeCardIndex;
        document.querySelectorAll('[id^="customDropdownArrow_"]').forEach(el => el.style.transform = 'rotate(0deg)');
        return;
      }

      const comboboxWrap = document.getElementById(`damageCombobox_${itemIndex}`);
      const arrow = document.getElementById(`customDropdownArrow_${itemIndex}`);
      if (!comboboxWrap) return;

      const rect = comboboxWrap.getBoundingClientRect();

      const options = [
        { text: 'Trầy xước', svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; color:var(--primary);"><line x1="4" y1="16" x2="16" y2="4"></line><line x1="8" y1="20" x2="20" y2="8"></line></svg>` },
        { text: 'Móp méo', svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; color:var(--primary);"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>` },
        { text: 'Bể / Vỡ', svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; color:var(--primary);"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>` },
        { text: 'Cong vênh', svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; color:var(--primary);"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>` },
        { text: 'Rách', svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; color:var(--primary);"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.47" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>` },
        { text: 'Trầy xước & Móp méo', svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; color:var(--primary);"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>` },
        { text: 'Sơn trầy / Bong tróc', svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; color:var(--primary);"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path></svg>` },
        { text: 'Biến dạng gãy vỡ', svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; color:var(--primary);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>` }
      ];

      menu.innerHTML = `
        <div style="padding: 6px 10px 6px; font-size: 10px; font-weight: 850; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--border); margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span>GỢI Ý MÔ TẢ TỔN THẤT MẪU</span>
          <span style="font-weight: 750; color: var(--primary); font-size: 9.5px;">CHỌN NHANH</span>
        </div>
        <div class="custom-popover-options-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto;">
          ${options.map(opt => `
            <button type="button" class="popover-option-item" onclick="applyCustomPresetNote(${itemIndex}, '${opt.text}')" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 12px; font-size: 12.5px; font-weight: 700; color: var(--text-main); background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.2s ease;">
              <span style="width: 26px; height: 26px; border-radius: 6px; background: rgba(216,180,109,0.15); display: grid; place-items: center; flex-shrink: 0;">${opt.svg}</span>
              <span style="flex: 1; min-width: 0;">${opt.text}</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.4; flex-shrink:0;"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          `).join('')}
        </div>
      `;

      menu.style.position = 'fixed';
      menu.style.top = `${rect.bottom + 6}px`;
      menu.style.left = `${rect.left}px`;
      menu.style.width = `${rect.width}px`;
      menu.style.zIndex = '999999';
      menu.style.background = 'var(--surface)';
      menu.style.border = '1.5px solid var(--border)';
      menu.style.borderRadius = '12px';
      menu.style.padding = '8px';
      menu.style.boxShadow = '0 16px 40px rgba(0,0,0,0.25)';
      menu.style.backdropFilter = 'blur(16px)';
      menu.style.webkitBackdropFilter = 'blur(16px)';
      menu.style.boxSizing = 'border-box';
      menu.style.display = 'block';
      menu.dataset.activeCardIndex = itemIndex;

      document.querySelectorAll('[id^="customDropdownArrow_"]').forEach(el => el.style.transform = 'rotate(0deg)');
      if (arrow) arrow.style.transform = 'rotate(180deg)';
    }


    async function applyCustomPresetNote(itemIndex, val) {
      const menu = document.getElementById('globalDamagePopoverMenu');
      if (menu) {
        menu.style.display = 'none';
        delete menu.dataset.activeCardIndex;
      }
      document.querySelectorAll('[id^="customDropdownArrow_"]').forEach(el => el.style.transform = 'rotate(0deg)');

      const inputEl = document.getElementById(`garageEvidenceNote_${itemIndex}`);
      if (inputEl) inputEl.value = val;

      if (!localActiveRequestedItems || !localActiveRequestedItems[itemIndex]) return;
      localActiveRequestedItems[itemIndex].ghiChuGarage = val;
      localActiveRequestedItems[itemIndex].mucDoHuHong = val;

      try {
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh/${itemIndex}/ghiChuGarage`).set(val);
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh/${itemIndex}/mucDoHuHong`).set(val);
        triggerToast(`Đã ghi nhận: "${val}"`, 'info');
      } catch (e) {
        console.error(e);
      }
    }


    async function saveGarageEvidenceNoteDirect(itemIndex, val) {
      if (!localActiveRequestedItems || !localActiveRequestedItems[itemIndex]) return;
      const cleanVal = val.trim();
      localActiveRequestedItems[itemIndex].ghiChuGarage = cleanVal;
      try {
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh/${itemIndex}/ghiChuGarage`).set(cleanVal);
      } catch (e) {
        console.error(e);
      }
    }


    function renderPortalGarageInteractiveInputView() {
      if (!localActiveImageStack.length && !localActiveRequestedItems.length && !localActiveCaseNode) return renderErrorLayoutState('Hồ sơ hiện tại chưa có nội dung yêu cầu Garage xử lý.');
      garagePortalMounted = true;
      try { prefetchGpsCoordinates(); } catch (_) {}

      let imageInputSection = '';
      if (localActiveImageStack.length > 0) {
        if (localActiveRequestedItems.length > 0) {
          imageInputSection = `
            <div class="workspace-section-head">
              <div>
                <h2>01 · Bể ảnh giám định từ Giám định viên</h2>
                <p>Kho ảnh chụp hiện trạng tổn thất do GĐV tải lên lúc lập hồ sơ. Gara đối chiếu và chọn ảnh tương ứng cho từng hạng mục bên dưới.</p>
              </div>
              <div class="workspace-section-index">${String(localActiveImageStack.length).padStart(2,'0')} FRAMES</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; margin-bottom: 20px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm);">
              ${localActiveImageStack.map((item, index) => {
                const mappedItems = [];
                localActiveRequestedItems.forEach((reqItem, reqIdx) => {
                  const urls = normalizeEvidenceImageUrls(reqItem);
                  if (urls.includes(item.linkAnh)) {
                    mappedItems.push(reqItem.tenHangMuc || `Hạng mục ${reqIdx + 1}`);
                  }
                });
                const isMapped = mappedItems.length > 0;
                const mapLabel = isMapped 
                  ? `<div id="imageMapLabel_${index}" style="width: 100%; text-align: center;"><span style="background: rgba(16,185,129,0.15); color: #10b981; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px;">Đã khớp: ${mappedItems.join(', ')}</span></div>`
                  : `<div id="imageMapLabel_${index}" style="width: 100%; text-align: center;"><span style="background: var(--surface-soft); color: var(--text-muted); font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">Chưa phân loại</span></div>`;
                return `
                  <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                    <div class="preview-thumb" style="width: 100%; aspect-ratio: 4/3; margin-bottom: 4px; cursor: zoom-in;" onclick="openLightbox(localActiveImageStack.map(x => x.linkAnh), ${index})">
                      <img src="${escapeAttributeData(item.linkAnh)}" style="width:100%; height:100%; object-fit:cover; border-radius: 8px;" />
                    </div>
                    <span style=" font-size: 10px; font-weight: 800; color: var(--text-soft);">Ảnh ${index + 1}</span>
                    ${mapLabel}
                  </div>
                `;
              }).join('')}
            </div>
          `;
        } else {
          imageInputSection = `
            <div class="workspace-section-head"><div><h2>01 · Xác định hạng mục từ ảnh hiện trạng</h2><p>Nội dung được tự động lưu trong khi Garage nhập, không bị mất khi tải ảnh ở nhóm bên dưới.</p></div><div class="workspace-section-index">${String(localActiveImageStack.length).padStart(2,'0')} FRAMES</div></div>
            ${localActiveImageStack.map((item, index) => `
              <article class="premium-image-card">
                <div class="img-display-pane"><span class="img-pane-indicator">Ảnh hiện trạng ${String(index + 1).padStart(2,'0')}</span><img src="${escapeAttributeData(item.linkAnh)}" alt="Ảnh tổn thất ${index + 1}" loading="lazy" onclick="openLightbox(localActiveImageStack.map(x => x.linkAnh), ${index})" /></div>
                <div class="inputs-entry-pane">
                  <div><div class="image-sequence">DAMAGE FRAME / ${String(index + 1).padStart(2,'0')}</div><div class="form-group" style="margin:0"><label>Tên bộ phận và phương án khắc phục</label><textarea class="garage-quote-textarea-node input-premium" data-index-token="${index}" placeholder="Ví dụ:\n• Thay mới cụm đèn pha trước phải\n• Gò nắn phục hồi tai bắt cản\n• Sơn hoàn thiện vè trước phải">${escapeHtmlOutput(item.hangMucBaoGia || '')}</textarea><div id="garageNoteSaveState_${index}" class="autosave-state">Đã bật tự động lưu</div></div></div>
                  <button class="btn-premium btn-secondary btn-inline" onclick="window.open('${escapeAttributeData(item.linkAnh)}','_blank')">${SVGS.EXTERNAL} Mở ảnh nguyên bản</button>
                </div>
              </article>`).join('')}`;
        }
      }

      const groupedDefinitions = [
        {
          key: 'documents',
          indexNum: '01',
          title: 'HỒ SƠ PHÁP LÝ & GIẤY TỜ XE',
          subtitle: 'Cà vẹt xe, GPLX, Đăng kiểm & GCN bảo hiểm ô tô tiếp nhận',
          color: '#3b82f6',
          badgeBg: 'rgba(59,130,246,0.12)',
          iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`
        },
        {
          key: 'overall',
          indexNum: '02',
          title: 'HIỆN TRẠNG TỔNG THỂ XE VÀO XƯỞNG',
          subtitle: 'Ảnh 4 góc chéo xe nhận vào Gara, Tem đăng kiểm & Số khung (VIN)',
          color: '#10b981',
          badgeBg: 'rgba(16,185,129,0.12)',
          iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`
        },
        {
          key: 'damages',
          indexNum: '03',
          title: 'GIÁM ĐỊNH TỔN THẤT & BÁO GIÁ SỬA CHỮA / THAY THẾ',
          subtitle: 'Khảo sát va chạm thực tế, chọn Sửa chữa/Thay thế & Chụp ảnh minh chứng tại xưởng',
          color: 'var(--primary)',
          badgeBg: 'rgba(216,180,109,0.12)',
          iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`
        }
      ];

      const garageAddItemBox = `
        <article class="p-card garage-add-item-box" style="padding: 22px 24px; border: 2px dashed var(--primary); background: rgba(216,180,109,0.04); border-radius: 16px; margin-top: 18px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(216,180,109,0.15); color: var(--primary); display: grid; place-items: center; flex-shrink: 0;">${SVGS.SPARKLES}</div>
              <div>
                <h3 style="font-size: 15px; font-weight: 850; color: var(--text-main); margin: 0;">Gara tự thêm hạng mục chụp ảnh tại chỗ</h3>
                <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px; margin-bottom: 0;">Nhập tên bộ phận tổn thất/sửa chữa thực tế để khởi tạo thẻ chụp ảnh tức thì.</p>
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <input id="txtGarageNewItemName" class="input-premium" type="text" placeholder="Ví dụ: Vè trước trái, Cản trước trầy xước, Đèn pha vỡ..." style="flex: 1; min-width: 220px; height: 42px; font-size: 13px;" onkeydown="if(event.key==='Enter'){event.preventDefault();triggerAddNewGarageItemFromPortal();}" />
            <button type="button" class="btn-premium" onclick="triggerAddNewGarageItemFromPortal()" style="width: auto !important; padding: 0 20px; height: 42px; font-size: 12px; font-weight: 800; border-radius: 8px;">
              ${SVGS.CAMERA} Tạo hạng mục & Tải ảnh ngay
            </button>
          </div>
        </article>
      `;

      const renderSingleCardMarkup = (item, index) => {
        const urls = normalizeEvidenceImageUrls(item);
        const isGarageCustomItem = !!item.taoBoiGara;
        const categoryBadge = getCategoryBadgeMarkup(item.tenHangMuc, isGarageCustomItem);
        const canDeleteCustomItem = urls.length === 0 && isGarageCustomItem;

        const hiddenFileInputMarkup = `<input id="garageEvidenceInput_${index}" class="garage-evidence-input" data-request-index="${index}" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden />`;

        const groupInfo = getCategoryGroupInfo(item.tenHangMuc, isGarageCustomItem);
        const isDocumentGroupItem = (groupInfo.key === 'documents');

        let actionButtonsMarkup = '';
        let appraisalPickerMarkup = '';

        appraisalPickerMarkup = '';
        actionButtonsMarkup = `
          ${hiddenFileInputMarkup}
          <div class="evidence-upload-actions" style="margin-bottom: 8px; width: 100%; display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn-premium" onclick="openMobileCameraForEvidence(${index})" style="flex: 1; min-width: 120px; min-height: 38px; font-size: 12px; border-radius: 8px; background: linear-gradient(135deg, #d8b46d 0%, #b38c43 100%); color: #080b11; font-weight: 850; border: none; box-shadow: 0 4px 12px rgba(216,180,109,0.25); display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: transform 0.15s ease;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span>Chụp ảnh</span>
            </button>
            <button type="button" class="btn-premium btn-secondary" onclick="triggerUploadFromGallery(${index})" style="flex: 1; min-width: 120px; min-height: 38px; font-size: 12px; border-radius: 8px; background: var(--surface); color: var(--text-main); font-weight: 800; border: 1px solid var(--border); display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: background 0.15s ease;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#3b82f6" stroke-width="2.5" style="flex-shrink:0;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
              <span>Tải từ máy</span>
            </button>
          </div>
        `;

        const isDamageItem = getCategoryGroupInfo(item.tenHangMuc, isGarageCustomItem).key === 'damages';
        const DAMAGE_TAG_ICONS = {
          'Trầy xước': `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><line x1="4" y1="16" x2="16" y2="4"></line><line x1="8" y1="20" x2="20" y2="8"></line></svg>`,
          'Móp méo': `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>`,
          'Bể / Vỡ': `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
          'Cong vênh': `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`,
          'Rách': `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.47" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>`
        };

        const damageMetaSelectorMarkup = isDamageItem ? `
          <div style="margin-bottom: 8px; width: 100%;">
            <div style="display: flex; gap: 6px; width: 100%;">
              <button type="button" class="workshop-plan-button" aria-pressed="${item.phuongAnDeXuat === 'sua_chua'}" onclick="setProposedAction(${index}, 'sua_chua')" style="flex: 1; height: 34px; font-size: 11.5px; font-weight: 800; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 1px solid ${item.phuongAnDeXuat === 'sua_chua' ? '#3b82f6' : 'var(--border)'}; background: ${item.phuongAnDeXuat === 'sua_chua' ? 'rgba(59,130,246,0.15)' : 'var(--surface)'}; color: ${item.phuongAnDeXuat === 'sua_chua' ? '#3b82f6' : 'var(--text-soft)'}; display: flex; align-items: center; justify-content: center; gap: 5px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                <span>Sửa chữa</span>
              </button>
              <button type="button" class="workshop-plan-button" aria-pressed="${item.phuongAnDeXuat === 'thay_the'}" onclick="setProposedAction(${index}, 'thay_the')" style="flex: 1; height: 34px; font-size: 11.5px; font-weight: 800; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 1px solid ${item.phuongAnDeXuat === 'thay_the' ? '#ef4444' : 'var(--border)'}; background: ${item.phuongAnDeXuat === 'thay_the' ? 'rgba(239,68,68,0.15)' : 'var(--surface)'}; color: ${item.phuongAnDeXuat === 'thay_the' ? '#ef4444' : 'var(--text-soft)'}; display: flex; align-items: center; justify-content: center; gap: 5px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                <span>Thay thế</span>
              </button>
            </div>
          </div>
          <div id="damageCombobox_${index}" class="custom-premium-combobox" style="position: relative; display: flex; align-items: center; gap: 6px; width: 100%; margin-bottom: 4px;">
            <button type="button" onclick="toggleCustomDamageDropdown(${index}, event)" style="flex: 1; min-width: 0; height: 36px !important; min-height: 36px !important; max-height: 36px !important; line-height: 34px !important; font-size: 12px; padding: 0 8px; border-radius: 8px; background: rgba(216,180,109,0.14); color: var(--primary); font-weight: 800; border: 1px solid rgba(216,180,109,0.3); display: inline-flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: all 0.2s ease; box-sizing: border-box !important; white-space: nowrap;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              <span>Mẫu mô tả</span>
              <svg id="customDropdownArrow_${index}" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <input type="text" id="garageEvidenceNote_${index}" class="evidence-note" placeholder="Mô tả chi tiết tổn thất..." value="${escapeAttributeData(item.ghiChuGarage || item.mucDoHuHong || '')}" onchange="saveGarageEvidenceNoteDirect(${index}, this.value)" style="flex: 1; min-width: 0; height: 36px !important; min-height: 36px !important; max-height: 36px !important; line-height: 34px !important; font-size: 12px; font-weight: 600; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); padding: 0 10px; color: var(--text-main); box-sizing: border-box !important; outline: none; margin: 0; text-align: center;" />
          </div>
          <div id="garageEvidenceNoteState_${index}" class="autosave-state" style="font-size: 9.5px; margin-top: 3px;">Tự động lưu</div>
        ` : '';

        const isCardCollapsed = (window.cardCollapseState && index in window.cardCollapseState) ? !!window.cardCollapseState[index] : true;

        return `<article id="evidenceRequestCard_${index}" class="evidence-request-card ${urls.length ? 'is-complete' : ''}" style="margin-bottom: 8px; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--surface); transition: all 0.2s ease;">
          ${renderWorkshopCardHeader(item,index,urls,canDeleteCustomItem,isCardCollapsed)}
          <div id="evidenceCardBody_${index}" class="evidence-request-body" style="padding: 10px 12px; display: ${isCardCollapsed ? 'none' : 'block'}; border-top: 1px solid var(--border);">
            ${appraisalPickerMarkup}
            ${actionButtonsMarkup}
            ${damageMetaSelectorMarkup}
            <div id="evidenceGalleryContainer_${index}" class="evidence-existing-wrap" style="${urls.length ? '' : 'display: none;'}"><div class="evidence-existing-title"><span>Ảnh đã lưu trên hệ thống</span><span id="evidenceCount_${index}">${urls.length} ảnh</span></div><div id="garageEvidencePreview_${index}" class="evidence-preview-grid">${renderEvidenceGalleryMarkup(item,index)}</div></div>
          </div>
        </article>`;
      };

      if (!window.sectionCollapseState) {
        window.sectionCollapseState = {
          documents: true,
          overall: true,
          damages: true
        };
      }

      const toggleAllToolbarMarkup = renderWorkshopToolbar(groupedDefinitions);

      const evidenceRequestSection = localActiveRequestedItems.length ? toggleAllToolbarMarkup + groupedDefinitions.map(def => {
        const matchingIndices = [];
        localActiveRequestedItems.forEach((item, index) => {
          const groupInfo = getCategoryGroupInfo(item.tenHangMuc, !!item.taoBoiGara);
          if (groupInfo.key === def.key) matchingIndices.push(index);
        });

        if (matchingIndices.length === 0 && def.key !== 'damages') return '';

        let completedCount = 0;
        matchingIndices.forEach(idx => {
          if (normalizeEvidenceImageUrls(localActiveRequestedItems[idx]).length > 0) completedCount++;
        });

        const isCollapsed = !!(window.sectionCollapseState && window.sectionCollapseState[def.key]);
        const cardsHTML = matchingIndices.map(idx => renderSingleCardMarkup(localActiveRequestedItems[idx], idx)).join('');

        return `
          <div class="evidence-group-section" style="margin-top: 6px; margin-bottom: 6px;">
            ${renderWorkshopGroupHeader(def,completedCount,matchingIndices.length,isCollapsed)}
            <div id="evidenceGroupBody_${def.key}" class="evidence-cards-list ${isCollapsed ? 'is-hidden' : ''}" style="display: ${isCollapsed ? 'none' : 'flex'}; flex-direction: column; gap: 8px;">
              ${cardsHTML}
              ${def.key === 'damages' ? garageAddItemBox : ''}
            </div>
          </div>
        `;
      }).join('') : '';

      const searchActive = document.activeElement && document.activeElement.id === 'searchPortalHangMucInput';
      const selStart = searchActive ? document.activeElement.selectionStart : null;
      const selEnd = searchActive ? document.activeElement.selectionEnd : null;

      const activeThemeIcon = currentTheme === 'light' ? SVGS.MOON : SVGS.SUN;
      const nodeData = localActiveCaseNode || {};
      rootContainer.innerHTML = `
        <div class="portal-shell" data-garage-portal="active">
          ${renderWorkshopHero(nodeData,activeThemeIcon)}

          <div class="focus-portal-layout">${buildHtmlComponentSidebarCaseMetadata('input')}<div class="image-workspace-list workshop-workspace">${imageInputSection}${evidenceRequestSection || garageAddItemBox}</div></div>
          ${renderWorkshopBottomBar()}
        </div>`;

      document.querySelectorAll('.garage-quote-textarea-node').forEach(textarea => {
        textarea.addEventListener('input', () => { scheduleGarageImageNoteAutosave(Number(textarea.dataset.indexToken), textarea.value); refreshGarageProgressUI(); });
      });
      document.querySelectorAll('.garage-evidence-input').forEach(input => input.addEventListener('change', () => handleGarageEvidenceFiles(Number(input.dataset.requestIndex), Array.from(input.files || []))));
      document.querySelectorAll('.evidence-note').forEach(textarea => {
        const index = Number(textarea.id.split('_').pop());
        textarea.addEventListener('input', () => scheduleGarageEvidenceNoteAutosave(index, textarea.value));
      });
      document.querySelectorAll('[data-evidence-dropzone]').forEach(dropzone => {
        ['dragenter','dragover'].forEach(eventName => dropzone.addEventListener(eventName, event => { event.preventDefault(); event.stopPropagation(); dropzone.classList.add('is-dragging'); }));
        ['dragleave','drop'].forEach(eventName => dropzone.addEventListener(eventName, event => { event.preventDefault(); event.stopPropagation(); dropzone.classList.remove('is-dragging'); }));
        dropzone.addEventListener('drop', event => handleGarageEvidenceFiles(Number(dropzone.dataset.evidenceDropzone), Array.from(event.dataTransfer.files || [])));
      });
      
      const submitBtn = document.getElementById('btnSubmitGarageFinalResponse');
      if (submitBtn) submitBtn.addEventListener('click', pipelineTriggerGarageDataLockSubmission);

      const desktopDraftBtn = document.getElementById('btnDraftGarageResponse');
      if (desktopDraftBtn) desktopDraftBtn.addEventListener('click', triggerManualGarageDraftSave);

      const mobileSubmitBtn = document.getElementById('btnMobileSubmitGarageResponse');
      if (mobileSubmitBtn) mobileSubmitBtn.addEventListener('click', pipelineTriggerGarageDataLockSubmission);

      const mobileDraftBtn = document.getElementById('btnMobileDraftGarageResponse');
      if (mobileDraftBtn) mobileDraftBtn.addEventListener('click', triggerManualGarageDraftSave);

      initializeSidebarCollapse();
      refreshGarageProgressUI();
      if (portalSearchTerm) {
        filterPortalHangMucCards(portalSearchTerm);
      }
      if (searchActive) {
        const inputEl = document.getElementById('searchPortalHangMucInput');
        if (inputEl) {
          inputEl.focus();
          if (selStart !== null && selEnd !== null) {
            inputEl.setSelectionRange(selStart, selEnd);
          }
        }
      }
    }


function cameraLocationError(status) {
  return {address:null,coords:null,status,timestamp:Date.now()};
}
