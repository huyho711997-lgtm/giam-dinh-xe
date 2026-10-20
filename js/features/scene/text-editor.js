

function openSceneTextModal(existingShape = null, posX = 200, posY = 200) {
  const modal = document.getElementById('sceneTextModalOverlay');
  if (!modal) return;

  if (existingShape) {
    editingTextShapeId = existingShape.id;
    document.getElementById('sceneTextModalTitle').textContent = 'Chỉnh Sửa Chú Thích';
    document.getElementById('btnApplyTextLabel').textContent = 'Cập nhật';
    document.getElementById('sceneTextInput').value = existingShape.text || '';
    currentTextFontSize = existingShape.fontSize || existingShape.size || 16;
    currentTextFontFamily = existingShape.fontFamily || 'Arial';
    isTextBold = !!existingShape.isBold;
    isTextItalic = !!existingShape.isItalic;
    isTextUnderline = !!existingShape.isUnderline;
    currentTextColor = existingShape.color || '#000000';
  } else {
    editingTextShapeId = null;
    pendingTextPos = { x: posX, y: posY };
    document.getElementById('sceneTextModalTitle').textContent = 'Chèn Chú Thích Bản Vẽ';
    document.getElementById('btnApplyTextLabel').textContent = 'Chèn văn bản';
    document.getElementById('sceneTextInput').value = '';
  }

  const fontSelect = document.getElementById('sceneTextFontFamily');
  if (fontSelect) fontSelect.value = currentTextFontFamily;

  const slider = document.getElementById('sceneTextSizeSlider');
  if (slider) slider.value = currentTextFontSize;

  const badge = document.getElementById('sceneTextSizeBadge');
  if (badge) badge.textContent = `${currentTextFontSize} px`;

  const picker = document.getElementById('sceneTextColorPicker');
  if (picker) picker.value = currentTextColor;

  updateFormatButtonStyles();
  updateTextLivePreview();

  modal.style.display = 'flex';
  setTimeout(() => {
    document.getElementById('sceneTextInput')?.focus();
  }, 50);
}


function closeSceneTextModal() {
  const modal = document.getElementById('sceneTextModalOverlay');
  if (modal) modal.style.display = 'none';
  editingTextShapeId = null;
}


function updateFormatButtonStyles() {
  const btnB = document.getElementById('btnTextBold');
  const btnI = document.getElementById('btnTextItalic');
  const btnU = document.getElementById('btnTextUnderline');

  if (btnB) {
    btnB.style.background = isTextBold ? 'rgba(216,180,109,0.25)' : 'transparent';
    btnB.style.color = isTextBold ? '#92691d' : 'var(--text-main)';
    btnB.style.borderColor = isTextBold ? 'var(--primary)' : 'transparent';
    btnB.style.fontWeight = isTextBold ? '900' : '700';
  }
  if (btnI) {
    btnI.style.background = isTextItalic ? 'rgba(216,180,109,0.25)' : 'transparent';
    btnI.style.color = isTextItalic ? '#92691d' : 'var(--text-main)';
    btnI.style.borderColor = isTextItalic ? 'var(--primary)' : 'transparent';
  }
  if (btnU) {
    btnU.style.background = isTextUnderline ? 'rgba(216,180,109,0.25)' : 'transparent';
    btnU.style.color = isTextUnderline ? '#92691d' : 'var(--text-main)';
    btnU.style.borderColor = isTextUnderline ? 'var(--primary)' : 'transparent';
  }

  document.querySelectorAll('.btn-text-size-chip').forEach(btn => {
    const s = parseInt(btn.textContent);
    if (s === currentTextFontSize) {
      btn.style.borderColor = 'var(--primary)';
      btn.style.background = 'rgba(216,180,109,0.22)';
      btn.style.color = '#92691d';
      btn.style.fontWeight = '800';
    } else {
      btn.style.borderColor = 'var(--border)';
      btn.style.background = 'var(--surface-soft)';
      btn.style.color = 'var(--text-soft)';
      btn.style.fontWeight = '700';
    }
  });
}


function toggleTextFormat(type) {
  if (type === 'bold') isTextBold = !isTextBold;
  if (type === 'italic') isTextItalic = !isTextItalic;
  if (type === 'underline') isTextUnderline = !isTextUnderline;
  updateFormatButtonStyles();
  updateTextLivePreview();
}


function setTextSize(val) {
  currentTextFontSize = parseInt(val);
  const slider = document.getElementById('sceneTextSizeSlider');
  if (slider) slider.value = currentTextFontSize;
  const badge = document.getElementById('sceneTextSizeBadge');
  if (badge) badge.textContent = `${currentTextFontSize} px`;
  updateFormatButtonStyles();
  updateTextLivePreview();
}


function onTextSizeSlider(val) {
  currentTextFontSize = parseInt(val);
  const badge = document.getElementById('sceneTextSizeBadge');
  if (badge) badge.textContent = `${currentTextFontSize} px`;
  updateFormatButtonStyles();
  updateTextLivePreview();
}


function setTextColor(hex) {
  currentTextColor = hex;
  const picker = document.getElementById('sceneTextColorPicker');
  if (picker) picker.value = hex;
  updateTextLivePreview();
}


function updateTextLivePreview() {
  const preview = document.getElementById('sceneTextLivePreview');
  const input = document.getElementById('sceneTextInput');
  const fontSelect = document.getElementById('sceneTextFontFamily');
  if (!preview) return;

  const textVal = input?.value?.trim() || 'Văn bản mẫu chú thích';
  currentTextFontFamily = fontSelect ? fontSelect.value : 'Arial';

  preview.textContent = textVal;
  preview.style.fontFamily = currentTextFontFamily + ', sans-serif';
  preview.style.fontSize = `${currentTextFontSize}px`;
  preview.style.fontWeight = isTextBold ? 'bold' : 'normal';
  preview.style.fontStyle = isTextItalic ? 'italic' : 'normal';
  preview.style.textDecoration = isTextUnderline ? 'underline' : 'none';
  preview.style.color = currentTextColor;
}


function applySceneTextModal() {
  const input = document.getElementById('sceneTextInput');
  const rawText = input ? input.value : '';
  if (!rawText || !rawText.trim()) {
    alert('Vui lòng nhập nội dung văn bản!');
    input?.focus();
    return;
  }
  const text = rawText.trim();

  if (editingTextShapeId) {
    const shape = sceneShapes.find(s => s.id === editingTextShapeId);
    if (shape) {
      shape.text = text;
      shape.fontSize = currentTextFontSize;
      shape.size = currentTextFontSize;
      shape.fontFamily = currentTextFontFamily;
      shape.isBold = isTextBold;
      shape.isItalic = isTextItalic;
      shape.isUnderline = isTextUnderline;
      shape.color = currentTextColor;
      selectedShapeId = shape.id;
    }
  } else {
    const newShape = {
      id: genShapeId(),
      type: 'text',
      text: text,
      x: pendingTextPos.x,
      y: pendingTextPos.y,
      fontSize: currentTextFontSize,
      size: currentTextFontSize,
      fontFamily: currentTextFontFamily,
      isBold: isTextBold,
      isItalic: isTextItalic,
      isUnderline: isTextUnderline,
      color: currentTextColor,
      angle: 0
    };
    sceneShapes.push(newShape);
    selectedShapeId = newShape.id;
  }

  closeSceneTextModal();
  setActiveDrawTool('select');
  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();
}


function editSelectedTextShape() {
  if (!selectedShapeId) return;
  const shape = sceneShapes.find(s => s.id === selectedShapeId);
  if (shape && shape.type === 'text') {
    openSceneTextModal(shape);
  } else if (shape && shape.type === 'number_note') {
    openSceneNumberNoteModal(shape);
  }
}
