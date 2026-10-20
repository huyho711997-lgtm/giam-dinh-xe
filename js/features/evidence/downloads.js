

    function removeVietnameseTones(str) {
      if (!str) return '';
      let result = str.toString().trim();
      result = result.toLowerCase();
      result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
      result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
      result = result.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
      result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
      result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
      result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
      result = result.replace(/đ/g, 'd');
      result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      result = result.replace(/[^a-z0-9]/g, '_');
      result = result.replace(/_+/g, '_');
      result = result.replace(/^_+|_+$/g, '');
      return result || 'hang_muc';
    }


    function filterHangMucRows(searchTerm) {
      const table = document.getElementById('hangMucEvidenceTable');
      if (!table) return;
      const tbody = table.querySelector('tbody');
      if (!tbody) return;
      const rows = tbody.querySelectorAll('tr');
      const term = (searchTerm || '').trim().toLowerCase();
      let visibleCount = 0;

      rows.forEach(row => {
        if (row.id === 'noHangMucResultRow') { row.remove(); return; }
        const hangMucCell = row.querySelector('td[data-label="Hạng mục"]');
        if (!hangMucCell) return;
        const text = (hangMucCell.textContent || '').toLowerCase();
        if (!term || text.includes(term)) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      });

      // Show/hide no-result message
      const existingNoResult = document.getElementById('noHangMucResultRow');
      if (existingNoResult) existingNoResult.remove();
      if (term && visibleCount === 0) {
        const noResultRow = document.createElement('tr');
        noResultRow.id = 'noHangMucResultRow';
        const colCount = table.querySelector('thead tr')?.children.length || 5;
        noResultRow.innerHTML = '<td colspan="' + colCount + '" style="padding: 36px; text-align: center; color: var(--text-soft); font-size: 13px; font-style: italic;">Không tìm thấy hạng mục nào khớp với "<strong style="color: var(--primary);">' + escapeHtmlOutput(searchTerm) + '</strong>"</td>';
        tbody.appendChild(noResultRow);
      }
    }


    async function downloadCategoryImages(index) {
      const item = localActiveRequestedItems[index];
      if (!item) return;
      const urls = normalizeEvidenceImageUrls(item);
      if (!urls.length) {
        triggerToast('Hạng mục này chưa có ảnh để tải xuống!', 'warning');
        return;
      }
      
      const rawCategoryName = item.tenHangMuc || `hang_muc_${index+1}`;
      const safeCategoryName = removeVietnameseTones(rawCategoryName);
      const plateNo = removeVietnameseTones(localActiveCaseNode?.bienSo || 'ho_so');
      
      triggerToast(`Đang chuẩn bị tải xuống ${urls.length} ảnh...`, 'info');
      
      try {
        if (typeof JSZip !== 'undefined') {
          const zip = new JSZip();
          const promises = urls.map(async (url, i) => {
            const response = await fetch(url);
            const blob = await response.blob();
            let ext = 'jpg';
            const urlPath = url.split('?')[0];
            const match = urlPath.match(/\.(png|jpe?g|webp|heic|heif)$/i);
            if (match) {
              ext = match[1].toLowerCase();
            }
            const imageName = `${safeCategoryName}_${String(i+1).padStart(2, '0')}.${ext}`;
            zip.file(imageName, blob);
          });
          
          await Promise.all(promises);
          
          const content = await zip.generateAsync({ type: 'blob' });
          const blobUrl = URL.createObjectURL(content);
          
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `${plateNo}_${safeCategoryName}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          triggerToast('Đã tải xuống file nén thành công!', 'success');
        } else {
          triggerToast('Không thể nén file, đang tải trực tiếp...', 'warning');
          for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            let ext = 'jpg';
            const urlPath = url.split('?')[0];
            const match = urlPath.match(/\.(png|jpe?g|webp|heic|heif)$/i);
            if (match) ext = match[1].toLowerCase();
            
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${safeCategoryName}_${String(i+1).padStart(2, '0')}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            await new Promise(resolve => setTimeout(resolve, 350));
          }
        }
      } catch (e) {
        console.error('Download failed:', e);
        triggerToast('Tải xuống thất bại, đang mở liên kết trực tiếp...', 'error');
        urls.forEach(url => window.open(url, '_blank'));
      }
    }


    async function downloadAllCategoriesZip() {
      if (!localActiveRequestedItems || !localActiveRequestedItems.length) {
        triggerToast('Không có hạng mục nào để tải!', 'warning');
        return;
      }
      
      let totalImagesCount = 0;
      localActiveRequestedItems.forEach(item => {
        totalImagesCount += normalizeEvidenceImageUrls(item).length;
      });
      
      if (totalImagesCount === 0) {
        triggerToast('Chưa có hạng mục nào được bổ sung hình ảnh!', 'warning');
        return;
      }
      
      triggerToast(`Đang chuẩn bị nén toàn bộ ${totalImagesCount} ảnh...`, 'info');
      
      try {
        if (typeof JSZip === 'undefined') {
          triggerToast('Thư viện nén chưa sẵn sàng, vui lòng thử lại sau!', 'warning');
          return;
        }
        
        const zip = new JSZip();
        const plateNo = removeVietnameseTones(localActiveCaseNode?.bienSo || 'ho_so');
        const fetchPromises = [];
        
        localActiveRequestedItems.forEach((item, index) => {
          const urls = normalizeEvidenceImageUrls(item);
          if (urls.length === 0) return;
          
          const rawCategoryName = item.tenHangMuc || `hang_muc_${index+1}`;
          const safeCategoryName = removeVietnameseTones(rawCategoryName);
          
          urls.forEach((url, i) => {
            const fetchPromise = (async () => {
              try {
                const response = await fetch(url);
                const blob = await response.blob();
                let ext = 'jpg';
                const urlPath = url.split('?')[0];
                const match = urlPath.match(/\.(png|jpe?g|webp|heic|heif)$/i);
                if (match) {
                  ext = match[1].toLowerCase();
                }
                const imageName = `${safeCategoryName}_${String(i+1).padStart(2, '0')}.${ext}`;
                zip.folder(safeCategoryName).file(imageName, blob);
              } catch (err) {
                console.error(`Failed to download ${url}:`, err);
              }
            })();
            fetchPromises.push(fetchPromise);
          });
        });
        
        await Promise.all(fetchPromises);
        
        const content = await zip.generateAsync({ type: 'blob' });
        const blobUrl = URL.createObjectURL(content);
        
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${plateNo}_tat_ca_anh_minh_chung.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        triggerToast('Tải xuống toàn bộ ảnh thành công!', 'success');
      } catch (e) {
        console.error('Download all zip failed:', e);
        triggerToast('Tải xuống toàn bộ ảnh thất bại!', 'error');
      }
    }
