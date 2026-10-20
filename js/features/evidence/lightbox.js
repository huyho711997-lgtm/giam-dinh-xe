

    function applyLightboxTransform() {
      const img = document.getElementById('lightboxImg');
      if (!img) return;
      img.style.transform = `scale(${lightboxZoomLevel}) rotate(${lightboxRotation}deg)`;
      const label = document.getElementById('lightboxZoomLabel');
      if (label) label.textContent = Math.round(lightboxZoomLevel * 100) + '%';
    }


    function lightboxZoom(direction) {
      const step = 0.2;
      if (direction > 0) {
        lightboxZoomLevel = Math.min(5, lightboxZoomLevel + step);
      } else {
        lightboxZoomLevel = Math.max(0.2, lightboxZoomLevel - step);
      }
      applyLightboxTransform();
    }


    function lightboxRotate(direction) {
      lightboxRotation += direction * 90;
      applyLightboxTransform();
    }


    function lightboxResetTransform() {
      lightboxZoomLevel = 1;
      lightboxRotation = 0;
      applyLightboxTransform();
    }


    function openLightbox(imageSource, indexOrUrl = 0, requestIndex = null) {
      const lightboxContainer = document.getElementById('lightbox');
      if (!lightboxContainer) return;

      if (Array.isArray(imageSource)) {
        lightboxUrls = imageSource;
        lightboxCurrentIndex = typeof indexOrUrl === 'number' ? indexOrUrl : 0;
      } else {
        lightboxUrls = [imageSource];
        lightboxCurrentIndex = 0;
      }
      
      lightboxRequestIndex = requestIndex;
      lightboxZoomLevel = 1;
      lightboxRotation = 0;
      updateLightboxContent();
      lightboxContainer.classList.add('show');
    }


    function closeLightbox() {
      const lightboxContainer = document.getElementById('lightbox');
      if (lightboxContainer) lightboxContainer.classList.remove('show');
      const img = document.getElementById('lightboxImg');
      if (img) { img.src = ''; img.style.transform = ''; }
      lightboxUrls = [];
      lightboxCurrentIndex = 0;
      lightboxRequestIndex = null;
      lightboxZoomLevel = 1;
      lightboxRotation = 0;
    }


    function updateLightboxContent() {
      const img = document.getElementById('lightboxImg');
      if (!img) return;
      lightboxZoomLevel = 1;
      lightboxRotation = 0;
      applyLightboxTransform();
      
      img.src = lightboxUrls[lightboxCurrentIndex] || '';
      
      const counterLabel = document.getElementById('lightboxCounterLabel');
      if (counterLabel) {
        if (lightboxUrls.length > 0) {
          counterLabel.textContent = `ẢNH ${lightboxCurrentIndex + 1} / ${lightboxUrls.length}`;
          counterLabel.style.display = 'block';
        } else {
          counterLabel.style.display = 'none';
        }
      }
      
      const indicator = document.getElementById('lightboxThumbsIndicator');
      if (indicator) {
        indicator.innerHTML = '';
        if (lightboxUrls.length > 1) {
          lightboxUrls.forEach((url, idx) => {
            const thumb = document.createElement('img');
            thumb.className = `lightbox-thumb-dot ${idx === lightboxCurrentIndex ? 'active' : ''}`;
            thumb.src = url;
            thumb.onclick = (e) => {
              e.stopPropagation();
              lightboxCurrentIndex = idx;
              updateLightboxContent();
            };
            indicator.appendChild(thumb);
          });
          indicator.style.display = 'flex';
        } else {
          indicator.style.display = 'none';
        }
      }
      
      const prevBtn = document.getElementById('lightboxPrevBtn');
      const nextBtn = document.getElementById('lightboxNextBtn');
      const showNav = lightboxUrls.length > 1;
      
      if (prevBtn) prevBtn.style.display = showNav ? 'grid' : 'none';
      if (nextBtn) nextBtn.style.display = showNav ? 'grid' : 'none';
      
      const deleteBtn = document.getElementById('lightboxDeleteBtn');
      if (deleteBtn) {
        deleteBtn.style.display = (lightboxRequestIndex !== null) ? 'flex' : 'none';
      }
    }


    function navigateLightbox(direction, event) {
      if (event) event.stopPropagation();
      if (lightboxUrls.length <= 1) return;
      
      lightboxCurrentIndex += direction;
      if (lightboxCurrentIndex < 0) {
        lightboxCurrentIndex = lightboxUrls.length - 1;
      } else if (lightboxCurrentIndex >= lightboxUrls.length) {
        lightboxCurrentIndex = 0;
      }
      
      updateLightboxContent();
    }


    async function deleteCurrentImageFromLightbox(event) {
      if (event) event.stopPropagation();
      if (lightboxRequestIndex === null) return;
      
      const indexToDelete = lightboxCurrentIndex;
      await removeGarageEvidenceImage(lightboxRequestIndex, indexToDelete);
      
      const currentCategory = localActiveRequestedItems[lightboxRequestIndex];
      const urls = normalizeEvidenceImageUrls(currentCategory);
      
      if (urls.length > 0) {
        lightboxUrls = urls;
        if (lightboxCurrentIndex >= urls.length) {
          lightboxCurrentIndex = urls.length - 1;
        }
        updateLightboxContent();
      } else {
        closeLightbox();
      }
    }


    function handleLightboxTouchStart(e) {
      lightboxTouchStartX = e.changedTouches[0].screenX;
    }


    function handleLightboxTouchEnd(e) {
      lightboxTouchEndX = e.changedTouches[0].screenX;
      handleLightboxSwipeGesture();
    }


    function handleLightboxSwipeGesture() {
      const threshold = 55;
      if (lightboxTouchEndX < lightboxTouchStartX - threshold) {
        navigateLightbox(1);
      } else if (lightboxTouchEndX > lightboxTouchStartX + threshold) {
        navigateLightbox(-1);
      }
    }
