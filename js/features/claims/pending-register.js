

    function getPendingClaimCoverage(claim) {
      claim=claim&&typeof claim==='object'?claim:{};
      const legacy=[claim.maSpNghiepVu,claim.nghiepVu,claim.loaiHinhBaoHiem].filter(Boolean).join(' ').toUpperCase();
      function resolve(value,code) {
        if(typeof value==='boolean') return value;
        if(typeof value==='number') return Number.isFinite(value) && value>0;
        const text=String(value??'').trim().toLowerCase();
        if(!text || /^[\s\-–—]+$/.test(text) || ['n/a','na'].includes(text)) return legacy.includes(code);
        if(['false','0','no','không','khong','không có','khong co'].includes(text)) return false;
        return true;
      }
      return {vcx:resolve(claim.vcx,'VCX'),tnds:resolve(claim.tnds,'TNDS')};
    }


    function matchesPendingClaimCoverage(claim,key) {
      const scope=getPendingClaimCoverage(claim);
      if(key==='vcx') return scope.vcx;
      if(key==='tnds') return scope.tnds;
      if(key==='both') return scope.vcx && scope.tnds;
      if(key==='none') return !scope.vcx && !scope.tnds;
      return true;
    }


    function toggleCustomCoverageDropdown(event) {
      if(event) event.stopPropagation();
      const menu=document.getElementById('menuCustomCoverageDropdown');if(!menu) return;
      const isHidden=menu.style.display==='none'||!menu.style.display;
      closeAllCustomDropdowns();
      if(isHidden) {
        menu.style.display='block';menu.closest('.custom-dropdown-container')?.classList.add('is-open');
        document.getElementById('btnCustomCoverageDropdown')?.setAttribute('aria-expanded','true');
        if(event?.detail===0) (menu.querySelector('.selected')||menu.querySelector('button'))?.focus({preventScroll:true});
      }
    }


    function selectCustomCoverageFilter(key) {
      if(!Object.prototype.hasOwnProperty.call(PENDING_COVERAGE_FILTERS,key)) return;
      activePendingCoverageFilter=key;pendingClaimsCurrentPage=1;closeAllCustomDropdowns();executeUIRenderPendingClaims();
      document.getElementById('btnCustomCoverageDropdown')?.focus({preventScroll:true});
    }


    function removePendingClaimFilter(kind) {
      if(kind==='search') {const input=document.getElementById('pendingSearchInput');if(input) input.value='';}
      if(kind==='status') activePendingStatusFilter=['all'];
      if(kind==='coverage') activePendingCoverageFilter='all';
      if(kind==='gdv') activePendingGdvFilter=['all'];
      if(kind==='period') activePendingPeriodFilter='all';
      pendingClaimsCurrentPage=1;closeAllCustomDropdowns();executeUIRenderPendingClaims();
      document.querySelector('.pending-filter-reset')?.focus({preventScroll:true});
    }


    function renderPendingFilterSummary(total,filteredCount) {
      const summary=document.getElementById('pendingFilterSummary');if(!summary) return;
      summary.replaceChildren();
      const result=document.createElement('span');result.className='pending-filter-result-count';
      const count=document.createElement('strong');count.textContent=filteredCount.toLocaleString('vi-VN');
      result.append(count,document.createTextNode(' / '+total.toLocaleString('vi-VN')+' hồ sơ'));summary.append(result);
      const status=Array.isArray(activePendingStatusFilter)?activePendingStatusFilter:[activePendingStatusFilter||'all'];
      const gdv=Array.isArray(activePendingGdvFilter)?activePendingGdvFilter:[activePendingGdvFilter||'all'];
      const chips=[];
      const search=document.getElementById('pendingSearchInput')?.value.trim();
      if(search) chips.push(['search','Tìm: '+search]);
      if(!status.includes('all')&&status.length) chips.push(['status',status.length===1?(PENDING_STATUS_MAP[status[0]]?.label||status[0]):status.length+' trạng thái']);
      if(activePendingCoverageFilter!=='all') chips.push(['coverage',PENDING_COVERAGE_FILTERS[activePendingCoverageFilter].label]);
      if(!gdv.includes('all')&&gdv.length) chips.push(['gdv',gdv.length===1?gdv[0]:gdv.length+' GĐV']);
      if(activePendingPeriodFilter!=='all') chips.push(['period',({this_week:'Tuần này',last_week:'Tuần trước',this_month:'Tháng này'})[activePendingPeriodFilter]||'Thời gian']);
      for(const [kind,label] of chips) {
        const button=document.createElement('button');button.type='button';button.className='pending-filter-chip';button.dataset.filter=kind;
        button.title='Bỏ lọc: '+label;button.setAttribute('aria-label',button.title);
        const text=document.createElement('span');text.textContent=label;
        const close=document.createElement('span');close.textContent='×';close.setAttribute('aria-hidden','true');
        button.append(text,close);button.addEventListener('click',()=>removePendingClaimFilter(kind));summary.append(button);
      }
      for(const [id,isFiltered] of [['btnCustomStatusDropdown',!status.includes('all')&&status.length>0],['btnCustomCoverageDropdown',activePendingCoverageFilter!=='all'],['btnCustomGdvDropdown',!gdv.includes('all')&&gdv.length>0],['btnCustomPeriodDropdown',activePendingPeriodFilter!=='all']]) {
        document.getElementById(id)?.closest('.pending-filter-select')?.classList.toggle('is-filtered',isFiltered);
      }
      const reset=document.querySelector('.pending-filter-reset');if(reset) reset.disabled=chips.length===0;
    }


    function toggleCustomStatusDropdown(event) {
      if (event) event.stopPropagation();
      const menu = document.getElementById('menuCustomStatusDropdown');
      if (!menu) return;
      const isHidden = menu.style.display === 'none' || !menu.style.display;
      closeAllCustomDropdowns();
      if (isHidden) {
        menu.style.display = 'block';
        menu.closest('.custom-dropdown-container')?.classList.add('is-open');
        menu.closest('.custom-dropdown-container')?.querySelector('button')?.setAttribute('aria-expanded', 'true');
      }
    }


    function selectCustomStatusFilter(event, statusKey) {
      if (event) event.stopPropagation();
      let arr = Array.isArray(activePendingStatusFilter) ? activePendingStatusFilter : [activePendingStatusFilter || 'all'];

      if (statusKey === 'all') {
        arr = ['all'];
      } else {
        if (arr.includes('all')) {
          arr = [statusKey];
        } else {
          if (arr.includes(statusKey)) {
            arr = arr.filter(k => k !== statusKey);
            if (arr.length === 0) arr = ['all'];
          } else {
            arr.push(statusKey);
          }
        }
      }
      activePendingStatusFilter = arr;
      pendingClaimsCurrentPage = 1;
      executeUIRenderPendingClaims();
    }


    function toggleCustomGdvDropdown(event) {
      if (event) event.stopPropagation();
      const menu = document.getElementById('menuCustomGdvDropdown');
      if (!menu) return;
      const isHidden = menu.style.display === 'none' || !menu.style.display;
      closeAllCustomDropdowns();
      if (isHidden) {
        menu.style.display = 'block';
        menu.closest('.custom-dropdown-container')?.classList.add('is-open');
        menu.closest('.custom-dropdown-container')?.querySelector('button')?.setAttribute('aria-expanded', 'true');
      }
    }


    function selectCustomGdvFilter(event, gdvName) {
      if (event) event.stopPropagation();
      let selectedGdvs = Array.isArray(activePendingGdvFilter)
        ? [...activePendingGdvFilter]
        : [activePendingGdvFilter || 'all'];

      if (gdvName === 'all') {
        selectedGdvs = ['all'];
      } else if (selectedGdvs.includes('all')) {
        selectedGdvs = [gdvName];
      } else if (selectedGdvs.includes(gdvName)) {
        selectedGdvs = selectedGdvs.filter(name => name !== gdvName);
        if (selectedGdvs.length === 0) selectedGdvs = ['all'];
      } else {
        selectedGdvs.push(gdvName);
      }

      activePendingGdvFilter = selectedGdvs;
      pendingClaimsCurrentPage = 1;
      executeUIRenderPendingClaims();
    }


    function toggleCustomPeriodDropdown(event) {
      if (event) event.stopPropagation();
      const menu = document.getElementById('menuCustomPeriodDropdown');
      if (!menu) return;
      const isHidden = menu.style.display === 'none' || !menu.style.display;
      closeAllCustomDropdowns();
      if (isHidden) {
        menu.style.display = 'block';
        menu.closest('.custom-dropdown-container')?.classList.add('is-open');
        menu.closest('.custom-dropdown-container')?.querySelector('button')?.setAttribute('aria-expanded', 'true');
      }
    }


    function selectCustomPeriodFilter(periodKey) {
      activePendingPeriodFilter = periodKey;
      pendingClaimsCurrentPage = 1;
      closeAllCustomDropdowns();
      executeUIRenderPendingClaims();
    }


    function toggleRowStatusDropdown(event, claimId) {
      if (event) event.stopPropagation();
      const targetMenuId = `rowStatusMenu_${claimId}`;
      const targetMenu = document.getElementById(targetMenuId);
      const isHidden = !targetMenu || targetMenu.style.display === 'none' || !targetMenu.style.display;
      
      closeAllCustomDropdowns();

      if (targetMenu && isHidden) {
        targetMenu.style.display = 'block';
      }
    }


    function toggleRowGdvDropdown(event, claimId) {
      if (event) event.stopPropagation();
      const targetMenuId = `rowGdvMenu_${claimId}`;
      const targetMenu = document.getElementById(targetMenuId);
      const isHidden = !targetMenu || targetMenu.style.display === 'none' || !targetMenu.style.display;
      
      closeAllCustomDropdowns();

      if (targetMenu && isHidden) {
        targetMenu.style.display = 'block';
      }
    }


    async function quickUpdateClaimGdv(claimId, newGdvName) {
      closeAllCustomDropdowns();
      if (!claimId || !newGdvName) return;
      try {
        await dbNodeInstance.ref(`pending_claims/${claimId}/gdvTiepNhan`).set(newGdvName);
        await dbNodeInstance.ref(`pending_claims/${claimId}/updatedAt`).set(Date.now());
        triggerToast(`Đã phân công lại GĐV ${newGdvName} thành công!`, 'success');
      } catch (e) {
        console.error(e);
        triggerToast('Lỗi phân công GĐV: ' + e.message, 'error');
      }
    }


    function toggleCustomPerPageDropdown(event) {
      if (event) event.stopPropagation();
      const menu = document.getElementById('menuCustomPerPageDropdown');
      if (!menu) return;
      const isHidden = menu.style.display === 'none' || !menu.style.display;
      closeAllCustomDropdowns();
      if (isHidden) {
        menu.style.display = 'block';
        menu.closest('.custom-dropdown-container')?.classList.add('is-open');
        menu.closest('.custom-dropdown-container')?.querySelector('button')?.setAttribute('aria-expanded', 'true');
      }
    }


    function closeAllCustomDropdowns() {
      document.querySelectorAll('.custom-dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
      });
      document.querySelectorAll('.custom-dropdown-container.is-open').forEach(container => {
        container.classList.remove('is-open');
        container.querySelector('button')?.setAttribute('aria-expanded', 'false');
      });
      document.querySelectorAll('.row-status-menu, .row-gdv-menu').forEach(menu => {
        menu.style.display = 'none';
      });
    }


    function setPendingStatusFilter(statusKey) {
      activePendingStatusFilter = [statusKey];
      pendingClaimsCurrentPage = 1;
      closeAllCustomDropdowns();
      executeUIRenderPendingClaims();
    }


    function resetAllPendingClaimFilters() {
      const searchInput = document.getElementById('pendingSearchInput');

      if (searchInput) searchInput.value = '';

      activePendingStatusFilter = ['all'];
      activePendingGdvFilter = ['all'];
      activePendingPeriodFilter = 'all';
      activePendingCoverageFilter = 'all';
      pendingClaimsCurrentPage = 1;

      closeAllCustomDropdowns();
      executeUIRenderPendingClaims();
      triggerToast('Đã đặt lại bộ lọc dữ liệu!', 'info');
    }


    function executeUIRenderPendingClaims() {
      const tbody = document.getElementById('tblPendingClaimsBodyContainer');
      const currentUser = firebase.auth().currentUser;
      const isAdmin = activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin';
      const statsContainer = document.getElementById('pendingWeeklyStatsContainer');
      if (!tbody) return;

      const claimsList = Object.values(cachedPendingClaimsPayload || {});

      // Read Filters
      const searchVal = (document.getElementById('pendingSearchInput')?.value || '').toLowerCase().trim();
      const gdvFilter = Array.isArray(activePendingGdvFilter)
        ? activePendingGdvFilter
        : [activePendingGdvFilter || 'all'];
      const periodFilter = activePendingPeriodFilter || 'this_week';
      const coverageFilter = activePendingCoverageFilter;

      // Time Period Helper (This Week vs Last Week vs Month)
      const now = new Date();
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setHours(0,0,0,0);
      startOfThisWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));

      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
      const endOfLastWeek = new Date(startOfThisWeek);

      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      function getClaimDateForFilter(c) {
        const dateStr = c.ngayMoHs || c.ngayTonThat || c.ngayVTT;
        if (dateStr && dateStr !== '—') {
          const dp = parseDateParts(dateStr);
          if (dp && dp.year && dp.month && dp.day) {
            return new Date(dp.year, dp.month - 1, dp.day, dp.hour || 0, dp.minute || 0, dp.second || 0);
          }
        }
        return new Date(c.createdAt || Date.now());
      }

      // Filter list
      let filtered = claimsList.filter(c => {
        if(!matchesPendingClaimCoverage(c,coverageFilter)) return false;
        // Status filter
        const activeArrFilter = Array.isArray(activePendingStatusFilter) ? activePendingStatusFilter : [activePendingStatusFilter || 'all'];
        if (!activeArrFilter.includes('all') && activeArrFilter.length > 0) {
          if (!activeArrFilter.includes(c.trangThai)) return false;
        }
        
        // GĐV filter (Flexible match across gdvTiepNhan, canBoXuLy, gdvHo)
        if (!gdvFilter.includes('all') && gdvFilter.length > 0) {
          const selectedNorms = gdvFilter.map(name => String(name || '').trim().toLowerCase()).filter(Boolean);
          const gdv1 = (c.gdvTiepNhan || '').trim().toLowerCase();
          const gdv2 = (c.canBoXuLy || '').trim().toLowerCase();
          const gdv3 = (c.gdvHo || '').trim().toLowerCase();
          const matchesAnyGdv = selectedNorms.some(filterNorm => gdv1.includes(filterNorm) || gdv2.includes(filterNorm) || gdv3.includes(filterNorm));
          if (!matchesAnyGdv) {
            return false;
          }
        }

        // Search text
        if (searchVal) {
          const hasSeparator = /[,\n\t;]/.test(searchVal);
          const spaceTerms = searchVal.split(/\s+/).filter(Boolean);
          const isSpaceBatch = spaceTerms.length > 1 && spaceTerms.every(t => /\d/.test(t));
          
          let searchTerms = [searchVal];
          if (hasSeparator) {
            searchTerms = searchVal.split(/[,\n\t;]+/).map(t => t.trim()).filter(Boolean);
          } else if (isSpaceBatch) {
            searchTerms = spaceTerms.map(t => t.trim());
          }

          const isMatch = searchTerms.some(term => {
            const matchBS = (c.bienSo || '').toLowerCase().includes(term);
            const matchVTT = (c.maVuTonThat || '').toLowerCase().includes(term);
            const matchGDV = (c.gdvTiepNhan || '').toLowerCase().includes(term) || (c.canBoXuLy || '').toLowerCase().includes(term) || (c.gdvHo || '').toLowerCase().includes(term);
            const matchHang = (c.hangXe || '').toLowerCase().includes(term);
            const matchSoHsbt = (c.soHoSoBoiThuong || '').toLowerCase().includes(term);
            return matchBS || matchVTT || matchGDV || matchHang || matchSoHsbt;
          });
          if (!isMatch) return false;
        }

        // Period filter based on Business Date (Ngày mở HS / Ngày tổn thất)
        const claimDate = getClaimDateForFilter(c);
        if (periodFilter === 'this_week' && claimDate < startOfThisWeek) return false;
        if (periodFilter === 'last_week' && (claimDate < startOfLastWeek || claimDate >= endOfLastWeek)) return false;
        if (periodFilter === 'this_month' && claimDate < startOfThisMonth) return false;

        return true;
      });

      renderPendingFilterSummary(claimsList.length,filtered.length);
      const coverageLabel=document.getElementById('lblCustomCoverageDropdownSelected');
      if(coverageLabel) coverageLabel.textContent=PENDING_COVERAGE_FILTERS[coverageFilter].label;
      const coverageMenu=document.getElementById('menuCustomCoverageDropdown');
      if(coverageMenu) coverageMenu.innerHTML='<div class="pending-filter-menu__head"><span>Phạm vi bảo hiểm</span><small>Toàn bộ hồ sơ</small></div>'+Object.entries(PENDING_COVERAGE_FILTERS).map(([key,scope])=>{
        const count=claimsList.filter(claim=>matchesPendingClaimCoverage(claim,key)).length,isSelected=key===coverageFilter;
        return `<button type="button" class="custom-dropdown-item pending-filter-option ${isSelected?'selected':''}" role="option" data-value="${key}" aria-selected="${isSelected}" onclick="selectCustomCoverageFilter('${key}')" style="--option-color:${scope.color};">
          <span class="pending-filter-option__main"><span class="pending-filter-option__dot"></span><span class="pending-filter-option__scope"><span class="pending-filter-option__label">${scope.label}</span><small>${scope.detail}</small></span></span>
          <span class="pending-filter-option__count">${count}</span><span class="pending-filter-option__check">${isSelected?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 6"></path></svg>':''}</span>
        </button>`;
      }).join('');

      // Calculate Status Counters
      const counts = { all: claimsList.length };
      Object.keys(PENDING_STATUS_MAP).forEach(k => { counts[k] = 0; });
      claimsList.forEach(c => {
        const stKey = PENDING_STATUS_MAP[c.trangThai] ? c.trangThai : 'moi';
        counts[stKey] = (counts[stKey] || 0) + 1;
      });

      // Render Custom Luxury Status Floating Menu Items
      const activeArr = Array.isArray(activePendingStatusFilter) ? activePendingStatusFilter : [activePendingStatusFilter || 'all'];
      const statusLabelMap = {
        'all': { label: 'Tất cả trạng thái', color: 'var(--primary)' },
        ...Object.fromEntries(Object.entries(PENDING_STATUS_MAP).map(([k, v]) => [k, { label: v.label, color: v.color }]))
      };

      const lblSelected = document.getElementById('lblCustomStatusDropdownSelected');
      if (lblSelected) {
        if (activeArr.includes('all') || activeArr.length === 0) {
          const curInfo = statusLabelMap['all'];
          lblSelected.textContent = `Tất cả · ${counts.all.toLocaleString('vi-VN')}`;
        } else if (activeArr.length === 1) {
          const curInfo = statusLabelMap[activeArr[0]] || statusLabelMap['all'];
          const countVal = counts[activeArr[0]] || 0;
          lblSelected.textContent = `${curInfo.label} · ${countVal.toLocaleString('vi-VN')}`;
        } else {
          lblSelected.textContent = `${activeArr.length} trạng thái · ${activeArr.reduce((acc,k)=>acc+(counts[k]||0),0).toLocaleString('vi-VN')}`;
        }
        document.getElementById('btnCustomStatusDropdown').title='Trạng thái: '+(activeArr.includes('all')?'Tất cả trạng thái':activeArr.map(key=>statusLabelMap[key]?.label||key).join(', '));
      }

      const customMenu = document.getElementById('menuCustomStatusDropdown');
      if (customMenu) {
        customMenu.innerHTML = `<div class="pending-filter-menu__head"><span>Chọn trạng thái</span><small>Có thể chọn nhiều</small></div>` + Object.entries(statusLabelMap).map(([key, item]) => {
          const countVal = counts[key] !== undefined ? counts[key] : counts.all;
          const isSel = activeArr.includes(key);
          return `
            <button type="button" class="custom-dropdown-item pending-filter-option ${isSel ? 'selected' : ''}" onclick="selectCustomStatusFilter(event, '${key}')" aria-selected="${isSel}" style="--option-color:${item.color};">
              <span class="pending-filter-option__main">
                <span class="pending-filter-option__check">${isSel ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 6"></path></svg>' : ''}</span>
                <span class="pending-filter-option__dot"></span>
                <span class="pending-filter-option__label">${item.label}</span>
              </span>
              <span class="pending-filter-option__count">${countVal}</span>
            </button>
          `;
        }).join('');
      }

      // Render Custom Luxury GĐV Floating Menu Items
      const gdvSet = new Set(['all']);
      claimsList.forEach(c => {
        if (c.gdvTiepNhan && c.gdvTiepNhan !== '—' && c.gdvTiepNhan !== 'Chưa phân công') gdvSet.add(c.gdvTiepNhan.trim());
        if (c.canBoXuLy && c.canBoXuLy !== '—' && c.canBoXuLy !== 'Chưa phân công') gdvSet.add(c.canBoXuLy.trim());
        if (c.gdvHo && c.gdvHo !== '—' && c.gdvHo !== 'Chưa phân công') gdvSet.add(c.gdvHo.trim());
      });
      const gdvList = Array.from(gdvSet);

      const lblGdvSelected = document.getElementById('lblCustomGdvDropdownSelected');
      if (lblGdvSelected) {
        lblGdvSelected.textContent = gdvFilter.includes('all')
          ? 'Tất cả GĐV'
          : gdvFilter.length === 1
            ? gdvFilter[0]
            : `Đã chọn ${gdvFilter.length} GĐV`;
        document.getElementById('btnCustomGdvDropdown').title='Giám định viên: '+(gdvFilter.includes('all')?'Tất cả':gdvFilter.join(', '));
      }

      const customGdvMenu = document.getElementById('menuCustomGdvDropdown');
      if (customGdvMenu) {
        customGdvMenu.innerHTML = `<div class="pending-filter-menu__head"><span>Giám định viên</span><small>Có thể chọn nhiều</small></div>` + gdvList.map(gName => {
          const isSel = gdvFilter.includes(gName);
          const displayTxt = gName === 'all' ? 'Tất cả GĐV' : escapeHtmlOutput(gName);
          return `
            <button type="button" class="custom-dropdown-item pending-filter-option ${isSel ? 'selected' : ''}" onclick="selectCustomGdvFilter(event, '${escapeAttributeData(gName)}')" aria-selected="${isSel}" style="--option-rgb:52,120,229;--option-color:${gName === 'all' ? '#3478e5' : '#059669'};">
              <span class="pending-filter-option__main"><span class="pending-filter-option__dot"></span><span class="pending-filter-option__label">${displayTxt}</span></span>
              <span class="pending-filter-option__check">${isSel ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 6"></path></svg>' : ''}</span>
            </button>
          `;
        }).join('');
      }

      // Render Custom Luxury Period Floating Menu Items
      const periodLabelMap = {
        'this_week': 'Tuần này',
        'last_week': 'Tuần trước',
        'this_month': 'Tháng này',
        'all': 'Tất cả thời gian'
      };

      const lblPeriodSelected = document.getElementById('lblCustomPeriodDropdownSelected');
      if (lblPeriodSelected) {
        lblPeriodSelected.textContent = periodFilter==='all'?'Tất cả':periodLabelMap[periodFilter] || 'Tuần này';
        document.getElementById('btnCustomPeriodDropdown').title='Thời gian: '+(periodLabelMap[periodFilter]||'Tuần này');
      }

      const customPeriodMenu = document.getElementById('menuCustomPeriodDropdown');
      if (customPeriodMenu) {
        customPeriodMenu.innerHTML = `<div class="pending-filter-menu__head"><span>Khoảng thời gian</span><small>Kỳ báo cáo</small></div>` + Object.entries(periodLabelMap).map(([pKey, pLabel]) => {
          const isSel = periodFilter === pKey;
          return `
            <button type="button" class="custom-dropdown-item pending-filter-option ${isSel ? 'selected' : ''}" onclick="selectCustomPeriodFilter('${pKey}')" aria-selected="${isSel}" style="--option-rgb:5,150,105;--option-color:#059669;">
              <span class="pending-filter-option__main"><span class="pending-filter-option__dot"></span><span class="pending-filter-option__label">${pLabel}</span></span>
              <span class="pending-filter-option__check">${isSel ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 6"></path></svg>' : ''}</span>
            </button>
          `;
        }).join('');
      }

      // Render Dynamic Metric Stats Cards based on selected Time Period
      if (statsContainer) {
        function getClaimTimeValForStats(c) {
          const dateStr = c.ngayMoHs || c.ngayTonThat || c.ngayVTT;
          if (dateStr && dateStr !== '—') {
            const dp = parseDateParts(dateStr);
            if (dp && dp.year && dp.month && dp.day) {
              return new Date(dp.year, dp.month - 1, dp.day, dp.hour || 0, dp.minute || 0, dp.second || 0).getTime();
            }
          }
          return c.createdAt || 0;
        }

        let periodClaims = claimsList;
        let titleTotal = 'TỔNG SỐ HỒ SƠ';
        let titleCompleted = 'HỒ SƠ HOÀN THÀNH';
        let titlePending = 'HỒ SƠ ĐANG TỒN ĐỌNG';
        let titleRate = 'TỶ LỆ XỬ LÝ TOÀN BỘ';

        if (periodFilter === 'this_week') {
          periodClaims = claimsList.filter(c => getClaimTimeValForStats(c) >= startOfThisWeek.getTime());
          titleTotal = 'CA PHÁT SINH TUẦN NÀY';
          titleCompleted = 'HOÀN THÀNH TUẦN NÀY';
          titlePending = 'TỒN ĐỌNG TUẦN NÀY';
          titleRate = 'TỶ LỆ XỬ LÝ TUẦN';
        } else if (periodFilter === 'last_week') {
          periodClaims = claimsList.filter(c => {
            const t = getClaimTimeValForStats(c);
            return t >= startOfLastWeek.getTime() && t < endOfLastWeek.getTime();
          });
          titleTotal = 'CA PHÁT SINH TUẦN TRƯỚC';
          titleCompleted = 'HOÀN THÀNH TUẦN TRƯỚC';
          titlePending = 'TỒN ĐỌNG TUẦN TRƯỚC';
          titleRate = 'TỶ LỆ XỬ LÝ TUẦN TRƯỚC';
        } else if (periodFilter === 'this_month') {
          periodClaims = claimsList.filter(c => getClaimTimeValForStats(c) >= startOfThisMonth.getTime());
          titleTotal = 'CA PHÁT SINH THÁNG NÀY';
          titleCompleted = 'HOÀN THÀNH THÁNG NÀY';
          titlePending = 'TỒN ĐỌNG THÁNG NÀY';
          titleRate = 'TỶ LỆ XỬ LÝ THÁNG';
        }

        const statTotal = periodClaims.length;
        const statCompleted = periodClaims.filter(c => c.trangThai === 'da_thanh_toan' || c.trangThai === 'kt_duyet').length;
        const statPending = statTotal - statCompleted;
        const statRate = statTotal > 0 ? Math.round((statCompleted / statTotal) * 100) : 100;

        const completedShare = statTotal > 0 ? Math.round((statCompleted / statTotal) * 100) : 0;
        const pendingShare = statTotal > 0 ? Math.round((statPending / statTotal) * 100) : 0;
        statsContainer.innerHTML = `
          <article class="claims-metric-card claims-metric-card--gold" aria-label="${titleTotal}: ${statTotal} ca">
            <div class="claims-metric-head">
              <span class="claims-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8M8 17h6"></path></svg></span>
              <span class="claims-metric-label">${titleTotal}</span>
            </div>
            <div class="claims-metric-value-row"><strong class="claims-metric-value">${statTotal.toLocaleString('vi-VN')}</strong><span class="claims-metric-unit">ca</span></div>
            <div class="claims-metric-foot"><span>Quy mô dữ liệu</span><strong>100%</strong></div>
            <div class="claims-metric-track"><i style="--metric-progress:100%"></i></div>
          </article>

          <article class="claims-metric-card claims-metric-card--green" aria-label="${titleCompleted}: ${statCompleted} ca">
            <div class="claims-metric-head">
              <span class="claims-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.6 2.6L16.5 9"></path></svg></span>
              <span class="claims-metric-label">${titleCompleted}</span>
            </div>
            <div class="claims-metric-value-row"><strong class="claims-metric-value">${statCompleted.toLocaleString('vi-VN')}</strong><span class="claims-metric-unit">ca</span></div>
            <div class="claims-metric-foot"><span>Trong tổng hồ sơ</span><strong>${completedShare}%</strong></div>
            <div class="claims-metric-track"><i style="--metric-progress:${completedShare}%"></i></div>
          </article>

          <article class="claims-metric-card claims-metric-card--red" aria-label="${titlePending}: ${statPending} ca">
            <div class="claims-metric-head">
              <span class="claims-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.2 2"></path></svg></span>
              <span class="claims-metric-label">${titlePending}</span>
            </div>
            <div class="claims-metric-value-row"><strong class="claims-metric-value">${statPending.toLocaleString('vi-VN')}</strong><span class="claims-metric-unit">ca</span></div>
            <div class="claims-metric-foot"><span>Cần tiếp tục xử lý</span><strong>${pendingShare}%</strong></div>
            <div class="claims-metric-track"><i style="--metric-progress:${pendingShare}%"></i></div>
          </article>

          <article class="claims-metric-card claims-metric-card--blue" aria-label="${titleRate}: ${statRate}%">
            <div class="claims-metric-head">
              <span class="claims-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17 9 12l3 3 7-8"></path><path d="M14 7h5v5"></path></svg></span>
              <span class="claims-metric-label">${titleRate}</span>
            </div>
            <div class="claims-metric-value-row"><strong class="claims-metric-value">${statRate}%</strong></div>
            <div class="claims-metric-foot"><span>Hiệu suất hoàn thành</span><strong>${statCompleted.toLocaleString('vi-VN')}/${statTotal.toLocaleString('vi-VN')}</strong></div>
            <div class="claims-metric-track"><i style="--metric-progress:${statRate}%"></i></div>
          </article>`;
      }

      // Prepare full GDV Team list for quick row switching
      const gdvTeamSet = new Set(['Huỳnh Văn Phúc', 'Giám định viên']);
      claimsList.forEach(c => { if (c.gdvTiepNhan && c.gdvTiepNhan !== '—' && c.gdvTiepNhan !== 'Chưa phân công') gdvTeamSet.add(c.gdvTiepNhan); });
      const gdvTeamList = Array.from(gdvTeamSet);

            // Sort strictly by Ngày mở HS (from date closest to present / newest down to past)
      function getClaimTimeVal(c) {
        if (!c) return 0;
        const dateStr = c.ngayMoHs || c.ngayTonThat || c.ngayVTT;
        if (dateStr && dateStr !== '—') {
          const dp = parseDateParts(dateStr);
          if (dp && dp.year && dp.month && dp.day) {
            return new Date(dp.year, dp.month - 1, dp.day, dp.hour || 0, dp.minute || 0, dp.second || 0).getTime();
          }
        }
        return c.createdAt || 0;
      }

      filtered.sort((a, b) => getClaimTimeVal(b) - getClaimTimeVal(a));

      const totalFilteredCount = filtered.length;
      const perPage = pendingClaimsPerPage === 'all' ? (totalFilteredCount || 1) : (parseInt(pendingClaimsPerPage, 10) || 10);
      const totalPages = Math.ceil(totalFilteredCount / perPage) || 1;

      if (pendingClaimsCurrentPage > totalPages) pendingClaimsCurrentPage = totalPages;
      if (pendingClaimsCurrentPage < 1) pendingClaimsCurrentPage = 1;

      const startIndex = (pendingClaimsCurrentPage - 1) * perPage;
      const endIndex = Math.min(startIndex + perPage, totalFilteredCount);
      const pageItems = filtered.slice(startIndex, endIndex);

      const paginationContainer = document.getElementById('pendingClaimsPaginationContainer');

      if (totalFilteredCount === 0) {
        tbody.innerHTML = `<tr><td colspan="${activeTonChuaHdReportCols.length + 1}" class="empty-state-text">Không tìm thấy hồ sơ tồn đọng nào phù hợp.</td></tr>`;
      }

      if(totalFilteredCount>0) tbody.innerHTML = pageItems.map((item, idx) => {
        const itemNumber = startIndex + idx + 1;
        const statusConfig = PENDING_STATUS_MAP[item.trangThai] || PENDING_STATUS_MAP['moi'];
        const coverage=getPendingClaimCoverage(item);

        let displayBsx = (item.bienSo || 'Chưa rõ').trim();
        let displayVinInfo = '';
        if (displayBsx.includes('/')) {
          const parts = displayBsx.split('/');
          displayBsx = parts[0].trim();
          displayVinInfo = parts.slice(1).join('/');
        }

        let formattedUpdateDate = '';
        const st = item.trangThai || 'moi';
        let rawDate = '';

        if (st === 'da_duyet_pasc') {
          rawDate = item.pascNgayDuyet || '';
        } else if (st === 'da_duyet_hsbt') {
          rawDate = item.toTrinhNgayDuyet || '';
        } else if (st === 'cho_duyet_dntt') {
          rawDate = item.ngayNhanDuHoSo || '';
        } else if (st === 'kt_duyet') {
          rawDate = item.ngayKtXacNhan || '';
        } else if (st === 'da_thanh_toan') {
          rawDate = item.ngayThanhToan || '';
        }

        if (rawDate && typeof rawDate === 'string') {
          // Extracts just the DD/MM/YYYY part if there is a time attached
          formattedUpdateDate = rawDate.split(' ')[0].trim();
        }

        return `
          <tr onclick="openEditPendingClaimModal('${item.id}')" style="cursor: pointer;">
            <td style="text-align: center; font-weight: 750; color: var(--text-muted); width: 44px;">${String(itemNumber).padStart(2, '0')}</td>
            <td style="width: 110px; text-align: center; padding: 12px 4px;">
              <span style="background: ${statusConfig.bg}; color: ${statusConfig.color}; border: 1px solid ${statusConfig.border}; font-size: 10.5px; font-weight: 750; padding: 4px 10px; border-radius: 99px; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;">
                ${statusConfig.label}
              </span>
              ${(item.deXuatHuy === true || item.deXuatHuy === 'co' || item.isCancelProposal === true || Boolean(cachedClaimCancellationsPayload && cachedClaimCancellationsPayload[item.id] && cachedClaimCancellationsPayload[item.id].cancelStatus !== 'da_hoan_tac' && cachedClaimCancellationsPayload[item.id].cancelStatus !== 'da_xoa_de_xuat')) ? `
                <div style="margin-top: 4px;">
                  <span style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35); font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 99px; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap;">
                    <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    Đề xuất hủy
                  </span>
                </div>
              ` : ''}
              ${formattedUpdateDate ? `<div style="font-size: 10px; font-weight: 700; color: var(--text-soft); margin-top: 6px;">${formattedUpdateDate}</div>` : ''}
            </td>
            <td style="width: 220px;">
              <strong style="color: var(--primary);  font-size: 13.5px; display: block; word-break: break-all;" title="${escapeAttributeData(displayVinInfo ? ('Số khung/máy: ' + displayVinInfo) : displayBsx)}">${escapeHtmlOutput(displayBsx)}</strong>
              <div style="font-size: 10.5px; color: var(--text-soft);  margin: 1px 0;">Mở HS: <strong style="color: var(--text-main);">${escapeHtmlOutput(item.ngayMoHs || item.ngayTonThat || '—')}</strong></div>
              <div style="margin-top: 3px; display: inline-flex; align-items: center; gap: 4px; max-width: 100%; flex-wrap: nowrap;">
                <button type="button" onclick="event.stopPropagation(); promptAssignSoHoSoBoiThuong('${item.id}', '${escapeAttributeData(item.soHoSoBoiThuong || '')}')" title="Nhấp để gán / sửa Số hồ sơ bồi thường" style="border: none; background: ${item.soHoSoBoiThuong ? 'rgba(16,185,129,0.1)' : 'rgba(216,180,109,0.08)'}; color: ${item.soHoSoBoiThuong ? '#10b981' : 'var(--text-muted)'}; padding: 2px 7px; border-radius: 6px; font-size: 10.5px; font-weight: 750;  cursor: pointer; display: inline-flex; align-items: center; gap: 4px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" style="flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.soHoSoBoiThuong ? escapeHtmlOutput(item.soHoSoBoiThuong) : '+ Gán Số HSBT'}</span>
                </button>
                ${item.soHoSoBoiThuong ? `
                  <button type="button" onclick="copyHsbtToClipboard(this, '${escapeAttributeData(item.soHoSoBoiThuong)}', event)" title="Sao chép nhanh số hồ sơ" style="border: none; background: rgba(59,130,246,0.1); color: #3b82f6; padding: 2px 5px; border-radius: 6px; font-size: 10.5px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 18.5px; width: 18.5px; flex-shrink: 0; transition: all 0.15s ease;">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                ` : ''}
              </div>
            </td>
            <td style="width: 180px; vertical-align: middle;">
              <strong style="color: var(--text-main); font-size: 13px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttributeData(extractClaimOwnerName(item))}">${escapeHtmlOutput(extractClaimOwnerName(item))}</strong>
            </td>
            <td style="width: 190px;">
              <strong style="color: var(--text-main); font-size: 13px; display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttributeData((item.hangXe || '') + ' ' + (item.hieuXe || ''))}">${escapeHtmlOutput(item.hangXe || '—')} ${escapeHtmlOutput(item.hieuXe || '')}</strong>
              <span style="font-size: 11.5px; color: var(--text-soft); display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttributeData(item.donViCapDon || '')}">${escapeHtmlOutput(item.donViCapDon || '—')}</span>
              <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
                ${coverage.vcx ? `<span style="font-size: 10px; background: rgba(59,130,246,0.1); color: #3b82f6; border: 1px solid rgba(59,130,246,0.25); padding: 1px 5px; border-radius: 4px; font-weight: 750;">VCX</span>` : ''}
                ${coverage.tnds ? `<span style="font-size: 10px; background: rgba(168,85,247,0.1); color: #a855f7; border: 1px solid rgba(168,85,247,0.25); padding: 1px 5px; border-radius: 4px; font-weight: 750;">TNDS</span>` : ''}
                ${(function(){
                  if (!coverage.tnds || !item.loaiTonThat) return '';
                  const text = item.loaiTonThat.toLowerCase();
                  let tags = [];
                  const hasNguoi = text.includes('con người') || text.includes('nguoi');
                  const hasTaiSan = text.includes('tài sản') || text.includes('tai san');
                  if (hasNguoi) tags.push(`<span style="font-size: 10px; background: rgba(225,29,72,0.1); color: #e11d48; border: 1px solid rgba(225,29,72,0.25); padding: 1px 5px; border-radius: 4px; font-weight: 750;">Con người</span>`);
                  if (hasTaiSan) tags.push(`<span style="font-size: 10px; background: rgba(13,148,136,0.1); color: #0d9488; border: 1px solid rgba(13,148,136,0.25); padding: 1px 5px; border-radius: 4px; font-weight: 750;">Tài sản</span>`);
                  if (!hasNguoi && !hasTaiSan) tags.push(`<span style="font-size: 10px; background: rgba(236,72,153,0.1); color: #ec4899; border: 1px solid rgba(236,72,153,0.25); padding: 1px 5px; border-radius: 4px; font-weight: 750;">${escapeHtmlOutput(item.loaiTonThat)}</span>`);
                  return tags.join('');
                })()}
              </div>
            </td>
            <td style="width: 260px; min-width: 200px;">
              <div style="font-size: 12px; color: var(--text-main); font-weight: 600; line-height: 1.4; word-break: break-word;">${escapeHtmlOutput(item.moTaTonThat || item.nguyenNhan || '—')}</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: flex-start; gap: 4px; line-height: 1.35; word-break: break-word;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary); flex-shrink: 0; margin-top: 2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span>${escapeHtmlOutput(item.diaDiemVTT || item.tinhTonThat || '—')}</span>
              </div>
            </td>
            <td style="width: 155px; text-align: right; padding-right: 15px; vertical-align: middle; white-space: nowrap;">
              <strong style="color: #10b981; font-size: 13.5px; display: block; white-space: nowrap;" title="Số tiền bồi thường">${item.ttbtTongSoTienBoiThuong ? formatCurrencyInputNumber(item.ttbtTongSoTienBoiThuong) + ' đ' : '-'}</strong>
              ${(item.duPhongBoiThuong && item.duPhongBoiThuong !== '0' && item.duPhongBoiThuong !== 0) ? `
              <div style="display: flex; justify-content: flex-end; align-items: center; gap: 5px; margin-top: 6px;" title="Dự phòng bồi thường (VNĐ)">
                <span style="font-size: 8.5px; font-weight: 850; padding: 2px 5px; border-radius: 4px; background: rgba(216,180,109,0.15); color: var(--primary); border: 1px solid rgba(216,180,109,0.3); letter-spacing: 0.04em; text-transform: uppercase; line-height: 1;">D.PHÒNG</span>
                <span style="font-size: 11.5px; font-weight: 800; color: var(--text-soft); line-height: 1; white-space: nowrap;">${formatCurrencyInputNumber(item.duPhongBoiThuong)} đ</span>
              </div>
              ` : `
              <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 6px;" title="Dự phòng bồi thường (VNĐ)">
                <span style="font-size: 11.5px; font-weight: 800; color: var(--text-muted); line-height: 1;">-</span>
              </div>
              `}
            </td>
            <td style="width: 145px;">
              <span style="font-size: 12.5px; font-weight: 750; color: var(--text-main); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttributeData(item.gdvTiepNhan || 'Chưa phân công')}">${escapeHtmlOutput(item.gdvTiepNhan || 'Chưa phân công')}</span>
            </td>
            <td style="width: 70px; text-align: center; padding-right: 12px;">
              <div style="display: inline-flex; justify-content: center; align-items: center; width: 100%;">
                ${(hasUserPermission('pending', 'delete') && item.cancelStatus !== 'da_duyet' && item.trangThai !== 'tu_choi' && (!cachedClaimCancellationsPayload?.[item.id] || cachedClaimCancellationsPayload[item.id].cancelStatus !== 'da_duyet')) ? `
                <button type="button" class="btn-premium btn-danger-p" onclick="event.stopPropagation(); deletePendingClaim('${item.id}', '${escapeAttributeData(item.bienSo)}')" title="Xóa hồ sơ tồn" style="width: 32px; height: 32px; min-width: 32px; min-height: 32px; padding: 0; display: grid; place-items: center; border-radius: 8px; margin: 0; cursor: pointer; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #ef4444;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Render Ultra-Luxury Pagination Control Bar
      if (paginationContainer) {
        const displayStart = totalFilteredCount ? startIndex + 1 : 0;
        const displayEnd = endIndex;

        // Smart pagination buttons with ellipsis
        let pageBtnsHtml = '';
        const maxVisibleButtons = 3;
        let startPage = Math.max(1, pendingClaimsCurrentPage - 2);
        let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);
        if (endPage - startPage < maxVisibleButtons - 1) {
          startPage = Math.max(1, endPage - maxVisibleButtons + 1);
        }

        if (startPage > 1) {
          pageBtnsHtml += `<button type="button" class="pending-page-btn" onclick="setPendingClaimsPage(1)">1</button>`;
          if (startPage > 2) {
            pageBtnsHtml += `<span class="pending-page-ellipsis">•••</span>`;
          }
        }

        for (let p = startPage; p <= endPage; p++) {
          const isAct = p === pendingClaimsCurrentPage;
          pageBtnsHtml += `
            <button type="button" class="pending-page-btn ${isAct ? 'is-active' : ''}" onclick="setPendingClaimsPage(${p})" ${isAct ? 'aria-current="page"' : ''}>${p}</button>
          `;
        }

        if (endPage < totalPages) {
          if (endPage < totalPages - 1) {
            pageBtnsHtml += `<span class="pending-page-ellipsis">•••</span>`;
          }
          pageBtnsHtml += `<button type="button" class="pending-page-btn" onclick="setPendingClaimsPage(${totalPages})">${totalPages}</button>`;
        }

        paginationContainer.innerHTML = `
          <div class="pending-pagination__inner">
            <div class="custom-dropdown-container pending-per-page">
                <button id="btnCustomPerPageDropdown" class="pending-filter-trigger" type="button" onclick="toggleCustomPerPageDropdown(event)" aria-haspopup="listbox" aria-expanded="false">
                  <span class="pending-filter-trigger__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 6h10M7 12h10M7 18h10"></path></svg></span>
                  <span class="pending-filter-trigger__value">${perPage} / trang</span>
                  <svg class="pending-filter-trigger__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m7 10 5 5 5-5"></path></svg>
                </button>
                <div id="menuCustomPerPageDropdown" class="custom-dropdown-menu pending-filter-menu pending-filter-menu--right" role="listbox" style="display:none;">
                  <div class="pending-filter-menu__head"><span>Số dòng hiển thị</span><small>Mỗi trang</small></div>
                  ${[10, 25, 50, 100].map(num => {
                    const isSel = perPage === num;
                    return `
                      <button type="button" class="custom-dropdown-item pending-filter-option ${isSel ? 'selected' : ''}" onclick="setPendingClaimsPerPage(${num})" aria-selected="${isSel}">
                        <span class="pending-filter-option__main"><span class="pending-filter-option__label">${num} hồ sơ</span></span>
                        <span class="pending-filter-option__check">${isSel ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 6"></path></svg>' : ''}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
            </div>

            <div class="pending-pagination__summary"><strong>${displayStart}–${displayEnd}</strong> / ${totalFilteredCount}</div>

            <div class="pending-page-controls">
              <button type="button" class="pending-page-btn" onclick="setPendingClaimsPage(${pendingClaimsCurrentPage - 1})" ${pendingClaimsCurrentPage <= 1 ? 'disabled' : ''} title="Trang trước" aria-label="Trang trước">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"></path></svg>
              </button>

              ${pageBtnsHtml}

              <button type="button" class="pending-page-btn" onclick="setPendingClaimsPage(${pendingClaimsCurrentPage + 1})" ${pendingClaimsCurrentPage >= totalPages ? 'disabled' : ''} title="Trang sau" aria-label="Trang sau">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"></path></svg>
              </button>
            </div>
          </div>
        `;
      }
    }


    async function updatePendingClaimStatus(claimId, newStatus) {
      try {
        await dbNodeInstance.ref(`pending_claims/${claimId}/trangThai`).set(newStatus);
        await dbNodeInstance.ref(`pending_claims/${claimId}/updatedAt`).set(Date.now());
        triggerToast('Đã cập nhật trạng thái hồ sơ tồn thành công!', 'success');
      } catch (e) {
        console.error(e);
        triggerToast('Lỗi cập nhật trạng thái: ' + e.message, 'error');
      }
    }


    async function deletePendingClaim(claimId, bienSo) {
      if (!hasUserPermission('pending', 'delete')) {
        triggerToast('Bạn không có quyền xóa hồ sơ bồi thường tồn.', 'error');
        return;
      }
      const currentUser = firebase.auth().currentUser;
      const isAdmin = activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin';
      
      const targetClaim = cachedPendingClaimsPayload ? cachedPendingClaimsPayload[claimId] : null;
      const isCreator = targetClaim && (targetClaim.createdByUid === currentUser?.uid || targetClaim.nguoiTao?.uid === currentUser?.uid);
      
      const cancelRecord = (cachedClaimCancellationsPayload || {})[claimId] || {};
      if (cancelRecord.cancelStatus === 'da_duyet' || (targetClaim && (targetClaim.cancelStatus === 'da_duyet' || targetClaim.trangThai === 'tu_choi'))) {
        triggerToast('Hồ sơ này đã được duyệt hủy nên không thể xóa!', 'warning');
        return;
      }

      if (!isAdmin && !isCreator) {
        triggerToast('Bạn không có quyền xóa hồ sơ tồn này!', 'error');
        return;
      }
      const confirmAction = await showConfirmModal('Xóa hồ sơ tồn', `Bạn có chắc chắn muốn xóa vụ tổn thất xe ${bienSo} khỏi danh sách hồ sơ tồn không? Sơ đồ hiện trường (nếu có) sẽ được giữ lại trong kho dữ liệu riêng.`);
      if (confirmAction) {
        try {
          await dbNodeInstance.ref(`pending_claims/${claimId}`).remove();
          triggerToast(`Đã xóa hồ sơ xe ${bienSo}; sơ đồ hiện trường vẫn được lưu riêng.`, 'warning');
        } catch (e) {
          console.error(e);
          triggerToast('Lỗi xóa hồ sơ: ' + e.message, 'error');
        }
      }
    }


    function copyPendingClaimText(claimId) {
      const item = cachedPendingClaimsPayload[claimId];
      if (!item) return;
      const text = item.rawText || `YC GDCT / ${item.hangXe}\nBSX: ${item.bienSo}\nMã VTT: ${item.maVuTonThat}\nGĐV tiếp nhận: ${item.gdvTiepNhan}\nĐịa điểm: ${item.diaDiemVTT}\nMô tả: ${item.moTaTonThat}`;
      executeTextCopyToClipboardRawString(text);
    }


    function openExportWeeklyReportModal() {
      const claimsList = Object.values(cachedPendingClaimsPayload || {});
      const now = new Date();
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setHours(0,0,0,0);
      startOfThisWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));

      const thisWeekClaims = claimsList.filter(c => new Date(c.createdAt || Date.now()) >= startOfThisWeek);
      
      let summaryReportText = `==================================================\n`;
      summaryReportText += `   BÁO CÁO TỔNG HỢP HỒ SƠ TỒN TRONG TUẦN (TASCO INSURTECH)\n`;
      summaryReportText += `==================================================\n`;
      summaryReportText += `+ Thời gian báo cáo:  ${new Date().toLocaleDateString('vi-VN')}\n`;
      summaryReportText += `+ Tổng số hồ sơ phát sinh tuần: ${thisWeekClaims.length} vụ\n`;
      summaryReportText += `+ Đã hoàn thành đóng hồ sơ:     ${thisWeekClaims.filter(c => c.trangThai === 'hoan_thanh').length} vụ\n`;
      summaryReportText += `+ Hồ sơ còn đang tồn đọng:     ${thisWeekClaims.filter(c => c.trangThai !== 'hoan_thanh').length} vụ\n`;
      summaryReportText += `--------------------------------------------------\n\n`;

      summaryReportText += `[CHI TIẾT HỒ SƠ TỒN ĐỌNG PHÂN THEO GIÁM ĐỊNH VIÊN]\n`;
      
      const gdvMap = {};
      claimsList.filter(c => c.trangThai !== 'hoan_thanh').forEach(c => {
        const gdv = c.gdvTiepNhan || 'Chưa phân công';
        if (!gdvMap[gdv]) gdvMap[gdv] = [];
        gdvMap[gdv].push(c);
      });

      Object.entries(gdvMap).forEach(([gdv, list], idx) => {
        summaryReportText += `\n${idx + 1}. GĐV ${gdv} (${list.length} hồ sơ tồn):\n`;
        list.forEach((item) => {
          const sttLabel = PENDING_STATUS_MAP[item.trangThai]?.label || item.trangThai;
          summaryReportText += `   - [${item.bienSo}] (${item.maVuTonThat}) - ${item.hangXe} | Trạng thái: ${sttLabel} | Nơi VTT: ${item.diaDiemVTT}\n`;
        });
      });

      executeTextCopyToClipboardRawString(summaryReportText);
      triggerToast('Đã sao chép Báo cáo tổng hợp tuần vào bộ nhớ tạm!', 'success');
    }
