let inversiones = [];
let chartInvTipo = null;
let chartInvMensual = null;

async function cargarInversiones() {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('fecha_inicio', { ascending: false });
    if (error) {
        console.error('Error loading investments:', error);
        inversiones = [];
    } else {
        inversiones = data || [];
    }
}

function renderizarInversiones() {
    renderizarListaInversiones();
    actualizarResumenInversiones();
    setTimeout(function() {
        actualizarGraficoInvTipo();
        actualizarGraficoInvMensual();
    }, 50);
}

function renderizarListaInversiones() {
    var container = document.getElementById('listaInversiones');
    if (!container) return;
    var filtro = document.getElementById('filtroInversiones')?.value || 'todas';
    var textoBusqueda = (document.getElementById('buscarInversion')?.value || '').toLowerCase().trim();
    var filtradas = inversiones;
    if (filtro !== 'todas') filtradas = filtradas.filter(function(i) { return i.estado === filtro; });
    if (textoBusqueda) {
        filtradas = filtradas.filter(function(i) {
            return i.nombre.toLowerCase().includes(textoBusqueda) ||
                   i.tipo_inversion.toLowerCase().includes(textoBusqueda) ||
                   (i.notas && i.notas.toLowerCase().includes(textoBusqueda));
        });
    }
    if (filtradas.length === 0) {
        container.innerHTML = '<div class="sin-gastos">No hay inversiones registradas</div>';
        return;
    }
    container.innerHTML = filtradas.map(function(i) {
        var pct = i.monto_invertido > 0 ? ((i.rendimiento_real / i.monto_invertido) * 100).toFixed(1) : '0.0';
        var badgeClass = i.estado === 'activa' ? 'badge-activa' : i.estado === 'cobrada' ? 'badge-cobrada' : 'badge-cancelada';
        return '<div class="deuda-card inversion-card">' +
            '<div class="deuda-header">' +
                '<strong>' + escapeHTML(i.nombre) + '</strong>' +
                '<span class="deuda-badge ' + badgeClass + '">' + i.estado + '</span>' +
            '</div>' +
            '<div class="deuda-detalle">' +
                '<span>Tipo: ' + escapeHTML(i.tipo_inversion) + '</span>' +
                '<span>Inicio: ' + formatearFecha(i.fecha_inicio) + '</span>' +
                (i.fecha_vencimiento ? '<span>Vence: ' + formatearFecha(i.fecha_vencimiento) + '</span>' : '') +
            '</div>' +
            '<div class="deuda-progress-wrapper">' +
                '<div class="deuda-progress-bg">' +
                    '<div class="deuda-progress-bar" style="width:' + Math.min(pct, 100) + '%;background:var(--success-color)"></div>' +
                '</div>' +
                '<span class="deuda-progress-text">' + pct + '% rendimiento</span>' +
            '</div>' +
            '<div class="deuda-montos">' +
                '<span class="total-label">Invertido: <strong>' + formatearMonto(i.monto_invertido) + '</strong></span>' +
                '<span class="total-label">Rend. Est.: <strong>' + formatearMonto(i.rendimiento_estimado) + '</strong></span>' +
                '<span class="total-label" style="color:var(--success-color)">Rend. Real: <strong>' + formatearMonto(i.rendimiento_real) + '</strong></span>' +
            '</div>' +
            (i.notas ? '<div class="deuda-notas">' + escapeHTML(i.notas) + '</div>' : '') +
            '<div class="deuda-actions">' +
                (i.estado === 'activa' ? '<button class="btn-accion btn-pagar" onclick="cobrarInversion(' + i.id + ')" title="Cobrar"><i class="fas fa-check"></i></button>' : '') +
                (i.estado === 'activa' ? '<button class="btn-accion btn-cancelar" onclick="cancelarInversion(' + i.id + ')" title="Cancelar"><i class="fas fa-ban"></i></button>' : '') +
                '<button class="btn-accion btn-editar" onclick="abrirModalEditarInversion(' + i.id + ')" title="Editar"><i class="fas fa-pen"></i></button>' +
                '<button class="btn-accion btn-eliminar" onclick="eliminarInversion(' + i.id + ')" title="Eliminar"><i class="fas fa-trash-alt"></i></button>' +
            '</div>' +
        '</div>';
    }).join('');
}

function actualizarResumenInversiones() {
    var elTotal = document.getElementById('totalInvertido');
    var elRendEst = document.getElementById('rendEstimado');
    var elRendReal = document.getElementById('rendReal');
    var elActivas = document.getElementById('inversionesActivas');
    if (!elTotal) return;
    var totalInvertido = inversiones.reduce(function(a, i) { return a + Number(i.monto_invertido); }, 0);
    var totalRendEst = inversiones.reduce(function(a, i) { return a + Number(i.rendimiento_estimado); }, 0);
    var totalRendReal = inversiones.reduce(function(a, i) { return a + Number(i.rendimiento_real); }, 0);
    var activas = inversiones.filter(function(i) { return i.estado === 'activa'; }).length;
    elTotal.textContent = formatearMonto(totalInvertido);
    elRendEst.textContent = formatearMonto(totalRendEst);
    elRendReal.textContent = formatearMonto(totalRendReal);
    elActivas.textContent = activas;
}

function actualizarGraficoInvTipo() {
    var canvas = document.getElementById('chartInversionesTipo');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var tiposMap = {};
    inversiones.forEach(function(i) {
        tiposMap[i.tipo_inversion] = (tiposMap[i.tipo_inversion] || 0) + Number(i.monto_invertido);
    });
    var labels = Object.keys(tiposMap);
    var data = Object.values(tiposMap);
    var colores = ['#FF9800', '#4CAF50', '#2196F3', '#9C27B0', '#F44336', '#00BCD4', '#FFD54F', '#CE93D8'];
    if (chartInvTipo) { chartInvTipo.destroy(); chartInvTipo = null; }
    if (data.length === 0) return;
    var isMobile = window.innerWidth < 768;
    chartInvTipo = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colores.slice(0, labels.length), borderWidth: isMobile ? 1.5 : 2, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#fff' }] },
        options: {
            responsive: true, maintainAspectRatio: true, aspectRatio: isMobile ? 1.2 : 1.5,
            plugins: {
                legend: { position: 'bottom', labels: { padding: isMobile ? 8 : 15, font: { size: isMobile ? 10 : 12, weight: '500' }, boxWidth: isMobile ? 10 : 15, boxHeight: isMobile ? 10 : 15, color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#1a1a2e' } },
                tooltip: { titleFont: { size: isMobile ? 11 : 13 }, bodyFont: { size: isMobile ? 10 : 12 }, callbacks: { label: function(context) { var total = context.dataset.data.reduce(function(a, b) { return a + b; }, 0); return formatearMonto(context.parsed) + ' (' + ((context.parsed / total) * 100).toFixed(1) + '%)'; } } }
            },
            animation: { animateRotate: true, duration: 800, easing: 'easeOutQuart' }
        }
    });
}

function actualizarGraficoInvMensual() {
    var canvas = document.getElementById('chartInversionesMensual');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var meses = {};
    inversiones.forEach(function(i) {
        var fecha = new Date(i.fecha_inicio + 'T00:00:00');
        var mesKey = fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');
        var mesNombre = fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
        if (!meses[mesKey]) meses[mesKey] = { nombre: mesNombre, total: 0 };
        meses[mesKey].total += Number(i.monto_invertido);
    });
    var keys = Object.keys(meses).sort();
    var labels = keys.map(function(k) { return meses[k].nombre; });
    var data = keys.map(function(k) { return meses[k].total; });
    var colores = ['#FF9800', '#4CAF50', '#2196F3', '#9C27B0', '#F44336', '#00BCD4'];
    if (chartInvMensual) { chartInvMensual.destroy(); chartInvMensual = null; }
    if (data.length === 0) return;
    var isMobile = window.innerWidth < 768;
    chartInvMensual = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Inversiones por Mes', data: data, backgroundColor: colores.slice(0, labels.length).map(function(c) { return c + '99'; }), borderColor: colores.slice(0, labels.length), borderWidth: isMobile ? 1.5 : 2, borderRadius: isMobile ? 4 : 6 }] },
        options: {
            responsive: true, maintainAspectRatio: true, aspectRatio: isMobile ? 1.5 : 2,
            plugins: { legend: { display: false }, tooltip: { titleFont: { size: isMobile ? 11 : 13 }, bodyFont: { size: isMobile ? 10 : 12 }, callbacks: { label: function(context) { return formatearMonto(context.parsed.y); } } } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: function(value) { return isMobile ? '₲' + (value / 1000).toFixed(0) + 'k' : formatearMonto(value); }, font: { size: isMobile ? 8 : 11 }, color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#666', maxTicksLimit: isMobile ? 5 : 8 }, grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e0e0e0', drawBorder: false } },
                x: { grid: { display: false }, ticks: { font: { size: isMobile ? 8 : 11 }, color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#666', maxRotation: isMobile ? 45 : 0 } }
            },
            animation: { duration: 800, easing: 'easeOutQuart' }
        }
    });
}

async function agregarInversion(e) {
    e.preventDefault();
    var nombre = document.getElementById('invNombre').value.trim();
    var tipo_inversion = document.getElementById('invTipo').value.trim();
    var monto_invertido = parseFloat(document.getElementById('invMonto').value);
    var rendimiento_estimado = parseFloat(document.getElementById('invRendEst')?.value) || 0;
    var fecha_inicio = document.getElementById('invFechaInicio')?.value || new Date().toISOString().split('T')[0];
    var fecha_vencimiento = document.getElementById('invFechaVenc')?.value || null;
    var notas = document.getElementById('invNotas')?.value.trim() || '';
    if (!nombre) { showToast('Por favor, ingresa un nombre.', 'warning'); return; }
    if (!tipo_inversion) { showToast('Por favor, ingresa el tipo de inversión.', 'warning'); return; }
    if (isNaN(monto_invertido) || monto_invertido < 1000) { showToast('El monto mínimo es ₲ 1.000.', 'warning'); return; }
    var result = await supabase.from('investments').insert({
        user_id: currentUser.id, nombre: nombre, tipo_inversion: tipo_inversion, monto_invertido: Math.round(monto_invertido),
        rendimiento_estimado: Math.round(rendimiento_estimado), fecha_inicio: fecha_inicio, fecha_vencimiento: fecha_vencimiento, notas: notas
    }).select();
    if (result.error) { showToast('Error al guardar la inversión: ' + result.error.message, 'error'); return; }
    if (result.data && result.data[0]) inversiones.unshift(result.data[0]);
    renderizarInversiones();
    document.getElementById('formInversion').reset();
    document.getElementById('invNombre').focus();
    showToast('Inversión agregada correctamente', 'success');
}

async function cobrarInversion(id) {
    if (!await mostrarConfirmacion('¿Marcar esta inversión como cobrada?')) return;
    var inv = inversiones.find(function(i) { return i.id === id; });
    if (!inv) return;
    var rendReal = await mostrarPrompt('Ingresá el rendimiento real obtenido (₲):', inv.rendimiento_estimado || '0');
    if (rendReal === null) return;
    var monto = parseFloat(rendReal);
    if (isNaN(monto) || monto < 0) { showToast('Ingresá un monto válido.', 'warning'); return; }
    var hoy = new Date().toISOString().split('T')[0];
    var result = await supabase.from('investments').update({
        estado: 'cobrada', rendimiento_real: Math.round(monto), fecha_cobro: hoy
    }).eq('id', id);
    if (result.error) { showToast('Error al cobrar: ' + result.error.message, 'error'); return; }
    var index = inversiones.findIndex(function(i) { return i.id === id; });
    if (index !== -1) inversiones[index] = Object.assign({}, inversiones[index], { estado: 'cobrada', rendimiento_real: Math.round(monto), fecha_cobro: hoy });
    renderizarInversiones();
    showToast('Inversión cobrada correctamente', 'success');
}

function abrirModalEditarInversion(id) {
    var inv = inversiones.find(function(i) { return i.id === id; });
    if (!inv) return;
    document.getElementById('editInvId').value = id;
    document.getElementById('editInvNombre').value = inv.nombre;
    document.getElementById('editInvTipo').value = inv.tipo_inversion;
    document.getElementById('editInvMonto').value = inv.monto_invertido;
    document.getElementById('editInvRendEst').value = inv.rendimiento_estimado;
    document.getElementById('editInvRendReal').value = inv.rendimiento_real;
    document.getElementById('editInvFechaInicio').value = inv.fecha_inicio;
    document.getElementById('editInvFechaVenc').value = inv.fecha_vencimiento || '';
    document.getElementById('editInvEstado').value = inv.estado;
    document.getElementById('editInvNotas').value = inv.notas;
    document.getElementById('modalEditarInversion').classList.add('active');
}

function cerrarModalEditarInversion() {
    document.getElementById('modalEditarInversion')?.classList.remove('active');
}

async function guardarEdicionInversion(e) {
    e.preventDefault();
    var id = parseInt(document.getElementById('editInvId').value);
    var nombre = document.getElementById('editInvNombre').value.trim();
    var tipo_inversion = document.getElementById('editInvTipo').value.trim();
    var monto_invertido = parseFloat(document.getElementById('editInvMonto').value);
    var rendimiento_estimado = parseFloat(document.getElementById('editInvRendEst')?.value) || 0;
    var rendimiento_real = parseFloat(document.getElementById('editInvRendReal')?.value) || 0;
    var fecha_inicio = document.getElementById('editInvFechaInicio').value;
    var fecha_vencimiento = document.getElementById('editInvFechaVenc')?.value || null;
    var estado = document.getElementById('editInvEstado').value;
    var notas = document.getElementById('editInvNotas')?.value.trim() || '';
    if (!nombre) { showToast('Por favor, ingresa un nombre.', 'warning'); return; }
    if (!tipo_inversion) { showToast('Por favor, ingresa el tipo de inversión.', 'warning'); return; }
    if (isNaN(monto_invertido) || monto_invertido < 1000) { showToast('El monto mínimo es ₲ 1.000.', 'warning'); return; }
    var result = await supabase.from('investments').update({
        nombre: nombre, tipo_inversion: tipo_inversion, monto_invertido: Math.round(monto_invertido),
        rendimiento_estimado: Math.round(rendimiento_estimado),
        rendimiento_real: Math.round(rendimiento_real),
        fecha_inicio: fecha_inicio, fecha_vencimiento: fecha_vencimiento, estado: estado, notas: notas
    }).eq('id', id);
    if (result.error) { showToast('Error al actualizar: ' + result.error.message, 'error'); return; }
    var index = inversiones.findIndex(function(i) { return i.id === id; });
    if (index !== -1) inversiones[index] = Object.assign({}, inversiones[index], { nombre: nombre, tipo_inversion: tipo_inversion, monto_invertido: Math.round(monto_invertido), rendimiento_estimado: Math.round(rendimiento_estimado), rendimiento_real: Math.round(rendimiento_real), fecha_inicio: fecha_inicio, fecha_vencimiento: fecha_vencimiento, estado: estado, notas: notas });
    renderizarInversiones();
    cerrarModalEditarInversion();
    showToast('Inversión actualizada correctamente', 'success');
}

async function cancelarInversion(id) {
    if (!await mostrarConfirmacion('¿Cancelar esta inversión?')) return;
    var result = await supabase.from('investments').update({ estado: 'cancelada' }).eq('id', id);
    if (result.error) { showToast('Error al cancelar: ' + result.error.message, 'error'); return; }
    var index = inversiones.findIndex(function(i) { return i.id === id; });
    if (index !== -1) inversiones[index] = Object.assign({}, inversiones[index], { estado: 'cancelada' });
    renderizarInversiones();
    showToast('Inversión cancelada', 'info');
}

async function eliminarInversion(id) {
    if (!await mostrarConfirmacion('¿Eliminar esta inversión permanentemente?')) return;
    var result = await supabase.from('investments').delete().eq('id', id);
    if (result.error) { showToast('Error al eliminar: ' + result.error.message, 'error'); return; }
    inversiones = inversiones.filter(function(i) { return i.id !== id; });
    renderizarInversiones();
    showToast('Inversión eliminada', 'success');
}

document.getElementById('formInversion')?.addEventListener('submit', agregarInversion);
document.getElementById('formEditarInversion')?.addEventListener('submit', guardarEdicionInversion);
document.getElementById('filtroInversiones')?.addEventListener('change', renderizarListaInversiones);
document.getElementById('buscarInversion')?.addEventListener('input', renderizarListaInversiones);
document.getElementById('modalEditarInversion')?.addEventListener('click', function(e) {
    if (e.target === this) cerrarModalEditarInversion();
});
