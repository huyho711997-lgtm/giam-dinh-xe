// Trình soạn biểu mẫu từng bước ngay trong khung chat Trợ lý AI:
// 1) chọn biểu mẫu → 2) tìm hồ sơ theo tên chủ xe / biển số → 3) nếu xe có nhiều vụ tổn thất thì chọn vụ → 4) ra lệnh → bản nháp.
const TascoFormWizard = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
  const CHIPS = [['Điền đầy đủ thông tin hồ sơ', 'Điền đầy đủ các thông tin có trong hồ sơ vào biểu mẫu.'], ['Chỉ thông tin cơ bản', 'Chỉ điền họ tên chủ xe, biển số xe, số hồ sơ bồi thường và ngày tổn thất.']];
  let run = 0, controller = null;

  const body = () => document.getElementById('tasco-ai-body');
  function bubble(html) {
    const node = document.createElement('div');
    node.className = 'msg-bubble msg-ai tasco-ai-wizard';
    node.innerHTML = html;
    body().appendChild(node);
    body().scrollTop = body().scrollHeight;
    return node;
  }
  const lock = node => node.querySelectorAll('button,input').forEach(control => { control.disabled = true; });

  async function start(options = {}) {
    controller?.abort();
    const id = ++run;
    const panel = document.getElementById('tasco-ai-panel');
    if (panel && !panel.classList.contains('active') && typeof toggleTascoAI === 'function') toggleTascoAI();
    const apiKey = await GeminiKeyStore.get();
    if (!apiKey) { appendTascoAIMessage('ai', 'Cần thiết lập khoá Gemini API trước khi soạn biểu mẫu. Đang mở phần thiết lập cho bạn.'); toggleTascoAISettings(true); return; }
    const loading = bubble('<p>Đang tải danh sách biểu mẫu…</p>');
    let forms = [];
    try { forms = await TascoAITools.libraryForms(); } catch (_) { /* hiển thị rỗng bên dưới */ }
    loading.remove();
    if (id !== run) return;
    if (!forms.length) { bubble('<p>Chưa có biểu mẫu Word (.docx) nào trong thư viện ứng dụng.</p>'); return; }
    const wanted = TascoAITools.norm(options.form);
    const preset = wanted && forms.find(file => TascoAITools.norm(file.name).includes(wanted));
    if (preset) { chooseForm(id, preset, options.query); return; }
    const node = bubble('<p><b>Chọn biểu mẫu cần soạn:</b></p><div class="tasco-ai-choices">' + forms.map((file, index) => '<button type="button" class="tasco-ai-choice" data-form="' + index + '"><strong>' + esc(file.name) + '</strong><small>' + esc(file.category || 'Biểu mẫu') + '</small></button>').join('') + '</div>');
    node.addEventListener('click', event => {
      const button = event.target.closest('[data-form]');
      if (!button) return;
      lock(node);
      button.classList.add('is-picked');
      chooseForm(id, forms[Number(button.dataset.form)], options.query);
    });
  }

  function chooseForm(id, file, presetQuery) {
    if (id !== run) return;
    appendTascoAIMessage('user', 'Biểu mẫu: ' + esc(file.name));
    const node = bubble('<p><b>Soạn cho hồ sơ nào?</b> Nhập tên chủ xe hoặc biển số.</p><input type="text" class="tasco-ai-wizard-input" placeholder="VD: Hiệp, 47H11450…" autocomplete="off" value="' + esc(presetQuery || '') + '"><div class="tasco-ai-choices" data-results></div>');
    const input = node.querySelector('input'), results = node.querySelector('[data-results]');
    let timer = null, groups = [];
    const paint = () => {
      const found = TascoAITools.vehicleGroups(input.value);
      groups = found.groups;
      results.innerHTML = groups.length
        ? groups.map((group, index) => '<button type="button" class="tasco-ai-choice" data-group="' + index + '"><strong>' + esc(group.plate || '(chưa có biển số)') + ' · ' + esc(group.owner || 'Chưa rõ chủ xe') + '</strong><small>' + (group.claims.length > 1 ? group.claims.length + ' vụ tổn thất — bấm để chọn vụ' : esc(group.claims[0].label.hsbt || group.claims[0].label.vtt || 'Có 1 hồ sơ')) + '</small></button>').join('') + (found.total > groups.length ? '<small class="tasco-ai-more">Còn ' + (found.total - groups.length) + ' kết quả khác, hãy gõ thêm để thu hẹp.</small>' : '')
        : '<small class="tasco-ai-more">' + (input.value.trim() ? 'Không tìm thấy hồ sơ phù hợp.' : 'Gõ tên chủ xe hoặc biển số để tìm.') + '</small>';
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(paint, 150); });
    results.addEventListener('click', event => {
      const button = event.target.closest('[data-group]');
      if (!button) return;
      const group = groups[Number(button.dataset.group)];
      lock(node);
      chooseVehicle(id, file, group);
    });
    paint();
    input.focus();
  }

  function chooseVehicle(id, file, group) {
    if (id !== run) return;
    appendTascoAIMessage('user', 'Xe: ' + esc(group.plate || group.owner));
    if (group.claims.length === 1) { chooseClaim(id, file, group, group.claims[0]); return; }
    // Xe có nhiều vụ tổn thất → hỏi thêm để chọn đúng vụ.
    const node = bubble('<p><b>Xe ' + esc(group.plate || group.owner) + ' có ' + group.claims.length + ' vụ tổn thất.</b> Soạn cho vụ nào?</p><div class="tasco-ai-choices">' + group.claims.map((claim, index) => {
      const info = claim.label;
      const title = [info.ngay && 'Ngày TT ' + info.ngay, info.vtt && 'VTT ' + info.vtt].filter(Boolean).join(' · ') || 'Vụ ' + (index + 1);
      const detail = [info.hsbt && 'HSBT ' + info.hsbt, info.trangThai, info.diaDiem || info.nguyenNhan].filter(Boolean).join(' · ');
      return '<button type="button" class="tasco-ai-choice" data-claim="' + index + '"><strong>' + esc(title) + '</strong><small>' + esc(detail) + '</small></button>';
    }).join('') + '</div>');
    node.addEventListener('click', event => {
      const button = event.target.closest('[data-claim]');
      if (!button) return;
      lock(node);
      chooseClaim(id, file, group, group.claims[Number(button.dataset.claim)]);
    });
  }

  function chooseClaim(id, file, group, claim) {
    if (id !== run) return;
    const info = claim.label;
    appendTascoAIMessage('user', 'Hồ sơ: ' + esc([group.plate, info.hsbt || info.vtt || info.ngay].filter(Boolean).join(' · ')));
    const node = bubble('<p><b>Bạn muốn AI soạn thế nào?</b></p><div class="tasco-ai-chiprow">' + CHIPS.map(([label], index) => '<button type="button" class="tasco-ai-chip" data-chip="' + index + '">' + esc(label) + '</button>').join('') + '</div><input type="text" class="tasco-ai-wizard-input" placeholder="Hoặc gõ yêu cầu riêng, VD: kính gửi Bảo Việt, ngày lập hôm nay…" maxlength="500"><button type="button" class="tasco-ai-btn-primary tasco-ai-wizard-go" data-go>Soạn biểu mẫu</button>');
    const input = node.querySelector('input');
    const go = text => { lock(node); generate(id, file, group, claim, text); };
    node.addEventListener('click', event => {
      const chip = event.target.closest('[data-chip]');
      if (chip) { go(CHIPS[Number(chip.dataset.chip)][1]); return; }
      if (event.target.closest('[data-go]')) go(input.value.trim() || CHIPS[0][1]);
    });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); go(input.value.trim() || CHIPS[0][1]); } });
    input.focus();
  }

  async function generate(id, file, group, claim, command) {
    if (id !== run) return;
    appendTascoAIMessage('user', esc(command));
    const status = bubble('<p>Đang soạn biểu mẫu…</p>');
    controller = new AbortController();
    try {
      const result = await SharedFormsAI.draft(file, async () => { const response = await fetch(SharedFormsStore.safeUrl(file.url)); if (!response.ok) throw new Error('Không tải được biểu mẫu.'); return response.arrayBuffer(); }, claim.record, command, controller.signal);
      status.remove();
      renderTascoAIDraft({file, record: claim.record, label: group.plate || claim.label.hsbt || claim.id, ...result});
    } catch (error) {
      status.remove();
      if (error.name !== 'AbortError') appendTascoAIMessage('ai', esc(error.message || 'Không soạn được biểu mẫu.'));
    }
  }

  return {start};
})();
