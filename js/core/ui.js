

    function triggerToast(message, type = 'success') {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.setAttribute('role', 'status');
      toast.textContent = String(message || 'Đã hoàn tất thao tác.');
      container.appendChild(toast);
      window.setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        window.setTimeout(() => toast.remove(), 260);
      }, 3800);
    }


    function showConfirmModal(title, message, confirmText = 'Xác nhận', cancelText = 'Hủy') {
      return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        const titleNode = document.getElementById('modalTitle');
        const messageNode = document.getElementById('modalMsg');
        const cancelButton = document.getElementById('modalCancel');
        const confirmButton = document.getElementById('modalConfirm');
        if (!overlay || !cancelButton || !confirmButton) {
          resolve(window.confirm(message));
          return;
        }
        titleNode.textContent = title || 'Xác nhận thao tác';
        messageNode.textContent = message || 'Bạn có chắc chắn muốn tiếp tục?';
        
        const originalConfirmText = confirmButton.textContent;
        const originalCancelText = cancelButton.textContent;
        const originalConfirmBg = confirmButton.style.background;
        const originalConfirmColor = confirmButton.style.color;
        const originalConfirmBorder = confirmButton.style.border;

        confirmButton.textContent = confirmText;
        cancelButton.textContent = cancelText;

        if (String(confirmText).toLowerCase().includes('xóa') || String(title).toLowerCase().includes('xóa')) {
          confirmButton.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
          confirmButton.style.color = '#ffffff';
          confirmButton.style.border = 'none';
        }

        overlay.style.zIndex = '999999';
        overlay.style.display = 'grid';
        document.body.style.overflow = 'hidden';
        const finish = (result) => {
          overlay.style.display = 'none';
          overlay.style.zIndex = '';
          document.body.style.overflow = '';
          confirmButton.textContent = originalConfirmText;
          cancelButton.textContent = originalCancelText;
          confirmButton.style.background = originalConfirmBg;
          confirmButton.style.color = originalConfirmColor;
          confirmButton.style.border = originalConfirmBorder;
          cancelButton.removeEventListener('click', onCancel);
          confirmButton.removeEventListener('click', onConfirm);
          overlay.removeEventListener('click', onBackdrop);
          document.removeEventListener('keydown', onKeydown);
          resolve(result);
        };
        const onCancel = () => finish(false);
        const onConfirm = () => finish(true);
        const onBackdrop = (event) => { if (event.target === overlay) finish(false); };
        const onKeydown = (event) => { if (event.key === 'Escape') finish(false); };
        cancelButton.addEventListener('click', onCancel);
        confirmButton.addEventListener('click', onConfirm);
        overlay.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeydown);
        confirmButton.focus();
      });
    }


    /****************************************************
     * GENERIC INFRASTRUCTURE HELPERS UTILS
     ****************************************************/
    function renderLoadingLayoutIndicator(friendlyMessage) {
      rootContainer.innerHTML = `<div class="p-card state-card"><div class="spinner-premium"></div><h3 style="font-size:16px">${escapeHtmlOutput(friendlyMessage)}</h3><p style="margin-top:6px;color:var(--text-muted);font-size:11px">Đang đồng bộ dữ liệu thời gian thực.</p></div>`;
    }


    function renderErrorLayoutState(errorMessage) {
      rootContainer.innerHTML = `<div class="p-card state-card"><div class="state-icon" style="color:var(--danger)">${SVGS.TRASH}</div><h2 style="font-size:20px">Không thể mở tài nguyên</h2><p style="margin:9px 0 22px;color:var(--text-muted);font-size:12px;line-height:1.7">${escapeHtmlOutput(errorMessage)}</p><button class="btn-premium" onclick="window.location.reload()">Tải lại trang</button></div>`;
    }


    function renderFatalConfigurationFailure() {
      rootContainer.innerHTML = `
        <div class="p-card" style="border-top:4px solid var(--danger); margin-top:40px; padding: 24px;">
          <h2 style="color:var(--danger); font-size:18px;">Lỗi xác thực cấu hình lõi phân quyền</h2>
          <p style="margin-top:10px; font-size:13px; color:var(--text-muted); line-height:1.6;">
            Cấu hình khóa ứng dụng trong đối tượng cấu trúc <strong>CONFIG.FIREBASE</strong> hoặc khóa công khai tài khoản <strong>CLOUDINARY</strong> chứa chuỗi ký tự tạm rỗng hoặc "PASTE_". Vui lòng kiểm tra lại file index.html.
          </p>
        </div>
      `;
    }


    function toggleButtonUIPendingState(buttonDomNode, isBusyState, overlayTextValue) {
      if (!buttonDomNode) return;
      if (isBusyState) {
        buttonDomNode.setAttribute('data-preserved-text', buttonDomNode.textContent);
        buttonDomNode.textContent = overlayTextValue;
        buttonDomNode.disabled = true;
      } else {
        buttonDomNode.textContent = buttonDomNode.getAttribute('data-preserved-text') || overlayTextValue;
        buttonDomNode.disabled = false;
      }
    }


    function executeTextCopyToClipboardRawString(textStringPayload, customMessage) {
      const msg = customMessage || 'Đã sao chép vào bộ nhớ tạm.';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textStringPayload)
          .then(() => triggerToast(msg))
          .catch(() => fallbackExecutionTextCopyLegacy(textStringPayload, msg));
      } else {
        fallbackExecutionTextCopyLegacy(textStringPayload, msg);
      }
    }


    function fallbackExecutionTextCopyLegacy(fallbackText, customMessage) {
      const msg = customMessage || 'Đã sao chép vào bộ nhớ tạm.';
      const transientTextarea = document.createElement('textarea');
      transientTextarea.value = fallbackText; transientTextarea.style.position = 'fixed'; transientTextarea.style.left = '-9999px';
      document.body.appendChild(transientTextarea); transientTextarea.focus(); transientTextarea.select();
      try { document.execCommand('copy'); triggerToast(msg); } catch (err) { triggerToast('Lỗi trích xuất bộ nhớ.', 'error'); }
      document.body.removeChild(transientTextarea);
    }


    function copyHsbtToClipboard(btn, text, event) {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }
      if (!text || text === '—' || text === '-') return;
      executeTextCopyToClipboardRawString(text, `Đã sao chép số HSBT: ${text}`);
      if (btn) {
        const originalHtml = btn.innerHTML;
        const prevBg = btn.style.background;
        const prevColor = btn.style.color;
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#10b981" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        btn.style.background = 'rgba(16, 185, 129, 0.15)';
        btn.style.color = '#10b981';
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.style.background = prevBg;
          btn.style.color = prevColor;
        }, 1500);
      }
    }
