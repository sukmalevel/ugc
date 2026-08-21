// js/main.js
// Berisi logika utama workflow, AI generation, rendering UI, dan integrasi Supabase.

// Inisialisasi saat halaman dimuat
window.onload = function() {
    calculateTotalDuration();
    loadApiKeys(); // Memuat API key dari Supabase
};

// ================= COLOR EXTRACTION HELPER =================
let extractedProductColor = 'neutral';
async function extractDominantColor(imgSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 50; canvas.height = 50;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 50, 50);
            const data = ctx.getImageData(0, 0, 50, 50).data;
            let r=0, g=0, b=0, count=0;
            for(let i=0; i<data.length; i+=4) {
                if(data[i+3] > 128) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; count++; }
            }
            if(count === 0) return resolve('neutral');
            resolve(`rgb(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)})`);
        };
        img.onerror = () => resolve('neutral');
        img.src = imgSrc;
    });
}

// ================= AI ENHANCE DESCRIPTION =================
async function enhanceProductDescription() {
    const btn = document.getElementById('enhanceDescBtn');
    const btnText = document.getElementById('enhanceBtnText');
    const textarea = document.getElementById('productDesc');
    const currentText = textarea.value.trim();
    const originalHTML = btn.innerHTML;
    
    btn.disabled = true; btnText.innerText = "PROCESSING..."; btn.classList.add('animate-pulse');
    
    try {
        const apiKey = getNextApiKey();
        if (!apiKey) throw new Error("API Key tidak tersedia. Silakan atur di pengaturan.");

        let prompt = "";
        let hasImages = uploadedImages.length > 0;
        
        if (hasImages) {
            prompt = `Melihat foto produk yang diunggah, identifikasi produk tersebut secara akurat dan tulis deskripsi produk marketing UGC yang sangat menarik, kreatif, natural, dan persuasif dalam bahasa Indonesia. Highlight nilai jual utama dan keunikan produk tersebut secara mendalam. Jangan memakai gaya bahasa kaku khas robot AI! Gunakan gaya bahasa anak muda yang asik, kasual, jujur, dan berenergi tinggi.`;
            if (currentText) prompt += ` Sempurnakan deskripsi inputan user ini: "${currentText}"`;
        } else {
            if (currentText) prompt = `Optimalkan deskripsi produk berikut agar menjadi jauh lebih menarik, memiliki copywriting UGC bernilai jual tinggi, asik, persuasif, and menggunakan bahasa Indonesia yang mengalir sangat natural. Deskripsi asli: "${currentText}"`;
            else prompt = `Tulis sebuah deskripsi produk kreatif dari awal untuk produk viral. Tulis deskripsinya dengan sangat persuasif, bernada UGC alami, asik, tidak kaku, dan kaya akan nilai jual emosional dalam bahasa Indonesia.`;
        }

        const contents = []; const parts = [{ text: prompt }];
        if (hasImages) uploadedImages.forEach(img => parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
        contents.push({ role: "user", parts: parts });
        
        const systemPrompt = `Kamu adalah AI Copywriter profesional khusus iklan UGC viral. Berikan HANYA teks hasil optimasi deskripsi produk tersebut secara langsung, tanpa tambahan basa-basi.`;
        const payload = { contents: contents, systemInstruction: { parts: [{ text: systemPrompt }] } };
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (!response.ok) throw new Error("Gagal mengoptimalkan deskripsi.");
        const result = await response.json();
        const optimizedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (optimizedText) { textarea.value = optimizedText.trim(); showToast("Deskripsi berhasil dioptimalkan!"); } 
        else throw new Error("Respons optimasi kosong.");
    } catch (err) { showToast("Gagal AI Enhance: " + err.message, "error"); } 
    finally { btn.disabled = false; btn.innerHTML = originalHTML; btn.classList.remove('animate-pulse'); }
}

// ================= MAIN WORKFLOW (GENERATE SCRIPT) =================
async function runStoryboardWorkflow() {
    // 1. Safe check untuk elemen productDesc
    const productDescEl = document.getElementById('productDesc');
    if (!productDescEl) {
        showToast("Elemen deskripsi produk tidak ditemukan di HTML!", "error");
        return;
    }
    const productDesc = productDescEl.value.trim();
    if (!productDesc) { 
        showToast("Masukkan deskripsi produk!", "error"); 
        return; 
    }
    
    const apiKey = getNextApiKey();
    if (!apiKey) { 
        showToast("API Key tidak tersedia! Klik icon Key di header.", "error"); 
        openApiKeyModal(); 
        return; 
    }

    const videoModel = document.getElementById('videoModel').value;
    const storyboardCount = parseInt(document.getElementById('storyboardCount').value) || 1;
    const sceneCount = parseInt(document.getElementById('sceneCount').value);
    const adDuration = parseInt(document.getElementById('adDuration').value);
    const adStyle = document.getElementById('adStyle').value;
    const ratio = document.getElementById('aspectRatio').value;
    const ttsVoice = document.getElementById('ttsVoice').value;
    const charGender = document.getElementById('charGender').value;
    const charAge = document.getElementById('charAge').value;

    let charPreferenceText = "Karakter (Talent): Bebas.";
    if (characterReferenceImage && characterReferenceImage.manualUpload) {
        charPreferenceText = "Karakter (Talent): Menggunakan foto referensi wajah yang di-upload user. WAJIB mempertahankan identitas wajah yang SAMA PERSIS.";
    } else if (charGender !== 'auto' || charAge !== 'auto') {
        charPreferenceText = `Karakter: ${charGender !== 'auto' ? (charGender === 'female' ? 'Wanita' : 'Pria') : 'Bebas'}, Usia ${charAge !== 'auto' ? charAge : 'Bebas'}.`;
    }

    const femaleVoices = ['Zephyr', 'Leda', 'Sulafat'];
    const genderInstructions = femaleVoices.includes(ttsVoice) ? 'using a female voice actor' : 'using a male voice actor';

    // 2. SAFE DOM MANIPULATION (Mencegah error 'null')
    const emptyState = document.getElementById('emptyState');
    const storyboardResult = document.getElementById('storyboardResult');
    const workflowLoader = document.getElementById('workflowLoader');

    if (emptyState) emptyState.classList.add('hidden');
    if (storyboardResult) storyboardResult.classList.add('hidden');
    if (workflowLoader) workflowLoader.classList.remove('hidden');

    // Reset character lock if not manual
    if (!characterReferenceImage || !characterReferenceImage.manualUpload) {
        characterReferenceImage = null;
        const lockPanel = document.getElementById('characterLockPanel');
        if (lockPanel) lockPanel.classList.add('hidden');
    }

    try {
        // SYSTEM PROMPT (Sama seperti sebelumnya, pastikan kamu punya versi lengkapnya di file kamu)
        const systemPrompt = `Kamu adalah pakar kreatif pemasaran UGC (User Generated Content) dan pembuat naskah iklan digital terkemuka di Asia Tenggara.
Tugas kamu adalah membuat naskah & storyboard terstruktur tinggi untuk video affiliate produk.
Bahasa output copywriting, dialog, teks, wajib menggunakan Bahasa Indonesia yang sangat asik, persuasif, dan memicu pembelian.
PILIHAN MODEL GAYA IKLAN YANG AKTIF SAAT INI ADALAH: "${adStyle}".
Kamu WAJIB mematuhinya dan membuat VO (Voiceover) yang merefleksikan gaya tersebut dengan sangat alami, profesional layaknya iklan TV modern namun tetap natural:
- "indonesia" (Relatable): Gaya VO: Santai, natural, seperti sedang mengobrol santai dengan teman dekat. Gunakan slang kekinian yang mengalir alami, asik, tidak kaku, bersahabat, kasual, dan akrab. Nada: Kasual, akrab, tidak kaku.
- "thailand" (Absurd & Lucu): Gaya VO: Sangat dramatis, ekspresif, komikal, lebay, penuh kejutan kocak. Berikan teks jeda dramatis, ekspresi mengejutkan, dinamis, dan menghibur penonton dengan komedi absurd. Nada: Enerjik, ekspresif, entertaining.
- "vietnam" (Energetik & Tren): Gaya VO: Cepat, berenergi tinggi, penuh semangat membara, menggunakan diksi trendi kekinian dengan ritme tempo cepat, dinamis, modern, dan bernada upbeat. Nada: Upbeat, trendi, bersemangat, modern.
- "malaysia" (Hangat & Honest): Gaya VO: Jujur, tulus dari hati, ramah, bernada review tulus (honest review) yang meyakinkan, hangat, tulus, dan alami. Nada: Warm, meyakinkan, tulus.
Model Video yang dipilih: "${videoModel}". Berikan fokus dan detail yang sesuai pada visual, aksi, dan penulisan prompt video:
- default: Alur video promosi UGC standar yang seimbang.
- asmr: Fokus penuh pada audio sensorik yang renyah (misalnya suara ketukan lembut, robekan plastik kemasan, suara mendesis uap, berbisik/whisper). Visual didominasi extreme close-up (macro shot).
- unboxing: Fokus pada ritual pembukaan kotak kemasan produk baru, membuka pita, melepas pembungkus pelindung, mengeksplorasi isi kotak secara berurutan dengan rasa takjub.
- first_impression: Fokus pada impresi jujur pertama kali saat melihat, mencium aroma, atau memegang produk. Ekspresi natural kaget dengan nilai jual barang yang luar biasa.
- product_demo: Fokus mendalam pada demonstrasi praktis fungsi utama produk secara langkah-demi-langkah, menguji performa secara langsung untuk membuktikan khasiatnya.
- lifestyle: Fokus pada estetika penggunaan produk secara alami di dalam skenario kehidupan sehari-hari (misalnya saat bersantai di kamar estetik, bekerja di cafe, berolahraga pagi).
Meskipun gaya visual/vibes mengacu pada salah satu negara di atas, COPYWRITING / SUARA / TEKS HARUS TETAP MENGGUNAKAN BAHASA INDONESIA.
CRITICAL VOICE OVER (VO) OPTIONALITY & WORD COUNT CONSTRAINT (MUTLAK):
1. VO di setiap scene bersifat OPSIONAL. AI bebas menentukan scene mana saja yang memerlukan VO dan mana yang dibiarkan tanpa VO (kosong/diisi "" di JSON). Jangan dipaksa mengisi VO di seluruh adegan. Sesuaikan dengan gaya video, misal ASMR/Unboxing mungkin hanya butuh sedikit VO di bagian tertentu dan didominasi sound effects/SFX.
2. TOTAL seluruh kata Voiceover (VO) dalam SATU STORYBOARD secara kumulatif (gabungan seluruh scene) WAJIB BERKISAR ANTARA MINIMAL 15 KATA DAN MAKSIMAL 20 KATA. Ini adalah aturan wajib demi mencegah VO kepotong saat kompilasi video akhir.
3. Untuk scene yang TIDAK membutuhkan VO, isikan nilai properti "voiceover" dengan string kosong ("") pada skema JSON.
4. Tulis VO (jika ada) seolah-olah diucapkan oleh kreator konten riil yang sedang merekam video secara spontan dan alami sesuai dengan panduan gaya iklan aktif di atas. Hindari kata-kata kaku khas template robot AI.
=========================================
ATURAN EMAS KONTINUITAS & CERITA BERSAMBUNG (STRICT CONTINUOUS STORYTELLING):
=========================================
Jika jumlah storyboard yang dipilih oleh user lebih dari 1 (misalnya storyboardCount = 2 atau 3), semua storyboard tersebut wajib dirancang sebagai satu cerita tunggal yang berjalan maju secara kronologis dan berkesinambungan.
Jangan membuat setiap storyboard menjadi iklan mandiri atau variasi mandiri! Mereka adalah pecahan dari satu durasi iklan penuh (berseri/bersambung).
Pastikan elemen berikut konsisten sepanjang rangkaian storyboard:
1. Karakter/Talent yang sama (pahami aturan konsistensi karakter di bawah).
2. Produk yang sama persis (tahapan penggunaannya berlanjut, misal: di Part 1 produk baru dibuka, di Part 2 produk mulai dioleskan/dipakai).
3. Lokasi dan setting lingkungan yang sama (kecuali jika naskah eksplisit mengarahkan transisi pindah lokasi).
4. Timeline berjalan maju tanpa reset (tidak mengulang kejadian dari awal).
5. Tujuan cerita yang sama mengarah ke gol konversi pembelian.
=========================================
ATURAN KETAT PENEMPATAN CALL TO ACTION (CTA) & PENUTUP:
=========================================
Aturan penempatan Call to Action (CTA) seperti ajakan "klik link di bio", "checkout sekarang di keranjang kuning", "beli sekarang", promosi diskon, atau kalimat penutup final diatur secara ketat berdasarkan urutan indeks storyboard:
1. JIKA USER MEMILIH HANYA 1 STORYBOARD (storyboardCount = 1):
- Storyboard 1 merupakan storyboard terakhir sekaligus pembuka. CTA dan penutup final BOLEH diletakkan di storyboard 1.
2. JIKA USER MEMILIH LEBIH DARI 1 STORYBOARD (storyboardCount > 1):
- HANYA STORYBOARD TERAKHIR (yaitu indeks terakhir, misalnya Storyboard ke-2 dari total 2, atau Storyboard ke-3 dari total 3) yang boleh dan WAJIB memiliki CTA Final, ajakan bertindak (Call to Action), informasi harga/diskon, dan kalimat penutup final.
- SEMUA STORYBOARD SEBELUM TERAKHIR (misalnya Storyboard 1 pada pilihan 2 storyboard, atau Storyboard 1 & 2 pada pilihan 3 storyboard) SANGAT DILARANG memiliki CTA, ajakan membeli, ajakan checkout, penawaran diskon, ataupun kalimat penutup yang mengakhiri video.
- Di akhir storyboard sebelum terakhir, gantilah dengan transisi aksi menggantung (cliffhanger) yang meluncur alami ke storyboard berikutnya, misalnya diakhiri dengan aksi talent bersiap mencicipi produk, atau visual b-roll transisi yang menggugah penasaran.
SANGAT DILARANG mencantumkan teks atau VO berbunyi kaku seperti "lanjut part berikutnya", "cek video selanjutnya", "part berikutnya", "bersambung", "episode berikutnya", "cek Part 2", atau "to be continued". Cerita harus mengalir alami seolah dipotong halus saja tanpa memecah estetika penonton.
Pembagian Struktur Cerita Berseri (kronologis):
- Storyboard 1: Pembuka Cerita (Hook dramatis, pemaparan masalah relatable, pengenalan awal produk). SANGAT DILARANG ADA CTA.
- Storyboard 2 (jika total 3): Kelanjutan Cerita (Aksi lanjutan, demo/pengujian fungsi produk secara langsung, pembuktian benefit). SANGAT DILARANG ADA CTA.
- Storyboard Terakhir (Storyboard 2 dari total 2, atau Storyboard 3 dari total 3): Resolusi & Puncak Cerita (Kepuasan akhir, rangkuman benefit utama produk secara menyeluruh, dan HANYA DI SINI ADA CTA FINAL + PENUTUP KREATIF).
====================================================
KRITIKAL: ATURAN MUTLAK KONSISTENSI KARAKTER (CHARACTER CONSISTENCY)
====================================================
Jika user memilih lebih dari 1 storyboard (storyboardCount > 1):
1. Karakter (Talent) UTAMA harus SAMA PERSIS dan KONSISTEN di SEMUA storyboard:
- Wajah yang SAMA (identitas visual identik).
- Rambut yang SAMA (gaya, warna, panjang rambut).
- Pakaian yang SAMA (warna, model baju, celana, aksesoris/perhiasan).
- Bentuk tubuh yang SAMA.
- Warna kulit yang SAMA.
- Etnis dan ras yang SAMA.
- Usia yang SAMA.
2. Karakter TIDAK BOLEH berubah fisik, berganti peran, berganti gaya rambut, atau berganti kostum di storyboard berikutnya.
3. Cara Penulisan dalam JSON:
- Pada Storyboard pertama (Storyboard 1), deskripsikan karakter secara DETAIL di bagian "visual" (contoh: "Seorang wanita karir usia 28 tahun beretnis Asia Tenggara, rambut hitam sebahu diikat rapi, memakai kemeja linen putih bersih dengan jam tangan kulit cokelat...").
- Pada storyboard berikutnya (Storyboard 2, 3, dst.), dilarang mendeskripsikan ulang fisik karakter baru. Cukup tulis: "Menggunakan karakter yang sama persis seperti pada storyboard sebelumnya" dan lanjutkan dengan aksi/interaksinya dengan produk.
=========================================
ATURAN SINKRONISASI MUTLAK VIDEO PROMPT (IMAGETOVIDEOPROMPT):
=========================================
1. Properti "imageToVideoPrompt" harus merepresentasikan kelanjutan alur visual adegan demi adegan secara SINKRON dengan array "scenes" yang digenerate di JSON yang sama.
2. SANGAT DILARANG KERAS berhalusinasi atau berimajinasi tentang produk baru, karakter baru, atau setting baru yang berbeda dari apa yang didefinisikan pada bagian "scenes" dalam storyboard ini.
3. Jika storyboard membahas "Mie Instan", "imageToVideoPrompt" harus fokus 100% mendeskripsikan "Mie Instan" tersebut. Jangan pernah menyebut barang atau produk lain (misalnya cincin, tas, atau kosmetik) yang tidak ada hubungannya dengan input produk user dan naskah storyboard aktif!
4. Bagian "Scene progression" dalam "imageToVideoPrompt" wajib disalin/diformulasikan secara langsung dari deskripsi "visual" dan "action" yang Anda tulis di array "scenes" di atas. Ini untuk menjamin konsistensi mutlak antara naskah panggung dan arahan AI video generator.
Sediakan JSON format dengan skema persis berisi array dari storyboard (sebanyak storyboardCount yang diminta):
{
"storyboards": [
{
"title": "Judul Iklan Part X (misal: Sumpah Ga Kuat! - Part 1)",
"styleExplanation": "Penjelasan bagaimana gaya adStyle, model video \${videoModel}, aturan konsistensi karakter secara visual, dan konsep saling nyambung kronologis diterapkan di Part ini tanpa memasukkan kalimat penutup kaku.",
"scenes": [
{
"number": 1,
"name": "HOOK / DRAMA / DETAIL",
"visual": "Deskripsi detail visual shot untuk panduan kameramen. Harus sangat detail.",
"action": "Aksi gerakan aktor atau transisi kamera.",
"overlay": "Teks singkat yang akan muncul di layar (CAPS LOCK menarik)",
"voiceover": "Skrip suara (VO) yang dibacakan. Jika scene ini tidak memerlukan VO, biarkan properti ini diisi string kosong (\"\"). JANGAN dipaksa terisi.",
"timeRange": "Detik rentang waktu"
}
],
"compositeImagePrompt": "A single professional, ultra-detailed widescreen commercial photography moodboard showing a grid or collage of scenes representing this product: [INSERT DETAILED VISUALS]. High-end studio lighting, product display, vivid colors.",
"imageToVideoPrompt": "You MUST generate the entire continuous storyboard video flow prompt following this EXACT template structure (do not change titles or bullet points, just fill in the bracketed/specified descriptive content). Do not write generic prefixes without 'Scene X' index! Keep it strictly clean, formatted, and strictly matching the format:\
\
Create a [vertical 9:16 / horizontal 16:9 / square 1:1, write based on ${ratio}] cinematic video based on the provided storyboard images.\
\
Use the storyboard images as the primary visual reference.\
Preserve the exact character identity, environment, product design, composition, color style, and overall visual direction from the storyboard.\
\
Transform each storyboard frame into a dynamic cinematic shot.\
\
Scene progression:\
- (Scene 1, [timeRange of scene 1]): [WRITE EXACTLY the visual and action of Scene 1 from the scenes array below, preserving the exact product, talent, and environment details. DO NOT innovate or describe any other product or scene!]\
- (Scene 2, [timeRange of scene 2]): [WRITE EXACTLY the visual and action of Scene 2 from the scenes array below, preserving the exact product, talent, and environment details. DO NOT innovate or describe any other product or scene!]\
... (include all generated scenes in exact chronological order with 'Scene X' prefix and time range following the format above. Maintain strict physical consistency of the product and character!)\
- Animate each scene from storyboard frame naturally while keeping the original composition and visual intent.\
- Add realistic character movement, facial expressions, body motion, and environmental motion where appropriate.\
- Create smooth cinematic camera movements such as push-in, pull-out, tracking shots, or subtle handheld movement.\
- Add realistic lighting changes, depth, atmosphere, and visual effects that match the storyboard.\
- Maintain consistency of the character, objects, and style across all scenes.\
- Create smooth transitions between storyboard frames while preserving continuity.\
- Do not redesign, replace, or change elements from the original storyboard.\
\
Style:\
[Detailed paragraph describing the style based on the selected adStyle: ${adStyle}, videoModel: ${videoModel}, and styleExplanation. Focus solely on the product and character details matching the storyboard.]\
\
Audio:\
Generate one continuous voiceover based on the provided script (${genderInstructions})\
Do not skip, shorten, or paraphrase the voiceover.\
Synchronize the pacing of the video with the narration.\
\
Voiceover:\
\\\"[MENGGABUNGKAN HANYA BARIS SCENE YANG MEMILIKI VO SECARA BERURUTAN KRONOLOGIS SEBAGAI SATU PARAGRAF. TOTAL DI SINI WAJIB BERKISAR ANTARA 15 HINGGA 20 KATA. DO NOT hallucinate any other lines]\\\""
}
]}`;
        const userQuery = `Buat ${storyboardCount} alternatif storyboard berseri/berkelanjutan yang saling menyambung secara kronologis dari awal sampai akhir.
Masing-masing storyboard memiliki ${sceneCount} adegan dengan total durasi video pas ${adDuration} detik.
Rasio Video: ${ratio}.
Deskripsi Produk: "${productDesc}".
Gaya Iklan: "${adStyle}".
Model Video: "${videoModel}".
${charPreferenceText}
ATURAN UTAMA:
- Jika total storyboard = 1, letakkan CTA di storyboard 1.
- Jika total storyboard > 1 (misalnya 2 atau 3), SANGAT DILARANG menaruh CTA di storyboard sebelum terakhir. CTA HANYA boleh ada di storyboard terakhir (Storyboard ${storyboardCount}).
- Jangan gunakan kata pemutus seperti "bersambung", "lanjut part berikutnya" dll. Transisi antar-storyboard harus terjadi secara visual dan naratif menggantung yang elegan.
- Semua storyboard harus membentuk satu kesatuan alur cerita berkelanjutan (talent sama, produk berlanjut, lokasi sinkron, timeline maju terus).
- IKUTI ATURAN MUTLAK KONSISTENSI KARAKTER di seluruh storyboard bersambung secara konsisten.
- Selaras dengan naskah adegan, properti "imageToVideoPrompt" WAJIB sinkron 100% dengan visual & aksi dari naskah scenes. DILARANG KERAS menghalusi atau memasukkan produk lain (seperti cincin berlian, mobil, dsb) jika tidak didefinisikan di storyboard!
ATURAN VOICEOVER (PENTING):
- VO di setiap scene bersifat OPSIONAL (jika scene tidak butuh VO, isi properti "voiceover": "").
- TOTAL SEMUA kata VO yang terisi di satu storyboard WAJIB BERKISAR ANTARA MINIMAL 15 KATA DAN MAKSIMAL 20 KATA.`;

        const contents = [];
        const userParts = [{ text: userQuery }];
        uploadedImages.forEach(img => userParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
        contents.push({ role: "user", parts: userParts });

        const payload = {
            contents: contents,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        storyboards: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    title: { type: "STRING" },
                                    styleExplanation: { type: "STRING" },
                                    scenes: {
                                        type: "ARRAY",
                                        items: {
                                            type: "OBJECT",
                                            properties: {
                                                number: { type: "INTEGER" },
                                                name: { type: "STRING" },
                                                visual: { type: "STRING" },
                                                action: { type: "STRING" },
                                                overlay: { type: "STRING" },
                                                voiceover: { type: "STRING" },
                                                timeRange: { type: "STRING" }
                                            },
                                            required: ["number", "name", "visual", "action", "overlay", "voiceover", "timeRange"]
                                        }
                                    },
                                    compositeImagePrompt: { type: "STRING" },
                                    imageToVideoPrompt: { type: "STRING" }
                                },
                                required: ["title", "styleExplanation", "scenes", "compositeImagePrompt", "imageToVideoPrompt"]
                            }
                        }
                    },
                    required: ["storyboards"]
                }
            },
            systemInstruction: { parts: [{ text: systemPrompt }] }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (!response.ok) throw new Error("Gagal mengambil respons script.");
        const result = await response.json();
        const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("Data script kosong.");
        
        activeStoryboardData = JSON.parse(responseText);
        selectedStoryboardIndex = 0;

        // Update UI setelah berhasil
        if (workflowLoader) workflowLoader.classList.add('hidden');
        renderStoryboardTabs();
        renderSelectedStoryboard();
        
        // Simpan ke Supabase
        await saveProjectToSupabase(productDesc, { videoModel, storyboardCount, sceneCount, adDuration, adStyle, ratio, ttsVoice, charGender, charAge });

    } catch (error) {
        console.error(error);
        showToast("Error: " + error.message, "error");
        if (emptyState) emptyState.classList.remove('hidden');
        if (workflowLoader) workflowLoader.classList.add('hidden');
    }
}

// ================= SUPABASE SAVE =================
async function saveProjectToSupabase(desc, config) {
    if (!currentUser || !activeStoryboardData) return;
    const { error } = await supabaseClient.from('storyboard_projects').insert({
        user_id: currentUser.id,
        project_name: activeStoryboardData.storyboards[0].title || 'Untitled Project',
        product_description: desc,
        config_data: config,
        storyboard_data: activeStoryboardData
    });
    if (error) console.error("Gagal menyimpan project:", error);
    else showToast("Project berhasil disimpan ke database!", "success");
}

// ================= IMAGE GENERATION =================
async function triggerImmediateImageGen() {
    if (!activeStoryboardData || !activeStoryboardData.storyboards[selectedStoryboardIndex]) {
        showToast("Belum ada data storyboard yang aktif.", "error"); return;
    }
    const placeholderContent = document.getElementById('imagePlaceholderContent');
    const loaderContent = document.getElementById('imageLoaderContent');
    const imageDisplay = document.getElementById('compositeStoryboardImage');
    const brandTag = document.getElementById('imageBrandTag');
    const visualStatus = document.getElementById('visualStatusText');
    
    placeholderContent.classList.add('hidden'); loaderContent.classList.remove('hidden');
    imageDisplay.classList.add('hidden'); brandTag.classList.add('hidden');
    visualStatus.innerText = "Generating..."; visualStatus.className = "text-[10px] bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded border border-amber-400/40 animate-pulse";

    try {
        await generateActiveStoryboardImage(selectedStoryboardIndex);
        const storyboard = activeStoryboardData.storyboards[selectedStoryboardIndex];
        loaderContent.classList.add('hidden');
        imageDisplay.src = storyboard.imageUrl; imageDisplay.classList.remove('hidden');
        document.getElementById('imageWrapper').classList.remove('hidden');
        brandTag.classList.remove('hidden');
        document.getElementById('imageControlToolbar').classList.remove('hidden');
        visualStatus.innerText = "Generated"; visualStatus.className = "text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/40";
        setTimeout(() => { currentZoom = 'fit'; applyZoom(); }, 50);
        showToast("Gambar storyboard visual berhasil dibuat!");
    } catch (err) {
        console.error(err); showToast("Gagal melukis gambar visual.", "error");
        placeholderContent.classList.remove('hidden'); loaderContent.classList.add('hidden');
        document.getElementById('imageControlToolbar').classList.add('hidden');
        document.getElementById('imageWrapper').classList.add('hidden');
        visualStatus.innerText = "Gagal"; visualStatus.className = "text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/40";
    }
}

async function generateActiveStoryboardImage(index) {
    const storyboard = activeStoryboardData.storyboards[index];
    const imageModel = document.getElementById('imageModel').value;
    const apiKey = getNextApiKey();
    if (!apiKey) throw new Error("API Key tidak tersedia.");
    if (storyboard.imageUrl) return;

    if (uploadedImages.length > 0 && extractedProductColor === 'neutral') {
        extractedProductColor = await extractDominantColor(uploadedImages[0].src);
    }

    const scenesDescription = storyboard.scenes.map(s => `Panel Number: Panel ${s.number}\nScene Name: ${s.name}\nVisual / Shot: ${s.visual}\nTalent Action: ${s.action}\nOverlay Text: "${s.overlay}"\nDuration: ${s.timeRange}\nVoice Over: "${s.voiceover}"`).join('\n\n');

    const colorInstruction = extractedProductColor !== 'neutral' ? `\n# COLOR & THEME CONSISTENCY\nWarna dominan produk yang di-upload adalah ${extractedProductColor}. Gunakan warna ini sebagai accent color utama untuk border, badge scene number, teks overlay, dan elemen desain lainnya di seluruh storyboard. Background halaman tetap putih bersih, tapi elemen UI harus senada dengan warna produk ini.\n` : '';

    const characterRefInstruction = (characterReferenceImage && index > 0) ? `\n# CHARACTER REFERENCE\nSebuah reference image karakter telah disediakan di input. WAJIB menggunakan wajah, fitur wajah, gaya rambut, warna kulit, dan identitas visual yang SAMA PERSIS dengan karakter di reference image tersebut.\n` : '';

    const imagePrompt = `# IMAGE STORYBOARD TEMPLATE\nGunakan template berikut sebagai aturan visual. Storyboard script di bawah adalah satu-satunya sumber kebenaran.\n---\n# LAYOUT\nCanvas: Portrait 9:16. Clean white background. Premium advertising agency presentation. Modern editorial layout. Luxury minimalist design. Consistent spacing and margins.\nTambahkan watermark akun: **@asaltekun** di bagian bawah halaman.\n---\n# HEADER\nTampilkan: Product Hero Image, Judul besar: **STORYBOARD ${index + 1}**, Product, Campaign, Visual Style, Camera Style.\n---\n# STORYBOARD LAYOUT\nBuat storyboard presentation profesional berbentuk tabel 3 kolom terstruktur. Tampilkan tepat ${storyboard.scenes.length} baris/panel.\nLayout 3 Columns:\n## COLUMN 1: SCENE NUMBER (Scene 1, Scene 2, dst.)\n## COLUMN 2: VISUAL / SHOT (Individual 9:16 Portrait Frame, Vertical Commercial Frame, Smartphone video composition)\n## COLUMN 3: ACTION (Deskripsi aksi, gerakan talent, voice over)\n---\n# MOBILE FIRST RULE\nSemua storyboard untuk TikTok, Instagram Reels, YouTube Shorts. Vertical framing, Product visibility, Human interaction.\n---\n# PRODUCT HERO RULE\nThe uploaded product image is the MASTER REFERENCE. Use the uploaded product EXACTLY as shown. Do NOT redesign, reinterpret, or modify the product. Keep identical shape, dimensions, proportions, cap, lid, logo, colors, materials, texture, reflections, branding.\n---\n# CHARACTER CONSISTENCY\nPertahankan secara identik: Face, Hairstyle, Wardrobe, Accessories, Body proportions, Skin tone. Jangan mengganti karakter pada scene berikutnya.\n---\n# ENVIRONMENT CONSISTENCY\nPertahankan: Environment, Background, Lighting style, Color grading, Props, Camera style.\n---\n# VISUAL STYLE\nProfessional TV Commercial, Advertising Agency Presentation, Luxury Minimalist Layout, Photorealistic, Ultra Realistic, Premium Commercial Photography, Editorial Design, Modern Typography, White Background, Grey Divider Lines.\n---\n# CONTINUITY RULES\nMaintain identical visual consistency across every scene. Never change Product design, Character appearance, Lighting style, Color grading.\n---\n# DO NOT\nNever create: Pencil sketch, Black and white drawing, Cartoon, Anime, Comic, Illustration, Concept art. Never create: Landscape storyboard, Horizontal frame, Movie widescreen composition.\n---\n# FINAL OUTPUT\nGenerate: A professional advertising storyboard presentation with Cover Header, Storyboard Header, Storyboard Panels, Professional Layout, Luxury Commercial Presentation, Vertical 9:16 Commercial Frames.\n---\n${colorInstruction}${characterRefInstruction}# FINAL STORYBOARD SCRIPT\n${scenesDescription}`;

    let generatedUrl = "";
    try {
        if (imageModel === 'imagen') {
            const imagenPayload = { instances: { prompt: imagePrompt }, parameters: { sampleCount: 1, aspectRatio: "9:16", outputMimeType: "image/png" } };
            const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
            const imageResponse = await fetch(imagenUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(imagenPayload) });
            if (imageResponse.ok) {
                const imageResult = await imageResponse.json();
                const bytes = imageResult.predictions?.[0]?.bytesBase64Encoded;
                if (bytes) generatedUrl = `data:image/png;base64,${bytes}`;
            }
        } else {
            const bananaParts = [{ text: imagePrompt }];
            if (characterReferenceImage && index > 0) {
                bananaParts.push({ inlineData: { mimeType: characterReferenceImage.mimeType, data: characterReferenceImage.base64 } });
            }
            uploadedImages.forEach(img => bananaParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
            const bananaPayload = { contents: [{ role: 'user', parts: bananaParts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: "9:16" } } };
            const bananaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
            const imageResponse = await fetch(bananaUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bananaPayload) });
            if (imageResponse.ok) {
                const imageResult = await imageResponse.json();
                const part = imageResult?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (part) generatedUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    } catch (err) { console.error("Image generation error:", err); }

    if (!generatedUrl) generatedUrl = `https://placehold.co/450x800/1c1917/eab308?text=${encodeURIComponent(storyboard.title)}`;
    storyboard.imageUrl = generatedUrl;

    // Auto-lock logic
    if (index === 0 && !characterReferenceImage) {
        const storyboardCount = parseInt(document.getElementById('storyboardCount').value) || 1;
        if (storyboardCount > 1) {
            characterReferenceImage = { src: generatedUrl, base64: generatedUrl.split(',')[1], mimeType: 'image/png', manualUpload: false };
            document.getElementById('characterRefPreview').src = generatedUrl;
            document.getElementById('characterLockPanel').classList.remove('hidden');
            document.getElementById('characterLockSubtitle').innerText = "Wajah dari Part 1 akan dipakai di Part berikutnya";
            showToast("Karakter auto-locked untuk konsistensi wajah!", "success");
        }
    }
}

// ================= UI RENDERING =================
function renderStoryboardTabs() {
    const tabsContainer = document.getElementById('storyboardTabsContainer');
    tabsContainer.innerHTML = '';
    const storyboards = activeStoryboardData.storyboards;
    if (storyboards.length > 1) {
        tabsContainer.classList.remove('hidden');
        storyboards.forEach((sb, index) => {
            const tabButton = document.createElement('button');
            const isLocked = characterReferenceImage && index > 0;
            tabButton.className = `px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${index === selectedStoryboardIndex ? 'bg-amber-400 text-zinc-950 shadow-md' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}`;
            tabButton.innerHTML = `<i class="fa-solid fa-clapperboard"></i> Part ${index + 1}: ${sb.title.substring(0, 15)}... ${isLocked ? '<i class="fa-solid fa-lock text-[10px] text-amber-400 ml-1"></i>' : ''}`;
            tabButton.onclick = () => switchStoryboard(index);
            tabsContainer.appendChild(tabButton);
        });
    } else { tabsContainer.classList.add('hidden'); }
}

async function switchStoryboard(index) {
    if (index === selectedStoryboardIndex) return;
    if (currentAudioSource) { currentAudioSource.pause(); currentAudioSource = null; }
    isPlayingAudioSequence = false; updatePlayAllButtonState(false);
    selectedStoryboardIndex = index;
    renderStoryboardTabs(); renderSelectedStoryboard();
    showToast(`Beralih ke Part ${index + 1} (Cerita Bersambung)`);
}

function renderSelectedStoryboard() {
    const storyboard = activeStoryboardData.storyboards[selectedStoryboardIndex];
    const ratio = document.getElementById('aspectRatio').value;
    const totalSeconds = parseInt(document.getElementById('adDuration').value) || 8;
    const engine = document.getElementById('imageModel').value;

    document.getElementById('outStoryboardTitle').innerText = storyboard.title;
    document.getElementById('outStyleExplanation').innerText = storyboard.styleExplanation;
    document.getElementById('outEngineUsed').innerText = engine === 'imagen' ? 'Imagen 4' : 'Nano Banana 2';
    document.getElementById('outRatio').innerText = ratio;
    document.getElementById('outDuration').innerText = `${totalSeconds} Detik`;
    const styleMap = { indonesia: "Indonesia Relatable Vibe", thailand: "Thailand Absurd Humor", vietnam: "Vietnam Fast Transition Style", malaysia: "Malaysia Warm & Honest Review" };
    document.getElementById('outVibeBadge').innerText = styleMap[document.getElementById('adStyle').value] || "UGC Ads Vibe";

    const placeholderContent = document.getElementById('imagePlaceholderContent');
    const loaderContent = document.getElementById('imageLoaderContent');
    const imageDisplay = document.getElementById('compositeStoryboardImage');
    const brandTag = document.getElementById('imageBrandTag');
    const visualStatus = document.getElementById('visualStatusText');

    if (storyboard.imageUrl) {
        placeholderContent.classList.add('hidden'); loaderContent.classList.add('hidden');
        imageDisplay.src = storyboard.imageUrl; imageDisplay.classList.remove('hidden');
        document.getElementById('imageWrapper').classList.remove('hidden');
        brandTag.classList.remove('hidden'); document.getElementById('imageControlToolbar').classList.remove('hidden');
        visualStatus.innerText = "Generated"; visualStatus.className = "text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/40";
        setTimeout(() => { currentZoom = 'fit'; applyZoom(); }, 50);
    } else {
        placeholderContent.classList.remove('hidden'); loaderContent.classList.add('hidden');
        imageDisplay.classList.add('hidden'); document.getElementById('imageWrapper').classList.add('hidden');
        brandTag.classList.add('hidden'); document.getElementById('imageControlToolbar').classList.add('hidden');
        visualStatus.innerText = "Belum Digenerate"; visualStatus.className = "text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700";
    }

    if (characterReferenceImage) {
        document.getElementById('characterLockPanel').classList.remove('hidden');
        document.getElementById('characterRefPreview').src = characterReferenceImage.src;
    }

    const tbody = document.getElementById('storyboardTableBody'); tbody.innerHTML = '';
    storyboard.scenes.forEach((scene, index) => {
        const tr = document.createElement('tr'); tr.className = "hover:bg-zinc-900/50 transition-colors border-b border-zinc-800";
        const hasVoiceover = scene.voiceover && scene.voiceover.trim() !== "";
        const voDisplayHtml = hasVoiceover ? `<p class="text-zinc-400 italic mb-2">"${scene.voiceover}"</p><button onclick="playSingleVoiceover(${index}, this)" class="inline-flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 hover:text-amber-400 text-zinc-300 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-zinc-700 transition"><i class="fa-solid fa-volume-high"></i> Play VO</button>` : `<span class="text-zinc-600 font-medium italic">-</span>`;
        tr.innerHTML = `<td class="py-4 px-4 text-center"><div class="w-8 h-8 rounded-full bg-amber-400 text-zinc-950 font-black flex items-center justify-center mx-auto text-xs shadow-md shadow-amber-400/10">${scene.number}</div><span class="block text-[9px] uppercase tracking-wider font-extrabold text-amber-400 mt-1.5">${scene.name}</span></td><td class="py-4 px-4 text-xs font-semibold text-zinc-100 leading-relaxed max-w-xs">${scene.visual}</td><td class="py-4 px-4 text-xs text-zinc-300 leading-relaxed max-w-xs">${scene.action}</td><td class="py-4 px-4 font-bold text-xs text-amber-300 tracking-wide"><div class="border border-amber-400/20 bg-amber-400/5 px-2 py-1.5 rounded-lg text-center uppercase">"${scene.overlay}"</div></td><td class="py-4 px-4 text-xs">${voDisplayHtml}</td><td class="py-4 px-4 text-center font-bold text-xs text-zinc-400"><div class="flex items-center justify-center gap-1"><i class="fa-regular fa-clock text-[10px] text-zinc-500"></i><span>${scene.timeRange}</span></div></td>`;
        tbody.appendChild(tr);
    });

    const promptsContainer = document.getElementById('videoPromptsContainer');
    promptsContainer.innerHTML = `<div class="col-span-full bg-zinc-950 border border-zinc-800 p-5 rounded-xl space-y-4 flex flex-col justify-between"><div><div class="flex justify-between items-center mb-2"><span class="text-[10px] bg-amber-400/20 text-amber-300 px-2.5 py-1 rounded font-bold uppercase tracking-wider">FULL STORYBOARD VIDEO FLOW PROMPT</span><span class="text-[9px] text-zinc-500">Optimized for Kling, Luma Dream Machine, Gen-3</span></div><p class="text-xs text-zinc-400 mb-3 leading-relaxed">Prompt video ini dirancang terpadu untuk merealisasikan seluruh transisi adegan secara berkesinambungan.</p><div class="bg-zinc-900/60 p-3.5 rounded-lg border border-zinc-800 text-[11px] text-zinc-300 font-mono whitespace-pre-wrap select-all leading-relaxed">${storyboard.imageToVideoPrompt || `Cinematic professional video showcasing the product...`}</div></div><button onclick="copyAllVideoPrompts()" class="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 active:scale-95 text-zinc-950 text-xs font-extrabold rounded-lg transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-400/10"><i class="fa-solid fa-copy"></i> Copy Prompt Video Utama</button></div>`;

    document.getElementById('playAllAudioBtn').disabled = false;
    document.getElementById('downloadVoBtn').disabled = false;
    document.getElementById('workflowLoader').classList.add('hidden');
    document.getElementById('storyboardResult').classList.remove('hidden');
    document.getElementById('storyboardResult').scrollIntoView({ behavior: 'smooth' });
}

// ================= COPY & DOWNLOAD =================
function copyAllScript() {
    if (!activeStoryboardData) { showToast("Belum ada storyboard yang aktif.", "error"); return; }
    const adStyle = document.getElementById('adStyle').value; const ratio = document.getElementById('aspectRatio').value; const totalDuration = document.getElementById('totalDurationText').innerText;
    let textContent = `====================================================\nUGC AFFILIATE STORYBOARD - BERSERI / SALING NYAMBUNG\n====================================================\nGaya Iklan  : ${adStyle.toUpperCase()}\nRasio Video : ${ratio}\nTotal Durasi: ${totalDuration} per Part\n`;
    activeStoryboardData.storyboards.forEach((sb, index) => {
        textContent += `====================================================\nPART ${index + 1}: ${sb.title.toUpperCase()}\nVibes/Alur : ${sb.styleExplanation}\n====================================================\n`;
        sb.scenes.forEach(scene => {
            textContent += `----------------------------------------------------\nSCENE ${scene.number}: ${scene.name.toUpperCase()} [${scene.timeRange}]\n----------------------------------------------------\nVisual / Shot   : ${scene.visual}\nAksi / Transisi : ${scene.action}\nTeks Overlay    : "${scene.overlay}"\nSuara (VO)      : ${scene.voiceover && scene.voiceover.trim() !== "" ? `"${scene.voiceover}"` : "-"}\n`;
        });
    });
    try { copyTextToClipboardHelper(textContent); showToast("Seluruh rangkaian cerita bersambung berhasil disalin ke clipboard!"); } catch (err) { showToast("Gagal menyalin script.", "error"); }
}

function copyAllVideoPrompts() {
    const storyboard = activeStoryboardData.storyboards[selectedStoryboardIndex]; if (!storyboard) return;
    copyTextToClipboardHelper(storyboard.imageToVideoPrompt || `Cinematic professional video...`);
    showToast("Prompt video utama berhasil disalin!");
}

function downloadScreenshot() { window.print(); }

function toggleDownloadDropdown() { document.getElementById('downloadDropdown').classList.toggle('hidden'); }

function downloadVisual(format) {
    const storyboard = activeStoryboardData.storyboards[selectedStoryboardIndex]; if (!storyboard || !storyboard.imageUrl) { showToast("Harap generate gambar storyboard terlebih dahulu!", "error"); return; }
    const base64Url = storyboard.imageUrl; document.getElementById('downloadDropdown').classList.add('hidden');
    if (base64Url.startsWith('http')) { const a = document.createElement('a'); a.href = base64Url; a.download = `storyboard_part_${selectedStoryboardIndex + 1}.${format}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("Berhasil memulai unduhan!"); return; }
    if (format === 'jpg' || format === 'jpeg') {
        const img = new Image(); img.onload = function() { const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); try { const jpgBase64 = canvas.toDataURL('image/jpeg', 0.9); const a = document.createElement('a'); a.href = jpgBase64; a.download = `storyboard_part_${selectedStoryboardIndex + 1}.jpg`; document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("Berhasil mengunduh dalam format JPEG!"); } catch(e) { const a = document.createElement('a'); a.href = base64Url; a.download = `storyboard_part_${selectedStoryboardIndex + 1}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("Fallback: Mengunduh dalam format PNG."); } }; img.src = base64Url;
    } else { const a = document.createElement('a'); a.href = base64Url; a.download = `storyboard_part_${selectedStoryboardIndex + 1}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("Berhasil mengunduh dalam format PNG!"); }
}

async function regenerateActiveVisual() {
    if (!activeStoryboardData || !activeStoryboardData.storyboards[selectedStoryboardIndex]) return;
    const storyboard = activeStoryboardData.storyboards[selectedStoryboardIndex];
    storyboard.imageUrl = null; showToast("Menghubungi AI untuk melukis variasi visual baru...", "info");
    await triggerImmediateImageGen();
}

// ================= AUDIO / TTS =================
async function playSingleVoiceover(sceneIndex, buttonElement) {
    const storyboard = activeStoryboardData.storyboards[selectedStoryboardIndex]; if (!storyboard || !storyboard.scenes[sceneIndex]) return;
    const scene = storyboard.scenes[sceneIndex];
    if (!scene.voiceover || scene.voiceover.trim() === "") { showToast("Adegan ini tidak memiliki Voiceover.", "info"); return; }
    const voice = document.getElementById('ttsVoice').value;
    if (currentAudioSource) { currentAudioSource.pause(); currentAudioSource = null; }
    const originalHTML = buttonElement.innerHTML; buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin text-amber-400"></i> Generating...';
    try {
        let audioData = scene.audioBase64; let sampleRate = scene.audioSampleRate || 24000;
        if (!audioData) {
            const payload = { contents: [{ parts: [{ text: `Katakan dengan gaya promosi iklan yang sangat persuasif, ekspresif, dan asik sesuai gaya iklan terpilih: ${scene.voiceover}` }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }, model: "gemini-2.5-flash-preview-tts" };
            const apiKey = getNextApiKey();
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error("Gagal generate audio dari TTS API.");
            const result = await response.json(); const part = result?.candidates?.[0]?.content?.parts?.[0];
            audioData = part?.inlineData?.data; const mimeType = part?.inlineData?.mimeType;
            sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || "24000", 10);
            scene.audioBase64 = audioData; scene.audioSampleRate = sampleRate;
        }
        if (audioData) {
            const pcmData = base64ToArrayBuffer(audioData); const pcm16 = new Int16Array(pcmData); const wavBlob = pcmToWav(pcm16, sampleRate);
            const audioUrl = URL.createObjectURL(wavBlob); const audio = new Audio(audioUrl); currentAudioSource = audio;
            buttonElement.innerHTML = '<i class="fa-solid fa-volume-high text-amber-400 animate-pulse"></i> Playing...';
            audio.onended = () => { buttonElement.innerHTML = originalHTML; buttonElement.disabled = false; currentAudioSource = null; };
            await audio.play();
        } else throw new Error("Mimetype audio tidak didukung.");
    } catch (error) { console.error(error); showToast("Gagal memutar Voiceover: " + error.message, "error"); buttonElement.innerHTML = originalHTML; buttonElement.disabled = false; }
}

async function downloadWholeVO() {
    const storyboard = activeStoryboardData.storyboards[selectedStoryboardIndex]; if (!storyboard) return;
    const btn = document.getElementById('downloadVoBtn'); const originalHTML = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i> Merging VO...';
    showToast("Sedang menggabungkan seluruh Voiceover...", "info");
    const scenes = storyboard.scenes; const voice = document.getElementById('ttsVoice').value; const allPcmArrays = []; let commonSampleRate = 24000;
    try {
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i]; if (!scene.voiceover || scene.voiceover.trim() === "") continue;
            let base64Data = scene.audioBase64; let sampleRate = scene.audioSampleRate || 24000;
            if (!base64Data) {
                const payload = { contents: [{ parts: [{ text: `Katakan dengan nada promosi iklan yang asik: ${scene.voiceover}` }] }], generationConfig: { responseModalities: ["AUDIO"], bgType: "RAW", speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }, model: "gemini-2.5-flash-preview-tts" };
                const apiKey = getNextApiKey();
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error("Gagal mengolah audio.");
                const result = await response.json(); const part = result?.candidates?.[0]?.content?.parts?.[0];
                base64Data = part?.inlineData?.data; const mimeType = part?.inlineData?.mimeType;
                sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || "24000", 10);
                scene.audioBase64 = base64Data; scene.audioSampleRate = sampleRate;
            }
            if (base64Data) { commonSampleRate = sampleRate; const pcmBuffer = base64ToArrayBuffer(base64Data); const pcm16 = new Int16Array(pcmBuffer); allPcmArrays.push(pcm16); }
        }
        if (allPcmArrays.length === 0) throw new Error("Tidak ada data audio voiceover.");
        let totalLength = allPcmArrays.reduce((acc, arr) => acc + arr.length, 0); const mergedPcm = new Int16Array(totalLength); let offset = 0;
        for (const arr of allPcmArrays) { mergedPcm.set(arr, offset); offset += arr.length; }
        const wavBlob = pcmToWav(mergedPcm, commonSampleRate); const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a'); a.href = url; a.download = `${storyboard.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_full_VO.wav`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showToast("Voiceover utuh berhasil diunduh!");
    } catch (err) { console.error(err); showToast("Gagal mendownload gabungan audio: " + err.message, "error"); } 
    finally { btn.disabled = false; btn.innerHTML = originalHTML; }
}

async function playFullVoiceover() {
    if (!activeStoryboardData || isPlayingAudioSequence) { if (currentAudioSource) { currentAudioSource.pause(); currentAudioSource = null; } isPlayingAudioSequence = false; updatePlayAllButtonState(false); return; }
    isPlayingAudioSequence = true; updatePlayAllButtonState(true);
    const storyboard = activeStoryboardData.storyboards[selectedStoryboardIndex]; const scenes = storyboard.scenes; const voice = document.getElementById('ttsVoice').value;
    for (let i = 0; i < scenes.length; i++) {
        if (!isPlayingAudioSequence) break; const scene = scenes[i]; const rows = document.getElementById('storyboardTableBody').children; const row = rows[i]; row.classList.add('bg-amber-400/10');
        try {
            await new Promise(async (resolve, reject) => {
                if (!scene.voiceover || scene.voiceover.trim() === "") { setTimeout(() => { row.classList.remove('bg-amber-400/10'); resolve(); }, 500); return; }
                let audioData = scene.audioBase64; let sampleRate = scene.audioSampleRate || 24000;
                if (!audioData) {
                    const payload = { contents: [{ parts: [{ text: `Katakan dengan nada promosi iklan yang asik: ${scene.voiceover}` }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }, model: "gemini-2.5-flash-preview-tts" };
                    const apiKey = getNextApiKey();
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
                    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!response.ok) throw new Error("Gagal generate audio.");
                    const result = await response.json(); const part = result?.candidates?.[0]?.content?.parts?.[0];
                    audioData = part?.inlineData?.data; const mimeType = part?.inlineData?.mimeType;
                    sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || "24000", 10);
                    scene.audioBase64 = audioData; scene.audioSampleRate = sampleRate;
                }
                if (audioData) {
                    const pcmData = base64ToArrayBuffer(audioData); const pcm16 = new Int16Array(pcmData); const wavBlob = pcmToWav(pcm16, sampleRate);
                    const audioUrl = URL.createObjectURL(wavBlob); const audio = new Audio(audioUrl); currentAudioSource = audio;
                    audio.onended = () => { row.classList.remove('bg-amber-400/10'); currentAudioSource = null; resolve(); };
                    audio.onerror = () => { row.classList.remove('bg-amber-400/10'); currentAudioSource = null; reject(new Error("Audio error")); };
                    await audio.play();
                } else resolve();
            });
        } catch (e) { console.error("Sequence interrupted:", e); row.classList.remove('bg-amber-400/10'); }
    }
    isPlayingAudioSequence = false; updatePlayAllButtonState(false);
}

function updatePlayAllButtonState(isPlaying) {
    const btn = document.getElementById('playAllAudioBtn'); const icon = document.getElementById('playAllIcon');
    if (isPlaying) { btn.className = "px-3 py-1.5 bg-red-600 text-white border border-red-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"; icon.className = "fa-solid fa-stop"; btn.querySelector('span').innerText = "Hentikan VO"; } 
    else { btn.className = "px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"; icon.className = "fa-solid fa-play"; btn.querySelector('span').innerText = "Putar VO Berurutan"; }
}
