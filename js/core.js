const PRESETS = {
    indomie: { desc: "Mie instan goreng legendaris Indonesia dengan taburan bawang goreng asli melimpah.", style: "thailand", aspect: "9:16", scenes: "5", duration: "8" },
    skincare: { desc: "Serum pencerah kulit wajah organik dengan kandungan Vitamin C aktif.", style: "indonesia", aspect: "9:16", scenes: "4", duration: "8" },
    coffee: { desc: "Kopi susu gula aren siap minum dalam botol kaca estetik.", style: "vietnam", aspect: "1:1", scenes: "5", duration: "8" },
    bag: { desc: "Tas ransel kulit sintetis tahan air berkualitas tinggi.", style: "malaysia", aspect: "16:9", scenes: "4", duration: "8" }
};

let activeStoryboardData = null;
let selectedStoryboardIndex = 0;
let isPlayingAudioSequence = false;
let currentAudioSource = null;
let uploadedImages = [];
let characterReferenceImage = null;

function autoChooseCharacter() {
    const desc = document.getElementById('productDesc').value.toLowerCase();
    let gender = 'auto', age = 'auto';
    if (desc.includes('skincare') || desc.includes('glow')) { gender = 'female'; age = '26-35'; } 
    else if (desc.includes('kopi') || desc.includes('mie')) { gender = 'female'; age = '17-25'; } 
    else if (desc.includes('gadget') || desc.includes('gaming')) { gender = 'male'; age = '26-35'; } 
    else { gender = Math.random() > 0.5 ? 'female' : 'male'; age = '26-35'; }
    document.getElementById('charGender').value = gender;
    document.getElementById('charAge').value = age;
    showToast(`AI memilih: ${gender === 'female' ? 'Wanita' : 'Pria'} (${age})`, "info");
}

function applyPreset(key) {
    const preset = PRESETS[key]; if (!preset) return;
    document.getElementById('productDesc').value = preset.desc;
    document.getElementById('adStyle').value = preset.style;
    document.getElementById('aspectRatio').value = preset.aspect;
    document.getElementById('sceneCount').value = preset.scenes;
    document.getElementById('adDuration').value = preset.duration;
    autoChooseCharacter(); calculateTotalDuration();
    showToast(`Preset "${key.toUpperCase()}" diterapkan!`);
}

function previewProductImage(event) {
    const files = Array.from(event.target.files); if (!files.length) return;
    const remainingSlots = 5 - uploadedImages.length;
    if (remainingSlots <= 0) { showToast("Maksimal 5 foto!", "warning"); return; }
    const filesToProcess = files.slice(0, remainingSlots);
    let loadedCounter = 0;
    filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImages.push({ id: Date.now() + Math.random(), src: e.target.result, base64: e.target.result.split(',')[1], mimeType: file.type });
            loadedCounter++;
            if (loadedCounter === filesToProcess.length) { renderUploadedThumbnails(); showToast(`${loadedCounter} Foto ditambahkan.`); }
        };
        reader.readAsDataURL(file);
    });
    event.target.value = '';
}

function renderUploadedThumbnails() {
    const container = document.getElementById('imagePreviewContainer');
    const placeholder = document.getElementById('uploadPlaceholder');
    const counter = document.getElementById('imageCounter');
    container.innerHTML = '';
    counter.innerText = `${uploadedImages.length} / 5 Terunggah`;
    if (uploadedImages.length > 0) {
        placeholder.classList.add('hidden'); container.classList.remove('hidden');
        uploadedImages.forEach((img) => {
            const div = document.createElement('div');
            div.className = "relative aspect-square rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 group";
            div.innerHTML = `<img class="w-full h-full object-cover" src="${img.src}"><button onclick="removeProductImage(event, ${img.id})" class="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"><i class="fa-solid fa-times text-[10px]"></i></button>`;
            container.appendChild(div);
        });
    } else { placeholder.classList.remove('hidden'); container.classList.add('hidden'); }
}

function removeProductImage(event, id) {
    event.preventDefault(); event.stopPropagation();
    uploadedImages = uploadedImages.filter(img => img.id !== id);
    renderUploadedThumbnails();
}

function calculateTotalDuration() {
    const totalSeconds = parseInt(document.getElementById('adDuration').value) || 8;
    const count = parseInt(document.getElementById('sceneCount').value) || 5;
    document.getElementById('durationPerSceneText').innerText = `${(totalSeconds / count).toFixed(1)} Detik / Scene`;
    document.getElementById('totalDurationText').innerText = `${totalSeconds} Detik`;
}

function pcmToWav(pcm16, sampleRate) {
    const buffer = new ArrayBuffer(44 + pcm16.length * 2); const view = new DataView(buffer);
    view.setUint32(0, 0x52494646, false); view.setUint32(4, 36 + pcm16.length * 2, true); view.setUint32(8, 0x57415645, false);
    view.setUint32(12, 0x666d7420, false); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); view.setUint32(40, pcm16.length * 2, true);
    for (let i = 0; i < pcm16.length; i++) view.setInt16(44 + i * 2, pcm16[i], true);
    return new Blob([buffer], { type: 'audio/wav' });
}

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64); const len = binaryString.length; const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
}

function copyTextToClipboardHelper(text) {
    const textarea = document.createElement('textarea'); textarea.value = text; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); document.body.removeChild(textarea);
}

function unlockCharacter() {
    characterReferenceImage = null;
    document.getElementById('characterLockPanel').classList.add('hidden');
    showToast("Character reference di-unlock", "info");
}

function uploadCustomCharacterRef(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        characterReferenceImage = { src: e.target.result, base64: e.target.result.split(',')[1], mimeType: file.type, manualUpload: true };
        document.getElementById('characterRefPreview').src = e.target.result;
        document.getElementById('characterLockPanel').classList.remove('hidden');
        document.getElementById('characterLockSubtitle').innerText = "Menggunakan referensi wajah custom";
        document.getElementById('charGender').value = 'auto';
        document.getElementById('charAge').value = 'auto';
        showToast("Foto referensi custom di-upload!", "success");
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}