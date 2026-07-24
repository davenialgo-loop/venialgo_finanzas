function escapeHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function formatearFecha(fechaStr) {
    const fecha = new Date(fechaStr + 'T00:00:00');
    return fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatearMonto(monto) {
    return '₲ ' + Math.round(monto).toLocaleString('es-PY');
}

function showLoading(container) {
    if (!container) return;
    container.setAttribute('data-had-content', '1');
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> Cargando...</div>';
}

function hideLoading(container) {
    if (!container) return;
}

function showToast(mensaje, tipo) {
    tipo = tipo || 'info';
    const container = document.getElementById('toastContainer') || crearToastContainer();
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + tipo;
    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    toast.innerHTML = '<i class="fas ' + (iconMap[tipo] || iconMap.info) + '"></i><span>' + escapeHTML(mensaje) + '</span>';
    container.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('toast-show'); });
    setTimeout(function() {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

function crearToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function mostrarConfirmacion(mensaje) {
    return new Promise(function(resolve) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active confirm-overlay';
        overlay.innerHTML = '<div class="modal confirm-modal"><h3><i class="fas fa-question-circle"></i> Confirmar</h3><p>' + escapeHTML(mensaje) + '</p><div class="modal-actions"><button class="btn-cancelar-modal" id="confirmNo">Cancelar</button><button class="btn-guardar-modal" id="confirmSi">Aceptar</button></div></div>';
        document.body.appendChild(overlay);
        overlay.querySelector('#confirmSi').addEventListener('click', function() { overlay.remove(); resolve(true); });
        overlay.querySelector('#confirmNo').addEventListener('click', function() { overlay.remove(); resolve(false); });
        overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
}

function mostrarPrompt(mensaje, valorDefault) {
    return new Promise(function(resolve) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active confirm-overlay';
        overlay.innerHTML = '<div class="modal confirm-modal"><h3><i class="fas fa-pencil"></i> Entrada</h3><p>' + escapeHTML(mensaje) + '</p><div class="field"><input type="text" id="promptInput" value="' + escapeHTML(String(valorDefault || '')) + '" style="width:100%;padding:0.5rem 0.7rem;border:2px solid var(--input-border);border-radius:10px;font-size:0.95rem;background:var(--input-bg);color:var(--text-primary);" /></div><div class="modal-actions"><button class="btn-cancelar-modal" id="promptCancel">Cancelar</button><button class="btn-guardar-modal" id="promptOk">Aceptar</button></div></div>';
        document.body.appendChild(overlay);
        const input = overlay.querySelector('#promptInput');
        input.focus();
        input.select();
        function resultado(valor) { overlay.remove(); resolve(valor); }
        overlay.querySelector('#promptOk').addEventListener('click', function() { resultado(input.value); });
        overlay.querySelector('#promptCancel').addEventListener('click', function() { resultado(null); });
        input.addEventListener('keydown', function(e) { if (e.key === 'Enter') resultado(input.value); if (e.key === 'Escape') resultado(null); });
        overlay.addEventListener('click', function(e) { if (e.target === overlay) resultado(null); });
    });
}
