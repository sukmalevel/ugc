let apiKeysCache = [];
let apiKeyIndex = 0;

async function loadApiKeys() {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from('user_api_keys')
        .select('id, api_key_value, is_active')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

    if (error) console.error("Error loading API keys:", error);
    else {
        apiKeysCache = data.map(k => k.api_key_value);
        updateApiKeyStatusUI();
    }
}

function updateApiKeyStatusUI() {
    const statusEl = document.getElementById('apiKeyStatus');
    if (statusEl) statusEl.innerText = `${apiKeysCache.length} / 5 Key aktif`;
}

async function saveApiKeys() {
    if (!currentUser) return;
    const input = document.getElementById('apiKeyInput').value.trim();
    const keys = input.split('\n').map(k => k.trim()).filter(k => k.length > 10);

    if (keys.length > 5) {
        showToast("Maksimal hanya 5 API Key!", "error");
        return;
    }

    // Hapus key lama
    await supabase.from('user_api_keys').delete().eq('user_id', currentUser.id);

    // Insert key baru
    const inserts = keys.map(key => ({
        user_id: currentUser.id,
        api_key_value: key,
        is_active: true
    }));

    if (inserts.length > 0) {
        const { error } = await supabase.from('user_api_keys').insert(inserts);
        if (error) {
            showToast("Gagal menyimpan API Key: " + error.message, "error");
        } else {
            apiKeysCache = keys;
            updateApiKeyStatusUI();
            showToast("API Key berhasil disimpan!");
            closeApiKeyModal();
        }
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