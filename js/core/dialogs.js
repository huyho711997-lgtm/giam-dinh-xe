    let premiumConfirmationSequence = 0;
    function showPremiumConfirmModal({title, message, confirmText = 'Xác nhận', eyebrow = 'XÁC NHẬN THAO TÁC', items = [], onOpen}) {
      document.querySelectorAll('dialog.sf-confirm[open]').forEach(dialog => dialog.close('cancel'));
      return new Promise(resolve => {
        const make = (tag, text, className) => {
          const node = document.createElement(tag);
          if (text) node.textContent = text;
          if (className) node.className = className;
          return node;
        };
        const dialog = make('dialog', null, 'sf-dialog sf-confirm');
        const id = 'premiumConfirmation' + (++premiumConfirmationSequence);
        dialog.setAttribute('aria-labelledby', id + 'Title');
        dialog.setAttribute('aria-describedby', id + 'Message');
        const form = make('form', null, 'sf-dialog-form');
        const header = make('header'), titles = make('div');
        const heading = make('h2', title || 'Xác nhận thao tác');
        heading.id = id + 'Title';
        titles.append(make('small', eyebrow), heading);
        const action = (text, callback, className = 'sf-button') => {
          const button = make('button', text, className);
          button.type = 'button'; button.onclick = callback;
          return button;
        };
        const close = action('×', () => dialog.close('cancel'));
        close.setAttribute('aria-label', 'Đóng xác nhận');
        header.append(titles, close);
        const description = make('p', message, 'sf-confirm-note');
        description.id = id + 'Message';
        form.append(header, description);
        if (items.length) {
          const list = make('ul', null, 'sf-confirm-items');
          items.slice(0, 5).forEach(item => list.append(make('li', String(item))));
          if (items.length > 5) list.append(make('li', 'Và ' + (items.length - 5) + ' mục khác…'));
          form.append(list);
        }
        const footer = make('footer');
        const cancel = action('Hủy bỏ', () => dialog.close('cancel'));
        footer.append(cancel, action(confirmText, () => dialog.close('confirm'), 'sf-button sf-confirm-submit'));
        form.append(footer); form.onsubmit = event => event.preventDefault(); dialog.append(form);
        const returnFocus = document.activeElement;
        dialog.addEventListener('keydown', event => {
          event.stopPropagation();
          if (event.key === 'Escape') { event.preventDefault(); dialog.close('cancel'); }
        });
        dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close('cancel'); });
        dialog.addEventListener('click', event => {
          if (event.target !== dialog) return;
          const bounds = dialog.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close('cancel');
        });
        dialog.addEventListener('close', () => {
          dialog.remove();
          if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
          resolve(dialog.returnValue === 'confirm');
        }, {once:true});
        document.body.append(dialog); dialog.showModal(); onOpen?.(dialog); cancel.focus();
      });
    }


    
    /* CUSTOM GLASSMORPHIC CONFIRMATION MODAL */
    function showCustomConfirmModal({ title, message, confirmText, confirmBg, onConfirm }) {
      const existing = document.getElementById('customConfirmModalOverlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'customConfirmModalOverlay';
      overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(11, 15, 25, 0.82); backdrop-filter: blur(16px); z-index: 999999; display: grid; place-items: center; padding: 16px;';

      overlay.innerHTML = `
        <div style="background: var(--surface-strong); border: 1px solid var(--border-strong); border-radius: 24px; width: min(480px, 92vw); padding: 26px 28px; box-shadow: 0 28px 70px rgba(0,0,0,0.6); text-align: center; position: relative;">
          
          <div style="width: 56px; height: 56px; border-radius: 18px; background: ${confirmBg || 'rgba(239,68,68,0.14)'}; color: ${confirmBg === '#10b981' ? '#10b981' : '#ef4444'}; border: 1px solid rgba(239,68,68,0.3); display: grid; place-items: center; margin: 0 auto 16px;">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 1-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>

          <h3 style="font-size: 19px; font-weight: 850; color: var(--text-main); margin: 0 0 8px;">${escapeHtmlOutput(title || 'Xác nhận Thao tác')}</h3>
          <p style="font-size: 13.5px; color: var(--text-soft); margin: 0 0 24px; line-height: 1.5;">${escapeHtmlOutput(message || 'Bạn có chắc chắn muốn thực hiện hành động này không?')}</p>

          <div style="display: flex; gap: 12px; justify-content: center;">
            <button type="button" id="btnCustomConfirmCancel" style="flex: 1; height: 44px; border-radius: 12px; font-size: 13.5px; font-weight: 850; background: var(--bg-soft); color: var(--text-main); border: 1px solid var(--border); cursor: pointer;">Hủy bỏ</button>
            <button type="button" id="btnCustomConfirmOk" style="flex: 1; height: 44px; border-radius: 12px; font-size: 13.5px; font-weight: 850; background: ${confirmBg || '#ef4444'}; color: #ffffff; border: none; cursor: pointer; box-shadow: 0 4px 18px rgba(239,68,68,0.35);">${escapeHtmlOutput(confirmText || 'Đồng ý xóa')}</button>
          </div>

        </div>
      `;

      document.body.appendChild(overlay);

      
      document.getElementById('btnCustomConfirmCancel').onclick = () => overlay.remove();
      document.getElementById('btnCustomConfirmOk').onclick = () => {
        overlay.remove();
        if (typeof onConfirm === 'function') onConfirm();
      };
    }


    
    /* CUSTOM GLASSMORPHIC PROMPT MODAL (PROMISE-BASED) */
    function showCustomPromptModalAsync({ title, message, requireText, confirmText, confirmBg }) {
      return new Promise((resolve) => {
        const existing = document.getElementById('customPromptModalOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'customPromptModalOverlay';
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(11, 15, 25, 0.82); backdrop-filter: blur(16px); z-index: 999999; display: grid; place-items: center; padding: 16px;';

        const renderMessage = (message || '').replace(/\n/g, '<br>');

        overlay.innerHTML = `
          <div style="background: var(--surface-strong); border: 1px solid var(--border-strong); border-radius: 24px; width: min(480px, 92vw); padding: 26px 28px; box-shadow: 0 28px 70px rgba(0,0,0,0.6); text-align: center; position: relative;">
            
            <div style="width: 56px; height: 56px; border-radius: 18px; background: ${confirmBg || 'rgba(239,68,68,0.14)'}; color: ${confirmBg === '#10b981' ? '#10b981' : '#ef4444'}; border: 1px solid rgba(239,68,68,0.3); display: grid; place-items: center; margin: 0 auto 16px;">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 1-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>

            <h3 style="font-size: 19px; font-weight: 850; color: var(--text-main); margin: 0 0 8px;">${escapeHtmlOutput(title || 'Xác nhận Thao tác')}</h3>
            <p style="font-size: 13.5px; color: var(--text-soft); margin: 0 0 20px; line-height: 1.5;">${renderMessage}</p>

            <input type="text" id="customPromptInput" class="input-premium" placeholder="${requireText ? `Nhập chữ: ${requireText}` : 'Nhập thông tin xác nhận...'}" style="margin-bottom: 24px; text-align: center; font-weight: 800; text-transform: uppercase;" autocomplete="off" />

            <div style="display: flex; gap: 12px; justify-content: center;">
              <button type="button" id="btnCustomPromptCancel" style="flex: 1; height: 44px; border-radius: 12px; font-size: 13.5px; font-weight: 850; background: var(--bg-soft); color: var(--text-main); border: 1px solid var(--border); cursor: pointer;">Hủy bỏ</button>
              <button type="button" id="btnCustomPromptOk" style="flex: 1; height: 44px; border-radius: 12px; font-size: 13.5px; font-weight: 850; background: ${confirmBg || '#ef4444'}; color: #ffffff; border: none; cursor: pointer; box-shadow: 0 4px 18px rgba(239,68,68,0.35); opacity: 0.5; pointer-events: none;">${escapeHtmlOutput(confirmText || 'Đồng ý')}</button>
            </div>
          </div>
        `;

        document.body.appendChild(overlay);

        const input = document.getElementById('customPromptInput');
        const btnOk = document.getElementById('btnCustomPromptOk');

        input.focus();

        input.addEventListener('input', () => {
          if (!requireText) {
            btnOk.style.opacity = '1';
            btnOk.style.pointerEvents = 'auto';
          } else {
            if (input.value.trim().toUpperCase() === requireText.toUpperCase()) {
              btnOk.style.opacity = '1';
              btnOk.style.pointerEvents = 'auto';
            } else {
              btnOk.style.opacity = '0.5';
              btnOk.style.pointerEvents = 'none';
            }
          }
        });

        // Submit on Enter
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && btnOk.style.pointerEvents === 'auto') {
            btnOk.click();
          }
        });

        document.getElementById('btnCustomPromptCancel').onclick = () => {
          overlay.remove();
          resolve(null);
        };

        btnOk.onclick = () => {
          overlay.remove();
          resolve(input.value.trim());
        };
      });
    }
