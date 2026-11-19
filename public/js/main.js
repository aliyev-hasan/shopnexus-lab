// i18n helper — falls back to Azerbaijani text if window.I18N wasn't injected on this page
function T(key, fallback) {
  return (window.I18N && window.I18N[key]) || fallback;
}

// Toast bildirişi
function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 right-6 z-[999] rounded-2xl px-5 py-3 font-bold text-white shadow-xl transition-all ' + (type === 'success' ? 'bg-emerald-600' : 'bg-slate-700');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
}

// Wishlist toggle (AJAX)
function updateWishlistBadge(count) {
  const badge = document.getElementById('wishlistCountBadge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.wishlist-toggle');
  if (!btn) return;
  e.preventDefault();
  const productId = btn.getAttribute('data-product-id');
  const icon = btn.querySelector('i');
  if (!icon) return;

  btn.disabled = true;
  btn.classList.add('opacity-50', 'cursor-wait');
  try {
    const res = await fetch('/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    });
    if (res.status === 401 || res.redirected) {
      window.location.href = '/auth/login';
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || T('generic_error', 'Xəta baş verdi'), 'error');
      return;
    }
    if (data.added) {
      icon.className = 'fa-solid fa-heart text-rose-600';
      showToast(T('wishlist_added', 'İstək siyahısına əlavə edildi'), 'success');
    } else {
      icon.className = 'fa-regular fa-heart';
      showToast(T('wishlist_removed', 'İstək siyahısından çıxarıldı'), 'info');
    }
    updateWishlistBadge(data.wishlistCount);
  } catch (err) {
    showToast(T('generic_error', 'Xəta baş verdi'), 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-wait');
  }
});
