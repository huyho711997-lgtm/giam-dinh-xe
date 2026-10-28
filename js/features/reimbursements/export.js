


    function numberToWordsVN(number) {
      if (!number || number === 0) return "không đồng";
      const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
      const places = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
      let str = "";
      let place = 0;
      let num = Math.floor(number);
      while (num > 0) {
        let chunk = num % 1000;
        num = Math.floor(num / 1000);
        if (chunk > 0) {
          let chunkStr = "";
          let h = Math.floor(chunk / 100);
          let t = Math.floor((chunk % 100) / 10);
          let u = chunk % 10;
          if (h > 0) chunkStr += units[h] + " trăm ";
          else if (str !== "") chunkStr += "không trăm ";
          
          if (t === 0 && u > 0 && chunkStr !== "") chunkStr += "lẻ ";
          else if (t === 1) chunkStr += "mười ";
          else if (t > 1) chunkStr += units[t] + " mươi ";
          
          if (u === 1 && t > 1) chunkStr += "mốt ";
          else if (u === 5 && t > 0) chunkStr += "lăm ";
          else if (u === 4 && t > 1) chunkStr += "tư ";
          else if (u > 0) chunkStr += units[u] + " ";
          
          str = chunkStr + places[place] + " " + str;
        }
        place++;
      }
      str = str.trim().replace(/\s+/g, ' ') + " đồng";
      return str.charAt(0).toUpperCase() + str.slice(1);
    }


    function printFieldReimbursementTemplate(batchId) {
      const payload = cachedFieldReimbursementsPayload[batchId];
      if (!payload) return;

      let rowsHtml = '';
      let stt = 1;
      let sumTotal = 0;

      (payload.items || []).forEach(item => {
        const hsbtStr = item.soHSBT ? item.soHSBT : item.bienSo;
        
        if (item.travelCost > 0) {
          rowsHtml += `
            <tr>
              <td style="text-align: center;">${stt++}</td>
              <td>Thanh toán xăng/chi phí đi lại hiện trường ${escapeHtmlOutput(hsbtStr)}</td>
              <td></td>
              <td style="text-align: right;">${item.travelCost.toLocaleString('vi-VN')}</td>
              <td style="text-align: right;"></td>
              <td style="text-align: right;">${item.travelCost.toLocaleString('vi-VN')}</td>
              <td></td>
            </tr>
          `;
          sumTotal += item.travelCost;
        }

        if (item.calcResult && item.calcResult.finalCost > 0) {
          rowsHtml += `
            <tr>
              <td style="text-align: center;">${stt++}</td>
              <td>Thanh toán thù lao đi hiện trường ${escapeHtmlOutput(hsbtStr)}</td>
              <td></td>
              <td style="text-align: right;">${item.calcResult.finalCost.toLocaleString('vi-VN')}</td>
              <td style="text-align: right;"></td>
              <td style="text-align: right;">${item.calcResult.finalCost.toLocaleString('vi-VN')}</td>
              <td></td>
            </tr>
          `;
          sumTotal += item.calcResult.finalCost;
        }

        if (item.perDiem > 0) {
          rowsHtml += `
            <tr>
              <td style="text-align: center;">${stt++}</td>
              <td>Thanh toán công tác phí đi hiện trường ${escapeHtmlOutput(hsbtStr)}</td>
              <td></td>
              <td style="text-align: right;"></td>
              <td style="text-align: right;"></td>
              <td style="text-align: right;">${item.perDiem.toLocaleString('vi-VN')}</td>
              <td></td>
            </tr>
          `;
          sumTotal += item.perDiem;
        }

        if (item.hotelCost > 0) {
          rowsHtml += `
            <tr>
              <td style="text-align: center;">${stt++}</td>
              <td>Thanh toán lưu trú đi hiện trường ${escapeHtmlOutput(hsbtStr)}</td>
              <td></td>
              <td style="text-align: right;"></td>
              <td style="text-align: right;"></td>
              <td style="text-align: right;">${item.hotelCost.toLocaleString('vi-VN')}</td>
              <td></td>
            </tr>
          `;
          sumTotal += item.hotelCost;
        }
      });

      const overlay = document.createElement('div');
      overlay.id = 'printOverlayModal';
      overlay.className = 'fr-modal fr-print-overlay';
      const ic = (typeof fieldReimbIcon === 'function') ? fieldReimbIcon : () => '';
      
      overlay.innerHTML = `
        <style>
          #printOverlayModal * { box-sizing: border-box; }
          .print-page { background: white; width: 210mm; min-height: 297mm; padding: 20mm; box-shadow: 0 30px 80px rgba(0,0,0,0.5); border-radius: 8px; margin: 0 auto 40px auto; font-family: 'Times New Roman', serif; font-size: 12.5px; color: #000; overflow: hidden; }
          .print-page .header-logo { color: #004b87; font-weight: bold; font-family: Arial, sans-serif; font-size: 20px; line-height: 1.2; }
          .print-page .header-logo span { color: #00a4e4; font-weight: normal; font-size: 16px; display: block; }
          .print-page .title { text-align: center; font-weight: bold; font-size: 18px; margin-top: -20px; text-transform: uppercase; }
          .print-page .subtitle { text-align: center; font-style: italic; font-size: 14px; margin-bottom: 30px; }
          .print-page .info-line { margin-bottom: 8px; line-height: 1.5; }
          .print-page table { width: 100%; border-collapse: collapse; border-spacing: 0; margin-top: 20px; margin-bottom: 15px; }
          .print-page th, .print-page td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; font-size: 12.5px; }
          .print-page th { text-align: center; font-weight: bold; padding-top: 12px !important; }
          .print-page .total-row { font-weight: bold; }
          .print-page .signatures { display: flex; justify-content: space-between; margin-top: 10px; text-align: center; align-items: stretch; gap: 10px; }
          .print-page .sig-box { flex: 1; display: flex; flex-direction: column; }
          .print-page .sig-title { font-weight: bold; }
          .print-page .sig-en { font-style: italic; font-size: 12px; }
          .print-page .sig-header { flex-grow: 1; }
          .print-page .sig-footer { margin-top: 60px; text-align: left; white-space: nowrap; font-size: 13px; }
          @media print {
              @page { size: A4 portrait; margin: 15mm; }
              html, body { background: white !important; margin: 0 !important; padding: 0 !important; height: auto !important; min-height: auto !important; max-width: none !important; width: auto !important; overflow: visible !important; }
              body > *:not(#printOverlayModal) { display: none !important; }
              #printOverlayModal { position: static !important; background: white !important; margin: 0 !important; padding: 0 !important; width: 100% !important; height: auto !important; display: block !important; overflow: visible !important; box-shadow: none !important; border: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
              .print-action-bar { display: none !important; height: 0 !important; overflow: hidden !important; }
              .print-page { margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; width: 100% !important; min-height: auto !important; height: auto !important; page-break-after: auto !important; overflow: visible !important; background: white !important; }
              table { page-break-inside: auto !important; }
              tr { page-break-inside: auto !important; page-break-after: auto !important; }
              td, th { page-break-inside: avoid !important; break-inside: avoid !important; page-break-after: auto !important; }
              thead { display: table-header-group !important; }
              tfoot { display: table-footer-group !important; }
          }
        
</style>
        
        <div class="print-action-bar fr-print-bar">
          <button type="button" class="sf-button" onclick="document.getElementById('printOverlayModal').remove()">${ic('arrow').replace('<svg','<svg style="transform:scaleX(-1)"')}<span>Quay lại</span></button>
          <div class="fr-print-title"><span class="sf-eyebrow">Xem trước bản in</span><strong>Giấy đề nghị thanh toán · ${escapeHtmlOutput(payload.id)}</strong></div>
          <button type="button" class="sf-button sf-primary" onclick="window.print()">${ic('print')}<span>In phiếu</span></button>
        </div>
        
        <div class="print-page">
          <div class="header-logo"><img src="${TascoAssets.url('assets/images/tasco-letterhead.png')}" style="height: 65px; width: auto; max-width: 200px; object-fit: contain;" alt="TASCO INSURANCE"></div>
          <div class="title">GIẤY ĐỀ NGHỊ THANH TOÁN</div>
          <div class="subtitle">Payment requisition</div>
          
          <div class="info-line">Họ và tên / <i>Full name:</i> <strong>${escapeHtmlOutput(payload.gdvName)}</strong></div>
          <div class="info-line">Bộ phận / <i>Division:</i> Ban GĐBT</div>
          <div class="info-line">Nội dung thanh toán / <i>Description:</i> Thanh toán tiền chi phí giám định hiện trường</div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%;"><div style="padding-top: 6px;">STT<br><i>No.</i></div></th>
                <th style="width: 30%;"><div style="padding-top: 6px;">Diễn giải<br><i>Details</i></div></th>
                <th style="width: 12%;"><div style="padding-top: 6px;">Số hóa đơn<br><i>Invoice No</i></div></th>
                <th style="width: 15%;"><div style="padding-top: 6px;">Số tiền<br>trước thuế<br><i>Amount before<br>VAT</i></div></th>
                <th style="width: 8%;"><div style="padding-top: 6px;">Thuế GTGT<br><i>VAT</i></div></th>
                <th style="width: 15%;"><div style="padding-top: 6px;">Tổng tiền<br><i>Total in ...</i></div></th>
                <th style="width: 15%;"><div style="padding-top: 6px;">Ghi chú</div></th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td colspan="3" style="text-align: center;">Tổng cộng / Total</td>
                <td style="text-align: right;">${sumTotal.toLocaleString('vi-VN')}</td>
                <td style="text-align: right;"></td>
                <td style="text-align: right;">${sumTotal.toLocaleString('vi-VN')}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div style="margin-bottom: 25px;">Bằng chữ / <i>in word:</i> ${numberToWordsVN(sumTotal)}.</div>

          <div style="margin-bottom: 15px;">
            <div>Tôi xác nhận số tiền đề nghị thanh toán/tạm ứng là trung thực, chính xác, đúng qui định và hợp pháp</div>
            <div style="font-style: italic; font-size: 12px;">I confirm that the amounts requested for payment is genuine, validity, accuracy and legality</div>
          </div>
          
          <div style="margin-bottom: 20px; font-weight: bold;">
            Thông tin chuyển khoản / <i>information bank:</i>
            <div style="margin-top: 5px; font-weight: normal;">Người thụ hưởng / <i>Beneficiary name:</i> <strong>${payload.bankBeneficiary ? escapeHtmlOutput(payload.bankBeneficiary) : escapeHtmlOutput(payload.gdvName)}</strong></div>
            <div style="font-weight: normal;">Tài khoản / <i>Account number:</i> ${payload.bankAccount ? escapeHtmlOutput(payload.bankAccount) : '........................................'}</div>
            <div style="font-weight: normal;">Tại ngân hàng / <i>At bank:</i> ${payload.bankName ? escapeHtmlOutput(payload.bankName) : '........................................'}</div>
          </div>

          <div style="display: inline-block; width: 100%; page-break-inside: avoid !important; break-inside: avoid !important;">
          <div class="signatures">
            <div class="sig-box">
              <div class="sig-header">
                <div class="sig-title">Chữ ký người đề nghị</div>
                <div class="sig-en">Requester's signature</div>
              </div>
              <div class="sig-footer">
                <div>Tên/Name:</div>
                <div>Ngày/Date: ..............</div>
              </div>
            </div>
            <div class="sig-box">
              <div class="sig-header">
                <div class="sig-title">Xác nhận trưởng bộ phận</div>
                <div class="sig-en">Verified by</div>
              </div>
              <div class="sig-footer">
                <div>Tên/Name:</div>
                <div>Ngày/Date: ..............</div>
              </div>
            </div>
            <div class="sig-box">
              <div class="sig-header">
                <div class="sig-title">Trưởng phòng KT vận hành</div>
                <div class="sig-en">Approved</div>
              </div>
              <div class="sig-footer">
                <div>Tên/Name:</div>
                <div>Ngày/Date: ..............</div>
              </div>
            </div>
            <div class="sig-box">
              <div class="sig-header">
                <div class="sig-title">Lãnh đạo phê duyệt</div>
                <div class="sig-en">Approved by</div>
              </div>
              <div class="sig-footer">
                <div>Tên/Name:</div>
                <div>Ngày/Date: ..............</div>
              </div>
                        </div>
          </div>
          </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }



    

    function exportFieldReimbursementToExcel(batchId) {
      if (!window.XLSX) {
        triggerToast('Thư viện XLSX chưa tải xong, vui lòng thử lại.', 'error');
        return;
      }
      const payload = cachedFieldReimbursementsPayload[batchId];
      if (!payload) return;

      const items = payload.items || [];
      const d = new Date(payload.createdAt);
      const mStr = d.getMonth() + 1;
      const yStr = d.getFullYear();

      const aoa = [
        ['BẢNG KÊ CHI TIẾT CHI PHÍ GIÁM ĐỊNH HIỆN TRƯỜNG', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        [`Tháng ${mStr} Năm ${yStr}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        [
          'STT', 'Mã NV', 'Họ và tên',
          'Thời gian làm thực tế\n(08:20 không nhập 8h20)', '', '', '',
          'Trong giờ hành chính\n(8h00 - 18h00)',
          'Ngoài giờ hành chính\n(18h00 - 8h00)',
          'Ngày nghỉ\n(chỉ tính ngày chủ nhật), ngày lễ',
          'Chi tiết Khách hàng giám định', '',
          'Khoảng cách', 'Chi phí thù lao giám định', 'Phương tiện di chuyển',
          'Chi phí phát sinh', '', '', ''
        ],
        [
          '', '', '',
          'Ngày/ tháng/năm', 'Thứ', 'Bắt đầu', 'Kết thúc',
          '', '', '',
          'Biển số xe của KH', 'Số HSBT',
          '', '', '',
          'Chi phí đi lại', 'Công tác phí\n(nếu thời gian giám định > 15 giờ)', 'Chi phí lưu trú\n(nếu có)', 'Địa bàn giám định\n(trường hợp phát sinh CP lưu trú)'
        ]
      ];

      const gdvProfile = (typeof cachedUsersPayload !== 'undefined' && cachedUsersPayload[payload.gdvUid]) ? cachedUsersPayload[payload.gdvUid].profile : {};
      const employeeIdExcel = gdvProfile?.employeeId || (payload.gdvUid ? payload.gdvUid.substring(0, 7).toUpperCase() : '');

      items.forEach((item, idx) => {
        let dStart = new Date(item.startDatetime || item.datetime);
        let dEnd = new Date(item.datetime);
        
        let dateStr = dEnd.toLocaleDateString('en-GB');
        let dayOfWeek = dEnd.getDay() === 0 ? 'CN' : (dEnd.getDay() + 1).toString();
        let startTime = item.startDatetime ? dStart.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}) : '';
        let endTime = dEnd.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'});

        let isInOfficeHours = (!item.calcResult.isAfterHours && !item.calcResult.isWeekendOrHoliday) ? 'x' : '';
        let isAfterHours = (item.calcResult.isAfterHours && !item.calcResult.isWeekendOrHoliday) ? 'x' : '';
        let isWeekendHoliday = item.calcResult.isWeekendOrHoliday ? 'x' : '';

        if (item.calcResult.isWeekendOrHoliday) {
           isInOfficeHours = '';
           isAfterHours = '';
           isWeekendHoliday = 'x';
        } else if (item.calcResult.isAfterHours) {
           isInOfficeHours = '';
           isAfterHours = 'x';
           isWeekendHoliday = '';
        }

        aoa.push([
          idx + 1,
          employeeIdExcel,
          payload.gdvName,
          dateStr,
          dayOfWeek,
          startTime,
          endTime,
          isInOfficeHours,
          isAfterHours,
          isWeekendHoliday,
          item.bienSo,
          item.soHSBT || '',
          item.distanceKm,
          item.calcResult.finalCost || 0,
          item.vehicle || 'Phương tiện cá nhân',
          item.travelCost || '',
          item.perDiem || '',
          item.hotelCost || '',
          item.location || ''
        ]);
      });

      aoa.push(Array(19).fill(''));
      aoa.push(['NGƯỜI LẬP', '', '', '', '', '', '', '', '', '', '', '', '', '', 'XÁC NHẬN CỦA TRƯỞNG TRUNG TÂM GIÁM ĐỊNH', '', '', '', '']);

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 18 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 18 } },
        { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
        { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },
        { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },
        { s: { r: 2, c: 3 }, e: { r: 2, c: 6 } },
        { s: { r: 2, c: 7 }, e: { r: 3, c: 7 } },
        { s: { r: 2, c: 8 }, e: { r: 3, c: 8 } },
        { s: { r: 2, c: 9 }, e: { r: 3, c: 9 } },
        { s: { r: 2, c: 10 }, e: { r: 2, c: 11 } },
        { s: { r: 2, c: 12 }, e: { r: 3, c: 12 } },
        { s: { r: 2, c: 13 }, e: { r: 3, c: 13 } },
        { s: { r: 2, c: 14 }, e: { r: 3, c: 14 } },
        { s: { r: 2, c: 15 }, e: { r: 2, c: 18 } },
        { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 3 } },
        { s: { r: aoa.length - 1, c: 14 }, e: { r: aoa.length - 1, c: 18 } }
      ];

      for (let R = 0; R < aoa.length; ++R) {
        for (let C = 0; C < 19; ++C) {
          let cellAddress = {c: C, r: R};
          let cellRef = XLSX.utils.encode_cell(cellAddress);
          if (!ws[cellRef]) continue;
          
          if (!ws[cellRef].s) ws[cellRef].s = {};
          
          ws[cellRef].s.font = { name: "Times New Roman", sz: 11 };
          ws[cellRef].s.alignment = { vertical: "center", horizontal: "center", wrapText: true };
          
          if (R > 1 && R < aoa.length - 2) {
            ws[cellRef].s.border = {
               top: { style: "thin", color: { auto: 1 } },
               bottom: { style: "thin", color: { auto: 1 } },
               left: { style: "thin", color: { auto: 1 } },
               right: { style: "thin", color: { auto: 1 } }
            };
          }

          if (R === 0) {
            ws[cellRef].s.font = { name: "Times New Roman", sz: 14, bold: true };
          } else if (R === 1) {
             ws[cellRef].s.font = { name: "Times New Roman", sz: 11, bold: false, italic: true };
          } else if (R === 2 || R === 3) {
            ws[cellRef].s.font = { name: "Times New Roman", sz: 10, bold: true };
            if (C === 7 || C === 8 || C === 9 || (R===2 && C===3)) {
               ws[cellRef].s.font.color = { rgb: "FF0000" };
            }
          } else if (R === aoa.length - 1) {
            ws[cellRef].s.font = { name: "Times New Roman", sz: 11, bold: true };
          }
        }
      }

      ws['!cols'] = [
        { wch: 5 }, { wch: 10 }, { wch: 20 },
        { wch: 12 }, { wch: 5 }, { wch: 8 }, { wch: 8 },
        { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 25 },
        { wch: 10 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }
      ];

      ws['!rows'] = [{hpt: 20}, {hpt: 20}, {hpt: 35}, {hpt: 55}];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BangKe_ChiPhiHT');
      XLSX.writeFile(wb, `BangKe_ChiPhi_HienTruong_${batchId}.xlsx`);
    }
