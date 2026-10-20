

    function renderFavFiltersDropdownContent() {
      const menu = document.getElementById('ddReportFavFiltersMenu');
      if (!menu) return;
      
      const currentViewFilters = userFavoriteFilters.filter(f => f.filters && f.filters.activeGdvReportView === activeGdvReportView);
      
      let listHtml = '';
      if (currentViewFilters.length === 0) {
        listHtml = '<div style="text-align: center; color: var(--text-soft); font-size: 12.5px; padding: 12px 0;">Chưa có bộ lọc ưa thích nào được lưu cho báo cáo này.</div>';
      } else {
        listHtml = currentViewFilters.map(f => {
          const isDef = f.isDefault;
          const starFill = isDef ? '#f59e0b' : 'none';
          const starStroke = isDef ? '#f59e0b' : 'var(--text-soft)';
          const starColor = isDef ? '#f59e0b' : 'var(--text-soft)';
          
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 10px; background: var(--bg-soft); margin-bottom: 6px; transition: all 0.2s ease;">
              <div onclick="applyFavoriteFilterSettings(userFavoriteFilters.find(x => x.id === '${f.id}'))" style="flex: 1; cursor: pointer; text-align: left; padding-right: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Nhấp để áp dụng bộ lọc">
                <span style="font-size: 12.5px; font-weight: 750; color: var(--text-main);">${escapeHtmlOutput(f.name)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <!-- Default Star Icon -->
                <button type="button" onclick="toggleFavoriteFilterDefault('${f.id}')" style="background: none; border: none; padding: 4px; cursor: pointer; color: ${starColor}; display: inline-flex; align-items: center; transition: transform 0.15s ease;" title="${isDef ? 'Bỏ làm mặc định' : 'Đặt làm mặc định'}" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="${starFill}" stroke="${starStroke}" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </button>
                <!-- Delete Trash Icon -->
                <button type="button" onclick="deleteFavoriteFilter('${f.id}')" style="background: none; border: none; padding: 4px; cursor: pointer; color: var(--text-soft); display: inline-flex; align-items: center; transition: transform 0.15s ease;" title="Xoá bộ lọc" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
      
      menu.innerHTML = `
        <div style="font-size: 13px; font-weight: 850; color: var(--text-main); margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em;">Lưu bộ lọc hiện tại</div>
        <div style="display: flex; gap: 8px; margin-bottom: 14px;">
          <input type="text" id="txtNewFavFilterName" placeholder="Tên bộ lọc..." style="flex: 1; padding: 8px 12px; border-radius: 9px; border: 1px solid var(--border-strong); background: var(--bg-soft); color: var(--text-main); font-size: 12.5px; font-weight: 700; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border-strong)'">
          <button type="button" onclick="saveCurrentFilterAsFavorite()" style="padding: 8px 14px; border-radius: 9px; background: linear-gradient(135deg, var(--primary) 0%, #b45309 100%); border: none; color: white; font-size: 12px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: var(--shadow-xs);">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Lưu
          </button>
        </div>
        <div style="font-size: 13px; font-weight: 850; color: var(--text-main); margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em;">Danh sách bộ lọc ưa thích</div>
        <div style="max-height: 180px; overflow-y: auto; padding-right: 2px;">
          ${listHtml}
        </div>
      `;
    }


    function applyFavoriteFilterSettings(fav) {
      if (!fav || !fav.filters) return;
      const f = fav.filters;
      if (f.activeGdvReportView) activeGdvReportView = f.activeGdvReportView;
      if (f.activeSelectedGdvNames) activeSelectedGdvNames = f.activeSelectedGdvNames;
      if (f.activeGdvReportMonth) activeGdvReportMonth = f.activeGdvReportMonth;
      if (f.activeGdvReportYear) activeGdvReportYear = f.activeGdvReportYear;
      if (f.activeGdvReportBranch) activeGdvReportBranch = f.activeGdvReportBranch;
      if (f.activeGdvReportGara) activeGdvReportGara = f.activeGdvReportGara;
      if (f.activeGdvReportDaysRange) activeGdvReportDaysRange = f.activeGdvReportDaysRange;
      if (f.activeSelectedDakLakStatuses) activeSelectedDakLakStatuses = f.activeSelectedDakLakStatuses;
      if (f.activeReportClaimType) activeReportClaimType = f.activeReportClaimType;
      if (f.activeDakLakMinReserve) activeDakLakMinReserve = f.activeDakLakMinReserve;
      
      triggerToast(`Đã áp dụng bộ lọc "${fav.name}"`, 'success');
      
      // Close dropdown
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      
      renderGdvMonthlyReportPage();
    }


    async function saveCurrentFilterAsFavorite() {
      const nameInput = document.getElementById('txtNewFavFilterName');
      if (!nameInput) return;
      const name = nameInput.value.trim();
      if (!name) {
        triggerToast('Vui lòng nhập tên bộ lọc!', 'warning');
        return;
      }
      
      const currentUser = firebase.auth().currentUser;
      if (!currentUser || !dbNodeInstance) {
        triggerToast('Bạn chưa đăng nhập hoặc cơ sở dữ liệu lỗi!', 'error');
        return;
      }
      
      const uid = currentUser.uid;
      const newFilter = {
        name: name,
        isDefault: false,
        createdAt: Date.now(),
        filters: {
          activeGdvReportView: activeGdvReportView || 'weekly_zone',
          activeSelectedGdvNames: activeSelectedGdvNames || [],
          activeGdvReportMonth: activeGdvReportMonth || 'all',
          activeGdvReportYear: activeGdvReportYear || 'all',
          activeGdvReportBranch: activeGdvReportBranch || 'all',
          activeGdvReportGara: activeGdvReportGara || 'all',
          activeGdvReportDaysRange: activeGdvReportDaysRange || 'all',
          activeSelectedDakLakStatuses: activeSelectedDakLakStatuses || [],
          activeReportClaimType: activeReportClaimType || 'all',
          activeDakLakMinReserve: activeDakLakMinReserve || 100000000
        }
      };
      
      try {
        await dbNodeInstance.ref(`users/${uid}/favorite_filters`).push(newFilter);
        nameInput.value = '';
        triggerToast(`Đã lưu bộ lọc "${name}" vào danh sách ưa thích!`, 'success');
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi khi lưu bộ lọc!', 'error');
      }
    }


    async function toggleFavoriteFilterDefault(filterId) {
      const currentUser = firebase.auth().currentUser;
      if (!currentUser || !dbNodeInstance) return;
      const uid = currentUser.uid;
      
      const target = userFavoriteFilters.find(f => f.id === filterId);
      if (!target) return;
      
      const newDefaultState = !target.isDefault;
      
      // Update all filters for this user
      const updates = {};
      userFavoriteFilters.forEach(f => {
        if (f.id === filterId) {
          updates[`users/${uid}/favorite_filters/${f.id}/isDefault`] = newDefaultState;
        } else if (newDefaultState) {
          updates[`users/${uid}/favorite_filters/${f.id}/isDefault`] = false;
        }
      });
      
      try {
        await dbNodeInstance.ref().update(updates);
        triggerToast(newDefaultState ? `Đã đặt bộ lọc "${target.name}" làm mặc định!` : `Đã bỏ chọn mặc định cho "${target.name}"`, 'success');
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi khi thiết lập mặc định!', 'error');
      }
    }


    async function deleteFavoriteFilter(filterId) {
      const currentUser = firebase.auth().currentUser;
      if (!currentUser || !dbNodeInstance) return;
      const uid = currentUser.uid;
      
      const target = userFavoriteFilters.find(f => f.id === filterId);
      if (!target) return;
      
      if (!confirm(`Bạn có chắc chắn muốn xoá bộ lọc "${target.name}" khỏi danh sách ưa thích không?`)) {
        return;
      }
      
      try {
        await dbNodeInstance.ref(`users/${uid}/favorite_filters/${filterId}`).remove();
        triggerToast(`Đã xoá bộ lọc "${target.name}"!`, 'success');
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi khi xoá bộ lọc!', 'error');
      }
    }
