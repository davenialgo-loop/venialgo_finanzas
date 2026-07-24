let currentUser = null;
let currentUsername = null;
let recoveryMode = false;

function mostrarErrorLogin(texto) {
    document.getElementById('loginErrorText').textContent = texto;
    document.getElementById('loginError').classList.add('show');
}

function ocultarErrorLogin() {
    document.getElementById('loginError').classList.remove('show');
}

function mostrarErrorRegistro(texto) {
    document.getElementById('registroErrorText').textContent = texto;
    document.getElementById('registroError').style.display = 'block';
}

function ocultarErrorRegistro() {
    document.getElementById('registroError').style.display = 'none';
}

async function loginUsuario(email, password) {
    ocultarErrorLogin();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        mostrarErrorLogin(error.message);
        return false;
    }
    return true;
}

async function registrarUsuario(username, email, password) {
    ocultarErrorRegistro();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
        mostrarErrorRegistro(error.message);
        return false;
    }
    if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            username: username
        });
        if (profileError && profileError.code !== '23505') {
            console.error('Error creating profile:', profileError);
        }
    }
    if (data.session) {
        return true;
    } else {
        mostrarErrorRegistro('Revisa tu correo para confirmar la cuenta antes de iniciar sesión.');
        return false;
    }
}

async function cerrarSesion() {
    if (typeof cerrarBottomSheet === 'function') cerrarBottomSheet();
    await supabase.auth.signOut();
    currentUser = null;
    currentUsername = null;
    document.getElementById('appContainer').classList.remove('active');
    document.getElementById('loginContainer').classList.remove('hidden');
    document.getElementById('loginForm').reset();
    ocultarErrorLogin();
}

function mostrarRegistro() {
    document.getElementById('modalRegistro').classList.add('active');
    document.getElementById('registroForm').reset();
    ocultarErrorRegistro();
}

function cerrarRegistro() {
    document.getElementById('modalRegistro').classList.remove('active');
}

function mostrarResetPassword() {
    document.getElementById('resetError').style.display = 'none';
    document.getElementById('resetSuccess').style.display = 'none';
    document.getElementById('formResetPassword').reset();
    document.getElementById('modalResetPassword').classList.add('active');
}

function cerrarResetPassword() {
    document.getElementById('modalResetPassword').classList.remove('active');
}

async function enviarLinkReset(email) {
    const { error } = await supabase.auth.recover(email);
    return error;
}

function mostrarNewPasswordSection() {
    recoveryMode = true;
    localStorage.setItem('recovery_mode', 'true');
    document.getElementById('setNewPasswordSection').style.display = 'block';
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('active');
    document.getElementById('newPassError').style.display = 'none';
}

function ocultarNewPasswordSection() {
    recoveryMode = false;
    localStorage.removeItem('recovery_mode');
    document.getElementById('setNewPasswordSection').style.display = 'none';
}

async function guardarNuevaPassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    return error;
}

async function cargarUsername(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();
    if (data && data.username) {
        currentUsername = data.username;
    } else {
        currentUsername = currentUser.email.split('@')[0];
    }
    document.getElementById('usuarioActual').textContent = currentUsername;
}

function domReady() {
    return new Promise(resolve => {
        if (document.readyState !== 'loading') {
            resolve();
        } else {
            document.addEventListener('DOMContentLoaded', resolve);
        }
    });
}

function detectarRecovery() {
    const session = processRecoveryHash();
    if (session) {
        mostrarNewPasswordSection();
        notifyListeners('PASSWORD_RECOVERY', session);
    }
}

supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
        mostrarNewPasswordSection();
        return;
    }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        if (recoveryMode) return;
        if (localStorage.getItem('recovery_mode') === 'true') {
            mostrarNewPasswordSection();
            return;
        }
        currentUser = session.user;
        await domReady();
        document.getElementById('loginContainer').classList.add('hidden');
        document.getElementById('appContainer').classList.add('active');
        await cargarUsername(session.user.id);
        cerrarRegistro();
        iniciarApp();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentUsername = null;
    }
});

detectarRecovery();

document.getElementById('formResetPassword')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value.trim();
    const btn = document.getElementById('btnResetPassword');
    const errorEl = document.getElementById('resetError');
    const successEl = document.getElementById('resetSuccess');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!email) {
        document.getElementById('resetErrorText').textContent = 'Ingresá tu correo electrónico.';
        errorEl.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    let error;
    try {
        error = await enviarLinkReset(email);
    } catch (err) {
        error = err;
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar link';

    if (error) {
        document.getElementById('resetErrorText').textContent = error.message;
        errorEl.style.display = 'block';
    } else {
        document.getElementById('formResetPassword').reset();
        successEl.style.display = 'block';
    }
});

document.getElementById('formNewPassword')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const password = document.getElementById('newPassword').value;
    const confirm = document.getElementById('newPasswordConfirm').value;
    const btn = document.getElementById('btnNewPassword');
    const errorEl = document.getElementById('newPassError');

    errorEl.style.display = 'none';

    if (!password || password.length < 6) {
        document.getElementById('newPassErrorText').textContent = 'La contraseña debe tener al menos 6 caracteres.';
        errorEl.style.display = 'block';
        return;
    }

    if (password !== confirm) {
        document.getElementById('newPassErrorText').textContent = 'Las contraseñas no coinciden.';
        errorEl.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    let error;
    try {
        error = await guardarNuevaPassword(password);
    } catch (err) {
        error = err;
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Guardar nueva contraseña';

    if (error) {
        document.getElementById('newPassErrorText').textContent = error.message;
        errorEl.style.display = 'block';
    } else {
        ocultarNewPasswordSection();
        await supabase.auth.signOut();
        document.getElementById('loginContainer').classList.remove('hidden');
        document.getElementById('appContainer').classList.remove('active');
        document.getElementById('loginForm').reset();
        ocultarErrorLogin();
        showToast('Contraseña actualizada correctamente. Ahora podés iniciar sesión con tu nueva contraseña.', 'success');
    }
});
