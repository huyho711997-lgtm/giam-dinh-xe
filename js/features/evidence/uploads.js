

    // Note: openMobileCameraForEvidence is declared above with automatic mobile/desktop routing

    function normalizeEvidenceImageUrls(item) {
      const rawValue = item?.hinhAnhGarage ?? item?.linkAnhGarage ?? [];
      if (Array.isArray(rawValue)) return rawValue.filter(Boolean);
      if (rawValue && typeof rawValue === 'object') return Object.values(rawValue).filter(Boolean);
      return rawValue ? [rawValue] : [];
    }


    function validateGarageEvidenceFiles(files, existingCount = 0) {
      const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
      const valid = [];
      const rejected = [];
      files.forEach(file => {
        if (!allowed.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|heic|heif)$/i)) rejected.push(`${file.name}: sai định dạng`);
        else if (file.size > 20 * 1024 * 1024) rejected.push(`${file.name}: vượt 20MB`);
        else valid.push(file);
      });
      const remaining = Math.max(0, 12 - existingCount);
      if (valid.length > remaining) {
        valid.splice(remaining).forEach(file => rejected.push(`${file.name}: vượt giới hạn 12 ảnh`));
      }
      return { valid, rejected };
    }


        async function prepareImageFileForUpload(file) {
      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return file;
      const MAX_DIMENSION = 1280;
      try {
        const bitmap = await createImageBitmap(file);
        let width = bitmap.width;
        let height = bitmap.height;
        
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        if (!blob) return file;
        const metadata=cameraPhotoMetadata.get(file);
        const prepared=new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:metadata?.capturedAt||file.lastModified});
        if(metadata)cameraPhotoMetadata.set(prepared,metadata);
        return prepared;
      } catch (_) {
        return file;
      }
    }


    function setEvidenceUploadUI(index, show, text = '', percent = 0) {
      const card = document.getElementById(`evidenceRequestCard_${index}`);
      const statusNode = document.getElementById(`evidenceStatus_${index}`);
      if (card) card.classList.toggle('is-uploading', show);
      
      if (!statusNode) return;
      
      if (show) {
        statusNode.className = 'evidence-request-status badge-status uploading';
        
        let compactText = text;
        if (text.includes('xử lý') || text.includes('x\u1eed l\u00fd')) {
          compactText = 'Đang xử lý';
        } else if (text.includes('đóng dấu') || text.includes('\u0111\u00f3ng d\u1ea5u')) {
          compactText = 'Đóng dấu';
        } else if (text.includes('Chuẩn bị') || text.includes('Chu\u1ea3n b\u1ecb')) {
          compactText = 'Chuẩn bị';
        } else if (text.includes('tải ảnh') || text.includes('t\u1ea3i \u1ea3nh')) {
          const match = text.match(/\d+\/\d+/);
          compactText = match ? `Tải ảnh ${match[0]}` : 'Tải ảnh';
        } else if (text.includes('Đã lưu') || text.includes('\u0110\u00e3 l\u01b0u')) {
          compactText = 'Đã lưu';
        }
        
        statusNode.textContent = `${compactText} ${Math.max(0, Math.min(100, percent))}%`;
      } else {
        const item = localActiveRequestedItems[index];
        const urls = normalizeEvidenceImageUrls(item);
        statusNode.className = `evidence-request-status badge-status ${urls.length ? 'completed' : 'pending'}`;
        statusNode.textContent = urls.length ? `${urls.length} ảnh đã lưu` : 'Chưa có ảnh';
      }
    }


    async function handleGarageEvidenceFiles(requestIndex, incomingFiles, isFromCamera = false) {
      if (!localActiveRequestedItems[requestIndex] || !incomingFiles.length) return;

      const fileInput = document.getElementById(`garageEvidenceInput_${requestIndex}`);
      const isCameraSource = isFromCamera || (fileInput && fileInput.dataset.sourceType === 'camera');
      if (fileInput) delete fileInput.dataset.sourceType;

      if (localActiveRequestedItems[requestIndex]?.taoBoiGara && !isCameraSource) {
        triggerToast('Hạng mục này do Gara khởi tạo bắt buộc phải chụp trực tiếp từ Camera.', 'error');
        setEvidenceUploadUI(requestIndex, false);
        return;
      }

      const categoryName = localActiveRequestedItems[requestIndex].tenHangMuc || `H\u1ea1ng m\u1ee5c ${requestIndex + 1}`;
      setEvidenceUploadUI(requestIndex, true, `\u0110ang x\u1eed l\u00fd ${incomingFiles.length} \u1ea3nh`, 5);

      setEvidenceUploadUI(requestIndex, true, 'Đang đóng dấu ngày giờ & toạ độ...', 10);
      const processedFiles = await Promise.all(
        incomingFiles.map(file => addWatermarkToImageFile(file, categoryName,{isCameraSource}))
      );

      const currentUrls = normalizeEvidenceImageUrls(localActiveRequestedItems[requestIndex]);
      const { valid, rejected } = validateGarageEvidenceFiles(processedFiles, currentUrls.length);
      if (rejected.length) triggerToast(rejected[0], 'warning');
      if (!valid.length) {
        setEvidenceUploadUI(requestIndex, false);
        return;
      }
      
      garageUploadsInFlight += 1;
      setEvidenceUploadUI(requestIndex, true, `Chu\u1ea3n b\u1ecb t\u1ea3i l\u00ean...`, 20);
      try {
        let completedCount = 0;
        const uploadPromises = valid.map(async (file) => {
          const prepared = await prepareImageFileForUpload(file);
          const url = await uploadSingleImageToCloudinaryEngine(prepared);
          completedCount++;
          const progress = Math.round((completedCount / valid.length) * 70) + 20;
          setEvidenceUploadUI(requestIndex, true, `\u0110ang t\u1ea3i \u1ea3nh ${completedCount}/${valid.length}`, progress);
          return url;
        });
        
        const newUrls = await Promise.all(uploadPromises);
        
        localActiveRequestedItems[requestIndex].hinhAnhGarage = [...currentUrls, ...newUrls];
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh`).set(localActiveRequestedItems);
        setEvidenceUploadUI(requestIndex, true, `\u0110\u00e3 l\u01b0u`, 100);
        refreshSingleEvidenceCard(requestIndex);
        refreshGarageProgressUI();
        triggerToast(`\u0110\u00e3 l\u01b0u ${newUrls.length} \u1ea3nh cho h\u1ea1ng m\u1ee5c \u201c${categoryName}\u201d.`);
      } catch (error) {
        console.error(error);
        triggerToast('L\u1ed7i: ' + error.message, 'error');
      } finally {
        garageUploadsInFlight = Math.max(0, garageUploadsInFlight - 1);
        const input = document.getElementById(`garageEvidenceInput_${requestIndex}`);
        if (input) input.value = '';
        setTimeout(() => setEvidenceUploadUI(requestIndex, false), 800);
      }
    }


    async function removeGarageEvidenceImage(requestIndex, imageIndex) {
      const item = localActiveRequestedItems[requestIndex];
      if (!item) return;
      const urls = normalizeEvidenceImageUrls(item);
      if (!urls[imageIndex]) return;
      const confirmed = await showConfirmModal('Xóa ảnh minh chứng', `Xóa ảnh số ${imageIndex+1} khỏi hạng mục “${item.tenHangMuc}”?`);
      if (!confirmed) return;
      urls.splice(imageIndex,1);
      item.hinhAnhGarage = urls;
      try {
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh`).set(localActiveRequestedItems);
        refreshSingleEvidenceCard(requestIndex);
        refreshGarageProgressUI();
        triggerToast('Đã xóa ảnh khỏi hồ sơ.', 'warning');
      } catch (error) { triggerToast('Không thể xóa ảnh: ' + error.message, 'error'); }
    }


    function refreshSingleEvidenceCard(index) {
      const item = localActiveRequestedItems[index];
      if (!item) return;
      const urls = normalizeEvidenceImageUrls(item);
      const preview = document.getElementById(`garageEvidencePreview_${index}`);
      const count = document.getElementById(`evidenceCount_${index}`);
      const status = document.getElementById(`evidenceStatus_${index}`);
      const card = document.getElementById(`evidenceRequestCard_${index}`);
      const container = document.getElementById(`evidenceGalleryContainer_${index}`);
      if (preview) preview.innerHTML = renderEvidenceGalleryMarkup(item,index);
      if (count) count.textContent = `${urls.length} ảnh`;
      if (status) { status.className = `evidence-request-status badge-status ${urls.length ? 'completed' : 'pending'}`; status.textContent = urls.length ? `${urls.length} ảnh đã lưu` : 'Chưa có ảnh'; }
      if (card) card.classList.toggle('is-complete', Boolean(urls.length));
      if (container) container.style.display = urls.length ? 'block' : 'none';

      const pickerGrid = document.getElementById(`appraisalPickerGrid_${index}`);
      if (pickerGrid) {
        pickerGrid.innerHTML = renderAppraisalPickerHtml(index);
      }
    }


    function refreshAllEvidenceCardsFromState() {
      localActiveRequestedItems.forEach((_,index) => refreshSingleEvidenceCard(index));
      refreshAppraisalPoolMapLabels();
    }


    function renderAppraisalPickerHtml(itemIndex) {
      const item = localActiveRequestedItems[itemIndex];
      if (!item || !localActiveImageStack.length) return '';
      const urls = normalizeEvidenceImageUrls(item);
      return localActiveImageStack.map((imgItem, imgIdx) => {
        const isSelected = urls.includes(imgItem.linkAnh);
        return `
          <div style="position: relative; height: 68px; aspect-ratio: 4/3; cursor: pointer; border-radius: 8px; overflow: hidden; border: 2.5px solid ${isSelected ? 'var(--primary)' : 'transparent'}; flex-shrink: 0; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);" onclick="toggleMapImageFromPool(${itemIndex}, ${imgIdx}, event)" class="appraisal-picker-item">
            <img src="${escapeAttributeData(imgItem.linkAnh)}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.25s ease;" />
            ${isSelected ? `
              <div style="position: absolute; inset: 0; background: rgba(8,11,17,0.3); backdrop-filter: blur(1.5px); display: grid; place-items: center; color: #fff;">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary); display: grid; place-items: center; box-shadow: 0 4px 10px rgba(216,180,109,0.4);">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#080b11" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              </div>
            ` : ''}
            <div style="position: absolute; left: 4px; bottom: 4px; background: rgba(8,11,17,0.75); border: 1px solid rgba(255,255,255,0.15); color: #fff;  font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 3px;">${imgIdx + 1}</div>
          </div>
        `;
      }).join('');
    }


    function refreshAppraisalPoolMapLabels() {
      if (!localActiveImageStack.length || !localActiveRequestedItems.length) return;
      localActiveImageStack.forEach((item, imgIdx) => {
        const mappedItems = [];
        localActiveRequestedItems.forEach((reqItem, reqIdx) => {
          const urls = normalizeEvidenceImageUrls(reqItem);
          if (urls.includes(item.linkAnh)) {
            mappedItems.push(reqItem.tenHangMuc || `Hạng mục ${reqIdx + 1}`);
          }
        });
        const labelContainer = document.getElementById(`imageMapLabel_${imgIdx}`);
        if (labelContainer) {
          const isMapped = mappedItems.length > 0;
          labelContainer.innerHTML = isMapped 
            ? `<span style="background: rgba(16,185,129,0.15); color: #10b981; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px;">Đã khớp: ${escapeHtmlOutput(mappedItems.join(', '))}</span>`
            : `<span style="background: var(--surface-soft); color: var(--text-muted); font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">Chưa phân loại</span>`;
        }
      });
    }


    function toggleAppraisalPicker(index, event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const picker = document.getElementById(`appraisalPicker_${index}`);
      if (!picker) return;
      const isHidden = picker.style.display === 'none';
      picker.style.display = isHidden ? 'block' : 'none';
    }


    async function toggleMapImageFromPool(itemIndex, imgIndex, event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const item = localActiveRequestedItems[itemIndex];
      const imgItem = localActiveImageStack[imgIndex];
      if (!item || !imgItem) return;

      const urls = normalizeEvidenceImageUrls(item);
      let newUrls = [];
      if (urls.includes(imgItem.linkAnh)) {
        newUrls = urls.filter(u => u !== imgItem.linkAnh);
      } else {
        newUrls = [...urls, imgItem.linkAnh];
      }

      item.hinhAnhGarage = newUrls;
      try {
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh`).set(localActiveRequestedItems);
        triggerToast('Đã cập nhật liên kết ảnh giám định thành công!', 'success');
      } catch (error) {
        triggerToast('Lỗi liên kết ảnh: ' + error.message, 'error');
      }
    }


    function scheduleGarageImageNoteAutosave(index, value) {
      if (!localActiveImageStack[index]) return;
      localActiveImageStack[index].hangMucBaoGia = value;
      const key = `image_${index}`;
      const state = document.getElementById(`garageNoteSaveState_${index}`);
      if (state) { state.className = 'autosave-state saving'; state.textContent = 'Đang chờ tự động lưu...'; }
      clearTimeout(garageAutosaveTimers.get(key));
      garageAutosaveTimers.set(key, setTimeout(async () => {
        try {
          await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hinhAnh`).set(localActiveImageStack);
          if (state) { state.className = 'autosave-state'; state.textContent = 'Đã tự động lưu'; }
        } catch (error) {
          if (state) { state.className = 'autosave-state error'; state.textContent = 'Lưu thất bại'; }
        }
      }, 700));
    }


    function scheduleGarageEvidenceNoteAutosave(index, value) {
      if (!localActiveRequestedItems[index]) return;
      localActiveRequestedItems[index].ghiChuGarage = value;
      const key = `evidence_${index}`;
      const state = document.getElementById(`garageEvidenceNoteState_${index}`);
      if (state) { state.className = 'autosave-state saving'; state.textContent = 'Đang chờ tự động lưu...'; }
      clearTimeout(garageAutosaveTimers.get(key));
      garageAutosaveTimers.set(key, setTimeout(async () => {
        try {
          await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh`).set(localActiveRequestedItems);
          if (state) { state.className = 'autosave-state'; state.textContent = 'Ghi chú đã được lưu'; }
        } catch (error) {
          if (state) { state.className = 'autosave-state error'; state.textContent = 'Lưu ghi chú thất bại'; }
        }
      }, 700));
    }


    function refreshGarageProgressUI() {
      const noteTotal = localActiveImageStack.length || localActiveRequestedItems.length;
      const evidenceTotal = localActiveRequestedItems.length;

      const noteDone = localActiveImageStack.length
        ? (Array.from(document.querySelectorAll('.garage-quote-textarea-node')).length
            ? Array.from(document.querySelectorAll('.garage-quote-textarea-node')).filter(node => node.value.trim()).length
            : localActiveImageStack.filter(item => String(item.hangMucBaoGia || '').trim()).length)
        : localActiveRequestedItems.filter(item => item.tenHangMuc && String(item.tenHangMuc).trim()).length;

      const evidenceDone = localActiveRequestedItems.filter(item => normalizeEvidenceImageUrls(item).length).length;
      const total = (localActiveImageStack.length ? noteTotal : 0) + evidenceTotal;
      const done = (localActiveImageStack.length ? noteDone : 0) + evidenceDone;
      const percent = total ? Math.round((done / total) * 100) : 100;

      const noteCounter = document.getElementById('garageHeaderNoteCounter');
      const evidenceCounter = document.getElementById('garageHeaderEvidenceCounter');
      const caption = document.getElementById('garageProgressCaption');
      const percentNode = document.getElementById('garageProgressPercent');
      const fill = document.getElementById('garageProgressFill');

      if (noteCounter) noteCounter.textContent = `${String(noteDone).padStart(2,'0')}/${String(noteTotal).padStart(2,'0')}`;
      if (evidenceCounter) evidenceCounter.textContent = `${String(evidenceDone).padStart(2,'0')}/${String(evidenceTotal).padStart(2,'0')}`;
      if (caption) caption.textContent = `${done}/${total} nội dung bắt buộc đã hoàn thành`;
      if (percentNode) percentNode.textContent = `${percent}%`;
      if (fill) fill.style.width = `${percent}%`;
      const mobilePercentNode = document.getElementById('mobileBottomBarProgressPercent');
      if (mobilePercentNode) mobilePercentNode.textContent = `${percent}%`;
      const mobileCountNode = document.getElementById('mobileBottomBarProgressCount');
      if (mobileCountNode) mobileCountNode.textContent = `${evidenceDone}/${evidenceTotal}`;
      if (typeof syncWorkshopFilterChips === 'function') syncWorkshopFilterChips();
      syncWorkshopDisclosures();
    }


    function initializeSidebarCollapse() {
      const sidebar = document.querySelector('.sticky-sidebar');
      if (sidebar) {
        if (window.innerWidth <= 990) {
          sidebar.classList.add('collapsed');
        }
        const head = sidebar.querySelector('.p-card-head');
        if (head) {
          head.addEventListener('click', () => {
            if (window.innerWidth <= 990) {
              sidebar.classList.toggle('collapsed');
            }
          });
        }
      }
    }


    async function flushGarageAutosaves() {
      garageAutosaveTimers.forEach(timer => clearTimeout(timer));
      garageAutosaveTimers.clear();
      document.querySelectorAll('.garage-quote-textarea-node').forEach(node => {
        const index = Number(node.dataset.indexToken);
        if (localActiveImageStack[index]) localActiveImageStack[index].hangMucBaoGia = node.value.trim();
      });
      document.querySelectorAll('.evidence-note').forEach(node => {
        const index = Number(node.id.split('_').pop());
        if (localActiveRequestedItems[index]) localActiveRequestedItems[index].ghiChuGarage = node.value.trim();
      });
      await Promise.all([
        dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hinhAnh`).set(localActiveImageStack),
        dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}/hangMucYeuCauAnh`).set(localActiveRequestedItems)
      ]);
    }


    async function triggerManualGarageDraftSave() {
      try {
        if (garageUploadsInFlight > 0) {
          triggerToast('Có tệp ảnh đang tải lên. Vui lòng đợi ảnh tải xong rồi lưu nháp.', 'warning');
          return;
        }
        triggerToast('Đang tiến hành lưu nháp hồ sơ...', 'info');
        await flushGarageAutosaves();
        triggerToast('Đã lưu nháp hồ sơ thành công!', 'success');
      } catch (err) {
        console.error('Lưu nháp thất bại:', err);
        triggerToast('Lỗi hệ thống: Không thể lưu nháp hồ sơ.', 'error');
      }
    }


    async function pipelineTriggerGarageDataLockSubmission() {
      if (garageUploadsInFlight > 0) return triggerToast('Ảnh đang được tải lên. Vui lòng đợi tiến trình hiện tại hoàn tất.', 'warning');
      const DOMTextareaElements = Array.from(document.querySelectorAll('.garage-quote-textarea-node'));
      const emptyFieldsCounter = DOMTextareaElements.filter(tx => !tx.value.trim()).length;
      if (emptyFieldsCounter > 0) {
        const firstEmpty = DOMTextareaElements.find(tx => !tx.value.trim());
        firstEmpty?.scrollIntoView({ behavior:'smooth', block:'center' });
        triggerToast(`Còn ${emptyFieldsCounter} ảnh hiện trạng chưa được nhập tên hạng mục.`, 'error');
        return;
      }
      const missingEvidenceIndexes = localActiveRequestedItems.map((item,index) => normalizeEvidenceImageUrls(item).length ? null : index).filter(index => index !== null);
      if (missingEvidenceIndexes.length) {
        document.querySelector(`[data-evidence-dropzone="${missingEvidenceIndexes[0]}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' });
        triggerToast(`Còn ${missingEvidenceIndexes.length} hạng mục chưa có ảnh minh chứng.`, 'error');
        return;
      }
      const finalFreezeConfirmation = await showConfirmModal('Khóa và gửi hồ sơ', 'Tất cả ghi chú and ảnh đã được lưu. Sau khi xác nhận, Garage không thể chỉnh sửa hồ sơ này nữa.');
      if (!finalFreezeConfirmation) return;
      try {
        toggleUploadOverlay(true, 'Đang hoàn tất hồ sơ...', 'Kiểm tra và đồng bộ dữ liệu cuối cùng...', 35);
        await flushGarageAutosaves();
        toggleUploadOverlay(true, 'Đang khóa hồ sơ...', 'Cập nhật trạng thái kết quả trên Firebase...', 85);
        await dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}`).update({
          hinhAnh: localActiveImageStack,
          hangMucYeuCauAnh: localActiveRequestedItems,
          trangThai: STATUS_COMPLETED,
          garageSubmittedAt: firebase.database.ServerValue.TIMESTAMP
        });
        logUserActivity('GARAGE_SUBMIT', `Garage gửi kết quả hoàn tất giám định cho xe BKS: ${localActiveCaseNode.bienSo || 'N/A'}`, { idCa: localActiveCaseNode.idCa, bienSo: localActiveCaseNode.bienSo });
        
        if (localActiveCaseNode.nguoiTao?.email) {
          await sendAppNotification(
            '',
            localActiveCaseNode.nguoiTao.email,
            'Gara hoàn tất hồ sơ',
            `Gara ${localActiveCaseNode.tenGara || ''} đã hoàn thành ảnh cho xe ${localActiveCaseNode.bienSo || ''}.`,
            localActiveCaseNode.idCa,
            0,
            '',
            localActiveCaseNode.bienSo,
            'success'
          );
        }
        
        triggerToast('Garage đã gửi đầy đủ hạng mục và ảnh minh chứng.');
        window.history.replaceState({}, '', `${getCleanOriginBaseUrl()}?idCa=${encodeURIComponent(localActiveCaseNode.idCa)}`);
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi đồng bộ truyền tải: ' + err.message, 'error');
      } finally { toggleUploadOverlay(false); }
    }
