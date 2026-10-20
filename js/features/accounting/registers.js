

    function renderAccountingTransferMetrics(stats) {
      return renderAccountingMetrics(stats, 'transfers');
    }


    function renderAccountingClaimsMetrics(stats) {
      return renderAccountingMetrics(stats, 'claims');
    }


    function renderAccountingMetrics(stats, kind) {
      const isClaims = kind === 'claims';
      const unit = isClaims ? 'hồ sơ' : 'phiếu';
      const gridClass = isClaims ? 'accounting-claims-metrics' : 'accounting-transfer-metrics';
      const dataAttribute = isClaims ? 'data-claim-metric' : 'data-transfer-metric';
      const title = isClaims ? 'Tổng quan hồ sơ kế toán đã nhận' : 'Tổng quan phiếu bàn giao kế toán';
      const icons = {
        total:isClaims ? '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
        pending:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        confirmed:'<path d="M21 11v1a9 9 0 1 1-5.3-8.2"/><path d="m21 4-9 9-3-3"/>',
        supplement:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
        submitted:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3m4 0h3"/>'
      };
      const cards = isClaims ? [
        {key:'total', label:'Tổng hồ sơ đã nhận', tone:'gold', note:'Trong danh sách đã nhận'},
        {key:'confirmed', label:'Đã xác nhận', tone:'green', note:'Đã tiếp nhận hồ sơ'},
        {key:'supplement', label:'Yêu cầu bổ sung', tone:'red', note:'Hồ sơ cần bổ sung'},
        {key:'submitted', label:'Đã trình ĐNTT', tone:'violet', note:'Đề nghị thanh toán'}
      ] : [
        {key:'total', label:'Tổng phiếu bàn giao', tone:'gold', note:'Bao gồm phiếu nháp'},
        {key:'pending', label:'Chờ xác nhận', tone:'amber', note:'Chờ kế toán tiếp nhận'},
        {key:'confirmed', label:'Đã xác nhận', tone:'green', note:'Đã tiếp nhận hồ sơ'},
        {key:'supplement', label:'Yêu cầu bổ sung', tone:'red', note:'Phiếu có hồ sơ cần bổ sung'},
        {key:'submitted', label:'Đã trình ĐNTT', tone:'violet', note:'Giá trị đã trình'}
      ];
      return `<div class="claims-metrics-grid accounting-metrics ${gridClass}" aria-label="${title}">${cards.map(card => {
        const count = stats[card.key];
        const share = stats.total ? Math.round(count / stats.total * 100) : 0;
        const money = !isClaims && card.key === 'submitted' ? formatCurrencyInputNumber(stats.submittedAmount) + ' VNĐ' : '';
        const accessibleLabel = `${card.label}: ${count} ${unit}${money ? ', giá trị đã trình ' + money : ''}`;
        return `<article class="claims-metric-card claims-metric-card--${card.tone}" ${dataAttribute}="${card.key}" aria-label="${escapeAttributeData(accessibleLabel)}">
          <div class="claims-metric-head"><span class="claims-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${icons[card.key]}</svg></span><span class="claims-metric-label">${card.label}</span></div>
          <div class="claims-metric-value-row"><strong class="claims-metric-value">${count}</strong><span class="claims-metric-unit">${unit}</span></div>
          <div class="claims-metric-foot"><span>${card.note}</span><strong class="${money ? 'transfer-metric-money' : ''}">${escapeHtmlOutput(money || share + '%')}</strong></div>
          <div class="claims-metric-track" title="${share}% tổng ${unit} trong danh sách" aria-hidden="true"><i style="--metric-progress:${share}%"></i></div>
        </article>`;
      }).join('')}</div>`;
    }


    function transferRegisterIcon(name) {
      const paths = {
        folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
        card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3m4 0h3"/>',
        alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
        inbox:'<path d="m3 12 3-8h12l3 8v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 12h5l2 4h4l2-4h5"/>',
        flag:'<path d="M5 21V3m0 1h13l-3 5 3 5H5"/>',
        open:'<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
        trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
        close:'<path d="m6 6 12 12M18 6 6 18"/>'
      };
      return paths[name] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>` : auditLogIcon(name);
    }


    function getTransferRegisterStatus(status) {
      const statuses = {
        moi:{label:'Mới (Nháp)',tone:'blue',icon:'edit'},
        cho_xac_nhan:{label:'Chờ xác nhận',tone:'amber',icon:'clock'},
        da_nhan_ho_so:{label:'Đã nhận từ GĐV',tone:'blue',icon:'inbox'},
        da_xac_nhan:{label:'Đã xác nhận',tone:'green',icon:'check'},
        da_nhan_du_ho_so:{label:'Đã xác nhận',tone:'green',icon:'check'},
        can_bo_sung:{label:'Yêu cầu bổ sung',tone:'red',icon:'alert'},
        da_trinh_dntt:{label:'Đã trình ĐNTT',tone:'violet',icon:'card'}
      };
      return Object.prototype.hasOwnProperty.call(statuses,status) ? statuses[status] : statuses.cho_xac_nhan;
    }


    function renderTransferRegisterPages(page,totalPages,kind='transfers') {
      const handler=kind==='claims'?'navigateClaimsRegisterPage':'navigateTransferRegisterPage';
      const label=kind==='claims'?'Phân trang hồ sơ đã nhận':'Phân trang phiếu bàn giao';
      const visible = new Set([1,totalPages]);
      const start = Math.max(1, Math.min(page-1,totalPages-2));
      const end = Math.min(totalPages, Math.max(page+1,3));
      for (let p=start;p<=end;p++) visible.add(p);
      let previous=0, buttons='';
      Array.from(visible).sort((a,b)=>a-b).forEach(p => {
        if (p-previous>1) buttons += '<span class="transfer-page-gap" aria-hidden="true">…</span>';
        buttons += `<button type="button" class="transfer-page" aria-label="Trang ${p}" ${p===page?'aria-current="page"':''} onclick="${handler}(${p})">${p}</button>`;
        previous=p;
      });
      return `<nav class="transfer-register-pages" aria-label="${label}"><button type="button" class="transfer-page" aria-label="Trang trước" onclick="${handler}(${page-1})" ${page===1?'disabled':''}>${transferRegisterIcon('left')}</button>${buttons}<button type="button" class="transfer-page" aria-label="Trang sau" onclick="${handler}(${page+1})" ${page===totalPages?'disabled':''}>${transferRegisterIcon('right')}</button></nav>`;
    }


    function renderAccountingTransferRegister({rows,summary,startIndex,displayStart,displayEnd,totalCount,page,totalPages,isAdmin}) {
      const filterOptions = [
        ['all','Tất cả trạng thái',summary.total],['moi','Mới / Nháp',summary.draft],
        ['cho_xac_nhan','Chờ xác nhận',summary.pending],['da_xac_nhan','Đã xác nhận',summary.confirmed],
        ['can_bo_sung','Yêu cầu bổ sung',summary.supplement],['da_trinh_dntt','Đã trình ĐNTT',summary.submitted]
      ];
      const rawSearch=typeof activeAccountingSearchRaw!=='undefined'?activeAccountingSearchRaw:activeAccountingSearch;
      const tableRows = rows.map((transfer,index) => {
        const status=getTransferRegisterStatus(transfer.trangThai);
        const claims=transfer.danhSachHoSo||[];
        const supplementList=transfer.hoSoYeuCauBoSung||[];
        const supplementCount=claims.filter((claim,claimIndex)=>claim.trangThaiBoSung==='yeu_cau_bo_sung'||supplementList.some(s=>Number(s.chiSo)===claimIndex||(s.soHoSoBoiThuong&&s.soHoSoBoiThuong===claim.soHoSoBoiThuong)||(s.bienSo&&s.bienSo===claim.bienSo))).length || (transfer.trangThai==='can_bo_sung'?(supplementList.length||1):0);
        const priority=claims.some(claim=>claim.isUuTien);
        const isCreator=!transfer.gdvUid||transfer.gdvUid===firebase.auth().currentUser?.uid;
        const canDelete=isAdmin||(hasUserPermission('accounting','create')&&isCreator&&!['da_xac_nhan','da_nhan_du_ho_so','da_trinh_dntt'].includes(transfer.trangThai));
        const safeId=escapeAttributeData(JSON.stringify(String(transfer.transferId||'')));
        const idLabel=escapeAttributeData(transfer.transferId||'');
        const author=String(transfer.gdvName||'Chưa cập nhật');
        return `<tr class="transfer-register-row ${supplementCount?'transfer-register-row--supplement':''}" onclick="openTransferRegisterRow(${safeId})">
          <td data-label="STT"><span class="transfer-register-index">${String(startIndex+index+1).padStart(2,'0')}</span></td>
          <td data-label="Trạng thái"><span class="transfer-status-badge transfer-status-badge--${status.tone}">${transferRegisterIcon(status.icon)}<span>${status.label}</span></span></td>
          <td data-label="Phiếu bàn giao"><div class="transfer-register-identity"><div class="transfer-register-id-line"><button type="button" class="transfer-id-button" aria-label="Mở phiếu ${idLabel}" onclick="event.stopPropagation();openTransferRegisterRow(${safeId})">${escapeHtmlOutput(transfer.transferId||'Chưa có mã phiếu')}</button>${priority?`<span class="transfer-priority">${transferRegisterIcon('flag')}Ưu tiên</span>`:''}</div><div class="transfer-register-date">${transferRegisterIcon('clock')}<span>${escapeHtmlOutput(formatDateDisplay(transfer.ngayBanGiao))}</span></div></div></td>
          <td data-label="Hồ sơ"><div class="transfer-register-claims"><span class="transfer-claim-count">${transferRegisterIcon('folder')}<strong>${claims.length||1}</strong> hồ sơ</span>${supplementCount?`<span class="transfer-supplement-count">${transferRegisterIcon('alert')}Cần bổ sung ${supplementCount}</span>`:''}</div></td>
          <td data-label="GĐV bàn giao"><div class="transfer-register-author"><span class="transfer-author-avatar">${escapeHtmlOutput(deriveInitials(author))}</span><span>${escapeHtmlOutput(author)}</span></div></td>
          <td data-label="Tổng tiền chi"><div class="transfer-register-money">${formatCurrencyInputNumber(parseInt(transfer.soTienDeNghi,10)||0)} <span>₫</span></div></td>
          <td data-label="Thao tác" onclick="event.stopPropagation()"><div class="transfer-register-actions"><button type="button" class="transfer-row-button" aria-label="Mở chi tiết phiếu ${idLabel}" title="Mở chi tiết phiếu" onclick="openTransferRegisterRow(${safeId})">${transferRegisterIcon('open')}</button>${canDelete?`<button type="button" class="transfer-row-button transfer-row-button--danger" aria-label="Xóa phiếu ${idLabel}" title="Xóa phiếu bàn giao" onclick="deleteAccountingTransferBatch(${safeId})">${transferRegisterIcon('trash')}</button>`:''}</div></td>
        </tr>`;
      }).join('');
      return `<section class="accounting-transfer-register" aria-label="Danh sách phiếu bàn giao kế toán">
        <div class="transfer-register-toolbar">
          <div class="transfer-register-search">${transferRegisterIcon('search')}<input id="accountingTransferSearchInput" class="input-premium" type="search" value="${escapeAttributeData(rawSearch)}" aria-label="Tìm phiếu bàn giao" placeholder="Tìm mã phiếu, HSBT, biển số, GĐV…" autocomplete="off" oninput="changeAccountingSearch(this.value)" />${rawSearch?`<button type="button" class="transfer-search-clear" aria-label="Xóa tìm kiếm" onclick="clearTransferRegisterSearch()">${transferRegisterIcon('close')}</button>`:''}</div>
          <select id="transferRegisterStatus" class="input-premium" data-premium-select aria-label="Lọc trạng thái bàn giao" onchange="setTransferRegisterFilter(this.value)">${filterOptions.map(([value,label,count])=>`<option value="${value}" ${activeAccountingStatusFilter===value?'selected':''}>${label} · ${count}</option>`).join('')}</select>
          <div class="transfer-register-controls"><span class="transfer-register-result" role="status" aria-live="polite"><strong>${displayStart}–${displayEnd}</strong> / ${totalCount} phiếu</span><select id="transferRegisterPerPage" class="input-premium" data-premium-select aria-label="Số phiếu trên mỗi trang" onchange="setTransferRegisterPerPage(this.value)">${[10,25,50,100].map(value=>`<option value="${value}" ${accTransfersPerPage===value?'selected':''}>${value} / trang</option>`).join('')}</select>${renderTransferRegisterPages(page,totalPages)}</div>
        </div>
        <div class="transfer-register-table-shell"><table class="p-table transfer-register-table" aria-label="Phiếu bàn giao hồ sơ kế toán"><colgroup><col style="width:4%"><col style="width:13%"><col style="width:24%"><col style="width:14%"><col style="width:22%"><col style="width:15%"><col style="width:8%"></colgroup><thead><tr><th scope="col">STT</th><th scope="col">Trạng thái</th><th scope="col">Mã phiếu & Ngày bàn giao</th><th scope="col">Hồ sơ</th><th scope="col">GĐV bàn giao</th><th scope="col">Tổng tiền chi (VNĐ)</th><th scope="col">Thao tác</th></tr></thead><tbody>${tableRows||`<tr><td colspan="7"><div class="transfer-register-empty" role="status"><div>${transferRegisterIcon('search')}</div><strong>Không tìm thấy phiếu bàn giao</strong><p>Thử đổi từ khóa hoặc chọn một trạng thái khác.</p></div></td></tr>`}</tbody></table></div>
      </section>`;
    }


    function openTransferRegisterRow(id) {
      const transfer=cachedAccountingTransfersPayload[id];
      if (!transfer) return;
      if (transfer.trangThai==='moi'||transfer.trangThai==='can_bo_sung') openAddAccountingTransferModal(id);
      else openKeToanReviewModal(id);
    }

    function focusTransferRegisterSelect(id) {
      const select=document.getElementById(id);
      select?.parentElement.querySelector('.admin-select-trigger')?.focus({preventScroll:true});
    }

    function setTransferRegisterFilter(value) {
      changeAccountingStatusFilter(value);
      focusTransferRegisterSelect('transferRegisterStatus');
    }

    function setTransferRegisterPerPage(value) {
      setAccTransfersPerPage(Number(value));
      focusTransferRegisterSelect('transferRegisterPerPage');
    }

    function navigateTransferRegisterPage(page) {
      setAccTransfersPage(page);
      document.querySelector('.transfer-register-pages [aria-current="page"]')?.focus({preventScroll:true});
    }

    function clearTransferRegisterSearch() {
      const input=document.getElementById('accountingTransferSearchInput');
      if (input) { input.value='';input.focus({preventScroll:true}); }
      changeAccountingSearch('');
    }


    function transferReviewIcon(name) {
      const paths = {
        briefcase:'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M8 7v14m8-14v14"/>',
        print:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6zM17 12h.01"/>',
        table:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>',
        refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 7M4 12l2 7a7 7 0 0 0 12-2"/>'
      };
      return paths[name] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>` : transferRegisterIcon(name);
    }


    function renderTransferReviewView({transfer:t,transferId,claims,history,isKeToanRole,canDelete}) {
      const id = String(t.transferId || transferId);
      const argument = escapeAttributeData(JSON.stringify(id));
      const state = getTransferRegisterStatus(t.trangThai);
      const author = String(t.gdvName || 'Chưa cập nhật');
      const supplementCount = claims.filter(c=>c.trangThaiBoSung==='yeu_cau_bo_sung').length;
      const button = (label,icon,handler,variant='',title='') => `<button type="button" class="transfer-review-button ${variant}" onclick="${handler}" ${title?`title="${escapeAttributeData(title)}"`:''}>${transferReviewIcon(icon)}<span>${label}</span></button>`;
      const canRevert = ['cho_xac_nhan','da_xac_nhan','da_nhan_du_ho_so','can_bo_sung'].includes(t.trangThai);
      const canConfirm = isKeToanRole && ['cho_xac_nhan','can_bo_sung','moi'].includes(t.trangThai);
      const canSubmit = isKeToanRole && ['da_xac_nhan','da_nhan_du_ho_so'].includes(t.trangThai);
      const canEdit = !isKeToanRole && ['moi','can_bo_sung'].includes(t.trangThai);
      const rows = claims.map((c,index)=>{
        const supplement = c.trangThaiBoSung==='yeu_cau_bo_sung';
        return `<tr class="transfer-review-claim ${supplement?'transfer-review-claim--supplement':''}">
          <td class="transfer-review-index">${String(index+1).padStart(2,'0')}</td>
          <td><div class="transfer-review-plate-line"><strong>${escapeHtmlOutput(c.bienSo||'N/A')}</strong>${c.isUuTien?`<span class="transfer-priority">${transferReviewIcon('flag')}Ưu tiên</span>`:''}</div><div class="transfer-review-claim-id">${escapeHtmlOutput(c.soHoSoBoiThuong||'')}</div></td>
          <td class="transfer-review-owner">${escapeHtmlOutput(extractClaimOwnerName(c))}</td>
          <td class="transfer-review-garage">${escapeHtmlOutput(c.tenGara||'N/A')}</td>
          <td class="transfer-review-amount">${formatCurrencyInputNumber(c.soTienDeNghi)}<span>₫</span></td>
          <td class="transfer-review-claim-status"><span class="transfer-status-badge transfer-status-badge--${supplement?'red':'green'}">${transferReviewIcon(supplement?'alert':'check')}<span>${supplement?'Cần bổ sung':'Đạt'}</span></span></td>
        </tr>${supplement?`<tr class="transfer-review-supplement-note"><td colspan="6"><div>${transferReviewIcon('alert')}<div><strong>Nội dung cần bổ sung</strong><p>${escapeHtmlOutput(c.noiDungBoSung||'Chưa có nội dung phản hồi.')}</p></div></div></td></tr>`:''}`;
      }).join('');
      const events = history.map(evt=>{
        const dt = new Date(evt.time);
        const valid = Number.isFinite(dt.getTime());
        const date = valid ? dt.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}) : 'Chưa cập nhật';
        const time = valid ? dt.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) : '';
        const tone = evt.color==='#ef4444'?'red':evt.color==='#10b981'?'green':evt.color==='#f59e0b'?'amber':evt.color==='#3b82f6'?'blue':'violet';
        return `<li class="transfer-review-event transfer-review-event--${tone}"><div class="transfer-review-event-date"><time>${time}${time?' · ':''}${date}</time></div><strong>${escapeHtmlOutput(evt.action)}</strong><div class="transfer-review-event-user">${transferReviewIcon('user')}<span>${escapeHtmlOutput(evt.user||'Chưa cập nhật')}</span></div>${evt.detail?`<p>${escapeHtmlOutput(evt.detail)}</p>`:''}</li>`;
      }).join('');
      return `<section class="transfer-review-panel" role="dialog" aria-modal="true" aria-labelledby="transferReviewTitle" aria-describedby="transferReviewReference" tabindex="-1">
        <header class="transfer-review-header"><div class="transfer-review-heading"><div class="transfer-review-heading-icon">${transferReviewIcon('briefcase')}</div><div><div class="transfer-review-eyebrow">HỒ SƠ BÀN GIAO · KẾ TOÁN</div><h3 id="transferReviewTitle">Chi tiết phiếu bàn giao</h3><div class="transfer-review-reference" id="transferReviewReference"><strong>${escapeHtmlOutput(id)}</strong><span>${transferReviewIcon('clock')}${escapeHtmlOutput(formatDateDisplay(t.ngayBanGiao))}</span></div></div></div><div class="transfer-review-header-end"><span class="transfer-status-badge transfer-status-badge--${state.tone}">${transferReviewIcon(state.icon)}<span>${state.label}</span></span><button type="button" class="transfer-review-close" aria-label="Đóng chi tiết phiếu bàn giao" onclick="closeKeToanReviewModal()">${transferReviewIcon('close')}</button></div></header>
        <div class="transfer-review-toolbar" aria-label="Thao tác phiếu bàn giao"><div class="transfer-review-workflow">
          ${canRevert?button('Trả về bản nháp','refresh',`revertTransferToDraft(${argument})`,'','Hoàn trả phiếu về trạng thái Mới (Nháp) để Giám định viên điều chỉnh'):''}
          ${canConfirm?button('Xác nhận đủ hồ sơ','check',`saveKeToanReviewAction(${argument}, 'da_xac_nhan')`,'transfer-review-button--primary'):''}
          ${canSubmit?button('Trình đề nghị thanh toán','card',`saveKeToanReviewAction(${argument}, 'da_trinh_dntt')`,'transfer-review-button--primary'):''}
          ${canEdit?button('Sửa & bổ sung phiếu','edit',`closeKeToanReviewModal(); openAddAccountingTransferModal(${argument})`,'transfer-review-button--primary'):''}
          ${canDelete?button('Xóa phiếu','trash',`deleteAccountingTransferBatch(${argument})`,'transfer-review-button--danger'):''}
        </div><div class="transfer-review-exports">${button('Xuất Excel','table',`exportAccountingTransferBatchExcel(${argument})`)}${button('In phiếu bàn giao','print',`printAccountingTransferBatch(${argument})`)}</div></div>
        <div class="transfer-review-body">
          <div class="transfer-review-summary">
            <article class="transfer-review-metric"><div class="transfer-review-metric-label">${transferReviewIcon('user')}Giám định viên bàn giao</div><div class="transfer-review-author"><span class="transfer-author-avatar">${escapeHtmlOutput(deriveInitials(author))}</span><strong>${escapeHtmlOutput(author)}</strong></div></article>
            <article class="transfer-review-metric"><div class="transfer-review-metric-label">${transferReviewIcon('folder')}Hồ sơ trong phiếu</div><div class="transfer-review-metric-value"><strong>${claims.length}</strong><span>hồ sơ</span></div></article>
            <article class="transfer-review-metric transfer-review-metric--total"><div class="transfer-review-metric-label">${transferReviewIcon('card')}Tổng tiền đề nghị chi</div><div class="transfer-review-metric-value"><strong>${formatCurrencyInputNumber(t.soTienDeNghi)}</strong><span>VNĐ</span></div></article>
          </div>
          ${t.ghiChuGdv?`<div class="transfer-review-note">${transferReviewIcon('edit')}<div><strong>Ghi chú bàn giao</strong><p>${escapeHtmlOutput(t.ghiChuGdv)}</p></div></div>`:''}
          ${supplementCount?`<div class="transfer-review-alert" role="status">${transferReviewIcon('alert')}<div><strong>${supplementCount} hồ sơ cần bổ sung chứng từ</strong><p>Xem nội dung phản hồi của Kế toán tại từng hồ sơ bên dưới.</p></div><span>${supplementCount} / ${claims.length}</span></div>`:''}
          <div class="transfer-review-content"><section class="transfer-review-claims-section" aria-labelledby="transferReviewClaimsTitle"><div class="transfer-review-section-heading"><span class="transfer-review-section-icon">${transferReviewIcon('folder')}</span><div><h4 id="transferReviewClaimsTitle">Hồ sơ bồi thường</h4><p>Danh sách hồ sơ trong phiếu bàn giao</p></div><span class="transfer-review-section-count">${claims.length} hồ sơ</span></div>
            <div class="transfer-review-table-shell"><table class="transfer-review-table"><colgroup><col style="width:5%"><col style="width:24%"><col style="width:21%"><col style="width:23%"><col style="width:15%"><col style="width:12%"></colgroup><thead><tr><th scope="col">STT</th><th scope="col">Biển số / Số HSBT</th><th scope="col">Chủ xe / Khách hàng</th><th scope="col">Gara</th><th scope="col">Tiền đề nghị</th><th scope="col">Trạng thái</th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="transfer-review-empty">Phiếu chưa có hồ sơ bồi thường.</td></tr>'}</tbody></table></div>
          </section><aside class="transfer-review-history" aria-labelledby="transferReviewHistoryTitle"><div class="transfer-review-section-heading"><span class="transfer-review-section-icon">${transferReviewIcon('clock')}</span><div><h4 id="transferReviewHistoryTitle">Lịch sử xét duyệt</h4><p>Bàn giao & cập nhật trạng thái</p></div></div>${events?`<ol class="transfer-review-timeline">${events}</ol>`:'<p class="transfer-review-history-empty">Chưa có lịch sử bàn giao.</p>'}</aside></div>
        </div><footer class="transfer-review-footer"><span>${transferReviewIcon('briefcase')}Thông tin phiếu bàn giao & xét duyệt</span>${button('Đóng','close','closeKeToanReviewModal()')}</footer>
      </section>`;
    }


    function activateTransferReviewDialog(overlay) {
      overlay.transferReviewPreviousFocus = document.activeElement;
      overlay.transferReviewPreviousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      overlay.addEventListener('keydown',event=>{
        if (event.defaultPrevented) return;
        if (event.key==='Escape') { event.preventDefault(); event.stopPropagation(); closeKeToanReviewModal(); return; }
        if (event.key!=='Tab') return;
        const buttons = Array.from(overlay.querySelectorAll('button:not([disabled]),[tabindex="0"]')).filter(el=>el.getClientRects().length);
        const first=buttons[0],last=buttons[buttons.length-1];
        if (event.shiftKey && (document.activeElement===first || document.activeElement===overlay.querySelector('.transfer-review-panel'))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first?.focus(); }
      });
      overlay.querySelector('.transfer-review-panel').focus({preventScroll:true});
    }


    function getClaimsRegisterPresentation(item) {
      const supplements=item.transfer.hoSoYeuCauBoSung||[];
      const needsSupplement=supplements.some(s=>Number(s.chiSo)===Number(item.claimIndex)||(s.soHoSoBoiThuong&&s.soHoSoBoiThuong===item.claim.soHoSoBoiThuong)||(s.bienSo&&s.bienSo===item.claim.bienSo))||item.claim.trangThaiBoSung==='yeu_cau_bo_sung';
      const liveClaim=Object.values(cachedPendingClaimsPayload||{}).find(c=>c.id===item.claim.id||(item.claim.soHoSoBoiThuong&&c.soHoSoBoiThuong===item.claim.soHoSoBoiThuong))||item.claim;
      const status=needsSupplement?{label:'Yêu cầu bổ sung',tone:'red',icon:'alert'}:item.claim.trangThaiBoSung==='da_bo_sung'?{label:'Đã bổ sung (Chờ duyệt)',tone:'amber',icon:'refresh'}:getTransferRegisterStatus(item.transfer.trangThai);
      const liveStatusKey=liveClaim.trangThai||'moi';
      const liveStatus=PENDING_STATUS_MAP[liveStatusKey]||{label:liveStatusKey};
      return {needsSupplement,status,liveStatus,priority:Boolean(item.claim.isUuTien)&&liveClaim.trangThai!=='da_thanh_toan'&&!needsSupplement};
    }

    function renderClaimsRegister({rows,summary,startIndex,displayStart,displayEnd,totalCount,page,totalPages}) {
      const options=[['all','Tất cả trạng thái',summary.total],['da_xac_nhan','Đã xác nhận',summary.confirmed],['can_bo_sung','Yêu cầu bổ sung',summary.supplement],['da_trinh_dntt','Đã trình ĐNTT',summary.submitted]];
      const raw=typeof activeAccountingClaimSearchRaw!=='undefined'?activeAccountingClaimSearchRaw:activeAccountingClaimSearch;
      const tableRows=rows.map((item,index)=>{
        const {status,needsSupplement,liveStatus,priority}=getClaimsRegisterPresentation(item);
        const id=String(item.transfer.transferId||'');
        const handler=`openAccountingClaimDetailModal(${escapeAttributeData(JSON.stringify(id))},${Number(item.claimIndex)})`;
        const claimNumber=String(item.claim.soHoSoBoiThuong||'Chưa có');
        const date=String(formatDateDisplay(item.transfer.ngayBanGiao));
        const split=date.indexOf(' ');
        const author=String(item.transfer.gdvName||'N/A');
        return `<tr class="claims-register-row ${needsSupplement?'claims-register-row--supplement':''}" onclick="${handler}">
          <td class="claims-register-index">${String(startIndex+index+1).padStart(2,'0')}</td>
          <td><span class="transfer-status-badge transfer-status-badge--${status.tone}">${transferReviewIcon(status.icon)}<span>${escapeHtmlOutput(status.label)}</span></span></td>
          <td><span class="claims-live-status">${escapeHtmlOutput(liveStatus.label)}</span></td>
          <td><div class="claims-register-reference"><button type="button" class="claims-register-id" onclick="event.stopPropagation(); ${handler}">${escapeHtmlOutput(claimNumber)}</button>${priority?`<span class="transfer-priority">${transferRegisterIcon('flag')}Ưu tiên</span>`:''}</div></td>
          <td><strong class="claims-register-owner">${escapeHtmlOutput(extractClaimOwnerName(item.claim)||'N/A')}</strong><span class="claims-register-plate">${escapeHtmlOutput(item.claim.bienSo||'N/A')}</span></td>
          <td><div class="transfer-register-author"><span class="transfer-author-avatar">${escapeHtmlOutput(deriveInitials(author))}</span><span>${escapeHtmlOutput(author)}</span></div></td>
          <td><div class="claims-register-date"><span>${escapeHtmlOutput(split<0?date:date.slice(0,split))}</span>${split>=0?`<small>${transferRegisterIcon('clock')}${escapeHtmlOutput(date.slice(split+1))}</small>`:''}</div></td>
          <td><span class="claims-register-batch">${escapeHtmlOutput(id||'N/A')}</span></td>
          <td><button type="button" class="transfer-row-button" aria-label="Mở hồ sơ ${escapeAttributeData(claimNumber)}" title="Xem chi tiết hồ sơ" onclick="event.stopPropagation(); ${handler}">${transferRegisterIcon('open')}</button></td>
        </tr>`;
      }).join('');
      return `<div class="accounting-transfer-register accounting-claims-register">
        <div class="transfer-register-toolbar"><div class="transfer-register-search">${transferRegisterIcon('search')}<input id="accountingSearchInput" class="input-premium" type="search" aria-label="Tìm hồ sơ đã nhận" autocomplete="off" placeholder="Tìm số HSBT, biển số, khách hàng, GĐV…" value="${escapeAttributeData(raw||'')}" oninput="changeAccountingClaimSearch(this.value)">${raw?`<button type="button" class="transfer-search-clear" aria-label="Xóa tìm kiếm" onclick="clearClaimsRegisterSearch()">${transferRegisterIcon('close')}</button>`:''}</div>
          <select id="claimsRegisterStatus" data-premium-select class="input-premium" aria-label="Lọc trạng thái hồ sơ" onchange="setClaimsRegisterFilter(this.value)">${options.map(([value,label,count])=>`<option value="${value}" ${value===activeAccountingClaimStatus?'selected':''}>${label} · ${count}</option>`).join('')}</select>
          <div class="transfer-register-controls"><span class="transfer-register-result" role="status" aria-live="polite"><strong>${displayStart}–${displayEnd}</strong> / ${totalCount} hồ sơ</span><select id="claimsRegisterPerPage" data-premium-select class="input-premium" aria-label="Số hồ sơ mỗi trang" onchange="setClaimsRegisterPerPage(this.value)">${[10,25,50,100].map(n=>`<option value="${n}" ${n===accClaimsPerPage?'selected':''}>${n} / trang</option>`).join('')}</select>${renderTransferRegisterPages(page,totalPages,'claims')}</div>
        </div><div class="transfer-register-table-shell claims-register-table-shell"><table class="p-table claims-register-table"><colgroup><col style="width:4%"><col style="width:11%"><col style="width:10%"><col style="width:18%"><col style="width:17%"><col style="width:12%"><col style="width:11%"><col style="width:13%"><col style="width:4%"></colgroup><thead><tr><th scope="col">STT</th><th scope="col">Trạng thái</th><th scope="col">Trạng thái thực tế</th><th scope="col">Số HSBT</th><th scope="col">Khách hàng / BKS</th><th scope="col">GĐV phụ trách</th><th scope="col">Ngày bàn giao</th><th scope="col">Phiếu bàn giao</th><th scope="col" aria-label="Thao tác"></th></tr></thead><tbody>${tableRows||`<tr><td colspan="9"><div class="transfer-register-empty"><div>${transferRegisterIcon('folder')}</div><strong>Không tìm thấy hồ sơ phù hợp</strong><p>Thử thay đổi từ khóa hoặc trạng thái đang lọc.</p></div></td></tr>`}</tbody></table></div>
      </div>`;
    }

    function setClaimsRegisterFilter(value) { changeAccountingClaimFilter(value);focusTransferRegisterSelect('claimsRegisterStatus'); }

    function setClaimsRegisterPerPage(value) { setAccClaimsPerPage(Number(value));focusTransferRegisterSelect('claimsRegisterPerPage'); }

    function navigateClaimsRegisterPage(page) { setAccClaimsPage(page);document.querySelector('.accounting-claims-register .transfer-register-pages [aria-current="page"]')?.focus({preventScroll:true}); }

    function clearClaimsRegisterSearch() { const input=document.getElementById('accountingSearchInput');if(input){input.value='';input.focus({preventScroll:true});}changeAccountingClaimSearch(''); }


    function renderAccountingClaimDetailView({transfer,claim,transferId,claimIndex,currentNote,isKeToanRole,isClaimBoSung,isClaimBoSungDone,isPriority,history}) {
      const argument=escapeAttributeData(JSON.stringify(String(transferId)));
      const index=Number(claimIndex);
      const icon=transferReviewIcon;
      const button=(label,glyph,handler,variant='')=>`<button type="button" class="transfer-review-button ${variant}" onclick="${handler}">${icon(glyph)}<span>${label}</span></button>`;
      const alertTone=isClaimBoSungDone?'amber':isClaimBoSung?'red':'green';
      const alertTitle=isClaimBoSungDone?'Đã bổ sung · Chờ Kế toán kiểm tra':isClaimBoSung?'Yêu cầu bổ sung chứng từ':'Hồ sơ đạt yêu cầu';
      const alertCopy=isClaimBoSungDone?'Giám định viên đã xác nhận bổ sung. Kế toán kiểm tra chứng từ để hoàn tất.':isClaimBoSung?currentNote:'Không có yêu cầu bổ sung tồn đọng.';
      const fields=[['Biển số xe',claim.bienSo||'N/A','plate'],['Số HSBT',claim.soHoSoBoiThuong||'Chưa có','number'],['Chủ xe / Khách hàng',extractClaimOwnerName(claim),'full'],['Gara sửa chữa',claim.tenGara||'N/A','full'],['Phiếu bàn giao',transfer.transferId||'N/A',''],['GĐV phụ trách',transfer.gdvName||'N/A','']];
      const events=history.map(h=>{
        const action=String(h.action||'Cập nhật hồ sơ');
        const actionKey=action.toLowerCase();
        const tone=actionKey.includes('xóa')?'blue':actionKey.includes('duyệt')||actionKey.includes('xác nhận')||actionKey.includes('hoàn tất')?'green':actionKey.includes('yêu cầu')?'red':'blue';
        return `<li class="transfer-review-event transfer-review-event--${tone}"><div class="transfer-review-event-date"><time>${escapeHtmlOutput(formatDateDisplay(h.time))}</time></div><strong>${escapeHtmlOutput(action)}</strong><div class="transfer-review-event-user">${icon('user')}<span>${escapeHtmlOutput(h.user||'Chưa cập nhật')}</span></div><p>${escapeHtmlOutput(h.detail||'—')}</p></li>`;
      }).join('');
      return `<section class="transfer-review-panel accounting-claim-panel" role="dialog" aria-modal="true" aria-labelledby="accountingClaimTitle" aria-describedby="accountingClaimReference" tabindex="-1">
        <header class="transfer-review-header"><div class="transfer-review-heading"><div class="transfer-review-heading-icon">${icon('folder')}</div><div><div class="transfer-review-eyebrow">HỒ SƠ KẾ TOÁN · TƯƠNG TÁC & BỔ SUNG</div><h3 id="accountingClaimTitle">Chi tiết hồ sơ</h3><div class="transfer-review-reference" id="accountingClaimReference"><strong>${escapeHtmlOutput(claim.soHoSoBoiThuong||'Chưa có số HSBT')}</strong><span>BKS · ${escapeHtmlOutput(claim.bienSo||'N/A')}</span>${isPriority?`<span class="transfer-priority">${icon('flag')}Ưu tiên</span>`:''}</div></div></div><div class="transfer-review-header-end"><button type="button" class="transfer-review-close" aria-label="Đóng chi tiết hồ sơ" onclick="closeAccountingClaimDetailModal()">${icon('close')}</button></div></header>
        <div class="transfer-review-body"><div class="claim-detail-layout"><div class="claim-detail-main">
          <div class="claim-detail-status claim-detail-status--${alertTone}" role="status">${icon(alertTone==='green'?'check':alertTone==='amber'?'refresh':'alert')}<div><strong>${alertTitle}</strong><p>${escapeHtmlOutput(alertCopy)}</p></div></div>
          <section class="claim-detail-information" aria-labelledby="claimDetailInformationTitle"><div class="transfer-review-section-heading"><span class="transfer-review-section-icon">${icon('folder')}</span><div><h4 id="claimDetailInformationTitle">Thông tin hồ sơ</h4><p>Khách hàng, đơn vị sửa chữa & bàn giao</p></div></div><dl class="claim-detail-fields">${fields.map(([label,value,kind])=>`<div class="claim-detail-field ${kind?'claim-detail-field--'+kind:''}"><dt>${label}</dt><dd>${escapeHtmlOutput(value)}</dd></div>`).join('')}</dl><div class="claim-detail-total"><div>${icon('card')}<span>Số tiền đề nghị chi</span></div><strong>${formatCurrencyInputNumber(claim.soTienDeNghi||transfer.soTienDeNghi)}<span>VNĐ</span></strong></div></section>
          ${isKeToanRole?`<section class="claim-detail-request" aria-labelledby="claimDetailRequestTitle"><div class="transfer-review-section-heading"><span class="transfer-review-section-icon">${icon('edit')}</span><div><h4 id="claimDetailRequestTitle">Yêu cầu bổ sung</h4><p>Ghi rõ chứng từ hoặc thông tin cần Giám định viên bổ sung.</p></div></div><label for="modalAccountingClaimNoteInput">Nội dung yêu cầu</label><textarea id="modalAccountingClaimNoteInput" class="textarea-premium" placeholder="Ví dụ: Bổ sung hóa đơn GTGT bản gốc, ảnh chứng từ…">${escapeHtmlOutput(currentNote||'')}</textarea><div class="claim-detail-actions">${currentNote?button('Xóa yêu cầu','trash',`deleteClaimSupplementRequest(${argument},${index})`,'transfer-review-button--danger')+button('Duyệt & hoàn tất','check',`approveClaimSupplementRequest(${argument},${index})`):''}${button('Gửi yêu cầu bổ sung','edit',`submitClaimSupplementRequest(${argument},${index})`,'transfer-review-button--primary')}</div></section>`:isClaimBoSung?`<section class="claim-detail-request"><div class="transfer-review-section-heading"><span class="transfer-review-section-icon">${icon('check')}</span><div><h4>Phản hồi của Giám định viên</h4><p>Xác nhận sau khi bổ sung đầy đủ chứng từ theo yêu cầu.</p></div></div><div class="claim-detail-actions">${button('Xác nhận đã bổ sung','check',`confirmClaimSupplementFulfilledByGdv(${argument},${index})`,'transfer-review-button--primary')}</div></section>`:''}
        </div><aside class="transfer-review-history claim-detail-history" aria-labelledby="claimDetailHistoryTitle"><div class="transfer-review-section-heading"><span class="transfer-review-section-icon">${icon('clock')}</span><div><h4 id="claimDetailHistoryTitle">Lịch sử tương tác</h4><p>Yêu cầu bổ sung & phản hồi hồ sơ</p></div><span class="transfer-review-section-count">${history.length}</span></div>${events?`<ol class="transfer-review-timeline">${events}</ol>`:`<div class="claim-detail-history-empty"><span>${icon('clock')}</span><strong>Chưa có lịch sử tương tác</strong><p>Các yêu cầu và phản hồi sẽ xuất hiện tại đây.</p></div>`}</aside></div></div>
        <footer class="transfer-review-footer"><span>${icon('folder')}Thông tin hồ sơ & yêu cầu bổ sung</span>${button('Đóng','close','closeAccountingClaimDetailModal()')}</footer>
      </section>`;
    }

    function activateAccountingClaimDialog(overlay) {
      overlay.claimDetailPreviousFocus=document.activeElement;
      overlay.claimDetailPreviousOverflow=document.body.style.overflow;
      document.body.style.overflow='hidden';
      overlay.addEventListener('keydown',event=>{
        if(event.defaultPrevented)return;
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAccountingClaimDetailModal();return;}
        if(event.key!=='Tab')return;
        const elements=Array.from(overlay.querySelectorAll('button:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(el=>el.getClientRects().length);
        const first=elements[0],last=elements[elements.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===overlay.querySelector('.accounting-claim-panel'))){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      });
      overlay.querySelector('.accounting-claim-panel').focus({preventScroll:true});
    }
