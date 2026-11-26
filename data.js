/* ============================================================
   DATOS DE EJEMPLO — solo para el diseño.
   Los nombres de campos siguen las columnas reales de Supabase
   (viveros, plan, registro_aplicaciones, registro_riegos) para
   que el cambio a consultas reales sea directo.
   Las fechas se calculan respecto a hoy para que el panel
   siempre se vea "vivo".
   ============================================================ */
(function () {
  function haceDias(n) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function marca(diasAtras, hora) {
    return haceDias(diasAtras) + 'T' + hora + ':00-06:00';
  }

  // Plan real de Centro Experimental 2026C:
  // "Plan de Protección de Viveros · Ciclo septiembre–enero 2026-2027" (18 aplicaciones).
  // Columnas: [#, dds_inicio, dds_fin, dds_ventana, etapa, categoria, producto, dosis, observacion]
  var filasPlanCE = [
    [1, 0, 0, '0 DDS', 'Siembra', 'Tto. de Semilla', 'Fortenza Maxx', '6–8 ml/Kg semilla', ''],
    [2, 0, 0, '0 DDS', 'V0 (pre-emergente)', 'Control de Malezas', 'Gesaprim 90 + Glifosato', '1.0–1.5 kg/mz + 2.0 L/mz', ''],
    [3, 2, 3, '2–3 DDS', 'V0', 'Gusano nochero y plagas del suelo', 'Tregua 45 EC', '1.5–2.0 L/mz', ''],
    [4, 8, 8, '8 DDS', 'V2–V3', 'Fertilización', 'Triple 15 Yara', '4 qq/mz', ''],
    [5, 8, 8, '8 DDS', 'V2–V3', 'Plaga — Spiroplasma (1ra)', 'Ampligo + Verdabis + Bayfolan Ambition', '0.15 L/mz + 0.15 L/mz + 1 L/mz', ''],
    [6, 15, 18, '15–18 DDS', 'V4–V5', 'Plaga — Spiroplasma (2da)', 'Muralla + Ampligo + Bayfolan/Omex Bio20', '0.15 L/mz + 0.15 L/mz + 1 L/mz', 'APLICACIÓN OPCIONAL según presión'],
    [7, 18, 20, '18–20 DDS', 'V5–V6', 'Control de Malezas', 'Control manual de malezas', '1 pasada cada 10–20 días', 'Inicia control de malezas manual'],
    [8, 23, 25, '23–25 DDS', 'V6–V7', 'Plaga — Spiroplasma / Spodoptera', 'Ampligo + Winner + Amistar + Bayfolan/Omex Bio20', '0.15 + 0.20 + 0.25 + 1 L/mz', ''],
    [9, 25, 30, '25–30 DDS', 'V7–V9', 'Fertilización', 'Nitrostend + S', '4 qq/mz', ''],
    [10, 25, 30, '25–30 DDS', 'V8–V9', 'Fungicida (1ra)', 'Amistar + Nativo', '0.50–0.70 + 0.15 L/mz', 'TSC / Helmintosporium'],
    [11, 28, 30, '28–30 DDS', 'V8–V9', 'Plaga — Spodoptera', 'DeminFit + Certero + Muralla', '0.20 + 0.25 + 0.20 L/mz', ''],
    [12, 35, 35, '35 DDS', 'V11–V12', 'Plaga — Spodoptera', 'Ampligo + Engeo', '0.20 + 0.20 L/mz', ''],
    [13, 35, 40, '35–40 DDS', 'V12', 'Fertilización', 'Nitrostend + S', '3 qq/mz', ''],
    [14, 45, 50, '45–50 DDS', 'VT', 'Fungicida (2da)', 'Amistar + Nativo', '0.50–0.70 + 0.15 L/mz', 'TSC / Helmintosporium'],
    [15, 45, 50, '45–50 DDS', 'VT', 'Plaga — Spodoptera / Ácaros', 'Winner o DeminFit + Overon Speed', '0.20 + 0.20 L/mz', ''],
    [16, 60, 65, '60–65 DDS', 'R1–R2', 'Fungicida (3ra)', 'Amistar + Nativo', '0.50–0.70 + 0.15 L/mz', ''],
    [17, 65, 65, '65 DDS', 'R3–R4', 'Control de Malezas', 'Basta', '2 L/mz', ''],
    [18, 60, 65, '60–65 DDS', 'R3–R4', 'Plaga — Spodoptera / Ácaros', 'Winner + Overon Speed', '0.20 + 0.20 L/mz', '']
  ];

  // Plan anterior de Ovejero 2026B (sigue vigente mientras haya viveros 2026B en cosecha)
  var filasPlanBase = [
    [1, 0, 0, '0 DDS', 'Siembra', 'Tto. Semilla', 'Fortenza Maxx', '6–8 ml / Kg semilla', ''],
    [2, 0, 3, '0–3 DDS', 'V0', 'Herbicida preemergente', 'Gesaprim 90 + Glifosato', '1.0–1.5 kg/mz + 2.0 L/mz', ''],
    [3, 2, 3, '2–3 DDS', 'V0', 'Insect. suelo', 'Tregua 45 EC', '1.5–2.0 L/mz', 'Gusano nochero y plagas de suelo'],
    [4, 7, 12, '7–12 DDS', 'Ve–V2', 'Insect. suelo', 'Vidate', '1 L/mz', ''],
    [5, 7, 12, '7–12 DDS', 'V1–V2', 'Insect. chupadores', 'Muralla + Vayego', '0.325 L/mz + 0.10–0.125 L/mz', ''],
    [6, 11, 13, '11–13 DDS', 'V2–V3', 'Fertilización', 'Triple 15 Yara', '6 qq/mz', ''],
    [7, 14, 14, '14 DDS', 'V3–V4', 'Spiroplasma', 'Ampligo + Verdabis + Bayfolan Ambition', '0.15 L/mz + 0.15 L/mz + 1 L/mz', ''],
    [8, 15, 18, '15–18 DDS', 'V4–V5', 'Spiroplasma (OPC)', 'Muralla + Ampligo + Bayfolan', '0.15 L/mz + 0.15 L/mz + 1 L/mz', 'APLICACIÓN OPCIONAL'],
    [9, 18, 20, '18–20 DDS', 'V5–V6', 'Control Malezas', 'Manual — 1 pasada c/20 días', '1 pasada cada 20 días', ''],
    [10, 23, 25, '23–25 DDS', 'V6–V7', 'Spiroplasma / Spodoptera', 'Ampligo + Winner + Amistar + Bayfolan', '0.15 + 0.20 + 0.25 + 1 L/mz', ''],
    [11, 25, 30, '25–30 DDS', 'V7–V9', 'Fertilización', 'Nitrostend + S', '4 qq/mz', ''],
    [12, 28, 30, '28–30 DDS', 'V9–V10', 'Spodoptera', 'DeminFit + Certero + Muralla', '0.20 + 0.25 + 0.20 L/mz', ''],
    [13, 29, 32, '29–32 DDS', 'V9–V10', 'Spiroplasma / Spod. OPC', 'Ampligo + Winner + Nativo', '0.15 + 0.20 + 0.15 L/mz', 'OPCIONAL'],
    [14, 35, 35, '35 DDS', 'V11–V12', 'Spodoptera', 'Ampligo + Overon Speed', '0.20 + 0.25 L/mz', ''],
    [15, 38, 40, '38–40 DDS', 'V12', 'Fertilización', 'Nitrostend + S', '3 qq/mz', ''],
    [16, 38, 40, '38–40 DDS', 'V12', 'Fungicida', 'Amistar + Nativo', '0.50–0.70 + 0.15 L/mz', ''],
    [17, 45, 50, '45–50 DDS', 'VT', 'Fungicida', 'Amistar + Nativo', '0.50–0.70 + 0.15 L/mz', ''],
    [18, 45, 50, '45–50 DDS', 'VT', 'Spodoptera / Ácaros', 'Winner + DeminFit + Overon Speed', '0.20 + 0.20 + 0.20 L/mz', ''],
    [19, 60, 65, '60–65 DDS', 'R1–R2', 'Fungicida', 'Amistar + Nativo', '0.50–0.70 + 0.15 L/mz', 'Solo Plan 02'],
    [20, 65, 65, '65 DDS', 'R3–R4', 'Control Malezas', 'Basta', '2 L/mz', 'Solo Plan 02'],
    [21, 60, 65, '60–65 DDS', 'R3–R4', 'Spodoptera / Ácaros', 'Winner + Overon Speed', '0.20 + 0.20 L/mz', 'Solo Plan 02']
  ];
  function aFilas(arr) {
    return arr.map(function (r) {
      return { num: r[0], dds_inicio: r[1], dds_fin: r[2], dds_ventana: r[3], etapa: r[4], categoria: r[5], producto: r[6], dosis: r[7], observacion: r[8] };
    });
  }

  // "Archivo" de ejemplo que se carga en la pantalla Planes: una supuesta versión 2 del plan
  // de Centro Experimental. Trae 2 cambios y 2 errores PUESTOS A PROPÓSITO para mostrar la validación.
  var archivo = aFilas(filasPlanCE);
  archivo[3] = Object.assign({}, archivo[3], { dosis: '5 qq/mz' });                       // #4 cambia la dosis
  archivo[5] = Object.assign({}, archivo[5], { dds_inicio: 18, dds_fin: 15, dds_ventana: '18–15 DDS' }); // #6 error: DDS al revés
  archivo[10] = Object.assign({}, archivo[10], { num: 10 });                              // #11 error: repite el número 10
  archivo[11] = Object.assign({}, archivo[11], { producto: 'Ampligo + Overon Speed' });   // #12 cambia el producto

  window.DATA = {
    usuario: { nombre: 'Alessandro', rol: 'Administrador', lugar: 'Centro Experimental' },

    viveros: [
      { id: 21, nombre: '01_VIVERO_SELF_2026C_1', tipo: 'Self', lugar: 'Centro Experimental', temporada: '2026C', fecha_siembra: haceDias(16), activo: true, study_dbid: 1201 },
      { id: 22, nombre: '02_VIVERO_CROSS_2026C_1', tipo: 'Cross', lugar: 'Centro Experimental', temporada: '2026C', fecha_siembra: haceDias(14), activo: true, study_dbid: 1202 },
      { id: 23, nombre: '11_VIVERO_NUEVO_2026C', tipo: 'Cross', lugar: 'Centro Experimental', temporada: '2026C', fecha_siembra: haceDias(2), activo: true, study_dbid: null },
      { id: 1, nombre: '01 SLFAFCIM_2026B', tipo: 'Self', lugar: 'Ovejero', temporada: '2026B', fecha_siembra: '2026-05-07', activo: true, study_dbid: 1058 },
      { id: 2, nombre: '02 BCRAFCIM_2026B', tipo: 'Cross', lugar: 'Ovejero', temporada: '2026B', fecha_siembra: '2026-05-11', activo: true, study_dbid: 1059 },
      { id: 3, nombre: '03 BC1_BlueLines_2026B', tipo: 'Cross', lugar: 'Ovejero', temporada: '2026B', fecha_siembra: '2026-05-18', activo: true, study_dbid: 1060 }
    ],

    planes: [
      { id: 'ce-2026c-v1', tipo: 'aplicaciones', lugar: 'Centro Experimental', temporada: '2026C', version: 1, estado: 'vigente',
        nota: 'Plan de Protección de Viveros · ciclo septiembre–enero 2026-2027.', filas: aFilas(filasPlanCE) },
      { id: 'ov-2026b-v1', tipo: 'aplicaciones', lugar: 'Ovejero', temporada: '2026B', version: 1, estado: 'vigente',
        nota: 'Sigue vigente mientras haya viveros 2026B en cosecha.', filas: aFilas(filasPlanBase) }
    ],

    planArchivoEjemplo: { nombre: 'Plan_Proteccion_Viveros_2026-2027_v2.xlsx', filas: archivo },

    registro_aplicaciones: [
      { vivero_id: 21, num_aplicacion: '1', realizado: 'SI', fecha_real: haceDias(16), marca_temporal: marca(16, '07:10') },
      { vivero_id: 21, num_aplicacion: '2', realizado: 'SI', fecha_real: haceDias(15), marca_temporal: marca(15, '08:02') },
      { vivero_id: 21, num_aplicacion: '3', realizado: 'SI', fecha_real: haceDias(13), marca_temporal: marca(13, '07:45') },
      { vivero_id: 21, num_aplicacion: '4', realizado: 'SI', fecha_real: haceDias(8), marca_temporal: marca(8, '07:30') },
      { vivero_id: 22, num_aplicacion: '1', realizado: 'SI', fecha_real: haceDias(14), marca_temporal: marca(14, '07:05') },
      { vivero_id: 22, num_aplicacion: '2', realizado: 'SI', fecha_real: haceDias(13), marca_temporal: marca(13, '07:50') },
      { vivero_id: 22, num_aplicacion: '3', realizado: 'SI', fecha_real: haceDias(11), marca_temporal: marca(11, '08:15') },
      { vivero_id: 22, num_aplicacion: '4', realizado: 'SI', fecha_real: haceDias(5), marca_temporal: marca(5, '07:20') },
      { vivero_id: 22, num_aplicacion: '5', realizado: 'SI', fecha_real: haceDias(4), marca_temporal: marca(4, '07:40') },
      { vivero_id: 22, num_aplicacion: '6', realizado: 'SI', fecha_real: haceDias(0), marca_temporal: marca(0, '07:55') },
      { vivero_id: 21, num_aplicacion: '6', realizado: 'SI', fecha_real: haceDias(0), marca_temporal: marca(0, '08:20') }
    ],

    registro_riegos: [
      { vivero_id: 21, fecha_riego: haceDias(6), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(6, '06:40') },
      { vivero_id: 21, fecha_riego: haceDias(5), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(5, '06:35') },
      { vivero_id: 21, fecha_riego: haceDias(4), riego_efectivo: 'NO', tipo_riego: '', razon_no: 'Lluvia / suelo húmedo', marca_temporal: marca(4, '06:50') },
      { vivero_id: 21, fecha_riego: haceDias(3), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(3, '06:30') },
      { vivero_id: 21, fecha_riego: haceDias(2), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(2, '06:45') },
      { vivero_id: 21, fecha_riego: haceDias(1), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(1, '06:38') },
      { vivero_id: 21, fecha_riego: haceDias(0), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(0, '06:40') },
      { vivero_id: 21, fecha_riego: haceDias(0), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(0, '06:52') }, // duplicado de ejemplo para B.4
      { vivero_id: 22, fecha_riego: haceDias(6), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(6, '06:55') },
      { vivero_id: 22, fecha_riego: haceDias(5), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(5, '07:00') },
      { vivero_id: 22, fecha_riego: haceDias(4), riego_efectivo: 'NO', tipo_riego: '', razon_no: 'Lluvia / suelo húmedo', marca_temporal: marca(4, '07:02') },
      { vivero_id: 22, fecha_riego: haceDias(3), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(3, '06:58') },
      { vivero_id: 22, fecha_riego: haceDias(2), riego_efectivo: 'NO', tipo_riego: '', razon_no: '', marca_temporal: marca(2, '07:10') },
      { vivero_id: 22, fecha_riego: haceDias(1), riego_efectivo: 'SI', tipo_riego: 'Aspersión', razon_no: '', marca_temporal: marca(1, '07:05') },
      { vivero_id: 23, fecha_riego: haceDias(1), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(1, '07:30') },
      { vivero_id: 1, fecha_riego: haceDias(3), riego_efectivo: 'NO', tipo_riego: '', razon_no: 'Decisión técnica', marca_temporal: marca(3, '08:00') }
    ],

    // Lo que hoy no existe y la app nueva agregaría
    duplicadosBloqueados: 2,
    pendientesEnvio: 3,

    sync: {
      corrida: { hora: '01:14', duracion: '3 min 40 s' },
      resultados: [
        { vivero_id: 21, ap_filas: 6, r_filas: 14, estado: 'ok' },
        { vivero_id: 22, ap_filas: 7, r_filas: 13, estado: 'ok' },
        { vivero_id: 23, ap_filas: 0, r_filas: 1, estado: 'sin_vincular' },
        { vivero_id: 1, ap_filas: 21, r_filas: 96, estado: 'ok' },
        { vivero_id: 2, ap_filas: 20, r_filas: 94, estado: 'ok' },
        { vivero_id: 3, ap_filas: 19, r_filas: 90, estado: 'error', error: 'BMS respondió HTTP 500 al subir el archivo de riegos (se reintentará)' }
      ],
      noches: [
        { dias: 0, res: '4 de 6 · 1 error · 1 sin vincular', nivel: 'err' },
        { dias: 1, res: '5 de 6 · 1 sin vincular', nivel: 'warn' },
        { dias: 2, res: '5 de 5 OK', nivel: 'ok' },
        { dias: 3, res: '5 de 5 OK', nivel: 'ok' },
        { dias: 4, res: '4 de 5 · 1 reintento exitoso', nivel: 'warn' },
        { dias: 5, res: '5 de 5 OK', nivel: 'ok' },
        { dias: 6, res: '5 de 5 OK', nivel: 'ok' }
      ]
    },

    catalogos: {
      tiposRiego: ['Goteo', 'Aspersión', 'Gravedad', 'Manual', 'Otro'],
      razonesRiegoNo: ['Lluvia / suelo húmedo', 'Falta de agua', 'Falla de bomba / equipo', 'Falta de personal', 'Decisión técnica', 'Otro (describir en observaciones)'],
      razonesAplicacionNo: ['Clima / lluvia', 'Falta de producto', 'Falta de personal', 'Decisión técnica', 'Otro (describir en observaciones)'],
      etapas: ['VE', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5-V6', 'V6-V7', 'V7-V9', 'V9-V10', 'V11-V12', 'VT', 'R1-R2', 'R3-R4'],
      tiposVivero: ['Self', 'Cross'],
      motivosAnulacion: ['Duplicado', 'Vivero equivocado', 'Fecha equivocada', 'Error de captura', 'Otro']
    },

    // Estudios que existen en BMS. Sirven para vincular cada vivero con su estudio exacto
    // (así la subida nocturna ya no busca por nombre).
    // SUPABASE: se llenaría con la lista de estudios que trae clever-function desde BMS.
    estudiosBMS: [
      { study_dbid: 1058, nombre: '01 SLFAFCIM_2026B', temporada: '2026B' },
      { study_dbid: 1059, nombre: '02 BCRAFCIM_2026B', temporada: '2026B' },
      { study_dbid: 1060, nombre: '03 BC1_BlueLines_2026B', temporada: '2026B' },
      { study_dbid: 1201, nombre: '01_VIVERO_SELF_2026C_1', temporada: '2026C' },
      { study_dbid: 1202, nombre: '02_VIVERO_CROSS_2026C_1', temporada: '2026C' },
      { study_dbid: 1203, nombre: '03_VIVERO_SELF_2026C_2', temporada: '2026C' },
      { study_dbid: 1204, nombre: '04_VIVERO_CROSS_2026C_2', temporada: '2026C' },
      { study_dbid: 1205, nombre: '05_VIVERO_SELF_2026C_3', temporada: '2026C' },
      { study_dbid: 1206, nombre: '06_VIVERO_CROSS_2026C_3', temporada: '2026C' },
      { study_dbid: 1207, nombre: '07_VIVERO_SELF_2026C_4', temporada: '2026C' },
      { study_dbid: 1208, nombre: '08_VIVERO_CROSS_2026C_4', temporada: '2026C' },
      { study_dbid: 1210, nombre: '10_VIVERO_BC_2026C_1', temporada: '2026C' },
      { study_dbid: 1211, nombre: '11_VIVERO_NUEVO_2026C', temporada: '2026C' },
      { study_dbid: 1212, nombre: '11_VIVERO_NUEVO_2026C (copia)', temporada: '2026C' }
    ]
  };

  // Viveros extra de 2026C para ver la app con una temporada completa (11 viveros).
  // [id, nombre, tipo, días desde la siembra, study_dbid]
  var extra2026C = [
    [24, '03_VIVERO_SELF_2026C_2', 'Self', 15, 1203],
    [25, '04_VIVERO_CROSS_2026C_2', 'Cross', 15, 1204],
    [26, '05_VIVERO_SELF_2026C_3', 'Self', 13, 1205],
    [27, '06_VIVERO_CROSS_2026C_3', 'Cross', 12, 1206],
    [28, '07_VIVERO_SELF_2026C_4', 'Self', 10, 1207],
    [29, '08_VIVERO_CROSS_2026C_4', 'Cross', 9, 1208],
    [30, '09_VIVERO_SELF_2026C_5', 'Self', 5, null],
    [31, '10_VIVERO_BC_2026C_1', 'Cross', 4, 1210]
  ];
  // A estos viveros se les generan registros "al día": riegos de los últimos 7 días
  // y las aplicaciones del plan cuya ventana ya pasó, para que el panel no se llene de atrasos.
  var D = window.DATA;
  extra2026C.forEach(function (x) {
    var dds = x[3];
    D.viveros.push({ id: x[0], nombre: x[1], tipo: x[2], lugar: 'Centro Experimental', temporada: '2026C',
      fecha_siembra: haceDias(dds), activo: true, study_dbid: x[4] });
    for (var d = Math.min(6, dds); d >= 1; d--) {
      D.registro_riegos.push({ vivero_id: x[0], fecha_riego: haceDias(d), riego_efectivo: 'SI', tipo_riego: 'Goteo', razon_no: '', marca_temporal: marca(d, '06:50') });
    }
    filasPlanCE.forEach(function (f) {
      if (f[2] < dds) {
        D.registro_aplicaciones.push({ vivero_id: x[0], num_aplicacion: String(f[0]), realizado: 'SI',
          fecha_real: haceDias(dds - f[1]), marca_temporal: marca(dds - f[1], '07:30') });
      }
    });
  });
})();