let currentUser = null;
let currentUsername = null;

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

supabase.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
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
