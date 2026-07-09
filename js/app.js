let gastos = [];
let categorias = [];
let chartInstance = null;
let chartMensual = null;
let ordenColumna = 'fecha';
let ordenDireccion = 'desc';

async function iniciarApp() {
    await cargarDatosIniciales();
    cargarModoOscuro();
    renderizarTodo();
}

async function cargarDatosIniciales() {
    if (!currentUser) return;

    const { data: gastosData, error: gastosError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('fecha', { ascending: false });

    if (gastosError) {
        console.error('Error loading expenses:', gastosError);
        gastos = [];
    } else {
        gastos = gastosData || [];
    }

    const { data: catsData, error: catsError } = await supabase
        .from('categories')
        .select('name')
        .eq('user_id', currentUser.id)
        .order('name');

    if (catsError) {
        console.error('Error loading categories:', catsError);
        categorias = ['Alimentos', 'Transporte', 'Ocio', 'Salud', 'Hogar', 'Otros'];
    } else if (catsData && catsData.length > 0) {
        categorias = catsData.map(c => c.name);
    } else {
        categorias = ['Alimentos', 'Transporte', 'Ocio', 'Salud', 'Hogar', 'Otros'];
        for (const cat of categorias) {
            await supabase.from('categories').insert({
                user_id: currentUser.id,
                name: cat
            });
        }
    }
}

function renderizarTodo() {
    cargarSelectCategorias();
    renderizarTabla();
    actualizarResumen();
    setTimeout(() => {
        actualizarGrafico();
        actualizarGraficoMensual();
    }, 50);
}

function cargarSelectCategorias() {
    const selects = ['categoria', 'filtroCategoria', 'editCategoria', 'scanCategoria'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const valorActual = select.value;
        select.innerHTML = '';

        if (id === 'filtroCategoria') {
            const opt = document.createElement('option');
            opt.value = 'Todas';
            opt.textContent = 'Todas';
            select.appendChild(opt);
        }

        categorias.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.appendChild(opt);
        });

        if (valorActual && categorias.includes(valorActual)) {
            select.value = valorActual;
        } else if (id !== 'filtroCategoria' && categorias.length > 0) {
            select.value = categorias[0];
        }
    });
}

function renderizarTabla() {
    const filtroCategoria = document.getElementById('filtroCategoria').value;
    const textoBusqueda = document.getElementById('busquedaTexto').value.toLowerCase().trim();
    const tbody = document.getElementById('tablaGastos');

    let gastosFiltrados = gastos;

    if (filtroCategoria !== 'Todas') {
        gastosFiltrados = gastosFiltrados.filter(g => g.categoria === filtroCategoria);
    }

    if (textoBusqueda !== '') {
        gastosFiltrados = gastosFiltrados.filter(g =>
            g.concepto.toLowerCase().includes(textoBusqueda) ||
            g.categoria.toLowerCase().includes(textoBusqueda)
        );
    }

    gastosFiltrados.sort((a, b) => {
        let valA = a[ordenColumna];
        let valB = b[ordenColumna];

        if (ordenColumna === 'monto') {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
        } else if (ordenColumna === 'fecha') {
            valA = new Date(valA);
            valB = new Date(valB);
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return ordenDireccion === 'asc' ? -1 : 1;
        if (valA > valB) return ordenDireccion === 'asc' ? 1 : -1;
        return 0;
    });

    if (gastosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="sin-gastos">No hay gastos que coincidan con los filtros</td></tr>`;
    } else {
        tbody.innerHTML = gastosFiltrados.map(g => `
            <tr>
                <td><strong>${escapeHTML(g.concepto)}</strong></td>
                <td><span class="categoria-badge ${g.categoria.toLowerCase()}">${escapeHTML(g.categoria)}</span></td>
                <td class="total-gastos">${formatearMonto(g.monto)}</td>
                <td>${formatearFecha(g.fecha)}</td>
                <td style="text-align:center">
                    <div class="acciones-btns">
                        <button class="btn-accion btn-editar" onclick="abrirModalEditar(${g.id})" title="Editar">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-accion btn-eliminar" onclick="eliminarGasto(${g.id})" title="Eliminar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

function ordenarPor(columna) {
    const ths = document.querySelectorAll('th[data-columna]');
    ths.forEach(th => th.classList.remove('orden-asc', 'orden-desc'));

    const thActual = document.querySelector(`th[data-columna="${columna}"]`);

    if (ordenColumna === columna) {
        ordenDireccion = ordenDireccion === 'asc' ? 'desc' : 'asc';
    } else {
        ordenColumna = columna;
        ordenDireccion = 'asc';
    }

    thActual.classList.add(ordenDireccion === 'asc' ? 'orden-asc' : 'orden-desc');
    renderizarTabla();
}

function actualizarResumen() {
    document.getElementById('totalGastos').textContent = gastos.length;

    const totalMonto = gastos.reduce((acc, g) => acc + Number(g.monto), 0);
    document.getElementById('totalMonto').textContent = formatearMonto(totalMonto);

    if (gastos.length === 0) {
        document.getElementById('categoriaMayor').textContent = '-';
        return;
    }

    const categoriasMap = {};
    gastos.forEach(g => {
        categoriasMap[g.categoria] = (categoriasMap[g.categoria] || 0) + Number(g.monto);
    });

    let mayor = '';
    let maxMonto = 0;
    for (const [cat, monto] of Object.entries(categoriasMap)) {
        if (monto > maxMonto) {
            maxMonto = monto;
            mayor = cat;
        }
    }
    document.getElementById('categoriaMayor').textContent = `${mayor} (${formatearMonto(maxMonto)})`;
}

function actualizarGrafico() {
    const canvas = document.getElementById('graficoGastos');
    const ctx = canvas.getContext('2d');

    const categoriasMap = {};
    gastos.forEach(g => {
        categoriasMap[g.categoria] = (categoriasMap[g.categoria] || 0) + Number(g.monto);
    });

    const labels = Object.keys(categoriasMap);
    const data = Object.values(categoriasMap);
    const colores = ['#FFD54F', '#64B5F6', '#CE93D8', '#EF9A9A', '#A5D6A7', '#B0BEC5', '#FF8A65', '#81D4FA', '#C5E1A5'];

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    if (data.length === 0) return;

    const isMobile = window.innerWidth < 768;
    const isSmallMobile = window.innerWidth < 400;

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colores.slice(0, labels.length),
                borderWidth: isMobile ? 1.5 : 2,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: isMobile ? 1.2 : 1.5,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: isMobile ? 8 : 15,
                        font: { size: isSmallMobile ? 9 : (isMobile ? 10 : 12), weight: '500' },
                        boxWidth: isMobile ? 10 : 15,
                        boxHeight: isMobile ? 10 : 15,
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#1a1a2e'
                    }
                },
                tooltip: {
                    titleFont: { size: isMobile ? 11 : 13 },
                    bodyFont: { size: isMobile ? 10 : 12 },
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const porcentaje = ((context.parsed / total) * 100).toFixed(1);
                            return `${formatearMonto(context.parsed)} (${porcentaje}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                duration: 800,
                easing: 'easeOutQuart'
            }
        }
    });
}

function actualizarGraficoMensual() {
    const canvas = document.getElementById('graficoMensual');
    const ctx = canvas.getContext('2d');

    const meses = {};
    gastos.forEach(g => {
        const fecha = new Date(g.fecha + 'T00:00:00');
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        const mesNombre = fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });

        if (!meses[mesKey]) {
            meses[mesKey] = { nombre: mesNombre, total: 0 };
        }
        meses[mesKey].total += Number(g.monto);
    });

    const keys = Object.keys(meses).sort();
    const labels = keys.map(k => meses[k].nombre);
    const data = keys.map(k => meses[k].total);
    const colores = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336', '#00BCD4'];

    if (chartMensual) {
        chartMensual.destroy();
        chartMensual = null;
    }

    if (data.length === 0) return;

    const isMobile = window.innerWidth < 768;

    chartMensual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gastos por Mes',
                data: data,
                backgroundColor: colores.slice(0, labels.length).map(c => c + '99'),
                borderColor: colores.slice(0, labels.length),
                borderWidth: isMobile ? 1.5 : 2,
                borderRadius: isMobile ? 4 : 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: isMobile ? 1.5 : 2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    titleFont: { size: isMobile ? 11 : 13 },
                    bodyFont: { size: isMobile ? 10 : 12 },
                    callbacks: {
                        label: function(context) {
                            return formatearMonto(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return isMobile ? '₲' + (value/1000).toFixed(0) + 'k' : formatearMonto(value);
                        },
                        font: { size: isMobile ? 8 : 11 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#666',
                        maxTicksLimit: isMobile ? 5 : 8
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e0e0e0',
                        drawBorder: false
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: isMobile ? 8 : 11 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#666',
                        maxRotation: isMobile ? 45 : 0
                    }
                }
            },
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            }
        }
    });
}

async function agregarGasto(e) {
    e.preventDefault();

    const concepto = document.getElementById('concepto').value.trim();
    const categoria = document.getElementById('categoria').value;
    const monto = parseFloat(document.getElementById('monto').value);

    if (!concepto) {
        alert('Por favor, ingresa un concepto.');
        return;
    }

    if (isNaN(monto) || monto < 100) {
        alert('El monto mínimo es ₲ 100.');
        return;
    }

    const { data, error } = await supabase.from('expenses').insert({
        user_id: currentUser.id,
        concepto,
        categoria,
        monto: Math.round(monto),
        fecha: new Date().toISOString().split('T')[0]
    }).select();

    if (error) {
        alert('Error al guardar el gasto: ' + error.message);
        return;
    }

    if (data && data[0]) {
        gastos.unshift(data[0]);
    }

    renderizarTodo();
    document.getElementById('formGasto').reset();
    if (categorias.length > 0) {
        document.getElementById('categoria').value = categorias[0];
    }
    document.getElementById('concepto').focus();
}

async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return;

    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
        alert('Error al eliminar: ' + error.message);
        return;
    }

    gastos = gastos.filter(g => g.id !== id);
    renderizarTodo();
}

function abrirModalEditar(id) {
    const gasto = gastos.find(g => g.id === id);
    if (!gasto) return;

    cargarSelectCategorias();
    document.getElementById('editId').value = id;
    document.getElementById('editConcepto').value = gasto.concepto;
    document.getElementById('editCategoria').value = gasto.categoria;
    document.getElementById('editMonto').value = gasto.monto;
    document.getElementById('editFecha').value = gasto.fecha;
    document.getElementById('modalEditar').classList.add('active');
}

function cerrarModal() {
    document.getElementById('modalEditar').classList.remove('active');
}

async function guardarEdicion(e) {
    e.preventDefault();

    const id = parseInt(document.getElementById('editId').value);
    const concepto = document.getElementById('editConcepto').value.trim();
    const categoria = document.getElementById('editCategoria').value;
    const monto = parseFloat(document.getElementById('editMonto').value);
    const fecha = document.getElementById('editFecha').value;

    if (!concepto) {
        alert('Por favor, ingresa un concepto.');
        return;
    }

    if (isNaN(monto) || monto < 100) {
        alert('El monto mínimo es ₲ 100.');
        return;
    }

    if (!fecha) {
        alert('Por favor, selecciona una fecha.');
        return;
    }

    const { error } = await supabase.from('expenses').update({
        concepto,
        categoria,
        monto: Math.round(monto),
        fecha
    }).eq('id', id);

    if (error) {
        alert('Error al actualizar: ' + error.message);
        return;
    }

    const index = gastos.findIndex(g => g.id === id);
    if (index !== -1) {
        gastos[index] = { ...gastos[index], concepto, categoria, monto: Math.round(monto), fecha };
    }

    renderizarTodo();
    cerrarModal();
}

function abrirModalCategorias() {
    document.getElementById('modalCategorias').classList.add('active');
    renderizarListaCategorias();
}

function cerrarModalCategorias() {
    document.getElementById('modalCategorias').classList.remove('active');
}

function renderizarListaCategorias() {
    const container = document.getElementById('listaCategorias');
    const categoriasUsadas = new Set(gastos.map(g => g.categoria));
    const coloresCat = ['#FFD54F','#64B5F6','#CE93D8','#EF9A9A','#A5D6A7','#B0BEC5','#FF8A65','#81D4FA','#C5E1A5'];

    container.innerHTML = categorias.map((cat, index) => `
        <div class="item-categoria">
            <span class="nombre">
                <span class="categoria-preview" style="background:${coloresCat[index % coloresCat.length]}30;color:${coloresCat[index % coloresCat.length]}">
                    ${escapeHTML(cat)}
                </span>
                ${categoriasUsadas.has(cat) ? ' <i class="fas fa-check-circle" style="color:var(--success-color);font-size:0.65rem;" title="Categoría en uso"></i>' : ''}
            </span>
            <div class="acciones">
                <button class="btn-edit-cat" onclick="editarCategoria(${index})" title="Editar nombre">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="btn-del-cat" onclick="eliminarCategoria(${index})" title="Eliminar categoría"
                    ${categoriasUsadas.has(cat) ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function agregarCategoria() {
    const input = document.getElementById('nuevaCategoria');
    const nombre = input.value.trim();

    if (!nombre) {
        alert('Por favor ingresa un nombre para la categoría.');
        return;
    }

    if (categorias.includes(nombre)) {
        alert('Esta categoría ya existe.');
        return;
    }

    const { error } = await supabase.from('categories').insert({
        user_id: currentUser.id,
        name: nombre
    });

    if (error) {
        alert('Error al guardar la categoría: ' + error.message);
        return;
    }

    categorias.push(nombre);
    input.value = '';
    renderizarTodo();
    renderizarListaCategorias();
}

async function editarCategoria(index) {
    const nombreActual = categorias[index];
    if (!nombreActual) return;
    const nuevoNombre = prompt('Editar nombre de categoría:', nombreActual);

    if (nuevoNombre === null) return;
    const nombreTrim = nuevoNombre.trim();

    if (!nombreTrim) {
        alert('El nombre no puede estar vacío.');
        return;
    }

    if (categorias.includes(nombreTrim) && nombreTrim !== nombreActual) {
        alert('Ya existe una categoría con ese nombre.');
        return;
    }

    const { error: catError } = await supabase
        .from('categories')
        .update({ name: nombreTrim })
        .eq('user_id', currentUser.id)
        .eq('name', nombreActual);

    if (catError) {
        alert('Error al actualizar: ' + catError.message);
        return;
    }

    const { error: expError } = await supabase
        .from('expenses')
        .update({ categoria: nombreTrim })
        .eq('user_id', currentUser.id)
        .eq('categoria', nombreActual);

    if (expError) {
        console.error('Error updating expenses category:', expError);
    }

    categorias[index] = nombreTrim;

    gastos.forEach(g => {
        if (g.categoria === nombreActual) g.categoria = nombreTrim;
    });

    renderizarTodo();
    renderizarListaCategorias();
}

async function eliminarCategoria(index) {
    const nombre = categorias[index];
    if (!nombre) return;
    const enUso = gastos.some(g => g.categoria === nombre);
    if (enUso) {
        alert('No se puede eliminar una categoría que está en uso en gastos.');
        return;
    }

    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;

    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('name', nombre);

    if (error) {
        alert('Error al eliminar: ' + error.message);
        return;
    }

    categorias.splice(index, 1);

    renderizarTodo();
    renderizarListaCategorias();
}

function exportarExcel() {
    if (gastos.length === 0) {
        alert('No hay gastos para exportar.');
        return;
    }

    const datosExcel = gastos.map(g => ({
        'Concepto': g.concepto,
        'Categoría': g.categoria,
        'Monto (₲)': g.monto,
        'Fecha': g.fecha
    }));

    datosExcel.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));

    const total = datosExcel.reduce((acc, g) => acc + g['Monto (₲)'], 0);
    datosExcel.push({
        'Concepto': 'TOTAL',
        'Categoría': '',
        'Monto (₲)': total,
        'Fecha': ''
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datosExcel);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, `Gastos_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function toggleModoOscuro() {
    const html = document.documentElement;
    const toggle = document.getElementById('toggleDark');
    const icono = document.getElementById('iconoToggle');

    if (html.getAttribute('data-theme') === 'dark') {
        html.setAttribute('data-theme', 'light');
        toggle.classList.remove('dark');
        icono.className = 'fas fa-sun';
        localStorage.setItem('tema', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        toggle.classList.add('dark');
        icono.className = 'fas fa-moon';
        localStorage.setItem('tema', 'dark');
    }

    setTimeout(() => {
        actualizarGrafico();
        actualizarGraficoMensual();
    }, 150);
}

function cargarModoOscuro() {
    const tema = localStorage.getItem('tema') || 'light';
    const html = document.documentElement;
    const toggle = document.getElementById('toggleDark');
    const icono = document.getElementById('iconoToggle');

    if (tema === 'dark') {
        html.setAttribute('data-theme', 'dark');
        toggle.classList.add('dark');
        icono.className = 'fas fa-moon';
    } else {
        html.setAttribute('data-theme', 'light');
        toggle.classList.remove('dark');
        icono.className = 'fas fa-sun';
    }
}

let resizeTimeout = null;

function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        actualizarGrafico();
        actualizarGraficoMensual();
    }, 250);
}

document.addEventListener('DOMContentLoaded', function() {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
            document.getElementById('loginContainer').classList.remove('hidden');
            document.getElementById('appContainer').classList.remove('active');
        }
    });
});

document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) {
        mostrarErrorLogin('Por favor, completa todos los campos');
        return;
    }
    await loginUsuario(email, password);
});

document.getElementById('registroForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('regUsuario').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;
    const btn = this.querySelector('.btn-guardar-modal');

    if (!username || !email || !password || !confirm) {
        mostrarErrorRegistro('Por favor, completa todos los campos');
        return;
    }

    if (password !== confirm) {
        mostrarErrorRegistro('Las contraseñas no coinciden');
        return;
    }

    if (password.length < 6) {
        mostrarErrorRegistro('La contraseña debe tener al menos 6 caracteres');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

    try {
        await registrarUsuario(username, email, password);
    } catch (err) {
        mostrarErrorRegistro(err.message || 'Error de conexión. Intenta de nuevo.');
        console.error('Registration error:', err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Registrarse';
    }
});

document.getElementById('formGasto')?.addEventListener('submit', agregarGasto);
document.getElementById('filtroCategoria')?.addEventListener('change', renderizarTabla);
document.getElementById('busquedaTexto')?.addEventListener('input', renderizarTabla);
document.getElementById('formEditar')?.addEventListener('submit', guardarEdicion);

document.querySelectorAll('th[data-columna]').forEach(th => {
    th.addEventListener('click', function() {
        ordenarPor(this.dataset.columna);
    });
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        cerrarModal();
        cerrarModalCategorias();
        cerrarRegistro();
        if (typeof cerrarScanner === 'function') cerrarScanner();
    }
});

document.getElementById('modalEditar')?.addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
});
document.getElementById('modalCategorias')?.addEventListener('click', function(e) {
    if (e.target === this) cerrarModalCategorias();
});
document.getElementById('modalRegistro')?.addEventListener('click', function(e) {
    if (e.target === this) cerrarRegistro();
});

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', function() {
    setTimeout(handleResize, 300);
});
