

    function switchCreateFlow(mode) {
      activeCreateFlowMode = mode;
      
      if (mode === 'template') {
        caseRequestedItemsDraft = [];
      } else if (mode === 'excel') {
        if (caseRequestedItemsDraft.length === 0) {
          caseRequestedItemsDraft = [
            { id: generateUniqueReqId(), tenHangMuc: '' },
            { id: generateUniqueReqId(), tenHangMuc: '' },
            { id: generateUniqueReqId(), tenHangMuc: '' }
          ];
        }
      } else if (mode === 'combined') {
        if (caseRequestedItemsDraft.length === 0) {
          caseRequestedItemsDraft = [
            { id: generateUniqueReqId(), tenHangMuc: '' },
            { id: generateUniqueReqId(), tenHangMuc: '' },
            { id: generateUniqueReqId(), tenHangMuc: '' }
          ];
        }
      } else if (mode === 'image') {
        caseRequestedItemsDraft = [];
      }
      
      renderActiveTabContent();
    }


    function resetCaseCreationForm() {
      const plateInput = document.getElementById('txtPlateNumber');
      const garageInput = document.getElementById('txtGaragePartner');
      if (plateInput) plateInput.value = '';
      if (garageInput) garageInput.value = '';

      caseRequestedItemsDraft = [
        { id: generateUniqueReqId(), tenHangMuc: '' },
        { id: generateUniqueReqId(), tenHangMuc: '' },
        { id: generateUniqueReqId(), tenHangMuc: '' }
      ];

      const fileInput = document.getElementById('fileImageUploader');
      if (fileInput) fileInput.value = '';

      const gridHolder = document.getElementById('boxPreviewsHolder');
      if (gridHolder) gridHolder.innerHTML = '';

      const labelSummary = document.getElementById('lblDropzoneSummary');
      if (labelSummary) labelSummary.textContent = 'Chưa có ảnh nào được chọn.';

      // Clear OCR extraction panels and items
      try {
        resetOcrScanPanel();
      } catch (e) {}

      activeCreateFlowMode = 'select';
      editingCaseId = null;
    }


    function applyTemplateToDraft(templateName) {
      const templates = {
        'giam-dinh-xe': [
          'Cà vẹt xe (2 mặt)',
          'Giấy phép lái xe (2 mặt)',
          'Căn cước công dân (2 mặt)',
          'Sổ đăng kiểm xe',
          'Hình ảnh tổng thể xe (4 góc chéo)',
          'Tem đăng kiểm xe',
          'Số khung xe (VIN)'
        ],
        'dau-xe': ['Cản trước', 'Đèn pha trái', 'Đèn pha phải', 'Mặt ca lăng', 'Nắp ca pô', 'Kính chắn gió trước'],
        'duoi-xe': ['Cản sau', 'Cốp sau', 'Đèn hậu trái', 'Đèn hậu phải', 'Kính sau', 'Lốp/Mâm xe'],
        'than-xe': ['Gương trái', 'Gương phải', 'Cửa trước trái', 'Cửa trước phải', 'Cửa sau trái', 'Cửa sau phải']
      };
      
      const items = templates[templateName] || [];
      caseRequestedItemsDraft = items.map(name => ({
        id: generateUniqueReqId(),
        tenHangMuc: name
      }));
      
      switchCreateFlow('standard');
    }


    function updateStatsCounters(val) {
      const allEntries = Object.entries(val || cachedCasesPayload || {});
      const metricTotal = allEntries.length;
      const metricCompleted = allEntries.filter(([,item]) => item.trangThai === STATUS_COMPLETED).length;
      const metricPending = metricTotal - metricCompleted;

      const totalLbl = document.getElementById('lblTotalCases');
      const pendingLbl = document.getElementById('lblPendingCases');
      const completedLbl = document.getElementById('lblCompletedCases');
      
      if (totalLbl) totalLbl.textContent = metricTotal;
      if (pendingLbl) pendingLbl.textContent = metricPending;
      if (completedLbl) completedLbl.textContent = metricCompleted;
      updateInspectionSummary(metricTotal,metricPending,metricCompleted);
    }
