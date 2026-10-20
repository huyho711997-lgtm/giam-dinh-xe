

    function updateAdjusterSummaryStats() {
      let totalMoney = 0;
      let approvedCount = 0;
      if (!localActiveRequestedItems) return;
      localActiveRequestedItems.forEach(item => {
        const decision = item.phuongAnDuyet || 'chua';
        if (decision === 'thay_moi' || decision === 'sua_chua') {
          totalMoney += Number(item.soTienDuyet || 0);
          approvedCount++;
        }
      });
      const summaryValNode = document.getElementById('adjusterSummaryTotalMoney');
      const summaryCountNode = document.getElementById('adjusterSummaryCount');
      if (summaryValNode) summaryValNode.textContent = totalMoney.toLocaleString('vi-VN') + ' đ';
      if (summaryCountNode) summaryCountNode.textContent = `${approvedCount} hạng mục`;
    }


    async function updateAdjusterDecision(requestIndex, phuongAn, soTien) {
      if (!localActiveRequestedItems[requestIndex]) return;
      if (typeof phuongAn !== 'undefined') {
        localActiveRequestedItems[requestIndex].phuongAnDuyet = phuongAn;
      }
      if (typeof soTien !== 'undefined') {
        localActiveRequestedItems[requestIndex].soTienDuyet = Number(soTien) || 0;
      }
      try {
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh`).set(localActiveRequestedItems);
        updateAdjusterSummaryStats();
      } catch (error) {
        console.error(error);
      }
    }


    function renderPortalResultReadOnlyView(renderMode) {
      if (!localActiveImageStack.length && !localActiveRequestedItems.length) return renderErrorLayoutState('Không thể cấu trúc dữ liệu kết quả của hồ sơ.');
      const completedItems = localActiveImageStack.filter(item => String(item.hangMucBaoGia || '').trim()).length;
      const completedEvidenceItems = localActiveRequestedItems.filter(item => normalizeEvidenceImageUrls(item).length).length;

      const imageResultsSection = (localActiveImageStack.length && localActiveRequestedItems.length) ? `
        <div class="workspace-section-head" style="margin-bottom: 12px; margin-top: 16px;">
          <div>
            <h2>Bể ảnh giám định gốc</h2>
            <p>Kho ảnh chụp hiện trạng tổn thất do Giám định viên tải lên lúc lập hồ sơ.</p>
          </div>
          <div class="workspace-section-index">${String(localActiveImageStack.length).padStart(2,'0')} ẢNH</div>
        </div>
        <div class="p-card" style="padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm);">
          ${localActiveImageStack.map((item, index) => {
            const mappedItems = [];
            localActiveRequestedItems.forEach((reqItem, reqIdx) => {
              const urls = normalizeEvidenceImageUrls(reqItem);
              if (urls.includes(item.linkAnh)) {
                mappedItems.push(reqItem.tenHangMuc || `Hạng mục ${reqIdx + 1}`);
              }
            });
            const isMapped = mappedItems.length > 0;
            const mapLabel = isMapped 
              ? `<span style="background: rgba(16,185,129,0.12); color: #10b981; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px;">Đã khớp: ${mappedItems.join(', ')}</span>`
              : `<span style="background: var(--surface-soft); color: var(--text-muted); font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">Chưa phân loại</span>`;
            return `
              <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                <div class="preview-thumb" style="width: 100%; aspect-ratio: 4/3; margin-bottom: 4px; cursor: zoom-in;" onclick="openLightbox(localActiveImageStack.map(x => x.linkAnh), ${index})">
                  <img src="${escapeAttributeData(item.linkAnh)}" style="width:100%; height:100%; object-fit:cover; border-radius: 8px;" />
                </div>
                <span style=" font-size: 10px; font-weight: 800; color: var(--text-soft);">Ảnh ${index + 1}</span>
                ${mapLabel}
              </div>
            `;
          }).join('')}
        </div>
      ` : '';

      const evidenceResultsSection = localActiveRequestedItems.length ? `
        <div class="workspace-section-head" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h2>Danh sách hình ảnh minh chứng theo hạng mục</h2>
            <p>Bảng tổng hợp hồ sơ giám định và hình ảnh minh chứng tương ứng do Garage cung cấp.</p>
          </div>
          <div style="display: flex; align-items: center; gap: 14px;">
            ${completedEvidenceItems > 0 ? `
              <button type="button" class="btn-premium" onclick="downloadAllCategoriesZip()" style="padding: 8px 16px; min-height: unset; height: 36px; font-size: 11.5px; margin: 0; display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; background: var(--primary-gradient); color: #080b11; font-weight: 800; border: none; box-shadow: 0 4px 12px rgba(216,180,109,0.25);">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Tải toàn bộ ảnh (.ZIP)</span>
              </button>
            ` : ''}
            <div class="workspace-section-index" style="margin: 0; flex-shrink: 0;">${String(completedEvidenceItems).padStart(2,'0')}/${String(localActiveRequestedItems.length).padStart(2,'0')}</div>
          </div>
        </div>
        <div style="margin-bottom: 14px; position: relative;">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--text-muted)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="searchHangMucInput" placeholder="Tìm kiếm hạng mục... (VD: cản trước, kính, vè...)" oninput="filterHangMucRows(this.value)" style="width: 100%; padding: 10px 14px 10px 40px; border-radius: 12px; border: 1.5px solid var(--border-strong); background: var(--surface); color: var(--text-main); font-size: 13px; font-weight: 600; font-family: inherit; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease;" onfocus="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 0 0 3px rgba(216,180,109,0.15)';" onblur="this.style.borderColor='var(--border-strong)'; this.style.boxShadow='none';" />
        </div>
        <div class="p-card" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm);">
          <table class="p-table" id="hangMucEvidenceTable" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">#</th>
                <th style="width: 220px;">Hạng mục yêu cầu</th>
                <th>Hình ảnh minh chứng từ Garage</th>
                <th style="width: 250px;">Ghi chú của Gara</th>
                <th style="width: 150px; text-align: right; padding-right: 20px;">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${localActiveRequestedItems.map((item, index) => {
                const urls = normalizeEvidenceImageUrls(item);
                return `
                  <tr>
                    <td data-label="#" style="text-align: center; vertical-align: middle;">
                      <div class="evidence-request-number" style="width: 32px; height: 32px; margin: 0 auto; font-size: 11px; border-radius: 10px;">${String(index+1).padStart(2,'0')}</div>
                    </td>
                    <td data-label="Hạng mục" style="vertical-align: middle;">
                      ${getCategoryBadgeMarkup(item.tenHangMuc, item.taoBoiGara)}
                      <strong style="color: var(--text-main); font-size: 14px; font-weight: 700; display: block; margin-top: 2px;">${escapeHtmlOutput(item.tenHangMuc || `Hạng mục ${index+1}`)}</strong>
                      ${item.mucDoHuHong ? `<div style="margin-top: 4px; font-size: 11.5px; color: var(--primary); font-weight: 750; display: inline-flex; align-items: center; gap: 4px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><span>Mức độ: ${escapeHtmlOutput(item.mucDoHuHong)}</span></div>` : ''}
                      ${item.phuongAnDeXuat ? `<div style="margin-top: 2px; font-size: 11.5px; color: ${item.phuongAnDeXuat === 'sua_chua' ? '#3b82f6' : '#ef4444'}; font-weight: 750; display: inline-flex; align-items: center; gap: 4px;">${item.phuongAnDeXuat === 'sua_chua' ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg><span>Đề xuất: Sửa chữa</span>` : `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg><span>Đề xuất: Thay thế</span>`}</div>` : ''}
                    </td>
                    <td data-label="Hình ảnh minh chứng" style="vertical-align: middle;">
                      ${urls.length ? (() => {
                        const MAX_VISIBLE = 3;
                        if (urls.length <= MAX_VISIBLE) {
                          return `
                            <div style="display: flex; gap: 8px; flex-wrap: nowrap;">
                              ${urls.map((url, imageIndex) => `
                                <button type="button" class="evidence-result-image" onclick="openLightbox(normalizeEvidenceImageUrls(localActiveRequestedItems[${index}]), ${imageIndex})" style="width: 90px; height: 68px; border-radius: 8px; flex-shrink: 0; margin: 0; border: 1.5px solid var(--border-strong);">
                                  <img src="${escapeAttributeData(url)}" alt="Ảnh minh chứng" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
                                </button>
                              `).join('')}
                            </div>
                          `;
                        } else {
                          const visibleUrls = urls.slice(0, MAX_VISIBLE - 1);
                          const remainingCount = urls.length - (MAX_VISIBLE - 1);
                          const overlayUrl = urls[MAX_VISIBLE - 1];
                          return `
                            <div style="display: flex; gap: 8px; flex-wrap: nowrap;">
                              ${visibleUrls.map((url, imageIndex) => `
                                <button type="button" class="evidence-result-image" onclick="openLightbox(normalizeEvidenceImageUrls(localActiveRequestedItems[${index}]), ${imageIndex})" style="width: 90px; height: 68px; border-radius: 8px; flex-shrink: 0; margin: 0; border: 1.5px solid var(--border-strong);">
                                  <img src="${escapeAttributeData(url)}" alt="Ảnh minh chứng" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
                                </button>
                              `).join('')}
                              <button type="button" class="evidence-result-image" onclick="openLightbox(normalizeEvidenceImageUrls(localActiveRequestedItems[${index}]), ${MAX_VISIBLE - 1})" style="position: relative; width: 90px; height: 68px; border-radius: 8px; flex-shrink: 0; margin: 0; border: 1.5px solid var(--border-strong);">
                                <img src="${escapeAttributeData(overlayUrl)}" alt="Ảnh minh chứng" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
                                <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.65); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; border-radius: 6px; font-weight: 800; font-size: 13px;">
                                  <span>+${remainingCount}</span>
                                  <span style="font-size: 8.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 1px; opacity: 0.85;">ảnh</span>
                                </div>
                              </button>
                            </div>
                          `;
                        }
                      })() : `
                        <span style="color: var(--text-muted); font-size: 12px; font-style: italic;">Garage chưa cung cấp ảnh</span>
                      `}
                    </td>
                    <td data-label="Ghi chú" style="vertical-align: middle;">
                      <div style="font-size: 12px; color: var(--text-soft); line-height: 1.5; white-space: pre-wrap; max-height: 80px; overflow-y: auto;">${item.ghiChuGarage ? escapeHtmlOutput(item.ghiChuGarage) : '<span style="color: var(--text-muted); font-style: italic;">Không có ghi chú</span>'}</div>
                    </td>
                    <td data-label="Thao tác" style="text-align: right; vertical-align: middle; padding-right: 20px;">
                      ${urls.length ? `
                        <button type="button" class="btn-premium btn-secondary" onclick="downloadCategoryImages(${index})" style="padding: 6px 12px; min-height: unset; height: 30px; font-size: 11px; margin: 0; display: inline-flex; align-items: center; gap: 5px; border-radius: 6px;">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                          <span>Tải về (${urls.length})</span>
                        </button>
                      ` : `
                        <span style="color: var(--text-muted); font-size: 12px;">—</span>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>` : '';

      rootContainer.innerHTML = `
        <div class="portal-shell">
          <header class="portal-topbar">
            <div>
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <button onclick="navigateHeaderTab('list')" style="display: inline-flex; align-items: center; gap: 6px; background: transparent; border: none; padding: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-soft); cursor: pointer; transition: color 0.2s ease;" onmouseover="this.style.color='var(--primary)';" onmouseout="this.style.color='var(--text-soft)';">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  Quay lại
                </button>
                <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--border-strong);"></div>
                <div class="eyebrow" style="margin-bottom: 0;">Verified comparison result</div>
              </div>
              <h1 style="margin-top: 0;">Kết quả đối chiếu Garage</h1>
              <p>Xem lại đầy đủ người tạo hồ sơ, nội dung Garage khai báo và ảnh minh chứng theo từng hạng mục.</p>
            </div>
            <div class="portal-counter-stack">
              ${(() => {
                const total = localActiveRequestedItems.length;
                const completed = completedEvidenceItems;
                const pending = total - completed;
                return `
                  <!-- Đã bổ sung ảnh -->
                  <div class="portal-counter" style="border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.04); text-align: right; min-width: 122px;">
                    <span style="color: rgba(16, 185, 129, 0.8); font-weight: 800; font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase;">Đã bổ sung ảnh</span>
                    <strong style="color: #10b981; display: block; margin-top: 3px;  font-size: 20px; letter-spacing: -.04em;">${String(completed).padStart(2,'0')}</strong>
                  </div>
                  
                  <!-- Chưa bổ sung ảnh -->
                  <div class="portal-counter" style="border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.04); text-align: right; min-width: 122px;">
                    <span style="color: rgba(239, 68, 68, 0.8); font-weight: 800; font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase;">Chưa có ảnh</span>
                    <strong style="color: #ef4444; display: block; margin-top: 3px;  font-size: 20px; letter-spacing: -.04em;">${String(pending).padStart(2,'0')}</strong>
                  </div>
                  
                  <!-- Tổng hạng mục -->
                  <div class="portal-counter" style="border: 1px solid rgba(216, 180, 109, 0.3); background: rgba(216, 180, 109, 0.04); text-align: right; min-width: 122px;">
                    <span style="color: rgba(216, 180, 109, 0.8); font-weight: 800; font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase;">Tổng hạng mục</span>
                    <strong style="color: #d8b46d; display: block; margin-top: 3px;  font-size: 20px; letter-spacing: -.04em;">${String(total).padStart(2,'0')}</strong>
                  </div>
                `;
              })()}
            </div>
          </header>
          <div class="focus-portal-layout">${buildHtmlComponentSidebarCaseMetadata(renderMode)}<div class="image-workspace-list">${imageResultsSection}${evidenceResultsSection}</div></div>
        </div>`;
      
      if (renderMode === 'result') updateAdjusterSummaryStats();
      initializeSidebarCollapse();
    }


    function compileRawTextSummaryReportBlock() {
      const node = localActiveCaseNode || {};
      const outputLinesBuffer = [];

      outputLinesBuffer.push('==================================================');
      outputLinesBuffer.push('   BIÊN BẢN TỔNG HỢP HẠNG MỤC PHƯƠNG TIỆN CƠ GIỚI   ');
      outputLinesBuffer.push('==================================================');
      outputLinesBuffer.push(`- Mã ca giám định:    ${node.idCa || ''}`);
      outputLinesBuffer.push(`- Biển kiểm soát xe:  ${node.bienSo || ''}`);
      outputLinesBuffer.push(`- Đơn vị sửa chữa:    ${node.tenGara || ''}`);
      outputLinesBuffer.push(`- Người tạo hồ sơ:    ${node.nguoiTao?.tenHienThi || node.nguoiTao?.email || 'Không ghi nhận'}`);
      outputLinesBuffer.push(`- Tình trạng dữ liệu: ${node.trangThai || ''}`);
      outputLinesBuffer.push('--------------------------------------------------\n');

      localActiveImageStack.forEach((item, index) => {
        outputLinesBuffer.push(`[VÙNG ẢNH KHAI BÁO SỐ ${index + 1}]`);
        outputLinesBuffer.push(`+ Chi tiết hạng mục bộ phận: \n${item.hangMucBaoGia || 'Không ghi nhận hạng mục.'}`);
        outputLinesBuffer.push(`+ URL ảnh chứng cứ gốc: ${item.linkAnh || ''}`);
        outputLinesBuffer.push('');
      });

      localActiveRequestedItems.forEach((item,index) => {
        outputLinesBuffer.push(`[HẠNG MỤC YÊU CẦU ẢNH SỐ ${index + 1}]`);
        outputLinesBuffer.push(`+ Tên hạng mục: ${item.tenHangMuc || ''}`);
        if (item.mucDoHuHong) outputLinesBuffer.push(`+ Mức độ hư hỏng: ${item.mucDoHuHong}`);
        if (item.phuongAnDeXuat) outputLinesBuffer.push(`+ Phương án Gara đề xuất: ${item.phuongAnDeXuat === 'sua_chua' ? 'Sửa chữa' : 'Thay thế'}`);
        if (item.ghiChuGarage) outputLinesBuffer.push(`+ Ghi chú Garage: ${item.ghiChuGarage}`);
        const decisionText = {
          'chua': 'Chưa phê duyệt',
          'thay_moi': 'Đồng ý thay mới',
          'sua_chua': 'Đồng ý sửa chữa',
          'tu_choi': 'Từ chối bồi thường'
        }[item.phuongAnDuyet || 'chua'];
        const amount = Number(item.soTienDuyet || 0).toLocaleString('vi-VN') + ' đ';
        outputLinesBuffer.push(`+ Phương án GĐV duyệt: ${decisionText}`);
        outputLinesBuffer.push(`+ Số tiền duyệt: ${amount}`);
        const urls = normalizeEvidenceImageUrls(item);
        if (urls.length) urls.forEach((url,imageIndex) => outputLinesBuffer.push(`+ Ảnh Garage ${imageIndex + 1}: ${url}`));
        else outputLinesBuffer.push('+ Ảnh Garage: Chưa cung cấp.');
        outputLinesBuffer.push('');
      });

      return outputLinesBuffer.join('\n');
    }


    function executeCopyAggregatedRawText() {
      executeTextCopyToClipboardRawString(compileRawTextSummaryReportBlock());
    }
