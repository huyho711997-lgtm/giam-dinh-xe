


    /* ÂM THANH THÔNG BÁO MỚI
       - Phát chuông 2 nốt (Web Audio, không cần file âm thanh) khi xuất hiện thông báo CHƯA ĐỌC mới.
       - Không phát khi mới tải trang/đăng nhập (lần dữ liệu đầu coi như đã biết), khi mở/đóng hộp, đọc hay xóa thông báo.
       - Trình duyệt chỉ cho phát âm thanh sau khi người dùng đã bấm/gõ phím trên trang ít nhất một lần.
       - Bật/tắt bằng nút loa trong hộp thông báo (lưu theo trình duyệt). */
    const notificationSound = {
      ctx: null,
      loaded: { transfers: false, cases: false },
      baselineUid: null,
      seen: new Set()
    };

    function isNotificationSoundEnabled() {
      try { return localStorage.getItem('notif_sound_off') !== '1'; } catch (e) { return true; }
    }

    function getNotificationAudioContext() {
      if (notificationSound.ctx) return notificationSound.ctx;
      const AudioCtor = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AudioCtor) return null;
      try { notificationSound.ctx = new AudioCtor(); } catch (e) { notificationSound.ctx = null; }
      return notificationSound.ctx;
    }

    // Mở khóa âm thanh ở lần tương tác đầu tiên (chính sách autoplay của trình duyệt).
    (function bindNotificationAudioUnlock() {
      if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
      const unlock = () => {
        const ctx = getNotificationAudioContext();
        if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
        ['pointerdown', 'keydown', 'touchstart'].forEach(name => document.removeEventListener(name, unlock, true));
      };
      ['pointerdown', 'keydown', 'touchstart'].forEach(name => document.addEventListener(name, unlock, true));
    })();

    function playNotificationChime() {
      if (!isNotificationSoundEnabled()) return false;
      const ctx = getNotificationAudioContext();
      if (!ctx) return false;
      try {
        if (ctx.state === 'suspended') ctx.resume();
        const start = ctx.currentTime;
        [[880, 0], [1318.5, 0.16]].forEach(([frequency, offset]) => {
          const osc = ctx.createOscillator(), gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, start + offset);
          gain.gain.exponentialRampToValueAtTime(0.2, start + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.4);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(start + offset); osc.stop(start + offset + 0.42);
        });
        return true;
      } catch (e) { return false; }
    }

    // Dữ liệu từng nguồn (phiếu bàn giao, ca giám định) đã về lần đầu → từ đó mới được coi là "mới".
    function markNotificationSourceLoaded(source) {
      if (source in notificationSound.loaded) notificationSound.loaded[source] = true;
    }

    // Gọi sau mỗi lần dựng danh sách: chuông nếu có thông báo chưa đọc mà phiên này chưa từng thấy.
    function ringForNewNotifications(notifications, uid) {
      const ready = notificationSound.loaded.transfers && notificationSound.loaded.cases;
      if (!ready) return;
      if (notificationSound.baselineUid !== uid) {   // lần đầu / đổi tài khoản → ghi nhận hiện trạng, không chuông
        notificationSound.baselineUid = uid;
        notificationSound.seen = new Set(notifications.map(n => n.id));
        return;
      }
      const fresh = notifications.filter(n => !n.isRead && !notificationSound.seen.has(n.id));
      notifications.forEach(n => notificationSound.seen.add(n.id));
      if (fresh.length) playNotificationChime();
    }

    function toggleNotificationSound(evt) {
      if (evt) evt.stopPropagation();
      const turnOff = isNotificationSoundEnabled();
      try { localStorage.setItem('notif_sound_off', turnOff ? '1' : '0'); } catch (e) {}
      syncNotificationSoundButton();
      if (!turnOff) playNotificationChime();   // bật lại → phát thử cho người dùng nghe
    }

    function syncNotificationSoundButton() {
      const button = document.getElementById('btnNotifSoundToggle');
      if (!button) return;
      const on = isNotificationSoundEnabled();
      button.title = on ? 'Âm thanh thông báo: đang bật (bấm để tắt)' : 'Âm thanh thông báo: đang tắt (bấm để bật)';
      button.setAttribute('aria-pressed', String(on));
      button.style.opacity = on ? '1' : '0.5';
      button.innerHTML = on
        ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>'
        : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
    }

    /* TRẠNG THÁI ĐÃ ĐỌC / ĐÃ XÓA — ĐỒNG BỘ THEO TÀI KHOẢN
       Trước đây chỉ lưu trong localStorage nên đăng nhập máy khác là mọi thông báo hiện lại như chưa đọc.
       Nay lưu thêm trên Firebase tại notification_state/{uid}/{read|dismissed}/{mã đã mã hóa} = true.
       - localStorage vẫn giữ làm bộ nhớ đệm (hiển thị tức thì, dùng được khi Firebase từ chối/mất mạng).
       - Hợp nhất kiểu "hợp của hai tập" vì đã đọc/đã xóa chỉ đi một chiều.
       - Lần đồng bộ đầu tiên của một máy sẽ đẩy phần chỉ có ở máy đó lên Firebase (không mất lịch sử đã đọc cũ).
       - Trong lúc chờ dữ liệu từ Firebase lần đầu (tối đa vài giây) không hiện huy hiệu "chưa đọc" để tránh nháy 100%. */
    const NOTIF_STATE_TIMEOUT_MS = 4000;
    const notificationStateSync = {
      uid: null, ref: null, handler: null, timer: null,
      ready: true,                      // true = không còn chờ Firebase (hoặc không dùng Firebase)
      remote: { read: new Set(), dismissed: new Set() }
    };

    // Khóa Firebase không được chứa . $ # [ ] / → mã hóa dạng %xx (và giải mã ngược lại)
    function encodeNotificationKey(id) {
      return String(id).replace(/[.$#\[\]\/%]/g, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));
    }

    function decodeNotificationKey(key) {
      return String(key).replace(/%([0-9a-f]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    function currentNotificationUid() {
      try { return activeUserProfile?.uid || firebase.auth().currentUser?.uid || 'default'; } catch (e) { return 'default'; }
    }

    function readLocalNotificationSet(kind, uid) {
      try {
        const raw = localStorage.getItem(kind + '_notifs_' + uid);
        return new Set(raw ? JSON.parse(raw) : []);
      } catch (e) {
        return new Set();
      }
    }

    function writeLocalNotificationSet(kind, uid, setObj) {
      try { localStorage.setItem(kind + '_notifs_' + uid, JSON.stringify(Array.from(setObj))); } catch (e) {}
    }

    function notificationStateDb() {
      try { return (typeof dbNodeInstance !== 'undefined' && dbNodeInstance) ? dbNodeInstance : null; } catch (e) { return null; }
    }

    // Đẩy các mã chưa có trên Firebase lên (read/dismissed). Lỗi quyền/mạng chỉ ghi log, app vẫn chạy bằng localStorage.
    function pushNotificationStateToRemote(kind, ids) {
      const uid = notificationStateSync.uid;
      const db = notificationStateDb();
      if (!db || !uid || uid === 'default') return;
      const updates = {};
      ids.forEach(id => { if (!notificationStateSync.remote[kind].has(id)) updates[kind + '/' + encodeNotificationKey(id)] = true; });
      if (!Object.keys(updates).length) return;
      ids.forEach(id => notificationStateSync.remote[kind].add(id));   // ghi nhận tạm để không đẩy lặp
      try {
        const result = db.ref('notification_state/' + uid).update(updates);
        if (result && typeof result.catch === 'function') result.catch(error => console.info('Không đồng bộ được trạng thái thông báo:', error && error.message));
      } catch (error) { console.info('Không đồng bộ được trạng thái thông báo:', error && error.message); }
    }

    function finishNotificationStateWait() {
      if (notificationStateSync.timer) { clearTimeout(notificationStateSync.timer); notificationStateSync.timer = null; }
      if (notificationStateSync.ready) return false;
      notificationStateSync.ready = true;
      return true;
    }

    // Gắn listener Firebase cho tài khoản hiện tại (một lần mỗi tài khoản).
    function ensureNotificationStateSync() {
      const uid = currentNotificationUid();
      if (notificationStateSync.uid === uid) return;
      const db = notificationStateDb();

      if (notificationStateSync.ref && notificationStateSync.handler) {
        try { notificationStateSync.ref.off('value', notificationStateSync.handler); } catch (e) {}
      }
      finishNotificationStateWait();
      Object.assign(notificationStateSync, { uid, ref: null, handler: null, remote: { read: new Set(), dismissed: new Set() }, ready: true });
      if (!db || uid === 'default') return;

      notificationStateSync.ready = false;
      const ref = db.ref('notification_state/' + uid);
      let firstSnapshot = true;
      const handler = snapshot => {
        if (notificationStateSync.uid !== uid) return;
        const value = (snapshot && typeof snapshot.val === 'function' ? snapshot.val() : null) || {};
        const toSet = obj => new Set(Object.keys(obj || {}).filter(k => obj[k]).map(decodeNotificationKey));
        notificationStateSync.remote = { read: toSet(value.read), dismissed: toSet(value.dismissed) };
        const justReady = finishNotificationStateWait();
        if (firstSnapshot) {
          firstSnapshot = false;
          // Máy này đã có lịch sử đọc/xóa cục bộ → đưa lên Firebase để các máy khác thấy.
          ['read', 'dismissed'].forEach(kind => {
            const key = kind === 'read' ? 'read' : 'dismissed';
            const local = readLocalNotificationSet(key, uid);
            pushNotificationStateToRemote(kind, Array.from(local));
          });
        }
        if (typeof renderNotificationCenterItems === 'function') renderNotificationCenterItems();
        return justReady;
      };
      notificationStateSync.ref = ref;
      notificationStateSync.handler = handler;
      try {
        ref.on('value', handler, error => {
          console.info('Đọc trạng thái thông báo từ Firebase thất bại, dùng bộ nhớ trình duyệt:', error && error.message);
          if (finishNotificationStateWait() && typeof renderNotificationCenterItems === 'function') renderNotificationCenterItems();
        });
      } catch (error) {
        finishNotificationStateWait();
        return;
      }
      if (typeof setTimeout === 'function') {
        notificationStateSync.timer = setTimeout(() => {
          notificationStateSync.timer = null;
          if (!notificationStateSync.ready) {
            notificationStateSync.ready = true;
            if (typeof renderNotificationCenterItems === 'function') renderNotificationCenterItems();
          }
        }, NOTIF_STATE_TIMEOUT_MS);
      }
    }

    /* REALTIME PERSISTENT READ NOTIFICATION CONTROLLER */
    function getReadNotificationIdsSet() {
      const uid = currentNotificationUid();
      const merged = readLocalNotificationSet('read', uid);
      if (notificationStateSync.uid === uid) notificationStateSync.remote.read.forEach(id => merged.add(id));
      return merged;
    }


    function saveReadNotificationIdsSet(setObj) {
      writeLocalNotificationSet('read', currentNotificationUid(), setObj);
      pushNotificationStateToRemote('read', Array.from(setObj));
    }


    function getDismissedNotificationIdsSet() {
      const uid = currentNotificationUid();
      const merged = readLocalNotificationSet('dismissed', uid);
      if (notificationStateSync.uid === uid) notificationStateSync.remote.dismissed.forEach(id => merged.add(id));
      return merged;
    }


    function saveDismissedNotificationIdsSet(setObj) {
      writeLocalNotificationSet('dismissed', currentNotificationUid(), setObj);
      pushNotificationStateToRemote('dismissed', Array.from(setObj));
    }


    function dismissNotification(evt, notifId) {
      if (evt) evt.stopPropagation();
      const dismissedSet = getDismissedNotificationIdsSet();
      if (notifId) dismissedSet.add(String(notifId));
      saveDismissedNotificationIdsSet(dismissedSet);
      renderNotificationCenterItems();
    }


    function markNotificationAsRead(evt, notifId, transferId, isCase = false) {
      if (evt) evt.stopPropagation();
      const readSet = getReadNotificationIdsSet();
      if (notifId) readSet.add(String(notifId));
      saveReadNotificationIdsSet(readSet);

      renderNotificationCenterItems();

      // If user clicked the notification card itself (transferId provided), navigate to modal & close menu
      if (transferId) {
        const menu = document.getElementById('notificationCenterDropdownMenu');
        if (menu) menu.style.display = 'none';
        
        if (isCase) {
           window.history.pushState({}, '', `${getCleanOriginBaseUrl()}?idCa=${encodeURIComponent(transferId)}`);
           evaluateViewRoutingState(firebase.auth().currentUser);
           return;
        }

        const isKeToan = getLoggedInUserAccountingRole() === 'ketoan';
        if (isKeToan) {
          openKeToanReviewModal(transferId);
        } else {
          openAddAccountingTransferModal(transferId);
        }
      }
    }


    function markAllNotificationsAsRead() {
      const readSet = getReadNotificationIdsSet();
      const transfers = Object.values(cachedAccountingTransfersPayload || {});
      transfers.forEach(t => {
        // Chỉ đánh dấu đúng trạng thái hiện tại; KHÔNG ghi mã phiếu trần, nếu không mọi thay đổi trạng thái sau này
        // của phiếu đều bị coi là "đã đọc" và người dùng không bao giờ thấy thông báo mới.
        if (t.transferId && t.trangThai) readSet.add(String(t.transferId + '_' + t.trangThai));
      });
      saveReadNotificationIdsSet(readSet);
      triggerToast('Đã đánh dấu đọc tất cả thông báo.', 'success');
      renderNotificationCenterItems();
    }


    function dismissAllNotifications() {
      const dismissedSet = getDismissedNotificationIdsSet();
      const transfers = Object.values(cachedAccountingTransfersPayload || {});
      transfers.forEach(t => {
        if (t.transferId && t.trangThai) dismissedSet.add(String(t.transferId + '_' + t.trangThai));
      });
      saveDismissedNotificationIdsSet(dismissedSet);
      triggerToast('Đã xóa tất cả thông báo.', 'success');
      renderNotificationCenterItems();
    }


    function toggleNotificationCenterDropdown(evt) {
      if (evt) evt.stopPropagation();
      const menu = document.getElementById('notificationCenterDropdownMenu');
      if (!menu) return;
      
      const isVisible = menu.style.display === 'block';
      menu.style.display = isVisible ? 'none' : 'block';
      renderNotificationCenterItems();
    }


    function renderNotificationCenterItems() {
      const holder = document.getElementById('notificationItemsHolder');
      const badge = document.getElementById('navNotificationBadge');
      const unreadLbl = document.getElementById('lblNotifUnreadCount');
      if (!holder) return;

      ensureNotificationStateSync();
      const awaitingRemote = !notificationStateSync.ready;   // đang chờ trạng thái đọc từ Firebase

      const isKeToanOrAdmin = getLoggedInUserAccountingRole() === 'ketoan' || (activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin');
      const currentLoggedInGdvName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || activeUserProfile?.name || firebase.auth().currentUser?.displayName || '').trim().toLowerCase();

      let transfers = Object.values(cachedAccountingTransfersPayload || {});

      const readSet = getReadNotificationIdsSet();
      const dismissedSet = getDismissedNotificationIdsSet();

      // Dữ liệu cũ lưu mã phiếu trần (vd. "PBG1") làm mọi trạng thái sau này bị coi là đã đọc/đã xóa.
      // Chuyển thành khóa theo trạng thái hiện tại (giữ nguyên những gì người dùng đã đọc/xóa), rồi bỏ mã trần.
      let legacyMigrated = false;
      transfers.forEach(t => {
        if (!t.transferId) return;
        const bareId = String(t.transferId), stateId = bareId + '_' + (t.trangThai || 'unknown');
        if (readSet.has(bareId)) { readSet.add(stateId); readSet.delete(bareId); legacyMigrated = true; }
        if (dismissedSet.has(bareId)) { dismissedSet.add(stateId); dismissedSet.delete(bareId); legacyMigrated = true; }
      });
      if (legacyMigrated) { saveReadNotificationIdsSet(readSet); saveDismissedNotificationIdsSet(dismissedSet); }

      // GĐV thường chỉ thấy phiếu của mình. Không xác định được người (thiếu tên GĐV trên phiếu hoặc hồ sơ người dùng)
      // thì ẩn, tránh lộ phiếu của người khác.
      if (!isKeToanOrAdmin) {
        transfers = transfers.filter(t => {
          const tGdv = String(t.gdvName || '').trim().toLowerCase();
          if (!tGdv || !currentLoggedInGdvName) return false;
          return tGdv.includes(currentLoggedInGdvName) || currentLoggedInGdvName.includes(tGdv);
        });
      }
      const notifications = [];

      transfers.forEach(t => {
        const batchId = t.transferId || 'PBG_N/A';
        const notifId = batchId + '_' + (t.trangThai || 'unknown');
        const dateStr = t.ngayBanGiao ? formatDateDisplay(t.ngayBanGiao) : '';
        let notifTimestamp = 0;
        if (t.ngayBanGiao) {
           const dp = parseDateParts(t.ngayBanGiao);
           if (dp) notifTimestamp = new Date(dp.year, dp.month - 1, dp.day, dp.hours || 0, dp.minutes || 0, dp.seconds || 0).getTime();
        }

        const isRead = readSet.has(String(notifId));
        const isDismissed = dismissedSet.has(String(notifId));

        if (isDismissed) return; // Skip dismissed

        const claimsList = t.danhSachHoSo || [];
        const suppList = t.hoSoYeuCauBoSung || [];
        const suppClaimsCount = claimsList.filter((c, cIdx) => c.trangThaiBoSung === 'yeu_cau_bo_sung' || suppList.some(s => Number(s.chiSo) === cIdx || (s.soHoSoBoiThuong && s.soHoSoBoiThuong === c.soHoSoBoiThuong) || (s.bienSo && s.bienSo === c.bienSo))).length || (t.trangThai === 'can_bo_sung' ? (suppList.length || 1) : 0);

        if (t.trangThai === 'can_bo_sung' || suppClaimsCount > 0) {
          notifications.push({
            id: notifId,
            type: 'warning',
            title: 'Yêu cầu bổ sung Phiếu ' + batchId,
            desc: (t.ghiChuKeToan ? ('Kế toán phản hồi: ' + t.ghiChuKeToan) : `Kế toán yêu cầu bổ sung chứng từ cho ${suppClaimsCount} hồ sơ trong phiếu này.`),
            date: dateStr,
            timestamp: notifTimestamp,
            transferId: batchId,
            isRead
          });
        } else if (t.trangThai === 'da_xac_nhan' || t.trangThai === 'da_nhan_du_ho_so') {
          notifications.push({
            id: notifId,
            type: 'success',
            title: 'Đã xác nhận Phiếu ' + batchId,
            desc: 'Kế toán đã xác nhận nhận hồ sơ cho phiếu bàn giao ' + batchId + '.',
            date: dateStr,
            timestamp: notifTimestamp,
            transferId: batchId,
            isRead
          });
        } else if (t.trangThai === 'cho_xac_nhan' || t.trangThai === 'da_nhan_ho_so') {
          notifications.push({
            id: notifId,
            type: 'info',
            title: 'Phiếu mới trình Kế toán ' + batchId,
            desc: 'GĐV ' + (t.gdvName || '') + ' đã tạo phiếu bàn giao ' + (claimsList.length || 1) + ' hồ sơ.',
            date: dateStr,
            timestamp: notifTimestamp,
            transferId: batchId,
            isRead
          });
        } else if (t.trangThai === 'da_trinh_dntt') {
          notifications.push({
            id: notifId,
            type: 'success',
            title: 'Đã trình ĐNTT Phiếu ' + batchId,
            desc: 'Phiếu bàn giao ' + batchId + ' đã được Kế toán duyệt trình đề nghị thanh toán.',
            date: dateStr,
            timestamp: notifTimestamp,
            transferId: batchId,
            isRead
          });
        }
      });
      
      // Also inject completed cases notifications for the creator
      if (cachedCasesPayload) {
        Object.entries(cachedCasesPayload).forEach(([caseId, caseObj]) => {
          if (caseObj.trangThai === STATUS_COMPLETED) {
            const creatorEmail = String(caseObj.nguoiTao?.email || '').trim().toLowerCase();
            const creatorUid = String(caseObj.nguoiTao?.uid || '').trim().toLowerCase();
            const myUid = String(activeUserProfile?.uid || firebase.auth().currentUser?.uid || '').trim().toLowerCase();
            const myEmail = String(activeUserProfile?.email || firebase.auth().currentUser?.email || '').trim().toLowerCase();
            
            if ((creatorEmail && creatorEmail === myEmail) || (creatorUid && creatorUid === myUid)) {
              const notifId = 'case_completed_' + caseId;
              const isRead = readSet.has(String(notifId)) || readSet.has(String(caseId));
              const isDismissed = dismissedSet.has(String(notifId)) || dismissedSet.has(String(caseId));
              
              if (!isDismissed) {
                const dateStr = caseObj.garageSubmittedAt ? formatDateDisplay(caseObj.garageSubmittedAt) : '';
                let notifTimestamp = 0;
                if (caseObj.garageSubmittedAt) {
                  const dp = parseDateParts(caseObj.garageSubmittedAt);
                  if (dp) notifTimestamp = new Date(dp.year, dp.month - 1, dp.day, dp.hours || 0, dp.minutes || 0, dp.seconds || 0).getTime();
                  else notifTimestamp = Number(caseObj.garageSubmittedAt) || 0;
                }
                notifications.push({
                  id: notifId,
                  type: 'success',
                  title: 'Gara hoàn tất hồ sơ: ' + (caseObj.bienSo || 'N/A'),
                  desc: 'Gara ' + (caseObj.tenGara || 'N/A') + ' đã tải lên đủ hình ảnh giám định và yêu cầu kiểm tra.',
                  date: dateStr,
                  timestamp: notifTimestamp,
                  transferId: caseId,
                  isRead,
                  isCase: true
                });
              }
            }
          }
        });
      }

      notifications.sort((a, b) => b.timestamp - a.timestamp);

      // Chưa có trạng thái đọc từ Firebase → coi như đã đọc tạm thời, tránh nháy huy hiệu 100% chưa đọc ở máy mới.
      if (awaitingRemote) notifications.forEach(n => { n.isRead = true; });

      const unreadCount = notifications.filter(n => !n.isRead).length;

      syncNotificationSoundButton();
      ringForNewNotifications(notifications, String(activeUserProfile?.uid || firebase.auth().currentUser?.uid || 'default'));

      if (badge) {
        if (unreadCount > 0) {
          badge.style.display = 'grid';
          badge.textContent = unreadCount;
        } else {
          badge.style.display = 'none';
        }
      }

      if (unreadLbl) {
        if (unreadCount > 0) {
          unreadLbl.style.display = 'inline-block';
          unreadLbl.textContent = unreadCount + ' chưa đọc';
        } else {
          unreadLbl.style.display = 'none';
        }
      }

      if (notifications.length === 0) {
        holder.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-soft); font-size: 13px;">Hiện chưa có thông báo nào.</div>`;
        return;
      }

      holder.innerHTML = notifications.map(item => {
        const isWarning = item.type === 'warning';
        const isSuccess = item.type === 'success';
        const isUnread = !item.isRead;
        
        let bgColor = isUnread ? (isWarning ? 'rgba(239,68,68,0.09)' : (isSuccess ? 'rgba(16,185,129,0.09)' : 'rgba(59,130,246,0.09)')) : 'var(--bg-soft)';
        let borderColor = isUnread ? (isWarning ? 'rgba(239,68,68,0.35)' : (isSuccess ? 'rgba(16,185,129,0.35)' : 'rgba(59,130,246,0.35)')) : 'var(--border)';
        let textColor = isWarning ? '#ef4444' : (isSuccess ? '#10b981' : '#3b82f6');

        return `
          <div onclick="markNotificationAsRead(event, '${item.id}', '${item.transferId}', ${item.isCase ? 'true' : 'false'})" style="padding: 12px 14px; border-radius: 14px; background: ${bgColor}; border: 1px solid ${borderColor}; cursor: pointer; transition: all 0.15s ease; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                ${isUnread ? `<span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>` : ''}
                <strong style="font-size: 13px; color: ${textColor}; font-weight: 850;">${escapeHtmlOutput(item.title)}</strong>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                <span style="font-size: 10.5px; color: var(--text-soft);  font-weight: 750;">${escapeHtmlOutput(item.date)}</span>
                <button type="button" onclick="dismissNotification(event, '${item.id}')" style="background: transparent; border: none; color: var(--text-soft); padding: 4px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: 2px; transition: all 0.2s;" onmouseover="this.style.background='var(--border-strong)'; this.style.color='var(--text-main)';" onmouseout="this.style.background='transparent'; this.style.color='var(--text-soft)';" title="Xóa thông báo">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>

            <div style="font-size: 12px; color: var(--text-main); line-height: 1.45; margin-bottom: 8px;">${escapeHtmlOutput(item.desc)}</div>

            <div style="display: flex; justify-content: flex-end;">
              ${isUnread ? `
                <button type="button" onclick="markNotificationAsRead(event, '${item.id}')" style="background: var(--surface); border: 1px solid ${borderColor}; color: ${textColor}; font-size: 11px; font-weight: 850; padding: 4px 10px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: var(--shadow-sm);" title="Đánh dấu đã đọc thông báo này">
                  ✓ Đã đọc
                </button>
              ` : `
                <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 750;">✓ Đã đọc</span>
              `}
            </div>
          </div>
        `;
      }).join('');
    }
