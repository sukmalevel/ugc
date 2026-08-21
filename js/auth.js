function toggleAuthMode() {
    document.getElementById('loginForm').classList.toggle('hidden');
    document.getElementById('registerForm').classList.toggle('hidden');
    document.getElementById('authError').classList.add('hidden');
    document.getElementById('regError').classList.add('hidden');
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value.trim();
    const errorEl = document.getElementById('authError');

    if (!email || !password) {
        errorEl.innerText = "Email dan password wajib diisi!";
        errorEl.classList.remove('hidden');
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        errorEl.innerText = error.message;
        errorEl.classList.remove('hidden');
        document.getElementById('authOverlay').classList.add('shake');
        setTimeout(() => document.getElementById('authOverlay').classList.remove('shake'), 300);
    } else {
        currentUser = data.user;
        document.getElementById('authOverlay').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
    }
}

async function handleRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value.trim();
    const errorEl = document.getElementById('regError');

    if (!username || !email || !password) {
        errorEl.innerText = "Semua field wajib diisi!";
        errorEl.classList.remove('hidden');
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { username: username } }
    });

    if (error) {
        errorEl.innerText = error.message;
        errorEl.classList.remove('hidden');
    } else {
        errorEl.innerText = "Registrasi berhasil! Silakan cek email untuk verifikasi (jika diaktifkan) atau langsung login.";
        errorEl.classList.remove('hidden');
        errorEl.classList.replace('text-red-400', 'text-emerald-400');
        setTimeout(toggleAuthMode, 3000);
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    location.reload();
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('authOverlay').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
    }
}

// Jalankan saat load
document.addEventListener('DOMContentLoaded', checkSession);
