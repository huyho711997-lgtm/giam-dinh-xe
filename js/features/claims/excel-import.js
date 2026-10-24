

// Cập nhật dữ liệu hồ sơ từ file Excel: file mới là dữ liệu hiển thị, mỗi lần nhập lưu phiên bản (import-versions.js).
let excelImportFileName = '';
function openImportExcelModal() {
      if (typeof ClaimImportVersions !== 'undefined' && !ClaimImportVersions.isAdmin()) {
        triggerToast('Chỉ quản trị viên được cập nhật dữ liệu hồ sơ từ file Excel.', 'error');
        return;
      }
      const modal = document.getElementById('importExcelModalOverlay');
      if (modal) {
        modal.style.display = 'grid';
        modal.setAttribute('aria-hidden', 'false');
      }
      const fileInp = document.getElementById('fileExcelInput');
      if (fileInp) fileInp.value = '';
      excelImportFileName = '';
      document.getElementById('lblExcelFileName').innerHTML = 'Kéo thả file Excel vào đây hoặc <u>chọn từ máy</u>';
      const preview = document.getElementById('excelPreviewContainer');
      preview.style.display = 'none'; preview.innerHTML = '';
      const btnSubmit = document.getElementById('btnSubmitImportExcel');
      if (btnSubmit) btnSubmit.disabled = true;
      document.getElementById('lblSubmitCount').textContent = '0';
      parsedExcelBatchRows = [];
    }


    function closeImportExcelModal() {
      const modal = document.getElementById('importExcelModalOverlay');
      if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
    }




    function isSameDateString(d1, d2) {
      if (!d1 || !d2) return false;
      const dp1 = parseDateParts(d1);
      const dp2 = parseDateParts(d2);
      if (dp1 && dp2) {
        return dp1.day === dp2.day && dp1.month === dp2.month && dp1.year === dp2.year;
      }

      const s1 = String(d1).trim().replace(/\D/g, '');
      const s2 = String(d2).trim().replace(/\D/g, '');
      return !!s1 && s1 === s2;
    }


    function handleExcelFileSelected(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!window.XLSX) {
        triggerToast('Thư viện XLSX đang tải, vui lòng thử lại sau vài giây...', 'warning');
        return;
      }

      excelImportFileName = file.name;
      document.getElementById('lblExcelFileName').textContent = 'Đang đọc tệp: ' + file.name + '…';

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (!jsonRows || jsonRows.length < 2) {
            triggerToast('Tệp Excel không chứa dữ liệu hợp lệ.', 'error');
            return;
          }

          processParsedExcelData(jsonRows);
          document.getElementById('lblExcelFileName').textContent = file.name + ' · bấm để chọn file khác';
        } catch (err) {
          console.error("Lỗi đọc Excel:", err);
          triggerToast('Lỗi đọc tệp Excel: ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    }


    function promptAssignSoHoSoBoiThuong(claimId, currentVal) {
      if (!claimId) return;
      activeAssigningClaimId = claimId;

      const claimObj = (cachedPendingClaimsPayload || {})[claimId] || {};
      const modal = document.getElementById('assignSoHsbtModalOverlay');
      const inputEl = document.getElementById('txtAssignSoHsbtInput');
      const subtitleEl = document.getElementById('assignSoHsbtModalSubtitle');

      if (subtitleEl) {
        subtitleEl.textContent = `Phương tiện: ${claimObj.bienSo || '—'} (${claimObj.maVuTonThat || ''})`;
      }

      if (inputEl) {
        inputEl.value = currentVal || claimObj.soHoSoBoiThuong || '';
        inputEl.onkeydown = function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveAssignSoHsbtFromModal();
          }
        };
      }

      if (modal) {
        modal.style.display = 'grid';
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => inputEl?.focus(), 100);
      }
    }


    function closeAssignSoHsbtModal() {
      const modal = document.getElementById('assignSoHsbtModalOverlay');
      if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
      activeAssigningClaimId = null;
    }


    async function saveAssignSoHsbtFromModal() {
      if (!activeAssigningClaimId) return;

      const inputEl = document.getElementById('txtAssignSoHsbtInput');
      const btnSave = document.getElementById('btnSaveAssignSoHsbt');
      const newVal = (inputEl?.value || '').trim();

      if (btnSave) btnSave.disabled = true;

      try {
        await dbNodeInstance.ref(`pending_claims/${activeAssigningClaimId}/soHoSoBoiThuong`).set(newVal);
        await dbNodeInstance.ref(`pending_claims/${activeAssigningClaimId}/updatedAt`).set(Date.now());
        closeAssignSoHsbtModal();
        triggerToast('Đã gán Số hồ sơ bồi thường thành công!', 'success');
        executeUIRenderPendingClaims();
      } catch (e) {
        console.error(e);
        triggerToast('Lỗi gán Số HSBT: ' + e.message, 'error');
      } finally {
        if (btnSave) btnSave.disabled = false;
      }
    }


    function parseDateParts(dateInput) {
      if (dateInput === null || dateInput === undefined || dateInput === '') return null;

      const str = String(dateInput).trim();
      if (!str || str === '—' || str === '0' || str === 'null' || str === 'undefined' || str.includes('1970')) return null;

      const num = Number(str);
      // 1. Check Excel Serial Date Floating Number (30000 to 75000)
      if (!isNaN(num) && num >= 30000 && num <= 75000) {
        const totalSeconds = Math.round((num - 25569) * 86400);
        const jsDate = new Date(totalSeconds * 1000);
        if (!isNaN(jsDate.getTime())) {
          return {
            day: jsDate.getUTCDate(),
            month: jsDate.getUTCMonth() + 1,
            year: jsDate.getUTCFullYear(),
            hours: jsDate.getUTCHours(),
            minutes: jsDate.getUTCMinutes(),
            seconds: jsDate.getUTCSeconds(),
            hasTime: (jsDate.getUTCHours() > 0 || jsDate.getUTCMinutes() > 0 || jsDate.getUTCSeconds() > 0)
          };
        }
      }

      // 2. Check Millisecond Unix Timestamp
      if (!isNaN(num) && num > 100000000000) {
        const dt = new Date(num);
        if (!isNaN(dt.getTime()) && dt.getFullYear() > 1970) {
          return {
            day: dt.getDate(),
            month: dt.getMonth() + 1,
            year: dt.getFullYear(),
            hours: dt.getHours(),
            minutes: dt.getMinutes(),
            seconds: dt.getSeconds(),
            hasTime: (dt.getHours() > 0 || dt.getMinutes() > 0 || dt.getSeconds() > 0)
          };
        }
      }

      // 3. String split by separators (YYYY-MM-DD or DD/MM/YYYY)
      const parts = str.split(/[\/\-\.\sT:]/).filter(Boolean);
      if (parts.length >= 3) {
        let p1 = parseInt(parts[0], 10);
        let p2 = parseInt(parts[1], 10);
        let p3 = parseInt(parts[2], 10);

        if (p1 > 1000) {
          let hours = 0, minutes = 0, seconds = 0, hasTime = false;
          if (parts.length >= 4) {
            hours = parseInt(parts[3], 10) || 0;
            minutes = parseInt(parts[4], 10) || 0;
            seconds = parseInt(parts[5], 10) || 0;
            hasTime = true;
          }
          return { day: p3, month: p2, year: p1, hours, minutes, seconds, hasTime };
        } else if (p3 > 1000) {
          let day = p1, month = p2;
          if (p1 <= 12 && p2 > 12) { month = p1; day = p2; }
          else if (p1 > 12 && p2 <= 12) { day = p1; month = p2; }

          let hours = 0, minutes = 0, seconds = 0, hasTime = false;
          if (parts.length >= 4) {
            hours = parseInt(parts[3], 10) || 0;
            minutes = parseInt(parts[4], 10) || 0;
            seconds = parseInt(parts[5], 10) || 0;
            hasTime = true;
          }
          return { day, month, year: p3, hours, minutes, seconds, hasTime };
        }
      }

      const d = new Date(str);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
        return {
          day: d.getDate(),
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          hours: d.getHours(),
          minutes: d.getMinutes(),
          seconds: d.getSeconds(),
          hasTime: (d.getHours() > 0 || d.getMinutes() > 0 || d.getSeconds() > 0)
        };
      }

      return null;
    }


        function formatCleanDateField(val) {
      if (val === null || val === undefined || val === '' || val === '—' || val === '0' || val === 0 || val === 'null' || val === 'undefined') return '';
      const str = String(val).trim();
      if (!str || str === '—' || str === '0' || str === 'null' || str === 'undefined' || str.includes('1970') || str.includes('1/1/1970') || str.includes('01/01/1970')) return '';
      const res = formatDateDisplay(str);
      return (res !== '—' && !res.includes('1970')) ? res : '';
    }


function formatDateDisplay(val) {
      if (!val) return '—';
      const str = String(val).trim();
      if (!str || str === '—' || str === '0' || str === 'null' || str === 'undefined' || str === '1970-01-01' || str.includes('1970') || str.includes('1/1/1970') || str.includes('01/01/1970')) return '—';

      const dp = parseDateParts(str);
      if (dp) {
        if (dp.year <= 1970) return '—';
        let res = `${String(dp.day).padStart(2,'0')}/${String(dp.month).padStart(2,'0')}/${dp.year}`;
        if (dp.hasTime || (dp.hours > 0 || dp.minutes > 0)) {
          res += ` ${String(dp.hours).padStart(2,'0')}:${String(dp.minutes).padStart(2,'0')}`;
          if (dp.seconds > 0) {
            res += `:${String(dp.seconds).padStart(2,'0')}`;
          }
        } else {
          const timeMatch = str.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
          if (timeMatch && (timeMatch[1] !== '00' || timeMatch[2] !== '00')) {
            res += ` ${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}`;
          }
        }
        return res;
      }
      return str.includes('1970') ? '—' : str;
    }


    function getClaimToTrinhDuyetDate(c) {
      if (!c || typeof c !== 'object') return '';
      if (c.toTrinhNgayDuyet && typeof c.toTrinhNgayDuyet === 'string' && c.toTrinhNgayDuyet.trim() && c.toTrinhNgayDuyet !== '—' && c.toTrinhNgayDuyet !== '-') {
        return c.toTrinhNgayDuyet.trim();
      }
      if (c.modalPendingToTrinhNgayDuyet && typeof c.modalPendingToTrinhNgayDuyet === 'string' && c.modalPendingToTrinhNgayDuyet.trim()) {
        return c.modalPendingToTrinhNgayDuyet.trim();
      }
      if (c.toTrinhBtNgayDuyet && typeof c.toTrinhBtNgayDuyet === 'string' && c.toTrinhBtNgayDuyet.trim()) {
        return c.toTrinhBtNgayDuyet.trim();
      }
      if (c.ngayDuyetHsbt && typeof c.ngayDuyetHsbt === 'string' && c.ngayDuyetHsbt.trim()) {
        return c.ngayDuyetHsbt.trim();
      }
      for (const key of Object.keys(c)) {
        const val = c[key];
        if (val === null || val === undefined || val === '' || val === '—' || val === '-') continue;
        const nk = key.replace(/[\u2013\u2014]/g, '-').trim().toLowerCase();
        if (
          (nk.includes('tờ trình') && nk.includes('ngày duyệt')) ||
          (nk.includes('to trinh') && nk.includes('ngay duyet')) ||
          nk === 'ngày duyệt hsbt' ||
          nk === 'ngay duyet hsbt' ||
          nk === 'totrinhngayduyet'
        ) {
          return String(val).trim();
        }
      }
      return '';
    }


    function getClaimGdvName(c) {
      if (!c || typeof c !== 'object') return '';
      const candidates = [
        c.gdvTiepNhan,
        c.canBoXuLy,
        c.toTrinhNguoiDuyet,
        c['Tờ trình BT - Người duyệt'],
        c['Tờ trình BT – Người duyệt'],
        c.pascNguoiDuyet,
        c['PASC - Người duyệt'],
        c['PASC – Người duyệt'],
        c.gdvHo,
        c.canBoBoiThuong,
        c.gdvName,
        c.createdByName
      ];
      for (const cand of candidates) {
        if (cand && typeof cand === 'string') {
          const clean = cand.trim();
          if (clean && clean !== '—' && clean !== '-' && clean !== 'Chưa phân công' && clean !== 'Hệ thống Excel') {
            return clean;
          }
        }
      }
      return (c.gdvTiepNhan || c.canBoXuLy || c.toTrinhNguoiDuyet || c.gdvHo || '').trim();
    }


    function isSameDateString(d1, d2) {
      if (!d1 || !d2) return false;
      const dp1 = parseDateParts(d1);
      const dp2 = parseDateParts(d2);
      if (dp1 && dp2) {
        return dp1.day === dp2.day && dp1.month === dp2.month && dp1.year === dp2.year;
      }

      const s1 = String(d1).trim().replace(/\D/g, '');
      const s2 = String(d2).trim().replace(/\D/g, '');
      return !!s1 && s1 === s2;
    }


    function processParsedExcelData(rows) {
      let headerIndex = -1;
      let colMap = {
        chiNhanhXuly: -1, chiNhanh: -1, ttkd: -1, phongBan: -1, soHd: -1, nguoiCapDon: -1,
        giaTriXe: -1, soTienBh: -1, soGcn: -1, ngayHieuLuc: -1, ngayHetHan: -1, kenhKhaiThac: -1,
        chiTietKenh: -1, maKhaiThac: -1, hinhThucCapDon: -1, ngayThanhToanPhi: -1, phiBh: -1,
        khachHang: -1, bsx: -1, hieuXe: -1, loaiXe: -1, hangXe: -1, namSanXuat: -1, loaiDongCo: -1,
        mdsd: -1, soChoTrongTai: -1, soHsbt: -1, maSpNghiepVu: -1, status: -1, ngayThongBao: -1,
        date: -1, ngayMoHs: -1, doiTuongTonThat: -1, tinhTonThat: -1, dienBienTonThat: -1,
        diaDiemTonThat: -1, nhomNguyenNhan: -1, maGara: -1, gdvHo: -1, uocThietHai: -1,
        pascNgayDuyet: -1, pascNguoiDuyet: -1, gara: -1, pascSoTienDuyet: -1, toTrinhNgayDuyet: -1,
        toTrinhNguoiDuyet: -1, ttbtSoTienBoiThuong: -1, chiPhiGiamDinh: -1, chiPhiCuuHo: -1,
        chiPhiKhac: -1, amount: -1, duPhongBoiThuong: -1, thuDoiDongBhTyLe: -1,
        thuDoiDongBhSoTien: -1, dongBhFollowTyLe: -1, dongBhFollowSoTien: -1,
        tongBoiThuongSauThue: -1, vat: -1, ngayNhanDuHoSo: -1, ngayDuyetDnttDauTien: -1,
        ngayDuyetDnttCuoiCung: -1, ngayKtXacNhan: -1, soTienDaThanhToan: -1, ngayThanhToan: -1,
        ghiChu: -1, lyDoHuy: -1, agentUniqCode: -1, garageUniqCode: -1, zoneBoiThuong: -1,
        khuVucGiamDinh: -1, tenGaraVietTat: -1, vtt: -1, vcx: -1, tnds: -1, ttbtTongSoTienBoiThuong: -1
      };

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;

        row.forEach((cell, colIdx) => {
          const text = String(cell || '').trim().toLowerCase().replace(/[\u2013\u2014]/g, '-');
          if (text.includes('chi nhánh xử lý')) colMap.chiNhanhXuly = colIdx;
          else if (text.includes('chi nhánh')) colMap.chiNhanh = colIdx;
          else if (text.includes('ttkd')) colMap.ttkd = colIdx;
          else if (text.includes('phòng ban')) colMap.phongBan = colIdx;
          else if (text.includes('số hđ') || text.includes('số hợp đồng')) colMap.soHd = colIdx;
          else if (text.includes('người cấp đơn')) colMap.nguoiCapDon = colIdx;
          else if (text.includes('giá trị khai báo xe')) colMap.giaTriXe = colIdx;
          else if (text.includes('số tiền bh')) colMap.soTienBh = colIdx;
          else if (text.includes('số gcn')) colMap.soGcn = colIdx;
          else if (text.includes('ngày hiệu lực')) colMap.ngayHieuLuc = colIdx;
          else if (text.includes('ngày hết hạn')) colMap.ngayHetHan = colIdx;
          else if (text.includes('chi tiết kênh')) colMap.chiTietKenh = colIdx;
          else if (text.includes('kênh khai thác')) colMap.kenhKhaiThac = colIdx;
          else if (text.includes('mã khai thác')) colMap.maKhaiThac = colIdx;
          else if (text.includes('hình thức cấp đơn')) colMap.hinhThucCapDon = colIdx;
          else if (text.includes('ngày thanh toán phí')) colMap.ngayThanhToanPhi = colIdx;
          else if (text.includes('phí bh')) colMap.phiBh = colIdx;
          else if (text.includes('khách hàng')) colMap.khachHang = colIdx;
          else if (text.includes('biển xe') || text.includes('biển số') || text.includes('bsx') || text.includes('bks')) colMap.bsx = colIdx;
          else if (text.includes('hiệu xe')) colMap.hieuXe = colIdx;
          else if (text.includes('loại xe')) colMap.loaiXe = colIdx;
          else if (text.includes('hãng xe')) colMap.hangXe = colIdx;
          else if (text.includes('năm sản xuất')) colMap.namSanXuat = colIdx;
          else if (text.includes('loại động cơ')) colMap.loaiDongCo = colIdx;
          else if (text.includes('mđsd')) colMap.mdsd = colIdx;
          else if (text.includes('số chỗ') || text.includes('trọng tải')) colMap.soChoTrongTai = colIdx;
          else if (text.includes('số hồ sơ bồi thường') || text.includes('số hsbt')) colMap.soHsbt = colIdx;
          else if (text.includes('mã sp') || text.includes('nghiệp vụ') || text.includes('sản phẩm')) colMap.maSpNghiepVu = colIdx;
          else if (text.includes('vật chất xe') || text === 'vcx') colMap.vcx = colIdx;
          else if (text.includes('trách nhiệm dân sự') || text === 'tnds') colMap.tnds = colIdx;
          else if (text.includes('trạng thái hồ sơ') || text.includes('trạng thái') || text.includes('tình trạng')) colMap.status = colIdx;
          else if (text.includes('ngày thông báo') || text.includes('thời gian thông báo') || text.includes('ngày tb') || text.includes('thời gian tb') || text.includes('ngày khai báo') || text.includes('thời gian khai báo')) colMap.ngayThongBao = colIdx;
          else if (text.includes('ngày tổn thất') || text.includes('ngày tt')) colMap.date = colIdx;
          else if (text.includes('ngày mở hs')) colMap.ngayMoHs = colIdx;
          else if (text.includes('đối tượng tổn thất')) colMap.doiTuongTonThat = colIdx;
          else if (text.includes('tỉnh tổn thất')) colMap.tinhTonThat = colIdx;
          else if (text.includes('diễn biến tổn thất')) colMap.dienBienTonThat = colIdx;
          else if (text.includes('địa điểm tổn thất')) colMap.diaDiemTonThat = colIdx;
          else if (text.includes('nhóm nguyên nhân')) colMap.nhomNguyenNhan = colIdx;
          else if (text.includes('mã gara sửa chữa')) colMap.maGara = colIdx;
          else if (text.includes('gđv ho')) colMap.gdvHo = colIdx;
          else if (text.includes('ước thiệt hại')) colMap.uocThietHai = colIdx;
          else if (text.includes('tờ trình bt - ngày duyệt') || text.includes('tờ trình - ngày duyệt') || text.includes('tờ trình ngày duyệt') || (text.includes('tờ trình') && text.includes('ngày duyệt')) || text.includes('ngày duyệt hsbt')) colMap.toTrinhNgayDuyet = colIdx;
          else if (text.includes('tờ trình bt - người duyệt') || text.includes('tờ trình - người duyệt') || (text.includes('tờ trình') && text.includes('người duyệt')) || text.includes('người duyệt tờ trình') || text.includes('người duyệt hsbt')) colMap.toTrinhNguoiDuyet = colIdx;
          else if (text.includes('pasc - ngày duyệt')) colMap.pascNgayDuyet = colIdx;
          else if (text.includes('pasc - người duyệt')) colMap.pascNguoiDuyet = colIdx;
          else if (text.includes('pasc - số tiền')) colMap.pascSoTienDuyet = colIdx;
          else if (text.includes('tên gara (viết tắt)')) colMap.tenGaraVietTat = colIdx;
          else if (text.includes('gara sửa chữa') || text.includes('gara') || text.includes('xưởng')) colMap.gara = colIdx;
          else if (text.includes('ttbt - số tiền bồi thường')) colMap.ttbtSoTienBoiThuong = colIdx;
          else if (text.includes('ttbt - chi phí giám định')) colMap.chiPhiGiamDinh = colIdx;
          else if (text.includes('ttbt - chi phí cứu hộ')) colMap.chiPhiCuuHo = colIdx;
          else if (text.includes('ttbt - chi phí khác')) colMap.chiPhiKhac = colIdx;
          else if (text.includes('ttbt - tổng số tiền bồi thường sau thuế')) colMap.tongBoiThuongSauThue = colIdx;
          else if (text.includes('ttbt - tổng số tiền bồi thường')) colMap.ttbtTongSoTienBoiThuong = colIdx;
          else if (text.includes('tổng số tiền bồi thường')) colMap.amount = colIdx;
          else if (text.includes('dự phòng bồi thường') || text === 'dự phòng' || text === 'dpbt' || text.includes('dự phòng bt')) colMap.duPhongBoiThuong = colIdx;
          else if (text.includes('thu đòi đồng bảo hiểm - tỷ lệ')) colMap.thuDoiDongBhTyLe = colIdx;
          else if (text.includes('thu đòi đồng bảo hiểm - số tiền')) colMap.thuDoiDongBhSoTien = colIdx;
          else if (text.includes('đồng bảo hiểm follow - tỷ lệ')) colMap.dongBhFollowTyLe = colIdx;
          else if (text.includes('đồng bảo hiểm follow - số tiền')) colMap.dongBhFollowSoTien = colIdx;
          else if (text.includes('vat')) colMap.vat = colIdx;
          else if (text.includes('ngày nhận đủ hồ sơ') || text.includes('ngày nhận đủ hs') || text.includes('nhận đủ hồ sơ') || text.includes('nhận đủ hs') || text.includes('ngay nhan du ho so') || text.includes('ngay_nhan_du_ho_so') || text.includes('ngày nhận đủ') || text.includes('nhận đủ')) colMap.ngayNhanDuHoSo = colIdx;
          else if (text.includes('ngày duyệt đntt đầu tiên')) colMap.ngayDuyetDnttDauTien = colIdx;
          else if (text.includes('ngày duyệt đntt cuối cùng')) colMap.ngayDuyetDnttCuoiCung = colIdx;
          else if (text.includes('ngày kt xác nhận')) colMap.ngayKtXacNhan = colIdx;
          else if (text.includes('số tiền đã thanh toán')) colMap.soTienDaThanhToan = colIdx;
          else if (text.includes('ngày thanh toán')) colMap.ngayThanhToan = colIdx;
          else if (text.includes('ghi chú')) colMap.ghiChu = colIdx;
          else if (text.includes('lý do đề xuất huỷ') || text.includes('lý do huỷ')) colMap.lyDoHuy = colIdx;
          else if (text.includes('agent_uniq_code')) colMap.agentUniqCode = colIdx;
          else if (text.includes('garage_uniq_code')) colMap.garageUniqCode = colIdx;
          else if (text.includes('zone bồi thường')) colMap.zoneBoiThuong = colIdx;
          else if (text.includes('khu vực giám định')) colMap.khuVucGiamDinh = colIdx;
          else if (text.includes('mã vtt') || text.includes('mã vụ')) colMap.vtt = colIdx;
        });

        if (colMap.bsx !== -1 || colMap.soHsbt !== -1 || colMap.vtt !== -1) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        headerIndex = 0;
        colMap = { bsx: 0, vtt: 1, gara: 2, status: 3, date: 4, amount: 5, soHsbt: 6 };
      }

      const allClaims = Object.values(cachedPendingClaimsPayload || {}).filter(c => c && typeof c === 'object');
      parsedExcelBatchRows = [];

      const getVal = (r, idx) => (idx !== undefined && idx !== -1) ? String(r[idx] || '').trim() : '';

      for (let i = headerIndex + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!Array.isArray(r) || r.every(c => !String(c).trim())) continue;

        let rawBsxRaw = getVal(r, colMap.bsx);
        let rawBsx = rawBsxRaw;
        if (rawBsx.includes('/')) {
          rawBsx = rawBsx.split('/')[0].trim();
        }
        const rawDateRaw = getVal(r, colMap.date) || getVal(r, colMap.ngayMoHs) || getVal(r, colMap.ngayThongBao);
        const rawDate = formatDateDisplay(rawDateRaw);
        const rawVtt = getVal(r, colMap.vtt);
        const rawSoHsbt = getVal(r, colMap.soHsbt);
        const rawStatusStr = getVal(r, colMap.status);
        const rawGara = getVal(r, colMap.gara) || getVal(r, colMap.tenGaraVietTat);
        const rawAmount = getVal(r, colMap.amount) || getVal(r, colMap.ttbtSoTienBoiThuong) || getVal(r, colMap.pascSoTienDuyet);

        if (!rawBsx && !rawVtt && !rawSoHsbt) continue;

        let targetStatus = 'moi';
        if (rawStatusStr) {
          const stLower = rawStatusStr.trim().toLowerCase();
          if (stLower.includes('từ chối') || stLower.includes('tu choi') || stLower.includes('hủy') || stLower.includes('huy')) targetStatus = 'tu_choi';
          else if (stLower.includes('đã thanh toán') || stLower.includes('da thanh toan') || stLower.includes('thanh toán') || stLower.includes('thanh toan')) targetStatus = 'da_thanh_toan';
          else if (stLower === 'kt duyệt' || stLower.includes('kt duyệt') || stLower.includes('kế toán duyệt')) targetStatus = 'kt_duyet';
          else if (stLower.includes('chờ kt') || stLower.includes('cho kt') || stLower.includes('chờ kế toán')) targetStatus = 'cho_kt_duyet';
          else if (stLower.includes('chờ duyệt đntt') || stLower.includes('cho duyet dntt') || stLower.includes('đntt')) targetStatus = 'cho_duyet_dntt';
          else if (stLower.includes('đã duyệt hsbt') || stLower.includes('da duyet hsbt')) targetStatus = 'da_duyet_hsbt';
          else if (stLower.includes('chờ duyệt hsbt') || stLower.includes('cho duyet hsbt')) targetStatus = 'cho_duyet_hsbt';
          else if (stLower.includes('đã duyệt pasc') || stLower.includes('da duyet pasc')) targetStatus = 'da_duyet_pasc';
          else if (stLower.includes('chờ duyệt pasc') || stLower.includes('cho duyet pasc')) targetStatus = 'cho_duyet_pasc';
          else if (stLower.includes('đã gđct') || stLower.includes('da gdct') || stLower.includes('giám định chi tiết')) targetStatus = 'da_gdct';
          else if (stLower.includes('chờ gđct') || stLower.includes('cho gdct')) targetStatus = 'cho_gdct';
          else if (stLower.includes('đã giám định ht') || stLower.includes('da giam dinh ht') || stLower.includes('gđ hiện trường') || stLower.includes('gd ht')) targetStatus = 'da_giam_dinh_ht';
          else if (stLower.includes('chờ giám định ht') || stLower.includes('cho giam dinh ht') || stLower.includes('chờ gđ ht')) targetStatus = 'cho_giam_dinh_ht';
          else if (stLower.includes('mới') || stLower.includes('moi') || stLower.includes('tiếp nhận')) targetStatus = 'moi';
          else {
            for (const [k, cfg] of Object.entries(PENDING_STATUS_MAP)) {
              if (cfg.label.toLowerCase() === stLower) { targetStatus = k; break; }
            }
          }
        }

        const normBsx = rawBsx.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const normVtt = rawVtt.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const normSoHsbt = rawSoHsbt.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

        let matchedClaim = null;
        let matchType = 'new_claim';

        // STRICT MATCHING RULE: Only use 'Số hồ sơ bồi thường' as the primary unique key
        if (normSoHsbt) {
          matchedClaim = allClaims.find(c => {
            const existingKey = (c.soHoSoBoiThuong || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            return existingKey && existingKey === normSoHsbt;
          });
          if (matchedClaim) {
            matchType = 'so_hsbt';
          }
        }

        const fullRowMeta = {
          bienSo: rawBsx,
          soHoSoBoiThuong: rawSoHsbt,
          donViCapDon: getVal(r, colMap.chiNhanh) || getVal(r, colMap.chiNhanhXuly),
          hangXe: getVal(r, colMap.hangXe),
          hieuXe: getVal(r, colMap.hieuXe),
          namSanXuat: getVal(r, colMap.namSanXuat),
          gdvTiepNhan: getVal(r, colMap.gdvHo),
          canBoXuLy: getVal(r, colMap.gdvHo),
          ngayThongBao: (getVal(r, colMap.ngayThongBao) && formatDateDisplay(getVal(r, colMap.ngayThongBao)) !== '—') ? formatDateDisplay(getVal(r, colMap.ngayThongBao)) : (getVal(r, colMap.ngayThongBao) || ''),
          ngayVTT: rawDate,
          diaDiemVTT: getVal(r, colMap.diaDiemTonThat) || getVal(r, colMap.tinhTonThat),
          hienTruong: getVal(r, colMap.diaDiemTonThat),
          nguyenNhan: getVal(r, colMap.nhomNguyenNhan) || getVal(r, colMap.dienBienTonThat),
          moTaTonThat: getVal(r, colMap.dienBienTonThat) || getVal(r, colMap.doiTuongTonThat),
          loaiTonThat: getVal(r, colMap.doiTuongTonThat),
          garaSuaChua: getVal(r, colMap.gara) || getVal(r, colMap.tenGaraVietTat),

          chiNhanhXuly: getVal(r, colMap.chiNhanhXuly),
          chiNhanh: getVal(r, colMap.chiNhanh),
          ttkd: getVal(r, colMap.ttkd),
          phongBan: getVal(r, colMap.phongBan),
          soHd: getVal(r, colMap.soHd),
          nguoiCapDon: getVal(r, colMap.nguoiCapDon),
          giaTriXe: getVal(r, colMap.giaTriXe),
          soTienBh: getVal(r, colMap.soTienBh),
          soGcn: getVal(r, colMap.soGcn),
          ngayHieuLuc: formatCleanDateField(getVal(r, colMap.ngayHieuLuc)),
          ngayHetHan: formatCleanDateField(getVal(r, colMap.ngayHetHan)),
          kenhKhaiThac: getVal(r, colMap.kenhKhaiThac),
          chiTietKenh: getVal(r, colMap.chiTietKenh),
          maKhaiThac: getVal(r, colMap.maKhaiThac),
          hinhThucCapDon: getVal(r, colMap.hinhThucCapDon),
          ngayThanhToanPhi: formatCleanDateField(getVal(r, colMap.ngayThanhToanPhi)),
          phiBh: getVal(r, colMap.phiBh),
          khachHang: getVal(r, colMap.khachHang),
          loaiXe: getVal(r, colMap.loaiXe),
          loaiDongCo: getVal(r, colMap.loaiDongCo),
          mdsd: getVal(r, colMap.mdsd),
          soChoTrongTai: getVal(r, colMap.soChoTrongTai),
          maSpNghiepVu: getVal(r, colMap.maSpNghiepVu),
          vcx: getVal(r, colMap.vcx) || (String(getVal(r, colMap.maSpNghiepVu)).toUpperCase().includes('VCX') ? getVal(r, colMap.maSpNghiepVu) : ''),
          tnds: getVal(r, colMap.tnds) || (String(getVal(r, colMap.maSpNghiepVu)).toUpperCase().includes('TNDS') ? getVal(r, colMap.maSpNghiepVu) : ''),
          ngayMoHs: formatCleanDateField(getVal(r, colMap.ngayMoHs)),
          doiTuongTonThat: getVal(r, colMap.doiTuongTonThat),
          tinhTonThat: getVal(r, colMap.tinhTonThat),
          dienBienTonThat: getVal(r, colMap.dienBienTonThat),
          diaDiemTonThat: getVal(r, colMap.diaDiemTonThat),
          nhomNguyenNhan: getVal(r, colMap.nhomNguyenNhan),
          maGara: getVal(r, colMap.maGara),
          gdvHo: getVal(r, colMap.gdvHo),
          uocThietHai: getVal(r, colMap.uocThietHai),
          pascNgayDuyet: formatCleanDateField(getVal(r, colMap.pascNgayDuyet)),
          pascNguoiDuyet: getVal(r, colMap.pascNguoiDuyet),
          pascSoTienDuyet: getVal(r, colMap.pascSoTienDuyet),
          toTrinhNgayDuyet: formatCleanDateField(getVal(r, colMap.toTrinhNgayDuyet)),
          toTrinhNguoiDuyet: getVal(r, colMap.toTrinhNguoiDuyet),
          ttbtSoTienBoiThuong: getVal(r, colMap.ttbtSoTienBoiThuong),
          ttbtTongSoTienBoiThuong: getVal(r, colMap.ttbtTongSoTienBoiThuong) || getVal(r, colMap.tongBoiThuongSauThue) || getVal(r, colMap.amount) || getVal(r, colMap.ttbtSoTienBoiThuong) || getVal(r, colMap.pascSoTienDuyet),
          chiPhiGiamDinh: getVal(r, colMap.chiPhiGiamDinh),
          chiPhiCuuHo: getVal(r, colMap.chiPhiCuuHo),
          chiPhiKhac: getVal(r, colMap.chiPhiKhac),
          duPhongBoiThuong: getVal(r, colMap.duPhongBoiThuong),
          thuDoiDongBhTyLe: getVal(r, colMap.thuDoiDongBhTyLe),
          thuDoiDongBhSoTien: getVal(r, colMap.thuDoiDongBhSoTien),
          dongBhFollowTyLe: getVal(r, colMap.dongBhFollowTyLe),
          dongBhFollowSoTien: getVal(r, colMap.dongBhFollowSoTien),
          tongBoiThuongSauThue: getVal(r, colMap.tongBoiThuongSauThue),
          vat: getVal(r, colMap.vat),
          ngayNhanDuHoSo: formatCleanDateField(getVal(r, colMap.ngayNhanDuHoSo)),
          ngayDuyetDnttDauTien: formatCleanDateField(getVal(r, colMap.ngayDuyetDnttDauTien)),
          ngayDuyetDnttCuoiCung: formatCleanDateField(getVal(r, colMap.ngayDuyetDnttCuoiCung)),
          ngayKtXacNhan: formatCleanDateField(getVal(r, colMap.ngayKtXacNhan)),
          soTienDaThanhToan: getVal(r, colMap.soTienDaThanhToan),
          ngayThanhToan: formatCleanDateField(getVal(r, colMap.ngayThanhToan)),
          ghiChu: getVal(r, colMap.ghiChu),
          lyDoHuy: getVal(r, colMap.lyDoHuy),
          agentUniqCode: getVal(r, colMap.agentUniqCode),
          garageUniqCode: getVal(r, colMap.garageUniqCode),
          zoneBoiThuong: getVal(r, colMap.zoneBoiThuong),
          khuVucGiamDinh: getVal(r, colMap.khuVucGiamDinh),
          tenGaraVietTat: getVal(r, colMap.tenGaraVietTat)
        };

        parsedExcelBatchRows.push({
          rawBsx,
          rawDate,
          rawVtt,
          rawSoHsbt,
          rawStatusStr,
          targetStatus,
          rawGara,
          rawAmount,
          matchedClaim,
          matchType,
          fullRowMeta
        });
      }

      if (!parsedExcelBatchRows.length) {
        const box = document.getElementById('excelPreviewContainer');
        box.style.display = 'block';
        box.innerHTML = '<div class="cim-note is-error"><div><p>Không đọc được dòng dữ liệu nào từ tệp. Kiểm tra dòng tiêu đề có cột Số HSBT / Biển số.</p></div></div>';
        document.getElementById('btnSubmitImportExcel').disabled = true;
        return;
      }
      ClaimImportUI.renderPreview(parsedExcelBatchRows, excelImportFileName);
    }


    function updateBackgroundImportProgress(progressPercent, statusText, isFinished = false, isError = false, summaryText = '') {
      let widget = document.getElementById('excelBackgroundImportWidget');
      if (!widget) {
        widget = document.createElement('div');
        widget.id = 'excelBackgroundImportWidget';
        widget.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 100000; width: 350px; background: var(--surface-strong); border: 1px solid var(--border-strong); border-radius: 16px; box-shadow: 0 12px 36px rgba(0,0,0,0.45); padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-family: inherit; color: var(--text-main);';
        document.body.appendChild(widget);
      }

      if (!document.getElementById('excelBgWidgetStyle')) {
        const style = document.createElement('style');
        style.id = 'excelBgWidgetStyle';
        style.innerHTML = `
          @keyframes bgWidgetSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }

      const iconColor = isError ? '#ef4444' : (isFinished ? '#10b981' : '#3b82f6');
      const progressBg = isError ? '#ef4444' : (isFinished ? '#10b981' : 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)');
      const iconSvg = isError ? ACC_SVGS.WARNING : (isFinished ? ACC_SVGS.CHECK_CIRCLE : ACC_SVGS.FOLDER);

      widget.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59,130,246,0.08); color: ${iconColor}; display: grid; place-items: center; flex-shrink: 0;">
              ${iconSvg}
            </div>
            <div style="min-width: 0;">
              <div style="font-size: 13.5px; font-weight: 850; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${isError ? 'Lỗi nhập dữ liệu' : (isFinished ? 'Nhập Excel thành công' : 'Đang xử lý nhập Excel')}
              </div>
              <div style="font-size: 11.5px; color: var(--text-soft); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${statusText}
              </div>
            </div>
          </div>
          ${!isFinished && !isError ? `
            <div style="width: 16px; height: 16px; border: 2px solid var(--border-strong); border-top-color: #3b82f6; border-radius: 50%; animation: bgWidgetSpin 1s linear infinite;"></div>
          ` : `
            <button type="button" onclick="document.getElementById('excelBackgroundImportWidget').remove()" style="background: transparent; border: none; font-size: 14px; color: var(--text-soft); cursor: pointer; padding: 2px;">✕</button>
          `}
        </div>
        
        <div style="width: 100%; height: 6px; background: var(--bg-soft); border-radius: 3px; overflow: hidden; margin-top: 4px;">
          <div style="height: 100%; width: ${progressPercent}%; background: ${progressBg}; transition: width 0.25s ease-out; border-radius: 3px;"></div>
        </div>

        ${summaryText ? `
          <div style="font-size: 11.5px; font-weight: 750; color: ${isError ? '#ef4444' : '#10b981'}; background: ${isError ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)'}; border: 1px solid ${isError ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}; border-radius: 8px; padding: 8px 10px; margin-top: 2px; line-height: 1.4; word-break: break-word;">
            ${summaryText}
          </div>
        ` : ''}
      `;

      if (isFinished || isError) {
        setTimeout(() => {
          const w = document.getElementById('excelBackgroundImportWidget');
          if (w) {
            w.style.opacity = '0';
            w.style.transform = 'translateY(20px)';
            setTimeout(() => w.remove(), 350);
          }
        }, 5000);
      }
    }


    // Áp dụng file mới: lưu phiên bản (bản sao lưu + dữ liệu file) TRƯỚC, rồi mới ghi. Lưu phiên bản lỗi → không ghi gì.
    async function executeApplyExcelBatchUpdate() {
      if (!parsedExcelBatchRows || !parsedExcelBatchRows.length || !ClaimImportUI.hasPending()) return;
      const fileName = excelImportFileName;
      closeImportExcelModal();
      updateBackgroundImportProgress(0, 'Chuẩn bị cập nhật dữ liệu từ ' + fileName + '…');
      try {
        const result = await ClaimImportUI.applyPending((percent, text) => updateBackgroundImportProgress(percent, text));
        if (!result) return;
        const s = result.planned.summary, parts = [];
        if (s.added) parts.push('thêm ' + s.added);
        if (s.changed) parts.push('cập nhật ' + s.changed);
        if (s.removed) parts.push('gỡ ' + s.removed);
        updateBackgroundImportProgress(100, 'Hoàn thành cập nhật dữ liệu.', true, false, (parts.length ? 'Đã ' + parts.join(', ') + ' hồ sơ.' : 'Dữ liệu không thay đổi.') + ' Đã lưu phiên bản để khôi phục khi cần.');
        executeUIRenderPendingClaims();
      } catch (err) {
        console.error('Lỗi cập nhật dữ liệu từ Excel:', err);
        updateBackgroundImportProgress(100, 'Không cập nhật được dữ liệu.', false, true, err.message + ' – Dữ liệu hồ sơ chưa bị thay đổi nếu lỗi xảy ra ở bước sao lưu.');
      }
    }
