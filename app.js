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
    // Cada registro necesita un id para corregirlo o anularlo (en Supabase es submission_id).
    D.registro_riegos.concat(D.registro_aplicaciones).forEach(function (r) { if (!r.submission_id) r.submission_id = nuevoId(); });

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
    function ddmmaaaa(s) { var p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
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
        return aplicacionesValidas().filter(function (r) { return r.vivero_id === viveroId && r.realizado !== 'NO'; })
            .map(function (r) { return String(r.num_aplicacion); });
    }
    // Lo anulado no cuenta en ningún indicador ni se sube a BMS
    function riegosValidos() { return D.registro_riegos.filter(function (r) { return !r.anulado; }); }
    function aplicacionesValidas() { return D.registro_aplicaciones.filter(function (r) { return !r.anulado; }); }
    function estudioPorId(id) { return D.estudiosBMS.filter(function (e) { return e.study_dbid === id; })[0];}
    // Vivero que ya se usa un estudio en BMS (sin contar el que ya se está editando)
    function viveroConEstudio(studyId, exceptoId) {
        return D.viveros.filter(function (v) { return v.study_dbid === studyId && v.id !== exceptoId; })[0];
    }
    function porNombre(a, b) { return a.temporada === b.temporada ? a.nombre.localeCompare(b.nombre) : (a.temporada < b.temporada ? 1 : -1); }
    function riegosDe(viveroId, fechaISO) {
        return riegosValidos().filter(function (r) { return r.vivero_id === viveroId && r.fecha_riego === fechaISO; });
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
                vivero: v.nombre, viveroId: v.id, num: f.num, producto: f.producto, opcional: /opc/i.test(f.observacion),
                ventana: f.dds_ventana + ' · ' + (f.dds_inicio === f.dds_fin ? ddmm(ini) : ddmm(ini) + '-' + ddmm(fin)),
                estado: estado, diasAtraso: dds - f.dds_fin
            };
        });
    }

    // Cumplimiento de aplicaciones de un vivero
    // Cuenta las aplicaciones del plan cuya ventana ya empezó y que ya se hicieron o ya vencieron.
    // A tiempo = se hizo (SI O PARCIAL) entre el inicio y el fin de la ventana, con MARGEN_DIAS de tolerancia
    // Las opcionales que no se hicieron no cuentan en contra.
    var MARGEN_DIAS = 2;
    function cumplimientoAplicaciones(v) {
        var res = { evaluadas: 0, aTiempo: 0, fuera: 0, sinHacer: 0 };
        var plan = planVigente('aplicaciones', v.lugar, v.temporada);
        if (!plan) return res;
        var dds = ddsDe(v), siembra = deISO(v.fecha_siembra);
        var regs = aplicacionesValidas().filter(function (r) { return r.vivero_id === v.id; })
            .sort(function (a, b) { return a.marca_temporal < b.marca_temporal ? 1 : -1; });
        plan.filas.forEach(function (f) {
            if (f.dds_inicio > dds) return;                                 // todavía no empieza
            var reg = regs.filter(function (r) { return r.num_aplicacion === String(f.num); })[0]; //el más reciente
            var hecha = reg && reg.realizado !== 'NO';
            if (!hecha && dds <= f.dds_fin + MARGEN_DIAS) return;
            if (!hecha && /opc/i.test(f.observacion)) return;
            res.evaluadas ++;
            if (!hecha) { res.sinHacer++; return; }
            var d = diasEntre(siembra, deISO(reg.fecha_real));
            if (d >= f.dds_inicio  - MARGEN_DIAS && d <= f.dds_fin + MARGEN_DIAS) res.aTiempo++; else res.fuera++;
        });
        return res;
    }

    //----------- Estado de la interfaz ------------------------------------------
    var estado = {
        filtro: { temporada: '2026C', lugar: 'Centro Experimental', verCercanas: 'urgentes' },
        planes: { tipo: 'aplicaciones', lugar: 'Centro Experimental', temporada: '2026C', archivo: null, filas: null },
        captura: nuevaCaptura('riego'),
        capturaLugar: D.usuario.lugar || 'Todos',
        viveros: { temporada: '2026C', lugar: 'Todos', ver: 'activos', form: null },
        registros: nuevoFiltroRegistros(),
        enLinea: navigator.onLine
    };
    function nuevaCaptura(modo) {
        return { modo: modo, viveroId: null, fecha: aISO(hoy()), efectivo: '', tipoRiego: '', razon: '',
                 planNum: '', realizado: '', fechaReal: aISO(hoy()), cambio: '', cambioDosis: false, cambioProducto: false, extraEtapa: '', extraProducto: '', extraDosis: '', obs: ''};
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
        // Aplicaciones cercanas agrupadas por vivero: primero los que tienen atrasadas
        var grupos = viv.map(function (v) {
            var items = aplicacionesCercanas(v).sort(function (a, b) { return orden[a.estado] - orden[b.estado] || a.num - b.num; });
            var cuenta = { atrasada: 0, ventana: 0, proxima: 0 };
            items.forEach(function (c) { cuenta[c.estado]++; });
            return { v: v, items: items, cuenta: cuenta, cump: cumplimientoAplicaciones(v) }; 
        }).filter(function (g) { return g.items.length; })
          .sort(function (a,b) { return b.cuenta.atrasada - a.cuenta.atrasada || porNombre(a.v, b.v); });
        
        // Cumplimiento de aplicaciones de todos los viveros del filtro
        var totApli = { evaluadas: 0, aTiempo: 0 };
        viv.forEach(function (v) { var c = cumplimientoAplicaciones(v); totApli.evaluadas += c.evaluadas; totApli.aTiempo += c.aTiempo; });
        var pctApli = totApli.evaluadas ? Math.round(totApli.aTiempo / totApli.evaluadas * 100) : null;
        var claseApli = pctApli === null ? '' : pctApli >= 90 ? 'good' : pctApli < 75 ? 'bad' : 'warn'; // mismos umbrales que riego

        var riegosHoy = riegosValidos().filter(function (r) { return ids.indexOf(r.vivero_id) >=0 && r.fecha_riego === hoyISO; }).length;
        var apliHoy = aplicacionesValidas().filter(function (r) { return ids.indexOf(r.vivero_id) >= 0 && r.fecha_real === hoyISO; }).length;

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
            return { vivero: v.nombre, id: v.id, celdas: celdas };
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
                kpi('Cumplimiento de aplicaciones', pctApli === null ? '-' : pctApli + ' %',
                    totApli.aTiempo + ' de ' + totApli.evaluadas + ' a tiempo (±' + MARGEN_DIAS + ' días)', claseApli) +
                kpi('Cumplimiento de riego', cumplimiento, 'Últimos 7 días, justificados incluidos', claseRiego) +
            '</section>' +

            '<section class="row">' +
                '<div class="card grow-3">' +
                    '<div class="card-head"><h2>Aplicaciones del plan cercanas a hoy</h2>' +
                        '<div class="field-inline" style="align-items:center">' +
                            '<div class="seg">' + [['urgentes', 'Atrasadas y en ventana'], ['todas', 'Todas']].map(function (o) {
                                return '<button type="button" class="verde btn-sm" data-action="panel-cercanas" data-valor="' + o[0] + '" aria-pressed="' + (f.verCercanas === o[0]) + '">' + o[1] + '</button>';
                            }).join('') + '</div>' +
                            '<a href="#/planes">Ver plan vigente</a>' +
                        '</div></div>' +
                    avisosPlan.map(function (p) {
                        return '<div class="notice warn">' + (f.lugar === 'Todos' ? '<b>' + esc(p.lugar) + ':</b> ' : '') + esc(p.nota) + '</div>';
                    }).join('') +
                    (grupos.length ?
                        '<div class="table-wrap"><table style="min-width:520px"><thead><tr><th>#</th><th>Producto</th><th>Ventana</th><th>Estado</th></tr></thead><tbody>' +
                        grupos.map(function (g) {
                            var visibles = f.verCercanas === 'todas' ? g.items : g.items.filter(function (c) { return c.estado !== 'proxima'; });
                            var pct = g.cump.evaluadas ? Math.round(g.cump.aTiempo / g.cump.evaluadas * 100) + ' %' : '-';
                            var cab = '<tr class="fila-grupo"><td colspan="4"><a class="mono" href="#/vivero/' + g.v.id + '">' + esc(g.v.nombre) + '</a> ' +
                                (g.cuenta.atrasada ? '<span class="pill err">' + g.cuenta.atrasada + (g.cuenta.atrasada === 1 ? ' atrasada' : ' atrasadas') + '</span> ' : '') +
                                (g.cuenta.ventana ? '<span class="pill ok">' + g.cuenta.ventana + ' en ventana</span> ' : '') +
                                (g.cuenta.proxima && f.verCercanas !== 'todas' ? '<span class="kpi-sub">' + g.cuenta.proxima + (g.cuenta.proxima === 1 ? ' próxima' : ' próximas') + ' · </span>' : '') +
                                '<span class="kpi-sub">Cumplimiento ' + pct + '</span></td></tr>';
                            return cab + visibles.map(function (c) {
                                return '<tr><td>' + c.num + '</td><td>' + esc(c.producto) +
                                    (c.opcional ? ' <span class="pill warn">Opcional</span>' : '') + '</td><td style="white-space:nowrap">' + esc(c.ventana) +
                                    '</td><td>' + etiquetaEstado[c.estado](c) + '</td></tr>';
                            }).join('');
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
                            '<div><a href="#/registros" data-action="panel-problemas" data-tipo="ambos">Posibles duplicados bloqueados</a><b>' + D.duplicadosBloqueados + '</b></div>' +
                            '<div><a href="#/registros" data-action="panel-problemas" data-tipo="riego">Riegos «NO» sin motivo (7 días)</a><b>' + sinMotivo + '</b></div>' +
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
                    return '<div class="fila"><a class="mono" href="#/vivero/' + fr.id + '">' + esc(fr.vivero) + '</a>' +
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
                '<div class="card-head"><h2>3 · Revisión antes de publicar</h2>' +
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
                        return '<tr><td><a class="mono" href="#/vivero/' + v.id + '">' + esc(v.nombre) + '</a></td>' +
                            '<td class="kpi-sub">' + (v.study_dbid ? 'Estudio ' + v.study_dbid + ' · instancia confirmada' : 'Sin asignar') + '</td>' +
                            '<td>'  + (x.ap_filas ? x.ap_filas + ' filas' : '-') + '</td><td>' + (x.r_filas ? x.r_filas + ' filas' : '-') + '</td>' +
                            '<td><span class="pill ' + e.cls + '">' + e.txt + '</span>' + (x.error ? '<div class="kpi-sub" style="margin-top:4px">' + esc(x.error) + '</div>' : '') + '</td>' +
                            '<td style="text-align:right"><button type="button" class="btn btn-sm" data-action="sync-accion" data-valor="' + esc(e.accion) + '" data-vivero="' + esc(v.nombre) + '" data-id="' + v.id + '">' + e.accion + '</button></td></tr>';
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
    // PANTALLA 5 · VIVEROS
    // Alta, edición, activar/desactivar y vínculo exacto con el estudio de BMS.
    // --------------------------------------------------
    function formVivero(v) {
        return v ? { id: v.id, nombre: v.nombre, tipo: v.tipo, lugar: v.lugar, temporada: v.temporada,
                     fecha_siembra: v.fecha_siembra, activo: v.activo, study_dbid: v.study_dbid ? String(v.study_dbid) : '' }
                 : { id: null, nombre: '', tipo: 'Self', lugar: D.usuario.lugar || '', temporada: estado.viveros.temporada !== 'Todas' ? estado.viveros.temporada: '',
                     fecha_siembra: aISO(hoy()), activo: true, study_dbid: ''};
    }

    function renderViveros() {
        var f = estado.viveros;
        var temporadas = ['Todas'].concat(unicos(D.viveros.map(function (v) { return v.temporada; })).sort().reverse());
        var lugares = ['Todos'].concat(unicos(D.viveros.map(function (v) { return v.lugar; })));
        var lista = D.viveros.filter(function (v) {
            return (f.temporada === 'Todas' || v.temporada === f.temporada) && (f.lugar === 'Todos' || v.lugar === f.lugar) &&
                (f.ver === 'todos' || (f.ver === 'activos') === v.activo);
        }).sort(porNombre);
        var sinVincular = lista.filter(function (v) { return v.activo && !v.study_dbid; });

        return '' +
            '<header class="page-head">' +
                '<div><div class="eyebrow">Viveros · datos de ejemplo</div><h1>Viveros</h1>' +
                    '<p class="lead">Da de alta los viveros de cada temporada y vincúlalos con su estudio de BMS. La subida nocturna usa ese número exacto, ya no busca por nombre.</p></div>' +
                '<button type="button" class="btn btn-primary" data-action="viv-nuevo">+ Nuevo vivero</button>' +
            '</header>' +

            (f.form ? formularioVivero(f.form) : '') +

            '<section class="card">' +
                '<div class="card-head">' +
                    '<div class="field-inline">' +
                        '<label class="field">Temporada<select data-bind="viveros.temporada">' + opciones(temporadas, f.temporada) + '</select></label>' +
                        '<label class="field">Lugar<select data-bind="viveros.lugar">' + opciones(lugares, f.lugar) + '</select></label>' +
                        '<div class="field">Mostrar<div class="seg">' +
                            [['activos', 'Activos'], ['inactivos', 'Inactivos'], ['todos', 'Todos']].map(function (o) {
                                return '<button type="button" class="verde" data-action="viv-ver" data-valor="' + o[0] + '" aria-pressed="' + (f.ver === o[0]) + '">' + o[1] + '</button>';
                            }).join('') +
                        '</div></div>' +
                    '</div>' +
                    '<span class="kpi-sub">' + lista.length + ' vivero(s)</span>' +
                '</div>' +
                (sinVincular.length ? '<div class="notice warn"><b>' + sinVincular.length + ' vivero(s) activo(s) sin estudio de BMS.</b> No se subirán a BMS hasta vincularlos: ' +
                    sinVincular.map(function (v) { return esc(v.nombre); }).join(', ') + '.</div>' : '') +
                (lista.length ?
                    '<div class="table-wrap"><table style="min-width:760px"><thead><tr><th>Vivero</th><th>Siembra</th><th>Estudio en BMS</th><th>Estado</th><th><span class="oculto">Acciones</span></th></tr></thead><tbody>' +
                    lista.map(function (v) {
                        var e = v.study_dbid ? estudioPorId(v.study_dbid) : null;
                        return '<tr' + (v.activo ? '' : ' class="fila-inactiva"') + '>' +
                            '<td><a class="mono" style="font-weight:500" href="#/vivero/' + v.id + '">' + esc(v.nombre) + '</a><div class="kpi-sub">' + esc(v.tipo + ' · ' + v.lugar + ' · ' + v.temporada) + '</div></td>' +
                            '<td style="white-space:nowrap">' + esc(ddmmaaaa(v.fecha_siembra)) + '<div class="kpi-sub">' + ddsDe(v) + ' DDS</div></td>' +
                            '<td>' + (v.study_dbid 
                                ? '<span class="pill ok">Estudio ' + v.study_dbid + '</span>' + (e && e.nombre !== v.nombre ? '<div class="kpi-sub" style="margin-top:4px">En BMS: ' + esc(e.nombre) + '</div>' : '')
                                : '<span class="pill warn">Sin vincular</span>') + '</td>' +
                            '<td>' + (v.activo ? '<span class="pill ok">Activo</span>' : '<span class="pill info">Inactivo</span>') + '</td>' +
                            '<td style="text-align:right;white-space:nowrap">' +
                                '<button type="button" class="btn btn-sm" data-action="viv-editar" data-valor="' + v.id + '">' + (v.study_dbid ? 'Editar' : 'Vincular') + '</button> ' +
                                '<button type="button" class="btn btn-sm" data-action="viv-activo" data-valor="' + v.id + '">' + (v.activo ? 'Desactivar' : 'Activar') + '</button>' +
                            '</td></tr>';
                        }).join('') + '</tbody></table></div>'
                        : '<div class="notice muted">No hay viveros con este filtro.</div>') +
                    '</section>';
    }

    function formularioVivero(fv) { 
        var cat = D.catalogos;
        var lugares = unicos(D.viveros.map(function (v) { return v.lugar; }));
        var estudios = D.estudiosBMS.filter(function (e) { return !fv.temporada || e.temporada === fv.temporada; });
        var elegido = fv.study_dbid ? estudioPorId(Number(fv.study_dbid)): null;
        var dds = fv.fecha_siembra ? diasEntre(deISO(fv.fecha_siembra), hoy()) : null;

        return '<section class="card form-vivero">' +
            '<div class="card-head"><h2>' + (fv.id ? 'Editar vivero' : 'Nuevo vivero') + '</h2>' +
                '<button type="button" class="btn btn-sm" data-action="viv-cancelar">Cancelar</button></div>' +
            '<div class="grid-form">' +
                '<label class="field ancho">Nombre del vivero<input type="text" data-bind="viveros.form.nombre" value="' + esc(fv.nombre) + '" placeholder="Ej: 12_VIVERO_SELF_2026C_6" autocomplete="off"></label>' +
                '<div class="field">Tipo<div class="seg">' + cat.tiposVivero.map(function (t) {
                    return '<button type="button" class="verde" data-action="viv-tipo" data-valor="' + esc(t) + '" aria-pressed="' + (fv.tipo === t) + '">' + esc(t) + '</button>';
                }).join('') + '</div></div>' +
                '<label class="field">Lugar<select data-bind="viveros.form.lugar">' + opciones(lugares, fv.lugar) + '</select></label>' +
                '<label class="field">Temporada<input type="text" data-bind="viveros.form.temporada" value="' + esc(fv.temporada) + '" placeholder="Ej: 2026C" maxlength="5"></label>' +
                '<label class="field">Fecha de siembra<input type="date" data-bind="viveros.form.fecha_siembra" value="' + esc(fv.fecha_siembra) + '" max="' + aISO(hoy()) + '">' +
                    '<span class="kpi-sub" style="font-weight:400">' + (dds !== null && dds >= 0 ? 'Hoy: ' + dds + ' DDS' : '') + '</span></label>' +
                '<div class="field">¿Activo?<div class="seg">' +
                    '<button type="button" class="si" data-action="viv-form-activo" data-valor="1" aria-pressed="' + fv.activo + '">Sí</button>' +
                    '<button type="button" class="no" data-action="viv-form-activo" data-valor="0" aria-pressed="' + !fv.activo + '">No</button>' +
                '</div></div>' +
                '<label class="field ancho">Estudio en BMS<select data-bind="viveros.form.study_dbid"><option value="">- Sin vincular por ahora -</option>' +
                    estudios.map(function (e) {
                        var usado = viveroConEstudio(e.study_dbid, fv.id);
                        return '<option value="' + e.study_dbid + '"' + (String(e.study_dbid) === fv.study_dbid ? ' selected' : '') + (usado ? ' disabled' : '') + '>' +
                            e.study_dbid + ' · ' + esc(e.nombre) + (usado ? ' (ya vinculado a ' + esc(usado.nombre) + ')' : '') + '</option>';
                    }).join('') + '</select>' +
                    '<span class="kpi-sub" style="font-weight:400">Elige el estudio exacto. Solo se muestran los de la temporada ' + esc(fv.temporada || '') + '.</span></label>' +
                '</div>' +
                (elegido && elegido.nombre !== fv.nombre.trim() ? '<div class="notice warn">El estudio elegido se llama <b>' + esc(elegido.nombre) + '</b> en BMS y el vivero <b>' + esc(fv.nombre || '(sin nombre)') + '</b>. Verifica que sea correcto antes de guardar.' +
                    '<div style="margin-top:8px"><button type="button" class="btn btn-sm" data-action="viv-usar-nombre-bms">Usar el nombre de BMS</button></div></div>': '') +
                (elegido && elegido.nombre === fv.nombre.trim() ? '<div class="notice muted">✓ El nombre coincide con el estudio de BMS.</div>' : '') +
                '<div class="field-inline"><button type="button" class="btn btn-primary" data-action="viv-guardar">' + (fv.id ? 'Guardar cambios' : 'Crear vivero') + '</button></div>' +
            '</section>';
    }

    function guardarVivero() {
        var fv = estado.viveros.form;
        var nombre = fv.nombre.trim(), temporada = fv.temporada.trim().toUpperCase();
        if (!nombre) return toast('Escribe el nombre del vivero', true);
        if (!/^\d{4}[A-Z]$/.test(temporada)) return toast('La temporada debe tener el formato 2026C', true);
        if (!fv.lugar) return toast('Elige el lugar', true);
        if (!fv.fecha_siembra) return toast('Indica la fecha de siembra', true);
        if (fv.fecha_siembra > aISO(hoy())) return toast('La fecha de siembra no puede ser futura', true);
        var repetido = D.viveros.filter(function (v) { return v.id !== fv.id && v.temporada === temporada && v.nombre.toLowerCase() === nombre.toLowerCase(); })[0];
        if (repetido) return toast('Ya existe un vivero con ese nombre ' + temporada, true);
        var study = fv.study_dbid ? Number(fv.study_dbid) : null;
        if (study && viveroConEstudio(study, fv.id)) return toast('Ese estudio de BMS ya está vinculado a otro vivero', true);

        var datos = { nombre: nombre, tipo: fv.tipo, lugar: fv.lugar, temporada: temporada, fecha_siembra: fv.fecha_siembra, activo: fv.activo, study_dbid: study };
        if (fv.id){
            // SUPABASE: update viveros set ... where id = fv.id
            Object.assign(viveroPorId(fv.id), datos);
            toast('Vivero actualizado');
        } else {
            //SUPABASE: insert into viveros (...) returning id
            datos.id = D.viveros.reduce(function (m, v) { return Math.max(m, v.id); }, 0) + 1;
            D.viveros.push(datos);
            toast('Vivero creado' + (study ? '' : ' · recuerda vincularlo con BMS'));
        }
        estado.viveros.form = null;
        render();
     }

     // -------------------------------------------------------------
     // PANTALLA 6 · DETALLE DE UN VIVERO (#/vivero/ID)
     // Avance contra el plan, riegos, registros y última subida a BMS.
     // -------------------------------------------------------------
    function renderDetalleVivero() {
        var v = viveroPorId(idDeRuta());
        if (!v) return '<div class="notice warn">No se encontró el vivero. <a href="#/viveros">Volver a Viveros</a></div>';

        var dds = ddsDe(v), siembra = deISO(v.fecha_siembra);
        var plan = planVigente('aplicaciones', v.lugar, v.temporada);
        var e = v.study_dbid ? estudioPorId(v.study_dbid) : null;
        function masReciente(a, b) { return a.marca_temporal < b.marca_temporal ? 1 : -1; }

        // SUPABASE: select * from registro_aplicaciones / registro_riegos where vivero_id = v.id order by marca_temporal desc
        var regsApli = aplicacionesValidas().filter(function (r) { return r.vivero_id === v.id; }).sort(masReciente);
        var regsRiego = riegosValidos().filter(function (r) { return r.vivero_id === v.id; }).sort(masReciente);


        // ---- Avance contra el plan: estado de cada aplicación ----
        var filasPlan = (plan ? plan.filas.slice() : [])
            .sort(function (a, b) { return a.dds_inicio - b.dds_inicio || a.num - b.num; })
            .map(function (f) {
                var reg = regsApli.filter(function (r) { return r.num_aplicacion === String(f.num); })[0]; // el más reciente
                var est = reg ? { SI: 'hecha', PARCIAL: 'parcial', NO: 'no' }[reg.realizado]
                    : dds > f.dds_fin ? 'atrasada' : dds >= f.dds_inicio ? 'ventana' : 'proxima';
                return { f: f, reg: reg, est: est }; 
            });
                // Mismo cumplimiento de aplicaciones que el Panel
        var cump = cumplimientoAplicaciones(v);
        var pctApli = cump.evaluadas ? Math.round(cump.aTiempo / cump.evaluadas * 100) : null;
        var claseApli = pctApli === null ? '' : pctApli >= 90 ? 'good' : pctApli < 75 ? 'bad' : 'warn';
        var atrasadas = filasPlan.filter(function (x) { return x.est === 'atrasada'; }).length;

        function pillPlan(x) {
            if (x.est === 'hecha') return '<span class="pill ok">Hecha · ' + ddmm(deISO(x.reg.fecha_real)) + '</span>';
            if (x.est === 'parcial') return '<span class="pill warn">Parcial · ' + ddmm(deISO(x.reg.fecha_real)) + '</span>';
            if (x.est === 'no') return '<span class="pill err">No realizada</span>';
            if (x.est === 'atrasada') { var n = dds - x.f.dds_fin; return '<span class="pill err">Atrasada ' + n + (n=== 1 ? ' día' : ' días') + '</span>'; }
            if (x.est === 'ventana') return '<span class="pill ok">En ventana</span>';
            return '<span class="kpi-sub">Próxima</span>';
        }
        var marcaHoy = '<div class="hoy">Hoy · ' + dds + ' DDS</div>', marcaPuesta = false;
        var lineas = filasPlan.map(function (x) {
            var f = x.f, ini = sumarDias(siembra, f.dds_inicio), fin = sumarDias(siembra, f.dds_fin);
            var antes = '';
            if (!marcaPuesta && f.dds_inicio > dds) { marcaPuesta = true; antes = marcaHoy; }
            return antes + '<div><b>#' + f.num + '</b><span>' + esc(f.producto) + 
                (/opc/i.test(f.observacion) ? ' <span class="pill warn">Opcional</span>' : '') +
                '<small>' + esc(f.dds_ventana + ' · ' + f.etapa) + ' · ' + (f.dds_inicio === f.dds_fin ? ddmm(ini) : ddmm(ini) + '-' + ddmm(fin)) + '</small></span>' +
                pillPlan(x) + '</div>'; 
        }).join('') + (marcaPuesta ? '' : marcaHoy);

        // ---- Riegos: últimos 28 días (o desde la siembra si es más reciente) ----
        var desde = sumarDias(hoy(), -27);
        if (siembra > desde) desde = siembra;
        var diasR = [];
        for (var d = desde; d <= hoy(); d = sumarDias(d, 1)) diasR.push(d);
        var letras = { S: 'Sí', J: 'J', N: 'No', X: '-' };
        var conDato = 0, cumplidos = 0;
        var celdas = diasR.map(function (d) {
            var est = estadoRiegoDia(v.id, aISO(d));
            if (est !== 'X') conDato++;
            if (est === 'S' || est === 'J') cumplidos++;
            return '<div class="dia"><small>' + diaCorto(d) + '</small><span class="celda ' + est + '">' + letras[est] + '</span></div>';
        }).join('');
        var pct = conDato ? Math.round(cumplidos / conDato * 100) : null;
        var claseRiego = pct === null ? '' : pct >= 90 ? 'good' : pct < 75 ? 'bad' : 'warn'; // mismos umbrales que el Panel

        // --- Tablas de registros (los 15 más recientes; el historial completo será B.4) ----
        var tablaRiegos = regsRiego.length
            ? '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Efectivo</th><th>Detalle</th><th>Hora</th></tr></thead><tbody>' +
                regsRiego.slice(0, 15).map(function (r) {
                    return '<tr><td style="white-space:nowrap">' + ddmm(deISO(r.fecha_riego)) + '</td><td>' +
                        (r.riego_efectivo === 'SI' ? '<span class="pill ok">Sí</span>' : '<span class="pill err">No</span>') + '</td><td>' +
                        esc(r.riego_efectivo === 'SI' ? r.tipo_riego : (r.razon_no || 'Sin motivo')) + '</td><td class="mono">' + horaDe(r.marca_temporal) + '</td></tr>';
                }).join('') + '</tbody></table></div>'
            : '<div class="notice muted">Sin riegos registrados.</div>';
        
        var porNum = {};
        (plan ? plan.filas : []).forEach(function (f) { porNum[String(f.num)] = f; });
        var tablaApli = regsApli.length
                ? '<div class="table-wrap"><table><thead><tr><th>#</th><th>Producto</th><th>Realizado</th><th>Fecha</th></tr></thead><tbody>' +
                    regsApli.slice(0, 15).map(function (r) {
                        var f = porNum[r.num_aplicacion];
                        var cls = { SI: 'ok', PARCIAL: 'warn', NO: 'err' }[r.realizado], txt = { SI: 'Sí', PARCIAL: 'Parcial', NO: 'No'}[r.realizado];
                        return '<tr><td><b>' + (r.num_aplicacion === 'EXTRA' ? 'Extra' : esc(r.num_aplicacion)) + '</b></td><td>' + esc(f ? f.producto : 'Fuera de plan') + '</td>' +
                            '<td><span class="pill ' + cls + '">' + txt + '</span></td><td style="white-space:nowrap">' + (r.fecha_real ? ddmm(deISO(r.fecha_real)):  '-') + '</td></tr>';
                    }).join('') + '</tbody></table></div>'
                : '<div class="notice muted">Sin aplicaciones registradas.</div>';

        // ---- Última subida a BMS ---
        var sync = D.sync.resultados.filter(function (x) { return x.vivero_id === v.id; })[0];
        var estSync = { ok: ['ok', 'Subido'], error: ['err', 'Falló'], sin_vincular: ['warn','Sin estudio vinculado'] };

        return '' +
            '<header class="page-head">' +
                '<div><div class="eyebrow"><a href="#/viveros">Viveros</a> · ' + esc(v.lugar + ' · ' + v.temporada) + '</div>' +
                    '<h1 class="titulo-vivero">' + esc(v.nombre) + '</h1>' +
                    '<p class="lead">' + esc(v.tipo) + ' · siembra ' + ddmmaaaa(v.fecha_siembra) + '  · ' + dds + ' DDS · ' +
                        (v.study_dbid ? 'Estudio BMS ' + v.study_dbid + (e && e.nombre !== v.nombre ? ' (en BMS: ' + esc(e.nombre) + ')' : '')
                                        : '<b style="color:var(--warn-fg)">Sin estudio en BMS</b>') +
                        (v.activo ?  '' : ' · <b>Inactivo</b>') + '</p></div>' +
                (v.activo
                    ? '<div class="field-inline det-botones">' +
                        (v.study_dbid ? '' : '<button type="button" class="btn" data-action="sync-accion" data-valor="Vincular" data-id="' + v.id + '" data-vivero="' + esc(v.nombre) + '">Vincular con BMS</button>') +
                        '<button type="button" class="btn btn-blue" data-action="det-capturar" data-modo="riego" data-valor="' + v.id + '">Registrar riego</button>' +
                        '<button type="button" class="btn btn-primary" data-action="det-capturar" data-modo="apli" data-valor="' + v.id + '">Registrar aplicación</button>' +
                    '</div>'
                :   '<div class="notice muted">Vivero inactivo: actívalo en Viveros para registrar.</div>') +
            '</header>' +

            '<section class="kpis" aria-label="Indicadores del vivero">' +
                kpi('Días desde la siembra', dds +  ' DDS', 'Siembra ' + ddmmaaaa(v.fecha_siembra), '') +
                kpi('Cumplimiento de aplicaciones', pctApli === null ? '-' : pctApli + ' %',
                    plan ? cump.aTiempo + ' de ' + cump.evaluadas + ' a tiempo (±' + MARGEN_DIAS + ' días)' : 'Sin plan vigente', claseApli) +
                kpi('Aplicaciones atrasadas', atrasadas, 'Fuera de la ventana del plan', atrasadas ? 'bad' : 'good') + 
                kpi('Cumplimiento de riego', pct === null ? '-' : pct + ' %', 'Últimos ' + diasR.length + ' días, justificados incluidos', claseRiego) +
            '</section>' +

            '<section class="row">' + 
                '<div class="card grow-3">' +
                    '<div class="card-head"><h2>Avance contra el plan</h2>' +
                        (plan ? '<span class="kpi-sub">Plan ' + esc(v.lugar + ' ' + v.temporada) + ' · versión ' + plan.version + '</span>' : '') + '</div>' +
                    (plan ? '<div class="plan-linea">' + lineas + '</div>' 
                        : '<div class="notice warn">No hay plan vigente para ' + esc(v.lugar + ' ' + v.temporada) + '.</div>') +
                    '</div>' +
                    '<div class="stack grow-2">' +
                        '<div class="card"><div class="card-head"><h2>Riegos</h2><span class="kpi-sub">Últimos ' + diasR.length + ' días</span></div>' +
                            '<div class="riegos-vivero">' + celdas + '</div></div>' +
                    '<div class="card"><h2>Última subida a BMS</h2>' +
                        (sync
                            ?   '<div><span class="pill ' + estSync[sync.estado][0] + '">' + estSync[sync.estado][1] + '</span></div>' +
                                '<div class="lista-simple">' +
                                    '<div><span>Corrida</span><b>Hoy ' + D.sync.corrida.hora + '</b></div>' +
                                    '<div><span>Aplicaciones</span><b>' + (sync.ap_filas || 0) + ' filas</b></div>' +
                                    '<div><span>Riegos</span><b>' + (sync.r_filas || 0) + ' filas</b></div>' +
                                '</div>' +
                                (sync.error ? '<div class="notice err">' + esc(sync.error) + '</div>' : '')
                            :   '<div class="kpi-sub">Todavía no ha entrado en una corrida.</div>') +
                    '</div>' +
                '</div>' +
            '</section>' +

            '<section class="row">' +
                '<div class="card grow-1"><div class="card-head"><h2>Riegos registrados</h2><a href="#/registros" data-action="reg-ver-vivero" data-valor="' + v.id + '" data-tipo="riego">Ver todos</a></div>' + tablaRiegos + '</div>' +
                '<div class="card grow-1"><div class="card-head"><h2>Aplicaciones registradas</h2><a href="#/registros" data-action="reg-ver-vivero" data-valor="' + v.id + '" data-tipo="apli">Ver todos</a></div>' + tablaApli + '</div>' +
            '</section>';                        
    }
    
    // --------------------------------------------------
    // PANTALLA 7 · HISTORIAL DE REGISTROS (#/registros)
    // Buscar, filtrar, corregir y anular. Nada se borra: lo anulado queda con su motivo
    // --------------------------------------------------
    function nuevoFiltroRegistros() {
        return { tipo: 'ambos', viveroId: '', lugar: 'Todos', desde: aISO(sumarDias(hoy(), -13)), hasta: aISO(hoy()),
                 ver: 'todos', problemas: false, texto: '', editando: null, anulando: null, form: null, motivo: '', motivoDetalle: '' };
    }
    function cerrarFormsRegistro() {
        var f = estado.registros;
        f.editando = null; f.anulando = null; f.form = null; f.motivo = ''; f.motivoDetalle = '';
    }
    // Busca un registro (riego o aplicación) por su submission_id
    function buscarRegistro(id) {
        var r = D.registro_riegos.filter(function (x) { return x.submission_id === id; })[0];
        if (r) return { t: 'riego', r: r };
        r = D.registro_aplicaciones.filter(function (x) { return x.submission_id === id; })[0];
        return r ? { t: 'apli', r: r } : null;
    }
    function resumenRegistro(x) {
        var r = x.r;
        if (x.t === 'riego') return r.riego_efectivo === 'SI' ? 'Sí · ' + (r.tipo_riego || '') : 'No · ' + (r.razon_no || 'sin motivo');
        var txt = { SI: 'Sí', PARCIAL: 'Parcial', NO: 'No' }[r.realizado];
        if (r.realizado === 'NO') return txt + ' · ' + (r.razon_no || 'sin motivo');
        if (r.realizado === 'PARCIAL') return txt + ' · ' + (r.cambio || 'sin cambio anotado');
        return txt; 
    }
    function queAplicacion(r, v) {
        if (r.num_aplicacion === 'EXTRA') return 'EXTRA · ' + (r.extra_producto || 'fuera de plan');
        var plan = planVigente('aplicaciones', v.lugar, v.temporada);
        var f = plan ? plan.filas.filter(function (f) { return String(f.num) === r.num_aplicacion; })[0] : null;
        return '#' + r.num_aplicacion + (f ? ' · ' + f.producto : '');
    }
    // Problemas que vale la pena revisar (solo en registros no anulados)
    function problemaDe(x) {
        var r = x.r;
        if (r.anulado) return '';
        if (x.t === 'riego') {
            if (r.riego_efectivo === 'NO' && !r.razon_no) return 'NO sin motivo';
            if (riegosDe(r.vivero_id, r.fecha_riego).length > 1) return 'Posible duplicado';
        } else {
            if (r.realizado === 'PARCIAL' && r.num_aplicacion !== 'EXTRA' && !r.cambio) return 'Parcial sin cambio anotado';
            if (r.num_aplicacion !== 'EXTRA' && r.realizado !== 'NO' && aplicacionesValidas().filter(function (o) {
                return o.vivero_id === r.vivero_id && o.num_aplicacion === r.num_aplicacion && o.realizado !== 'NO';
            }). length > 1) return 'Posible duplicado';
        }
        return '';
    }

    function renderRegistros() {
        var f = estado.registros;
        var lugares = ['Todos'].concat(unicos(D.viveros.map(function (v) { return v.lugar; })));
        var texto = f.texto.trim().toLowerCase();

        // SUPABASE: dos consultas (registros_riegos y registros_aplicaciones) con los mismos filtros, unidas aquí
        var lista = [];
        D.registro_riegos.forEach(function (r) { lista.push({ t: 'riego', r: r, fecha: r.fecha_riego }); });
        D.registro_aplicaciones.forEach(function (r) { lista.push({ t: 'apli', r: r, fecha: r.fecha_real || String(r.marca_temporal).slice(0, 10) }); });

        var todas = lista.filter(function (x) {
            var v = viveroPorId(x.r.vivero_id);
            if (!v) return false;
            x.v = v;
            x.problema = problemaDe(x);
            x.que = x.t === 'riego' ? 'Riego' : queAplicacion(x.r, v);
            x.resumen = resumenRegistro(x);
            if (f.tipo !== 'ambos' && x.t !== f.tipo) return false;
            if (f.viveroId && String(v.id) !== f.viveroId) return false;
            if (f.lugar !== 'Todos' && v.lugar !== f.lugar) return false;
            if (f.desde && x.fecha < f.desde) return false;
            if (f.hasta && x.fecha > f.hasta) return false;
            if (f.ver === 'vigentes' && x.r.anulado) return false;
            if (f.ver === 'anulados' && !x.r.anulado) return false;
            if (f.problemas && !x.problema) return false;
            if (texto && (v.nombre + ' ' + x.que + ' ' + x.resumen + ' ' + (x.r.observaciones || '') + ' ' + (x.r.motivo_anulacion || '')).toLowerCase().indexOf(texto) < 0) return false;
            return true;
        }).sort(function (a, b) {
            if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
            return a.r.marca_temporal < b.r.marca_temporal ? 1 : -1;
        });
        var conProblema = todas.filter(function (x) { return x.problema; }).length;

        var filas = todas.slice(0, 100).map(function (x) {
            var r = x.r, id = r.submission_id;
            var detalle = (x.t === 'apli' ? '<b>' + esc(x.que) + '</b><br>' : '') +
                '<span' + (r.anulado ? ' class="tachado"' : '') + '>' + esc(x.resumen) + '</span>' +
                (x.problema ? ' <span class="pill err">' + esc(x.problema) + '</span>' : '') +
                (r.observaciones ? '<div class="kpi-sub">' + esc(r.observaciones) + '</div>' : '') +
                (r.correcciones || []).map(function (c) {
                    return '<div class="kpi-sub">Corregido ' + ddmm(deISO(c.en.slice(0, 10))) + ' ' + horaDe(c.en) + ' por ' + esc(c.por) + ' · antes: ' + esc(c.antes) + '</div>';
                }).join('') +
                (r.anulado ? '<div style="margin-top:4px"><span class="pill err">Anulado</span> <span class="kpi-sub">' + esc(r.motivo_anulacion) +
                    ' · ' + esc(r.anulado_por) + ', ' + ddmm(deISO(r.anulado_en.slice(0, 10))) + ' ' + horaDe(r.anulado_en) + '</span></div>' : '');
            var acciones = r.anulado ? '' :
                '<button type="button" class="btn btn-sm" data-action="reg-corregir" data-valor="' + id + '">Corregir</button> ' +
                '<button type="button" class="btn btn-sm" data-action="reg-anular" data-valor="' + id + '">Anular</button>';
            return '<tr class="' + (r.anulado ? 'fila-anulada' : x.problema ? 'fila-err' : '') + '">' +
                '<td style="white-space:nowrap">' + ddmmaaaa(x.fecha) + '</td>' +
                '<td><a class="mono" href="#/vivero/' + x.v.id + '">' + esc(x.v.nombre) + '</a></td>' +
                '<td>' + (x.t == 'riego' ? '<span class="pill info">Riego</span>' : '<span class="pill ok">Aplicación</span>') + '</td>' +
                '<td>' + detalle + '</td>' +
                '<td class="mono" style="white-space:nowrap">' + ddmm(deISO(String(r.marca_temporal).slice(0, 10))) + ' ' + horaDe(r.marca_temporal) + '</td>' +
                '<td style="text-align:right;white-space:nowrap">' + acciones + '</td></tr>' +
                (f.editando === id ? formCorreccion(x) : '') +
                (f.anulando === id ? formAnulacion(): '');
        }).join('');

        return '' +
            '<header class="page-head"><div><div class="eyebrow">Registros · datos de ejemplo</div><h1>Historial de registros</h1>' +
                '<p class="lead">Busca, corrige o anula riegos y aplicaciones. Nada se borra: lo anulado queda tachado con su motivo, deja de contar y no se sube a BMS.</p></div></header>' +
            
                '<section class="card">' +
                    '<div class="filtros-registros">' +
                        '<label class="field">Vivero<select data-bind="registros.viveroId"><option value="">Todos</option>' +
                            D.viveros.slice().sort(porNombre).map(function (v) {
                                return '<option value="' + v.id + '"' + (String(v.id) === f.viveroId ? ' selected' : '') + '>' + esc(v.nombre) + '</option>';
                            }).join('') + '</select></label>' +
                        '<label class="field">Lugar<select data-bind="registros.lugar">' + opciones(lugares, f.lugar) + '</select></label>' +
                        '<label class="field">Desde<input type="date" data-bind="registros.desde" value="' + f.desde + '" max="' + aISO(hoy()) + '"></label>' +
                        '<label class="field">Hasta<input type="date" data-bind="registros.hasta" value="' + f.hasta + '" max="' + aISO(hoy()) + '"></label>' +
                        '<label class="field">Buscar<input type="text" data-bind="registros.texto" value="' + esc(f.texto) + '" placeholder="Producto, motivo... y Enter"></label>' +
                    '</div>' +
                    '<div class="card-head">' +
                        '<div class="field-inline">' +
                            '<div class="seg">' + [['ambos', 'Ambos'], ['riego', 'Riegos'], ['apli', 'Aplicaciones']].map(function (o){
                                return '<button type="button" class="verde" data-action="reg-tipo" data-valor="' + o[0] + '" aria-pressed="' + (f.tipo === o[0]) + '">' + o[1] + '</button>';
                            }).join('') + '</div>' +
                            '<div class="seg">' + [['todos', 'Todos'], ['vigentes', 'Vigentes'], ['anulados', 'Anulados']].map(function (o) {
                                return '<button type="button" class="verde" data-action="reg-ver" data-valor="' + o[0] + '" aria-pressed="' + (f.ver === o[0]) + '">' + o[1] + '</button>';
                            }).join('') + '</div>' +
                            '<button type="button" class="btn btn-filtro" data-action="reg-problemas" aria-pressed="' + f.problemas + '">Solo con problemas' + (conProblema ? ' (' + conProblema + ')' : '') + '</button>' +
                            '<button type="button" class="btn" data-action="reg-limpiar">Limpiar filtros</button>' +
                        '</div>' +
                        '<span class="kpi-sub">' + todas.length  + ' registro(s)' + (todas.length > 100 ? ' · se muestran los 100 más recientes' : '') + '</span>' +
                    '</div>' +
                    (todas.length
                        ? '<div class="table-wrap"><table style="min-width:860px"><thead><tr><th>Fecha</th><th>Vivero</th><th>Tipo</th><th>Detalle</th><th>Registrado</th><th><span class="oculto">Acciones</span></th></tr></thead><tbody>' +
                           filas + '</tbody></table></div>'
                        : '<div class="notice muted">No hay registros con estos filtros.</div>') +
                '</section>';
    }

    // Fila con el formulario de corrección, debjajo del registro
    function formCorreccion(x) {
        var fc = estado.registros.form, cat = D.catalogos, hoyISO = aISO(hoy());
        function boton(campo, valor, txt, cls) {
            return '<button type="button" class="' + cls + '" data-action="reg-set" data-campo="' + campo + '" data-valor="' + valor + '" aria-pressed="' + (fc[campo] === valor) + '">' + txt + '</button>';
        }
        var campos = x.t === 'riego'
            ? '<label class="field">Fecha del riego<input type="date" data-bind="registros.form.fecha" value="' + fc.fecha + '" max="' + hoyISO + '"></label>' +
              '<div class="field">¿Riego efectivo?<div class="seg">' + boton('efectivo', 'SI', 'Sí', 'si') + boton('efectivo', 'NO', 'No', 'no') + '</div></div>' +
              (fc.efectivo === 'SI' ? '<label class="field">Tipo de riego<select data-bind="registros.form.tipoRiego"><option value="">- Selecciona -</option>' + opciones(cat.tiposRiego, fc.tipoRiego) + '</select></label>' : '') +
              (fc.efectivo === 'NO' ? '<label class="field">Razón (obligatoria)<select data-bind="registros.form.razon"><option value="">- Selecciona -</option>' + opciones(cat.razonesRiegoNo, fc.razon) + '</select></label>' : '') 
            : '<div class="field">¿Se realizó?<div class="seg">' + boton('realizado', 'SI', 'Sí', 'si') + boton('realizado', 'PARCIAL', 'Parcial', 'parcial') + boton('realizado', 'NO', 'No', 'no') + '</div></div>' +
              (fc.realizado !== 'NO' ? '<label class="field">Fecha real<input type="date" data-bind="registros.form.fechaReal" value="' + fc.fechaReal + '" max="' + hoyISO + '"></label>' : '') +
              (fc.realizado === 'PARCIAL' && x.r.num_aplicacion !== 'EXTRA' ?
                '<div class="field">¿Qué cambió vs el plan? (obligatorio, puedes elegir los dos)<div class="chips">' +
                    '<button type="button" data-action="reg-cambio" data-valor="cambioDosis" aria-pressed="' + fc.cambioDosis + '">Dosis</button>' +
                    '<button type="button" data-action="reg-cambio" data-valor="cambioProducto" aria-pressed="' + fc.cambioProducto + '">Producto</button>' +
                '</div></div>' +
                '<label class="field">Detalle del cambio (opcional)<input type="text" data-bind="registros.form.cambio" value="' + esc(fc.cambio) + '" placeholder="Ej: no se aplicó Vayego"></label>' : '') +
              (fc.realizado === 'NO' ? '<label class="field">Razón (obligatoria)<select data-bind="registros.form.razon"><option value="">- Selecciona -</option>' + opciones(cat.razonesAplicacionNo, fc.razon) + '</select></label>' : '');
        return '<tr class="fila-form"><td colspan="6"><div class="form-registro">' +
            '<div><b>Corregir registro</b><div class="kpi-sub">El vivero y la aplicación no se cambian. Si están equivocados, anula este registro y capturalo de nuevo.</div></div>' +
            '<div class="grid-form">' + campos +
                '<label class="field ancho">Observaciones<input type="text" data-bind="registros.form.obs" value="' + esc(fc.obs) + '"></label></div>' +
            '<div class="field-inline"><button type="button" class="btn btn-primary" data-action="reg-guardar">Guardar corrección</button>' +
                '<button type="button" class="btn" data-action="reg-cancelar">Cancelar</button></div>' +
        '</div></td></tr>';
    }

    // fila con el formulario de anulación: el motivo es obligatorio
    function formAnulacion() {
        var f = estado.registros;
        return '<tr class="fila-form"><td colspan="6"><div class="form-registro anular">' +
            '<div><b>Anular registro</b><div class="kpi-sub">No se borra: queda tachado con su motivo, deja de contar en Panel y Detalle y no se sube a BMS.</div></div>' +
            '<div class="grid-form">' +
                '<label class="field">Motivo (obligatorio)<select data-bind="registros.motivo"><option value="">- Selecciona -</option>' + opciones(D.catalogos.motivosAnulacion, f.motivo) + '</select></label>' +
                '<label class="field ancho">Detalle' + (f.motivo === 'Otro' ? ' (obligatorio)' : ' (opcional)') +
                    '<input type="text" data-bind="registros.motivoDetalle" value="' + esc(f.motivoDetalle) + '" placeholder="Ej: se registró dos veces desde dos tablets"></label>' +
                '</div>' +
                '<div class="field-inline"><button type="button" class="btn btn-rojo" data-action="reg-confirmar-anular">Confirmar anulación</button>' +
                    '<button type="button" class="btn" data-action="reg-cancelar">Cancelar</button></div>' +
        '</div></td></tr>';
    }

    function abrirCorreccion(id) {
        var x = buscarRegistro(id), r = x.r;
        cerrarFormsRegistro();
        estado.registros.editando = id;
        estado.registros.form = x.t === 'riego'
            ? { fecha: r.fecha_riego, efectivo: r.riego_efectivo, tipoRiego: r.tipo_riego || '', razon: r.razon_no || '', obs: r.observaciones || '' }
            : { realizado: r.realizado, fechaReal: r.fecha_real || aISO(hoy()), cambio: '', cambioDosis: false, cambioProducto: false, razon: r.razon_no || '', obs: r.observaciones || ''};
        if (x.t === 'apli') Object.assign(estado.registros.form, leerCambio(r.cambio));
        render();
    }

    // Separa el texto guardado en "cambio" (ej. "Cambió dosis y producto · no se aplicó Vayego")
    // en los botones Dosis/Producto y el detalle. Los registros viejos con texto libre quedan como detalle.
    function leerCambio(texto) {
        var m = String(texto || '').match(/^Cambió (dosis y producto|dosis|producto)(?: · (.*))?$/);
        if (!m) return { cambioDosis: false, cambioProducto: false, cambio: texto || '' };
        return { cambioDosis: m[1].indexOf('dosis') >= 0, cambioProducto: m[1].indexOf('producto') >= 0, cambio: m[2] || '' };
    }

    function guardarCorreccion() {
        var x = buscarRegistro(estado.registros.editando), r = x.r, fc= estado.registros.form, hoyISO = aISO(hoy());
        var cambios;
        if (x.t === 'riego') {
            if (!fc.fecha) return toast('Indica la fecha del riego', true);
            if (fc.fecha > hoyISO) return toast('La fecha no puede ser futura', true);
            if (fc.efectivo === 'SI' && !fc.tipoRiego) return toast('Elige el tipo de riego', true);
            if (fc.efectivo === 'NO' && !fc.razon) return toast('La razón es obligatoria cuando no se regó', true);
            cambios = { fecha_riego: fc.fecha, riego_efectivo: fc.efectivo, tipo_riego: fc.efectivo === 'SI' ? fc.tipoRiego : '', 
                        razon_no: fc.efectivo === 'NO' ? fc.razon : '', observaciones: fc.obs.trim() };
        } else {
            if (fc.realizado !== 'NO' && !fc.fechaReal) return toast('Indica la fecha real', true);
            if (fc.realizado !== 'NO' && fc.fechaReal > hoyISO) return toast('La fecha no puede ser futura', true);
            if (fc.realizado === 'PARCIAL' && r.num_aplicacion !== 'EXTRA' && !fc.cambioDosis && !fc.cambioProducto) return toast('Indica si cambió la dosis, el producto o los dos', true);
            if (fc.realizado === 'NO' && !fc.razon) return toast('La razón es obligatoria cuando no se realizó', true);
            cambios = { realizado: fc.realizado, fecha_real: fc.realizado === 'NO' ? null : fc.fechaReal,
                        cambio: fc.realizado === 'PARCIAL' && r.num_aplicacion !== 'EXTRA' ? textoCambio(fc) : '', razon_no: fc.realizado === 'NO' ? fc.razon : '', observaciones: fc.obs.trim() };
        }
        var hubo = Object.keys(cambios).some(function (k) { return (r[k] || '') !== (cambios[k] || ''); });
        if (!hubo) return toast ('No hay cambios para guardar', true);
        // SUPABASE: update registro_riegos / registro_aplicaciones set ..., corregido_por, corregido_en; valor_anterior where submission_id = ...
        r.correcciones = (r.correcciones || []).concat([{ en: marcaAhora(), por: D.usuario.nombre, antes: resumenRegistro(x) }]);
        Object.assign(r, cambios);
        cerrarFormsRegistro();
        toast('Corrección guardada');
        render();
    }

    function confirmarAnulacion() {
        var f = estado.registros;
        if (!f.motivo) return toast('Elige el motivo de la anulación', true);
        if (f.motivo === 'Otro' && !f.motivoDetalle.trim()) return toast('Describe el motivo del detalle', true);
        var x = buscarRegistro(f.anulando);
        // SUPABASE: update ... set anulado = true, motivo_anulacion, anulado_en where submission_id = ...
        Object.assign(x.r, { anulado: true, motivo_anulacion: f.motivo + (f.motivoDetalle.trim() ? ' ·' + f.motivoDetalle.trim() : ''),
                             anulado_por: D.usuario.nombre, anulado_en: marcaAhora() });
        cerrarFormsRegistro();
        toast('Registro anulado: ya no cuenta en el Panel ni se sube a BMS');
        render();
    }
            
    // --------------------------------------------------
    // PANTALLA 4 · CAPTURA EN CAMPO
    // --------------------------------------------------
    function renderCaptura() {
        var c = estado.captura;
        var hoyISO = aISO(hoy());
        var v = c.viveroId ? viveroPorId(c.viveroId) : null;
        var esRiego = c.modo === 'riego';
        var previos = v && esRiego ? riegosDe(v.id, c.fecha) : [];
        var cat = D.catalogos;
        
        // Filtro por lugar: con muchos viveros, cada equipo ve solo los de su lagar
        var activos = viverosActivos();
        var lugaresCap = unicos(activos.map(function (x) { return x.lugar; }));
        var lugarCap = lugaresCap.indexOf(estado.capturaLugar) >= 0 ? estado.capturaLugar : 'Todos';
        var viveros = activos.filter(function (x) { return lugarCap === 'Todos' || x.lugar === lugarCap; }).sort(porNombre);

        var red = estado.enLinea
            ? (D.pendientesEnvio ? '<div class="estado-red offline">' + D.pendientesEnvio + ' registros pendientes de enviar</div>' : '<div class="estado-red online">En línea · todo enviado</div>')
            : '<div class="estado-red offline">Sin señal · ' + D.pendientesEnvio + ' registros se enviarán al volver la conexión</div>';

        var  chipsLugar = lugaresCap.length > 1 ? '<div class="chips">' + lugaresCap.concat(['Todos']).map(function (l) {
            return '<button type="button" data-action="cap-lugar" data-valor="' + esc(l) + '" aria-pressed="' + (lugarCap === l) + '">' + esc(l) + '</button>';
        }).join('') + '</div>' : '';

        var listaViveros = viveros.map(function (x) {
            var riegosHoy = riegosDe(x.id, hoyISO)[0];
            var sub = ddsDe(x) + ' DDS · ' + (lugarCap === 'Todos' ? x.lugar + ' · ' : '') + (riegosHoy ? 'Riego de hoy ✓ ' + horaDe(riegosHoy.marca_temporal) : 'Sin riego hoy');
            return '<button type="button" class="vivero-btn' + (riegosHoy ? ' hecho' : '') +  '" data-action="cap-vivero" data-valor="' + x.id + '" aria-pressed="' + (c.viveroId === x.id) + '">' +
                '<span class="mono">' + esc(x.nombre) + '</span><small>' + esc(sub) + '</small></button>';
        }).join('');

        var cuerpo = !v ? '' : ultimoRegistro(v, esRiego) + (esRiego ? camposRiego(c, previos, cat) : camposAplicacion(c, v, cat));
        var etiquetaGuardar = esRiego ? (previos.length ? 'Guardar segundo riego ' : 'Guardar riego') : 'Guardar aplicación';
        
        return '' +
            '<div class="captura">' + 
                '<div class="captura-head">' +
                    '<div><div style="font-size:17px;font-weight:700">Captura en campo</div><small>' + esc(D.usuario.nombre) + ' · el responsable se llena solo</small></div>' +
                    red +
                '</div>' +
                '<div class="seg" role="group" aria-label="Tipo de registro">' +
                    '<button type="button" class="azul" data-action="cap-modo" data-valor="riego" aria-pressed="' + esRiego + '">Riego</button>' +
                    '<button type="button" class="verde" data-action="cap-modo" data-valor="apli" aria-pressed="' + !esRiego + '">Aplicación</button>' +
                '</div>' +
                '<div class="captura-cuerpo">' +
                    '<div class="field captura-lista' + (v ? ' con-seleccion' : '') + '">' +
                        '<span>Vivero <span class="cuenta">(' + viveros.length + ')</span></span>' +
                        chipsLugar +
                        '<div class="lista-viveros">' + listaViveros + '</div>' +
                        // En el teléfono, al elegir un vivero la lista se contrae y aparece este botón
                        '<button type="button" class="btn btn-sm cambiar-vivero" data-action="cap-cambiar">Cambiar vivero</button>' +
                    '</div>' +
                    '<div class="captura-form">' +
                        (v ? cuerpo : '<div class="notice muted">Elige un vivero para continuar.</div>') +
                        (v ? '<label class="field">Observaciones<textarea data-bind="captura.obs" placeholder="Condiciones, notas...">' + esc(c.obs) + '</textarea></label>' : '') +
                        ( v ? '<button type="button" class="btn-guardar ' + (esRiego ? 'riego' : 'apli') + '" data-action="cap-guardar">' + etiquetaGuardar + '</button>' : '') +
                    '</div>' +
                '</div>' +
            '</div>' ;
    }

    // Último registro (no anulado) del vivero en el mdo elegido, para que en campo se vea que se hizo antes
    function ultimoRegistro(v, esRiego) {
        // SUPABASE: select ... where vivero_id = v.id not anulado order by marca_temporal desc limit 1
        var lista = (esRiego ? riegosValidos(): aplicacionesValidas()).filter(function (r) { return r.vivero_id === v.id; })
            .sort(function (a, b) { return a.marca_temporal < b.marca_temporal ? 1 : -1; });
        var r = lista[0];
        if (!r) return '<div class="notice muted">' + (esRiego ? 'Todavía no hay riegos' : 'Todavía no hay aplicaciones') + ' registrados en este vivero.</div>';
        var x = { t: esRiego ? 'riego' : 'apli', r: r };
        var fecha = esRiego ? r.fecha_riego : (r.fecha_real || String(r.marca_temporal).slice(0, 10));
        return '<div class="notice muted"><b style="color:var(--ink)">' + (esRiego ? 'Último riego: ' : 'Última aplicación: ') + '</b>' +
            ddmm(deISO(fecha)) + ' · ' + (esRiego ? '' : esc(queAplicacion(r, v)) + ' · ') + esc(resumenRegistro(x)) +
            '<span class="kpi-sub"> · registrado ' + ddmm(deISO(String(r.marca_temporal).slice(0, 10))) + ' · ' + horaDe(r.marca_temporal) + '</span></div>'; 
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
            (sel && hechas.indexOf(String(sel.num)) >= 0 ? '<div class="notice err"><b>Esta aplicación ya está registrada en este vivero.</b> Guárdala solo si es una repetición.</div>' : '') +
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
            (c.realizado === 'PARCIAL' && !esExtra ?
                '<div class="field">¿Qué cambió vs el plan? (obligatorio, puedes elegir los dos)<div class="chips">' +
                    '<button type="button" data-action="cap-cambio" data-valor="cambioDosis" aria-pressed="' + c.cambioDosis + '">Dosis</button>' +
                    '<button type="button" data-action="cap-cambio" data-valor="cambioProducto" aria-pressed="' + c.cambioProducto + '">Producto</button>' +
                '</div></div>' +
                '<label class="field">Detalle del cambio (opcional)<input type="text" data-bind="captura.cambio" value="' + esc(c.cambio) + '" placeholder="Ej: no se aplicó Vayego"></label>' : '') +
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
                razon_no: c.razon, observaciones: c.obs.trim(), marca_temporal: marcaAhora(), submission_id: nuevoId() });
        } else {
            if (!c.planNum) return toast('Elige la aplicación', true);
            if (c.planNum === 'EXTRA' && (!c.extraEtapa || !c.extraProducto.trim())) return toast('Indica etapa y producto de la aplicación extra', true);
            if (!c.realizado) return toast('Indica si se realizó',true);
            if (c.realizado !== 'NO' && !c.fechaReal) return toast('Indica la fecha real', true);
            if (c.realizado !== 'NO' && c.fechaReal > hoyISO) return toast('La fecha no puede ser futura', true);
            if (c.realizado === 'PARCIAL' && c.planNum !== 'EXTRA' && !c.cambioDosis && !c.cambioProducto) return toast('Indica si  cambió la dosis, el producto o los dos', true);
            if (c.realizado === 'NO' && !c.razon) return toast('La razón es obligatoria cuando no se realizó', true);
            //SUPABASE: insert en registro_aplicaciones con submission_id (UUID) único
            D.registro_aplicaciones.push({ vivero_id: v.id, num_aplicacion: String(c.planNum), realizado: c.realizado,
                fecha_real: c.realizado === 'NO' ? null : c.fechaReal, razon_no: c.realizado === 'NO' ? c.razon : '',
                cambio: c.realizado === 'PARCIAL' && c.planNum !== 'EXTRA' ? textoCambio(c) : '', observaciones: c.obs.trim(),
                extra_etapa: c.planNum === 'EXTRA' ? c.extraEtapa : '', extra_producto: c.planNum === 'EXTRA' ? c.extraProducto.trim() : '',
                extra_dosis: c.planNum === 'EXTRA' ? c.extraDosis.trim() : '', marca_temporal: marcaAhora(), submission_id: nuevoId() });
        }
        if (!estado.enLinea) D.pendientesEnvio++;
        toast(estado.enLinea ? 'Registro guardado' : 'Guardado en el dispositivo; se enviará al volver la señal');
        // Se limpia TODO, incluido el vivero, para que no se repita el mismo registro por accidente.
        estado.captura = nuevaCaptura(c.modo);
        render();
        window.scrollTo(0, 0);
    }
    function textoCambio(c) {
        var que = [];
        if (c.cambioDosis) que.push('dosis');
        if (c.cambioProducto) que.push('producto');
        return 'Cambió ' + que.join(' y ') + (c.cambio.trim() ? ' · ' + c.cambio.trim() : '');
    }

    function nuevoId() {
        return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    //-------------------------------------------------------------
    // NAVEGACIÓN Y EVENTOS
    //-------------------------------------------------------------
    var rutas  = { panel: renderPanel, planes: renderPlanes, sync: renderSync, captura: renderCaptura, viveros: renderViveros, vivero: renderDetalleVivero, registros: renderRegistros };
    // El hash puede traer un id: #/vivero/21 -> ruta "vivero", id 21
    function partesRuta() { return (location.hash || '').replace(/^#\/?/, '').split('/'); }
    function rutaActual() {
        var r = partesRuta()[0];
        return rutas[r] ? r : 'panel';
    }
    function idDeRuta() { var id = partesRuta()[1]; return id ? Number(id) : null; }

    function render() {
        var r = rutaActual();
        vista.innerHTML = rutas[r]();
        document.querySelectorAll('.nav-links a').forEach(function (a) {
            var activo = a.getAttribute('data-route') === (r === 'vivero' ? 'viveros' : r);
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
            case 'sync-accion':
                if (val === 'Vincular') { estado.viveros.form = formVivero(viveroPorId(Number(el.getAttribute('data-id')))); location.hash = '#/viveros'; break; }
                toast('Diseño: «' + val + '» para ' + el.getAttribute('data-vivero')); break;
            case 'cap-lugar':
                estado.capturaLugar = val;
                var vSel = viveroPorId(c.viveroId);
                if (vSel && val !== 'Todos' && vSel.lugar !== val) { c.viveroId = null; c.planNum = ''; }
                render(); break;
            case 'cap-cambiar': c.viveroId = null; c.planNum = ''; render(); break;
            case 'viv-nuevo': estado.viveros.form = formVivero(null); render(); window.scrollTo(0, 0); break;
            case 'viv-editar': estado.viveros.form = formVivero(viveroPorId(Number(val))); render(); window.scrollTo(0, 0); break;
            case 'viv-cancelar': estado.viveros.form = null; render(); break;
            case 'viv-guardar': guardarVivero(); break;
            case 'viv-usar-nombre-bms':
                var eb = estudioPorId(Number(estado.viveros.form.study_dbid));
                if (eb) { estado.viveros.form.nombre = eb.nombre; render(); }
                break;
            case 'viv-tipo': estado.viveros.form.tipo = val; render(); break;
            case 'viv-form-activo': estado.viveros.form.activo = val === '1'; render(); break;
            case 'viv-ver': estado.viveros.ver = val; render(); break;
            case 'viv-activo':
                // SUPABASE: update viveros set activo = not activo where id = val
                var vv =viveroPorId(Number(val));
                vv.activo = !vv.activo;
                toast(vv.activo ? 'Vivero activado: vuelve a aparecer en Captura' : 'Vivero desactivado: ya no aparece en Captura');
                render(); break;
            case 'cap-modo': estado.captura = nuevaCaptura(val); estado.captura.viveroId = c.viveroId; render(); break;
            case 'cap-vivero': c.viveroId = Number(val); c.planNum = ''; render(); break;
            case 'cap-set':
                var campo = el.getAttribute('data-campo');
                c[campo] = val;
                if (campo === 'efectivo') { c.tipoRiego = ''; c.razon = ''; }
                if (campo === 'realizado') { c.razon = ''; c.cambio = ''; c.cambioDosis = false; c.cambioProducto = false; }
                render(); break;
            case 'cap-cambio': c[val] = !c[val]; render(); break;
            case 'cap-guardar': guardarCaptura(); break;
            case 'reg-tipo': estado.registros.tipo = val; render(); break;
            case 'reg-ver': estado.registros.ver = val; render(); break;
            case 'reg-problemas': estado.registros.problemas = !estado.registros.problemas; render(); break;
            case 'reg-limpiar': estado.registros = nuevoFiltroRegistros(); render(); break;
            case 'reg-corregir': abrirCorreccion(val); break;
            case 'reg-anular': cerrarFormsRegistro(); estado.registros.anulando = val; render(); break;
            case 'reg-cancelar': cerrarFormsRegistro(); render(); break;
            case 'reg-set':
                var campoR = el.getAttribute('data-campo'), fr = estado.registros.form;
                fr[campoR] = val;
                if (campoR === 'efectivo') { fr.tipoRiego = ''; fr.razon = ''; }
                if (campoR === 'realizado') { fr.razon = ''; fr.cambio = ''; fr.cambioDosis = false; fr.cambioProducto = false; }
                render(); break;
            case 'reg-cambio': estado.registros.form[val] = !estado.registros.form[val]; render(); break;
            case 'reg-guardar': guardarCorreccion(); break;
            case 'reg-confirmar-anular': confirmarAnulacion(); break;
            case 'reg-ver-vivero':
                // Desde el detalle de un vivero: abre Registros filtrado por ese vivero desde su siembra
                var vr = viveroPorId(Number(val));
                estado.registros = nuevoFiltroRegistros();
                estado.registros.viveroId = String(vr.id);
                estado.registros.tipo = el.getAttribute('data-tipo');
                estado.registros.desde = vr.fecha_siembra;
                break; // el enlace mismo lleva a #/registros
            case 'panel-problemas':
                // Desde Pendientes de revisión: abre Registros con "Solo con problemas" y el mismo lugar del Panel
                estado.registros = nuevoFiltroRegistros();
                estado.registros.problemas = true;
                estado.registros.tipo = el.getAttribute('data-tipo');
                estado.registros.lugar = estado.filtro.lugar;
                if (estado.registros.tipo === 'riego') estado.registros.desde = aISO(sumarDias(hoy(), -6));
                break; // el enlace mismo lleva a #/registros
            case 'panel-cercanas': estado.filtro.verCercanas = val; render(); break;
            case 'det-capturar':
                //Abre Captura con el vivero ya elegido y el modo del botón (riego o apli)
                var vd = viveroPorId(Number(val));
                estado.captura = nuevaCaptura(el.getAttribute('data-modo'));
                estado.captura.viveroId = vd.id;
                estado.capturaLugar = vd.lugar;
                location.hash = '#/captura';
                break;
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
        if (el.tagName === 'SELECT' || el.type === 'date' || b.indexOf('viveros.form.') === 0 || b === 'registros.texto') render();
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