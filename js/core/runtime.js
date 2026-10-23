

    const STATUS_PENDING = 'Chờ điền';

    const STATUS_COMPLETED = 'Đã điền';


    const rootContainer = document.getElementById('appRoot');

    let dbNodeInstance = null;

    let localActiveCaseNode = null;

    let localActiveImageStack = [];

    let localActiveRequestedItems = [];

    let portalSearchTerm = '';

    let activeObjectUrls = [];

    
    let cachedReportRules = {
      phatSinhExcludes: 'tu_choi',
      tndsKeywords: 'tnds,trách nhiệm dân sự',
      unpaidStatuses: 'da_thanh_toan,da thanh toán,da_hoan_thanh,da hoàn thành,tu_choi',
      approvedStatuses: 'da_duyet_hsbt,cho_duyet_dntt,cho_kt_duyet,kt_duyet,da_thanh_toan',
      chuyenDnttStatuses: '',
      hsDpbtStatuses: 'moi,cho_giam_dinh_ht,da_giam_dinh_ht,cho_gdct,da_gdct,cho_duyet_pasc',
      onlyApprovedStatuses: 'da_duyet_hsbt,cho_kt_duyet',
      hsTonDays: 30,
      hsDpbtAmount: 50000000,
      avgAmount: 10000000,
      carplaKeywords: 'carpla',
      phatSinhDateField: 'ngayMoHs',
      daDuyetDateField: 'ngayMoHs',
      chuyenDnttDateField: 'ngayNhanDuHoSo',
      carplaDateField: 'toTrinhNgayDuyet',
      tndsTonDateField: 'none',
      hsTonDateField: 'ngayMoHs',
      hsDpbtDateField: 'none',
      avgAmountDateField: 'toTrinhNgayDuyet'
    };

let cachedCasesPayload = null;

    let cachedFieldReimbursementsPayload = null;

    let activeCaseFilter = 'all';

    let activeCasePage = 1;

    let activeCasePerPage = 10;

    let activeUserFilter = 'all';

    let activeDashboardTab = 'home';
 
    let activeCreateFlowMode = 'select';

    let activeUserProfile = null;

    let caseRequestedItemsDraft = [];

    let garageUploadsInFlight = 0;

    let garageAutosaveTimers = new Map();

    let garagePortalMounted = false;
 
    let cachedPendingClaimsPayload = {};

    let cachedPendingNotesPayload = {};

    let rawPendingClaimsPayload = {};

    let cachedClaimCancellationsPayload = {};

    let activePendingStatusFilter = ['all'];

    let editingCaseId = null;

    let editingPendingClaimId = null;

    let activeSystemAdminSubTab = 'users';

    let cachedAuditLogsPayload = {};

    let activeAuditLogsFilter = 'all';

    let auditLogsCurrentPage = 1;

    const auditLogsPerPage = 15;

    
    let pendingClaimsCurrentPage = 1;

    let pendingClaimsPerPage = 10;


    // QUẢN LÝ THEME STATE: Khởi tạo từ cấu hình lưu trữ
    let currentTheme = localStorage.getItem('claimvision-theme') || 'dark';


    document.addEventListener('DOMContentLoaded', initApplicationState);

    window.addEventListener('popstate', () => { if (window.firebase?.auth) evaluateViewRoutingState(firebase.auth().currentUser); });

    document.addEventListener('keydown', (event) => {
      const lightboxEl = document.getElementById('lightbox');
      const isLightboxOpen = lightboxEl && lightboxEl.classList.contains('show');
      if (isLightboxOpen) {
        if (event.key === 'Escape') { event.preventDefault(); closeLightbox(); return; }
        if (event.key === 'ArrowLeft') { event.preventDefault(); navigateLightbox(-1); return; }
        if (event.key === 'ArrowRight') { event.preventDefault(); navigateLightbox(1); return; }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); lightboxZoom(1); return; }
        if (event.key === '-' || event.key === '_') { event.preventDefault(); lightboxZoom(-1); return; }
        if (event.key === 'r' && !event.shiftKey) { event.preventDefault(); lightboxRotate(1); return; }
        if (event.key === 'R' && event.shiftKey) { event.preventDefault(); lightboxRotate(-1); return; }
        if (event.key === '0') { event.preventDefault(); lightboxResetTransform(); return; }
      }
      if (event.key === 'Escape' && document.getElementById('customCameraModal')?.style.display === 'flex') closeCustomCameraModal(false);
      if (event.key === 'Escape' && document.getElementById('profileModalOverlay')?.style.display === 'grid') closeUserProfileModal();
      if (event.key === 'Escape' && document.getElementById('createUserModalOverlay')?.style.display === 'grid') closeCreateUserModal();
      if (event.key === 'Escape' && document.getElementById('editUserModalOverlay')?.style.display === 'grid') closeEditUserModal();
      if (event.key === 'Escape' && document.getElementById('assignSoHsbtModalOverlay')?.style.display === 'grid') closeAssignSoHsbtModal();
      if (event.key === 'Escape' && document.getElementById('importExcelModalOverlay')?.style.display === 'grid') closeImportExcelModal();
      if (event.key === 'Escape' && document.getElementById('createCancellationProposalModalOverlay')?.style.display === 'grid') closeCreateCancellationProposalModal();
      if (event.key === 'Escape' && document.getElementById('importApprovedCancellationExcelModalOverlay')?.style.display === 'grid') closeImportApprovedCancellationExcelModal();
    });


    window.addEventListener('beforeunload', (event) => {
      const isCamOpen = document.getElementById('customCameraModal')?.style.display === 'flex';
      if (isCamOpen && typeof customCameraPhotos !== 'undefined' && customCameraPhotos.length > 0) {
        event.preventDefault();
        event.returnValue = 'Bạn có tệp ảnh chụp chưa lưu. Bạn có chắc muốn rời đi?';
        return event.returnValue;
      }
    });


    window.switchSystemAdminSubTab = switchSystemAdminSubTab;

    window.saveSystemGeminiApiKeyUI = saveSystemGeminiApiKeyUI;

    window.testGeminiApiKeyConnectionUI = testGeminiApiKeyConnectionUI;

    window.resetSystemGeminiApiKeyUI = resetSystemGeminiApiKeyUI;

    window.toggleShowGeminiKeyVisibility = toggleShowGeminiKeyVisibility;

    window.saveCloudinarySettingsUI = saveCloudinarySettingsUI;

    window.testCloudinaryConnectionUI = testCloudinaryConnectionUI;

    window.setAuditLogsFilter = setAuditLogsFilter;


    let cachedUsersPayload = {};


    // Close notification dropdown when clicking outside
    document.addEventListener('click', function(e) {
      const wrapper = document.getElementById('navNotificationWrapper');
      const menu = document.getElementById('notificationCenterDropdownMenu');
      if (wrapper && menu && !wrapper.contains(e.target)) {
        menu.style.display = 'none';
      }
    });


    // Global listener to close open submenus when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.header-nav-dropdown-wrapper')) {
        document.querySelectorAll('.header-nav-submenu').forEach(s => s.classList.remove('open'));
      }
    });


    // Auto update permissions preset when role selection changes
    document.addEventListener('change', function(e) {
      if (e.target && e.target.id === 'newAdminRole') {
        setFormUserPermissions('new', null, e.target.value);
      } else if (e.target && e.target.id === 'editAdminRole') {
        setFormUserPermissions('edit', null, e.target.value);
      }
    });


    const PENDING_STATUS_MAP = {
      'moi': { label: 'Mới', bg: 'rgba(148, 163, 184, 0.14)', color: '#64748b', border: 'rgba(148, 163, 184, 0.35)' },
      'cho_giam_dinh_ht': { label: 'Chờ giám định HT', bg: 'rgba(245, 158, 11, 0.14)', color: '#d97706', border: 'rgba(245, 158, 11, 0.35)' },
      'da_giam_dinh_ht': { label: 'Đã giám định HT', bg: 'rgba(2, 132, 199, 0.14)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.35)' },
      'cho_gdct': { label: 'Chờ GĐCT', bg: 'rgba(234, 88, 12, 0.14)', color: '#ea580c', border: 'rgba(234, 88, 12, 0.35)' },
      'da_gdct': { label: 'Đã GĐCT', bg: 'rgba(99, 102, 241, 0.14)', color: '#6366f1', border: 'rgba(99, 102, 241, 0.35)' },
      'cho_duyet_pasc': { label: 'Chờ duyệt PASC', bg: 'rgba(168, 85, 247, 0.14)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.35)' },
      'da_duyet_pasc': { label: 'Đã duyệt PASC', bg: 'rgba(217, 70, 239, 0.14)', color: '#d946ef', border: 'rgba(217, 70, 239, 0.35)' },
      'cho_duyet_hsbt': { label: 'Chờ duyệt HSBT', bg: 'rgba(244, 63, 94, 0.14)', color: '#f43f5e', border: 'rgba(244, 63, 94, 0.35)' },
      'da_duyet_hsbt': { label: 'Đã duyệt HSBT', bg: 'rgba(20, 184, 166, 0.14)', color: '#14b8a6', border: 'rgba(20, 184, 166, 0.35)' },
      'cho_duyet_dntt': { label: 'Chờ duyệt ĐNTT', bg: 'rgba(139, 92, 246, 0.14)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.35)' },
      'cho_kt_duyet': { label: 'Chờ KT duyệt', bg: 'rgba(6, 182, 212, 0.14)', color: '#06b6d4', border: 'rgba(6, 182, 212, 0.35)' },
      'kt_duyet': { label: 'KT duyệt', bg: 'rgba(13, 148, 136, 0.14)', color: '#0d9488', border: 'rgba(13, 148, 136, 0.35)' },
      'da_thanh_toan': { label: 'Đã Thanh toán', bg: 'rgba(16, 185, 129, 0.16)', color: '#10b981', border: 'rgba(16, 185, 129, 0.35)' },
      'tu_choi': { label: 'Từ chối', bg: 'rgba(239, 68, 68, 0.16)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.35)' }
    };


    let parsedExcelBatchRows = [];



let activePendingNotesStatusFilter = ['all'];

let activePendingNotesGdvFilter = 'all';


let pendingNotesCurrentPage = 1;

let pendingNotesPerPage = 20;


    let activeAssigningClaimId = null;


    let activePendingGdvFilter = ['all'];

    let activePendingPeriodFilter = 'all';

    let activePendingCoverageFilter = 'all';

    const PENDING_COVERAGE_FILTERS = {
      all: {label:'Tất cả phạm vi', detail:'Toàn bộ hồ sơ', color:'var(--primary)'},
      vcx: {label:'VCX', detail:'Vật chất xe · bao gồm hồ sơ kết hợp', color:'#3b82f6'},
      tnds: {label:'TNDS', detail:'Trách nhiệm dân sự · bao gồm hồ sơ kết hợp', color:'#a855f7'},
      both: {label:'VCX & TNDS', detail:'Hồ sơ có cả hai phạm vi', color:'#0d9488'},
      none: {label:'Chưa xác định', detail:'Chưa có thông tin VCX hoặc TNDS', color:'var(--text-muted)'}
    };


    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-dropdown-container, .custom-select-wrapper')) {
        closeAllCustomDropdowns();
      }
    });


    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const openMenu = Array.from(document.querySelectorAll('.custom-select-menu')).find(menu => menu.style.display === 'block');
      if (!openMenu) return;
      const trigger = openMenu.parentElement ? openMenu.parentElement.querySelector(':scope > button') : null;
      closeAllCustomDropdowns();
      trigger?.focus({ preventScroll: true });
      event.preventDefault();
    });


    document.addEventListener('keydown',event=>{
      const open=document.querySelector('.pending-filter-select.is-open, .pending-per-page.is-open');
      if(!open) return;
      if(event.key==='Escape') {const trigger=open.querySelector('.pending-filter-trigger');closeAllCustomDropdowns();trigger?.focus({preventScroll:true});event.preventDefault();}
      const menu=event.target.closest('.pending-filter-menu');
      if(menu&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        const options=[...menu.querySelectorAll('button:not(:disabled)')],index=options.indexOf(document.activeElement);
        const next=event.key==='Home'?0:event.key==='End'?options.length-1:event.key==='ArrowDown'?(index+1)%options.length:(index-1+options.length)%options.length;
        options[next]?.focus({preventScroll:true});event.preventDefault();
      }
    });


    // addRequestedItemsFromComposer removed (replaced by inline Excel-like grid actions)

    const EXCEL_CATEGORY_DEFS = {
      damages: {
        key: 'damages',
        label: 'Hạng mục tổn thất',
        code: 'MỤC 03',
        subtitle: 'Chi tiết vị trí va chạm, linh kiện & phụ tùng hư hỏng',
        color: 'var(--primary)',
        bg: 'rgba(216,180,109,0.12)',
        border: 'rgba(216,180,109,0.3)',
        svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`
      },
      overall: {
        key: 'overall',
        label: 'Ảnh tổng thể xe',
        code: 'MỤC 02',
        subtitle: 'Ảnh 4 góc chéo xe, tem đăng kiểm & số khung (VIN)',
        color: '#10b981',
        bg: 'rgba(16,185,129,0.12)',
        border: 'rgba(16,185,129,0.3)',
        svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`
      },
      documents: {
        key: 'documents',
        label: 'Giấy tờ xe',
        code: 'MỤC 01',
        subtitle: 'Cà vẹt, GPLX, Đăng kiểm & GCN bảo hiểm tiếp nhận',
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.12)',
        border: 'rgba(59,130,246,0.3)',
        svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`
      }
    };


    window.toggleExcelCategoryDropdown = toggleExcelCategoryDropdown;

    window.selectExcelCategory = selectExcelCategory;


    const SUGGESTIONS = {
      'Đầu xe': ['Cản trước', 'Đèn pha trái', 'Đèn pha phải', 'Mặt ca lăng', 'Nắp ca pô', 'Kính chắn gió trước'],
      'Thân xe': ['Tai xe trước trái', 'Tai xe trước phải', 'Gương trái', 'Gương phải', 'Cửa trước trái', 'Cửa trước phải', 'Cửa sau trái', 'Cửa sau phải'],
      'Đuôi xe & Khác': ['Cản sau', 'Cốp sau', 'Đèn hậu trái', 'Đèn hậu phải', 'Kính sau', 'Lốp/Mâm xe']
    };


    let activeOcrTab = 'image';

    let ocrExtractedItemsList = [];


    let ocrPanelExpanded = false;

    window.toggleSidebarCollapse = toggleSidebarCollapse;


    window.triggerAddNewGarageItemFromPortal = triggerAddNewGarageItemFromPortal;

    window.triggerRemoveGarageCustomItem = triggerRemoveGarageCustomItem;

    window.toggleEvidenceGroupSection = toggleEvidenceGroupSection;

    window.toggleAllSections = toggleAllSections;

    window.toggleSingleCardCollapse = toggleSingleCardCollapse;

    window.triggerUploadFromGallery = triggerUploadFromGallery;

    window.openMobileCameraForEvidence = openMobileCameraForEvidence;

    window.closeCameraViewfinderWithGuideModal = closeCameraViewfinderWithGuideModal;


    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-premium-combobox') && !e.target.closest('#globalDamagePopoverMenu')) {
        const menu = document.getElementById('globalDamagePopoverMenu');
        if (menu) {
          menu.style.display = 'none';
          delete menu.dataset.activeCardIndex;
        }
        document.querySelectorAll('[id^="customDropdownArrow_"]').forEach(el => el.style.transform = 'rotate(0deg)');
      }
      if (!e.target.closest('.excel-category-combobox-wrap') && !e.target.closest('#globalExcelCategoryPopoverMenu')) {
        const catMenu = document.getElementById('globalExcelCategoryPopoverMenu');
        if (catMenu) {
          catMenu.style.display = 'none';
          delete catMenu.dataset.activeCardIndex;
        }
        document.querySelectorAll('[id^="excelCatArrow_"]').forEach(el => el.style.transform = 'rotate(0deg)');
      }
    });


    window.addEventListener('scroll', () => {
      const menu = document.getElementById('globalDamagePopoverMenu');
      if (menu && menu.style.display === 'block') {
        const itemIndex = menu.dataset.activeCardIndex;
        const comboboxWrap = document.getElementById(`damageCombobox_${itemIndex}`);
        if (comboboxWrap) {
          const rect = comboboxWrap.getBoundingClientRect();
          menu.style.top = `${rect.bottom + 6}px`;
          menu.style.left = `${rect.left}px`;
          menu.style.width = `${rect.width}px`;
        }
      }
      const catMenu = document.getElementById('globalExcelCategoryPopoverMenu');
      if (catMenu && catMenu.style.display === 'block') {
        const itemIndex = catMenu.dataset.activeCardIndex;
        const btnWrap = document.getElementById(`excelCategoryWrap_${itemIndex}`);
        if (btnWrap) {
          const rect = btnWrap.getBoundingClientRect();
          catMenu.style.top = `${rect.bottom + 6}px`;
          catMenu.style.left = `${rect.left}px`;
          catMenu.style.width = `${Math.max(rect.width, 275)}px`;
        }
      }
    }, { passive: true });


    window.triggerAddNewGarageItemFromPortal = triggerAddNewGarageItemFromPortal;

    window.triggerRemoveGarageCustomItem = triggerRemoveGarageCustomItem;

    window.toggleEvidenceGroupSection = toggleEvidenceGroupSection;

    window.filterPortalHangMucCards = filterPortalHangMucCards;

    window.toggleDamageSeverityTag = toggleDamageSeverityTag;

    window.setProposedAction = setProposedAction;

    window.saveDamageSeverityCustom = saveDamageSeverityCustom;

    window.toggleCustomDamageDropdown = toggleCustomDamageDropdown;

    window.applyCustomPresetNote = applyCustomPresetNote;

    window.saveGarageEvidenceNoteDirect = saveGarageEvidenceNoteDirect;


let lastFetchedGpsCoords=null,lastFetchedAddress=null,gpsPermissionDenied=false;

const cameraLocationState={positionRequest:null,latest:null,addressCache:[],addressRequests:new Map(),addressQueue:Promise.resolve(),lastAddressRequestAt:0,uiRevision:0};

const cameraPhotoMetadata=new WeakMap();


const cameraUiState={session:0,captureBusy:false,previousOverflow:null,previousFocus:null,photoUrls:new Map(),sensorPermission:null,physicalOrientation:null};

window.addEventListener('resize',syncCameraViewport);

window.addEventListener('orientationchange',()=>{syncCameraViewport();setTimeout(syncCameraViewport,250);});

window.visualViewport?.addEventListener('resize',syncCameraViewport);

screen.orientation?.addEventListener?.('change',syncCameraViewport);

document.getElementById('customCameraVideo')?.addEventListener('resize',syncCameraViewport);

document.getElementById('customCameraVideo')?.addEventListener('loadedmetadata',syncCameraViewport);


    let customCameraStream = null;

    let customCameraFacingMode = 'environment';

    let customCameraPhotos = [];

    let customCameraRequestIndex = null;

    let customCameraTorchActive = false;


    let customCameraFocusTimeout = null;


    window.toggleAppraisalPicker = toggleAppraisalPicker;

    window.toggleMapImageFromPool = toggleMapImageFromPool;


    let lightboxUrls = [];

    let lightboxCurrentIndex = 0;

    let lightboxRequestIndex = null;

    let lightboxTouchStartX = 0;

    let lightboxTouchEndX = 0;

    let lightboxZoomLevel = 1;

    let lightboxRotation = 0;


    document.addEventListener('DOMContentLoaded', () => {
      const lightboxContainer = document.getElementById('lightbox');
      if (lightboxContainer) {
        lightboxContainer.addEventListener('touchstart', handleLightboxTouchStart, { passive: true });
        lightboxContainer.addEventListener('touchend', handleLightboxTouchEnd, { passive: true });
        lightboxContainer.addEventListener('wheel', (e) => {
          if (!lightboxContainer.classList.contains('show')) return;
          e.preventDefault();
          if (e.deltaY < 0) {
            lightboxZoom(1);
          } else {
            lightboxZoom(-1);
          }
        }, { passive: false });
      }
    });

  
    /****************************************************
     * BÁO CÁO GIÁM ĐỊNH VIÊN & BIỂU ĐỒ KPI TÍNH LƯƠNG (UNIFIED)
     * TOGGLE BETWEEN MASTER TABLE & ULTRA-SLEEK LINE CHART
     ****************************************************/
    let activeSelectedGdvNames = ['Hồ Quang Huy', 'Huỳnh Văn Phúc', 'Nguyễn Quang Huy_DL'];

    let activeGdvReportStartDate = "";

    let activeGdvReportEndDate = "";

    let activeGdvReportWeek = "current";

    let activeGdvReportMonth = String(new Date().getMonth() + 1);

    let activeGdvReportYear = String(new Date().getFullYear());

    let activeAnnualClaimsYear = String(new Date().getFullYear());

    let activeCarBrandReportMonths = ['all'];

    let activeCarBrandReportYears = [String(new Date().getFullYear())];

    let activeGdvReportBranch = 'all';

    let activeGdvReportGara = 'all';

    let activeGdvReportDaysRange = 'all';

    let activeGdvReportSearch = '';

    
    // Personalized Favorite Filters for Reports
    let userFavoriteFilters = [];

    let hasAppliedDefaultFilter = false;

    let activeFavoriteFiltersUid = null;

    let activeCarBrandChartTopN = 10;

    let activeCarBrandChartType = 'bar';

    let activeGarageChartTopN = 20;

    let activeGarageChartType = 'bar';

    let garageLossChartInstance = null;

    let activeGdvKpiChartType = 'line';

    let gdvKpiChartInstance = null;

    let cachedCurrentGdvKpiRows = [];

    let carBrandChartInstance = null;

    let activeGdvReportView = 'weekly_zone';
 // 'table' | 'chart'
    let activeAnnualClaimsChartType = 'line';

    let annualClaimsChartInstance = null;

    let activeSelectedDakLakStatuses = ['da_duyet_pasc', 'cho_duyet_hsbt'];

    let activeReportClaimType = 'all';

    let activeDakLakMinReserve = 100000000;

    let activeTndsReportSearch = '';

    let activeTndsNoteFilter = 'all';
 // 'all' | 'has_note' | 'no_note'
    let activeTndsStatusFilter = 'all';

    let activeOpenDropdownId = null;

    const DEFAULT_WEEKLY_REPORT_COLS = ['PHAT_SINH', 'DA_DUYET', 'CHUA_DUYET', 'CHUYEN_DNTT', 'LGN_CARPLA', 'TNDS_TON', 'HS_TON_30', 'HS_DPBT_50', 'AVG_10', 'REV_CARPLA'];

    let activeWeeklyReportCols = (function() {
      try {
        const saved = localStorage.getItem('claimvision-weekly-report-cols');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.error('Lỗi khi đọc cấu hình cột báo cáo tuần từ localStorage:', e);
      }
      return [...DEFAULT_WEEKLY_REPORT_COLS];
    })();


    const DEFAULT_TON_CHUA_HD_COLS = ['SO_HSBT', 'BIEN_SO', 'CHU_XE', 'HANG_XE', 'CBXL', 'TIEN_DUYET', 'NGAY_NHAN_DU', 'NGAY_CHUYEN_KT', 'NGAY_DUYET', 'SO_NGAY_DUYET'];

    let activeTonChuaHdReportCols = (function() {
      try {
        const saved = localStorage.getItem('claimvision-ton-chua-hd-cols');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
      return [...DEFAULT_TON_CHUA_HD_COLS];
    })();


    // Global Click Listener to Close Custom Dropdowns
    if (!window.hasRegisteredCustomDropdownListener) {
      window.hasRegisteredCustomDropdownListener = true;
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-wrapper')) {
          document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
          activeOpenDropdownId = null;
        }
      });
    }


    const tabFilterState = {};


        let cachedCurrentGarageRows = [];


    let cachedContainerRect = null;


    window.showGarageChartTooltip = function(evt, garageKey) {
      const tooltip = document.getElementById('garageChartTooltip');
      const container = document.getElementById('garageChartWrapContainer');
      if (!tooltip || !cachedCurrentGarageRows) return;
      const g = cachedCurrentGarageRows.find(row => row.key === garageKey);
      if (!g) return;

      if (container) {
        cachedContainerRect = container.getBoundingClientRect();
      }

      const colors2 = ['#93c5fd', '#fde047', '#6ee7b7', '#fca5a5', '#c4b5fd'];
      const gdvList = selectedGdvList.map((gName, idx) => {
        const data = g.gdvBreakdown[gName] || { opened: 0, amount: 0, approved: 0 };
        return { name: gName, data: data, color: colors2[idx % colors2.length] };
      });
      gdvList.sort((a, b) => (b.data.opened || 0) - (a.data.opened || 0));

      const gdvBreakdownHtml = gdvList.map(item => `
        <div style="color: ${item.color}; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <span style="display: flex; align-items: center; gap: 5px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ${escapeHtmlOutput(item.name)}:</span>
          <strong style="">${item.data.approved} hồ sơ (${formatCurrencyInputNumber(item.data.amount)}đ)</strong>
        </div>
      `).join('');

      tooltip.innerHTML = `
        <div style="font-weight: 850; font-size: 13.5px; color: #ffffff; margin-bottom: 3px;">${escapeHtmlOutput(g.name)}</div>
        ${g.code !== 'N/A' && g.code !== g.name ? `<div style="font-size: 11px; color: rgba(255,255,255,0.7); margin-bottom: 8px;">Mã Gara: ${escapeHtmlOutput(g.code)}</div>` : '<div style="margin-bottom: 6px;"></div>'}
        
        <div style="border-top: 1px solid rgba(255,255,255,0.15); padding-top: 8px; margin-top: 4px; display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; gap: 14px;">
            <span style="color: rgba(255,255,255,0.8);">Tiền bồi thường:</span>
            <strong style="color: #34d399;  font-weight: 850;">${formatCurrencyInputNumber(g.totalApprovedAmount)} đ</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 14px;">
            <span style="color: rgba(255,255,255,0.8);">Tổng số hồ sơ:</span>
            <strong style="color: #60a5fa;  font-weight: 850;">${g.totalClaimsCount} ca</strong>
          </div>
          
          <div style="border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 6px; margin-top: 4px; font-size: 11.5px; display: flex; flex-direction: column; gap: 4px;">
            <div style="color: rgba(255,255,255,0.95); font-weight: 800;">Phân bổ Giám định viên:</div>
            ${gdvBreakdownHtml}
          </div>
        </div>
      `;

      tooltip.style.display = 'block';
      moveGarageChartTooltip(evt);
    };


    window.moveGarageChartTooltip = function(evt) {
      const tooltip = document.getElementById('garageChartTooltip');
      if (!tooltip || !cachedContainerRect) return;

      const mouseX = evt.clientX - cachedContainerRect.left;
      const mouseY = evt.clientY - cachedContainerRect.top;

      let left = mouseX + 15;
      let top = mouseY - 80;

      if (left + 280 > cachedContainerRect.width) {
        left = mouseX - 295;
      }
      if (top < 10) top = 10;

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    };


    window.hideGarageChartTooltip = function() {
      const tooltip = document.getElementById('garageChartTooltip');
      if (tooltip) tooltip.style.display = 'none';
    };


const renderGdvReportPage = function(targetContainer) { return renderGdvMonthlyReportPage(targetContainer); };


    let pendingGdvReportStartDate = "";

    let pendingGdvReportEndDate = "";


    let reportDatePickerFocus = 'start';

    let reportDatePickerViewMonth = null;

    let reportDatePickerDraftStart = '';

    let reportDatePickerDraftEnd = '';




    /****************************************************
     * CẤU HÌNH HỆ SỐ KPI HỒ SƠ THEO SỐ TIỀN BỒI THƯỜNG & LOẠI HỒ SƠ (VCX / TNDS)
     ****************************************************/
    let defaultKpiCoefConfig = [
      { id: 'vcx_1', type: 'VCX', fromAmt: 0, toAmt: 49999999, coef: 1.0, label: 'Dưới 50 triệu VNĐ' },
      { id: 'vcx_2', type: 'VCX', fromAmt: 50000000, toAmt: 99999999, coef: 1.5, label: 'Từ 50tr - dưới 100tr VNĐ' },
      { id: 'vcx_3', type: 'VCX', fromAmt: 100000000, toAmt: 200000000, coef: 2.0, label: 'Từ 100tr - 200tr VNĐ' },
      { id: 'vcx_4', type: 'VCX', fromAmt: 200000001, toAmt: 999999999999, coef: 4.0, label: 'Trên 200 triệu VNĐ' },
      { id: 'tnds_1', type: 'TNDS', fromAmt: 0, toAmt: 999999999999, coef: 3.0, label: 'Mọi hạn mức TNDS' }
    ];




    /****************************************************
     * ACCOUNTING TRANSFER MODULE (QUẢN LÝ BÀN GIAO KẾ TOÁN) - AUTO DETECT ROLE FROM LOGGED IN USER
     ****************************************************/
    let cachedAccountingTransfersPayload = {};

    let activeAccountingStatusFilter = 'all';

    let activeAccountingSearch = '';

    let activeAccountingSearchRaw = '';

    let accountingTransferSearchTimeout = null;

    let accTransfersCurrentPage = 1;

    let accTransfersPerPage = 10;

    
    // In-memory selection state for modal
    let currentBatchSelectedClaims = [];


    // SVG Vectors Definition for Clean Render
    const ACC_SVGS = {
      FIRE: `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none"><path d="M12 23c4.97 0 9-3.58 9-8 0-4.17-3.07-6.27-4.66-8.08C14.77 5.11 14 3 14 1c-1.5 2-3 4.5-3 7 0 .55.45 1 1 1s1-.45 1-1c0-1.2.7-2.7 1.6-4.1 1.25 1.54 3.4 3.32 3.4 6.6 0 2.76-2.24 5-5 5s-5-2.24-5-5c0-1.8 1.1-3.6 2-4.9-1.8.8-4 2.8-4 5.9 0 4.42 4.03 8 9 8z"/></svg>`,
      INBOX: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>`,
      WARNING: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      CHECK_CIRCLE: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
      USER: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
      BRIEFCASE: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
      SEARCH: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
      LIST: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`,
      EDIT: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
      REFRESH: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`,
      TRASH: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
      FOLDER: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
      PLUS_CIRCLE: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`,
      FILE_TEXT: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
    };


    const ACCOUNTING_STATUS_MAP = {
      'moi': { label: 'Mới (Nháp)', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.32)', text: '#3b82f6', svg: ACC_SVGS.EDIT },
      'cho_xac_nhan': { label: 'Chờ xác nhận', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.32)', text: '#f59e0b', svg: ACC_SVGS.INBOX },
      'da_nhan_ho_so': { label: 'Đã nhận từ GĐV', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6', svg: ACC_SVGS.INBOX },
      'da_xac_nhan': { label: 'Đã xác nhận', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.32)', text: '#10b981', svg: ACC_SVGS.CHECK_CIRCLE },
      'da_nhan_du_ho_so': { label: 'Đã xác nhận', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.32)', text: '#10b981', svg: ACC_SVGS.CHECK_CIRCLE },
      'can_bo_sung': { label: 'Yêu cầu bổ sung', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#ef4444', svg: ACC_SVGS.WARNING },
      'da_trinh_dntt': { label: 'Đã trình ĐNTT', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.32)', text: '#8b5cf6', svg: ACC_SVGS.CHECK_CIRCLE }
    };


    let activeAccountingClaimStatus = 'all';

    let activeAccountingClaimSearch = '';

    let activeAccountingClaimSearchRaw = '';

    let accountingSearchTimeout = null;

    let accClaimsCurrentPage = 1;

    let accClaimsPerPage = 10;


    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      const btn = document.getElementById('btnAccCustomPerPageDropdown');
      const menu = document.getElementById('menuAccCustomPerPageDropdown');
      if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
      }
      
      const btnT = document.getElementById('btnAccTransfersCustomPerPageDropdown');
      const menuT = document.getElementById('menuAccTransfersCustomPerPageDropdown');
      if (menuT && btnT && !btnT.contains(e.target) && !menuT.contains(e.target)) {
        menuT.style.display = 'none';
        const arrowT = btnT.querySelector('svg');
        if (arrowT) arrowT.style.transform = 'rotate(0deg)';
      }
      
      const btnTSF = document.getElementById('btnAccTransfersStatusFilterDropdown');
      const menuTSF = document.getElementById('menuAccTransfersStatusFilterDropdown');
      if (menuTSF && btnTSF && !btnTSF.contains(e.target) && !menuTSF.contains(e.target)) {
        menuTSF.style.display = 'none';
        const arrowTSF = btnTSF.querySelector('svg');
        if (arrowTSF) arrowTSF.style.transform = 'rotate(0deg)';
      }
    });


    document.addEventListener('click', function(e) {
      const wrapper = document.getElementById('accClaimStatusFilterWrapper');
      const menu = document.getElementById('accClaimStatusFilterMenu');
      const arrow = document.getElementById('accClaimFilterChevron');
      if (wrapper && menu && !wrapper.contains(e.target)) {
        menu.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
      }
    });


    // Debounce helper to prevent search lagging on keystrokes
    let searchDebounceTimeout = null;


    let debouncePendingTimeout = null;


    let debounceCaseTimeout = null;


    let debounceAuditTimeout = null;


    let debounceUserTimeout = null;


    
    window.initCarBrandChart = function() {
      const canvas = document.getElementById('carBrandLossCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      const fullList = getCarBrandLossData();
      let list = [];
      if (activeCarBrandChartTopN >= fullList.length) {
        list = fullList;
      } else {
        list = fullList.slice(0, activeCarBrandChartTopN);
        const rest = fullList.slice(activeCarBrandChartTopN);
        const restCount = rest.reduce((sum, item) => sum + item.count, 0);
        const restAmount = rest.reduce((sum, item) => sum + item.totalAmount, 0);
        if (restCount > 0) {
          list.push({ brand: 'Các hãng khác', count: restCount, totalAmount: restAmount });
        }
      }
      
      if (carBrandChartInstance) {
        carBrandChartInstance.destroy();
      }
      

      const isDark = !document.body.classList.contains('light-mode');
      const reportStyle = getComputedStyle(canvas.closest('.report-pending-premium') || canvas);
      const textColor = reportStyle.getPropertyValue('--ton-ink').trim() || (isDark ? '#f0f2eb' : '#283b36');
      
      const canvasWrap = document.getElementById("carBrandLossCanvasWrap") || canvas.parentElement;
      if (activeCarBrandChartType === 'pie') {
        canvasWrap.style.height = activeCarBrandChartTopN > 10 ? '600px' : '500px';
      } else {
        canvasWrap.style.height = '400px';
      }

      const gridColor = reportStyle.getPropertyValue('--ton-line').trim() || (isDark ? '#2a3840' : '#e5e8e0');
      const surfaceColor = reportStyle.getPropertyValue('--ton-paper').trim() || (isDark ? '#121e27' : '#fffefb');
      const compactChart = canvasWrap.clientWidth < 640;
      
      const labels = list.map(item => item.brand);
      const data = list.map(item => item.totalAmount);
      
      // Ultra-Premium vibrant palette (repeated if needed)
      const coreColors = [
        '216, 180, 109', '59, 130, 246', '16, 185, 129', '239, 68, 68', '245, 158, 11',
        '139, 92, 246', '20, 184, 166', '236, 72, 153', '99, 102, 241', '14, 165, 233',
        '244, 63, 94', '168, 85, 247', '14, 116, 144', '21, 128, 61', '161, 98, 7'
      ];
      const baseColors = list.map((_, i) => coreColors[i % coreColors.length]);
      if (list.length > 0 && list[list.length-1].brand === 'Các hãng khác') {
        baseColors[list.length-1] = '100, 116, 139'; // Slate for others
      }
      
      const bgColors = baseColors.map(c => `rgba(${c}, 0.85)`);
      const hoverBgColors = baseColors.map(c => `rgba(${c}, 1)`);
      const borderColors = baseColors.map(c => `rgba(${c}, 1)`);

      
      const customOutlabelsPlugin = {
        id: 'customOutlabels',
        afterDraw: function(chart) {
          if (chart.config.type !== 'doughnut') return;
          const ctx = chart.ctx;
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          const total = dataset.data.reduce((a, b) => a + b, 0);

          ctx.save();
          ctx.textBaseline = 'middle';
          
          const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
          ctx.textAlign = 'center';
          
          const isDarkTheme = !document.body.classList.contains('light-mode');
          
          ctx.shadowColor = isDarkTheme ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.15)';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          
          ctx.fillStyle = isDarkTheme ? '#94a3b8' : '#64748b';
          ctx.font = "700 13px 'Plus Jakarta Sans', sans-serif";
          // Add letter spacing trick by manually spacing characters? No, just keep it clean.
          ctx.fillText('TỔNG CỘNG', centerX, centerY - 16);
          
          ctx.fillStyle = textColor;
          ctx.font = "900 28px 'Plus Jakarta Sans', sans-serif";
          let totalStr = '';
          if (total >= 1000000000) totalStr = (total / 1000000000).toFixed(2) + ' Tỷ';
          else if (total >= 1000000) totalStr = (total / 1000000).toFixed(1) + ' Tr';
          else totalStr = formatCurrencyInputNumber(total);
          ctx.fillText(totalStr, centerX, centerY + 16);

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          if (compactChart) { ctx.restore(); return; }
          let lastYRight = -9999;
          let lastYLeft = 9999;
          
          ctx.font = "700 11.5px 'Plus Jakarta Sans', sans-serif";

          meta.data.forEach((element, index) => {
            const val = dataset.data[index];
            if (!val) return;
            const percentage = ((val / total) * 100).toFixed(1) + '%';
            
            let valStr = '';
            if (val >= 1000000000) valStr = (val / 1000000000).toFixed(1) + ' Tỷ';
            else if (val >= 1000000) valStr = (val / 1000000).toFixed(1) + ' Tr';
            else if (val >= 1000) valStr = (val / 1000).toFixed(0) + ' K';
            else valStr = val;

            const labelStr = `${chart.data.labels[index]} ${percentage} (${valStr})`;

            const chartCenter = { x: element.x, y: element.y };
            const angle = (element.startAngle + element.endAngle) / 2;
            const outerRadius = element.outerRadius;
            
            const startX = chartCenter.x + Math.cos(angle) * outerRadius;
            const startY = chartCenter.y + Math.sin(angle) * outerRadius;

            const isRight = Math.cos(angle) > 0;
            const breakX = chartCenter.x + Math.cos(angle) * (outerRadius + 15);
            const breakY = chartCenter.y + Math.sin(angle) * (outerRadius + 15);
            
            let targetY = breakY;
            if (isRight) {
              if (targetY < lastYRight + 20) targetY = lastYRight + 20;
              lastYRight = targetY;
            } else {
              if (targetY > lastYLeft - 20) targetY = lastYLeft - 20;
              lastYLeft = targetY;
            }
            
            // Align all texts to a fixed horizontal distance from the center
            const fixedX = chartCenter.x + (isRight ? outerRadius + 45 : -(outerRadius + 45));

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(breakX, targetY);
            ctx.lineTo(fixedX, targetY);
            const surfaceColor = reportStyle.getPropertyValue('--ton-paper').trim() || (isDark ? '#121e27' : '#fffefb');
            ctx.strokeStyle = dataset.borderColor[index] === surfaceColor ? dataset.backgroundColor[index] : dataset.borderColor[index];
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = !document.body.classList.contains('light-mode') ? '#cbd5e1' : '#475569';
            ctx.textAlign = isRight ? 'left' : 'right';
            ctx.fillText(labelStr, isRight ? fixedX + 8 : fixedX - 8, targetY);
          });
          ctx.restore();
        }
      };
      
      const actualType = activeCarBrandChartType === 'pie' ? 'doughnut' : 'bar';


      const config = {
        type: actualType,
        data: {
          labels: labels,
          datasets: (function() {
            const ds = [{
              type: actualType,
              label: 'Tổng tiền bồi thường',
              data: data,
              backgroundColor: bgColors,
              hoverBackgroundColor: hoverBgColors,
              borderColor: actualType === 'doughnut' ? surfaceColor : borderColors,
              borderWidth: actualType === 'doughnut' ? 3 : 1,
              borderRadius: actualType === 'bar' ? { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 } : 0,
              hoverOffset: actualType === 'doughnut' ? 10 : 0,
              yAxisID: actualType === 'bar' ? 'y' : undefined
            }];
            if (actualType === 'bar') {
              ds.push({
                type: 'line',
                label: 'Số lượng hồ sơ',
                data: list.map(item => item.count),
                borderColor: isDark ? '#f87171' : '#ef4444',
                backgroundColor: isDark ? 'rgba(248, 113, 113, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                borderWidth: 3,
                tension: 0.4,
                pointBackgroundColor: isDark ? '#f87171' : '#ef4444',
                pointBorderColor: surfaceColor,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                yAxisID: 'y1'
              });
            }
            return ds;
          })()
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          devicePixelRatio: Math.max(window.devicePixelRatio || 1, 3),
          cutout: activeCarBrandChartType === 'pie' ? '65%' : undefined,
          layout: {
            padding: activeCarBrandChartType === 'pie' ? (compactChart ? { top: 16, bottom: 10, left: 8, right: 8 } : { top: 60, bottom: 50, left: 160, right: 160 }) : 0
          },
          animation: {
            duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: {
              display: activeCarBrandChartType === 'bar' || compactChart,
              position: compactChart ? 'bottom' : 'top',
              align: 'end',
              labels: { 
                color: textColor, 
                font: { family: "'Plus Jakarta Sans', sans-serif", weight: '800', size: 12 },
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              titleColor: isDark ? '#ffffff' : '#0f172a',
              bodyColor: isDark ? '#cbd5e1' : '#475569',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderWidth: 1,
              padding: 14,
              cornerRadius: 12,
              displayColors: true, usePointStyle: true,
              boxPadding: 6,
              titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '800' },
              bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '700' },
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) { label += ': '; }
                  
                  if (context.dataset.type === 'line' || context.dataset.yAxisID === 'y1') {
                    label += context.parsed.y + ' hồ sơ';
                  } else {
                    if (context.parsed.y !== null && activeCarBrandChartType === 'bar') {
                      label += formatCurrencyInputNumber(context.parsed.y) + ' đ';
                    } else if (context.parsed !== null && activeCarBrandChartType === 'pie') {
                      label += formatCurrencyInputNumber(context.parsed) + ' đ';
                    }
                  }
                  return label;
                }
              }
            }
          },
        }
      };

      if (activeCarBrandChartType === 'bar') {
        config.options.scales = {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: { color: gridColor, drawBorder: false, borderDash: [5, 5] },
            border: { display: false },
            ticks: {
              color: textColor,
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '700' },
              padding: 10,
              callback: function(value) {
                if (value >= 1000000000) return (value / 1000000000).toFixed(1) + ' Tỷ';
                if (value >= 1000000) return (value / 1000000).toFixed(0) + ' Tr';
                if (value >= 1000) return (value / 1000).toFixed(0) + ' K';
                return value;
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: isDark ? '#f87171' : '#ef4444',
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '850' },
              padding: 10,
              callback: function(value) {
                return value + ' hs';
              }
            }
          },
          x: {
            grid: { display: false, drawBorder: false },
            border: { display: false },
            ticks: { 
              color: textColor, 
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '800' },
              padding: 10 
            }
          }
        };
      }

      config.plugins = config.plugins || [];
      
      const customCanvasBackgroundColor = {
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart) => {
          const {ctx} = chart;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = surfaceColor; // or use the background color variable
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        }
      };

      
      const customBarLabelsPlugin = {
        id: 'customBarLabels',
        afterDatasetsDraw(chart, args, options) {
          if (chart.config.type !== 'bar') return;
          const { ctx } = chart;
          ctx.save();
          ctx.font = "800 10.5px 'Plus Jakarta Sans', sans-serif";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const isDark = !document.body.classList.contains('light-mode');

          const barMeta = chart.getDatasetMeta(0);
          const lineMeta = chart.data.datasets.length > 1 ? chart.getDatasetMeta(1) : null;
          
          if (barMeta.hidden) { ctx.restore(); return; }

          barMeta.data.forEach((barEl, index) => {
            const barVal = chart.data.datasets[0].data[index];
            if (!barVal) return;
            
            let barStr = '';
            if (barVal >= 1000000000) barStr = (barVal / 1000000000).toFixed(1) + ' Tỷ';
            else if (barVal >= 1000000) barStr = (barVal / 1000000).toFixed(0) + ' Tr';
            else if (barVal >= 1000) barStr = (barVal / 1000).toFixed(0) + ' K';
            else barStr = barVal;

            const barHeight = barEl.base - barEl.y;
            let barTextY = barHeight > 24 ? barEl.y + 12 : barEl.y - 10;
            let barTextColor = barHeight > 24 ? 'rgba(255,255,255,0.9)' : (isDark ? '#94a3b8' : '#64748b');

            let lineTextY = null;
            let lineStr = '';
            
            if (lineMeta && !lineMeta.hidden && lineMeta.data[index]) {
              const lineEl = lineMeta.data[index];
              const lineVal = chart.data.datasets[1].data[index];
              if (lineVal) {
                lineStr = lineVal + '';
                lineTextY = lineEl.y - 14; 
                
                if (Math.abs(barTextY - lineTextY) < 16) {
                   if (lineTextY <= barTextY) {
                     lineTextY = barTextY - 16;
                   } else {
                     lineTextY = barTextY + 16;
                   }
                }
                
                ctx.fillStyle = isDark ? '#fca5a5' : '#ef4444';
                ctx.fillText(lineStr, lineEl.x, lineTextY);
              }
            }

            ctx.fillStyle = barTextColor;
            ctx.fillText(barStr, barEl.x, barTextY);
          });
          
          ctx.restore();
        }
      };

      config.plugins.push(customCanvasBackgroundColor);
      config.plugins.push(customBarLabelsPlugin);
      config.plugins.push(customOutlabelsPlugin);
      carBrandChartInstance = new Chart(ctx, config);
    };


    window.downloadGdvKpiChartImage = function() {
      const monthStr = (typeof activeGdvReportMonth !== 'undefined' && activeGdvReportMonth !== 'all') ? 'Thang' + activeGdvReportMonth : 'TatCa';
      const yearStr = (typeof activeGdvReportYear !== 'undefined') ? activeGdvReportYear : new Date().getFullYear();
      const fileName = `Bieu_do_KPI_Luong_GDV_${monthStr}_${yearStr}_UltraHD.png`;
      exportUltraHDChartCard('kpiChartCardContainer', 'gdvKpiCanvas', 'BIỂU ĐỒ XU HƯỚNG KPI & LƯƠNG GIÁM ĐỊNH VIÊN', fileName);
    };


    window.initGdvKpiChart = function() {
      const canvas = document.getElementById('gdvKpiCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const list = (cachedCurrentGdvKpiRows && cachedCurrentGdvKpiRows.length > 0) ? cachedCurrentGdvKpiRows : [];
      const kpiMetrics = getGdvKpiProgressMetrics();
      
      if (gdvKpiChartInstance) {
        gdvKpiChartInstance.destroy();
        gdvKpiChartInstance = null;
      }

      const isDark = !document.body.classList.contains('light-mode');
      const reportStyle = getComputedStyle(canvas.closest('.gdv-report-premium-shell') || canvas);
      const textColor = reportStyle.getPropertyValue('--ton-ink').trim() || (isDark ? '#f0f2eb' : '#283b36');
      const gridColor = reportStyle.getPropertyValue('--ton-line').trim() || (isDark ? '#2a3840' : '#e5e8e0');
      const surfaceColor = reportStyle.getPropertyValue('--ton-paper').trim() || (isDark ? '#121e27' : '#fffefb');

      const canvasWrap = document.getElementById('gdvKpiCanvasWrap') || canvas.parentElement;
      const compactChart = canvasWrap.clientWidth < 640;
      if (activeGdvKpiChartType === 'pie') {
        canvasWrap.style.height = '480px';
      } else {
        canvasWrap.style.height = '430px';
      }

      const labels = list.map(item => item.gdvName);
      const openData = list.map(item => item.totalOpenedCount);
      const duyetData = list.map(item => Math.round((item.weightedKpiCount || item.duyetHsbtCount) * 10) / 10);

      const actualType = activeGdvKpiChartType === 'pie' ? 'doughnut' : (activeGdvKpiChartType === 'line' ? 'line' : 'bar');

      let datasets = [];

      if (actualType === 'bar') {
        datasets = [
          {
            type: 'bar',
            label: 'Số HS tiếp nhận',
            data: openData,
            backgroundColor: 'rgba(216, 180, 109, 0.85)',
            hoverBackgroundColor: 'rgba(216, 180, 109, 1)',
            borderColor: '#b88935',
            borderWidth: 1.5,
            borderRadius: { topLeft: 7, topRight: 7, bottomLeft: 0, bottomRight: 0 },
            barPercentage: 0.65,
            categoryPercentage: 0.65,
            order: 2
          },
          {
            type: 'bar',
            label: 'Đã duyệt HSBT (KPI quy đổi)',
            data: duyetData,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderRadius: { topLeft: 7, topRight: 7, bottomLeft: 0, bottomRight: 0 },
            barPercentage: 0.65,
            categoryPercentage: 0.65,
            order: 2
          },
          {
            type: 'line',
            label: `Ngưỡng tiến độ (${kpiMetrics.progressTarget} ca - Ngày ${kpiMetrics.daysPassed}/${kpiMetrics.totalDaysInMonth})`,
            data: list.map(() => kpiMetrics.progressTarget),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            order: 1
          },
          {
            type: 'line',
            label: 'Mốc chuẩn KPI tính lương (70 ca)',
            data: list.map(() => 70),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            order: 1
          }
        ];
      } else if (actualType === 'line') {
        const openGradient = (function() {
          const g = ctx.createLinearGradient(0, 30, 0, 360);
          g.addColorStop(0, 'rgba(184, 137, 53, 0.13)');
          g.addColorStop(1, isDark ? 'rgba(216, 180, 109, 0.01)' : 'rgba(216, 180, 109, 0.01)');
          return g;
        })();

        const duyetGradient = (function() {
          const g = ctx.createLinearGradient(0, 30, 0, 360);
          g.addColorStop(0, 'rgba(16, 185, 129, 0.13)');
          g.addColorStop(1, isDark ? 'rgba(16, 185, 129, 0.01)' : 'rgba(16, 185, 129, 0.01)');
          return g;
        })();

        datasets = [
          {
            type: 'line',
            label: 'Số HS tiếp nhận',
            data: openData,
            borderColor: '#b88935',
            backgroundColor: openGradient,
            borderWidth: 2.5,
            tension: 0.38,
            pointBackgroundColor: surfaceColor,
            pointBorderColor: '#b88935',
            pointBorderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#b88935',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 3,
            fill: true
          },
          {
            type: 'line',
            label: 'Đã duyệt HSBT (KPI quy đổi)',
            data: duyetData,
            borderColor: '#10b981',
            backgroundColor: duyetGradient,
            borderWidth: 2.5,
            tension: 0.38,
            pointBackgroundColor: surfaceColor,
            pointBorderColor: '#10b981',
            pointBorderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#10b981',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 3,
            fill: true
          },
          {
            type: 'line',
            label: `Ngưỡng tiến độ (${kpiMetrics.progressTarget} ca - Ngày ${kpiMetrics.daysPassed}/${kpiMetrics.totalDaysInMonth})`,
            data: list.map(() => kpiMetrics.progressTarget),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.04)',
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false
          },
          {
            type: 'line',
            label: 'Mốc chuẩn KPI tính lương (70 ca)',
            data: list.map(() => 70),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.04)',
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false
          }
        ];
      } else {
        // Doughnut mode: displays claims opened in month (Số lượng hồ sơ tiếp nhận trong tháng)
        const coreColors = [
          '216, 180, 109', '59, 130, 246', '16, 185, 129', '245, 158, 11', '168, 85, 247',
          '236, 72, 153', '20, 184, 166', '99, 102, 241', '14, 165, 233', '239, 68, 68'
        ];
        const bgColors = list.map((_, i) => `rgba(${coreColors[i % coreColors.length]}, 0.85)`);
        const borderColors = list.map(() => surfaceColor);

        datasets = [
          {
            type: 'doughnut',
            label: 'Số lượng hồ sơ trong tháng',
            data: openData,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 3,
            hoverOffset: 10
          }
        ];
      }

      // Helper function to render a sleek floating pill badge with anti-aliased border
      function drawFloatingPillBadge(c, x, y, text, dotColor, isDarkTheme) {
        c.save();
        c.font = "850 11px 'Plus Jakarta Sans', sans-serif";
        const padX = 8;
        const textMetrics = c.measureText(text);
        const textW = textMetrics.width;
        const pillW = textW + padX * 2 + 10;
        const pillH = 22;
        const pillX = x - pillW / 2;
        const pillY = y - pillH / 2;

        // Shadow
        c.shadowColor = isDarkTheme ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.12)';
        c.shadowBlur = 2;
        c.shadowOffsetY = 2;

        // Pill background
        c.fillStyle = surfaceColor;
        c.strokeStyle = dotColor;
        c.lineWidth = 1.5;
        c.beginPath();
        if (c.roundRect) {
          c.roundRect(pillX, pillY, pillW, pillH, 99);
        } else {
          c.rect(pillX, pillY, pillW, pillH);
        }
        c.fill();
        c.stroke();
        c.restore();

        // Status Dot
        c.save();
        c.fillStyle = dotColor;
        c.beginPath();
        c.arc(pillX + padX + 3, y, 3, 0, Math.PI * 2);
        c.fill();

        // Text
        c.fillStyle = textColor;
        c.font = "850 11px 'Plus Jakarta Sans', sans-serif";
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(text, pillX + padX + 9, y);
        c.restore();
      }

      // Plugins
      const customCanvasBgPlugin = {
        id: 'customCanvasBgKpi',
        beforeDraw: (chart) => {
          const c = chart.ctx;
          c.save();
          c.globalCompositeOperation = 'destination-over';
          c.fillStyle = surfaceColor;
          c.fillRect(0, 0, chart.width, chart.height);
          c.restore();
        }
      };

      const customGdvKpiLabelsPlugin = {
        id: 'customGdvKpiLabels',
        afterDatasetsDraw(chart) {
          if (chart.config.type === 'doughnut') return;
          const { ctx: c, chartArea, scales } = chart;
          if (!scales || !scales.y) return;
          c.save();
          
          const isDarkTheme = !document.body.classList.contains('light-mode');

          // 1. Draw "KPI: 70 CA/THÁNG" badge on the 70 line
          const y70 = scales.y.getPixelForValue(70);
          if (y70 >= chartArea.top && y70 <= chartArea.bottom) {
            const badgeW = 122;
            const badgeH = 22;
            const badgeX = chartArea.right - badgeW - 4;
            const badgeY = y70 - badgeH / 2;

            c.save();
            c.shadowColor = 'rgba(239, 68, 68, 0.4)';
            c.shadowBlur = 0;
            c.shadowOffsetY = 2;
            c.fillStyle = isDarkTheme ? '#38252a' : '#fff1ef';
            c.beginPath();
            if (c.roundRect) {
              c.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
            } else {
              c.rect(badgeX, badgeY, badgeW, badgeH);
            }
            c.fill();
            c.restore();

            c.save();
            c.font = "900 10.5px 'Plus Jakarta Sans', sans-serif";
            c.fillStyle = '#ffffff';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillStyle = isDarkTheme ? '#ff9494' : '#dc2626';
            c.fillText('KPI: 70 CA/THÁNG', badgeX + badgeW / 2, y70);
            c.restore();
          }

          // 1b. Draw "TIẾN ĐỘ: X CA (NGÀY D/M)" badge on the progressTarget line
          const yProg = scales.y.getPixelForValue(kpiMetrics.progressTarget);
          if (yProg >= chartArea.top && yProg <= chartArea.bottom) {
            const progText = `TIẾN ĐỘ: ${kpiMetrics.progressTarget} CA (NGÀY ${kpiMetrics.daysPassed}/${kpiMetrics.totalDaysInMonth})`;
            c.save();
            c.font = "900 10px 'Plus Jakarta Sans', sans-serif";
            const textMetrics = c.measureText(progText);
            const progBadgeW = Math.max(140, textMetrics.width + 16);
            const progBadgeH = 22;
            const progBadgeX = chartArea.right - progBadgeW - 4;
            
            // Non-overlapping with 70 line badge if lines are close
            let progBadgeY = yProg - progBadgeH / 2;
            if (Math.abs(yProg - y70) < 24) {
              progBadgeY = y70 > yProg ? (yProg - progBadgeH - 2) : (yProg + 2);
            }

            c.shadowColor = 'rgba(59, 130, 246, 0.4)';
            c.shadowBlur = 0;
            c.shadowOffsetY = 2;
            c.fillStyle = isDarkTheme ? '#20344b' : '#edf4ff';
            c.beginPath();
            if (c.roundRect) {
              c.roundRect(progBadgeX, progBadgeY, progBadgeW, progBadgeH, 6);
            } else {
              c.rect(progBadgeX, progBadgeY, progBadgeW, progBadgeH);
            }
            c.fill();
            c.restore();

            c.save();
            c.font = "900 10px 'Plus Jakarta Sans', sans-serif";
            c.fillStyle = '#ffffff';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillStyle = isDarkTheme ? '#8dbaff' : '#2563eb';
            c.fillText(progText, progBadgeX + progBadgeW / 2, progBadgeY + progBadgeH / 2);
            c.restore();
          }

          // 2. Draw Floating Pill Badges with Smart Non-overlapping logic
          if (actualType === 'line') {
            const openMeta = chart.getDatasetMeta(0);
            const duyetMeta = chart.getDatasetMeta(1);

            list.forEach((item, idx) => {
              const openEl = openMeta && openMeta.data[idx];
              const duyetEl = duyetMeta && duyetMeta.data[idx];
              const openVal = openData[idx];
              const duyetVal = duyetData[idx];

              if (!openEl || !duyetEl) return;

              // Default: place badge above point
              let openBadgeY = openEl.y - 20;
              let duyetBadgeY = duyetEl.y - 20;

              // Collision check: if the two points are close vertically (within 28px)
              if (Math.abs(openEl.y - duyetEl.y) < 28) {
                if (openEl.y <= duyetEl.y) {
                  // openEl is higher on screen (smaller y)
                  openBadgeY = openEl.y - 20;
                  // If lower point is not too close to bottom, place below; otherwise stack above
                  if (duyetEl.y + 24 < chartArea.bottom - 8) {
                    duyetBadgeY = duyetEl.y + 22;
                  } else {
                    duyetBadgeY = openBadgeY - 26; // Stack both neatly above!
                  }
                } else {
                  // duyetEl is higher on screen (smaller y)
                  duyetBadgeY = duyetEl.y - 20;
                  if (openEl.y + 24 < chartArea.bottom - 8) {
                    openBadgeY = openEl.y + 22;
                  } else {
                    openBadgeY = duyetBadgeY - 26; // Stack both neatly above!
                  }
                }
              }

              // Ensure neither badge ever overlaps the X-axis label at the bottom!
              const maxAllowedY = chartArea.bottom - 12;
              if (openBadgeY > maxAllowedY) openBadgeY = openEl.y - 20;
              if (duyetBadgeY > maxAllowedY) duyetBadgeY = duyetEl.y - 20;

              // Draw Open Badge (Gold)
              drawFloatingPillBadge(c, openEl.x, openBadgeY, openVal + ' ca', '#b88935', isDarkTheme);

              // Draw Duyet Badge (Green)
              drawFloatingPillBadge(c, duyetEl.x, duyetBadgeY, duyetVal + ' ca', '#10b981', isDarkTheme);
            });
          } else {
            chart.data.datasets.forEach((ds, dsIdx) => {
              if (ds.type === 'line' || (ds.label && (ds.label.includes('70 ca') || ds.label.includes('tiến độ') || ds.label.includes('Tiến độ')))) return;
              const meta = chart.getDatasetMeta(dsIdx);
              if (!meta || meta.hidden) return;

              meta.data.forEach((el, idx) => {
                const val = ds.data[idx];
                if (val === undefined || val === null) return;
                
                const dotColor = dsIdx === 0 ? '#b88935' : '#10b981';
                drawFloatingPillBadge(c, el.x, el.y - 14, val + ' ca', dotColor, isDarkTheme);
              });
            });
          }

          c.restore();
        }
      };

      const customGdvKpiDoughnutPlugin = {
        id: 'customGdvKpiDoughnut',
        afterDraw(chart) {
          if (chart.config.type !== 'doughnut') return;
          const c = chart.ctx;
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          const total = dataset.data.reduce((a, b) => a + b, 0);

          c.save();
          c.textBaseline = 'middle';
          const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
          c.textAlign = 'center';
          const isDarkTheme = !document.body.classList.contains('light-mode');

          // Center Totals
          c.fillStyle = textColor;
          c.font = "800 12px 'Plus Jakarta Sans', sans-serif";
          if (compactChart) c.font = "750 10px 'Plus Jakarta Sans', sans-serif";
          c.fillText(compactChart ? 'TỔNG HỒ SƠ' : 'TỔNG HỒ SƠ TRONG THÁNG', centerX, centerY - 14);

          c.fillStyle = isDarkTheme ? '#b88935' : '#b89347';
          c.font = "900 28px 'Plus Jakarta Sans', sans-serif";
          c.fillText(Math.round(total) + ' ca', centerX, centerY + 16);
          c.restore();

          if (total <= 0 || !meta || !meta.data || compactChart) return;

          let lastYRight = -9999;
          let lastYLeft = 9999;

          meta.data.forEach((element, index) => {
            const val = dataset.data[index];
            if (!val) return;
            const pct = ((val / total) * 100).toFixed(1) + '%';
            const name = chart.data.labels[index] || '';
            const sliceColor = (dataset.backgroundColor && dataset.backgroundColor[index]) ? dataset.backgroundColor[index] : '#10b981';

            const chartCenter = { x: element.x, y: element.y };
            const angle = (element.startAngle + element.endAngle) / 2;
            const outerRadius = element.outerRadius;
            const innerRadius = element.innerRadius;

            // 1. In-slice percentage text if arc is wide enough
            if (element.endAngle - element.startAngle > 0.42) {
              c.save();
              const midRadius = (innerRadius + outerRadius) / 2;
              const midX = chartCenter.x + Math.cos(angle) * midRadius;
              const midY = chartCenter.y + Math.sin(angle) * midRadius;
              c.font = "900 11.5px 'Plus Jakarta Sans', sans-serif";
              c.fillStyle = '#ffffff';
              c.textAlign = 'center';
              c.textBaseline = 'middle';
              c.shadowColor = 'rgba(0,0,0,0.5)';
              c.shadowBlur = 4;
              c.fillText(pct, midX, midY);
              c.restore();
            }

            // 2. Callout Line & Label pointing to each slice
            const startX = chartCenter.x + Math.cos(angle) * outerRadius;
            const startY = chartCenter.y + Math.sin(angle) * outerRadius;

            const isRight = Math.cos(angle) >= 0;
            const breakX = chartCenter.x + Math.cos(angle) * (outerRadius + 18);
            const breakY = chartCenter.y + Math.sin(angle) * (outerRadius + 18);

            let targetY = breakY;
            if (isRight) {
              if (targetY < lastYRight + 26) targetY = lastYRight + 26;
              lastYRight = targetY;
            } else {
              if (targetY > lastYLeft - 26) targetY = lastYLeft - 26;
              lastYLeft = targetY;
            }
            if (targetY < chart.chartArea.top + 14) targetY = chart.chartArea.top + 14;
            if (targetY > chart.chartArea.bottom - 14) targetY = chart.chartArea.bottom - 14;

            const fixedX = chartCenter.x + (isRight ? outerRadius + 50 : -(outerRadius + 50));

            c.save();
            c.beginPath();
            c.moveTo(startX, startY);
            c.lineTo(breakX, targetY);
            c.lineTo(fixedX, targetY);
            c.strokeStyle = sliceColor;
            c.lineWidth = 1.8;
            c.stroke();

            // Floating callout text
            c.textAlign = isRight ? 'left' : 'right';
            const textStartX = isRight ? fixedX + 8 : fixedX - 8;

            // Line 1: GDV Name
            c.font = "850 12px 'Plus Jakarta Sans', sans-serif";
            c.fillStyle = isDarkTheme ? '#f1f5f9' : '#0f172a';
            c.textBaseline = 'bottom';
            c.fillText(name, textStartX, targetY - 2);

            // Line 2: Count & Percentage
            c.font = "750 11px 'Plus Jakarta Sans', sans-serif";
            c.fillStyle = sliceColor;
            c.textBaseline = 'top';
            c.fillText(`${val} ca (${pct})`, textStartX, targetY + 2);

            c.restore();
          });
        }
      };

      // Calculate dynamic max to give optimal vertical amplitude to the lines
      const maxDataVal = Math.max(0, ...openData, ...duyetData);
      const dynamicYMax = maxDataVal < 70 ? 76 : Math.ceil((maxDataVal + 10) / 10) * 10;

      const config = {
        type: actualType,
        data: {
          labels: labels,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: actualType === 'doughnut' ? '65%' : undefined,
          animation: {
            duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450,
            easing: 'easeOutQuart'
          },
          layout: {
            padding: actualType === 'doughnut' ? (compactChart ? { top: 16, bottom: 10, left: 8, right: 8 } : { top: 45, bottom: 45, left: 160, right: 160 }) : { top: 25, right: 16, bottom: 12, left: 4 }
          },
          plugins: {
            legend: {
              display: actualType !== 'doughnut' || compactChart,
              position: compactChart ? 'bottom' : 'top',
              align: 'end',
              labels: {
                color: textColor,
                font: { family: "'Plus Jakarta Sans', sans-serif", weight: '700', size: 11 },
                padding: 16,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              backgroundColor: surfaceColor,
              titleColor: textColor,
              bodyColor: textColor,
              borderColor: gridColor,
              borderWidth: 1,
              padding: 14,
              cornerRadius: 12,
              displayColors: true,
              usePointStyle: true,
              boxPadding: 6,
              titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '800' },
              bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12.5, weight: '700' },
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) label += ': ';
                  label += (context.parsed.y !== undefined ? context.parsed.y : context.parsed) + ' ca';
                  return label;
                },
                afterBody: function(items) {
                  if (items.length > 0 && actualType !== 'doughnut') {
                    const idx = items[0].dataIndex;
                    const r = list[idx];
                    if (r) {
                      const kpiVal = Math.round((r.weightedKpiCount || r.duyetHsbtCount) * 10) / 10;
                      const pct = Math.round((kpiVal / 70) * 100);
                      const gap = Math.round((kpiVal - 70) * 10) / 10;
                      const gapStr = gap >= 0 ? `+${gap} ca (Đạt/Vượt chỉ tiêu)` : `${gap} ca (Còn thiếu)`;

                      const progPct = kpiMetrics.progressTarget > 0 ? Math.round((kpiVal / kpiMetrics.progressTarget) * 100) : 0;
                      const progGap = Math.round((kpiVal - kpiMetrics.progressTarget) * 10) / 10;
                      const progGapStr = progGap >= 0 ? `+${progGap} ca (Vượt tiến độ)` : `${progGap} ca (Chậm tiến độ)`;

                      return [
                        `• Tiến độ ngày ${kpiMetrics.daysPassed}/${kpiMetrics.totalDaysInMonth} (${kpiMetrics.progressTarget} ca): ${progPct}% (${progGapStr})`,
                        `• KPI chuẩn tháng (70 ca): ${pct}% (${gapStr})`
                      ];
                    }
                  }
                  return [];
                }
              }
            }
          },
          scales: actualType === 'doughnut' ? {} : {
            x: {
              offset: true,
              grid: { display: false },
              ticks: {
                color: textColor,
                font: { family: "'Plus Jakarta Sans', sans-serif", weight: '700', size: compactChart ? 10 : 11.5 },
                padding: 10
              }
            },
            y: {
              beginAtZero: true,
              max: dynamicYMax,
              grid: { color: gridColor, drawBorder: false },
              ticks: {
                color: textColor,
                font: { family: "'Plus Jakarta Sans', sans-serif", weight: '700', size: 11 },
                stepSize: dynamicYMax <= 80 ? 15 : 20,
                callback: function(v) { return v + ' ca'; }
              }
            }
          }
        },
        plugins: [customCanvasBgPlugin, customGdvKpiLabelsPlugin, customGdvKpiDoughnutPlugin]
      };

      gdvKpiChartInstance = new Chart(ctx, config);
    };


    window.downloadCarBrandChartImage = function() {
      const monthStr = (typeof activeGdvReportMonth !== 'undefined' && activeGdvReportMonth !== 'all') ? 'Thang' + activeGdvReportMonth : 'TatCa';
      const yearStr = (typeof activeGdvReportYear !== 'undefined') ? activeGdvReportYear : new Date().getFullYear();
      const fileName = `Bieu_do_Ton_that_Hang_xe_${monthStr}_${yearStr}_UltraHD.png`;
      exportUltraHDChartCard('carBrandChartCardContainer', 'carBrandLossCanvas', 'BIỂU ĐỒ & BẢNG KÊ TỔN THẤT HÃNG XE', fileName);
    };



    window.initGarageLossChart = function() {
      const canvas = document.getElementById('garageLossCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      const fullList = cachedCurrentGarageRows || [];
      let list = [];
      if (activeGarageChartTopN >= fullList.length) {
        list = fullList;
      } else {
        list = fullList.slice(0, activeGarageChartTopN);
        const rest = fullList.slice(activeGarageChartTopN);
        const restCount = rest.reduce((sum, item) => sum + item.totalClaimsCount, 0);
        const restAmount = rest.reduce((sum, item) => sum + item.totalApprovedAmount, 0);
        if (restCount > 0) {
          list.push({ name: 'Các gara khác', totalClaimsCount: restCount, totalApprovedAmount: restAmount });
        }
      }
      
      if (garageLossChartInstance) {
        garageLossChartInstance.destroy();
      }
      

      const isDark = !document.body.classList.contains('light-mode');
      const reportStyle = getComputedStyle(canvas.closest('.report-pending-premium') || canvas);
      const textColor = reportStyle.getPropertyValue('--ton-ink').trim() || (isDark ? '#f0f2eb' : '#283b36');
      
      const canvasWrap = document.getElementById("garageLossCanvasWrap") || canvas.parentElement;
      if (activeGarageChartType === 'pie') {
        canvasWrap.style.height = activeGarageChartTopN > 10 ? '600px' : '500px';
      } else {
        canvasWrap.style.height = '400px';
      }

      const gridColor = reportStyle.getPropertyValue('--ton-line').trim() || (isDark ? '#2a3840' : '#e5e8e0');
      const surfaceColor = reportStyle.getPropertyValue('--ton-paper').trim() || (isDark ? '#121e27' : '#fffefb');
      const compactChart = canvasWrap.clientWidth < 640;
      
      const labels = list.map(item => item.name);
      const data = list.map(item => item.totalApprovedAmount);
      
      // Ultra-Premium vibrant palette (repeated if needed)
      const coreColors = [
        '216, 180, 109', '59, 130, 246', '16, 185, 129', '239, 68, 68', '245, 158, 11',
        '139, 92, 246', '20, 184, 166', '236, 72, 153', '99, 102, 241', '14, 165, 233',
        '244, 63, 94', '168, 85, 247', '14, 116, 144', '21, 128, 61', '161, 98, 7'
      ];
      const baseColors = list.map((_, i) => coreColors[i % coreColors.length]);
      if (list.length > 0 && list[list.length-1].name === 'Các gara khác') {
        baseColors[list.length-1] = '100, 116, 139'; // Slate for others
      }
      
      const bgColors = baseColors.map(c => `rgba(${c}, 0.85)`);
      const hoverBgColors = baseColors.map(c => `rgba(${c}, 1)`);
      const borderColors = baseColors.map(c => `rgba(${c}, 1)`);

      
      const customOutlabelsPlugin = {
        id: 'customOutlabels',
        afterDraw: function(chart) {
          if (chart.config.type !== 'doughnut') return;
          const ctx = chart.ctx;
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          const total = dataset.data.reduce((a, b) => a + b, 0);

          ctx.save();
          ctx.textBaseline = 'middle';
          
          const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
          ctx.textAlign = 'center';
          
          const isDarkTheme = !document.body.classList.contains('light-mode');
          
          ctx.shadowColor = isDarkTheme ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.15)';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          
          ctx.fillStyle = isDarkTheme ? '#94a3b8' : '#64748b';
          ctx.font = "700 13px 'Plus Jakarta Sans', sans-serif";
          // Add letter spacing trick by manually spacing characters? No, just keep it clean.
          ctx.fillText('TỔNG CỘNG', centerX, centerY - 16);
          
          ctx.fillStyle = textColor;
          ctx.font = "900 28px 'Plus Jakarta Sans', sans-serif";
          let totalStr = '';
          if (total >= 1000000000) totalStr = (total / 1000000000).toFixed(2) + ' Tỷ';
          else if (total >= 1000000) totalStr = (total / 1000000).toFixed(1) + ' Tr';
          else totalStr = formatCurrencyInputNumber(total);
          ctx.fillText(totalStr, centerX, centerY + 16);

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          if (compactChart) { ctx.restore(); return; }
          let lastYRight = -9999;
          let lastYLeft = 9999;
          
          ctx.font = "700 11.5px 'Plus Jakarta Sans', sans-serif";

          meta.data.forEach((element, index) => {
            const val = dataset.data[index];
            if (!val) return;
            const percentage = ((val / total) * 100).toFixed(1) + '%';
            
            let valStr = '';
            if (val >= 1000000000) valStr = (val / 1000000000).toFixed(1) + ' Tỷ';
            else if (val >= 1000000) valStr = (val / 1000000).toFixed(1) + ' Tr';
            else if (val >= 1000) valStr = (val / 1000).toFixed(0) + ' K';
            else valStr = val;

            const labelStr = `${chart.data.labels[index]} ${percentage} (${valStr})`;

            const chartCenter = { x: element.x, y: element.y };
            const angle = (element.startAngle + element.endAngle) / 2;
            const outerRadius = element.outerRadius;
            
            const startX = chartCenter.x + Math.cos(angle) * outerRadius;
            const startY = chartCenter.y + Math.sin(angle) * outerRadius;

            const isRight = Math.cos(angle) > 0;
            const breakX = chartCenter.x + Math.cos(angle) * (outerRadius + 15);
            const breakY = chartCenter.y + Math.sin(angle) * (outerRadius + 15);
            
            let targetY = breakY;
            if (isRight) {
              if (targetY < lastYRight + 20) targetY = lastYRight + 20;
              lastYRight = targetY;
            } else {
              if (targetY > lastYLeft - 20) targetY = lastYLeft - 20;
              lastYLeft = targetY;
            }
            
            // Align all texts to a fixed horizontal distance from the center
            const fixedX = chartCenter.x + (isRight ? outerRadius + 45 : -(outerRadius + 45));

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(breakX, targetY);
            ctx.lineTo(fixedX, targetY);
            const surfaceColor = reportStyle.getPropertyValue('--ton-paper').trim() || (isDark ? '#121e27' : '#fffefb');
            ctx.strokeStyle = dataset.borderColor[index] === surfaceColor ? dataset.backgroundColor[index] : dataset.borderColor[index];
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = !document.body.classList.contains('light-mode') ? '#cbd5e1' : '#475569';
            ctx.textAlign = isRight ? 'left' : 'right';
            ctx.fillText(labelStr, isRight ? fixedX + 8 : fixedX - 8, targetY);
          });
          ctx.restore();
        }
      };
      
      const actualType = activeGarageChartType === 'pie' ? 'doughnut' : 'bar';


      const config = {
        type: actualType,
        data: {
          labels: labels,
          datasets: (function() {
            const ds = [{
              type: actualType,
              label: 'Tổng tiền bồi thường',
              data: data,
              backgroundColor: bgColors,
              hoverBackgroundColor: hoverBgColors,
              borderColor: actualType === 'doughnut' ? surfaceColor : borderColors,
              borderWidth: actualType === 'doughnut' ? 3 : 1,
              borderRadius: actualType === 'bar' ? { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 } : 0,
              hoverOffset: actualType === 'doughnut' ? 10 : 0,
              yAxisID: actualType === 'bar' ? 'y' : undefined
            }];
            if (actualType === 'bar') {
              ds.push({
                type: 'line',
                label: 'Số lượng hồ sơ',
                data: list.map(item => item.totalClaimsCount),
                borderColor: isDark ? '#f87171' : '#ef4444',
                backgroundColor: isDark ? 'rgba(248, 113, 113, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                borderWidth: 3,
                tension: 0.4,
                pointBackgroundColor: isDark ? '#f87171' : '#ef4444',
                pointBorderColor: surfaceColor,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                yAxisID: 'y1'
              });
            }
            return ds;
          })()
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: activeGarageChartType === 'pie' ? '65%' : undefined,
          layout: {
            padding: activeGarageChartType === 'pie' ? (compactChart ? { top: 16, bottom: 10, left: 8, right: 8 } : { top: 60, bottom: 50, left: 160, right: 160 }) : 0
          },
          animation: {
            duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: {
              display: activeGarageChartType === 'bar' || compactChart,
              position: compactChart ? 'bottom' : 'top',
              align: 'end',
              labels: { 
                color: textColor, 
                font: { family: "'Plus Jakarta Sans', sans-serif", weight: '800', size: 12 },
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              titleColor: isDark ? '#ffffff' : '#0f172a',
              bodyColor: isDark ? '#cbd5e1' : '#475569',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderWidth: 1,
              padding: 14,
              cornerRadius: 12,
              displayColors: true, usePointStyle: true,
              boxPadding: 6,
              titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '800' },
              bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '700' },
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) { label += ': '; }
                  
                  if (context.dataset.type === 'line' || context.dataset.yAxisID === 'y1') {
                    label += context.parsed.y + ' hồ sơ';
                  } else {
                    if (context.parsed.y !== null && activeGarageChartType === 'bar') {
                      label += formatCurrencyInputNumber(context.parsed.y) + ' đ';
                    } else if (context.parsed !== null && activeGarageChartType === 'pie') {
                      label += formatCurrencyInputNumber(context.parsed) + ' đ';
                    }
                  }
                  return label;
                }
              }
            }
          },
        }
      };

      if (activeGarageChartType === 'bar') {
        config.options.scales = {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: { color: gridColor, drawBorder: false, borderDash: [5, 5] },
            border: { display: false },
            ticks: {
              color: textColor,
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '700' },
              padding: 10,
              callback: function(value) {
                if (value >= 1000000000) return (value / 1000000000).toFixed(1) + ' Tỷ';
                if (value >= 1000000) return (value / 1000000).toFixed(0) + ' Tr';
                if (value >= 1000) return (value / 1000).toFixed(0) + ' K';
                return value;
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: isDark ? '#f87171' : '#ef4444',
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '850' },
              padding: 10,
              callback: function(value) {
                return value + ' hs';
              }
            }
          },
          x: {
            grid: { display: false, drawBorder: false },
            border: { display: false },
            ticks: { 
              color: textColor, 
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '800' },
              padding: 10 
            }
          }
        };
      }

      config.plugins = config.plugins || [];
      
      const customCanvasBackgroundColor = {
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart) => {
          const {ctx} = chart;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = surfaceColor; // or use the background color variable
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        }
      };

      
      const customBarLabelsPlugin = {
        id: 'customBarLabels',
        afterDatasetsDraw(chart, args, options) {
          if (chart.config.type !== 'bar') return;
          const { ctx } = chart;
          ctx.save();
          ctx.font = "800 10.5px 'Plus Jakarta Sans', sans-serif";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const isDark = !document.body.classList.contains('light-mode');

          const barMeta = chart.getDatasetMeta(0);
          const lineMeta = chart.data.datasets.length > 1 ? chart.getDatasetMeta(1) : null;
          
          if (barMeta.hidden) { ctx.restore(); return; }

          barMeta.data.forEach((barEl, index) => {
            const barVal = chart.data.datasets[0].data[index];
            if (!barVal) return;
            
            let barStr = '';
            if (barVal >= 1000000000) barStr = (barVal / 1000000000).toFixed(1) + ' Tỷ';
            else if (barVal >= 1000000) barStr = (barVal / 1000000).toFixed(0) + ' Tr';
            else if (barVal >= 1000) barStr = (barVal / 1000).toFixed(0) + ' K';
            else barStr = barVal;

            const barHeight = barEl.base - barEl.y;
            let barTextY = barHeight > 24 ? barEl.y + 12 : barEl.y - 10;
            let barTextColor = barHeight > 24 ? 'rgba(255,255,255,0.9)' : (isDark ? '#94a3b8' : '#64748b');

            let lineTextY = null;
            let lineStr = '';
            
            if (lineMeta && !lineMeta.hidden && lineMeta.data[index]) {
              const lineEl = lineMeta.data[index];
              const lineVal = chart.data.datasets[1].data[index];
              if (lineVal) {
                lineStr = lineVal + '';
                lineTextY = lineEl.y - 14; 
                
                if (Math.abs(barTextY - lineTextY) < 16) {
                   if (lineTextY <= barTextY) {
                     lineTextY = barTextY - 16;
                   } else {
                     lineTextY = barTextY + 16;
                   }
                }
                
                ctx.fillStyle = isDark ? '#fca5a5' : '#ef4444';
                ctx.fillText(lineStr, lineEl.x, lineTextY);
              }
            }

            ctx.fillStyle = barTextColor;
            ctx.fillText(barStr, barEl.x, barTextY);
          });
          
          ctx.restore();
        }
      };

      config.plugins.push(customCanvasBackgroundColor);
      config.plugins.push(customBarLabelsPlugin);
      config.plugins.push(customOutlabelsPlugin);
      garageLossChartInstance = new Chart(ctx, config);
    };


    window.downloadGarageLossChartImage = function() {
      const monthStr = (typeof activeGdvReportMonth !== 'undefined' && activeGdvReportMonth !== 'all') ? 'Thang' + activeGdvReportMonth : 'TatCa';
      const yearStr = (typeof activeGdvReportYear !== 'undefined') ? activeGdvReportYear : new Date().getFullYear();
      const fileName = `Bieu_do_Boi_thuong_Gara_${monthStr}_${yearStr}_UltraHD.png`;
      exportUltraHDChartCard('garageChartCardContainer', 'garageLossCanvas', 'BIỂU ĐỒ & BẢNG KÊ BỒI THƯỜNG GARA', fileName);
    };



    // =========================================================================
    // PHÂN HỆ QUẢN LÝ ĐỀ XUẤT HỦY HỒ SƠ (TỔNG HỢP HỒ SƠ GĐV CẦN HỦY)
    // =========================================================================
    let activeCancelSearch = '';

    let activeCancelGdvFilter = 'all';

    let activeCancelBranchFilter = 'all';

    let activeCancelReasonCodeFilter = 'all';

    let activeCancelStatusFilter = 'cho_duyet';
 // Mặc định hiển thị tab Chờ duyệt hủy: 'cho_duyet', 'da_duyet', 'all'
    let activeCancelProposalClaimId = null;

    let parsedApprovedCancelExcelBatchRows = [];


    const CANCELLATION_REASONS = [
      { code: 'HUY_10', label: 'Huỷ 10 - Không thuộc phạm vi bảo hiểm (hao mòn, bảo hành, cố ý...)' },
      { code: 'HUY_01', label: 'Huỷ 01 - Trùng vụ tổn thất (đã xử lý trong vụ tổn thất khác)' },
      { code: 'HUY_02', label: 'Huỷ 02 - Treo quá lâu / Mất liên lạc với khách hàng' },
      { code: 'HUY_03', label: 'Huỷ 03 - Khách hàng chủ động rút yêu cầu bồi thường' },
      { code: 'HUY_05', label: 'Huỷ 05 - Khách tự làm và không yêu cầu bồi thường nữa' },
      { code: 'HUY_NGOAI_THO', label: 'Ngoài lãnh thổ - Tổn thất xảy ra ngoài lãnh thổ Việt Nam' },
      { code: 'HUY_KHAC', label: 'Lý do khác (nhập cụ thể)' }
    ];

    // --- FIELD REIMBURSEMENTS (THANH TOÁN HIỆN TRƯỜNG) MODULE ---
    let localFieldReimbursementDraft = [];

    
    document.addEventListener('click', function(e) {
      const dropdown = document.getElementById('reimbBSDropdown');
      const input = document.getElementById('reimbInputBS');
      if (dropdown && input) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      }
    });


    
    window.editingReimbIndex = -1;


