/* Alumnos: lista, ficha y alta/modificación. */
'use strict';

let FILTRO_ALU = 'todos', NIVEL_ALU = '', BUSCA_ALU = '';

function horariosTexto(aid) {
  return DB.donde('inscripciones', i => i.alumno_id === aid).map(i => DB.get('clases', i.clase_id)).filter(c => c && c.activo !== false)
    .map(c => `${(c.dias || []).map(d => DIAS_C[d]).join('-')} ${hhmm(c.hora)}`).join(' · ');
}

PANTALLAS.alumnos = async (main) => {
  titulo('Alumnos');
  const todos = DB.todos('alumnos');
  main.innerHTML = `<div class="fila" style="margin-bottom:12px">
      <div class="buscar">${ico('buscar')}<input id="aBus" placeholder="Buscar por nombre, DNI o teléfono" value="${esc(BUSCA_ALU)}" autocomplete="off"></div>
      <select id="aNiv" style="width:auto;min-width:150px">${opciones(DB.cfg.niveles, NIVEL_ALU, 'Todos los niveles')}</select>
      <button class="btn acento" id="aNuevo">${ico('plus')} Alumno</button></div>
    <div class="seg" id="aFil" style="margin-bottom:12px">${[['todos', 'Todos'], ['ok', 'Al día'], ['warn', 'Por vencer'], ['vencidos', 'Vencidos'], ['deben', 'Deben'], ['inactivos', 'Dados de baja']]
      .map(([k, t]) => `<button data-f="${k}" class="${FILTRO_ALU === k ? 'act' : ''}">${t}</button>`).join('')}</div>
    <div class="card" style="padding:6px 14px"><div class="lista" id="aLista"></div></div>`;
  const pintar = () => {
    let l = FILTRO_ALU === 'inactivos' ? todos.filter(a => a.activo === false) : todos.filter(a => a.activo !== false);
    if (FILTRO_ALU === 'ok' || FILTRO_ALU === 'warn') l = l.filter(a => estadoCuota(a).e === FILTRO_ALU);
    if (FILTRO_ALU === 'vencidos') l = l.filter(a => ['mal', 'sin'].includes(estadoCuota(a).e));
    if (FILTRO_ALU === 'deben') l = l.filter(a => (a.saldo || 0) > 0.009);
    if (NIVEL_ALU) l = l.filter(a => a.nivel === NIVEL_ALU);
    if (BUSCA_ALU) l = l.filter(a => coincide(`${a.nombre} ${a.dni || ''} ${a.telefono || ''} ${a.id}`, BUSCA_ALU));
    l.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
    $('#aLista').innerHTML = l.map(a => { const e = estadoCuota(a), h = horariosTexto(a.id);
      return `<div class="it" data-alu="${a.id}">${avatar(a)}<div class="tx"><b>${esc(a.nombre)}</b><small>${a.nivel ? esc(a.nivel) + ' · ' : ''}${h ? esc(h) : 'Sin horario fijo'}</small></div>
        ${(a.saldo || 0) > 0.009 ? `<span class="pill mal">Debe ${money(a.saldo)}</span>` : ''}<span class="pill ${e.clase}">${esc(e.corto || 'Sin cuota')}</span></div>`; }).join('')
      || vacio('alumnos', todos.length ? 'No hay alumnos con ese filtro' : 'Todavía no cargaste alumnos. Tocá "+ Alumno".');
  };
  pintar();
  $('#aBus').oninput = debounce(e => { BUSCA_ALU = e.target.value; pintar(); }, 150);
  $('#aNiv').onchange = e => { NIVEL_ALU = e.target.value; pintar(); };
  $('#aFil').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; FILTRO_ALU = b.dataset.f; $$('#aFil button').forEach(x => x.classList.toggle('act', x === b)); pintar(); };
  $('#aNuevo').onclick = () => editarAlumno({}, a => ir('ficha', { id: a.id }, true));
  $('#aLista').onclick = e => { const b = e.target.closest('[data-alu]'); if (b) ir('ficha', { id: +b.dataset.alu }, true); };
};

function editarAlumno(a, luego) {
  let foto = a.foto || '';
  const abs = abonosActivos();
  const m = modal(a.id ? 'Modificar alumno' : 'Nuevo alumno', `
    <div class="fila" style="margin-bottom:14px"><div id="eaFoto">${avatar(Object.assign({}, a, { foto }), true)}</div>
      <div><label class="btn chico" style="margin:0">${ico('camara')} Sacar o elegir foto<input type="file" accept="image/*" capture="user" id="eaF" hidden></label>
      ${foto ? `<button class="btn chico rojo" id="eaFq" style="margin-left:6px">Quitar</button>` : ''}</div></div>
    <div class="form">
      <div class="campo full"><label>Nombre y apellido</label><input id="ea_n" value="${esc(a.nombre || '')}" autofocus></div>
      <div class="campo"><label>Teléfono / WhatsApp</label><input id="ea_t" type="tel" inputmode="tel" value="${esc(a.telefono || '')}" placeholder="Ej. 364 4123456"></div>
      <div class="campo"><label>DNI</label><input id="ea_d" inputmode="numeric" value="${esc(a.dni || '')}"></div>
      <div class="campo"><label>Fecha de nacimiento</label><input id="ea_na" type="date" value="${esc(a.nacimiento || '')}"></div>
      <div class="campo full" id="eaMenor" hidden><div class="chico" style="background:var(--warn-bg);color:var(--warn);border-radius:10px;padding:10px 12px;font-weight:700">${ico('alerta')} Es menor de edad: para guardar sus datos y su foto conviene tener la autorización del padre, madre o tutor.</div></div>
      <div class="campo"><label>Nivel</label><select id="ea_ni">${opciones(DB.cfg.niveles, a.nivel || DB.cfg.niveles[0])}</select></div>
      <div class="campo"><label>Cuota que paga</label><select id="ea_ab">${opciones(abs.map(x => ({ v: x.id, t: `${x.nombre} · ${money(x.precio)}` })), a.abono_id || (abs[0] && abs[0].id))}</select></div>
      <div class="campo"><label>Apto médico vence</label><input id="ea_ap" type="date" value="${esc(a.apto || '')}"></div>
      <div class="campo full"><label>Contacto de emergencia</label><input id="ea_em" value="${esc(a.emergencia || '')}" placeholder="Nombre y teléfono"></div>
      <div class="campo full"><label>Lesiones, objetivos u observaciones</label><textarea id="ea_o">${esc(a.notas || '')}</textarea></div>
      ${a.id ? `<div class="campo full"><label class="chk"><input type="checkbox" id="ea_ac" ${a.activo !== false ? 'checked' : ''}> Sigue entrenando (si lo destildás queda como dado de baja)</label></div>` : ''}
    </div>`, `${a.id ? `<button class="btn rojo" id="eaBorrar">${ico('trash')} Borrar definitivamente</button>` : ''}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="eaOk">${ico('check')} Guardar</button>`, 'ancho');
  const menor = () => { const e = edad(val('ea_na', m)); $('#eaMenor', m).hidden = !(e !== null && e < 18); };
  $('#ea_na', m).addEventListener('change', menor); $('#ea_na', m).addEventListener('input', menor); menor();
  if ($('#eaBorrar', m)) $('#eaBorrar', m).onclick = () => { m.cerrar(); borrarAlumnoUI(a); };
  const pintarFoto = () => { $('#eaFoto', m).innerHTML = avatar(Object.assign({}, a, { nombre: val('ea_n', m) || a.nombre, foto }), true); };
  $('#eaF', m).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { foto = await leerFoto(f); pintarFoto(); } catch (x) { fallo(x); } };
  if ($('#eaFq', m)) $('#eaFq', m).onclick = () => { foto = ''; pintarFoto(); };
  $('#eaOk', m).onclick = async () => {
    try {
      const nombre = val('ea_n', m).replace(/\s+/g, ' ');
      if (nombre.length < 2) throw new Error('Escribí el nombre');
      const dni = val('ea_d', m).replace(/\D/g, '');
      if (dni && DB.todos('alumnos').some(x => x.dni === dni && x.id !== a.id)) throw new Error('Ya hay un alumno con ese DNI');
      const o = Object.assign(a, { nombre, telefono: val('ea_t', m), dni, nacimiento: val('ea_na', m), nivel: val('ea_ni', m), abono_id: +val('ea_ab', m) || null,
        apto: val('ea_ap', m), emergencia: val('ea_em', m), notas: val('ea_o', m), foto, activo: a.id ? $('#ea_ac', m).checked : true });
      if (!o.id) { o.alta = hoy(); o.saldo = 0; o.vencimiento = ''; }
      const g = await DB.guardar('alumnos', o);
      await DB.anotar(a.creado ? 'Alumno modificado' : 'Alumno nuevo', nombre);
      m.cerrar(); toast('Guardado'); luego && luego(g);
    } catch (e) { fallo(e); }
  };
}

let TAB_FICHA = 'datos';
PANTALLAS.ficha = async (main, { id }) => {
  const a = DB.get('alumnos', id); if (!a) { main.innerHTML = vacio('alumnos', 'Ese alumno no existe'); return; }
  titulo(a.nombre);
  const e = estadoCuota(a), ed = edad(a.nacimiento);
  const apto = a.apto ? diasEntre(hoy(), a.apto) : null;
  main.innerHTML = `<div class="card"><div class="ficha-cab">${avatar(a, true)}<div class="tx"><h2>${esc(a.nombre)}</h2>
      <div class="fila">${a.nivel ? `<span class="lvl">${esc(a.nivel)}</span>` : ''}${a.activo === false ? '<span class="pill mal">Dado de baja</span>' : ''}
        <span class="muted chico">Socio N° ${a.id}${ed !== null ? ` · ${ed} años` : ''}${a.dni ? ' · DNI ' + esc(a.dni) : ''}</span></div></div>
      <div class="fila">${a.telefono ? `<button class="btn" id="fWa">${ico('wa')} WhatsApp</button>` : ''}<button class="btn" id="fEd">${ico('lapiz')} Modificar</button></div></div>
      ${apto !== null && apto < 15 ? `<p class="${apto < 0 ? 'mal' : 'warn'}" style="margin:12px 0 0;font-weight:700">${ico('alerta')} Apto médico ${apto < 0 ? 'vencido el' : 'vence el'} ${dmy(a.apto)}</p>` : ''}
      ${a.notas ? `<p class="muted" style="margin:10px 0 0;white-space:pre-wrap">${esc(a.notas)}</p>` : ''}</div>
    <div class="estado-cuota ${e.clase}" style="margin-bottom:14px"><div class="tx"><b>${esc(e.t)}</b>
      <div class="chico">${a.abono_id && DB.get('abonos', a.abono_id) ? esc(DB.get('abonos', a.abono_id).nombre) + ' · ' + money(DB.get('abonos', a.abono_id).precio) : 'Sin cuota asignada'}${(a.saldo || 0) > 0.009 ? ` · <b class="mal">Debe ${money2(a.saldo)}</b>` : ''}</div></div>
      ${(a.saldo || 0) > 0.009 ? `<button class="btn" id="fDeu">Cobrar deuda</button>` : ''}
      ${e.e !== 'ok' && a.telefono ? `<button class="btn" id="fRec">${ico('wa')} Recordar</button>` : ''}<button class="btn acento" id="fCob">${ico('caja')} Cobrar cuota</button></div>
    <div class="tabsf" id="fTabs">${[['datos', 'Horarios y datos'], ['progreso', 'Progreso'], ['pruebas', 'Pruebas'], ['cuotas', 'Pagos'], ['asis', 'Asistencia']]
      .map(([k, t]) => `<button data-t="${k}" class="${TAB_FICHA === k ? 'act' : ''}">${t}</button>`).join('')}</div>
    <div id="fCuerpo"></div>`;
  const re = () => ir('ficha', { id }, false).then(() => { $('#btnAtras').hidden = !PILA.length; });
  $('#fEd').onclick = () => editarAlumno(a, re);
  if ($('#fWa')) $('#fWa').onclick = () => abrirWa(a.telefono, `Hola ${a.nombre.split(' ')[0]}! `);
  if ($('#fRec')) $('#fRec').onclick = () => recordarCuota(a);
  $('#fCob').onclick = () => cobrar(a.id, re);
  if ($('#fDeu')) $('#fDeu').onclick = () => cobrarDeudaUI(a.id, re);
  const tab = () => {
    const c = $('#fCuerpo');
    if (TAB_FICHA === 'datos') fichaDatos(a, c, re);
    else if (TAB_FICHA === 'progreso') fichaProgreso(a, c);
    else if (TAB_FICHA === 'pruebas') fichaPruebas(a, c);
    else if (TAB_FICHA === 'cuotas') fichaPagos(a, c, re);
    else fichaAsistencia(a, c);
  };
  $('#fTabs').onclick = ev => { const b = ev.target.closest('[data-t]'); if (!b) return; TAB_FICHA = b.dataset.t; $$('#fTabs button').forEach(x => x.classList.toggle('act', x === b)); tab(); };
  tab();
};

function fichaDatos(a, c, re) {
  const clases = clasesActivas(), mias = new Set(DB.donde('inscripciones', i => i.alumno_id === a.id).map(i => i.clase_id));
  c.innerHTML = `<div class="card"><h2>${ico('clases')} Horarios fijos<span class="sp"></span><span class="muted chico">Tocá para anotarlo o sacarlo</span></h2>
      ${clases.length ? `<div class="pasos">${clases.map(k => { const n = cupoFijo(k), lleno = k.cupo && n >= +k.cupo && !mias.has(k.id);
        return `<button class="paso ${mias.has(k.id) ? 'logrado' : ''}" data-ins="${k.id}" ${lleno ? 'disabled style="opacity:.45"' : ''}>${mias.has(k.id) ? ico('check') : ''}
          ${(k.dias || []).map(d => DIAS_C[d]).join('-')} ${hhmm(k.hora)} · ${esc(k.nombre)} <span class="muted">(${n}${k.cupo ? '/' + k.cupo : ''})</span></button>`; }).join('')}</div>`
        : vacio('clases', 'Primero cargá los horarios en Clases')}</div>
    <div class="card"><h2>${ico('usuario')} Datos</h2><div class="grid g2 chico">
      <div><span class="muted">Teléfono</span><br><b>${esc(a.telefono || '—')}</b></div><div><span class="muted">Nacimiento</span><br><b>${a.nacimiento ? dmy(a.nacimiento) : '—'}</b></div>
      <div><span class="muted">Emergencia</span><br><b>${esc(a.emergencia || '—')}</b></div><div><span class="muted">Apto médico</span><br><b>${a.apto ? 'vence ' + dmy(a.apto) : '—'}</b></div>
      <div><span class="muted">Alta</span><br><b>${a.alta ? dmy(a.alta) : '—'}</b></div><div><span class="muted">Rutina de su nivel</span><br>
        ${DB.donde('rutinas', r => r.nivel === a.nivel).map(r => `<button class="btn chico" data-rut="${r.id}">${ico('rutina')} ${esc(r.nombre)}</button>`).join(' ') || '<b>—</b>'}</div></div></div>`;
  c.onclick = async e => {
    const b = e.target.closest('[data-ins],[data-rut]'); if (!b) return;
    if (b.dataset.rut) return verRutina(DB.get('rutinas', b.dataset.rut), a);
    const cid = +b.dataset.ins;
    try { if (mias.has(cid)) await desinscribir(a.id, cid); else await inscribir(a.id, cid); fichaDatos(a, c, re); } catch (x) { fallo(x); }
  };
}

function fichaPagos(a, c, re) {
  const l = DB.donde('cobros', x => x.alumno_id === a.id).sort((x, y) => y.fecha.localeCompare(x.fecha));
  c.innerHTML = `<div class="card" style="padding:6px 14px"><div class="lista">${l.map(x => `<div class="it" data-cb="${x.id}" style="${x.estado !== 'ACTIVO' ? 'opacity:.5' : ''}">
      <div class="tx"><b>${x.tipo === 'CUOTA' ? esc(x.concepto) + ` · hasta ${dmy(x.vence)}` : 'Pago de deuda'}</b><small>${dmy(x.fecha)} ${x.fecha.slice(11)} · ${x.pagos.map(p => esc(p.medio)).join(' + ')}${x.estado !== 'ACTIVO' ? ' · ANULADO: ' + esc(x.motivo) : ''}</small></div>
      <b class="num">${money2(x.total)}</b></div>`).join('') || vacio('caja', 'Todavía no pagó nada')}</div></div>`;
  c.onclick = e => { const b = e.target.closest('[data-cb]'); if (b) verCobro(+b.dataset.cb, re); };
}

function fichaAsistencia(a, c) {
  const desde = sumarDias(hoy(), -60);
  const l = DB.donde('asistencias', x => x.alumno_id === a.id && x.fecha >= desde).sort((x, y) => y.fecha.localeCompare(x.fecha));
  const vino = l.filter(x => x.presente).length, falto = l.filter(x => x.presente === false).length;
  const sem = {}; for (const x of l.filter(x => x.presente)) { const k = lunesDe(x.fecha); sem[k] = (sem[k] || 0) + 1; }
  const prom = Object.keys(sem).length ? (vino / 8.6) : 0;
  c.innerHTML = `<div class="kpis"><div class="kpi"><small>Vino (60 días)</small><b>${vino}</b></div><div class="kpi"><small>Faltó</small><b class="${falto ? 'mal' : ''}">${falto}</b></div>
      <div class="kpi"><small>Por semana</small><b>${num(Math.round(prom * 10) / 10)}</b><div class="sub">promedio</div></div><div class="kpi"><small>Asistencia</small><b>${vino + falto ? Math.round(vino / (vino + falto) * 100) + '%' : '—'}</b></div></div>
    <div class="card" style="padding:6px 14px"><div class="lista">${l.map(x => { const k = DB.get('clases', x.clase_id);
      return `<div class="it" style="cursor:default"><div class="tx"><b>${esc(fechaLarga(x.fecha))}</b><small>${k ? hhmm(k.hora) + ' · ' + esc(k.nombre) : ''}</small></div><span class="pill ${x.presente ? 'ok' : 'mal'}">${x.presente ? 'Vino' : 'Faltó'}</span></div>`; }).join('')
      || vacio('clases', 'Sin asistencias en los últimos 60 días')}</div></div>`;
}

/* buscador de alumnos para elegir uno (cobrar, anotar en clase) */
function elegirAlumno(tituloV, luego, filtro) {
  const m = modal(tituloV, `<div class="buscar" style="margin-bottom:10px">${ico('buscar')}<input id="elB" placeholder="Nombre, DNI o N° de socio" autofocus autocomplete="off"></div><div class="lista" id="elL"></div>`,
    `<button class="btn" data-cerrar>Cancelar</button>`);
  const p = q => {
    let l = alumnosActivos(); if (filtro) l = l.filter(filtro);
    if (q) l = l.filter(a => coincide(`${a.nombre} ${a.dni || ''} ${a.id}`, q));
    $('#elL', m).innerHTML = l.slice(0, 60).map(a => { const e = estadoCuota(a); return `<div class="it" data-el="${a.id}">${avatar(a)}<div class="tx"><b>${esc(a.nombre)}</b><small>${esc(a.nivel || '')}</small></div><span class="pill ${e.clase}">${esc(e.corto || 'Sin cuota')}</span></div>`; }).join('') || vacio('alumnos', 'No hay alumnos');
  };
  p('');
  $('#elB', m).oninput = e => p(e.target.value);
  $('#elL', m).onclick = e => { const b = e.target.closest('[data-el]'); if (b) { m.cerrar(); luego(DB.get('alumnos', b.dataset.el)); } };
}

/* borrar a una persona del todo (lo pide la Ley 25.326 si la persona lo solicita). Los cobros quedan en la caja sin el nombre. */
async function borrarAlumno(id) {
  DB.verificarEscritura();
  const a = DB.get('alumnos', id); if (!a) throw new Error('Ese alumno no existe');
  for (const t of ['inscripciones', 'reservas', 'asistencias', 'logros', 'resultados'])
    for (const x of DB.donde(t, x => x.alumno_id === a.id)) await DB.borrar(t, x.id);
  for (const c of DB.donde('cobros', c => c.alumno_id === a.id)) { c.alumno_id = null; c.alumno_borrado = true; await DB.guardar('cobros', c); }
  await DB.borrar('alumnos', a.id);
  await DB.anotar('Alumno borrado definitivamente', `N° ${a.id}`);
}
async function borrarAlumnoUI(a) {
  if (DB.cfg.pin && !DESBLOQUEADO && !await pedirPin('borrar un alumno')) return;
  const deuda = (a.saldo || 0) > 0.009;
  if (!await confirmar(`Se borran <b>para siempre</b> los datos de <b>${esc(a.nombre)}</b>: ficha, foto, horarios, asistencias, logros y pruebas.
      Sus pagos quedan en la caja pero sin el nombre.${deuda ? `<br><br><b class="mal">Ojo: debe ${money2(a.saldo)}.</b>` : ''}
      <br><br><span class="muted chico">Si sólo dejó de venir, mejor destildá "Sigue entrenando" (queda como dado de baja). Las copias de seguridad hechas antes pueden seguir teniendo sus datos.</span>`, 'Borrar para siempre', true)) return;
  try { await borrarAlumno(a.id); toast('Alumno borrado'); ir('alumnos'); } catch (e) { fallo(e); }
}
