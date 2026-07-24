let scanStream = null;
let scanAnimationId = null;
let scanDatos = null;
let ocrWorker = null;

async function abrirScanner() {
    document.getElementById('modalScanner').classList.add('active');
    document.getElementById('btnConfirmarScan').style.display = 'none';
    document.getElementById('scannerLoading').style.display = 'block';
    document.getElementById('scannerLoading').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando cámara...';
    document.getElementById('scanPreview').style.display = 'none';
    document.getElementById('scanError').style.display = 'none';
    scanDatos = null;

    try {
        scanStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        const video = document.getElementById('scannerVideo');
        video.srcObject = scanStream;
        await video.play();

        document.getElementById('scannerLoading').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando QR...';
        escanearFrameLoop();
    } catch (err) {
        document.getElementById('scannerLoading').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error al acceder a la cámara: ' + err.message;
        console.error('Camera error:', err);
    }
}

function cerrarScanner() {
    if (scanAnimationId) {
        cancelAnimationFrame(scanAnimationId);
        scanAnimationId = null;
    }
    if (scanStream) {
        scanStream.getTracks().forEach(t => t.stop());
        scanStream = null;
    }
    document.getElementById('modalScanner').classList.remove('active');
    scanDatos = null;
}

function escanearFrameLoop() {
    const video = document.getElementById('scannerVideo');
    if (!video || video.readyState < 2) {
        scanAnimationId = requestAnimationFrame(escanearFrameLoop);
        return;
    }
    if (scanDatos) {
        scanAnimationId = requestAnimationFrame(escanearFrameLoop);
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

    if (code && code.data) {
        const datos = extraerDatosQR(code.data);
        if (datos) {
            scanDatos = datos;
            mostrarResultadoScan(datos, null);
            scanAnimationId = requestAnimationFrame(escanearFrameLoop);
            return;
        }
    }

    scanAnimationId = requestAnimationFrame(escanearFrameLoop);
}

function capturarFoto() {
    const video = document.getElementById('scannerVideo');
    if (!video || video.readyState < 2) return;

    const canvas = document.getElementById('scanCanvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

    if (code && code.data) {
        const datos = extraerDatosQR(code.data);
        if (datos) {
            scanDatos = datos;
            mostrarResultadoScan(datos, null);
            return;
        }
    }

    document.getElementById('scannerLoading').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando imagen con OCR...';
    procesarOCR(imageData, canvas);
}

async function procesarOCR(imageData, canvas) {
    try {
        if (typeof Tesseract === 'undefined') {
            document.getElementById('scannerLoading').innerHTML = '<i class="fas fa-exclamation-triangle"></i> OCR no disponible';
            return;
        }

        const result = await Tesseract.recognize(
            canvas,
            'spa',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const pct = Math.round(m.progress * 100);
                        document.getElementById('scannerLoading').innerHTML =
                            '<i class="fas fa-spinner fa-spin"></i> OCR: ' + pct + '%';
                    }
                }
            }
        );

        const texto = result.data.text;
        const datos = extraerDatosOCR(texto);
        if (datos) {
            scanDatos = datos;
            mostrarResultadoScan(datos, canvas.toDataURL());
        } else {
            document.getElementById('scannerLoading').innerHTML =
                '<i class="fas fa-exclamation-triangle"></i> No se pudieron extraer datos. Intentá de nuevo.';
        }
    } catch (err) {
        console.error('OCR error:', err);
        document.getElementById('scannerLoading').innerHTML =
            '<i class="fas fa-exclamation-triangle"></i> Error en OCR: ' + err.message;
    }
}

function extraerDatosQR(texto) {
    try {
        const data = JSON.parse(texto);
        const monto = data.montoTotal || data.importe || data.monto || data.total || data.precio || data.montoTotalGs || null;
        const fecha = data.fecha || data.fechaEmision || data.fechaFactura || data.date || null;
        const razon = data.razonSocial || data.nombre || data.razon || data.emisor || data.businessName || '';
        const factura = data.numeroFactura || data.nroFactura || data.factura || data.numero || data.nroCmp || '';

        if (!monto && !fecha && !razon) return null;

        let concepto = razon;
        if (factura) concepto += (concepto ? ' - ' : '') + 'Factura ' + factura;
        if (!concepto.trim()) concepto = 'Gasto escaneado';

        let fechaFormateada = fecha;
        if (fecha && fecha.includes('/')) {
            const partes = fecha.split('/');
            if (partes.length === 3) {
                if (partes[2].length === 4) fechaFormateada = `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`;
                else if (partes[0].length === 4) fechaFormateada = fecha.replace(/\//g, '-');
            }
        }

        const montoNum = parseFloat(String(monto).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

        return { concepto: concepto.trim(), monto: montoNum, fecha: fechaFormateada };
    } catch (e) {
        return null;
    }
}

function extraerDatosOCR(texto) {
    const lineas = texto.split('\n').map(l => l.trim()).filter(l => l);
    if (lineas.length === 0) return null;

    let monto = null;
    let fecha = null;
    let concepto = '';

    for (const linea of lineas) {
        const montoMatch = linea.match(/(?:total|monto|importe|Gs\.?\s*|₲)\s*:?\s*([\d.,]+)/i);
        if (montoMatch) {
            const val = parseFloat(montoMatch[1].replace(/\./g, ''));
            if (!isNaN(val) && val > 0) monto = val;
        }

        const montoSimple = linea.match(/^\s*([\d.,]+)\s*$/);
        if (montoSimple && !monto) {
            const val = parseFloat(montoSimple[1].replace(/\./g, ''));
            if (!isNaN(val) && val > 100) monto = val;
        }

        const fechaMatch = linea.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
        if (fechaMatch && !fecha) {
            fecha = `${fechaMatch[3]}-${fechaMatch[2].padStart(2,'0')}-${fechaMatch[1].padStart(2,'0')}`;
        }
    }

    const lineasFiltradas = lineas.filter(l =>
        !/^\d/.test(l) && !/(total|monto|importe|Gs|ruc|fac|timbre|cdc|cod|nro|iva|subtotal|descuento|moneda|cliente|direccion|telefono)/i.test(l)
    );

    concepto = lineasFiltradas.slice(0, 3).join(' - ') || 'Gasto escaneado';
    if (concepto.length > 100) concepto = concepto.substring(0, 100);

    const montoNum = monto || 0;

    return { concepto, monto: montoNum, fecha: fecha || new Date().toISOString().split('T')[0] };
}

function mostrarResultadoScan(datos, imagenSrc) {
    document.getElementById('scannerLoading').style.display = 'none';
    document.getElementById('scanPreview').style.display = 'block';

    if (imagenSrc) {
        document.getElementById('scanPreviewImg').src = imagenSrc;
        document.getElementById('scanPreviewImg').style.display = 'block';
    } else {
        document.getElementById('scanPreviewImg').style.display = 'none';
    }

    document.getElementById('scanConcepto').value = datos.concepto;
    document.getElementById('scanMonto').value = datos.monto;
    document.getElementById('scanFecha').value = datos.fecha || new Date().toISOString().split('T')[0];

    document.getElementById('btnConfirmarScan').style.display = 'inline-flex';
}

function confirmarGastoScan() {
    const concepto = document.getElementById('scanConcepto').value.trim();
    const monto = parseFloat(document.getElementById('scanMonto').value);
    const fecha = document.getElementById('scanFecha').value;
    const categoria = document.getElementById('scanCategoria').value;

    if (!concepto) { showToast('Por favor, ingresá un concepto.', 'warning'); return; }
    if (isNaN(monto) || monto < 100) { showToast('El monto mínimo es ₲ 100.', 'warning'); return; }
    if (!fecha) { showToast('Por favor, seleccioná una fecha.', 'warning'); return; }

    agregarGastoScan({ concepto, categoria, monto: Math.round(monto), fecha });
}

async function agregarGastoScan(gasto) {
    const { data, error } = await supabase.from('expenses').insert({
        user_id: currentUser.id,
        concepto: gasto.concepto,
        categoria: gasto.categoria,
        monto: gasto.monto,
        fecha: gasto.fecha
    }).select();

    if (error) {
        showToast('Error al guardar el gasto: ' + error.message, 'error');
        return;
    }

    if (data && data[0]) {
        gastos.unshift(data[0]);
    }

    cerrarScanner();
    renderizarTodo();
}

document.getElementById('modalScanner')?.addEventListener('click', function(e) {
    if (e.target === this) cerrarScanner();
});
