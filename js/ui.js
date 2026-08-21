function showToast(message, type = "success") {
    const toast = document.getElementById('toastNotification');
    const iconContainer = document.getElementById('toastIconContainer');
    const icon = document.getElementById('toastIcon');
    const msgNode = document.getElementById('toastMessage');
    msgNode.innerText = message;
    
    if (type === "success") {
        iconContainer.className = "w-7 h-7 rounded-lg bg-emerald-500 text-zinc-950 flex items-center justify-center";
        icon.className = "fa-solid fa-check";
    } else if (type === "error") {
        iconContainer.className = "w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center";
        icon.className = "fa-solid fa-triangle-exclamation";
    } else {
        iconContainer.className = "w-7 h-7 rounded-lg bg-amber-400 text-zinc-950 flex items-center justify-center";
        icon.className = "fa-solid fa-info";
    }
    
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// Zoom & Drag Logic
let currentZoom = 'fit';
let isDragging = false;
let startX, startY, scrollLeft, scrollTop;

function setZoomMode(mode) { currentZoom = mode; applyZoom(); }
function changeZoom(factor) {
    const img = document.getElementById('compositeStoryboardImage');
    const viewport = document.getElementById('imageViewport');
    if (!img || !viewport) return;
    if (currentZoom === 'fit') {
        const scaleX = (viewport.clientWidth - 32) / (img.naturalWidth || 800);
        const scaleY = (viewport.clientHeight - 32) / (img.naturalHeight || 1422);
        currentZoom = Math.min(scaleX, scaleY, 1.0);
    }
    currentZoom = Math.max(0.1, Math.min(3.0, currentZoom + factor));
    applyZoom();
}
function applyZoom() {
    const img = document.getElementById('compositeStoryboardImage');
    const wrapper = document.getElementById('imageWrapper');
    const viewport = document.getElementById('imageViewport');
    const zoomValText = document.getElementById('zoomVal');
    if (!img || img.classList.contains('hidden') || !img.src) return;
    
    if (currentZoom === 'fit') {
        viewport.classList.remove('overflow-auto');
        viewport.classList.add('overflow-hidden');
        const scaleX = (viewport.clientWidth - 32) / (img.naturalWidth || 800);
        const scaleY = (viewport.clientHeight - 32) / (img.naturalHeight || 1422);
        const fitScale = Math.min(scaleX, scaleY, 1.0);
        wrapper.style.transform = `scale(${fitScale})`;
        zoomValText.innerText = `Fit (${Math.round(fitScale * 100)}%)`;
    } else {
        viewport.classList.remove('overflow-hidden');
        viewport.classList.add('overflow-auto');
        wrapper.style.transform = `scale(${currentZoom})`;
        zoomValText.innerText = `${Math.round(currentZoom * 100)}%`;
    }
}

const viewportContainer = document.getElementById('imageViewport');
if (viewportContainer) {
    viewportContainer.addEventListener('mousedown', (e) => {
        if (currentZoom === 'fit') return;
        isDragging = true;
        viewportContainer.classList.add('cursor-grabbing');
        startX = e.pageX - viewportContainer.offsetLeft;
        startY = e.pageY - viewportContainer.offsetTop;
        scrollLeft = viewportContainer.scrollLeft;
        scrollTop = viewportContainer.scrollTop;
    });
    viewportContainer.addEventListener('mouseleave', () => { isDragging = false; viewportContainer.classList.remove('cursor-grabbing'); });
    viewportContainer.addEventListener('mouseup', () => { isDragging = false; viewportContainer.classList.remove('cursor-grabbing'); });
    viewportContainer.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - viewportContainer.offsetLeft;
        const y = e.pageY - viewportContainer.offsetTop;
        viewportContainer.scrollLeft = scrollLeft - (x - startX) * 1.5;
        viewportContainer.scrollTop = scrollTop - (y - startY) * 1.5;
    });
}

function toggleDownloadDropdown() { document.getElementById('downloadDropdown').classList.toggle('hidden'); }
window.addEventListener('click', function(e) {
    const btn = document.querySelector('[onclick="toggleDownloadDropdown()"]');
    const dropdown = document.getElementById('downloadDropdown');
    if (dropdown && !dropdown.classList.contains('hidden') && e.target !== btn && !btn.contains(e.target)) dropdown.classList.add('hidden');
});
