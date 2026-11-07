/* Reglas del negocio: cuotas, caja, clases con cupo, progreso. Sin pantallas acá. */
'use strict';

const CTA = 'Debe (cuenta corriente)';

/* ---------------------------------------------------------------- cuotas */
function estadoCuota(a) {
  if (!a.vencimiento) return { e: 'sin', t: 'Sin cuota cargada', clase: '' };
  const d = diasEntre(hoy(), a.vencimiento);
  if (d < 0) return { e: 'mal', dias: d, t: `Venció hace ${-d} día${d === -1 ? '' : 's'} (${dm(a.vencimiento)})`, clase: 'mal', corto: 'Vencida' };
  if (d <= (+DB.cfg.dias_aviso || 5)) return { e: 'warn', dias: d, t: d === 0 ? 'Vence HOY' : `Vence en ${d} día${d === 1 ? '' : 's'} (${dm(a.vencimiento)})`, clase: 'warn', corto: d === 0 ? 'Vence hoy' : 'Por vencer' };
  return { e: 'ok', dias: d, t: `Al día hasta el ${dmy(a.vencimiento)}`, clase: 'ok', corto: 'Al día' };
}
const alumnosActivos = () => DB.donde('alumnos', a => a.activo !== false).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
const abonosActivos = () => DB.donde('abonos', a => a.activo !== false);

function renovacion(a, ab) {
  const h = hoy(), v = a.vencimiento;
  const continua = DB.cfg.renovacion !== 'HOY' && v && v >= h;
  const n = +ab.duracion || 1;
  let desde, vence;
  if (continua) { desde = sumarDias(v, 1); vence = ab.tipo === 'DIAS' ? sumarDias(v, n) : sumarDias(sumarMeses(desde, n), -1); }
  else { desde = h; vence = ab.tipo === 'DIAS' ? sumarDias(h, n - 1) : sumarDias(sumarMeses(h, n), -1); }
  return { desde, vence };
}

function validarPagos(pagos, total, permitirCta = true) {
  const lista = (pagos || []).map(p => ({ medio: p.medio, monto: r2(n0(p.monto)) })).filter(p => p.monto > 0);
  if (!lista.length && total > 0) throw new Error('Poné cuánto paga');
  for (const p of lista) if (!p.medio) throw new Error('Elegí el medio de pago');
  if (!permitirCta && lista.some(p => p.medio === CTA)) throw new Error('Una deuda no se puede pagar dejando deuda');
  const suma = r2(lista.reduce((s, p) => s + p.monto, 0));
  if (Math.abs(suma - total) > 0.009) throw new Error(`Los pagos suman ${money2(suma)} y el total es ${money2(total)}`);
  return lista;
}

async function cobrarCuota({ alumno_id, abono_id, importe, descuento, pagos, vence, nota }) {
  DB.verificarEscritura();
  const a = DB.get('alumnos', alumno_id); if (!a) throw new Error('Elegí el alumno');
  const ab = DB.get('abonos', abono_id); if (!ab) throw new Error('Elegí la cuota a cobrar');
  const ren = renovacion(a, ab);
  vence = vence || ren.vence;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vence)) throw new Error('Fecha de vencimiento inválida');
  importe = r2(importe === '' || importe == null ? ab.precio : n0(importe)); descuento = r2(n0(descuento));
  const total = r2(importe - descuento);
  if (total < 0) throw new Error('El descuento no puede ser mayor que el importe');
  const lista = validarPagos(pagos, total);
  const deja = r2(lista.filter(p => p.medio === CTA).reduce((s, p) => s + p.monto, 0));
  const c = await DB.guardar('cobros', { fecha: ahora(), tipo: 'CUOTA', alumno_id: a.id, abono_id: ab.id, concepto: ab.nombre, desde: ren.desde, vence,
    importe, descuento, total, pagos: lista, venc_anterior: a.vencimiento || '', abono_anterior: a.abono_id || null, deuda_generada: deja, nota: nota || '', estado: 'ACTIVO' });
  a.vencimiento = vence; a.abono_id = ab.id; a.saldo = r2((a.saldo || 0) + deja);
  await DB.guardar('alumnos', a);
  await DB.anotar('Cobro de cuota', `${a.nombre} · ${ab.nombre} · ${money2(total)}`);
  return c;
}
async function cobrarDeuda({ alumno_id, monto, pagos }) {
  DB.verificarEscritura();
  const a = DB.get('alumnos', alumno_id); if (!a) throw new Error('Elegí el alumno');
  monto = r2(n0(monto));
  if (monto <= 0) throw new Error('Poné cuánto paga');
  if (monto > r2(a.saldo || 0) + 0.009) throw new Error(`Debe ${money2(a.saldo || 0)}: no puede pagar más que eso`);
  const lista = validarPagos(pagos, monto, false);
  const c = await DB.guardar('cobros', { fecha: ahora(), tipo: 'DEUDA', alumno_id: a.id, concepto: 'Pago de deuda', importe: monto, descuento: 0, total: monto, pagos: lista, estado: 'ACTIVO' });
  a.saldo = r2((a.saldo || 0) - monto); await DB.guardar('alumnos', a);
  await DB.anotar('Pago de deuda', `${a.nombre} · ${money2(monto)}`);
  return c;
}
async function anularCobro(id, motivo) {
  DB.verificarEscritura();
  const c = DB.get('cobros', id); if (!c || c.estado !== 'ACTIVO') throw new Error('Ese cobro no existe o ya estaba anulado');
  if (!motivo || motivo.trim().length < 3) throw new Error('Escribí el motivo');
  const a = DB.get('alumnos', c.alumno_id);
  if (a) {
    if (c.tipo === 'CUOTA') {
      if ((c.deuda_generada || 0) > 0.009 && r2((a.saldo || 0) - c.deuda_generada) < -0.009)
        throw new Error(`Esta cuota dejó una deuda de ${money2(c.deuda_generada)} y ya pagó parte. Primero anulá el pago de la deuda.`);
      const posteriores = DB.donde('cobros', x => x.alumno_id === a.id && x.tipo === 'CUOTA' && x.estado === 'ACTIVO' && x.id > c.id);
      if (!posteriores.length) { a.vencimiento = c.venc_anterior || ''; a.abono_id = c.abono_anterior || a.abono_id; }
      a.saldo = r2((a.saldo || 0) - (c.deuda_generada || 0));
    } else if (c.tipo === 'DEUDA') a.saldo = r2((a.saldo || 0) + c.total);
    await DB.guardar('alumnos', a);
  }
  c.estado = 'ANULADO'; c.anulado = ahora(); c.motivo = motivo.trim();
  await DB.guardar('cobros', c);
  await DB.anotar('Cobro ANULADO', `${a ? a.nombre : ''} · ${money2(c.total)} · ${motivo}`);
}
async function movimiento({ tipo, concepto, categoria, medio, monto, fecha }) {
  DB.verificarEscritura();
  monto = r2(n0(monto));
  if (!['INGRESO', 'GASTO', 'RETIRO'].includes(tipo)) throw new Error('Tipo inválido');
  if (monto <= 0) throw new Error('Poné el importe');
  if (!medio) throw new Error('Elegí el medio');
  const m = await DB.guardar('movimientos', { fecha: (fecha || hoy()) + ahora().slice(10), tipo, concepto: (concepto || '').trim(), categoria: categoria || '', medio, monto, estado: 'ACTIVO' });
  await DB.anotar(tipo === 'INGRESO' ? 'Otro ingreso' : tipo === 'GASTO' ? 'Gasto' : 'Retiro', `${concepto || categoria} · ${money2(monto)}`);
  return m;
}

/* totales de caja entre dos fechas (inclusive) por medio de pago */
function caja(desde, hasta) {
  const enRango = f => f.slice(0, 10) >= desde && f.slice(0, 10) <= hasta;
  const cobros = DB.donde('cobros', c => c.estado === 'ACTIVO' && enRango(c.fecha)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const movs = DB.donde('movimientos', m => m.estado === 'ACTIVO' && enRango(m.fecha)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const medios = {};
  const fila = m => (medios[m] = medios[m] || { medio: m, cuotas: 0, deudas: 0, ingresos: 0, gastos: 0, retiros: 0 });
  let cuotas = 0, deudas = 0, fiado = 0;
  for (const c of cobros) for (const p of c.pagos) {
    if (p.medio === CTA) { fiado += p.monto; continue; }
    if (c.tipo === 'CUOTA') { fila(p.medio).cuotas += p.monto; cuotas += p.monto; } else { fila(p.medio).deudas += p.monto; deudas += p.monto; }
  }
  let ingresos = 0, gastos = 0, retiros = 0;
  for (const m of movs) {
    if (m.tipo === 'INGRESO') { fila(m.medio).ingresos += m.monto; ingresos += m.monto; }
    else if (m.tipo === 'GASTO') { fila(m.medio).gastos += m.monto; gastos += m.monto; }
    else { fila(m.medio).retiros += m.monto; retiros += m.monto; }
  }
  const lista = Object.values(medios).map(x => Object.assign(x, { neto: r2(x.cuotas + x.deudas + x.ingresos - x.gastos - x.retiros) }))
    .sort((a, b) => (DB.cfg.medios.indexOf(a.medio) + 99) % 99 - (DB.cfg.medios.indexOf(b.medio) + 99) % 99);
  const porDia = {};
  for (const c of cobros) for (const p of c.pagos) if (p.medio !== CTA) { const d = c.fecha.slice(0, 10); porDia[d] = porDia[d] || { dia: d, entra: 0, sale: 0 }; porDia[d].entra += p.monto; }
  for (const m of movs) { const d = m.fecha.slice(0, 10); porDia[d] = porDia[d] || { dia: d, entra: 0, sale: 0 }; if (m.tipo === 'INGRESO') porDia[d].entra += m.monto; else porDia[d].sale += m.monto; }
  return { desde, hasta, cobros, movs, medios: lista, cuotas: r2(cuotas), deudas: r2(deudas), ingresos: r2(ingresos), gastos: r2(gastos), retiros: r2(retiros), fiado: r2(fiado),
    entra: r2(cuotas + deudas + ingresos), neto: r2(cuotas + deudas + ingresos - gastos - retiros), dias: Object.values(porDia).sort((a, b) => b.dia.localeCompare(a.dia)),
    nCuotas: cobros.filter(c => c.tipo === 'CUOTA').length };
}

/* ---------------------------------------------------------------- clases con cupo */
const clasesActivas = () => DB.donde('clases', c => c.activo !== false).sort((a, b) => minutos(a.hora) - minutos(b.hora));
const clasesDelDia = f => { const d = diaSemana(f); return clasesActivas().filter(c => (c.dias || []).includes(d)); };
const fijosDe = cid => DB.donde('inscripciones', i => i.clase_id === cid).map(i => DB.get('alumnos', i.alumno_id)).filter(a => a && a.activo !== false);
function listaClase(c, fecha) {
  const res = DB.donde('reservas', r => r.clase_id === c.id && r.fecha === fecha);
  const bajas = new Set(res.filter(r => r.tipo === 'FALTA_AVISO').map(r => r.alumno_id));
  const fijos = fijosDe(c.id).filter(a => !bajas.has(a.id));
  const extras = res.filter(r => r.tipo === 'EXTRA').map(r => DB.get('alumnos', r.alumno_id)).filter(Boolean).filter(a => !fijos.some(f => f.id === a.id));
  const asis = DB.donde('asistencias', x => x.clase_id === c.id && x.fecha === fecha);
  const marca = id => { const x = asis.find(y => y.alumno_id === id); return x ? x.presente : null; };
  const lista = [...fijos.map(a => ({ a, tipo: 'FIJO' })), ...extras.map(a => ({ a, tipo: 'EXTRA' }))].map(x => Object.assign(x, { presente: marca(x.a.id) }))
    .sort((x, y) => x.a.nombre.localeCompare(y.a.nombre, 'es'));
  const avisaron = [...bajas].map(id => DB.get('alumnos', id)).filter(Boolean);
  const ocupados = lista.length, cupo = +c.cupo || 0;
  return { clase: c, fecha, lista, avisaron, ocupados, cupo, libres: cupo ? Math.max(0, cupo - ocupados) : null, presentes: lista.filter(x => x.presente === true).length,
    extrasPresentes: asis.filter(x => x.presente && !lista.some(l => l.a.id === x.alumno_id)).length };
}
function cupoFijo(c) { return fijosDe(c.id).length; }
async function inscribir(alumno_id, clase_id) {
  const c = DB.get('clases', clase_id);
  if (DB.donde('inscripciones', i => i.alumno_id === alumno_id && i.clase_id === clase_id).length) return;
  if (c.cupo && cupoFijo(c) >= +c.cupo) throw new Error(`"${c.nombre} ${c.hora}" está completa (${c.cupo} lugares)`);
  await DB.guardar('inscripciones', { alumno_id, clase_id });
}
async function desinscribir(alumno_id, clase_id) {
  for (const i of DB.donde('inscripciones', i => i.alumno_id === alumno_id && i.clase_id === clase_id)) await DB.borrar('inscripciones', i.id);
}
async function reservaExtra(clase_id, fecha, alumno_id) {
  const c = DB.get('clases', clase_id), l = listaClase(c, fecha);
  if (l.lista.some(x => x.a.id === alumno_id)) throw new Error('Ya está anotado en esa clase');
  if (c.cupo && l.ocupados >= +c.cupo) throw new Error('No hay lugar en esa clase');
  for (const r of DB.donde('reservas', r => r.clase_id === clase_id && r.fecha === fecha && r.alumno_id === alumno_id)) await DB.borrar('reservas', r.id);
  await DB.guardar('reservas', { clase_id, fecha, alumno_id, tipo: 'EXTRA' });
}
async function avisaFalta(clase_id, fecha, alumno_id, quitar) {
  if (quitar) {
    const c = DB.get('clases', clase_id), l = listaClase(c, fecha), avisó = l.avisaron.some(a => a.id === alumno_id);
    if (avisó && c.cupo && l.ocupados >= +c.cupo) throw new Error('Ya no hay lugar: su lugar lo ocupó otro alumno en esta clase');
  }
  for (const r of DB.donde('reservas', r => r.clase_id === clase_id && r.fecha === fecha && r.alumno_id === alumno_id)) await DB.borrar('reservas', r.id);
  if (!quitar) await DB.guardar('reservas', { clase_id, fecha, alumno_id, tipo: 'FALTA_AVISO' });
}
async function marcarAsistencia(clase_id, fecha, alumno_id, presente) {
  const x = DB.donde('asistencias', y => y.clase_id === clase_id && y.fecha === fecha && y.alumno_id === alumno_id)[0];
  if (presente === null) { if (x) await DB.borrar('asistencias', x.id); return; }
  await DB.guardar('asistencias', Object.assign(x || { clase_id, fecha, alumno_id }, { presente }));
}

/* ---------------------------------------------------------------- progreso de calistenia */
const habilidades = () => DB.todos('habilidades').filter(h => h.activo !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.id - b.id);
const pruebas = () => DB.todos('pruebas').filter(p => p.activo !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.id - b.id);
const logrosDe = aid => DB.donde('logros', l => l.alumno_id === aid);
function nivelHabilidad(aid, h) {   // cuántos pasos logró (el más alto)
  const ls = DB.donde('logros', l => l.alumno_id === aid && l.habilidad_id === h.id);
  return ls.length ? Math.max(...ls.map(l => l.paso)) + 1 : 0;
}
const fmtValor = (p, v) => p.unidad === 'seg' ? (v >= 60 ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')} min` : `${num(v)} seg`) : `${num(v)} ${p.unidad || ''}`.trim();
function historialPrueba(aid, pid) { return DB.donde('resultados', r => r.alumno_id === aid && r.prueba_id === pid).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id); }
function mejorDe(p, lista) { if (!lista.length) return null; return lista.reduce((m, r) => (p.mejor === 'menor' ? r.valor < m.valor : r.valor > m.valor) ? r : m); }

/* ---------------------------------------------------------------- datos de arranque */
async function datosIniciales() {
  if (DB.cfg.iniciado) return;
  const soloL = DB.soloLectura; DB.soloLectura = false;
  try {
    await DB.guardar('abonos', { nombre: 'Cuota mensual', precio: 0, duracion: 1, tipo: 'MESES', activo: true });
    const H = [
      ['Dominadas', ['Colgado activo 30 seg', 'Australianas 3x10', 'Negativas 3x5', 'Con banda 3x8', '1 dominada estricta', '5 dominadas', '10 dominadas', '15 dominadas']],
      ['Fondos', ['Fondos en banco 3x12', 'Negativos en paralelas 3x5', '1 fondo en paralelas', '10 fondos', '20 fondos']],
      ['Flexiones', ['De rodillas 3x10', '10 flexiones', '25 flexiones', '10 diamante', 'Arquero 5 por lado', 'A una mano']],
      ['Muscle-up', ['10 dominadas al pecho', 'Transición con banda', 'Negativa de muscle-up', '1 muscle-up', '5 muscle-ups']],
      ['Parada de manos', ['Contra la pared 30 seg', 'Pecho a la pared 60 seg', 'Libre 5 seg', 'Libre 15 seg', 'Libre 30 seg']],
      ['L-sit', ['Tuck en paralelas 15 seg', 'Una pierna 10 seg', 'L-sit 10 seg', 'L-sit 20 seg']],
      ['Front lever', ['Tuck 10 seg', 'Tuck avanzado 10 seg', 'Una pierna 8 seg', 'Straddle 5 seg', 'Completo 5 seg']],
      ['Back lever', ['Skin the cat', 'Tuck 10 seg', 'Tuck avanzado 10 seg', 'Straddle 5 seg', 'Completo 5 seg']],
      ['Planche', ['Planche lean 20 seg', 'Tuck 10 seg', 'Tuck avanzado 8 seg', 'Straddle 5 seg', 'Completa 3 seg']],
      ['Pistol squat', ['20 sentadillas profundas', 'Pistol a un banco 5 por pierna', 'Pistol con ayuda', '1 pistol', '5 pistols por pierna']],
      ['Bandera', ['Agarre vertical (tuck)', 'Tuck 5 seg', 'Straddle 5 seg', 'Completa 3 seg']],
    ];
    let o = 0; for (const [nombre, pasos] of H) await DB.guardar('habilidades', { nombre, orden: ++o, pasos: pasos.map(p => ({ nombre: p })), activo: true });
    const P = [['Dominadas máximas', 'reps'], ['Fondos máximos', 'reps'], ['Flexiones en 1 minuto', 'reps'], ['Colgado en barra', 'seg'], ['Plancha abdominal', 'seg'],
      ['L-sit', 'seg'], ['Sentadillas en 1 minuto', 'reps'], ['Parada de manos contra la pared', 'seg']];
    o = 0; for (const [nombre, unidad] of P) await DB.guardar('pruebas', { nombre, unidad, mejor: 'mayor', orden: ++o, activo: true });
    const R = [
      ['Full body principiante', 'Principiante', [['Movilidad y entrada en calor', '1', '5 min'], ['Remo australiano', '3', '10'], ['Flexiones (de rodillas si hace falta)', '3', '8 a 12'], ['Negativas de dominada', '3', '5 (bajando en 5 seg)'],
        ['Fondos en banco', '3', '10'], ['Sentadillas', '3', '15'], ['Plancha abdominal', '3', '30 seg'], ['Colgado activo', '3', '20 seg']]],
      ['Empuje y tirón intermedio', 'Intermedio', [['Dominadas', '5', '5 a 8'], ['Fondos en paralelas', '4', '8 a 12'], ['Remo australiano pies elevados', '3', '10'], ['Flexiones diamante', '3', '10'],
        ['Tuck front lever', '4', '10 seg'], ['Tuck L-sit', '4', '15 seg'], ['Pistol con ayuda', '3', '6 por pierna'], ['Hollow body', '3', '30 seg']]],
      ['Skills y fuerza avanzado', 'Avanzado', [['Práctica de parada de manos', '1', '10 min'], ['Muscle-up', '5', '3'], ['Dominadas lastradas', '5', '5'], ['Fondos lastrados', '5', '5'],
        ['Front lever (su progresión)', '5', '8 seg'], ['Planche (su progresión)', '5', '8 seg'], ['Pistol squat', '3', '8 por pierna'], ['Dragon flag', '3', '5']]],
    ];
    for (const [nombre, nivel, ej] of R) await DB.guardar('rutinas', { nombre, nivel, ejercicios: ej.map(([n, s, d]) => ({ nombre: n, series: s, dosis: d, descanso: '', nota: '' })), notas: '' });
    await DB.setCfg('iniciado', ahora());
  } finally { DB.soloLectura = soloL; }
}
