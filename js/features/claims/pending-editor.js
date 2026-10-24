

    /****************************************************
     * SMART PARSER ENGINE & PENDING CLAIMS SYSTEM
     ****************************************************/
    function formatCurrencyInputNumber(val) {
      if (val === null || val === undefined || val === '') return '';
      const numStr = String(val).replace(/\D/g, '');
      if (!numStr) return '';
      return Number(numStr).toLocaleString('vi-VN');
    }


    function formatCurrencyInputEvent(el) {
      if (!el) return;
      const cursorLoc = el.selectionStart;
      const oldLen = el.value.length;
      const cleanVal = el.value.replace(/\D/g, '');
      if (!cleanVal) {
        el.value = '';
        return;
      }
      el.value = Number(cleanVal).toLocaleString('vi-VN');
      const newLen = el.value.length;
      if (cursorLoc !== null) {
        const newPos = Math.max(0, cursorLoc + (newLen - oldLen));
        el.setSelectionRange(newPos, newPos);
      }
    }


    function parseDamageReportText(rawText) {
      if (!rawText || typeof rawText !== 'string') return {};

      const getValue = (labels) => {
        for (const label of labels) {
          const regex = new RegExp(`(?:-|^|\\n)\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:=]\\s*([^\\n]+)`, 'i');
          const match = rawText.match(regex);
          if (match && match[1]) {
            let val = match[1].trim();
            val = val.replace(/\s*@\S+.*$/, '').replace(/[\.\s]+$/, '').trim();
            if (val && val !== '-') return val;
          }
        }
        return '';
      };

      const maVuTonThat = getValue(['Mã số vụ tổn thất', 'Mã VTT', 'Mã vụ tổn thất', 'Mã hồ sơ', 'Mã vụ']);
      const soHoSoBoiThuong = getValue(['Số HSBT', 'Số hồ sơ bồi thường', 'Số hồ sơ BT', 'Số HSBT/BT', 'Số HS bồi thường', 'Số hồ sơ']);
      const bienSo = getValue(['BSX', 'Biển số', 'Biển kiểm soát', 'Biển số xe']);
      const donViCapDon = getValue(['ĐV cấp đơn', 'Đơn vị cấp đơn', 'Chi nhánh cấp đơn']);
      const hangXe = getValue(['Hãng xe']);
      const hieuXe = getValue(['Hiệu xe']);
      const namSanXuat = getValue(['Năm SX', 'Năm sản xuất']);
      const vcx = getValue(['VCX', 'Bảo hiểm VCX']);
      const tnds = getValue(['TNDS', 'Bảo hiểm TNDS']);
      const ngayThongBao = getValue(['Ngày thông báo', 'Thời gian thông báo']);
      const ngayVTT = getValue(['Ngày VTT', 'Ngày xảy ra VTT', 'Ngày tổn thất']);
      const diaDiemVTT = getValue(['Địa điểm VTT', 'Địa điểm tổn thất', 'Nơi xảy ra VTT']);
      const nguyenNhan = getValue(['Nguyên nhân', 'Nguyên nhân VTT']);
      const moTaTonThat = getValue(['Mô tả tổn thất', 'Mô tả VTT', 'Tổn thất']);
      const hienTruong = getValue(['Hiện trường', 'Tình trạng hiện trường']);
      const laiXe = getValue(['Lái xe', 'Tài xế']);
      const nguoiLienHe = getValue(['Người liên hệ', 'Liên hệ']);
      const gdvTiepNhan = getValue(['GĐV tiếp nhận VTT', 'GĐV tiếp nhận', 'GĐV phụ trách', 'Giám định viên']);
      const canBoXuLy = getValue(['Cán bộ xử lý', 'CBXL']);

      let fullHangXe = hangXe;
      if (hieuXe && !hangXe.toLowerCase().includes(hieuXe.toLowerCase())) {
        fullHangXe = `${hangXe} ${hieuXe}`.trim();
      }

      return {
        maVuTonThat,
        soHoSoBoiThuong,
        bienSo,
        donViCapDon,
        hangXe: fullHangXe,
        hieuXe,
        namSanXuat,
        vcx,
        tnds,
        ngayThongBao,
        ngayVTT,
        diaDiemVTT,
        nguyenNhan,
        moTaTonThat,
        hienTruong,
        laiXe,
        nguoiLienHe,
        gdvTiepNhan,
        canBoXuLy,
        rawText
      };
    }


    function findExistingClaimByMaVTT(maVuTonThat) {
      if (!maVuTonThat || typeof maVuTonThat !== 'string') return null;
      const targetNorm = maVuTonThat.trim().toLowerCase();
      if (!targetNorm || targetNorm === '—' || targetNorm === '-') return null;

      const claimsList = Object.values(cachedPendingClaimsPayload || {});
      return claimsList.find(c => {
        if (!c.maVuTonThat) return false;
        const itemNorm = String(c.maVuTonThat).trim().toLowerCase();
        return itemNorm === targetNorm;
      });
    }


    function checkModalDuplicateMaVTT(val) {
      const warnEl = document.getElementById('modalMaVttDuplicateWarning');
      const inputEl = document.getElementById('modalPendingMaVuTonThat');
      if (!warnEl) return null;

      const existing = findExistingClaimByMaVTT(val);
      if (existing) {
        warnEl.style.display = 'block';
        warnEl.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--warning); display: inline-block; vertical-align: middle; margin-right: 4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Đã tồn tại hồ sơ (${escapeHtmlOutput(existing.bienSo)} - GĐV: ${escapeHtmlOutput(existing.gdvTiepNhan)})!`;
        if (inputEl) inputEl.style.borderColor = '#ef4444';
        return existing;
      } else {
        warnEl.style.display = 'none';
        warnEl.textContent = '';
        if (inputEl) inputEl.style.borderColor = '';
        return null;
      }
    }


    function openAddPendingClaimModal() {
      resetClaimDocumentContext();
      if (!hasUserPermission('pending', 'add')) {
        triggerToast('Bạn không có quyền tiếp nhận hồ sơ tổn thất mới.', 'warning');
        return;
      }
      const modal = document.getElementById('addPendingClaimModalOverlay');
      if (!modal) return;

      editingPendingClaimId = null;
      ClaimReductionNotice.load({});

      modal.querySelectorAll('input[id^="modalPending"],textarea[id^="modalPending"]').forEach(field => { field.value = ''; });

      updateHeaderCancelClaimProposalButton(null);

      const titleEl = document.getElementById('addPendingClaimModalTitle');
      if (titleEl) titleEl.textContent = 'Tiếp nhận hồ sơ tổn thất mới';

      const btnSubmitSpan = document.querySelector('#btnSubmitAddPendingClaim span');
      if (btnSubmitSpan) btnSubmitSpan.textContent = 'Lưu hồ sơ tiếp nhận';

      // Clear paste box
      const pasteArea = document.getElementById('modalTxtQuickPasteMessage');
      if (pasteArea) pasteArea.value = '';

      // Clear duplicate warning
      checkModalDuplicateMaVTT('');

      // Clear or preset form inputs
      const profile = activeUserProfile || {};
      const currentUser = firebase.auth().currentUser;

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
      };

      setVal('modalPendingMaVuTonThat', `VTT/XCG/${new Date().getFullYear()}/${Math.floor(100000 + Math.random() * 900000)}`);
      setVal('modalPendingSoHoSoBoiThuong', '');
      setVal('modalPendingBienSo', '');
      setVal('modalPendingKhachHang', '');
      setVal('modalPendingSoKhungSoMay', '');
      setVal('modalPendingTinhTonThat', '');
      setVal('modalPendingDonViCapDon', '');
      setVal('modalPendingHangXe', '');
      setVal('modalPendingHieuXe', '');
      setVal('modalPendingNamSanXuat', '');
      setVal('modalPendingGdvTiepNhan', profile.displayName || currentUser?.email || '');
      setVal('modalPendingCanBoXuLy', '');
      setVal('modalPendingNgayThongBao', new Date().toLocaleString('vi-VN'));
      setVal('modalPendingNgayVTT', '');
      setVal('modalPendingDiaDiemVTT', '');
      setVal('modalPendingHienTruong', '');
      setVal('modalPendingLaiXe', '');
      setVal('modalPendingNguoiLienHe', '');
      setVal('modalPendingLoaiTonThat', '');
        setVal('modalPendingVcx', '');
      setVal('modalPendingTnds', '');
      setVal('modalPendingNguyenNhan', '');
      setVal('modalPendingMoTaTonThat', '');
      setVal('modalPendingGhiChu', '');
      setVal('modalPendingTndsGhiChu', '');
      loadSceneDiagramForClaim(null);
      const addTndsInfoEl = document.getElementById('modalPendingTndsLastUpdatedInfo');
      if (addTndsInfoEl) addTndsInfoEl.innerHTML = '';

      initializeCollectionGuide();
      bindCurrentClaimDocuments(claimDocumentStore.draftId,claimDocumentFormReference(claimDocumentStore.draftId));
      claimDocumentStore.ready = true;
      switchEditClaimTab('Policy');

      modal.style.display = 'grid';
      modal.setAttribute('aria-hidden', 'false');
      if (typeof ClaimEditorWorkspace !== 'undefined') ClaimEditorWorkspace.open();
    }


    async function openEditPendingClaimModal(claimId, initialTab) {
      resetClaimDocumentContext();
      const openDocumentSequence=claimDocumentStore.formSequence;
      if (!claimId || !cachedPendingClaimsPayload) return;
      
      const btnSubmit = document.getElementById('btnSubmitAddPendingClaim');
      if (btnSubmit) {
        if (!hasUserPermission('pending', 'edit')) {
          btnSubmit.disabled = true;
          btnSubmit.style.opacity = '0.5';
          btnSubmit.style.pointerEvents = 'none';
          btnSubmit.title = 'Bạn không có quyền chỉnh sửa hồ sơ này';
        } else {
          btnSubmit.disabled = false;
          btnSubmit.style.opacity = '1';
          btnSubmit.style.pointerEvents = 'auto';
          btnSubmit.title = '';
        }
      }
      let item = cachedPendingClaimsPayload[claimId];
      if (!item) {
        item = Object.values(cachedPendingClaimsPayload).find(c => c && (c.id === claimId || c.idCa === claimId || c.maVuTonThat === claimId));
      }
      if (!item) {
        triggerToast('Không tìm thấy dữ liệu hồ sơ để chỉnh sửa.', 'error');
        return;
      }

      editingPendingClaimId = claimId;
      // Tải trước danh sách tài liệu Drive song song với việc điền form: mở tab Tài liệu hồ sơ là có ngay.
      if (typeof ClaimDocuments !== 'undefined') ClaimDocuments.prefetch();
      const isEditing = true;

      updateHeaderCancelClaimProposalButton(item);

      const titleEl = document.getElementById('addPendingClaimModalTitle');
      // Biển số & khách hàng đã hiển thị ở thẻ "Hồ sơ đang mở" bên trái nên tiêu đề không lặp lại.
      if (titleEl) titleEl.textContent = 'Chỉnh sửa thông tin hồ sơ';

      const btnSubmitSpan = document.querySelector('#btnSubmitAddPendingClaim span');
      if (btnSubmitSpan) btnSubmitSpan.textContent = 'Lưu cập nhật hồ sơ';

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
      };

      // Clear duplicate warning
      checkModalDuplicateMaVTT('');

      setVal('modalPendingMaVuTonThat', item.maVuTonThat || '');
      setVal('modalPendingSoHoSoBoiThuong', item.soHoSoBoiThuong || '');
      setVal('modalPendingBienSo', item.bienSo || '');
      setVal('modalPendingSoKhungSoMay', item.soKhungSoMay || item.rawBsxFull || item.bienSo || '');
      setVal('modalPendingKhachHang', item.khachHang || '');
      setVal('modalPendingSoHd', item.soHd || '');
      setVal('modalPendingSoGcn', item.soGcn || '');
      setVal('modalPendingNguoiCapDon', item.nguoiCapDon || '');
      setVal('modalPendingNgayHieuLuc', formatCleanDateField(item.ngayHieuLuc));
      setVal('modalPendingNgayHetHan', formatCleanDateField(item.ngayHetHan));
      setVal('modalPendingKenhKhaiThac', item.kenhKhaiThac || '');
      setVal('modalPendingGiaTriXe', formatCurrencyInputNumber(item.giaTriXe));
      setVal('modalPendingSoTienBh', formatCurrencyInputNumber(item.soTienBh));
      setVal('modalPendingPhiBh', formatCurrencyInputNumber(item.phiBh));

      setVal('modalPendingHangXe', item.hangXe || '');
      setVal('modalPendingHieuXe', item.hieuXe || '');
      setVal('modalPendingLoaiXe', item.loaiXe || '');
      setVal('modalPendingNamSanXuat', item.namSanXuat || '');
      setVal('modalPendingMdsd', item.mdsd || '');
      setVal('modalPendingSoChoTrongTai', item.soChoTrongTai || '');
      setVal('modalPendingLaiXe', item.laiXe || '');
      setVal('modalPendingNguoiLienHe', item.nguoiLienHe || item.khachHang || '');
      const spCodeVal = String(item.maSpNghiepVu || item.nghiepVu || item.loaiHinhBaoHiem || '').trim();
      const isVcxCode = spCodeVal.toUpperCase().includes('VCX');
      const isTndsCode = spCodeVal.toUpperCase().includes('TNDS');
      setVal('modalPendingLoaiTonThat', item.loaiTonThat || '');
        setVal('modalPendingVcx', item.vcx || (isVcxCode ? (spCodeVal || 'VCX') : ''));
      setVal('modalPendingTnds', item.tnds || (isTndsCode ? (spCodeVal || 'TNDS') : ''));

      setVal('modalPendingNgayThongBao', formatCleanDateField(item.ngayThongBao) || (isEditing ? '' : new Date().toLocaleString('vi-VN')));
      setVal('modalPendingNgayMoHs', formatCleanDateField(item.ngayMoHs));
      setVal('modalPendingNgayVTT', formatCleanDateField(item.ngayVTT || item.ngayTonThat || item.date || item.ngayMoHs));
      setVal('modalPendingTinhTonThat', item.tinhTonThat || '');
      setVal('modalPendingDiaDiemVTT', item.diaDiemVTT || item.diaDiemTonThat || '');
      setVal('modalPendingHienTruong', item.hienTruong || item.diaDiemTonThat || '');
      setVal('modalPendingNguyenNhan', item.nguyenNhan || item.nhomNguyenNhan || '');
      setVal('modalPendingMoTaTonThat', item.moTaTonThat || item.dienBienTonThat || '');
      await loadSceneDiagramForClaim(item, claimId);
      if(editingPendingClaimId!==claimId || openDocumentSequence!==claimDocumentStore.formSequence)return;

      setVal('modalPendingDonViCapDon', item.donViCapDon || item.chiNhanh || '');
      setVal('modalPendingChiNhanhXuly', item.chiNhanhXuly || '');
      setVal('modalPendingTtkd', item.ttkd || item.phongBan || '');
      setVal('modalPendingGdvTiepNhan', item.gdvTiepNhan || '');
      setVal('modalPendingCanBoXuLy', item.canBoXuLy || '');
      setVal('modalPendingZoneBoiThuong', item.zoneBoiThuong || item.khuVucGiamDinh || '');
      setVal('modalPendingGaraSuaChua', item.garaSuaChua || '');
      setVal('modalPendingTenGaraVietTat', item.tenGaraVietTat || '');

      setVal('modalPendingUocThietHai', formatCurrencyInputNumber(item.uocThietHai));
      setVal('modalPendingPascSoTienDuyet', formatCurrencyInputNumber(item.pascSoTienDuyet || item.soTienDuyetBT));
      setVal('modalPendingPascNguoiDuyet', item.pascNguoiDuyet || '');
      setVal('modalPendingToTrinhNguoiDuyet', item.toTrinhNguoiDuyet || item['Tờ trình BT - Người duyệt'] || item['Tờ trình BT – Người duyệt'] || '');
      setVal('modalPendingPascNgayDuyet', formatCleanDateField(item.pascNgayDuyet || item['PASC - Ngày duyệt cuối'] || item['PASC – Ngày duyệt cuối']));
      setVal('modalPendingToTrinhNgayDuyet', formatCleanDateField(getClaimToTrinhDuyetDate(item)));
      const rawTtbtAmt = item.ttbtTongSoTienBoiThuong || item.tongBoiThuongSauThue || item.pascSoTienDuyet || item.soTienDuyetBT || item.ttbtSoTienBoiThuong || item.amount;
      setVal('modalPendingTtbtTongSoTienBoiThuong', formatCurrencyInputNumber(rawTtbtAmt));
      setVal('modalPendingDuPhongBoiThuong', formatCurrencyInputNumber(item.duPhongBoiThuong));
      setVal('modalPendingSoTienDaThanhToan', formatCurrencyInputNumber(item.soTienDaThanhToan));
      setVal('modalPendingNgayThanhToan', formatCleanDateField(item.ngayThanhToan));
      setVal('modalPendingNgayNhanDuHoSo', formatCleanDateField(item.ngayNhanDuHoSo));
      setVal('modalPendingNgayKtXacNhan', formatCleanDateField(item.ngayKtXacNhan));
      setVal('modalPendingGhiChu', item.ghiChu || '');
      ClaimReductionNotice.load(item.thongBaoGiamTru || {});
      setVal('modalPendingTndsGhiChu', item.tndsGhiChu || '');

      const editTndsInfoEl = document.getElementById('modalPendingTndsLastUpdatedInfo');
      if (editTndsInfoEl) {
        if (item.tndsLastUpdated) {
          editTndsInfoEl.innerHTML = `Lần cập nhật cuối: <b style="color: var(--text-main);">${formatTndsTimestampDisplay(item.tndsLastUpdated)}</b> bởi <b style="color: var(--primary);">${escapeHtmlOutput(item.tndsUpdatedBy || 'Hệ thống')}</b>`;
        } else {
          editTndsInfoEl.innerHTML = `<span style="color: var(--text-soft); font-style: italic;">Chưa có cập nhật</span>`;
        }
      }

      await loadCollectionGuideForClaim(item, claimId);
      if(editingPendingClaimId!==claimId || openDocumentSequence!==claimDocumentStore.formSequence)return;
      switchEditClaimTab(initialTab || 'Policy');

      const modal = document.getElementById('addPendingClaimModalOverlay');
      if (modal) {
        modal.style.display = 'grid';
        modal.setAttribute('aria-hidden', 'false');
        if (typeof ClaimEditorWorkspace !== 'undefined') ClaimEditorWorkspace.open();
      }
    }


    function closeAddPendingClaimModal() {
      document.getElementById('collectionGuidePreview')?._guideEditor?.flush();
      scheduleCollectionGuideAutoSave();
      resetClaimDocumentContext();
      sceneDiagramLoadSequence++;
      clearCollectionGuideDraft();
      const modal = document.getElementById('addPendingClaimModalOverlay');
      if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
      editingPendingClaimId = null;
      if (typeof ClaimEditorWorkspace !== 'undefined') ClaimEditorWorkspace.close();
    }


    function switchEditClaimTab(tabName) {
      const tabs = ['Policy', 'Vehicle', 'Event', 'Unit', 'Financial', 'Documents', 'CollectionGuide', 'AuthorityRequest'];
      tabs.forEach(t => {
        const tabBtn = document.getElementById('tabBtn_' + t);
        const tabPane = document.getElementById('tabPane_' + t);
        if (tabBtn) tabBtn.classList.toggle('active', t === tabName);
        if (tabPane) tabPane.style.display = (t === tabName) ? 'block' : 'none';
      });
      if (tabName === 'AuthorityRequest') { ensureCollectionGuide(); authorityRequestRefresh(); }
      if (tabName === 'Documents') ClaimDocuments.render();
      if (tabName === 'CollectionGuide') { ensureCollectionGuide(); refreshCollectionGuideSummary(); }
      if (typeof ClaimEditorWorkspace !== 'undefined') ClaimEditorWorkspace.tabChanged(tabName);
    }


    function executeModalParseText() {
      const pasteArea = document.getElementById('modalTxtQuickPasteMessage');
      if (!pasteArea) return;
      const rawText = pasteArea.value.trim();
      if (!rawText) {
        triggerToast('Vui lòng dán nội dung tin nhắn thông báo tổn thất.', 'warning');
        return;
      }

      const parsed = parseDamageReportText(rawText);
      
      const setValIfPresent = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.value = val;
      };

      if (parsed.maVuTonThat) setValIfPresent('modalPendingMaVuTonThat', parsed.maVuTonThat);
      if (parsed.soHoSoBoiThuong) setValIfPresent('modalPendingSoHoSoBoiThuong', parsed.soHoSoBoiThuong);
      if (parsed.bienSo) setValIfPresent('modalPendingBienSo', parsed.bienSo);
      if (parsed.donViCapDon) setValIfPresent('modalPendingDonViCapDon', parsed.donViCapDon);
      if (parsed.hangXe) setValIfPresent('modalPendingHangXe', parsed.hangXe);
      if (parsed.hieuXe) setValIfPresent('modalPendingHieuXe', parsed.hieuXe);
      if (parsed.namSanXuat) setValIfPresent('modalPendingNamSanXuat', parsed.namSanXuat);
      if (parsed.gdvTiepNhan) setValIfPresent('modalPendingGdvTiepNhan', parsed.gdvTiepNhan);
      if (parsed.canBoXuLy) setValIfPresent('modalPendingCanBoXuLy', parsed.canBoXuLy);
      if (parsed.ngayThongBao) setValIfPresent('modalPendingNgayThongBao', parsed.ngayThongBao);
      if (parsed.ngayVTT) setValIfPresent('modalPendingNgayVTT', parsed.ngayVTT);
      if (parsed.diaDiemVTT) setValIfPresent('modalPendingDiaDiemVTT', parsed.diaDiemVTT);
      if (parsed.hienTruong) setValIfPresent('modalPendingHienTruong', parsed.hienTruong);
      if (parsed.laiXe) setValIfPresent('modalPendingLaiXe', parsed.laiXe);
      if (parsed.nguoiLienHe) setValIfPresent('modalPendingNguoiLienHe', parsed.nguoiLienHe);
      if (parsed.loaiTonThat) setValIfPresent('modalPendingLoaiTonThat', parsed.loaiTonThat);
        if (parsed.vcx) setValIfPresent('modalPendingVcx', parsed.vcx);
      if (parsed.tnds) setValIfPresent('modalPendingTnds', parsed.tnds);
      if (parsed.nguyenNhan) setValIfPresent('modalPendingNguyenNhan', parsed.nguyenNhan);
      if (parsed.moTaTonThat) setValIfPresent('modalPendingMoTaTonThat', parsed.moTaTonThat);

      // Check if duplicate MaVuTonThat exists
      if (!editingPendingClaimId && parsed.maVuTonThat) {
        const existing = checkModalDuplicateMaVTT(parsed.maVuTonThat);
        if (existing) {
          if (window.Swal) {
            Swal.fire({
              icon: 'warning',
              title: 'Cảnh báo: Hồ sơ đã tồn tại!',
              html: `Mã vụ tổn thất <b>${escapeHtmlOutput(parsed.maVuTonThat)}</b> đã có trong hệ thống từ trước.<br><br>` +
                    `<b>Biển số:</b> ${escapeHtmlOutput(existing.bienSo)}<br>` +
                    `<b>GĐV tiếp nhận:</b> ${escapeHtmlOutput(existing.gdvTiepNhan)}<br>` +
                    `<b>Trạng thái:</b> ${PENDING_STATUS_MAP[existing.trangThai]?.label || existing.trangThai}`,
              confirmButtonText: 'Đã hiểu & Kiểm tra lại',
              confirmButtonColor: '#d8b46d'
            });
          } else {
            triggerToast(`Cảnh báo: Mã VTT ${parsed.maVuTonThat} đã tồn tại (BSX: ${existing.bienSo})!`, 'error');
          }
        } else if (parsed.bienSo) {
          triggerToast(`Đã tự động trích xuất dữ liệu tin nhắn!`, 'success');
        }
      } else if (parsed.bienSo) {
        triggerToast(`Đã tự động trích xuất dữ liệu tin nhắn!`, 'success');
      } else {
        triggerToast('Không thể tự nhận diện BSX hoặc Mã VTT. Bạn hãy kiểm tra và nhập vào biểu mẫu.', 'info');
      }
      if (typeof ClaimEditorWorkspace !== 'undefined') ClaimEditorWorkspace.refreshSummary();
    }


    async function saveAddPendingClaimFromModal() {
      try {await (claimDocumentStore.bindingPromise||Promise.resolve());await rebindClaimDocumentsByHsbt();}
      catch(error){triggerToast('Chưa lưu được tài liệu: '+error.message,'error');return;}
      if(!claimDocumentStore.ready && !claimDocumentStore.guideError)return triggerToast('Đang tải hướng dẫn đã lưu. Vui lòng chờ rồi thử lại.','warning');
      const independentGuideAvailable=!claimDocumentStore.guideError;
      const documentSequence=claimDocumentStore.sequence;
      const isEditing = !!editingPendingClaimId;
      if (isEditing) {
        if (!hasUserPermission('pending', 'edit')) {
          triggerToast('Bạn không có quyền chỉnh sửa hồ sơ bồi thường.', 'error');
          return;
        }
      } else {
        if (!hasUserPermission('pending', 'add')) {
          triggerToast('Bạn không có quyền tiếp nhận hồ sơ tổn thất mới.', 'error');
          return;
        }
      }
      const getVal = (id) => (document.getElementById(id)?.value || '').trim();

      const bienSo = getVal('modalPendingBienSo');
      const maVuTonThat = getVal('modalPendingMaVuTonThat');

      if (!bienSo && !maVuTonThat) {
        triggerToast('Vui lòng nhập Biển số xe hoặc Mã vụ tổn thất.', 'error');
        document.getElementById('modalPendingBienSo')?.focus();
        return;
      }

      // const isEditing = !!editingPendingClaimId;
      const targetClaimId = isEditing ? editingPendingClaimId : claimDocumentStore.draftId;
      const existingItem = isEditing ? (cachedPendingClaimsPayload[editingPendingClaimId] || {}) : {};

      // If adding NEW claim, check duplicate MaVuTonThat
      if (!isEditing && maVuTonThat) {
        const existing = findExistingClaimByMaVTT(maVuTonThat);
        if (existing) {
          if (window.Swal) {
            Swal.fire({
              icon: 'error',
              title: 'Không thể thêm hồ sơ trùng!',
              html: `Mã vụ tổn thất <b>${escapeHtmlOutput(maVuTonThat)}</b> đã được tiếp nhận trước đó.<br><br>` +
                    `<b>Biển số xe:</b> ${escapeHtmlOutput(existing.bienSo)}<br>` +
                    `<b>GĐV phụ trách:</b> ${escapeHtmlOutput(existing.gdvTiepNhan)}<br>` +
                    `<b>Trạng thái hiện tại:</b> ${PENDING_STATUS_MAP[existing.trangThai]?.label || existing.trangThai}`,
              confirmButtonText: 'Đóng và kiểm tra lại',
              confirmButtonColor: '#ef4444'
            });
          } else {
            triggerToast(`Không thể lưu: Mã VTT ${maVuTonThat} đã tồn tại trong hệ thống!`, 'error');
          }
          document.getElementById('modalPendingMaVuTonThat')?.focus();
          return;
        }
      }

      const user = firebase.auth().currentUser;
      const profile = activeUserProfile || {};
      const creatorName = existingItem.createdByName || profile.displayName || user?.email || 'Admin';

      // Separate notes: general ghiChu and tndsGhiChu are completely independent
      const tndsNoteVal = String(getVal('modalPendingTndsGhiChu') || '').trim();
      const generalNoteVal = String(getVal('modalPendingGhiChu') || '').trim();

      const oldTndsNote = String(existingItem.tndsGhiChu || '').trim();
      const currentUserName = String(profile.fullName || profile.displayName || user?.displayName || user?.email || 'Người dùng');

      let tndsLastUpdated = existingItem.tndsLastUpdated || null;
      let tndsUpdatedBy = existingItem.tndsUpdatedBy || '';

      if (tndsNoteVal !== oldTndsNote) {
        tndsLastUpdated = Date.now();
        tndsUpdatedBy = currentUserName;
      }

      const payload = {
        id: targetClaimId,
        maVuTonThat: maVuTonThat || existingItem.maVuTonThat || `VTT/XCG/${new Date().getFullYear()}/${Math.floor(100000 + Math.random() * 900000)}`,
        soHoSoBoiThuong: getVal('modalPendingSoHoSoBoiThuong') || existingItem.soHoSoBoiThuong || '',
        bienSo: bienSo || existingItem.bienSo || 'Chưa rõ',
        donViCapDon: getVal('modalPendingDonViCapDon') || '—',
        hangXe: getVal('modalPendingHangXe') || '—',
        hieuXe: getVal('modalPendingHieuXe') || '',
        namSanXuat: getVal('modalPendingNamSanXuat') || '',
        loaiTonThat: getVal('modalPendingLoaiTonThat') || '',
        vcx: getVal('modalPendingVcx') || '',
        tnds: getVal('modalPendingTnds') || '',
        ngayThongBao: getVal('modalPendingNgayThongBao') || existingItem.ngayThongBao || new Date().toLocaleString('vi-VN'),
        ngayMoHs: getVal('modalPendingNgayMoHs') || existingItem.ngayMoHs || '',
        ngayVTT: getVal('modalPendingNgayVTT') || existingItem.ngayVTT || '—',
        ngayTonThat: getVal('modalPendingNgayVTT') || existingItem.ngayTonThat || '—',
        diaDiemVTT: getVal('modalPendingDiaDiemVTT') || '—',
        nguyenNhan: getVal('modalPendingNguyenNhan') || '—',
        moTaTonThat: getVal('modalPendingMoTaTonThat') || '—',
        hienTruong: getVal('modalPendingHienTruong') || '—',
        laiXe: getVal('modalPendingLaiXe') || '—',
        nguoiLienHe: getVal('modalPendingNguoiLienHe') || '—',
        gdvTiepNhan: getVal('modalPendingGdvTiepNhan') || existingItem.gdvTiepNhan || profile.displayName || 'Chưa phân công',
        canBoXuLy: getVal('modalPendingCanBoXuLy') || '—',
        soHd: getVal('modalPendingSoHd') || existingItem.soHd || '',
        soGcn: getVal('modalPendingSoGcn') || existingItem.soGcn || '',
        khachHang: getVal('modalPendingKhachHang') || existingItem.khachHang || '',
        ngayHieuLuc: getVal('modalPendingNgayHieuLuc') || existingItem.ngayHieuLuc || '',
        ngayHetHan: getVal('modalPendingNgayHetHan') || existingItem.ngayHetHan || '',
        uocThietHai: getVal('modalPendingUocThietHai') || existingItem.uocThietHai || '',
        pascSoTienDuyet: getVal('modalPendingTtbtTongSoTienBoiThuong') || getVal('modalPendingPascSoTienDuyet') || existingItem.pascSoTienDuyet || '',
        ttbtTongSoTienBoiThuong: getVal('modalPendingTtbtTongSoTienBoiThuong') || existingItem.ttbtTongSoTienBoiThuong || '',
        soTienDuyetBT: getVal('modalPendingTtbtTongSoTienBoiThuong') || existingItem.soTienDuyetBT || '',
        pascNguoiDuyet: getVal('modalPendingPascNguoiDuyet') || existingItem.pascNguoiDuyet || '',
        toTrinhNguoiDuyet: getVal('modalPendingToTrinhNguoiDuyet') || existingItem.toTrinhNguoiDuyet || '',
        soKhungSoMay: getVal('modalPendingSoKhungSoMay') || existingItem.soKhungSoMay || '',
        nguoiCapDon: getVal('modalPendingNguoiCapDon') || existingItem.nguoiCapDon || '',
        kenhKhaiThac: getVal('modalPendingKenhKhaiThac') || existingItem.kenhKhaiThac || '',
        giaTriXe: getVal('modalPendingGiaTriXe') || existingItem.giaTriXe || '',
        soTienBh: getVal('modalPendingSoTienBh') || existingItem.soTienBh || '',
        phiBh: getVal('modalPendingPhiBh') || existingItem.phiBh || '',
        loaiXe: getVal('modalPendingLoaiXe') || existingItem.loaiXe || '',
        mdsd: getVal('modalPendingMdsd') || existingItem.mdsd || '',
        soChoTrongTai: getVal('modalPendingSoChoTrongTai') || existingItem.soChoTrongTai || '',
        tinhTonThat: getVal('modalPendingTinhTonThat') || existingItem.tinhTonThat || '',
        chiNhanhXuly: getVal('modalPendingChiNhanhXuly') || existingItem.chiNhanhXuly || '',
        ttkd: getVal('modalPendingTtkd') || existingItem.ttkd || '',
        zoneBoiThuong: getVal('modalPendingZoneBoiThuong') || existingItem.zoneBoiThuong || '',
        garaSuaChua: getVal('modalPendingGaraSuaChua') || existingItem.garaSuaChua || '',
        tenGaraVietTat: getVal('modalPendingTenGaraVietTat') || existingItem.tenGaraVietTat || '',
        toTrinhNgayDuyet: getVal('modalPendingToTrinhNgayDuyet') || existingItem.toTrinhNgayDuyet || '',
        pascNgayDuyet: getVal('modalPendingPascNgayDuyet') || existingItem.pascNgayDuyet || '',
        duPhongBoiThuong: getVal('modalPendingDuPhongBoiThuong') || existingItem.duPhongBoiThuong || '',
        ngayNhanDuHoSo: formatCleanDateField(getVal('modalPendingNgayNhanDuHoSo')) || getVal('modalPendingNgayNhanDuHoSo') || existingItem.ngayNhanDuHoSo || '',
        ngayKtXacNhan: formatCleanDateField(getVal('modalPendingNgayKtXacNhan')) || getVal('modalPendingNgayKtXacNhan') || existingItem.ngayKtXacNhan || '',
        ngayThanhToan: getVal('modalPendingNgayThanhToan') || existingItem.ngayThanhToan || '',
        ghiChu: generalNoteVal,
        thongBaoGiamTru: ClaimReductionNotice.getState(),
        tndsGhiChu: tndsNoteVal,
        tndsLastUpdated: tndsLastUpdated,
        tndsUpdatedBy: tndsUpdatedBy,
        trangThai: existingItem.trangThai || 'moi',
        createdAt: existingItem.createdAt || Date.now(),
        updatedAt: Date.now(),
        createdByName: creatorName
      };

      const btnSave = document.getElementById('btnSubmitAddPendingClaim');
      if (btnSave) btnSave.disabled = true;

      try {
        await flushClaimDocumentAutoSave();
        await collectionGuidePrepareContact();
        if(documentSequence!==claimDocumentStore.sequence)return;
        document.getElementById('collectionGuidePreview')?._guideEditor?.flush();
        // An existing claim may have been deleted while its modal was open.
        const claimStillExists=!isEditing || (await dbNodeInstance.ref(`pending_claims/${targetClaimId}`).once('value')).exists();
        if(documentSequence!==claimDocumentStore.sequence)return;
        const databaseUpdates = {};
        if(claimStillExists)databaseUpdates[`pending_claims/${targetClaimId}`] = payload;
        if(independentGuideAvailable)databaseUpdates[`collection_guides/${claimDocumentStorageKey(targetClaimId,payload)}`] = buildCollectionGuideStorageRecord(targetClaimId,payload,getCollectionGuideState(),claimDocumentStore.guideRecord);
        else if(claimStillExists)payload.huongDanThuThapHoSo=getCollectionGuideState();
        else throw new Error('Chưa có quyền lưu hướng dẫn vào kho riêng. Hồ sơ gốc đã xoá nên không thể lưu lại vào hồ sơ.');
        if (sceneDiagramDataUrl) {
          databaseUpdates[`scene_diagrams/${claimDocumentStorageKey(targetClaimId,payload)}`] = buildSceneDiagramStorageRecord(targetClaimId, payload);
        }
        await dbNodeInstance.ref().update(databaseUpdates);
        if (cachedPendingClaimsPayload && claimStillExists) {
          cachedPendingClaimsPayload[targetClaimId] = payload;
        }
        closeAddPendingClaimModal();
        if (typeof activeDashboardTab !== 'undefined' && activeDashboardTab === 'gdv_report') {
          renderGdvReportPage();
        }
        if (typeof activeDashboardTab !== 'undefined' && activeDashboardTab === 'pending') {
          executeUIRenderPendingClaims();
        }
        if(!independentGuideAvailable)triggerToast('Đã lưu hồ sơ và hướng dẫn trong hồ sơ. Chưa lưu được vào kho riêng; hãy kiểm tra quyền Firebase trước khi xoá dữ liệu.','warning');
        else triggerToast(!claimStillExists ? 'Hồ sơ gốc đã bị xoá; tài liệu được lưu riêng và hồ sơ không được tạo lại.' : isEditing ? `Đã cập nhật thông tin hồ sơ ${payload.bienSo} thành công!` : `Đã tiếp nhận thành công hồ sơ ${payload.bienSo} (${payload.maVuTonThat})!`, 'success');
      } catch (e) {
        console.error(e);
        triggerToast('Không thể lưu hồ sơ: ' + e.message, 'error');
      } finally {
        if (btnSave) btnSave.disabled = false;
      }
    }


        async function clearAllPendingClaimsDataByAdmin() {
      const isAdmin = activeUserProfile && (
        String(activeUserProfile.role || '').trim().toLowerCase() === 'admin' ||
        String(activeUserProfile.role || '').trim().toLowerCase() === 'truong_nhom' ||
        activeUserProfile.isAdmin === true
      );

      if (!isAdmin) {
        triggerToast('Chỉ tài khoản Admin mới có quyền xóa toàn bộ dữ liệu!', 'error');
        return;
      }

      const totalClaimsCount = Object.keys(cachedPendingClaimsPayload || {}).length;
      if (totalClaimsCount === 0) {
        triggerToast('Hiện tại không có dữ liệu hồ sơ tồn nào để xóa.', 'info');
        return;
      }

      const confirmText = await showCustomPromptModalAsync({
        title: 'CẢNH BÁO NGHIÊM TRỌNG',
        message: `Hành động này sẽ XÓA VĨNH VIỄN toàn bộ ${totalClaimsCount} hồ sơ tồn trong hệ thống. Sơ đồ hiện trường và hướng dẫn thu thập được giữ theo số HSBT, tự nạp lại khi nhập lại hồ sơ cùng số HSBT.\n\nĐể xác nhận, vui lòng nhập chính xác chữ: <strong style="color:var(--text-main);">XOA TAT CA</strong>`,
        requireText: 'XOA TAT CA',
        confirmText: 'XÓA TOÀN BỘ'
      });

      if (!confirmText || confirmText.trim().toUpperCase() !== 'XOA TAT CA') {
        triggerToast('Đã hủy thao tác xóa dữ liệu.', 'info');
        return;
      }

      try {
        triggerToast('Đang tiến hành xóa toàn bộ dữ liệu hồ sơ tồn...', 'info');
        await deleteAllPendingClaimsKeepingDocuments();
        cachedPendingClaimsPayload = {};
        triggerToast('Đã xóa toàn bộ hồ sơ tồn; sơ đồ và hướng dẫn vẫn được giữ theo số HSBT để tự nạp lại.', 'success');
        executeUIRenderPendingClaims();
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi khi xóa dữ liệu: ' + err.message, 'error');
      }
    }
