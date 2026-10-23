    let lightboxDocumentOptions = null;
    let lightboxLoadSequence = 0;
    let lightboxReturnFocus = null;

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


    function openLightbox(imageSource, indexOrUrl = 0, requestIndex = null, options = null) {
      const lightboxContainer = document.getElementById('lightbox');
      if (!lightboxContainer) return;
      lightboxContainer.setAttribute('role','dialog');
      lightboxContainer.setAttribute('aria-modal','true');
      lightboxContainer.setAttribute('aria-label','Xem hình ảnh');
      if (!lightboxContainer.dataset.focusReady) {
        lightboxContainer.dataset.focusReady='true';
        lightboxContainer.addEventListener('keydown',event=>{
          if(event.key!=='Tab')return;
          event.stopPropagation();
          const buttons=[...lightboxContainer.querySelectorAll('button')].filter(button=>!button.disabled&&button.getClientRects().length);
          if(!buttons.length)return;
          if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}
          else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}
        });
      }
      lightboxDocumentOptions?.onClose?.();
      lightboxDocumentOptions = options;
      lightboxReturnFocus = document.activeElement;

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
      lightboxContainer.querySelector('button')?.focus({preventScroll:true});
    }


    function closeLightbox() {
      lightboxLoadSequence++;
      const options = lightboxDocumentOptions;
      lightboxDocumentOptions = null;
      const lightboxContainer = document.getElementById('lightbox');
      if (lightboxContainer) lightboxContainer.classList.remove('show');
      const img = document.getElementById('lightboxImg');
      if (img) { img.removeAttribute('src'); img.removeAttribute('aria-busy'); img.style.transform = ''; }
      lightboxUrls = [];
      lightboxCurrentIndex = 0;
      lightboxRequestIndex = null;
      lightboxZoomLevel = 1;
      lightboxRotation = 0;
      options?.onClose?.();
      if (lightboxReturnFocus?.isConnected) lightboxReturnFocus.focus({preventScroll:true});
      lightboxReturnFocus = null;
    }


    function updateLightboxContent() {
      const img = document.getElementById('lightboxImg');
      if (!img) return;
      lightboxZoomLevel = 1;
      lightboxRotation = 0;
      applyLightboxTransform();
      
      if(lightboxUrls[lightboxCurrentIndex])img.src=lightboxUrls[lightboxCurrentIndex];else img.removeAttribute('src');
      img.alt = lightboxDocumentOptions?.labels?.[lightboxCurrentIndex] || 'Ảnh phóng to';
      const sequence = ++lightboxLoadSequence, position = lightboxCurrentIndex, options = lightboxDocumentOptions;
      if (options?.loadImage) {
        img.setAttribute('aria-busy','true');
        Promise.resolve().then(() => options.loadImage(position)).then(url => {
          if (sequence !== lightboxLoadSequence || options !== lightboxDocumentOptions) return;
          lightboxUrls[position] = url; img.src = url; img.removeAttribute('aria-busy');
          const label=document.getElementById('lightboxCounterLabel');if(label)label.textContent='ẢNH '+(position+1)+' / '+lightboxUrls.length+' · '+(options.labels?.[position]||'');
        }).catch(error => {
          if(sequence !== lightboxLoadSequence)return;
          img.removeAttribute('aria-busy');
          const label=document.getElementById('lightboxCounterLabel');if(label)label.textContent=error.message || 'Không tải được ảnh.';
        });
      }
      
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
            if (!url) thumb.removeAttribute('src');
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
