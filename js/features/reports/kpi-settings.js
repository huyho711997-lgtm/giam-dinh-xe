

    function getStoredKpiCoefConfig() {
      try {
        const raw = localStorage.getItem('kpiCoefficientConfig');
        if (raw) return JSON.parse(raw);
      } catch(e){}
      return defaultKpiCoefConfig;
    }


    function saveKpiCoefConfig(cfg) {
      const isAdmin = activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin';
      if (!isAdmin) {
        triggerToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
      }

      try {
        localStorage.setItem('kpiCoefficientConfig', JSON.stringify(cfg));
        if (dbNodeInstance) {
          dbNodeInstance.ref('system_config/kpi_config').set(cfg).catch(() => {});
        }
      } catch(e){}
    }


    function renderKpiConfigSubTabUI(container) {
      const cfg = getStoredKpiCoefConfig();
      const vcxRules = cfg.filter(r => r.type === 'VCX');
      const tndsRules = cfg.filter(r => r.type === 'TNDS');

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 24px;">
          
          <!-- BANNER HEADER -->
          <div style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(216,180,109,0.12); border: 1px solid rgba(216,180,109,0.3); color: var(--primary); padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 850; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
                <span>CẤU HÌNH QUY ĐỔI NĂNG SUẤT</span>
              </div>
              <h3 style="font-size: 20px; font-weight: 850; color: var(--text-main); margin: 0;">Bảng Cấu hình Hệ số KPI Hồ sơ theo Hạn mức Giá trị Bồi thường</h3>
              <p style="font-size: 13px; color: var(--text-soft); margin-top: 4px; margin-bottom: 0; max-width: 800px;">
                Thiết lập hệ số quy đổi ca KPI cho từng loại hình bảo hiểm (Vật chất xe VCX & Trách nhiệm dân sự TNDS) dựa trên khoảng số tiền bồi thường được duyệt.
              </p>
            </div>
            
            <div style="display: flex; gap: 10px;">
              <button type="button" class="btn-premium" onclick="saveKpiConfigFromUI()" style="padding: 0 22px; height: 42px; font-size: 13px; border-radius: 11px; font-weight: 850; background: var(--primary-gradient); color: #111111; border: none; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(216,180,109,0.35);">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span>Lưu Cấu hình Hệ số KPI</span>
              </button>
            </div>
          </div>

          <!-- BẢNG 1: HỒ SƠ BẢO HIỂM VẬT CHẤT XE (VCX) -->
          <div style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 18px; padding: 22px 26px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 14px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 34px; height: 34px; border-radius: 10px; background: rgba(216,180,109,0.15); border: 1px solid rgba(216,180,109,0.3); color: var(--primary); font-weight: 900; font-size: 13px; display: grid; place-items: center;">VCX</div>
                <div>
                  <h4 style="font-size: 16px; font-weight: 850; color: var(--text-main); margin: 0;">1. Hồ sơ Bảo hiểm Vật chất xe (VCX)</h4>
                  <span style="font-size: 12px; color: var(--text-soft);">Bảng định mức hệ số tính ca cho tổn thất vật chất xe ô tô</span>
                </div>
              </div>
            </div>

            <div class="table-container" style="border: 1px solid var(--border); border-radius: 14px; overflow: hidden;">
              <table class="p-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: var(--bg-soft);">
                    <th style="width: 60px; text-align: center;">STT</th>
                    <th>Khoảng Giá trị Bồi thường (VNĐ)</th>
                    <th style="width: 200px; text-align: center;">Hệ số Quy đổi KPI ($k$)</th>
                    <th style="width: 250px;">Mô tả Hạn mức</th>
                  </tr>
                </thead>
                <tbody>
                  ${vcxRules.map((r, idx) => `
                    <tr>
                      <td style="text-align: center; font-weight: 850; color: var(--text-muted); ">${idx + 1}</td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;  font-weight: 750;">
                          <input type="text" class="input-premium" value="${formatCurrencyInputNumber(r.fromAmt)}" onchange="updateKpiRuleValue('${r.id}', 'fromAmt', this.value)" style="width: 140px; height: 36px; font-size: 12.5px; text-align: right;" />
                          <span style="color: var(--text-muted);">đến</span>
                          <input type="text" class="input-premium" value="${r.toAmt >= 999999999999 ? 'Không giới hạn' : formatCurrencyInputNumber(r.toAmt)}" onchange="updateKpiRuleValue('${r.id}', 'toAmt', this.value)" style="width: 150px; height: 36px; font-size: 12.5px; text-align: right;" />
                          <span style="color: var(--text-soft); font-size: 12px;">VNĐ</span>
                        </div>
                      </td>
                      <td style="text-align: center;">
                        <input type="number" step="0.1" min="0.1" max="10" class="input-premium" value="${r.coef}" onchange="updateKpiRuleValue('${r.id}', 'coef', this.value)" style="width: 90px; height: 36px; font-size: 13px; font-weight: 850;  text-align: center; color: var(--primary); display: inline-block;" />
                      </td>
                      <td>
                        <span style="font-size: 12px; font-weight: 700; color: var(--text-soft);">${escapeHtmlOutput(r.label)}</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- BẢNG 2: HỒ SƠ BẢO HIỂM TRÁCH NHIỆM DÂN SỰ (TNDS) -->
          <div style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 18px; padding: 22px 26px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 14px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 34px; height: 34px; border-radius: 10px; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #3b82f6; font-weight: 900; font-size: 12px; display: grid; place-items: center;">TNDS</div>
                <div>
                  <h4 style="font-size: 16px; font-weight: 850; color: var(--text-main); margin: 0;">2. Hồ sơ Bảo hiểm Trách nhiệm Dân sự (TNDS)</h4>
                  <span style="font-size: 12px; color: var(--text-soft);">Bảng định mức hệ số tính ca cho tổn thất trách nhiệm dân sự người thứ ba</span>
                </div>
              </div>
            </div>

            <div class="table-container" style="border: 1px solid var(--border); border-radius: 14px; overflow: hidden;">
              <table class="p-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: var(--bg-soft);">
                    <th style="width: 60px; text-align: center;">STT</th>
                    <th>Khoảng Giá trị Bồi thường (VNĐ)</th>
                    <th style="width: 200px; text-align: center;">Hệ số Quy đổi KPI ($k$)</th>
                    <th style="width: 250px;">Mô tả Hạn mức</th>
                  </tr>
                </thead>
                <tbody>
                  ${tndsRules.map((r, idx) => `
                    <tr>
                      <td style="text-align: center; font-weight: 850; color: var(--text-muted); ">${idx + 1}</td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;  font-weight: 750;">
                          <input type="text" class="input-premium" value="${formatCurrencyInputNumber(r.fromAmt)}" onchange="updateKpiRuleValue('${r.id}', 'fromAmt', this.value)" style="width: 140px; height: 36px; font-size: 12.5px; text-align: right;" />
                          <span style="color: var(--text-muted);">đến</span>
                          <input type="text" class="input-premium" value="${r.toAmt >= 999999999999 ? 'Không giới hạn' : formatCurrencyInputNumber(r.toAmt)}" onchange="updateKpiRuleValue('${r.id}', 'toAmt', this.value)" style="width: 150px; height: 36px; font-size: 12.5px; text-align: right;" />
                          <span style="color: var(--text-soft); font-size: 12px;">VNĐ</span>
                        </div>
                      </td>
                      <td style="text-align: center;">
                        <input type="number" step="0.1" min="0.1" max="10" class="input-premium" value="${r.coef}" onchange="updateKpiRuleValue('${r.id}', 'coef', this.value)" style="width: 90px; height: 36px; font-size: 13px; font-weight: 850;  text-align: center; color: var(--input-accent-blue, #3b82f6); display: inline-block;" />
                      </td>
                      <td>
                        <span style="font-size: 12px; font-weight: 700; color: var(--text-soft);">${escapeHtmlOutput(r.label)}</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      `;
    }


    function updateKpiRuleValue(id, field, rawVal) {
      const cfg = getStoredKpiCoefConfig();
      const rule = cfg.find(r => r.id === id);
      if (!rule) return;

      if (field === 'coef') {
        rule.coef = parseFloat(rawVal) || 1.0;
      } else if (field === 'fromAmt') {
        rule.fromAmt = parseInt(String(rawVal).replace(/[^0-9]/g, ''), 10) || 0;
      } else if (field === 'toAmt') {
        if (String(rawVal).toLowerCase().includes('không') || String(rawVal).toLowerCase().includes('max')) {
          rule.toAmt = 999999999999;
        } else {
          rule.toAmt = parseInt(String(rawVal).replace(/[^0-9]/g, ''), 10) || 999999999999;
        }
      }
      saveKpiCoefConfig(cfg);
    }


    function saveKpiConfigFromUI() {
      const cfg = getStoredKpiCoefConfig();
      saveKpiCoefConfig(cfg);
      triggerToast('Đã lưu Cấu hình Hệ số KPI Hồ sơ thành công!', 'success');
      if (activeDashboardTab === 'gdv_report' && typeof renderGdvMonthlyReportPage === 'function') {
        renderGdvMonthlyReportPage();
      }
    }
