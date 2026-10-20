

    /* REALTIME PERSISTENT READ NOTIFICATION CONTROLLER */
    function getReadNotificationIdsSet() {
      try {
        const uid = activeUserProfile?.uid || firebase.auth().currentUser?.uid || 'default';
        const raw = localStorage.getItem('read_notifs_' + uid);
        return new Set(raw ? JSON.parse(raw) : []);
      } catch (e) {
        return new Set();
      }
    }


    function saveReadNotificationIdsSet(setObj) {
      try {
        const uid = activeUserProfile?.uid || firebase.auth().currentUser?.uid || 'default';
        localStorage.setItem('read_notifs_' + uid, JSON.stringify(Array.from(setObj)));
      } catch (e) {}
    }


    function getDismissedNotificationIdsSet() {
      try {
        const uid = activeUserProfile?.uid || firebase.auth().currentUser?.uid || 'default';
        const raw = localStorage.getItem('dismissed_notifs_' + uid);
        return new Set(raw ? JSON.parse(raw) : []);
      } catch (e) {
        return new Set();
      }
    }


    function saveDismissedNotificationIdsSet(setObj) {
      try {
        const uid = activeUserProfile?.uid || firebase.auth().currentUser?.uid || 'default';
        localStorage.setItem('dismissed_notifs_' + uid, JSON.stringify(Array.from(setObj)));
      } catch (e) {}
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
        if (t.transferId && t.trangThai) readSet.add(String(t.transferId + '_' + t.trangThai));
        if (t.transferId) readSet.add(String(t.transferId)); // backward compat
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
        if (t.transferId) dismissedSet.add(String(t.transferId)); // backward compat
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

      const isKeToanOrAdmin = getLoggedInUserAccountingRole() === 'ketoan' || (activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin');
      const currentLoggedInGdvName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || activeUserProfile?.name || firebase.auth().currentUser?.displayName || '').trim().toLowerCase();

      let transfers = Object.values(cachedAccountingTransfersPayload || {});

      // For regular GĐV, only include notifications for their own transfer batches
      if (!isKeToanOrAdmin && currentLoggedInGdvName) {
        transfers = transfers.filter(t => {
          const tGdv = String(t.gdvName || '').trim().toLowerCase();
          return tGdv.includes(currentLoggedInGdvName) || currentLoggedInGdvName.includes(tGdv);
        });
      }

      const readSet = getReadNotificationIdsSet();
      const dismissedSet = getDismissedNotificationIdsSet();
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

        const isRead = readSet.has(String(notifId)) || readSet.has(String(batchId));
        const isDismissed = dismissedSet.has(String(notifId)) || dismissedSet.has(String(batchId));

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

      const unreadCount = notifications.filter(n => !n.isRead).length;

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
