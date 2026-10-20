

    /* TOGGLE CLAIM CHECKBOX SELECTION IN BATCH */
    function toggleAccClaimSelectInBatch(claimId) {
      if (!claimId) return;
      const rawMap = (rawPendingClaimsPayload && Object.keys(rawPendingClaimsPayload).length > 0) ? rawPendingClaimsPayload : (cachedPendingClaimsPayload || {});
      const c = rawMap[claimId] || (cachedPendingClaimsPayload ? cachedPendingClaimsPayload[claimId] : null);
      if (!c) return;

      const idx = currentBatchSelectedClaims.findIndex(item => item.claimId === claimId || item.soHoSoBoiThuong === (c.soHoSoBoiThuong || c.maVuTonThat));
      if (idx >= 0) {
        currentBatchSelectedClaims.splice(idx, 1);
      } else {
        const moneyRaw = c.ttbtTongSoTienBoiThuong || 0;
        const amtClean = parseInt(String(moneyRaw).replace(/[^0-9]/g, ''), 10) || 0;

        currentBatchSelectedClaims.push({
          claimId: c.id,
          soHoSoBoiThuong: c.soHoSoBoiThuong || c.maVuTonThat || 'Vụ chưa mã',
          bienSo: c.bienSo || 'N/A',
          tenChuXe: extractClaimOwnerName(c),
          tenGara: c.tenGaraVietTat || c.garaSuaChua || c.gara || 'N/A',
          soTienDeNghi: amtClean
        });
      }

      renderAccClaimSearchResults(document.getElementById('accClaimSearchBox')?.value || '');
      renderAccBatchSelectedTable();
    }


    /* REMOVE CLAIM FROM BATCH TABLE */
    function removeAccClaimFromBatchTable(index) {
      currentBatchSelectedClaims.splice(index, 1);
      renderAccClaimSearchResults(document.getElementById('accClaimSearchBox')?.value || '');
      renderAccBatchSelectedTable();
    }


    /* UPDATE ITEM MONEY IN BATCH TABLE */
    function updateAccBatchItemMoney(index, rawVal) {
      const amtClean = parseInt(String(rawVal).replace(/[^0-9]/g, ''), 10) || 0;
      if (currentBatchSelectedClaims[index]) {
        currentBatchSelectedClaims[index].soTienDeNghi = amtClean;
      }
      recalcAccBatchTotalMoney();
    }


    /* RECALCULATE TOTAL MONEY FOR BATCH */
    function recalcAccBatchTotalMoney() {
      const totalSum = currentBatchSelectedClaims.reduce((sum, item) => sum + (parseInt(item.soTienDeNghi, 10) || 0), 0);
      const lblTotal = document.getElementById('lblAccBatchTotalMoney');
      if (lblTotal) lblTotal.textContent = formatCurrencyInputNumber(totalSum) + ' đ';
    }


    /* RENDER BATCH SELECTED CLAIMS TABLE */
    
        /* TOGGLE CLAIM PRIORITY FLAG IN BATCH */
    function toggleAccBatchItemPriority(index) {
      if (!currentBatchSelectedClaims[index]) return;
      currentBatchSelectedClaims[index].isUuTien = !currentBatchSelectedClaims[index].isUuTien;
      renderAccBatchSelectedTable();
    }


    /* RENDER BATCH SELECTED CLAIMS TABLE */
    function renderAccBatchSelectedTable() {
      const tbody = document.getElementById('tblAccBatchSelectedBody');
      const counterLbl = document.getElementById('lblAccBatchCount');
      
      if (counterLbl) {
        counterLbl.textContent = currentBatchSelectedClaims.length;
      }

      recalcAccBatchTotalMoney();

      if (!tbody) return;

      if (currentBatchSelectedClaims.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 32px 20px; color: var(--text-soft); font-size: 13px;">
              Chưa chọn hồ sơ nào. Vui lòng tích chọn các hồ sơ ở cột bên trái để gộp vào phiếu bàn giao.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = currentBatchSelectedClaims.map((item, idx) => `
        <tr style="border-bottom: 1px solid var(--border); ${item.isUuTien ? 'background: rgba(245,158,11,0.04);' : ''}">
          <td style="padding: 10px 12px; text-align: center; font-weight: 850;  color: var(--primary);">#${idx + 1}</td>
          <td style="padding: 10px 12px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <strong style="color: var(--text-main); font-size: 13px;">${escapeHtmlOutput(item.bienSo || 'N/A')}</strong>
              <span style="display: inline-block; font-size: 11px; color: var(--text-soft); ">${escapeHtmlOutput(item.soHoSoBoiThuong || '')}</span>
              <button type="button" onclick="toggleAccBatchItemPriority(${idx})" style="padding: 3px 8px; border-radius: 6px; font-size: 10.5px; font-weight: 850; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 4px; ${item.isUuTien ? 'background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.35);' : 'background: var(--bg-soft); color: var(--text-soft); border: 1px solid var(--border);'}" title="Đánh dấu hồ sơ ưu tiên xử lý">
                ${item.isUuTien ? `${ACC_SVGS.FIRE} <span>ƯU TIÊN</span>` : `<span>+ Ưu tiên</span>`}
              </button>
            </div>
          </td>
          <td style="padding: 10px 12px; font-weight: 750; color: var(--text-main);">${escapeHtmlOutput(extractClaimOwnerName(item))}</td>
          <td style="padding: 10px 12px; color: var(--text-soft);">${escapeHtmlOutput(item.tenGara || 'N/A')}</td>
          <td style="padding: 10px 12px; text-align: right;">
            <input type="text" class="input-premium" value="${formatCurrencyInputNumber(item.soTienDeNghi)}" oninput="updateAccBatchItemMoney(${idx}, this.value)" style="width: 125px; height: 32px; text-align: right;  font-weight: 850; font-size: 12.5px; color: #10b981;" />
          </td>
          <td style="padding: 10px 12px; text-align: center;">
            <button type="button" onclick="removeAccClaimFromBatchTable(${idx})" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #ef4444; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: grid; place-items: center;" title="Bỏ hồ sơ này khỏi phiếu">✕</button>
          </td>
        </tr>
      `).join('');
    }


    /* SAVE ACCOUNTING TRANSFER BATCH FROM MODAL */
    async function saveAccountingTransferBatchFromModal(evt, existingId, targetStatus) {
      if (evt) evt.preventDefault();

      if (existingId && cachedAccountingTransfersPayload[existingId]) {
        const existingBatch = cachedAccountingTransfersPayload[existingId];
        const currentUserId = firebase.auth().currentUser?.uid;
        if (existingBatch.gdvUid && existingBatch.gdvUid !== currentUserId) {
          triggerToast('Chỉ có người tạo phiếu mới được quyền bàn giao hoặc chỉnh sửa hồ sơ này!', 'warning');
          return;
        }
      }

      if (currentBatchSelectedClaims.length === 0) {
        triggerToast('Vui lòng tích chọn ít nhất 1 hồ sơ bồi thường ở cột bên trái!', 'warning');
        return;
      }

      const currentUser = firebase.auth().currentUser;
      const gdvName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || currentUser?.displayName || 'Giám định viên').trim();
      const gdvEmail = String(currentUser?.email || '').trim();
      const gdvUid = String(currentUser?.uid || '').trim();

      const transferId = existingId || ('PBG_' + Date.now());

      let totalMoney = 0;
      const finalItems = currentBatchSelectedClaims.map(c => {
        const val = parseInt(c.soTienDeNghi, 10) || 0;
        totalMoney += val;
        return {
          claimId: c.claimId || c.id || '',
          soHoSoBoiThuong: c.soHoSoBoiThuong || '',
          bienSo: c.bienSo || '',
          tenGara: c.tenGara || '',
          tenChuXe: extractClaimOwnerName(c),
          soTienDeNghi: val,
          isUuTien: Boolean(c.isUuTien),
          trangThaiBoSung: c.trangThaiBoSung || 'binh_thuong',
          noiDungBoSung: c.noiDungBoSung || ''
        };
      });

      const ghiChuGdv = getAccInputValue('txtAccBatchGhiChuGdv') || getAccInputValue('accBatchGhiChuGdv');

      // Status: 'moi' for Draft, 'cho_xac_nhan' for Handover Submitted
      const statusToSave = targetStatus || 'cho_xac_nhan';

      const payload = {
        transferId: transferId,
        gdvName: gdvName,
        gdvEmail: gdvEmail,
        gdvUid: gdvUid,
        soTienDeNghi: totalMoney,
        ghiChuGdv: ghiChuGdv,
        danhSachHoSo: finalItems,
        ngayBanGiao: Date.now(),
        trangThai: statusToSave
      };

      try {
        await dbNodeInstance.ref('accounting_transfers/' + transferId).set(payload);

        if (statusToSave === 'cho_xac_nhan') {
          await sendAppNotification('ketoan', '', 'Phiếu bàn giao mới từ GĐV ' + gdvName, 'GĐV ' + gdvName + ' đã bàn giao ' + finalItems.length + ' hồ sơ (Mã phiếu: ' + transferId + '). Vui lòng kiểm tra và xác nhận.', transferId, 0, '', '', 'handover_submitted');
          triggerToast('Đã bàn giao hồ sơ thành công! Phiếu đang ở trạng thái Chờ xác nhận.', 'success');
        } else {
          triggerToast('Đã lưu nháp Phiếu bàn giao hồ sơ!', 'success');
        }

        closeAccountingTransferModal();
        renderAccountingTransferPage();
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi lưu Phiếu bàn giao: ' + err.message, 'error');
      }
    }


    /* MODAL 2: BÀN GIAO & XÉT DUYỆT PHIẾU (DỰA TRÊN QUYỀN VAI TRÒ GĐV VS KẾ TOÁN) */
    
    function printAccountingTransferBatch(transferId) {
      if (!transferId || !cachedAccountingTransfersPayload[transferId]) {
        triggerToast('Không tìm thấy thông tin phiếu bàn giao.', 'error');
        return;
      }
      const t = cachedAccountingTransfersPayload[transferId];
      
      let claimsInBatch = t.danhSachHoSo || [];
      if (claimsInBatch.length === 0 && (t.soHoSoBoiThuong || t.bienSo)) {
        claimsInBatch = [{
          soHoSoBoiThuong: t.soHoSoBoiThuong, bienSo: t.bienSo,
          tenGara: t.tenGara, garaSuaChua: t.garaSuaChua,
          tenGaraVietTat: t.tenGaraVietTat, gara: t.gara,
          soTienDeNghi: t.soTienDeNghi, tenChuXe: extractClaimOwnerName(t)
        }];
      }

      if (claimsInBatch.length === 0) {
        triggerToast('Phiếu bàn giao này không chứa hồ sơ nào.', 'warning');
        return;
      }

      const dateStr = formatDateDisplay(t.ngayBanGiao).split(' ')[0] || new Date(t.ngayBanGiao).toLocaleDateString('vi-VN');
      const getGarageName = claim => [claim.tenGara, claim.garaSuaChua, claim.tenGaraVietTat, claim.gara]
        .map(value => String(value || '').trim())
        .find(value => value && !['-', '—', 'n/a'].includes(value.toLowerCase())) || '-';

      const printHtml = `
        <div style="font-family: 'Times New Roman', Times, serif; color: #000000; padding: 20px 0; line-height: 1.5;">
          <h1 style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 0.05em;">
            Danh sách chuyển hồ sơ làm thanh toán
          </h1>
          
          <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 0; font-size: 14.5px; overflow-wrap: anywhere;">
            <thead>
              <tr>
                <th style="border: 1px solid #000000; padding: 10px 6px; text-align: center; width: 6%; font-weight: bold;">STT</th>
                <th style="border: 1px solid #000000; padding: 10px 6px; text-align: center; width: 12%; font-weight: bold;">BIỂN SỐ XE</th>
                <th style="border: 1px solid #000000; padding: 10px 6px; text-align: center; width: 28%; font-weight: bold;">SỐ HSBT</th>
                <th style="border: 1px solid #000000; padding: 10px 6px; text-align: center; width: 23%; font-weight: bold;">TÊN KHÁCH HÀNG</th>
                <th style="border: 1px solid #000000; padding: 10px 6px; text-align: center; width: 20%; font-weight: bold;">GARA</th>
                <th style="border: 1px solid #000000; padding: 10px 6px; text-align: center; width: 11%; font-weight: bold;">NGÀY GỬI HỒ SƠ</th>
              </tr>
            </thead>
            <tbody>
              ${claimsInBatch.map((c, idx) => `
                <tr>
                  <td style="border: 1px solid #000000; padding: 10px 6px; text-align: center;">${idx + 1}</td>
                  <td style="border: 1px solid #000000; padding: 10px 6px; text-align: center; font-weight: bold;">${escapeHtmlOutput(c.bienSo || '')}</td>
                  <td style="border: 1px solid #000000; padding: 10px 6px; text-align: center;">${escapeHtmlOutput(c.soHoSoBoiThuong || '')}</td>
                  <td style="border: 1px solid #000000; padding: 10px 6px; text-align: left; text-transform: uppercase;">${escapeHtmlOutput(extractClaimOwnerName(c))}</td>
                  <td style="border: 1px solid #000000; padding: 10px 6px; text-align: left;">${escapeHtmlOutput(getGarageName(c))}</td>
                  <td style="border: 1px solid #000000; padding: 10px 6px; text-align: center;">${escapeHtmlOutput(dateStr)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; margin-top: 32px; padding: 0 80px; font-size: 16px; break-inside: avoid; page-break-inside: avoid;">
            <div style="text-align: center; width: 220px; font-weight: bold;">
              Bên nhận
            </div>
            <div style="text-align: center; width: 220px; font-weight: bold;">
              Bên giao
            </div>
          </div>
        </div>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>In Phieu Ban Giao</title><style>@page { size: A4 portrait; margin: 12mm 8mm; } body { margin: 0; background: #fff; } table, tbody tr:last-child { break-after: avoid; page-break-after: avoid; } thead { display: table-header-group; } tr { break-inside: avoid; page-break-inside: avoid; } th, td { box-sizing: border-box; vertical-align: middle; }</style></head><body>' + printHtml + '</body></html>');
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }


    function exportAccountingClaimsToExcel() {
      if (!hasUserPermission('accounting', 'export')) {
        triggerToast('Bạn không có quyền xuất dữ liệu kế toán.', 'error');
        return;
      }
      
      const allItems = getAccountingClaimsFlatList();
      const confirmedTransfers = ['da_xac_nhan', 'da_nhan_du_ho_so', 'da_trinh_dntt', 'can_bo_sung'];
      const activeItems = allItems.filter(item => confirmedTransfers.includes(item.transfer.trangThai));

      let items = activeItems.filter(item => {
        if (activeAccountingClaimStatus === 'all') return true;
        if (activeAccountingClaimStatus === 'da_xac_nhan') return item.transfer.trangThai === 'da_xac_nhan' || item.transfer.trangThai === 'da_nhan_du_ho_so';
        if (activeAccountingClaimStatus === 'can_bo_sung') {
          const suppList = item.transfer.hoSoYeuCauBoSung || [];
          return suppList.some(s => Number(s.chiSo) === Number(item.claimIndex) || (s.soHoSoBoiThuong && s.soHoSoBoiThuong === item.claim.soHoSoBoiThuong) || (s.bienSo && s.bienSo === item.claim.bienSo)) || item.claim.trangThaiBoSung === 'yeu_cau_bo_sung' || item.transfer.trangThai === 'can_bo_sung';
        }
        return item.transfer.trangThai === activeAccountingClaimStatus;
      });

      if (activeAccountingClaimSearch) {
        const hasSeparator = /[,\n\t;]/.test(activeAccountingClaimSearch);
        const spaceTerms = activeAccountingClaimSearch.split(/\s+/).filter(Boolean);
        const isSpaceBatch = spaceTerms.length > 1 && spaceTerms.every(t => /\d/.test(t));
        
        let searchTerms = [activeAccountingClaimSearch];
        if (hasSeparator) {
          searchTerms = activeAccountingClaimSearch.split(/[,\n\t;]+/).map(t => t.trim()).filter(Boolean);
        } else if (isSpaceBatch) {
          searchTerms = spaceTerms.map(t => t.trim());
        }
        
        if (searchTerms.length > 0) {
          items = items.filter(item => {
            return searchTerms.some(term => {
              return [
                item.transfer.transferId, item.transfer.gdvName, item.claim.bienSo, item.claim.soHoSoBoiThuong,
                item.claim.tenGara, extractClaimOwnerName(item.claim), item.note.ghiChu
              ].some(value => String(value || '').toLowerCase().includes(term));
            });
          });
        }
      }

      if (items.length === 0) {
        triggerToast('Không có dữ liệu để xuất.', 'warning');
        return;
      }

      const rows = [
        ['STT', 'Trạng thái', 'Số HSBT', 'Biển số', 'Khách hàng', 'Giám định viên', 'Tên Gara', 'Tổng duyệt giá', 'Thu hồi', 'Giảm trừ', 'Số tiền đề nghị', 'Số phiếu bàn giao', 'Ngày bàn giao', 'Ghi chú']
      ];

      items.forEach((item, index) => {
        const c = item.claim;
        const t = item.transfer;
        
        let statusText = '';
        if (t.trangThai === 'da_trinh_dntt') statusText = 'ĐÃ TRÌNH ĐNTT';
        else if (t.trangThai === 'da_xac_nhan' || t.trangThai === 'da_nhan_du_ho_so') statusText = 'ĐÃ XÁC NHẬN';
        else if (t.trangThai === 'can_bo_sung') statusText = 'CẦN BỔ SUNG';
        else statusText = 'CHỜ XÁC NHẬN';
        
        const suppList = t.hoSoYeuCauBoSung || [];
        const isSupp = suppList.some(s => Number(s.chiSo) === Number(item.claimIndex) || (s.soHoSoBoiThuong && s.soHoSoBoiThuong === c.soHoSoBoiThuong) || (s.bienSo && s.bienSo === c.bienSo)) || c.trangThaiBoSung === 'yeu_cau_bo_sung';
        if (isSupp) statusText = 'YÊU CẦU BỔ SUNG';
        
        const formatMoneyStr = (val) => {
          if (!val) return '0';
          const clean = String(val).replace(/\D/g, '');
          if (!clean) return '0';
          return parseInt(clean, 10).toLocaleString('vi-VN');
        };

        const dtg = formatMoneyStr(c.tongDuyetGia);
        const th = formatMoneyStr(c.thuHoi);
        const gt = formatMoneyStr(c.giamTru);
        const st = formatMoneyStr(c.soTienDeNghiThem);
        const tsDate = (t.createdAt) ? formatCaseTimestamp(t.createdAt) : '';

        rows.push([
          index + 1,
          statusText,
          c.soHoSoBoiThuong || '',
          c.bienSo || '',
          extractClaimOwnerName(c) || '',
          t.gdvName || '',
          c.tenGara || '',
          dtg,
          th,
          gt,
          st,
          t.transferId || '',
          tsDate,
          item.note.ghiChu || ''
        ]);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Simple column widths
      ws['!cols'] = [
        { wch: 6 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, 
        { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
        { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 35 }
      ];

      // Bold header
      for (let C = 0; C < rows[0].length; ++C) {
        const cellAddress = XLSX.utils.encode_cell({c: C, r: 0});
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "0F172A" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }

      XLSX.utils.book_append_sheet(wb, ws, "HoSoDaNhan");
      const filename = `HoSoKeToan_Export_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
      XLSX.writeFile(wb, filename);
      triggerToast('Đã xuất dữ liệu ra Excel!', 'success');
    }


    function exportAccountingTransferBatchExcel(transferId) {
      if (!transferId || !cachedAccountingTransfersPayload[transferId]) {
        triggerToast('Không tìm thấy thông tin phiếu bàn giao.', 'error');
        return;
      }
      const t = cachedAccountingTransfersPayload[transferId];
      
      let claimsInBatch = t.danhSachHoSo || [];
      if (claimsInBatch.length === 0 && (t.soHoSoBoiThuong || t.bienSo)) {
        claimsInBatch = [{ soHoSoBoiThuong: t.soHoSoBoiThuong, bienSo: t.bienSo, tenGara: t.tenGara, soTienDeNghi: t.soTienDeNghi, tenChuXe: extractClaimOwnerName(t) }];
      }

      if (claimsInBatch.length === 0) {
        triggerToast('Phiếu bàn giao này không chứa hồ sơ nào.', 'warning');
        return;
      }

      const dateStr = formatDateDisplay(t.ngayBanGiao).split(' ')[0] || new Date(t.ngayBanGiao).toLocaleDateString('vi-VN');

      if (window.XLSX) {
        // Build array of arrays (AOA) matching print structure
        const aoa = [
          ['DANH SÁCH CHUYỂN HỒ SƠ LÀM THANH TOÁN', '', '', '', ''], // Row 1 (will merge A1:E1)
          ['', '', '', '', ''],                                     // Row 2 (blank spacer)
          ['STT', 'Biển số xe', 'Số HSBT', 'TÊN KHÁCH HÀNG', 'Ngày gửi hồ sơ']  // Row 3 (headers)
        ];

        claimsInBatch.forEach((c, idx) => {
          aoa.push([
            idx + 1,
            String(c.bienSo || '').toUpperCase(),
            c.soHoSoBoiThuong || '',
            String(extractClaimOwnerName(c)).toUpperCase(),
            dateStr
          ]);
        });

        // Blank spacer rows (2 rows) to give space before signature section
        aoa.push(['', '', '', '', '']);
        aoa.push(['', '', '', '', '']);

        // Signatures row
        aoa.push(['', 'Bên nhận', '', 'Bên giao', '']);

        const totalRows = claimsInBatch.length;
        const sigRow = 4 + totalRows + 2;
        const sigRowIdx = sigRow - 1;

        // Convert array of arrays to sheet
        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Apply merges for title row and signature rows
        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Title (A1:E1)
          { s: { r: sigRowIdx, c: 1 }, e: { r: sigRowIdx, c: 2 } }, // Bên nhận (B9:C9 or equivalent)
          { s: { r: sigRowIdx, c: 3 }, e: { r: sigRowIdx, c: 4 } }  // Bên giao (D9:E9 or equivalent)
        ];

        // Style A1 (Title)
        ws['A1'].s = {
          font: { name: 'Arial', sz: 16, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' }
        };

        // Style Headers (A3 to E3)
        const headerCols = ['A', 'B', 'C', 'D', 'E'];
        headerCols.forEach(col => {
          const cellKey = col + '3';
          if (ws[cellKey]) {
            ws[cellKey].s = {
              font: { name: 'Arial', sz: 11, bold: true },
              fill: { fgColor: { rgb: 'E2E8F0' } }, // Light gray background
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: '475569' } },
                bottom: { style: 'thin', color: { rgb: '475569' } },
                left: { style: 'thin', color: { rgb: '475569' } },
                right: { style: 'thin', color: { rgb: '475569' } }
              }
            };
          }
        });

        // Style Data Rows
        for (let i = 0; i < totalRows; i++) {
          const rowNum = 4 + i;
          
          // STT
          const cellA = 'A' + rowNum;
          if (ws[cellA]) {
            ws[cellA].s = {
              font: { name: 'Arial', sz: 11 },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: '94A3B8' } },
                bottom: { style: 'thin', color: { rgb: '94A3B8' } },
                left: { style: 'thin', color: { rgb: '94A3B8' } },
                right: { style: 'thin', color: { rgb: '94A3B8' } }
              }
            };
          }

          // Biển số xe
          const cellB = 'B' + rowNum;
          if (ws[cellB]) {
            ws[cellB].s = {
              font: { name: 'Arial', sz: 11, bold: true },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: '94A3B8' } },
                bottom: { style: 'thin', color: { rgb: '94A3B8' } },
                left: { style: 'thin', color: { rgb: '94A3B8' } },
                right: { style: 'thin', color: { rgb: '94A3B8' } }
              }
            };
          }

          // Số HSBT
          const cellC = 'C' + rowNum;
          if (ws[cellC]) {
            ws[cellC].s = {
              font: { name: 'Arial', sz: 11 },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: '94A3B8' } },
                bottom: { style: 'thin', color: { rgb: '94A3B8' } },
                left: { style: 'thin', color: { rgb: '94A3B8' } },
                right: { style: 'thin', color: { rgb: '94A3B8' } }
              }
            };
          }

          // TÊN KHÁCH HÀNG
          const cellD = 'D' + rowNum;
          if (ws[cellD]) {
            ws[cellD].s = {
              font: { name: 'Arial', sz: 11 },
              alignment: { horizontal: 'left', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: '94A3B8' } },
                bottom: { style: 'thin', color: { rgb: '94A3B8' } },
                left: { style: 'thin', color: { rgb: '94A3B8' } },
                right: { style: 'thin', color: { rgb: '94A3B8' } }
              }
            };
          }

          // Ngày gửi hồ sơ
          const cellE = 'E' + rowNum;
          if (ws[cellE]) {
            ws[cellE].s = {
              font: { name: 'Arial', sz: 11 },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: '94A3B8' } },
                bottom: { style: 'thin', color: { rgb: '94A3B8' } },
                left: { style: 'thin', color: { rgb: '94A3B8' } },
                right: { style: 'thin', color: { rgb: '94A3B8' } }
              }
            };
          }
        }

        // Style Signatures (Row = 4 + totalRows + 2)
        
        const cellSigB = 'B' + sigRow;
        if (ws[cellSigB]) {
          ws[cellSigB].s = {
            font: { name: 'Arial', sz: 12, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        }

        const cellSigD = 'D' + sigRow;
        if (ws[cellSigD]) {
          ws[cellSigD].s = {
            font: { name: 'Arial', sz: 12, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        }

        // Set row heights
        ws['!rows'] = [
          { hpt: 35 }, // Row 1 (Title)
          { hpt: 15 }, // Row 2 (Spacer)
          { hpt: 25 }  // Row 3 (Headers)
        ];
        for (let i = 0; i < totalRows; i++) {
          ws['!rows'].push({ hpt: 22 });
        }

        // Column widths matching print proportionality
        ws['!cols'] = [
          { wch: 8 },  // STT
          { wch: 16 }, // Biển số xe
          { wch: 26 }, // Số HSBT
          { wch: 32 }, // TÊN KHÁCH HÀNG
          { wch: 18 }  // Ngày gửi hồ sơ
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Ban_Giao');
        XLSX.writeFile(wb, 'Danh_sach_ban_giao_ho_so_' + transferId + '.xlsx');
        triggerToast('Đã tải file Excel thành công!', 'success');
      } else {
        triggerToast('Thư viện XLSX chưa tải xong, vui lòng thử lại.', 'error');
      }
    }


    async function revertTransferToDraft(transferId) {
      if (!transferId) return;
      try {
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/trangThai').set('moi');
        if (cachedAccountingTransfersPayload && cachedAccountingTransfersPayload[transferId]) {
          cachedAccountingTransfersPayload[transferId].trangThai = 'moi';
        }
        triggerToast('Đã hoàn trả phiếu bàn giao về trạng thái Mới (Nháp) để điều chỉnh!', 'success');
        closeAccountingTransferModal();
        closeKeToanReviewModal();
        renderAccountingTransferPage();
        openAddAccountingTransferModal(transferId);
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi trả lại phiếu nháp: ' + err.message, 'error');
      }
    }


    function openKeToanReviewModal(transferId) {
      if (!transferId || !cachedAccountingTransfersPayload[transferId]) return;
      const t = cachedAccountingTransfersPayload[transferId];

      const isAdmin = activeUserProfile && (
        String(activeUserProfile.role || '').trim().toLowerCase() === 'admin' ||
        activeUserProfile.isAdmin === true
      );
      const isKeToanRole = getLoggedInUserAccountingRole() === 'ketoan' || isAdmin;
      const currentUserId = firebase.auth().currentUser?.uid;
      const isCreator = !t.gdvUid || t.gdvUid === currentUserId;
      const canDeleteInReviewModal = isAdmin || (isCreator && !['da_xac_nhan', 'da_nhan_du_ho_so', 'da_trinh_dntt'].includes(t.trangThai));

      let claimsInBatch = t.danhSachHoSo || [];
      if (claimsInBatch.length === 0 && (t.soHoSoBoiThuong || t.bienSo)) {
        claimsInBatch = [{ soHoSoBoiThuong: t.soHoSoBoiThuong, bienSo: t.bienSo, tenGara: t.tenGara, soTienDeNghi: t.soTienDeNghi, tenChuXe: extractClaimOwnerName(t) }];
      }

      // Synthesize Batch History
      let batchHistoryEvents = [];
      if (t.ngayBanGiao) {
        batchHistoryEvents.push({
          time: t.ngayBanGiao,
          user: t.gdvName || 'GĐV',
          action: 'Tạo Phiếu & Bàn giao',
          detail: 'Phiếu bàn giao gồm ' + claimsInBatch.length + ' hồ sơ',
          color: '#3b82f6'
        });
      }
      if (t.ngayXetDuyet) {
        let actStr = 'Cập nhật trạng thái';
        let actColor = '#8b5cf6';
        if (t.trangThai === 'da_xac_nhan' || t.trangThai === 'da_nhan_du_ho_so') { actStr = 'Xác nhận nhận đủ hồ sơ'; actColor = '#10b981'; }
        else if (t.trangThai === 'da_trinh_dntt') { actStr = 'Trình ĐNTT'; actColor = '#10b981'; }
        else if (t.trangThai === 'can_bo_sung') { actStr = 'Yêu cầu bổ sung'; actColor = '#ef4444'; }
        batchHistoryEvents.push({
          time: t.ngayXetDuyet,
          user: 'Kế toán',
          action: actStr,
          detail: t.ghiChuKeToan ? ('Ghi chú: ' + t.ghiChuKeToan) : '',
          color: actColor
        });
      }
      claimsInBatch.forEach(c => {
        if (c.lichSuTuongTac && Array.isArray(c.lichSuTuongTac)) {
          c.lichSuTuongTac.forEach(h => {
            batchHistoryEvents.push({
              time: h.time,
              user: h.user,
              action: h.action,
              detail: '[' + (c.bienSo || c.soHoSoBoiThuong || 'Hồ sơ') + '] ' + (h.detail || ''),
              color: '#f59e0b'
            });
          });
        }
      });
      batchHistoryEvents.sort((a, b) => b.time - a.time);

      closeKeToanReviewModal();
      const modalOverlay = document.createElement('div');
      modalOverlay.id = 'keToanReviewModalOverlay';
      modalOverlay.className = 'transfer-review-overlay';
      modalOverlay.innerHTML = renderTransferReviewView({transfer:t,transferId,claims:claimsInBatch,history:batchHistoryEvents,isKeToanRole,canDelete:canDeleteInReviewModal});

      document.body.appendChild(modalOverlay);
      activateTransferReviewDialog(modalOverlay);
    }


    function closeKeToanReviewModal() {
      const el = document.getElementById('keToanReviewModalOverlay');
      if (el) {
        document.body.style.overflow = el.transferReviewPreviousOverflow ?? '';
        const previousFocus = el.transferReviewPreviousFocus;
        el.remove();
        if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
      }
    }


    function toggleKeToanSupplementClaim(index, isSelected) {
      const noteRow = document.getElementById('keToanSupplementNoteRow_' + index);
      const noteInput = document.getElementById('keToanSupplementNote_' + index);
      if (noteRow) noteRow.style.display = isSelected ? 'table-row' : 'none';
      if (!isSelected && noteInput) noteInput.value = '';
    }


    async function saveKeToanReviewAction(transferId, targetStatus) {
      if (!hasUserPermission('accounting', 'review')) {
        triggerToast('Bạn không có quyền xét duyệt chứng từ kế toán.', 'error');
        return;
      }
      const ghiChuKeToan = getAccInputValue('txtKeToanGhiChu');
      const transfer = cachedAccountingTransfersPayload[transferId];
      let claims = transfer ? (transfer.danhSachHoSo || []) : [];

      const hoSoYeuCauBoSung = Array.from(document.querySelectorAll('.ke-toan-supplement-checkbox:checked')).map(input => {
        const index = Number(input.getAttribute('data-index'));
        return {
          chiSo: index,
          soHoSoBoiThuong: input.getAttribute('data-hsbt') || '',
          bienSo: input.getAttribute('data-bien-so') || '',
          ghiChu: getAccInputValue('keToanSupplementNote_' + index)
        };
      });

      if (targetStatus === 'can_bo_sung') {
        if (hoSoYeuCauBoSung.length > 0 && hoSoYeuCauBoSung.some(item => !item.ghiChu.trim())) {
          triggerToast('Vui lòng nhập nội dung cần bổ sung cho từng hồ sơ đã chọn!', 'warning');
          return;
        }
        if (hoSoYeuCauBoSung.length === 0 && !ghiChuKeToan.trim()) {
          triggerToast('Vui lòng chọn ít nhất 1 hồ sơ cần bổ sung hoặc nhập Ghi chú chung của Kế toán để trả lại!', 'warning');
          return;
        }
      }

      try {
        // Sync supplement status into individual claims in danhSachHoSo
        if (claims.length > 0 && hoSoYeuCauBoSung.length > 0) {
          const currentUser = firebase.auth().currentUser;
          const userName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || currentUser?.displayName || 'Kế toán').trim();

          hoSoYeuCauBoSung.forEach(item => {
            if (claims[item.chiSo]) {
              claims[item.chiSo].trangThaiBoSung = 'yeu_cau_bo_sung';
              claims[item.chiSo].noiDungBoSung = item.ghiChu;
              const history = claims[item.chiSo].lichSuTuongTac || [];
              history.unshift({
                time: Date.now(),
                user: userName,
                action: 'Yêu cầu bổ sung',
                detail: item.ghiChu
              });
              claims[item.chiSo].lichSuTuongTac = history;
            }
          });
          await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo').set(claims);
        }

        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/trangThai').set(targetStatus);
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/ghiChuKeToan').set(ghiChuKeToan);
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/hoSoYeuCauBoSung').set(hoSoYeuCauBoSung);
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/ngayXetDuyet').set(Date.now());

        const statusMsg = targetStatus === 'da_trinh_dntt' ? 'Đã duyệt trình Đề nghị thanh toán!' : (targetStatus === 'da_nhan_du_ho_so' ? 'Đã xác nhận nhận đủ hồ sơ!' : 'Đã phản hồi yêu cầu bổ sung!');
        triggerToast(statusMsg, 'success');
        closeKeToanReviewModal();
        renderAccountingTransferPage();
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi cập nhật trạng thái xét duyệt: ' + err.message, 'error');
      }
    }
