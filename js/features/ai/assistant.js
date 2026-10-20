
  let tascoAIChatHistory = [];

  function syncTascoAIWithDetailForms() {
    const hasOpenDetailForm = Array.from(document.querySelectorAll('.p-modal-overlay')).some((overlay) => {
      if (overlay.getAttribute('aria-hidden') === 'true') return false;
      const overlayStyle = window.getComputedStyle(overlay);
      return overlayStyle.display !== 'none' && overlayStyle.visibility !== 'hidden';
    });

    document.documentElement.classList.toggle('tasco-ai-detail-form-open', hasOpenDetailForm);

    if (hasOpenDetailForm) {
      const panel = document.getElementById('tasco-ai-panel');
      const button = document.getElementById('tasco-ai-btn');
      panel?.classList.remove('active');
      if (button) {
        button.classList.remove('is-active');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', 'Mở Trợ lý TASCO AI');
      }
    }
  }

  function initializeTascoAIDetailFormGuard() {
    syncTascoAIWithDetailForms();

    const observer = new MutationObserver((mutations) => {
      const detailFormChanged = mutations.some((mutation) => {
        const target = mutation.target;
        if (target instanceof Element && target.matches('.p-modal-overlay')) return true;
        return mutation.type === 'childList' && Array.from(mutation.addedNodes).some((node) =>
          node instanceof Element && (node.matches('.p-modal-overlay') || node.querySelector('.p-modal-overlay'))
        );
      });

      if (detailFormChanged) syncTascoAIWithDetailForms();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'aria-hidden']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTascoAIDetailFormGuard, { once: true });
  } else {
    initializeTascoAIDetailFormGuard();
  }
  
  function toggleTascoAI() {
    const panel = document.getElementById('tasco-ai-panel');
    const button = document.getElementById('tasco-ai-btn');
    if (!panel) return;
    const isActive = panel.classList.toggle('active');
    if (button) {
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-expanded', String(isActive));
      button.setAttribute('aria-label', isActive ? 'Đóng Trợ lý TASCO AI' : 'Mở Trợ lý TASCO AI');
    }
  }

  function fillTascoAIPrompt(promptText) {
    const input = document.getElementById('tasco-ai-input');
    if (!input) return;
    input.value = String(promptText || '');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function setGeminiApiKey() {
    const currentKey = localStorage.getItem('gemini_api_key') || '';
    const key = prompt('Nhập API Key Gemini (Lấy từ Google AI Studio):', currentKey);
    const currentModel = localStorage.getItem('gemini_model_name') || 'gemini-2.5-pro';
    const model = prompt('Nhập tên Model (VD: gemini-2.5-flash, gemini-2.5-pro...):', currentModel);
    if (key !== null) {
      localStorage.setItem('gemini_api_key', key.trim());
      if (model !== null) localStorage.setItem('gemini_model_name', model.trim());
      alert('Đã lưu API Key thành công!');
    }
  }

  async function sendTascoAIMessage() {
    const inputEl = document.getElementById('tasco-ai-input');
    const msg = inputEl.value.trim();
    if (!msg) return;

    const apiKey = localStorage.getItem('gemini_api_key');
    const modelName = localStorage.getItem('gemini_model_name') || 'gemini-2.5-pro';
    if (!apiKey) {
      alert('Vui lòng cài đặt Gemini API Key (nút ⚙️) trước khi sử dụng!');
      return;
    }

    // Add user message
    appendTascoAIMessage('user', msg);
    inputEl.value = '';

    // Typing indicator
    const typingId = 'typing-' + Date.now();
    const body = document.getElementById('tasco-ai-body');
    body.insertAdjacentHTML('beforeend', `<div id="${typingId}" class="typing-indicator"><span></span><span></span><span></span></div>`);
    body.scrollTop = body.scrollHeight;

    try {
      // Gather context (current stats and summary of what is happening)
      const totalHs = document.getElementById('lblTotalCases')?.innerText || 0;
      const dnxnHs = document.getElementById('lblDaXacNhanCases')?.innerText || 0;
      
      let rawDataSummary = '';
      try {
          if (typeof cachedPendingClaimsPayload !== 'undefined' && cachedPendingClaimsPayload) {
              const miniPending = Object.values(cachedPendingClaimsPayload).map(p => ({
                  bienSo: p.bienSo || 'Chưa rõ',
                  gdv: p.gdvTiepNhan || 'Chưa phân công',
                  trangThai: p.trangThai || 'moi'
              }));
              rawDataSummary += 'Danh sách Hồ sơ Tồn: ' + JSON.stringify(miniPending) + '. ';
          }
          if (typeof cachedCasesPayload !== 'undefined' && cachedCasesPayload) {
              const miniCases = Object.values(cachedCasesPayload).map(c => ({
                  bienSo: c.bienSo || 'Chưa rõ',
                  gdv: c.nguoiTao?.tenHienThi || 'Không rõ',
                  gara: c.tenGara || '',
                  trangThai: c.trangThai || ''
              }));
              rawDataSummary += 'Danh sách Hồ sơ Giám định: ' + JSON.stringify(miniCases) + '. ';
          }
      } catch(err) { console.error('Error stringifying context data', err); }
      
      // Limit raw data size to avoid payload too large (approx 50,000 chars)
      if (rawDataSummary.length > 50000) rawDataSummary = rawDataSummary.substring(0, 50000) + '...[bị cắt bớt do quá dài]';

      const contextPrompt = `Tôi đang thao tác trên phần mềm TASCO DLK. Thông tin vắn tắt: Tổng số hồ sơ: ${totalHs}, Đã xác nhận: ${dnxnHs}. Dữ liệu hệ thống hiện tại (bạn hãy đếm, lọc dữ liệu này để trả lời khi user hỏi có bao nhiêu hồ sơ, của ai, trạng thái nào): 

${rawDataSummary}`;
      
      const payload = {
        system_instruction: {
          parts: [{ text: "Bạn là TASCO AI - Trợ lý ảo thông minh của hệ thống quản lý hồ sơ bồi thường xe cơ giới TASCO DLK. Hãy trả lời ngắn gọn, lịch sự, chuyên nghiệp bằng tiếng Việt và hỗ trợ người dùng hết mình dựa trên ngữ cảnh được cung cấp." }]
        },
        contents: [
          ...tascoAIChatHistory,
          { role: "user", parts: [{ text: `[Ngữ cảnh hệ thống hiện tại: ${contextPrompt}]

Câu hỏi của tôi: ${msg}` }] }
        ]
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      document.getElementById(typingId).remove();
      
      if (data.error) {
        appendTascoAIMessage('ai', `Lỗi kết nối API: ${data.error.message}`);
      } else {
        const replyText = data.candidates[0].content.parts[0].text;
        appendTascoAIMessage('ai', formatTascoAIText(replyText));
        
        tascoAIChatHistory.push({ role: "user", parts: [{ text: msg }] });
        tascoAIChatHistory.push({ role: "model", parts: [{ text: replyText }] });
      }
    } catch (e) {
      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();
      appendTascoAIMessage('ai', `Không thể kết nối đến máy chủ AI: ${e.message}`);
    }
  }

  function appendTascoAIMessage(role, htmlContent) {
    const body = document.getElementById('tasco-ai-body');
    const div = document.createElement('div');
    div.className = `msg-bubble msg-${role}`;
    div.innerHTML = htmlContent;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function formatTascoAIText(text) {
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                        .replace(/\*(.*?)\*/g, '<i>$1</i>')
                        .replace(/\n/g, '<br>');
    return formatted;
  }
