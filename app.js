/* ============================================================
   Bitácora Viveros — lógica de pantallas (solo diseño)
   Cada pantalla es una función render*() que devuelve HTML.
   Los datos vienen de window.DATA (data.js). Las acciones que
   en el futuro irán a Supabase están marcadas con  // SUPABASE:
   ============================================================ */
   (function () {
    'use strict';
    
    var D = window.DATA;
    var vista = document.getElementById('view');

    //---------------  Utilidades ----------------------------------
    function esc(s) { 
        return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function hoy() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    function aISO(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function deISO(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function sumarDias(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function diasEntre(a, b) { return Math.round((b - a) / 86400000); }
    function ddmm(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); } 
    var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    function diaCorto(d) { return DIAS[d.getDay()] + ' '  + d.getDate(); }
    function fechaLarga(d) { return DIAS_LARGOS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
    function horaDe(marca) { var m = String(marca).match(/T(\d{2}:\d{2})/); return m ? m[1] : ''; }
    // Marca temporal en hora local con la zona horaria del dispositivo, ej. 2026-11-18T16:05:12-06:00.
    // Se usa la misma para riegos y aplicaciones, así horaDe() siempre muestra la hora local.
    function marcaAhora() {
        var d = new Date(), off = -d.getTimezoneOffset(), a = Math.abs(off);
        function dos(n) { return String(n).padStart(2, '0'); }
        return aISO(d) + 'T' + dos(d.getHours()) + ':' + dos(d.getMinutes()) + ':' + dos(d.getSeconds()) +
            (off >= 0 ? '+' : '-') + dos(Math.floor(a / 60)) + ':' + dos(a % 60); 
    }
    function unicos(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }
    function opciones(lista, sel) {
        return lista.map(function (o) { return '<option' + (o === sel ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
    }

    var timerToast;
    function toast(msg, esError) {
        var t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast visible' + (esError ? ' error' : '');
        clearTimeout(timerToast);
        timerToast = setTimeout(function () { t.className = 'toast'; }, 3500);
    }

    // ----------------------------- Consultas sobre los datos -----------------------
    // SUPABASE: Cada función de este bloque se convierte en una consulta
    function viveroPorId(id) { return D.viveros.filter(function (v) { return v.id === id; })[0]; }
    function viverosActivos() { return D.viveros.filter(function (v) { return v.activo;}); }
    function ddsDe(v) { return diasEntre(deISO(v.fecha_siembra), hoy()); }
    function planVigente(tipo, lugar, temporada) {
        return D.planes.filter(function (p) {
            return p.tipo === tipo && p.lugar === lugar && p.temporada === temporada && p.estado === 'vigente'; 
        })[0] || null;
    }
    function aplicacionesHechas(viveroId) {
        return D.registro_aplicaciones.filter(function (r) { return r.vivero_id === viveroId && r.realizado !== 'NO'; })
            .map(function (r) { return String(r.num_aplicacion); });
    }
    function riegosDe(viveroId, fechaISO) {
        return D.registro_riegos.filter(function (r) { return r.vivero_id === viveroId && r.fecha_riego === fechaISO; });
    }

    //Estado de una celda de la cuadrícula de riego
    function estadoRiegoDia(viveroId, fechaISO) {
        var rs = riegosDe(viveroId, fechaISO);
        if (!rs.length) return 'X';
        if (rs.some(function (r) { return r.riego_efectivo === 'SI'; })) return 'S';
        if (rs.every(function (r) { return r.razon_no; })) return 'J';
        return 'N';
    }

    // Aplicaciones del plan cercanas a hoy para un vivero
    function aplicacionesCercanas(v) {
        var plan = planVigente('aplicaciones', v.lugar, v.temporada);
        if (!plan) return [];
        var dds = ddsDe(v), hechas = aplicacionesHechas(v.id), siembra = deISO(v.fecha_siembra);
        return plan.filas.filter(function (f) {
            return hechas.indexOf(String(f.num)) < 0 && f.dds_fin >= dds - 10 && f.dds_inicio <= dds + 7;
        }).map(function (f) {
            var estado = dds > f.dds_fin ? 'atrasada' : (dds >= f.dds_inicio ? 'ventana' : 'proxima');
            var ini = sumarDias(siembra, f.dds_inicio), fin = sumarDias(siembra, f.dds_fin);
            return {
                vivero: v.nombre, num: f.num, producto: f.producto, opcional: /opc/i.test(f.observacion),
                ventana: f.dds_ventana + ' · ' + (f.dds_inicio === f.dds_fin ? ddmm(ini) : ddmm(ini) + '-' + ddmm(fin)),
                estado: estado, diasAtraso: dds - f.dds_fin
            };
        });
    }

    //----------- Estado de la interfaz ------------------------------------------
    var estado = {
        filtro: { temporada: '2026C', lugar: 'Centro Experimental' },
        planes: { tipo: 'aplicaciones', lugar: 'Centro Experimental', temporada: '2026C', archivo: null, filas: null },
        captura: nuevaCaptura('riego'),
        enLinea: navigator.onLine
    };
    function nuevaCaptura(modo) {
        return { modo: modo, viveroId: null, fecha: aISO(hoy()), efectivo: '', tipoRiego: '', razon: '',
            planNum: '', realizado: '', fechaReal: aISO(hoy()), cambio: '', extraEtapa: '', extraProducto: '', extraDosis: '', obs: ''};
    }

    // ----------------------------------------------------
    // PANTALLA 1 · PANEL GENERAL
    //-----------------------------------------------------
    function renderPanel() {
        var f = estado.filtro;
        var temporada = unicos(D.viveros.map(function (v) { return v.temporada; })).sort().reverse();
        var lugares = unicos(D.viveros.map(function (v) { return v.lugar; })).concat(['Todos']);
        var viv = viverosActivos().filter(function (v) {
            return v.temporada === f.temporada && (f.lugar === 'Todos' || v.lugar === f.lugar);
        });
        var ids = viv.map(function (v) { return v.id; });
        var hoyISO = aISO(hoy());

        var cercanas = [];
        viv.forEach(function (v) { cercanas = cercanas.concat(aplicacionesCercanas(v)); });
        var orden = { atrasada: 0, ventana: 1, proxima: 2 };
        cercanas.sort(function (a, b) { return orden[a.estado] - orden[b.estado] || a.num - b.num; });
        var atrasadas = cercanas.filter(function (c) { return c.estado === 'atrasada'; }).length;

        var riegosHoy = D.registro_riegos.filter(function (r) { return ids.indexOf(r.vivero_id) >=0 && r.fecha_riego === hoyISO; }).length;
        var apliHoy = D.registro_aplicaciones.filter(function (r) { return ids.indexOf(r.vivero_id) >= 0 && r.fecha_real === hoyISO; }).length;

        var dias = [];
        for (var i = 6; i >= 0; i--) dias.push(sumarDias(hoy(), -i));
        var conDato = 0, cumplidos = 0, sinMotivo = 0;
        var filasRiego = viv.map(function (v){
            var celdas = dias.map(function (d){
                var e = estadoRiegoDia(v.id, aISO(d));
                if (e !== 'X') conDato++;
                if (e === 'S' || e === 'J') cumplidos++;
                if (e === 'N') sinMotivo++;
                return e;
            });
            return { vivero: v.nombre, celdas: celdas };
        });
        var pctRiego = conDato ? Math.round(cumplidos / conDato * 100) : null;
        var cumplimiento = pctRiego === null ? '-' : pctRiego + ' %';
        // Umbrales de diseño, a confirmar con el equipo técnico: 90% o más en verde, menos de 75% en rojo.
        var claseRiego = pctRiego === null ? '' : pctRiego >= 90 ? 'good' : pctRiego < 75 ? 'bad' : 'warn';
        // Con "Todos" puede haber varios lugares: se juntan los planes provisionales de todos.
        var avisosPlan = [];
        viv.forEach(function (v) {
            var p = planVigente('aplicaciones', v.lugar, v.temporada);
            if (p && p.nota && /provisional/i.test(p.nota) && avisosPlan.indexOf(p) < 0) avisosPlan.push(p);
        });
        var r = D.sync.resultados;
        var ok = r.filter(function (x) { return x.estado === 'ok'; }).length;

        var etiquetaEstado = {
            atrasada: function (c) { return '<span class="pill err">Atrasada ' + c.diasAtraso + (c.diasAtraso === 1 ? ' día': ' días') + '</span>'; },
            ventana: function () { return '<span class="pill ok">En ventana</span>'; },
            proxima: function () { return '<span class="pill info">Próxima</span>'; }
        };
        var letras = { S: 'Sí', J: 'J', N: 'No', X: '-' };

        return '' +
            '<header class="page-head">' +
                '<div><div class="eyebrow">' + fechaLarga(hoy()) + ' · datos de ejemplo</div><h1>Panel general</h1></div>' +
                '<div class="field-inline">' +
                    '<label class="field">Temporada<select data-bind="filtro.temporada">' + opciones(temporada, f.temporada) + '</select></label>' +
                    '<label class="field">Lugar<select data-bind="filtro.lugar">' + opciones(lugares, f.lugar) + '</select></label>' +
                '</div>' +
            '</header>' +
            
            '<section class="kpis" aria-label="Indicadores">' + 
                kpi('Viveros activos', viv.length, f.lugar + ' · ' + f.temporada, '') +
                kpi('Registros hoy', riegosHoy + apliHoy, riegosHoy + ' riegos · ' + apliHoy + ' aplicaciones', '') +
                kpi('Aplicaciones atrasadas', atrasadas, 'Fuera de la ventana del plan', atrasadas ? 'bad' : 'good') +
                kpi('Cumplimiento de riego', cumplimiento, 'Últimos 7 días, justificados incluidos', claseRiego) +
            '</section>' +

            '<section class="row">' +
                '<div class="card grow-3">' +
                    '<div class="card-head"><h2>Aplicaciones del plan cercanas a hoy</h2><a href="#/planes">Ver plan vigente</a></div>' +
                    avisosPlan.map(function (p) {
                        return '<div class="notice warn">' + (f.lugar === 'Todos' ? '<b>' + esc(p.lugar) + ':</b> ' : '') + esc(p.nota) + '</div>';
                    }).join('') +
                    (cercanas.length ?
                        '<div class="table-wrap"><table style="min-width:560px"><thead><tr><th>Vivero</th><th>#</th><th>Producto</th><th>Ventana</th><th>Estado</th></tr></thead><tbody>' +
                        cercanas.map(function (c) {
                            return '<tr><td class="mono">' + esc(c.vivero) + '</td><td>' + c.num + '</td><td>' + esc(c.producto) + 
                                (c.opcional ? ' <span class="pill warn">Opcional</span>' : '') + '</td><td style="white-space:nowrap">' + esc(c.ventana) +
                                '</td><td>' + etiquetaEstado[c.estado](c) + '</td></tr>';
                        }).join('') + '</tbody></table></div>'
                        : '<div class="notice muted">No hay aplicaciones pendientes cerca de la fecha para este filtro.</div>') +
                    '</div>' +

                    '<div class="stack grow-2">' +
                        '<div class="card">' +
                        '<h2>Última corrida a BMS</h2>' +
                        '<div style="display:flex;align-items:baseline;gap:10px"><div class="kpi-value ' + (ok === r.length ? 'good' : 'bad') + '" style="font-size:28px">' + ok + ' de ' + r.length + '</div><div class="kpi-sub">viveros sin errores</div></div>' +
                        '<div class="kpi-sub">Hoy a las ' + D.sync.corrida.hora + ' · ' + D.sync.corrida.duracion + '</div>' +
                        '<a class="btn btn-outline-green" href="#/sync">Ver detalle de sincronización</a>' +
                    '</div>' +
                    '<div class="card">' +
                        '<h2>Pendientes de revisión</h2>' +
                        '<div class="lista-simple">' +
                            '<div><span>Posibles duplicados bloqueados</span><b>' + D.duplicadosBloqueados + '</b></div>' +
                            '<div><span>Riegos «NO» sin motivo (7 días)</span><b>' + sinMotivo + '</b></div>' +
                            '<div><span>Registros esperando señal en tablets</span><b>' + D.pendientesEnvio + '</b></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</section>' +

            '<section class="card">' +
                '<div class="card-head"><h2>Riegos de los últimos 7 días</h2>' +
                '<div class="legend">' +
                    '<span><span class="celda S">Sí</span>Efectivo</span>' +
                    '<span><span class="celda J">J</span>No, justificado</span>' +
                    '<span><span class="celda N">No</span>Sin motivo</span>' +
                    '<span><span class="celda X">-</span>Sin dato</span>' +
                '</div>' +
            '</div>' +
            (filasRiego.length ?
                '<div class="table-wrap"><div class="grid-riegos">' +
                '<div class="fila cab"><span>Vivero</span>' + dias.map(function (d) { return '<span>' + diaCorto(d) + '</span>'; }).join('') + '</div>' +
                filasRiego.map(function (fr) {
                    return '<div class="fila"><span class="mono">' + esc(fr.vivero) + '</span>' +
                        fr.celdas.map(function (c) { return '<span class="celda ' + c + '">' + letras[c] + '</span>'; }).join('') + '</div>';
                }).join('') +
                '</div></div>' 
                : '<div class="notice muted">Sin viveros activos para este filtro.</div>') +
            '</section>';
    }
    function kpi(label, valor, sub, clase) {
        return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value ' + clase + '">' + esc(valor) +
            '</div><div class="kpi-sub">' + esc(sub) + '</div></div>';
    }

    //------------------------------------------------------------------------------
    // PANTALLA 2 · CARGAR PLAN
    //------------------------------------------------------------------------------
    function validarPlan(filas, vigente) {
        var vistos = {}, errores = 0, cambios = 0;
        var porNum = {};
        (vigente ? vigente.filas : []).forEach(function (f) { porNum[f.num] = f; });
        var resultado = filas.map(function (f) {
            var probs = [];
            var num = Number(f.num), ini = Number(f.dds_inicio), fin = Number(f.dds_fin);
            if (!f.num && f.num !== 0) probs.push('Falta el #');
            else if (vistos[num]) probs.push('# repetido: ya existe el ' + num);
            if (!Number.isInteger(ini) || !Number.isInteger(fin)) probs.push('DDS debe ser número entero');
            else if (fin < ini) probs.push('DDS fin menor que inicio');
            if (!String(f.producto || '').trim()) probs.push('Falta el producto');
            vistos[num] = true;

            var antes = porNum[num], cambio = '';
            if (!probs.length && antes) {
                var dif = [];
                if (antes.producto !== f.producto) dif.push('producto');
                if (antes.dosis !== f.dosis) dif.push('dosis');
                if (antes.dds_inicio !== ini || antes.dds_fin !== fin) dif.push('DDS');
                if (dif.length) cambio = 'Cambia ' + dif.join(' y ') + ' vs v' + vigente.version;
            } else if (!probs.length && vigente && !antes) {
                cambio = 'Nueva respecto a v' + vigente.version;
            }
            if (probs.length) errores++;
            if (cambio) cambios++;
            return { fila: f, problemas: probs, cambio: cambio};
        });
        return { filas: resultado, errores: errores, cambios: cambios, validas: filas.length - errores };
    }

    function renderPlanes() {
        var p = estado.planes;
        var lugares = unicos(D.viveros.map(function (v) { return v.lugar; }));
        var temporadas = ['2027A'].concat(unicos(D.viveros.map(function (v) { return v.temporada; })).sort().reverse());
        var vigente = planVigente(p.tipo, p.lugar, p.temporada);
        var usan = viverosActivos().filter(function (v) { return v.lugar === p.lugar && v.temporada === p.temporada; });
        var val = p.filas ? validarPlan(p.filas, vigente) : null;
        var siguiente = vigente ? vigente.version + 1 : 1;
        var historial = D.planes.filter(function (x) { return x.tipo === p.tipo; });

        return '' +
            '<header><div class="eyebrow">Planes · datos de ejemplo</div><h1>Cargar plan de temporada</h1>' +
                '<p class="lead">Sube el archivo que envía el equipo técnico. La app lo valida, muestra las diferencias con el plan vigente y solo lo publica cuando no hay errores.</p></header>' +

            '<section class="row">' +
                '<div class="card grow-1">' +
                    '<h2>1 · ¿A qué corresponde?</h2>' +
                    '<div class="seg" role="group" aria-label="Tipo de plan">' +
                        '<button type="button" class="verde" data-action="plan-tipo" data-valor="aplicaciones" aria-pressed="' + (p.tipo === 'aplicaciones') + '">Aplicaciones</button>' +
                        '<button type="button" class="azul" data-action="plan-tipo" data-valor="riego" aria-pressed="' + (p.tipo === 'riego') + '">Riego</button>' +
                    '</div>' +
                    '<div class="grid-2">' +
                        '<label class="field">Lugar<select data-bind="planes.lugar">' + opciones(lugares, p.lugar) + '</select></label>' +
                        '<label class="field">Temporada<select data-bind="planes.temporada">' + opciones(temporadas, p.temporada) + '</select></label>' +
                    '</div>' +
                    '<div class="notice muted">' +
                    (vigente 
                        ? '<b style="color:var(--ink)">Plan vigente:</b> versión ' + vigente.version + ' · ' + vigente.filas.length + ' aplicaciones<br>' + esc(vigente.nota || '')
                        : '<b style="color:var(--ink)">Sin plan vigente</b> para esta combinación.') +
                    '<br>' + (usan.length ? 'Lo usan ' + usan.length + ' vivero(s): ' + usan.map(function (v) { return esc(v.nombre); }).join(', '): 'Ningún vivero activo lo usa todavía.') +
                '</div>' +
                (p.tipo === 'riego' ? '<div class="notice warn">Aún no existe un plan de riego. Las columnas de la plantilla se definen cuando el equipo técnico confirme qué quiere planificar (frecuencia por etapa, lámina, etc.).</div>' : '') +
            '</div>' +

            '<div class="card grow-1">' +
                '<h2>2 · Archivo del plan</h2>' +
                '<div class="dropzone" id="dropzone">' +
                    '<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1B5E20" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path>' +
                        (p.archivo ? '<path d="M9 14l2 2 4-4"></path>' : '<path d="M12 18v-6"></path><path d="M9 15l3-3 3 3"></path>') + '</svg>' +
                    (p.archivo
                        ? '<div class="dropzone-file">' + esc(p.archivo) + '</div><div class="kpi-sub">' + p.filas.length + ' filas leídas</div>'
                        : '<div style="font-weight:600">Arrastra aquí el Excel o CSV del plan</div><div class="kpi-sub">o elígelo desde tu computadora</div>') +
                    '<label class="btn">' + (p.archivo ? 'Cambiar archivo' : 'Elegir archivo') +
                        '<input type="file" accept=".xlsx,.xls,.csv" data-action="plan-archivo" class="oculto"></label>' +
                '</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:14px">' +
                    '<a href="#/planes" data-action="plan-plantilla">Descargar plantilla vacía (.csv)</a>' +
                    (p.archivo ? '<a href="#/planes" data-action="plan-quitar">Quitar archivo</a>' : '<a href="#/planes" data-action="plan-ejemplo">Usar archivo de ejemplo</a>') +
                '</div>' +
            '</div>' +
        '</section>' +

        (val ? 
            '<section class="card">' +
                '<div class="card-head"><h2>3 · Revisión antes de Publicar</h2>' +
                    '<div class="field-inline">' +
                        '<span class="pill ok">' + val.validas + ' filas válidas</span>' +
                        (val.errores ? '<span class="pill err">' + val.errores + ' con errores</span>' : '') +
                        (val.cambios ? '<span class="pill info">' + val.cambios + ' cambian respecto a la versión ' + (vigente ? vigente.version : '') + '</span>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="table-wrap"><table style="min-width:820px"><thead><tr><th>#</th><th>DDS</th><th>Etapa</th><th>Categoría</th><th>Producto</th><th>Dosis</th><th>Validación</th></tr></thead><tbody>' +
                val.filas.map(function (r) {
                    var f = r.fila, clase = r.problemas.length ? 'fila-err' : (r.cambio ? 'fila-cambio' : '');
                    var celda = r.problemas.length ? '<span class="valid-err">' + esc(r.problemas.join(' · ')) + '</span>'
                        : (r.cambio ? '<span class="valid-cambio">' + esc(r.cambio) + '</span>' : '<span class="valid-ok">Correcta</span>');
                    return  '<tr class="' + clase + '"><td><b>' + esc(f.num) + '</b></td><td style="white-space:nowrap">' + esc(f.dds_inicio) + '-' + esc(f.dds_fin) +
                        '</td><td>' + esc(f.etapa) + '</td><td>' + esc(f.categoria) + '</td><td>' + esc(f.producto) + '</td><td>' + esc(f.dosis) + '</td><td>' + celda + '</td></tr>';    
                }).join('') +
            '</tbody></table></div>' +
        '</section>'
        : '') +

        '<section class="row">' +
            '<div class="card grow-3">' + 
                '<h2>' + (val ? '4' : '3') + ' · Publicar</h2>' +
                '<p class="lead" style="margin:0">Se crea la versión ' + siguiente + ' del plan de ' + esc(p.lugar) + ' ' + esc(p.temporada) +
                    '. Los registros ya capturados conservan la versión con la que se hicieron, así Power BI no mezcla planes.</p>' +
                '<div class="field-inline">' +
                    (!val ? '<button type="button" class="btn btn-primary" disabled>Carga un archivo para publicar</button>'
                        : val.errores ? '<button type="button" class="btn btn-primary" disabled>Corrige ' + val.errores + (val.errores === 1 ? ' error' : ' errores') + ' para publicar</button>'
                        : '<button type="button" class="btn btn-primary" data-action="plan-publicar">Publicar versión ' + siguiente + '</button>') +
                    '<button type="button" class="btn" data-action="plan-borrador"' + (val ? '' : ' disabled') + '>Guardar como borrador</button>' +
                '</div>' +
            '</div>' +
            '<div class="card grow-2">' +
                '<h2>Historial</h2>' +
                (historial.length ? '<div class="historial">' + historial.map(function (h){
                   return '<div><b>' + esc(h.lugar + ' ' + h.temporada) + ' · versión ' + h.version + (h.estado === 'vigente' ? ' · vigente' : '') + '</b><span>' + esc(h.nota || '') + '</span></div>';  
                }).join('') + '</div>' : '<div class="kpi-sub">Todavía no hay planes de este tipo.</div>') +
            '</div>' +
        '</section>';
    }

    function cargarArchivoPlan(nombre) {
        // SUPABASE / DISEÑO: aquí se leería el Excel real (por ejemplo con SheetJS).
        // Por ahora se usa siempre el archivo de ejemplo para mostrar la validación
        estado.planes.archivo = nombre || D.planArchivoEjemplo.nombre;
        estado.planes.filas = D.planArchivoEjemplo.filas;
        render();
    }

    function descargarPlantilla(){ 
        var cab = 'num,dds_inicio,dds_fin,dds_ventana,etapa,categoria,producto,dosis,observacion\n';
        var ej = '1,0,0,0 DDS,Siembra,Tto. Semilla,Fortenza Maxx,6-8 ml / kg semilla,\n';
        var blob = new Blob(['' + cab + ej], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'plantilla_plan_aplicaciones.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    //---------------------------------------------------------------------
    // PANTALLA 3 · SINCRONIZACIÓN BMS
    // --------------------------------------------------------------------
    function renderSync() {
        var r = D.sync.resultados;
        var ok = r.filter(function (x) { return x.estado === 'ok'; }).length;
        var err = r.filter(function (x) { return x.estado === 'error'; }).length;
        var sin = r.filter(function (x) { return x.estado === 'sin_vincular'; }).length;
        var est = {
            ok: { txt: 'Subido', cls: 'ok', accion: 'Ver archivos' },
            error: { txt: 'Falló', cls: 'err', accion: 'Reintentar' },
            sin_vincular: { txt: 'Sin estudio vinculado', cls: 'warn', accion: 'Vincular'}
        };

        return '' +
            '<header class="page-head">' +
                '<div><div class="eyebrow">Sincronización · datos de ejemplo</div><h1>Supabase -> BMS</h1></div>' +
                '<button type="button" class="btn btn-primary" data-action="sync-ahora">Sincronizar ahora</button>' +
            '</header>' +

            '<section class="flujo" aria-label="Cómo viajan los datos">' +
                '<div class="nodo"><div class="eyebrow">Origen</div><b>Supabase</b><small>registro_aplicaciones · registro_riegos</small></div>' +
                '<div class="flecha" aria-hidden="true">-></div>' +
                '<div class="nodo"><div class="eyebrow">Proceso nocturno · 01:00</div><b>Edge Function</b><small>Arma el Excel en código, sin Google Sheets</small></div>' +
                '<div class="flecha" aria-hidden="true">-></div>' + 
                '<div class="nodo"><div class="eyebrow">Destino</div><b>BMS</b><small>CropProtectSchedule · IrrigMethod_text</small></div>' +
            '</section>' +

            '<section class="card">' +
                '<div class="card-head"><h2>Corrida de hoy, ' + D.sync.corrida.hora + '</h2>' +
                    '<span class="kpi-sub">' + ok + ' subidos · ' + err + ' con error · ' + sin + ' sin vincular · ' + D.sync.corrida.duracion + '</span></div>' + 
                '<div class="table-wrap"><table style="min-width:860px"><thead><tr><th>Vivero</th><th>Estudio en BMS</th><th>Aplicaciones</th><th>Riegos</th><th>Estado</th><th><span class="oculto">Accion</span></th></tr></thead><tbody>' +
                    r.map(function (x) {
                        var v = viveroPorId(x.vivero_id), e = est[x.estado];
                        return '<tr><td class="mono">' + esc(v.nombre) + '</td>' +
                            '<td class="kpi-sub">' + (v.study_dbid ? 'Estudio ' + v.study_dbid + ' · instancia confirmada' : 'Sin asignar') + '</td>' +
                            '<td>'  + (x.ap_filas ? x.ap_filas + ' filas' : '-') + '</td><td>' + (x.r_filas ? x.r_filas + ' filas' : '-') + '</td>' +
                            '<td><span class="pill ' + e.cls + '">' + e.txt + '</span>' + (x.error ? '<div class="kpi-sub" style="margin-top:4px">' + esc(x.error) + '</div>' : '') + '</td>' +
                            '<td style="text-align:right"><button type="button" class="btn btn-sm" data-action="sync-accion" data-valor="' + esc(e.accion) + '" data-vivero="' + esc(v.nombre) + '">' + e.accion + '</button></td></tr>';
                    }).join('') +
                '</tbody></table></div>' +
            '</section>' +
            
            '<section class="row">' +
                '<div class="card grow-1"><h2>Últimas 7 noches</h2><div class="lista-simple">' +
                    D.sync.noches.map(function (n) {
                        var color = n.nivel === 'ok' ? 'var(--ok-fg)' : n.nivel === 'warn' ? 'var(--warn-fg)' : 'var(--err-fg)';
                        return '<div><span>' + diaCorto(sumarDias(hoy(), -n.dias)) + '</span><b style="color:' + color + '">' + esc(n.res) + '</b></div>';
                    }).join('') +
                '</div></div>' +
                '<div class="card grow-1"><h2>Avisos</h2><div class="historial">' +
                    '<div><b>Correo si falla un vivero</b><span>Se envía al terminar la corrida, con el vivero y el error de BMS.</span></div>' +
                    '<div><b>Reintento automático</b><span>Un segundo intento a los 10 minutos si BMS responde con error.</span></div>' +
                    '<div><b>Vinculación exacta</b><span>Si un vivero no tiene estudio de BMS asignado, no se sube nada hasta vincularlo.</span></div>' +
                '</div></div>' +
            '</section>';
    }

    // --------------------------------------------------
    // PANTALLA 4 · CAPTURA EN CAMPO
    // --------------------------------------------------
    function renderCaptura() {
        var c = estado.captura;
        var hoyISO = aISO(hoy());
        var viveros = viverosActivos();
        var v = c.viveroId ? viveroPorId(c.viveroId) : null;
        var esRiego = c.modo === 'riego';
        var previos = v && esRiego ? riegosDe(v.id, c.fecha) : [];
        var cat = D.catalogos;

        var red = estado.enLinea
            ? (D.pendientesEnvio ? '<div class="estado-red offline">' + D.pendientesEnvio + ' registros pendientes de enviar</div>' : '<div class="estado-red online">En línea · todo enviado</div>')
            : '<div class="estado-red offline">Sin señal · ' + D.pendientesEnvio + ' registros se enviarán al volver la conexión</div>';

        var listaViveros = viveros.map(function (x) {
            var riegoHoy = riegosDe(x.id, hoyISO)[0];
            var sub = ddsDe(x) + ' DDS  · ' + x.lugar + ' · '  + (riegoHoy ? 'Riego de hoy registrado (' + horaDe(riegoHoy.marca_temporal) + ')' :  'Sin riego hoy');
            return '<button type="button" class="vivero-btn" data-action="cap-vivero" data-valor="' + x.id + '" aria-pressed="' + (c.viveroId === x.id) + '">' +
                '<span class="mono">' + esc(x.nombre) + '</span><small>' + esc(sub) + '</small></button>';
        }).join('');

        var cuerpo = !v ? '' : (esRiego ? camposRiego(c, previos, cat) : camposAplicacion(c, v, cat));
        var etiquetaGuardar = esRiego ? (previos.length ? 'Guardar segundo riego' : 'Guardar riego') : 'Guardar aplicación';

        return '' +
            '<div class="captura">' +
                '<div class="captura-head">' +
                    '<div><div style="font-size:17px;font-weight:700">Captura en campo</div><small>' + esc(D.usuario.nombre) + '  · el responsable se llena solo</small></div>' +
                    red +
                '</div>' +
                '<div class="seg" role="group" aria-label="Tipo de registro">' +
                    '<button type="button" class="azul" data-action="cap-modo" data-valor="riego" aria-pressed="' + esRiego + '">Riego</button>' +
                    '<button type="button" class="verde" data-action="cap-modo" data-valor="apli" aria-pressed="' + !esRiego + '">Aplicación</button>' +
                '</div>' +
                '<div class="captura-cuerpo">' +
                    '<div class="field captura-lista">Vivero<div class="lista-viveros">' + listaViveros + '</div></div>' +
                    '<div class="captura-form">' +
                (v ? cuerpo : '<div class="notice muted">Elige un vivero para continuar.</div>') +
                (v ? '<label class="field">Observaciones<textarea data-bind="captura.obs" placeholder="Condiciones, notas...">' + esc(c.obs) + '</textarea></label>' : '') +
                (v ? '<button type="button" class="btn-guardar ' + (esRiego ? 'riego' : 'apli') + '" data-action="cap-guardar">' + etiquetaGuardar + '</button>' : '') +
                '</div>' +
                '</div>' +
            '</div>';
    }

    function camposRiego(c, previos, cat) {
        return '' + 
            (previos.length ? '<div class="notice err"><b>Ya guardaste un riego en este vivero para esta fecha (' + horaDe(previos[0].marca_temporal) + ').</b><br>¿Es un segundo riego? Si no, cambia de vivero o de fecha.</div>' : '') +
            '<label class="field">Fecha del riego<input type="date" data-bind="captura.fecha" value="' + c.fecha + '" max="' + aISO(hoy()) + '"></label>' +
            '<div class="field">¿Riego efectivo?<div class="seg" role="group" aria-label="¿Riego efectivo?">' +
                '<button type="button" class="si" data-action="cap-set" data-campo="efectivo" data-valor="SI" aria-pressed="' + (c.efectivo === 'SI') + '">Sí</button>' +
                '<button type="button" class="no" data-action="cap-set" data-campo="efectivo" data-valor="NO" aria-pressed="' + (c.efectivo === 'NO') + '">No</button>' +
            '</div></div>' +
            (c.efectivo === 'SI' ? '<div class="field">Tipo de riego<div class="chips">' + cat.tiposRiego.map(function (t){
                return '<button type="button" data-action="cap-set" data-campo="tipoRiego" data-valor="' + esc(t) + '" aria-pressed="' + (c.tipoRiego === t) + '">' + esc(t) + '</button>';
            }).join('') + '</div></div>' : '') +
            (c.efectivo === 'NO' ? '<label class="field">Razón por la que no se regó (obligatoria)<select data-bind="captura.razon"><option value="">- Selecciona -</option>' + opciones(cat.razonesRiegoNo, c.razon) + '</select></label>' : '');
    }

    function camposAplicacion(c, v, cat) {
        var plan = planVigente('aplicaciones', v.lugar, v.temporada);
        var hechas = aplicacionesHechas(v.id);
        var filas = plan ? plan.filas : [];
        var sel = filas.filter(function (f) { return String(f.num) === String(c.planNum); })[0];
        var esExtra = c.planNum === 'EXTRA';
        var info = '';
        if (sel) {
            var s = deISO(v.fecha_siembra), ini = sumarDias(s, sel.dds_inicio), fin = sumarDias(s, sel.dds_fin);
            info = '<div class="plan-info"><b>' + esc(sel.dds_ventana) + '</b> · Etapa <b>' + esc(sel.etapa) + '</b> · ' + esc(sel.categoria) +
                '<br>Producto: <b>' + esc(sel.producto) + '</b><br>Dosis: <b>' + esc(sel.dosis) + '</b>' +
                '<br>Ventana: <b>' + (sel.dds_inicio === sel.dds_fin ? ddmm(ini) : ddmm(ini) + ' - ' + ddmm(fin)) + '</b> (hoy ' + ddsDe(v) + ' DDS)' +
                (sel.observacion ? '<br><span style="color:var(--warn-fg);font-weight:700">' + esc(sel.observacion) + '</span>' : '') + '</div>';
        }
        return '' +
            (plan ? '' : '<div class="notice warn">No hay plan vigente para ' + esc(v.lugar + ' ' + v.temporada) + '. Solo se pueden registrar aplicaciones extra.</div>') +
            '<label class="field">Aplicación del plan<select data-bind="captura.planNum"><option value="">- Selecciona -</option>' +
                filas.map(function (f) {
                    var hecha = hechas.indexOf(String(f.num)) >= 0;
                    return '<option value="' + f.num + '"' + (String(c.planNum) === String(f.num) ? ' selected' : '') + '>#' + f.num + ' · ' + esc(f.etapa) + ' · ' + esc(f.producto)  + (hecha ? ' (ya registrada)' : '') + '</option>';
                }).join('') +
                '<option value="EXTRA"' + (esExtra ? ' selected' : '') + '>Aplicación extra (fuera de plan)</option></select></label>' +
            info +
            (sel && hechas.indexOf(String(sel.num)) >= 0 ? '<div class="notice err"><b>Esta aplicación ya está registrada en este vivero.</b> Guardála solo si es una repetición.</div>' : '') +
            (esExtra ?
                '<label class="field">Etapa del cultivo<select data-bind="captura.extraEtapa"><option value="">- Selecciona -</option>' + opciones(cat.etapas, c.extraEtapa) + '</select></label>' +
                '<label class="field">Producto(s)<input type="text" data-bind="captura.extraProducto" value="' + esc(c.extraProducto) + '" placeholder="Ej: Amistar + Nativo"></label>' +
                '<label class="field">Dosis<input type="text" data-bind="captura.extraDosis" value="' + esc(c.extraDosis) + '" placeholder="Ej: 0.50 L/mz + 0.15 L/mz"></label>' : '') +
            '<div class="field">¿Se realizó?<div class="seg" role="group" aria-label="¿Se realizó?">' +
                ['SI', 'PARCIAL', 'NO'].map(function (o) {
                    return '<button type="button" class="' + o.toLowerCase() + '" data-action="cap-set" data-campo="realizado" data-valor="' + o + '" aria-pressed="' + (c.realizado === o) + '">' + (o === 'SI' ? 'Sí' : o === 'NO' ? 'No' : 'Parcial') + '</button>';
                }).join('') +
            '</div></div>' +
            (c.realizado && c.realizado !== 'NO' ? '<label class="field">Fecha real de aplicación<input type="date" data-bind="captura.fechaReal" value="' + c.fechaReal + '" max="' + aISO(hoy()) + '"></label>' : '') +
            (c.realizado === 'PARCIAL' && !esExtra ? '<label class="field">¿Qué cambió vs el plan? (dosis o producto)<input type="text" data-bind="captura.cambio" value="' + esc(c.cambio) + '" placeholder="Ej: no se aplicó Vayego"></label>' : '') +
            (c.realizado === 'NO' ? '<label class="field">Razón por la cual no se realizó (obligatoria)<select data-bind="captura.razon"><option value="">- Selecciona -</option>' + opciones(cat.razonesAplicacionNo, c.razon) + '</select></label>' : ''); 
    }

    function guardarCaptura() {
        var c = estado.captura, v = viveroPorId(c.viveroId), hoyISO = aISO(hoy());
        if (!v) return toast('Elige el vivero', true);
        if (c.modo === 'riego') {
            if (!c.fecha) return toast('Indica la fecha del riego', true);
            if (c.fecha > hoyISO) return toast('La fecha no puede ser futura', true);
            if (!c.efectivo) return toast('Indica si el riego fue efectivo',true);
            if (c.efectivo === 'SI' && !c.tipoRiego) return toast('Elige el tipo de riego', true);
            if (c.efectivo === 'NO' && !c.razon) return toast('La razón es obligatoria cuando no se regó', true);
            // SUPABASE: insert en registro_riegos con submission_id (UUID) único.
            D.registro_riegos.push({ vivero_id: v.id, fecha_riego: c.fecha, riego_efectivo: c.efectivo, tipo_riego: c.tipoRiego,
                razon_no: c.razon, marca_temporal: marcaAhora(), submission_id: nuevoId() });
        } else {
            if (!c.planNum) return toast('Elige la aplicación', true);
            if (c.planNum === 'EXTRA' && (!c.extraEtapa || !c.extraProducto.trim())) return toast('Indica etapa y producto de la aplicación extra', true);
            if (!c.realizado) return toast('Indica si se realizó',true);
            if (c.realizado !== 'NO' && !c.fechaReal) return toast('Indica la fecha real', true);
            if (c.realizado !== 'NO' && c.fechaReal > hoyISO) return toast('La fecha no puede ser futura', true);
            if (c.realizado === 'PARCIAL' && c.planNum !== 'EXTRA' && !c.cambio.trim()) return toast('Indica qué cambió vs el plan', true);
            if (c.realizado === 'NO' && !c.razon) return toast('La razón es obligatoria cuando no se realizó', true);
            //SUPABASE: insert en registro_aplicaciones con submission_id (UUID) único
            D.registro_aplicaciones.push({ vivero_id: v.id, num_aplicacion: String(c.planNum), realizado: c.realizado,
                fecha_real: c.realizado === 'NO' ? null : c.fechaReal, marca_temporal: marcaAhora(), submission_id: nuevoId() });
        }
        if (!estado.enLinea) D.pendientesEnvio++;
        toast(estado.enLinea ? 'Registro guardado' : 'Guardado en el dispositivo; se enviará al volver la señal');
        // Se limpia TODO, incluido el vivero, para que no se repita el mismo registro por accidente.
        estado.captura = nuevaCaptura(c.modo);
        render();
        window.scrollTo(0, 0);
    }
    function nuevoId() {
        return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    //-------------------------------------------------------------
    // NAVEGACIÓN Y EVENTOS
    //-------------------------------------------------------------
    var rutas = { panel: renderPanel, planes: renderPlanes, sync: renderSync, captura: renderCaptura };
    function rutaActual() {
        var r = (location.hash || '').replace(/^#\/?/, '');
        return rutas[r] ? r : 'panel';
    }
    function render() {
        var r = rutaActual();
        vista.innerHTML = rutas[r]();
        document.querySelectorAll('.nav-links a').forEach(function (a) {
            var activo = a.getAttribute('data-route') === r;
            a.classList.toggle('activo', activo);
            if (activo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
        enlazarDropzone();
    }

    function asignar(ruta, valor) {
        var partes = ruta.split('.'), obj = estado;
        for (var i = 0; i < partes.length - 1; i++) obj = obj[partes[i]];
        obj[partes[partes.length - 1]] = valor;
    }

    //clics
    vista.addEventListener('click', function (e) {
        var el = e.target.closest('[data-action]');
        if (!el || el.tagName === 'INPUT') return;
        var acc = el.getAttribute('data-action'), val = el.getAttribute('data-valor');
        var c = estado.captura;
        switch (acc) {
            case 'plan-tipo' : estado.planes.tipo = val; estado.planes.archivo = null; estado.planes.filas = null; render(); break;
            case 'plan-ejemplo': e.preventDefault(); cargarArchivoPlan(); break;
            case 'plan-quitar': e.preventDefault(); estado.planes.archivo = null; estado.planes.filas = null; render(); break;
            case 'plan-plantilla': e.preventDefault(); descargarPlantilla(); break;
            case 'plan-publicar': toast('Diseño: aqui se guardaría la nueva versión en Supabase'); break;
            case 'plan-borrador': toast('Diseño: aquí se guardaría el borrador en Supabase'); break;
            case 'sync-ahora': toast('Diseño: aquí se llamaría a la Edge Function de sincronización'); break;
            case 'sync-accion': toast('Diseño: «' + val + '» para ' + el.getAttribute('data-vivero')); break;
            case 'cap-modo': estado.captura = nuevaCaptura(val); estado.captura.viveroId = c.viveroId; render(); break;
            case 'cap-vivero': c.viveroId = Number(val); c.planNum = ''; render(); break;
            case 'cap-set':
                var campo = el.getAttribute('data-campo');
                c[campo] = val;
                if (campo === 'efectivo') { c.tipoRiego = ''; c.razon = ''; }
                if (campo === 'realizado') { c.razon = ''; c.cambio = ''; }
                render(); break;
            case 'cap-guardar': guardarCaptura(); break;
        }
    });

    // Selects y fechas: cambian el estado y vuelven a dibujar 
    vista.addEventListener('change', function (e) {
        var el = e.target;
        if (el.getAttribute('data-action') === 'plan-archivo' && el.files && el.files[0]) { cargarArchivoPlan(el.files[0].name); return; }
        var b = el.getAttribute('data-bind');
        if (!b) return;
        asignar(b, el.value);
        if (b === 'planes.lugar' || b === 'planes.temporada') { estado.planes.archivo = null; estado.planes.filas = null; }
        if (el.tagName === 'SELECT' || el.type === 'date') render();
    });

    //texto libre: se guarda sin volver a dibujar (para no perder el foco)
    vista.addEventListener('input', function (e) {
        var el = e.target, b = el.getAttribute('data-bind');
        if (b && (el.tagName === 'TEXTAREA' || el.type === 'text')) asignar(b, el.value);
    });

    function enlazarDropzone() {
        var dz = document.getElementById('dropzone');
        if (!dz) return;
        ['dragenter', 'dragover'].forEach(function (ev) {
            dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('arrastrando'); });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('arrastrando'); });
        });
        dz.addEventListener('drop', function (e) {
            var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (f) cargarArchivoPlan(f.name);
        });
    }

    window.addEventListener('online', function () { estado.enLinea = true; if (rutaActual() === 'captura') render(); });
    window.addEventListener('offline', function () { estado.enLinea = false; if (rutaActual() === 'captura') render(); });
    window.addEventListener('hashchange', function () { render(); vista.focus(); window.scrollTo(0, 0); });

    document.getElementById('usuarioNombre').textContent = D.usuario.nombre;
    document.getElementById('usuarioRol').textContent = D.usuario.rol;
    render();  
})();