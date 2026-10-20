

    function getCleanOriginBaseUrl() {
      return window.location.href.split('?')[0].split('#')[0].replace(/index\.html$/i, '');
    }


    function isSystemConfigHealthy() {
      return (
        CONFIG.FIREBASE.apiKey && !CONFIG.FIREBASE.apiKey.includes('PASTE_') &&
        CONFIG.CLOUDINARY_CLOUD_NAME && !CONFIG.CLOUDINARY_CLOUD_NAME.includes('PASTE_')
      );
    }


    function escapeHtmlOutput(unsafeStringValue) {
      return String(unsafeStringValue || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }


    function escapeAttributeData(unsafeAttrValue) { return escapeHtmlOutput(unsafeAttrValue); }

    function clearActiveObjectUrls() { activeObjectUrls.forEach(url => URL.revokeObjectURL(url)); activeObjectUrls = []; }
