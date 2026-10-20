
    function toggleSuggestionItem(itemName) {
      const firstEmptyIndex = caseRequestedItemsDraft.findIndex(item => !item.tenHangMuc.trim());
      const existingIndex = caseRequestedItemsDraft.findIndex(item => item.tenHangMuc.trim().toLowerCase() === itemName.trim().toLowerCase());
      
      if (existingIndex > -1) {
        caseRequestedItemsDraft.splice(existingIndex, 1);
        if (caseRequestedItemsDraft.length === 0) {
          caseRequestedItemsDraft.push({ id: generateUniqueReqId(), tenHangMuc: '' });
        }
      } else {
        if (firstEmptyIndex > -1) {
          caseRequestedItemsDraft[firstEmptyIndex].tenHangMuc = itemName;
        } else {
          caseRequestedItemsDraft.push({ id: generateUniqueReqId(), tenHangMuc: itemName });
        }
      }
      renderRequestedItemsBuilder();
    }


    function updateRequestedItemsCount() {
      const countNode = document.getElementById('lblRequestedItemsCount');
      if (countNode) countNode.textContent = `${String(caseRequestedItemsDraft.filter(item => item.tenHangMuc.trim()).length).padStart(2,'0')} hạng mục`;
    }


    function addExcelRowAtEnd() {
      caseRequestedItemsDraft.push({ id: generateUniqueReqId(), tenHangMuc: '' });
      renderRequestedItemsBuilder();
      setTimeout(() => {
        const lastInput = document.getElementById(`excelInput_${caseRequestedItemsDraft.length - 1}`);
        if (lastInput) {
          lastInput.focus();
          lastInput.select();
        }
      }, 10);
    }


    function clearAllExcelRows() {
      caseRequestedItemsDraft = [
        { id: generateUniqueReqId(), tenHangMuc: '' },
        { id: generateUniqueReqId(), tenHangMuc: '' },
        { id: generateUniqueReqId(), tenHangMuc: '' }
      ];
      renderRequestedItemsBuilder();
    }


    function handleExcelRowKeydown(event, index) {
      const input = event.target;
      if (event.key === 'Enter') {
        event.preventDefault();
        if (index === caseRequestedItemsDraft.length - 1) {
          caseRequestedItemsDraft.push({ id: generateUniqueReqId(), tenHangMuc: '' });
          renderRequestedItemsBuilder();
          setTimeout(() => {
            const nextInput = document.getElementById(`excelInput_${index + 1}`);
            if (nextInput) nextInput.focus();
          }, 10);
        } else {
          const nextInput = document.getElementById(`excelInput_${index + 1}`);
          if (nextInput) nextInput.focus();
        }
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (index < caseRequestedItemsDraft.length - 1) {
          const nextInput = document.getElementById(`excelInput_${index + 1}`);
          if (nextInput) nextInput.focus();
        } else if (input.value.trim()) {
          addExcelRowAtEnd();
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (index > 0) {
          const nextInput = document.getElementById(`excelInput_${index - 1}`);
          if (nextInput) nextInput.focus();
        }
      } else if (event.key === 'Backspace' && input.value === '' && caseRequestedItemsDraft.length > 1) {
        event.preventDefault();
        removeRequestedItemDraft(index);
      }
    }


    function handleExcelRowPaste(event, index) {
      const pasteData = (event.clipboardData || window.clipboardData).getData('text');
      if (!pasteData) return;
      const lines = pasteData.split(/\r?\n/).map(line => line.trim().replace(/^[-•\d.)\s]+/, '')).filter(Boolean);
      if (lines.length <= 1) return;
      
      event.preventDefault();
      caseRequestedItemsDraft[index].tenHangMuc = lines[0];
      
      const afterSlice = caseRequestedItemsDraft.slice(0, index + 1);
      const remainingSlice = caseRequestedItemsDraft.slice(index + 1);
      const pastedItems = lines.slice(1).map(line => ({ id: generateUniqueReqId(), tenHangMuc: line }));
      caseRequestedItemsDraft = [...afterSlice, ...pastedItems, ...remainingSlice];
      
      renderRequestedItemsBuilder();
      const lastPastedIndex = index + lines.length - 1;
      setTimeout(() => {
        const lastPastedInput = document.getElementById(`excelInput_${lastPastedIndex}`);
        if (lastPastedInput) lastPastedInput.focus();
      }, 10);
    }


    function renderRequestedItemsBuilder() {
      const listNode = document.getElementById('requestedItemsBuilderList');
      if (!listNode) return;
      renderSuggestionsSection();

      const hasCustomKey = !!localStorage.getItem('claimvision-gemini-key');
      const lblStatus = document.getElementById('lblOcrKeyStatus');
      if (lblStatus) {
        lblStatus.textContent = hasCustomKey ? 'Gemini API (Khóa cá nhân)' : 'Gemini API (Mặc định)';
        lblStatus.style.color = hasCustomKey ? 'var(--primary)' : 'var(--text-muted)';
      }
      
      if (caseRequestedItemsDraft.length === 0) {
        caseRequestedItemsDraft = [
          { id: generateUniqueReqId(), tenHangMuc: '' },
          { id: generateUniqueReqId(), tenHangMuc: '' },
          { id: generateUniqueReqId(), tenHangMuc: '' }
        ];
      }
      
      listNode.innerHTML = `
        <div class="excel-grid-container">
          <table class="excel-grid-table">
            <thead>
              <tr>
                <th class="col-stt">STT</th>
                <th class="col-name">Tên phụ tùng cần chụp ảnh minh chứng</th>
                <th class="col-category" style="width: 210px;">Phân loại hạng mục</th>
                <th class="col-action"></th>
              </tr>
            </thead>
            <tbody id="excelGridBody">
              ${caseRequestedItemsDraft.map((item, index) => {
                const catVal = item.phanLoai || (getCategoryGroupInfo(item.tenHangMuc).key || 'damages');
                return `
                <tr class="excel-grid-row" data-row-index="${index}">
                  <td class="cell-stt">${String(index + 1).padStart(2, '0')}</td>
                  <td class="cell-name">
                    <input 
                      id="excelInput_${index}" 
                      class="excel-grid-input" 
                      value="${escapeAttributeData(item.tenHangMuc)}" 
                      placeholder="Nhập tên phụ tùng (ví dụ: Cản trước, Đèn pha trái...)..."
                      oninput="updateRequestedItemDraft(${index}, this.value)"
                      onkeydown="handleExcelRowKeydown(event, ${index})"
                      onpaste="handleExcelRowPaste(event, ${index})"
                      autocomplete="off"
                    />
                  </td>
                  <td class="cell-category" style="padding: 4px 6px;">
                    ${(() => {
                      const catDef = EXCEL_CATEGORY_DEFS[catVal] || EXCEL_CATEGORY_DEFS.damages;
                      return `
                        <div id="excelCategoryWrap_${index}" class="excel-category-combobox-wrap" style="position: relative; width: 100%;">
                          <button 
                            type="button" 
                            id="excelCategoryBtn_${index}"
                            class="excel-category-trigger-btn"
                            onclick="toggleExcelCategoryDropdown(${index}, event)"
                            style="width: 100%; height: 36px; border-radius: 9px; border: 1px solid ${catDef.border}; background: ${catDef.bg}; color: ${catDef.color}; font-size: 12px; font-weight: 800; padding: 0 9px; display: inline-flex; align-items: center; justify-content: space-between; gap: 6px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(0,0,0,0.03);"
                          >
                            <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
                              <span class="cat-icon-slot" style="display: grid; place-items: center; flex-shrink: 0;">${catDef.svg}</span>
                              <span class="cat-label-slot" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; font-weight: 800;">${catDef.label}</span>
                              <span class="cat-code-slot" style="font-size: 9px; font-weight: 850;  padding: 1px 5px; border-radius: 4px; background: rgba(0,0,0,0.1); flex-shrink: 0;">${catDef.code}</span>
                            </div>
                            <svg id="excelCatArrow_${index}" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0; transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </button>
                        </div>
                      `;
                    })()}
                  </td>
                  <td class="cell-action">
                    <button type="button" class="excel-row-del-btn" onclick="removeRequestedItemDraft(${index})" title="Xóa dòng">&times;</button>
                  </td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
          <div class="excel-grid-footer">
            <button type="button" class="btn-premium btn-secondary btn-inline" onclick="addExcelRowAtEnd()">+ Thêm dòng mới (Enter)</button>
            <button type="button" class="btn-premium btn-secondary btn-inline danger" onclick="clearAllExcelRows()" style="border-color:var(--btn-danger-border); color:var(--btn-danger-text); background:transparent;">Xóa sạch bảng</button>
            <span class="excel-grid-tip">Mẹo: Nhấn Enter hoặc Mũi tên Xuống để thêm dòng. Có thể Ctrl+V dán hàng loạt từ Excel.</span>
          </div>
        </div>
      `;
      updateRequestedItemsCount();
    }


    function executeUIRenderCasesTable(casesPayload) {
      if (typeof casesPayload !== 'undefined') cachedCasesPayload = casesPayload;
      const tableBody = document.getElementById('tblCasesBodyContainer');
      if (!tableBody) return;
      
      const allCases = cachedCasesPayload || {};
      const allEntries = Object.entries(allCases).sort((a,b) => Number(b[1].createdAt || 0) - Number(a[1].createdAt || 0));
      
      updateStatsCounters(allCases);
      const searchQuery = String(document.getElementById('caseSearchInput')?.value || '').trim().toLocaleLowerCase('vi');
      let searchTerms = [];
      if (searchQuery) {
        const hasSeparator = /[,\n\t;]/.test(searchQuery);
        const spaceTerms = searchQuery.split(/\s+/).filter(Boolean);
        const isSpaceBatch = spaceTerms.length > 1 && spaceTerms.every(t => /\d/.test(t));
        
        if (hasSeparator) {
          searchTerms = searchQuery.split(/[,\n\t;]+/).map(t => t.trim()).filter(Boolean);
        } else if (isSpaceBatch) {
          searchTerms = spaceTerms.map(t => t.trim());
        } else {
          searchTerms = [searchQuery];
        }
      }
      const filteredEntries = allEntries.filter(([,item]) => {
        let matchesText = true;
        if (searchTerms.length > 0) {
           const combinedText = `${item.bienSo || ''} ${item.tenGara || ''} ${item.nguoiTao?.tenHienThi || ''} ${item.nguoiTao?.email || ''}`.toLocaleLowerCase('vi');
           matchesText = searchTerms.some(term => combinedText.includes(term));
        }
        const isDone = item.trangThai === STATUS_COMPLETED;
        const matchesStatus = activeCaseFilter === 'all' || (activeCaseFilter === 'completed' && isDone) || (activeCaseFilter === 'pending' && !isDone);
        return matchesText && matchesStatus;
      });
      
      const totalFiltered = filteredEntries.length;
      
      const lblFilter = document.getElementById('lblCaseFilterSelected');
      if (lblFilter) {
        lblFilter.innerHTML = activeCaseFilter === 'completed' ? `Hoàn tất (${totalFiltered})` : 
                              activeCaseFilter === 'pending' ? `Chờ nhập (${totalFiltered})` : 
                              `Tất cả (${totalFiltered})`;
      }
      
      const lblRange = document.getElementById('casePaginationRange');
      const lblTotal = document.getElementById('casePaginationTotal');
      const pageControls = document.getElementById('casePaginationControls');
      const lblPerPage = document.getElementById('lblCasePerPage');
      if (lblPerPage) lblPerPage.innerText = activeCasePerPage + '/trang';
      
      if (!totalFiltered) {
        if (lblRange) lblRange.innerText = '0–0';
        if (lblTotal) lblTotal.innerText = '0';
        if (pageControls) pageControls.innerHTML = '';
        tableBody.innerHTML = `<tr><td colspan="5"><div class="transfer-register-empty"><div class="inspection-empty-icon">${SVGS.SEARCH}</div><strong>Không tìm thấy hồ sơ phù hợp</strong><p>Thử thay đổi từ khóa hoặc bộ lọc trạng thái.</p></div></td></tr>`;
        return;
      }
      
      const totalPages = Math.ceil(totalFiltered / activeCasePerPage);
      if (activeCasePage > totalPages) activeCasePage = totalPages;
      if (activeCasePage < 1) activeCasePage = 1;
      
      const startIndex = (activeCasePage - 1) * activeCasePerPage;
      const endIndex = Math.min(startIndex + activeCasePerPage, totalFiltered);
      
      if (lblRange) lblRange.innerText = `${startIndex + 1}–${endIndex}`;
      if (lblTotal) lblTotal.innerText = totalFiltered;
      
      if(pageControls)pageControls.innerHTML=renderInspectionPages(activeCasePage,totalPages);

      const pagedEntries = filteredEntries.slice(startIndex, endIndex);
      
      tableBody.innerHTML=renderInspectionRows(pagedEntries);
    }


    function setCaseFilter(filterValue) {
      activeCaseFilter = filterValue;
      activeCasePage = 1;
      executeUIRenderCasesTable();
    }

    
    function setCasePage(page) {
      activeCasePage = page;
      executeUIRenderCasesTable();
    }

    
    function setCasePerPage(perPage) {
      activeCasePerPage = perPage;
      activeCasePage = 1;
      executeUIRenderCasesTable();
    }


    function formatCaseTimestamp(timestamp) {
      if (!timestamp) return { date: 'Chưa ghi nhận', time: '—' };
      const date = new Date(Number(timestamp));
      if (Number.isNaN(date.getTime())) return { date: 'Chưa ghi nhận', time: '—' };
      return {
        date: new Intl.DateTimeFormat('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }).format(date),
        time: new Intl.DateTimeFormat('vi-VN', { hour:'2-digit', minute:'2-digit' }).format(date)
      };
    }


    async function triggerDestructiveDeleteCase(caseKey, friendlyPlateName) {
      if (!hasUserPermission('list', 'delete')) {
        triggerToast('Bạn không có quyền xóa hồ sơ giám định.', 'error');
        return;
      }
      const confirmAction = await showConfirmModal('Xóa bỏ ca xe', `Hành động này sẽ xóa vĩnh viễn tài nguyên thuộc ca xe: ${friendlyPlateName}. Xác nhận hủy?`);
      if (confirmAction) {
        await dbNodeInstance.ref(`cases/${caseKey}`).remove();
        triggerToast('Hồ sơ ca giám định đã hủy bỏ thành công.', 'warning');
      }
    }


    function triggerEditCaseFlow(caseId) {
      if (!hasUserPermission('list', 'edit')) {
        triggerToast('Bạn không có quyền chỉnh sửa hồ sơ bồi thường.', 'warning');
        return;
      }
      console.log('triggerEditCaseFlow matching caseId:', caseId);
      
      let caseEntity = null;
      if (cachedCasesPayload) {
        // Direct key lookup
        caseEntity = cachedCasesPayload[caseId];
        
        // Fallback: search array/object entries by idCa
        if (!caseEntity) {
          caseEntity = Object.values(cachedCasesPayload).find(c => c && (c.idCa === caseId || c.id === caseId));
        }
      }
      
      if (!caseEntity) {
        console.error('Case details not resolved for ID:', caseId, cachedCasesPayload);
        return triggerToast('Không tìm thấy dữ liệu ca xe để chỉnh sửa.', 'error');
      }
      
      triggerToast('Đang tải dữ liệu hồ sơ chỉnh sửa...', 'info');
      
      editingCaseId = caseId;
      activeCreateFlowMode = 'excel'; 
      
      const itemsList = Array.isArray(caseEntity.hangMucYeuCauAnh) 
        ? caseEntity.hangMucYeuCauAnh 
        : Object.values(caseEntity.hangMucYeuCauAnh || {});
        
      caseRequestedItemsDraft = itemsList.map(item => ({
        id: item.id || generateUniqueReqId(),
        tenHangMuc: item.tenHangMuc || ''
      }));
      
      while (caseRequestedItemsDraft.length < 3) {
        caseRequestedItemsDraft.push({ id: generateUniqueReqId(), tenHangMuc: '' });
      }
      
      // Load and display saved OCR items list if they exist in database (handling both Array and Firebase Object formats)
      let savedOcrItems = caseEntity.ocrExtractedItems;
      if (savedOcrItems) {
        const ocrItemsArray = Array.isArray(savedOcrItems) ? savedOcrItems : Object.values(savedOcrItems);
        if (ocrItemsArray.length > 0) {
          displayExtractedOcrItems(ocrItemsArray);
        } else {
          resetOcrScanPanel();
        }
      } else {
        resetOcrScanPanel();
      }
      
      switchWorkspaceTab('create');
      
      setTimeout(() => {
        const plateInput = document.getElementById('txtPlateNumber');
        const garageInput = document.getElementById('txtGaragePartner');
        if (plateInput) plateInput.value = caseEntity.bienSo || '';
        if (garageInput) garageInput.value = caseEntity.tenGara || '';
      }, 50);
    }


    /****************************************************
     * PARALLEL ASYNC STREAM CORE PROCESSING UPLOADER
     ****************************************************/
    async function pipelineTriggerCaseCreationFlow() {
      const plateInputVal = document.getElementById('txtPlateNumber').value.trim();
      const garageInputVal = document.getElementById('txtGaragePartner').value.trim();
      const fileInputElement = document.getElementById('fileImageUploader');
      const imagesFileList = fileInputElement ? Array.from(fileInputElement.files || []) : [];
      const requestedItemNames = caseRequestedItemsDraft.map(item => String(item.tenHangMuc || '').trim()).filter(Boolean);

      if (!plateInputVal || !garageInputVal) {
        triggerToast('Vui lòng nhập biển số xe và Garage phụ trách.', 'error');
        return;
      }

      // Handle Case Editing
      if (editingCaseId) {
        if (!requestedItemNames.length) {
          triggerToast('Vui lòng nhập ít nhất một hạng mục phụ tùng cần yêu cầu ảnh.', 'error');
          return;
        }
        
        toggleUploadOverlay(true, 'Đang cập nhật hồ sơ...', 'Đồng bộ dữ liệu chỉnh sửa lên Cloud...', 40);
        
        try {
          const caseEntity = cachedCasesPayload && cachedCasesPayload[editingCaseId];
          const existingRequestedList = caseEntity && caseEntity.hangMucYeuCauAnh
            ? (Array.isArray(caseEntity.hangMucYeuCauAnh) ? caseEntity.hangMucYeuCauAnh : Object.values(caseEntity.hangMucYeuCauAnh))
            : [];
            
          const requestedEvidenceNodes = caseRequestedItemsDraft
            .filter(item => String(item.tenHangMuc || '').trim())
            .map((item, index) => {
              const itemName = item.tenHangMuc.trim();
              const catKey = item.phanLoai || getCategoryGroupInfo(itemName).key || 'damages';
              const existingItem = existingRequestedList.find(ex => ex.tenHangMuc === itemName);
              return {
                tenHangMuc: itemName,
                phanLoai: catKey,
                thuTu: index + 1,
                hinhAnhGarage: existingItem ? (existingItem.hinhAnhGarage || []) : []
              };
            });

          // Re-evaluate completed status
          const totalReq = requestedEvidenceNodes.length;
          const completedReq = requestedEvidenceNodes.filter(item => normalizeEvidenceImageUrls(item).length > 0).length;
          const isCaseDone = totalReq > 0 && completedReq === totalReq;
          const newStatus = isCaseDone ? STATUS_COMPLETED : STATUS_PENDING;

          let existingOcrItems = caseEntity && caseEntity.ocrExtractedItems ? caseEntity.ocrExtractedItems : [];
          if (existingOcrItems && !Array.isArray(existingOcrItems)) {
            existingOcrItems = Object.values(existingOcrItems);
          }
          const currentOcrItems = ocrExtractedItemsList && ocrExtractedItemsList.length ? ocrExtractedItemsList : existingOcrItems;

          const updatePayload = {
            bienSo: plateInputVal,
            tenGara: garageInputVal,
            hangMucYeuCauAnh: requestedEvidenceNodes,
            ocrExtractedItems: currentOcrItems,
            trangThai: newStatus
          };

          await dbNodeInstance.ref(`cases/${editingCaseId}`).update(updatePayload);
          triggerToast('Đã cập nhật thông tin hồ sơ giám định thành công!', 'success');
          
          resetCaseCreationForm();
          switchWorkspaceTab('list');
        } catch (exception) {
          console.error(exception);
          triggerToast('Lỗi cập nhật hồ sơ: ' + exception.message, 'error');
        } finally {
          toggleUploadOverlay(false);
        }
        return;
      }
      
      if (activeCreateFlowMode === 'image' && !imagesFileList.length) {
        triggerToast('Vui lòng tải lên ít nhất một ảnh hiện trường.', 'error');
        return;
      }
      if ((activeCreateFlowMode === 'excel' || activeCreateFlowMode === 'combined') && !requestedItemNames.length) {
        triggerToast('Vui lòng nhập ít nhất một hạng mục phụ tùng cần yêu cầu ảnh.', 'error');
        return;
      }


      toggleUploadOverlay(true, imagesFileList.length ? 'Đang mã hóa dữ liệu hình ảnh...' : 'Đang khởi tạo yêu cầu...', 'Chuẩn bị cấu trúc hồ sơ đối chiếu hai chiều...', 0);

      try {
        const secureHostedImageUrlsArray = imagesFileList.length ? await executionParallelImagesUploadCore(imagesFileList) : [];
        
        toggleUploadOverlay(true, 'Khởi tạo thực thể cấu trúc...', 'Đồng bộ trường dữ liệu sang máy chủ đám mây...', 95);

        const generatedCaseUniqueToken = 'CASE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5).toUpperCase();
        const mappedImageNodeObjects = secureHostedImageUrlsArray.map(secureUrl => ({
          linkAnh: secureUrl,
          hangMucBaoGia: ""
        }));

        const currentUser = firebase.auth().currentUser;
        const currentProfile = getAuthenticatedUserPresentation(currentUser);
        const requestedEvidenceNodes = caseRequestedItemsDraft
          .filter(item => String(item.tenHangMuc || '').trim())
          .map((item, index) => {
            const itemName = item.tenHangMuc.trim();
            const catKey = item.phanLoai || getCategoryGroupInfo(itemName).key || 'damages';
            return {
              tenHangMuc: itemName,
              phanLoai: catKey,
              thuTu: index + 1,
              hinhAnhGarage: []
            };
          });
        const finalPayloadStructure = {
          idCa: generatedCaseUniqueToken,
          bienSo: plateInputVal,
          tenGara: garageInputVal,
          trangThai: STATUS_PENDING,
          soLuongAnh: mappedImageNodeObjects.length,
          soLuongHangMucYeuCauAnh: requestedEvidenceNodes.length,
          hinhAnh: mappedImageNodeObjects,
          hangMucYeuCauAnh: requestedEvidenceNodes,
          ocrExtractedItems: ocrExtractedItemsList || [],
          nguoiTao: {
            uid: currentUser?.uid || '',
            email: currentProfile.email,
            tenHienThi: currentProfile.displayName,
            chucDanh: currentProfile.role,
            donVi: currentProfile.department
          },
          createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        await dbNodeInstance.ref(`cases/${generatedCaseUniqueToken}`).set(finalPayloadStructure);
        logUserActivity('CREATE_CASE', `Khởi tạo thành công hồ sơ mới xe BKS: ${plateInputVal} (Garage: ${garageInputVal})`, { bienSo: plateInputVal, idCa: generatedCaseUniqueToken });
        triggerToast('Dữ liệu nghiệp vụ ca xe đã được đẩy lên Cloud.');

        renderInlineCreationSuccessPanel(finalPayloadStructure);

        resetCaseCreationForm();

        setTimeout(() => {
          switchWorkspaceTab('list');
        }, 3200);

      } catch (exception) {
        console.error(exception);
        triggerToast(exception.message || 'Lỗi truyền tải đa luồng.', 'error');
      } finally {
        toggleUploadOverlay(false); 
      }
    }


    async function executionParallelImagesUploadCore(filesArray) {
      let resolvedCounter = 0;
      const totalFilesCount = filesArray.length;

      const parallelPromisesPool = filesArray.map(async (fileItem) => {
        try {
          const cloudSecureUrl = await uploadSingleImageToCloudinaryEngine(fileItem);
          resolvedCounter++;
          
          const accumulatedPercentage = Math.round((resolvedCounter / totalFilesCount) * 100);
          toggleUploadOverlay(true, `Đang xử lý gói ảnh dữ liệu (${resolvedCounter}/${totalFilesCount})`, `Luồng truyền tải song song ổn định: ${accumulatedPercentage}%`, accumulatedPercentage);
          
          return cloudSecureUrl;
        } catch (error) {
          throw new Error(`Lỗi tệp [${fileItem.name}]: ${error.message}`);
        }
      });

      return await Promise.all(parallelPromisesPool);
    }


    async function uploadSingleImageToCloudinaryEngine(fileBlob) {
      const cConfig = getCloudinaryConfig();
      const targetApiEndpointUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cConfig.cloudName)}/image/upload`;
      const multiPartFormData = new FormData();
      multiPartFormData.append('file', fileBlob);
      multiPartFormData.append('upload_preset', cConfig.preset);
      if (cConfig.folder) {
        multiPartFormData.append('folder', cConfig.folder);
      }

      const networkResponse = await fetch(targetApiEndpointUrl, { method: 'POST', body: multiPartFormData });
      const parsedTextResponse = await networkResponse.text();
      
      let convertedJSONData;
      try { convertedJSONData = JSON.parse(parsedTextResponse); } catch(err) { throw new Error('Phản hồi Server lỗi.'); }

      if (!networkResponse.ok || !convertedJSONData.secure_url) {
        throw new Error(convertedJSONData?.error?.message || 'Lỗi API Cloudinary.');
      }
      return convertedJSONData.secure_url;
    }


    function toggleUploadOverlay(show, title = '', subtitle = '', percent = 0) {
      const overlay = document.getElementById('uploadOverlay');
      const tEl = document.getElementById('uploadOverlayTitle');
      const sEl = document.getElementById('uploadOverlaySubtitle');
      const bar = document.getElementById('uploadOverlayProgressFill');
      if (!overlay) return;

      if (show) {
        overlay.style.display = 'grid';
        if (title) tEl.textContent = title;
        if (subtitle) sEl.textContent = subtitle;
        if (bar) bar.style.width = `${percent}%`;
      } else {
        overlay.style.display = 'none';
      }
    }


    function renderInlineCreationSuccessPanel(dataPayload) {
      const outputCardBox = document.getElementById('panelOutputResultAnchor');
      outputCardBox.style.display = 'block';
      const shareLinkGara = `${getCleanOriginBaseUrl()}?idCa=${dataPayload.idCa}`;
      const shareLinkView = `${getCleanOriginBaseUrl()}?idCa=${dataPayload.idCa}&view=result`;
      outputCardBox.innerHTML = `
        <div class="success-heading">
          <div class="success-check">${SVGS.CHECK_CIRCLE}</div>
          <div><h2>Hồ sơ đã được khởi tạo thành công</h2><p>Mã định danh: <strong style="color:var(--primary);">${escapeHtmlOutput(dataPayload.idCa)}</strong></p></div>
        </div>
        <div class="p-share-container">
          <div class="p-share-row"><div class="p-share-meta"><div class="p-share-label">Liên kết dành cho Garage nhập hạng mục và tải ảnh</div><div class="p-share-url-preview">${escapeHtmlOutput(shareLinkGara)}</div></div><div class="p-share-actions"><button class="btn-premium btn-share-action" onclick="executeTextCopyToClipboardRawString('${escapeAttributeData(shareLinkGara)}')">${SVGS.COPY} Sao chép</button><button class="btn-premium btn-secondary btn-share-action" onclick="window.open('${escapeAttributeData(shareLinkGara)}','_blank')">${SVGS.EXTERNAL} Mở link</button></div></div>
          <div class="p-share-row"><div class="p-share-meta"><div class="p-share-label">Liên kết Giám định viên xem kết quả</div><div class="p-share-url-preview">${escapeHtmlOutput(shareLinkView)}</div></div><div class="p-share-actions"><button class="btn-premium btn-dark btn-share-action" onclick="executeTextCopyToClipboardRawString('${escapeAttributeData(shareLinkView)}')">${SVGS.COPY} Sao chép</button><button class="btn-premium btn-secondary btn-share-action" onclick="window.open('${escapeAttributeData(shareLinkView)}','_blank')">${SVGS.EXTERNAL} Đối chiếu</button></div></div>
        </div>`;
      outputCardBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
