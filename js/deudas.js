let deudas = [];

async function cargarDeudas() {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Error loading debts:', error);
        deudas = [];
    } else {
        deudas = data || [];
    }
}

function renderizarDeudas() {
    actualizarResumenDeudas();
    renderizarListaDeudas();
}

function actualizarResumenDeudas() {
    const elAPagar = document.getElementById('totalAPagar');
    const elACobrar = document.getElementById('totalACobrar');
    const elNeto = document.getElementById('totalDeudaNeta');
    if (!elAPagar) return;

    let aPagar = 0, aCobrar = 0;
    deudas.filter(d => d.estado === 'activa').forEach(d => {
        const saldo = Number(d.monto_total) - Number(d.monto_pagado);
        if (d.tipo === 'a_pagar') aPagar += saldo;
        else aCobrar += saldo;
    });

    elAPagar.textContent = formatearMonto(aPagar);
    elACobrar.textContent = formatearMonto(aCobrar);
    if (elNeto) elNeto.textContent = formatearMonto(aCobrar - aPagar);
}

function renderizarListaDeudas() {
    const container = document.getElementById('listaDeudas');
    if (!container) return;

    const filtro = document.getElementById('filtroDeudas')?.value || 'todas';
    let filtradas = deudas;
    if (filtro === 'activas') filtradas = deudas.filter(d => d.estado === 'activa');
    else if (filtro === 'pagadas') filtradas = deudas.filter(d => d.estado === 'pagada');

    if (filtradas.length === 0) {
        container.innerHTML = '<div class="sin-gastos">No hay deudas registradas</div>';
        return;
    }

    container.innerHTML = filtradas.map(d => {
        const saldo = Number(d.monto_total) - Number(d.monto_pagado);
        const pct = Number(d.monto_total) > 0 ? Math.round((Number(d.monto_pagado) / Number(d.monto_total)) * 100) : 0;
        const esPagada = d.estado === 'pagada' || d.estado === 'cancelada';
        const vencimiento = d.fecha_vencimiento ? formatearFecha(d.fecha_vencimiento) : '—';

        return `
            <div class="deuda-card ${d.tipo} ${esPagada ? 'deuda-pagada' : ''}">
                <div class="deuda-header">
                    <div class="deuda-info">
                        <strong class="deuda-nombre">${escapeHTML(d.nombre)}</strong>
                        <span class="deuda-badge ${d.tipo}">${d.tipo === 'a_pagar' ? 'A Pagar' : 'A Cobrar'}</span>
                        ${d.estado === 'pagada' ? '<span class="deuda-badge pagada">Pagada</span>' : ''}
                        ${d.estado === 'cancelada' ? '<span class="deuda-badge cancelada">Cancelada</span>' : ''}
                    </div>
                    <div class="deuda-monto-info">
                        <span class="deuda-total">${formatearMonto(Number(d.monto_total))}</span>
                        <span class="deuda-saldo">Saldo: ${formatearMonto(saldo)}</span>
                    </div>
                </div>

                <div class="deuda-progress-wrapper">
                    <div class="deuda-progress-bg">
                        <div class="deuda-progress-bar ${d.tipo}" style="width:${pct}%"></div>
                    </div>
                    <span class="deuda-progress-text">${pct}% pagado</span>
                </div>

                <div class="deuda-footer">
                    <span class="deuda-vencimiento">Vence: ${vencimiento}</span>
                    ${d.notas ? `<span class="deuda-notas">${escapeHTML(d.notas)}</span>` : ''}
                    <div class="deuda-acciones">
                        ${!esPagada ? `<button class="btn-accion btn-pagar" onclick="abrirPagoDeuda(${d.id})" title="Registrar pago"><i class="fas fa-coins"></i></button>` : ''}
                        <button class="btn-accion btn-editar" onclick="abrirModalEditarDeuda(${d.id})" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="btn-accion btn-eliminar" onclick="eliminarDeuda(${d.id})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function abrirModalDeuda() {
    document.getElementById('formDeuda').reset();
    document.getElementById('deudaId').value = '';
    document.getElementById('modalDeuda').classList.add('active');
}

function cerrarModalDeuda() {
    document.getElementById('modalDeuda')?.classList.remove('active');
}

function guardarDeuda(e) {
    e.preventDefault();
    const id = document.getElementById('deudaId').value;
    if (id) {
        guardarEdicionDeuda(e, parseInt(id));
    } else {
        crearDeuda(e);
    }
}

async function crearDeuda(e) {
    const nombre = document.getElementById('deudaNombre').value.trim();
    const tipo = document.getElementById('deudaTipo').value;
    const montoTotal = parseFloat(document.getElementById('deudaMontoTotal').value);
    const montoPagado = parseFloat(document.getElementById('deudaMontoPagado').value) || 0;
    const fechaVenc = document.getElementById('deudaFechaVenc').value || null;
    const notas = document.getElementById('deudaNotas').value.trim();

    if (!nombre) { alert('Por favor, ingresa un nombre.'); return; }
    if (isNaN(montoTotal) || montoTotal <= 0) { alert('El monto total debe ser mayor a 0.'); return; }

    const { data, error } = await supabase.from('debts').insert({
        user_id: currentUser.id, nombre, tipo, monto_total: Math.round(montoTotal),
        monto_pagado: Math.round(montoPagado), fecha_vencimiento: fechaVenc, notas
    }).select();

    if (error) { alert('Error al guardar: ' + error.message); return; }
    if (data && data[0]) deudas.unshift(data[0]);
    renderizarDeudas();
    cerrarModalDeuda();
}

function abrirModalEditarDeuda(id) {
    const d = deudas.find(de => de.id === id);
    if (!d) return;
    document.getElementById('deudaId').value = id;
    document.getElementById('deudaNombre').value = d.nombre;
    document.getElementById('deudaTipo').value = d.tipo;
    document.getElementById('deudaMontoTotal').value = d.monto_total;
    document.getElementById('deudaMontoPagado').value = d.monto_pagado;
    document.getElementById('deudaFechaVenc').value = d.fecha_vencimiento || '';
    document.getElementById('deudaNotas').value = d.notas || '';
    document.getElementById('modalDeuda').classList.add('active');
}

async function guardarEdicionDeuda(e, id) {
    const nombre = document.getElementById('deudaNombre').value.trim();
    const tipo = document.getElementById('deudaTipo').value;
    const montoTotal = parseFloat(document.getElementById('deudaMontoTotal').value);
    const montoPagado = parseFloat(document.getElementById('deudaMontoPagado').value) || 0;
    const fechaVenc = document.getElementById('deudaFechaVenc').value || null;
    const notas = document.getElementById('deudaNotas').value.trim();

    if (!nombre) { alert('Por favor, ingresa un nombre.'); return; }
    if (isNaN(montoTotal) || montoTotal <= 0) { alert('El monto total debe ser mayor a 0.'); return; }

    const estado = montoPagado >= montoTotal ? 'pagada' : 'activa';
    const { error } = await supabase.from('debts').update({
        nombre, tipo, monto_total: Math.round(montoTotal),
        monto_pagado: Math.round(montoPagado), fecha_vencimiento: fechaVenc, notas, estado
    }).eq('id', id);

    if (error) { alert('Error al actualizar: ' + error.message); return; }
    const index = deudas.findIndex(d => d.id === id);
    if (index !== -1) deudas[index] = { ...deudas[index], nombre, tipo, monto_total: Math.round(montoTotal), monto_pagado: Math.round(montoPagado), fecha_vencimiento: fechaVenc, notas, estado };
    renderizarDeudas();
    cerrarModalDeuda();
}

async function eliminarDeuda(id) {
    if (!confirm('¿Eliminar esta deuda?')) return;
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (error) { alert('Error al eliminar: ' + error.message); return; }
    deudas = deudas.filter(d => d.id !== id);
    renderizarDeudas();
}

function abrirPagoDeuda(id) {
    const d = deudas.find(de => de.id === id);
    if (!d) return;
    const saldo = Number(d.monto_total) - Number(d.monto_pagado);
    const montoStr = prompt(`Monto a ${d.tipo === 'a_pagar' ? 'pagar' : 'recibir'} (saldo pendiente: ${formatearMonto(saldo)}):`, String(saldo));
    if (montoStr === null) return;
    const monto = parseFloat(montoStr.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(monto) || monto <= 0) { alert('Monto inválido.'); return; }
    const nuevoPagado = Math.min(Number(d.monto_pagado) + Math.round(monto), Number(d.monto_total));
    const nuevoEstado = nuevoPagado >= Number(d.monto_total) ? 'pagada' : 'activa';

    supabase.from('debts').update({ monto_pagado: nuevoPagado, estado: nuevoEstado }).eq('id', id).then(({ error }) => {
        if (error) { alert('Error: ' + error.message); return; }
        const index = deudas.findIndex(de => de.id === id);
        if (index !== -1) deudas[index] = { ...deudas[index], monto_pagado: nuevoPagado, estado: nuevoEstado };
        renderizarDeudas();
    });
}

document.getElementById('formDeuda')?.addEventListener('submit', guardarDeuda);
document.getElementById('filtroDeudas')?.addEventListener('change', renderizarListaDeudas);
document.getElementById('modalDeuda')?.addEventListener('click', function(e) {
    if (e.target === this) cerrarModalDeuda();
});
