

    function switchOcrTab(tabType) {
      activeOcrTab = tabType;
      
      const imageBtn = document.getElementById('tabOcrImageBtn');
      const textBtn = document.getElementById('tabOcrTextBtn');
      const panelImage = document.getElementById('panelOcrImage');
      const panelText = document.getElementById('panelOcrText');
      
      if (imageBtn) imageBtn.classList.toggle('active', tabType === 'image');
      if (textBtn) textBtn.classList.toggle('active', tabType === 'text');
      
      if (panelImage) panelImage.style.display = tabType === 'image' ? 'block' : 'none';
      if (panelText) panelText.style.display = tabType === 'text' ? 'block' : 'none';
    }


    function convertFileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });
    }


    async function callGeminiOcrApi(base64Data, mimeType) {
      let apiKey = localStorage.getItem('claimvision-gemini-key') || CONFIG.FIREBASE.apiKey;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const payload = {
        contents: [{
          parts: [
            {
              text: "Bạn là một AI OCR chuyên nghiệp phân tích báo giá sửa chữa xe cơ giới của Việt Nam. Hãy đọc ảnh báo giá này và trích xuất thông tin thành cấu trúc JSON có định dạng sau:\n" +
                "{\n" +
                "  \"bienSo\": \"biển số xe nếu có trong ảnh (ví dụ: 30H-123.45), nếu không có để trống \\\"\\\"\",\n" +
                "  \"tenGara\": \"tên đơn vị sửa chữa/gara báo giá nếu có trong ảnh (ví dụ: Gara Tiên Phong), nếu không có để trống \\\"\\\"\",\n" +
                "  \"hangMuc\": [\n" +
                "     \"danh sách các tên hạng mục phụ tùng hoặc công việc sửa chữa cần khắc phục, mỗi phần tử là 1 chuỗi ngắn gọn, loại bỏ số thứ tự, đơn giá, VAT, tiền tệ\"\n" +
                "  ]\n" +
                "}\n" +
                "Lưu ý: Chỉ trả về duy nhất chuỗi JSON hợp lệ, không kèm theo lời giải thích hoặc định dạng markdown khác ngoài khối mã JSON."
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }]
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMessage = errJson?.error?.message || response.statusText;
        throw new Error(errMessage);
      }

      const resJson = await response.json();
      const textResult = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return textResult;
    }


    function toggleGeminiKeyVisibility() {
      const input = document.getElementById('txtSettingsGeminiKey');
      const icon = document.getElementById('geminiEyeIcon');
      if (!input || !icon) return;
      
      if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
      } else {
        input.type = 'password';
        icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
      }
    }


    function saveGeminiSettingsKey() {
      const input = document.getElementById('txtSettingsGeminiKey');
      if (!input) return;
      
      const val = String(input.value).trim();
      if (val) {
        localStorage.setItem('claimvision-gemini-key', val);
        triggerToast('Đã lưu cấu hình Gemini API Key của bạn thành công!', 'success');
      } else {
        localStorage.removeItem('claimvision-gemini-key');
        triggerToast('Đã xóa Gemini API Key riêng, hệ thống sẽ sử dụng API Key mặc định.', 'info');
      }
      
      // Update key status label if we are on create tab (e.g. if we switch back)
      renderRequestedItemsBuilder();
    }


    function loadGeminiSettingsKeyIntoUI() {
      const input = document.getElementById('txtSettingsGeminiKey');
      if (!input) return;
      input.value = localStorage.getItem('claimvision-gemini-key') || '';
    }


    async function handleOcrImageUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const dropzone = document.getElementById('ocrDropzone');
      const scanningView = document.getElementById('ocrScanningView');
      const previewImg = document.getElementById('ocrPreviewImg');
      
      if (previewImg) {
        if (file.type === 'application/pdf') {
          previewImg.style.display = 'none';
        } else {
          previewImg.style.display = 'block';
          previewImg.src = URL.createObjectURL(file);
        }
      }
      
      if (dropzone) dropzone.style.display = 'none';
      if (scanningView) scanningView.style.display = 'block';
      
      try {
        const base64Data = await convertFileToBase64(file);
        const ocrResponseText = await callGeminiOcrApi(base64Data, file.type);
        
        let ocrResultObj;
        let cleanText = ocrResponseText.trim();
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
        }
        try {
          ocrResultObj = JSON.parse(cleanText);
        } catch (e) {
          console.error("Failed to parse Gemini JSON:", e);
          ocrResultObj = {
            bienSo: "",
            tenGara: "",
            hangMuc: ocrResponseText.split('\n').map(line => line.replace(/^[\*\-\+\d\.\s\)]+/, '').trim()).filter(Boolean)
          };
        }
        
        const extracted = (Array.isArray(ocrResultObj.hangMuc) ? ocrResultObj.hangMuc : [])
          .map(line => {
            let clean = line.trim();
            clean = clean.replace(/^[\*\-\+\d\.\s\)]+/, '');
            return clean.trim();
          })
          .filter(line => line.length > 2);
          
        if (extracted.length === 0) {
          throw new Error("Không thể tìm thấy hạng mục phụ tùng nào trong văn bản phản hồi của AI.");
        }
        
        displayExtractedOcrItems(extracted);
        triggerToast(`AI OCR: Trích xuất thành công ${extracted.length} hạng mục từ ảnh báo giá!`, 'success');

        const extractedPlate = ocrResultObj.bienSo ? String(ocrResultObj.bienSo).trim() : '';
        const extractedGarage = ocrResultObj.tenGara ? String(ocrResultObj.tenGara).trim() : '';

        if (extractedPlate || extractedGarage) {
          const detailList = [];
          if (extractedPlate) detailList.push(`• Biển kiểm soát: <strong>${escapeHtmlOutput(extractedPlate)}</strong>`);
          if (extractedGarage) detailList.push(`• Garage phụ trách: <strong>${escapeHtmlOutput(extractedGarage)}</strong>`);
          
          const confirmMsg = `AI phát hiện các thông tin xe sau trên ảnh báo giá:<br/><br/>${detailList.join('<br/>')}<br/><br/>Bạn có muốn tự động áp dụng các thông tin này vào ô nhập liệu không?`;
          
          setTimeout(async () => {
            const confirmResult = await showConfirmModal('Phát hiện thông tin báo giá', confirmMsg, 'Áp dụng', 'Bỏ qua');
            if (confirmResult) {
              if (extractedPlate) {
                const inputPlate = document.getElementById('txtPlateNumber');
                if (inputPlate) inputPlate.value = extractedPlate;
              }
              if (extractedGarage) {
                const inputGarage = document.getElementById('txtGaragePartner');
                if (inputGarage) inputGarage.value = extractedGarage;
              }
              triggerToast('Đã tự động điền thông tin báo giá!', 'success');
            }
          }, 600);
        }
      } catch (error) {
        console.error('Gemini OCR API Error:', error);
        
        let apiKey = localStorage.getItem('claimvision-gemini-key') || '';
        let isFallback = !apiKey;
        let activeKeyToPrint = apiKey || CONFIG.FIREBASE.apiKey;
        
        let maskKey = activeKeyToPrint.length > 10 
          ? `${activeKeyToPrint.substring(0, 7)}...${activeKeyToPrint.substring(activeKeyToPrint.length - 5)}`
          : 'Không hợp lệ';
          
        let keySource = isFallback 
          ? 'Khóa mặc định hệ thống (Firebase Key - không dùng cho Gemini)' 
          : 'Khóa cá nhân bạn đã thiết lập';

        let friendlyMsg = 'Lỗi Gemini OCR: ' + error.message;
        if (error.message.includes('API key') || error.message.includes('API_KEY') || error.message.includes('Key') || error.message.includes('not valid') || error.message.includes('403')) {
          friendlyMsg = `Xác thực thất bại. Vui lòng kiểm tra lại API Key Gemini. \n- Nguồn khóa đang dùng: ${keySource} [${maskKey}]. \n- Chi tiết lỗi: ${error.message}`;
        }
        triggerToast(friendlyMsg, 'error');
        resetOcrScanPanel();
      }
    }


    function processTextToExtractItems() {
      const textarea = document.getElementById('txtOcrRawText');
      const text = String(textarea?.value || '').trim();
      if (!text) return triggerToast('Vui lòng nhập hoặc dán văn bản báo giá.', 'warning');
      
      const lines = text.split('\n');
      const extracted = [];
      
      lines.forEach(line => {
        let clean = line.trim();
        if (!clean) return;
        
        // Remove line numbers (e.g. 1., 2), dots, dashes
        clean = clean.replace(/^\d+[\.\-\s\)]+/, '');
        // Remove trailing prices (e.g. 1.200.000, 500k, 300,000 VND, đ, vnđ)
        clean = clean.replace(/[:\s\-=\+]*[\d\.,\s]+(k|đ|vnd|vnđ|đồng|d)?\s*$/i, '');
        // Clean remaining whitespace
        clean = clean.trim();
        
        // Skip header/footer keywords
        const lower = clean.toLowerCase();
        const blacklist = ['bảng báo giá', 'báo giá', 'gara', 'garage', 'tổng cộng', 'cộng tiền', 'thuế', 'vat', 'chưa bao gồm', 'hóa đơn', 'stt', 'tên hạng mục', 'đơn giá', 'thành tiền', 'thay mới', 'sửa chữa', 'sơn', 'nhân công'];
        
        // Only keep if it is long enough and not on blacklist
        if (clean.length > 2 && !blacklist.some(word => lower === word || lower.startsWith(word + ' '))) {
          clean = clean.charAt(0).toUpperCase() + clean.slice(1);
          extracted.push(clean);
        }
      });
      
      if (extracted.length === 0) {
        return triggerToast('Không thể tự động nhận diện hạng mục. Vui lòng kiểm tra lại văn bản.', 'warning');
      }
      
      displayExtractedOcrItems(extracted);
      triggerToast(`Đã trích xuất thành công ${extracted.length} hạng mục từ văn bản!`, 'success');
    }


    function normalizeVietnameseText(str) {
      if (!str) return '';
      let result = str.toLowerCase();
      result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
      result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
      result = result.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
      result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
      result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
      result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
      result = result.replace(/đ/g, 'd');
      result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      result = result.replace(/[^a-z0-9\s]/g, ' ');
      result = result.replace(/\s+/g, ' ').trim();
      return result;
    }


    function displayExtractedOcrItems(itemsArray) {
      ocrExtractedItemsList = itemsArray;
      
      const container = document.getElementById('ocrExtractedItemsContainer');
      const chipsFlow = document.getElementById('ocrItemsChipsFlow');
      
      if (!container || !chipsFlow) return;
      
      const categorized = {
        phuTung: [],
        son: [],
        nhanCong: []
      };
      
      itemsArray.forEach((item, idx) => {
        const lower = normalizeVietnameseText(item);
        
        const laborKeywords = ['cong thay', 'tien cong', 'thao lap', 'nhan cong', 'tien cong thay', 'cong go', 'go nhat', 'nan phuc hoi', 'thao go', 'kiem tra', 'cong kiem tra', 'tiencong', 'cong '];
        const paintKeywords = ['son ', ' son', 'sơn', 'danh bong', 'lam dong', 'go son', 'son phu', 'dong son', 'dong paint', 'son'];
        
        const entry = { item, idx };
        
        if (laborKeywords.some(kw => lower.includes(kw))) {
          categorized.nhanCong.push(entry);
        } else if (paintKeywords.some(kw => lower.includes(kw))) {
          categorized.son.push(entry);
        } else {
          categorized.phuTung.push(entry);
        }
      });
      
      chipsFlow.style.display = 'grid';
      chipsFlow.style.gridTemplateColumns = '1fr';
      chipsFlow.style.gap = '16px';
      
      const renderGroupHtml = (title, iconSvg, colorVar, groupList) => {
        if (groupList.length === 0) return '';
        return `
          <div class="ocr-category-group" style="margin-bottom: 20px; width: 100%;">
            <div style="border-left: 4px solid var(--primary); padding-left: 10px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--primary); display: flex; align-items: center; justify-content: center;">${iconSvg}</span>
              <strong style="font-size: 13px; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 850;">${title} (${groupList.length})</strong>
            </div>
            <div class="excel-grid-container" style="margin-top: 8px; background: var(--surface-soft);">
              <table class="excel-grid-table">
                <thead>
                  <tr>
                    <th style="width: 60px; text-align: center; padding: 10px 14px;">Chọn</th>
                    <th class="col-stt">STT</th>
                    <th>Tên phụ tùng trích xuất</th>
                  </tr>
                </thead>
                <tbody>
                  ${groupList.map((entry, index) => {
                    const serialNum = String(index + 1).padStart(2, '0');
                    const isAlreadyAdded = caseRequestedItemsDraft.some(item => 
                      item && String(item.tenHangMuc || '').trim().toLowerCase() === String(entry.item || '').trim().toLowerCase()
                    );
                    return `
                      <tr class="excel-grid-row" style="background: ${isAlreadyAdded ? 'rgba(0,0,0,0.03)' : 'transparent'};">
                        <td data-label="Chọn" style="text-align: center; padding: 10px 12px; vertical-align: middle;">
                          <input type="checkbox" class="ocr-item-checkbox" data-index="${entry.idx}" ${isAlreadyAdded ? '' : 'checked'} style="margin: 0; width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer;" />
                        </td>
                        <td data-label="STT" class="cell-stt" style="vertical-align: middle;">
                          ${serialNum}
                        </td>
                        <td data-label="Hạng mục" style="padding: 10px 12px; font-size: 13px; color: var(--text-main); font-weight: 600; text-align: left; line-height: 1.45; vertical-align: middle; ${isAlreadyAdded ? 'text-decoration: line-through; opacity: 0.55;' : ''}">
                          ${escapeHtmlOutput(entry.item)}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      };
      
      const partsIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
      const paintIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 11.5 21.5 11 21 11H12V2C12 1.5 11.5 1 11 1C5.47715 1 1 5.47715 1 11C1 16.5228 5.47715 22 12 22Z"></path></svg>`;
      const laborIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
      
      chipsFlow.innerHTML = `
        ${renderGroupHtml('Phụ tùng thay thế', partsIcon, 'var(--primary)', categorized.phuTung)}
        ${renderGroupHtml('Đồng & Sơn', paintIcon, 'var(--primary)', categorized.son)}
        ${renderGroupHtml('Nhân công & Khác', laborIcon, 'var(--primary)', categorized.nhanCong)}
      `;
      
      const scanningView = document.getElementById('ocrScanningView');
      if (scanningView) scanningView.style.display = 'none';
      
      container.style.display = 'block';
    }


    function selectAllOcrItems(selectVal) {
      document.querySelectorAll('.ocr-item-checkbox').forEach(cb => cb.checked = selectVal);
    }

    function toggleOcrPanelHeight() {
      ocrPanelExpanded = !ocrPanelExpanded;
      const chipsFlow = document.getElementById('ocrItemsChipsFlow');
      const expandText = document.getElementById('btnOcrExpandText');
      const expandIcon = document.getElementById('btnOcrExpandIcon');
      
      if (!chipsFlow || !expandText || !expandIcon) return;
      
      if (ocrPanelExpanded) {
        chipsFlow.style.maxHeight = '650px';
        expandText.textContent = 'Thu gọn';
        expandIcon.innerHTML = `<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"></path>`; // Minimize-2 SVG
      } else {
        chipsFlow.style.maxHeight = '300px';
        expandText.textContent = 'Mở rộng';
        expandIcon.innerHTML = `<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>`; // Maximize-2 SVG
      }
    }


    function applySelectedOcrItemsToComposer() {
      const selectedItems = [];
      const checkboxes = document.querySelectorAll('.ocr-item-checkbox');
      
      checkboxes.forEach(cb => {
        if (cb.checked) {
          const idx = parseInt(cb.dataset.index);
          if (ocrExtractedItemsList[idx]) {
            selectedItems.push({
              item: ocrExtractedItemsList[idx],
              cb: cb
            });
          }
        }
      });
      
      if (selectedItems.length === 0) {
        return triggerToast('Vui lòng chọn ít nhất một hạng mục để thêm.', 'warning');
      }
      
      selectedItems.forEach(entry => {
        const firstEmptyIndex = caseRequestedItemsDraft.findIndex(d => !d.tenHangMuc.trim());
        if (firstEmptyIndex > -1) {
          caseRequestedItemsDraft[firstEmptyIndex].tenHangMuc = entry.item;
        } else {
          caseRequestedItemsDraft.push({ id: generateUniqueReqId(), tenHangMuc: entry.item });
        }
        entry.cb.checked = false; // Uncheck added items
      });
      
      renderRequestedItemsBuilder();
      triggerToast(`Đã thêm ${selectedItems.length} hạng mục vào danh sách yêu cầu ảnh!`, 'success');
      // Keep panel active so user can re-select or verify items
    }


    function resetOcrScanPanel() {
      const fileInput = document.getElementById('fileOcrInput');
      if (fileInput) fileInput.value = '';
      
      const txtArea = document.getElementById('txtOcrRawText');
      if (txtArea) txtArea.value = '';
      
      const dropzone = document.getElementById('ocrDropzone');
      const scanningView = document.getElementById('ocrScanningView');
      const extractedContainer = document.getElementById('ocrExtractedItemsContainer');
      
      if (dropzone) dropzone.style.display = 'flex';
      if (scanningView) scanningView.style.display = 'none';
      if (extractedContainer) extractedContainer.style.display = 'none';
      
      ocrExtractedItemsList = [];
      
      // Reset height expand settings
      ocrPanelExpanded = false;
      const chipsFlow = document.getElementById('ocrItemsChipsFlow');
      const expandText = document.getElementById('btnOcrExpandText');
      const expandIcon = document.getElementById('btnOcrExpandIcon');
      if (chipsFlow) chipsFlow.style.maxHeight = '300px';
      if (expandText) expandText.textContent = 'Mở rộng';
      if (expandIcon) expandIcon.innerHTML = `<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>`;
    }
