/**
 * Client-side progressive enhancement for contributor dish cover photos (S5).
 * Resizes & re-encodes via canvas (max 1600px, WebP with JPEG fallback at 0.82),
 * stripping EXIF/GPS metadata on-device before upload. Plain <input type="file">
 * still works without JavaScript.
 */
export const DRAFT_PHOTO_CLIENT_SCRIPT = `(function () {
  var W = typeof window !== 'undefined' ? window : null;
  if (typeof document === 'undefined' || !document.querySelector) return;
  var wrap = document.querySelector('[data-draft-photo-field]');
  if (!wrap) return;
  var input = wrap.querySelector('[data-draft-photo-input]');
  var preview = wrap.querySelector('[data-draft-photo-preview]');
  var removeInput = wrap.querySelector('[data-draft-photo-remove-input]');
  var removeBtn = wrap.querySelector('[data-draft-photo-remove]');
  var statusEl = wrap.querySelector('[data-draft-photo-status]');
  var MAX_DIM = 1600;
  var objectUrl = null;

  function emit(url) {
    if (!W || typeof W.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
    try { W.dispatchEvent(new CustomEvent('2y-photo-change', { detail: { url: url || '' } })); } catch (e) {}
  }

  function showPreview(url) {
    if (preview) {
      if (url) { preview.src = url; preview.hidden = false; }
      else { preview.removeAttribute('src'); preview.hidden = true; }
    }
    if (removeBtn) removeBtn.hidden = !url;
    emit(url);
  }

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.hidden = !msg;
  }

  var existing = wrap.getAttribute('data-existing-url') || '';
  if (existing) showPreview(existing);

  if (removeBtn) {
    removeBtn.addEventListener('click', function () {
      if (objectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
        objectUrl = null;
      }
      if (input) input.value = '';
      if (removeInput) removeInput.value = '1';
      setStatus('');
      showPreview('');
    });
  }

  if (input) {
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (removeInput) removeInput.value = '';
      if (!file) { showPreview(existing); return; }
      if (typeof FileReader !== 'function' || typeof Image !== 'function') {
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          objectUrl = URL.createObjectURL(file);
          showPreview(objectUrl);
        }
        return;
      }
      if (statusEl) setStatus(statusEl.getAttribute('data-msg-resizing') || '');
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var w = img.width || 1, h = img.height || 1;
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w >= h) { h = Math.max(1, Math.round((h * MAX_DIM) / w)); w = MAX_DIM; }
            else { w = Math.max(1, Math.round((w * MAX_DIM) / h)); h = MAX_DIM; }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext && canvas.getContext('2d');
          if (!ctx) { setStatus(''); showPreview(String(ev.target && ev.target.result || '')); return; }
          ctx.drawImage(img, 0, 0, w, h);

          function applyResized(blob, ext) {
            setStatus('');
            if (!blob) { showPreview(String(ev.target && ev.target.result || '')); return; }
            if (typeof DataTransfer === 'function' && typeof File === 'function') {
              try {
                var dt = new DataTransfer();
                dt.items.add(new File([blob], 'dish.' + ext, { type: blob.type }));
                input.files = dt.files;
              } catch (e) {}
            }
            if (objectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
              try { URL.revokeObjectURL(objectUrl); } catch (e) {}
            }
            if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
              objectUrl = URL.createObjectURL(blob);
              showPreview(objectUrl);
            } else {
              showPreview(canvas.toDataURL(blob.type, 0.82));
            }
          }

          if (typeof canvas.toBlob === 'function') {
            canvas.toBlob(function (webpBlob) {
              if (webpBlob && webpBlob.type === 'image/webp') {
                applyResized(webpBlob, 'webp');
              } else {
                canvas.toBlob(function (jpgBlob) { applyResized(jpgBlob, 'jpg'); }, 'image/jpeg', 0.82);
              }
            }, 'image/webp', 0.82);
          } else {
            setStatus('');
            showPreview(canvas.toDataURL('image/jpeg', 0.82));
          }
        };
        img.onerror = function () { setStatus(''); };
        img.src = ev.target && ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
})();`;
