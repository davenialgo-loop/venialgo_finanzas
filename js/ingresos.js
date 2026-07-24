let ingresos = [];
let chartIngresos = null;
let chartIngresosMensual = null;

async function cargarIngresos() {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from('incomes')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('fecha', { ascending: false });
    if (error) {
        console.error('Error loading incomes:', error);
        ingresos = [];
    } else {
        ingresos = data || [];
    }
}

function renderizarIngresos() {
    cargarSelectCategoriasIngreso();
    renderizarTablaIngresos();
    actualizarResumenIngresos();
    setTimeout(() => {
        actualizarGraficoIngresos();
        actualizarGraficoMensualIngresos();
    }, 50);
}

function renderizarTablaIngresos() {
    const tbody = document.getElementById('tablaIngresos');
    if (!tbody) return;
    const textoBusqueda = (document.getElementById('buscarIngreso')?.value || '').toLowerCase().trim();
    let filtrados = ingresos;
    if (textoBusqueda) {
        filtrados = filtrados.filter(g =>
            g.concepto.toLowerCase().includes(textoBusqueda) ||
            g.categoria.toLowerCase().includes(textoBusqueda)
        );
    }
    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="sin-gastos">No hay ingresos registrados</td></tr>';
    } else {
        tbody.innerHTML = filtrados.map(g => `
            <tr>
                <td>${formatearFecha(g.fecha)}</td>
                <td><strong>${escapeHTML(g.concepto)}</strong></td>
                <td><span class="categoria-badge">${escapeHTML(g.categoria)}</span></td>
                <td class="total-gastos" style="color:var(--success-color);text-align:right">${formatearMonto(g.monto)}</td>
                <td style="text-align:center">
                    <div class="acciones-btns">
                        <button class="btn-accion btn-editar" onclick="abrirModalEditarIngreso(${g.id})" title="Editar">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-accion btn-eliminar" onclick="eliminarIngreso(${g.id})" title="Eliminar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

function actualizarResumenIngresos() {
    const elTotal = document.getElementById('totalIngresos');
    const elMes = document.getElementById('totalIngresosMes');
    const elPromedio = document.getElementById('promedioIngresos');
    if (!elTotal) return;
    elTotal.textContent = formatearMonto(ingresos.reduce((acc, g) => acc + Number(g.monto), 0));

    const ahora = new Date();
    const ingresosMes = ingresos.filter(g => {
        const d = new Date(g.fecha + 'T00:00:00');
        return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    });
    const totalMes = ingresosMes.reduce((acc, g) => acc + Number(g.monto), 0);
    if (elMes) elMes.textContent = formatearMonto(totalMes);

    if (elPromedio) {
        const mesesUnicos = new Set(ingresos.map(g => {
            const d = new Date(g.fecha + 'T00:00:00');
            return `${d.getFullYear()}-${d.getMonth()}`;
        }));
        const promedio = mesesUnicos.size > 0 ? Math.round(ingresos.reduce((acc, g) => acc + Number(g.monto), 0) / mesesUnicos.size) : 0;
        elPromedio.textContent = formatearMonto(promedio);
    }
}

function actualizarGraficoIngresos() {
    const canvas = document.getElementById('chartIngresos');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const categoriasMap = {};
    ingresos.forEach(g => { categoriasMap[g.categoria] = (categoriasMap[g.categoria] || 0) + Number(g.monto); });
    const labels = Object.keys(categoriasMap);
    const data = Object.values(categoriasMap);
    const colores = ['#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#43A047', '#388E3C', '#FFD54F', '#64B5F6', '#CE93D8'];
    if (chartIngresos) { chartIngresos.destroy(); chartIngresos = null; }
    if (data.length === 0) return;
    const isMobile = window.innerWidth < 768;
    chartIngresos = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colores.slice(0, labels.length), borderWidth: isMobile ? 1.5 : 2, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#fff' }] },
        options: {
            responsive: true, maintainAspectRatio: true, aspectRatio: isMobile ? 1.2 : 1.5,
            plugins: {
                legend: { position: 'bottom', labels: { padding: isMobile ? 8 : 15, font: { size: isMobile ? 10 : 12, weight: '500' }, boxWidth: isMobile ? 10 : 15, boxHeight: isMobile ? 10 : 15, color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#1a1a2e' } },
                tooltip: { titleFont: { size: isMobile ? 11 : 13 }, bodyFont: { size: isMobile ? 10 : 12 }, callbacks: { label: function(context) { const total = context.dataset.data.reduce((a, b) => a + b, 0); return `${formatearMonto(context.parsed)} (${((context.parsed / total) * 100).toFixed(1)}%)`; } } }
            },
            animation: { animateRotate: true, duration: 800, easing: 'easeOutQuart' }
        }
    });
}

function actualizarGraficoMensualIngresos() {
    const canvas = document.getElementById('chartIngresosMensual');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const meses = {};
    ingresos.forEach(g => {
        const fecha = new Date(g.fecha + 'T00:00:00');
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        const mesNombre = fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
        if (!meses[mesKey]) meses[mesKey] = { nombre: mesNombre, total: 0 };
        meses[mesKey].total += Number(g.monto);
    });
    const keys = Object.keys(meses).sort();
    const labels = keys.map(k => meses[k].nombre);
    const data = keys.map(k => meses[k].total);
    const colores = ['#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#FF9800', '#2196F3'];
    if (chartIngresosMensual) { chartIngresosMensual.destroy(); chartIngresosMensual = null; }
    if (data.length === 0) return;
    const isMobile = window.innerWidth < 768;
    chartIngresosMensual = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Ingresos por Mes', data, backgroundColor: colores.slice(0, labels.length).map(c => c + '99'), borderColor: colores.slice(0, labels.length), borderWidth: isMobile ? 1.5 : 2, borderRadius: isMobile ? 4 : 6 }] },
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

async function agregarIngreso(e) {
    e.preventDefault();
    const concepto = document.getElementById('conceptoIngreso').value.trim();
    const categoria = document.getElementById('categoriaIngreso').value;
    const monto = parseFloat(document.getElementById('montoIngreso').value);
    const fecha = new Date().toISOString().split('T')[0];
    if (!concepto) { showToast('Por favor, ingresa un concepto.', 'warning'); return; }
    if (isNaN(monto) || monto < 100) { showToast('El monto mínimo es ₲ 100.', 'warning'); return; }
    const { data, error } = await supabase.from('incomes').insert({ user_id: currentUser.id, concepto, categoria, monto: Math.round(monto), fecha }).select();
    if (error) { showToast('Error al guardar el ingreso: ' + error.message, 'error'); return; }
    if (data && data[0]) ingresos.unshift(data[0]);
    renderizarIngresos();
    document.getElementById('formIngreso').reset();
    document.getElementById('conceptoIngreso').focus();
}

function abrirModalEditarIngreso(id) {
    const ingreso = ingresos.find(g => g.id === id);
    if (!ingreso) return;
    cargarSelectCategoriasIngreso();
    document.getElementById('editIngresoId').value = id;
    document.getElementById('editConceptoIngreso').value = ingreso.concepto;
    document.getElementById('editCategoriaIngreso').value = ingreso.categoria;
    document.getElementById('editMontoIngreso').value = ingreso.monto;
    document.getElementById('editFechaIngreso').value = ingreso.fecha;
    document.getElementById('modalEditarIngreso').classList.add('active');
}

function cerrarModalEditarIngreso() {
    document.getElementById('modalEditarIngreso')?.classList.remove('active');
}

async function guardarEdicionIngreso(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('editIngresoId').value);
    const concepto = document.getElementById('editConceptoIngreso').value.trim();
    const categoria = document.getElementById('editCategoriaIngreso').value;
    const monto = parseFloat(document.getElementById('editMontoIngreso').value);
    const fecha = document.getElementById('editFechaIngreso').value;
    if (!concepto) { showToast('Por favor, ingresa un concepto.', 'warning'); return; }
    if (isNaN(monto) || monto < 100) { showToast('El monto mínimo es ₲ 100.', 'warning'); return; }
    if (!fecha) { showToast('Por favor, selecciona una fecha.', 'warning'); return; }
    const { error } = await supabase.from('incomes').update({ concepto, categoria, monto: Math.round(monto), fecha }).eq('id', id);
    if (error) { showToast('Error al actualizar: ' + error.message, 'error'); return; }
    const index = ingresos.findIndex(g => g.id === id);
    if (index !== -1) ingresos[index] = { ...ingresos[index], concepto, categoria, monto: Math.round(monto), fecha };
    renderizarIngresos();
    cerrarModalEditarIngreso();
}

async function eliminarIngreso(id) {
    if (!await mostrarConfirmacion('¿Eliminar este ingreso?')) return;
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (error) { showToast('Error al eliminar: ' + error.message, 'error'); return; }
    ingresos = ingresos.filter(g => g.id !== id);
    renderizarIngresos();
}

document.getElementById('formIngreso')?.addEventListener('submit', agregarIngreso);
document.getElementById('formEditarIngreso')?.addEventListener('submit', guardarEdicionIngreso);
document.getElementById('buscarIngreso')?.addEventListener('input', renderizarTablaIngresos);
document.getElementById('modalEditarIngreso')?.addEventListener('click', function(e) {
    if (e.target === this) cerrarModalEditarIngreso();
});
