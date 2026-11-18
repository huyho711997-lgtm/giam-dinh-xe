/* Engine tính BÁO CÁO TUẦN ZONE — module thuần (không đụng DOM/Firebase), dùng được trên webapp lẫn app điện thoại Tasco DLK.
 * App điện thoại tải thẳng file này từ GitHub Pages của webapp → một nguồn logic duy nhất.
 * Các hàm bên dưới là BẢN SAO có kiểm soát của logic trong excel-import.js / filters-settings.js / weekly-annual.js
 * (đổi tham số toàn cục cachedReportRules thành `rules`). tests/weekly-engine.test.mjs so khớp kết quả với webapp trên dữ liệu ngẫu nhiên:
 * sửa logic báo cáo ở webapp mà quên sửa ở đây thì test sẽ đỏ. */
const WeeklyReportEngine = (() => {
  const STATUS_LABEL = {
    'moi': 'Mới',
    'cho_giam_dinh_ht': 'Chờ giám định HT',
    'da_giam_dinh_ht': 'Đã giám định HT',
    'cho_gdct': 'Chờ GĐCT',
    'da_gdct': 'Đã GĐCT',
    'cho_duyet_pasc': 'Chờ duyệt PASC',
    'da_duyet_pasc': 'Đã duyệt PASC',
    'cho_duyet_hsbt': 'Chờ duyệt HSBT',
    'da_duyet_hsbt': 'Đã duyệt HSBT',
    'cho_duyet_dntt': 'Chờ duyệt ĐNTT',
    'cho_kt_duyet': 'Chờ KT duyệt',
    'kt_duyet': 'KT duyệt',
    'da_thanh_toan': 'Đã Thanh toán',
    'tu_choi': 'Từ chối'
  };

  const DEFAULT_RULES = {
    phatSinhExcludes: 'tu_choi',
    tndsKeywords: 'tnds,trách nhiệm dân sự',
    unpaidStatuses: 'da_thanh_toan,da thanh toán,da_hoan_thanh,da hoàn thành,tu_choi',
    approvedStatuses: 'da_duyet_hsbt,cho_duyet_dntt,cho_kt_duyet,kt_duyet,da_thanh_toan',
    chuyenDnttStatuses: '',
    hsDpbtStatuses: 'moi,cho_giam_dinh_ht,da_giam_dinh_ht,cho_gdct,da_gdct,cho_duyet_pasc',
    onlyApprovedStatuses: 'da_duyet_hsbt,cho_kt_duyet',
    hsTonDays: 30,
    hsDpbtAmount: 50000000,
    avgAmount: 10000000,
    carplaKeywords: 'carpla',
    phatSinhDateField: 'ngayMoHs',
    daDuyetDateField: 'ngayMoHs',
    chuyenDnttDateField: 'ngayNhanDuHoSo',
    carplaDateField: 'toTrinhNgayDuyet',
    tndsTonDateField: 'none',
    hsTonDateField: 'ngayMoHs',
    hsDpbtDateField: 'none',
    avgAmountDateField: 'toTrinhNgayDuyet'
  };
  const mergeRules = fromDb => ({ ...DEFAULT_RULES, ...(fromDb && typeof fromDb === 'object' ? fromDb : {}) });
  const getRuleArray = str => String(str || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

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

  function getClaimDateMs(c, fieldName) {
        if (!c || !fieldName || fieldName === 'none') return -1;
        let dateStr = c[fieldName];

        if (fieldName === 'toTrinhNgayDuyet' && !dateStr) {
  dateStr = getClaimToTrinhDuyetDate(c);
        }
        if (fieldName === 'ngayMoHs' && !dateStr) {
  dateStr = c.ngayMoHs || c['Ngày mở hồ sơ'] || c['Ngày mở HS'] || c.ngayTonThat || c.date;
        }
        if (fieldName === 'ngayNhanDuHoSo' && !dateStr) {
  dateStr = c.ngayNhanDuHoSo || c['Ngày nhận đủ hồ sơ'] || c['Ngày nhận đủ HS'];
        }
        if (fieldName === 'ngayThanhToan' && !dateStr) {
  dateStr = c.ngayThanhToan || c['Ngày thanh toán'] || c['Ngày thanh toán bồi thường'] || c.ngayKtXacNhan;
        }
        if (fieldName === 'ngayVTT' && !dateStr) {
  dateStr = c.ngayTonThat || c.date || c.ngayVTT;
        }

        if (typeof dateStr === 'number' && dateStr > 0) return dateStr;
        if (dateStr instanceof Date) return dateStr.getTime();

        if (dateStr && typeof dateStr === 'string' && dateStr !== '—' && dateStr !== '-' && dateStr !== 'null' && dateStr !== 'undefined') {
  const dp = parseDateParts(dateStr);
  if (dp && dp.year > 1970 && dp.month && dp.day) {
    return new Date(dp.year, dp.month - 1, dp.day, 12, 0, 0).getTime();
  }
        }
        return 0;
      }

  function getClaimTimestamp(c) {
    const dateStr = c.ngayMoHs;
    if (dateStr && typeof dateStr === 'string' && dateStr !== '—') {
      const dp = parseDateParts(dateStr);
      if (dp && dp.year && dp.month && dp.day) {
        return new Date(dp.year, dp.month - 1, dp.day, 12, 0, 0).getTime();
      }
    }
    return 0;
  }

  function isPhatSinh(c, rules) {
    if (!c) return false;
    const st = String(c.trangThai || '').toLowerCase();
    const ex = getRuleArray(rules.phatSinhExcludes);
    if (ex.some(e => st.includes(e))) return false;
    return true;
  }

  function isChuyenDntt(c, rules) {
    if (!c) return false;
    const st = String(c.trangThai || '').toLowerCase();
    const inc = getRuleArray(rules.chuyenDnttStatuses);
    if (inc.length === 0) return true; // empty means all allowed
    return inc.some(e => st.includes(e));
  }

  function isTndsClaim(c, rules) {
    if (!c) return false;
    const text = String(c.loaiHoSo || c.nhomBoiThuong || c.tnds || c.maSpNghiepVu || c.loaiHinhBaoHiem || c.nghiepVu || c.tenHoSo || '').toLowerCase();
    const kws = getRuleArray(rules.tndsKeywords);
    return kws.some(kw => text.includes(kw));
  }

  function isUnpaidClaim(c, rules) {
    if (!c) return false;
    const st = String(c.trangThai || '').toLowerCase();
    const unpaidExcludes = getRuleArray(rules.unpaidStatuses);
    if (unpaidExcludes.some(ex => st.includes(ex))) {
      return false;
    }
    if (c.ngayThanhToan) return false;
    return true;
  }

  function isDuyetHsbtApproved(c, rules) {
    if (!c) return false;
    const approvedHsbtStatuses = getRuleArray(rules.approvedStatuses || 'da_duyet_hsbt,cho_duyet_dntt,cho_kt_duyet,kt_duyet,da_thanh_toan');
    if (approvedHsbtStatuses.length === 0) return false;
    const rawSt = String(c.trangThai || '').trim();
    const lowerSt = rawSt.toLowerCase();
    if (approvedHsbtStatuses.includes(lowerSt)) return true;
    for (const [k, label] of Object.entries(STATUS_LABEL)) {
      if (lowerSt === k || lowerSt === label.toLowerCase()) {
        if (approvedHsbtStatuses.includes(k) || approvedHsbtStatuses.includes(label.toLowerCase())) return true;
      }
    }
    return false;
  }

  function isOnlyDaDuyetHsbt(c, rules) {
    if (!c) return false;
    const st = String(c.trangThai || '').toLowerCase().trim();
    const arr = getRuleArray(rules.onlyApprovedStatuses);
    return arr.includes(st);
  }

  function isHsDuPhongOver50M(c, rules) {
    if (!c) return false;
    const reserveStr = String(c.duPhongBoiThuong || c.soTienDuPhong || c.duPhong || '0').replace(/[^0-9]/g, '');
    const reserveVal = parseInt(reserveStr, 10) || 0;
    if (reserveVal <= rules.hsDpbtAmount) return false;
  
    const st = String(c.trangThai || '').toLowerCase();
    const inc = getRuleArray(rules.hsDpbtStatuses);
    if (inc.length === 0) return true;
    return inc.some(e => st.includes(e));
  }

  const newItem = gdvName => ({ gdvName, phatSinh: 0, daDuyetHsb: 0, chuaDuyetPasc: 0, tonHoaDon: 0, chuyenDntt: 0, carplaCount: 0, tndsTonLuyKe: 0, hsTonOver30Days: 0, hsDuPhongOver50M: 0, sumAmtUnder10M: 0, countUnder10M: 0, carplaCumulativeRevenue: 0 });

  // claims: {id: claim}; users: {uid: user}; period: {startDate, endDate} (Date); rawRules: settings/reportRules; nowMs: thời điểm tính "tồn quá hạn".
  // Trả về {list} y hệt getWeeklyZoneReportData của webapp (đã sắp phát sinh giảm dần, chưa lọc GĐV).
  function compute({ claims, users, rules: rawRules, period, nowMs }) {
    const r = mergeRules(rawRules);
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const claimsList = Object.entries(claims || {}).map(([k, v]) => ({ ...v, _id: k }));
    const startTime = period.startDate.getTime(), endTime = period.endDate.getTime();
    const monthStartMs = new Date(period.endDate.getFullYear(), period.endDate.getMonth(), 1).getTime();
    const monthEndMs = new Date(period.endDate.getFullYear(), period.endDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const gdvMap = {};
    Object.values(users || {}).forEach(u => {
      const name = (u && (u.profile?.displayName || u.displayName || u.name) || '').trim();
      if (name && !gdvMap[name]) gdvMap[name] = newItem(name);
    });
    claimsList.forEach(c => {
      const gdvName = (c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || c.canBoBoiThuong || c.gdvName || c.createdByName || 'Chưa phân công').trim();
      if (!gdvMap[gdvName]) gdvMap[gdvName] = newItem(gdvName);
      const item = gdvMap[gdvName];
      const inRange = ms => (ms === -1) || (ms >= startTime && ms <= endTime);
      const phatSinhMs = getClaimDateMs(c, r.phatSinhDateField || 'ngayMoHs');
      const daDuyetMs = getClaimDateMs(c, r.daDuyetDateField || 'ngayMoHs');
      const chuyenDnttMs = getClaimDateMs(c, r.chuyenDnttDateField || 'ngayNhanDuHoSo');
      const carplaMs = getClaimDateMs(c, r.carplaDateField || 'toTrinhNgayDuyet');
      const tndsTonMs = getClaimDateMs(c, r.tndsTonDateField || 'none');
      const hsTonMs = getClaimDateMs(c, r.hsTonDateField || 'ngayMoHs');
      const hsDpbtMs = getClaimDateMs(c, r.hsDpbtDateField || 'none');
      const avgAmountMs = getClaimDateMs(c, r.avgAmountDateField || 'toTrinhNgayDuyet');
      const isCarplaMonthPeriod = (carplaMs === -1) || (carplaMs >= monthStartMs && carplaMs <= monthEndMs);
      const isApproved = isDuyetHsbtApproved(c, r);
      const amtVal = parseInt(String(c.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, ''), 10) || 0;
      const garaName = String(c.tenGaraVietTat || '').toLowerCase();

      if (inRange(tndsTonMs) && isTndsClaim(c, r) && isUnpaidClaim(c, r)) item.tndsTonLuyKe++;
      if (isOnlyDaDuyetHsbt(c, r) && hsTonMs > 0 && (now - hsTonMs > r.hsTonDays * 86400 * 1000)) item.hsTonOver30Days++;
      if (inRange(hsDpbtMs) && isHsDuPhongOver50M(c, r)) item.hsDuPhongOver50M++;
      if (inRange(chuyenDnttMs) && isChuyenDntt(c, r)) item.chuyenDntt++;
      if (inRange(carplaMs) && garaName.includes('carpla')) item.carplaCount++;
      if (isCarplaMonthPeriod && garaName.includes('carpla') && isApproved) {
        const excluded = r.carplaExcludedClaims && r.carplaExcludedClaims[c._id];
        if (!excluded) item.carplaCumulativeRevenue += amtVal;
      }
      if (inRange(phatSinhMs) && isPhatSinh(c, r)) item.phatSinh++;
      if (inRange(daDuyetMs) && isApproved) item.daDuyetHsb++;
      if (inRange(avgAmountMs) && isApproved && amtVal > 0 && amtVal < r.avgAmount) { item.sumAmtUnder10M += amtVal; item.countUnder10M++; }

      const claimTime = getClaimTimestamp(c);
      if (claimTime >= startTime && claimTime <= endTime) {
        const stKeyCheck = String(c.trangThai || '').toLowerCase().trim();
        const chuaDuyetPascKeys = ['moi', 'cho_giam_dinh_ht', 'da_giam_dinh_ht', 'cho_gdct', 'da_gdct', 'cho_duyet_pasc'];
        const isChuaDuyetPascStatus = chuaDuyetPascKeys.includes(stKeyCheck) ||
          stKeyCheck === 'mới' ||
          stKeyCheck.includes('chờ giám định ht') || stKeyCheck.includes('cho giam dinh ht') ||
          stKeyCheck.includes('đã giám định ht') || stKeyCheck.includes('da giam dinh ht') ||
          stKeyCheck.includes('chờ gđct') || stKeyCheck.includes('cho gdct') ||
          stKeyCheck.includes('đã gđct') || stKeyCheck.includes('da gdct') ||
          stKeyCheck.includes('chờ duyệt pasc') || stKeyCheck.includes('cho duyet pasc');
        if (isChuaDuyetPascStatus) item.chuaDuyetPasc++;
        const st = String(c.trangThai || '').toLowerCase();
        if (st.includes('hoa_don') || st.includes('hóa đơn') || st.includes('invoice')) item.tonHoaDon++;
      }
    });
    const list = Object.values(gdvMap).sort((a, b) => b.phatSinh - a.phatSinh);
    return { list, rules: r };
  }

  // ----- Kỳ báo cáo -----
  const pad = n => String(n).padStart(2, '0');
  const fmtDmy = d => pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  const toYmd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function makePeriod(startYmd, endYmd) {
    const p = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? [+m[1], +m[2] - 1, +m[3]] : null; };
    const a = p(startYmd), b = p(endYmd);
    if (!a || !b) return null;
    const startDate = new Date(a[0], a[1], a[2], 0, 0, 0, 0), endDate = new Date(b[0], b[1], b[2], 23, 59, 59, 999);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return null;
    const startStr = fmtDmy(startDate), endStr = fmtDmy(endDate);
    return { startDate, endDate, startStr, endStr, startYmd: toYmd(startDate), endYmd: toYmd(endDate), label: `Từ ngày ${startStr} đến ${endStr}` };
  }
  // Tuần báo cáo chạy từ Thứ Bảy đến Thứ Sáu (giống getGdvReportDefaultDates của webapp).
  function weekStart(now, weeksBack) {
    const start = new Date(now); const dow = now.getDay();
    start.setDate(now.getDate() - ((dow === 6) ? 0 : (dow + 1)) - 7 * (weeksBack || 0)); start.setHours(0, 0, 0, 0);
    return start;
  }
  function presets(now) {
    const n = now || new Date(), res = [];
    const week = back => { const s = weekStart(n, back), e = new Date(s); e.setDate(s.getDate() + 6); return makePeriod(toYmd(s), toYmd(e)); };
    const month = back => { const s = new Date(n.getFullYear(), n.getMonth() - back, 1), e = new Date(n.getFullYear(), n.getMonth() - back + 1, 0); return makePeriod(toYmd(s), toYmd(e)); };
    res.push({ id: 'week0', label: 'Tuần này', period: week(0) }, { id: 'week1', label: 'Tuần qua', period: week(1) },
      { id: 'month0', label: 'Tháng này', period: month(0) }, { id: 'month1', label: 'Tháng trước', period: month(1) });
    return res;
  }

  // Rút gọn danh sách → hàng + tổng gọn cho giao diện điện thoại. Bình quân chung = tổng tiền / tổng số hồ sơ.
  const num = v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
  const KEYS = ['ps', 'dd', 'cd', 'dntt', 'carpla', 'tnds', 'ton', 'dpbt', 'avg', 'rev'];
  function summarize(list) {
    let sumAmt = 0, cntAmt = 0;
    const rows = (list || []).map(item => {
      sumAmt += Number(item.sumAmtUnder10M) || 0; cntAmt += Number(item.countUnder10M) || 0;
      return { gdv: String(item.gdvName || 'Chưa phân công'), ps: num(item.phatSinh), dd: num(item.daDuyetHsb),
        cd: num(item.chuaDuyetPasc || Math.max(0, (item.phatSinh || 0) - (item.daDuyetHsb || 0))), dntt: num(item.chuyenDntt), carpla: num(item.carplaCount), tnds: num(item.tndsTonLuyKe), ton: num(item.hsTonOver30Days),
        dpbt: num(item.hsDuPhongOver50M), avg: item.countUnder10M > 0 ? num(item.sumAmtUnder10M / item.countUnder10M) : 0, rev: num(item.carplaCumulativeRevenue) };
    });
    const totals = Object.fromEntries(KEYS.map(k => [k, rows.reduce((s, x) => s + (k === 'avg' ? 0 : x[k]), 0)]));
    totals.avg = cntAmt > 0 ? num(sumAmt / cntAmt) : 0;
    return { rows, totals };
  }

  // ---- Báo cáo năm theo GĐV: hồ sơ phát sinh theo tháng, tách VCX / TNDS (giống getAnnualGdvClaimsData của webapp) ----
  function claimGdvName(c) {
    if (!c || typeof c !== 'object') return '';
    const candidates = [c.gdvTiepNhan, c.canBoXuLy, c.toTrinhNguoiDuyet, c['Tờ trình BT - Người duyệt'], c['Tờ trình BT – Người duyệt'], c.pascNguoiDuyet,
      c['PASC - Người duyệt'], c['PASC – Người duyệt'], c.gdvHo, c.canBoBoiThuong, c.gdvName, c.createdByName];
    for (const cand of candidates) {
      if (cand && typeof cand === 'string') {
        const clean = cand.trim();
        if (clean && clean !== '—' && clean !== '-' && clean !== 'Chưa phân công' && clean !== 'Hệ thống Excel') return clean;
      }
    }
    return (c.gdvTiepNhan || c.canBoXuLy || c.toTrinhNguoiDuyet || c.gdvHo || '').trim();
  }
  function allGdvNames(claims, users) {
    const set = new Set(['Hồ Quang Huy', 'Huỳnh Văn Phúc', 'Nguyễn Quang Huy_DL']);
    Object.values(users || {}).forEach(u => {
      const name = ((u && (u.profile?.displayName || u.displayName || u.name)) || '').trim();
      if (name) set.add(name);
    });
    Object.values(claims || {}).forEach(c => {
      const name = claimGdvName(c);
      if (name && name !== 'Chưa phân công' && name !== 'Hệ thống Excel') set.add(name);
    });
    return Array.from(set).sort();
  }
  function annual({ claims, users, rules: rawRules, year, gdvNames }) {
    const r = mergeRules(rawRules);
    const dateField = r.phatSinhDateField || 'ngayMoHs';
    const selected = new Set((gdvNames || []).map(n => String(n).trim().toLocaleLowerCase('vi')));
    const rowsByName = new Map();
    const mk = () => ({ months: Array(12).fill(0), total: 0, activeMonths: 0 });
    const ensureRow = name => {
      const nm = String(name || 'Chưa phân công').trim() || 'Chưa phân công';
      const key = nm.toLocaleLowerCase('vi');
      if (!rowsByName.has(key)) rowsByName.set(key, { name: nm, months: Array(12).fill(0), total: 0, types: { VCX: mk(), TNDS: mk() } });
      return rowsByName.get(key);
    };
    allGdvNames(claims, users).forEach(name => { if (!selected.size || selected.has(String(name).trim().toLocaleLowerCase('vi'))) ensureRow(name); });
    Object.values(claims || {}).forEach(claim => {
      if (!isPhatSinh(claim, r)) return;
      const ms = getClaimDateMs(claim, dateField);
      if (!(ms > 0)) return;
      const date = new Date(ms);
      if (date.getFullYear() !== year) return;
      const gdvName = (claim.gdvTiepNhan || claim.canBoXuLy || claim.gdvHo || claim.canBoBoiThuong || claim.gdvName || claim.createdByName || 'Chưa phân công').trim();
      if (selected.size && !selected.has(gdvName.toLocaleLowerCase('vi'))) return;
      const row = ensureRow(gdvName), mi = date.getMonth(), tk = isTndsClaim(claim, r) ? 'TNDS' : 'VCX';
      row.months[mi]++; row.total++; row.types[tk].months[mi]++; row.types[tk].total++;
    });
    const rows = Array.from(rowsByName.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'vi'));
    const totals = Array(12).fill(0);
    rows.forEach(row => row.months.forEach((n, i) => { totals[i] += n; }));
    rows.forEach(row => ['VCX', 'TNDS'].forEach(t => {
      row.types[t].activeMonths = row.types[t].months.filter(n => n > 0).length;
      row.types[t].average = row.types[t].activeMonths ? row.types[t].total / row.types[t].activeMonths : 0;
    }));
    const typeTotals = { VCX: { total: 0, activeMonths: 0 }, TNDS: { total: 0, activeMonths: 0 } };
    rows.forEach(row => ['VCX', 'TNDS'].forEach(t => { typeTotals[t].total += row.types[t].total; typeTotals[t].activeMonths += row.types[t].activeMonths; }));
    ['VCX', 'TNDS'].forEach(t => { typeTotals[t].average = typeTotals[t].activeMonths ? typeTotals[t].total / typeTotals[t].activeMonths : 0; });
    return { year, rows, totals, total: totals.reduce((a, b) => a + b, 0), typeTotals };
  }

  return { compute, summarize, makePeriod, presets, mergeRules, annual, allGdvNames, DEFAULT_RULES, STATUS_LABEL };
})();
