// js/db.js
let apiKeysCache = [];
let apiKeyIndex = 0;

async function loadApiKeys() {
    if (!currentUser) {
        console.log("Belum login, skip load API keys");
        return;
    }
    
    const { data, error } = await supabaseClient
        .from('user_api_keys')
        .select('id, api_key_value, is_active')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Supabase Error loading API keys:", error);
        showToast("Gagal memuat API Key dari database.", "error");
    } else {
        apiKeysCache = data.map(k => k.api_key_value);
        updateApiKeyStatusUI();
    }
}

function updateApiKeyStatusUI() {
    const statusEl = document.getElementById('apiKeyStatus');
    if (statusEl) {
        statusEl.innerText = `${apiKeysCache.length} / 5 Key aktif`;
    }
}

async function saveApiKeys() {
    if (!currentUser) {
        showToast("Anda harus login terlebih dahulu!", "error");
        return;
    }
    
    const input = document.getElementById('apiKeyInput').value.trim();
    const keys = input.split('\n').map(k => k.trim()).filter(k => k.length > 10);

    if (keys.length > 5) {
        showToast("Maksimal hanya 5 API Key!", "error");
        return;
    }

    // 1. Hapus key lama user ini
    const { error: deleteError } = await supabaseClient
        .from('user_api_keys')
        .delete()
        .eq('user_id', currentUser.id);

    if (deleteError) {
        console.error("Gagal menghapus key lama:", deleteError);
        showToast("Gagal reset API Key lama.", "error");
        return;
    }

    // 2. Jika ada key baru, masukkan
    if (keys.length > 0) {
        const inserts = keys.map(key => ({
            user_id: currentUser.id,
            api_key_value: key,
            is_active: true
        }));

        const { error: insertError } = await supabaseClient
            .from('user_api_keys')
            .insert(inserts);
        
        if (insertError) {
            console.error("Supabase Insert Error:", insertError);
            showToast("Gagal menyimpan: " + insertError.message, "error");
        } else {
            apiKeysCache = keys;
            updateApiKeyStatusUI();
            showToast("API Key berhasil disimpan ke database!", "success");
            closeApiKeyModal();
        }
    } else {
        // User menghapus semua key
        apiKeysCache = [];
        updateApiKeyStatusUI();
        showToast("Semua API Key dihapus.", "info");
        closeApiKeyModal();
    }
}

function getNextApiKey() {
    if (apiKeysCache.length === 0) return null;
    const key = apiKeysCache[apiKeyIndex % apiKeysCache.length];
    apiKeyIndex++;
    return key;
}

function openApiKeyModal() {
    document.getElementById('apiKeyModal').classList.remove('hidden');
    document.getElementById('apiKeyInput').value = apiKeysCache.join('\n');
    updateApiKeyStatusUI();
}

function closeApiKeyModal() {
    document.getElementById('apiKeyModal').classList.add('hidden');
}
