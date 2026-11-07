/* Clases por horario con cupo: semana, lista de cada clase y asistencia. */
'use strict';

let SEM_CLASES = null;
const COLORES = ['#f26a2e', '#e2372b', '#f8a13c', '#1b1e24', '#2d6fd6', '#22995a', '#8b5cf6'];

PANTALLAS.clases = async (main) => {
  titulo('Clases');
  SEM_CLASES = SEM_CLASES || lunesDe(hoy());
  const dias = [0, 1, 2, 3, 4, 5, 6].map(i => sumarDias(SEM_CLASES, i));
  const hay = clasesActivas().length;
  main.innerHTML = `<div class="fila" style="margin-bottom:12px"><button class="btn" id="csA" aria-label="Semana anterior">‹</button>
      <b style="font-size:16px">Semana del ${dm(dias[0])} al ${dm(dias[6])}</b><button class="btn" id="csS" aria-label="Semana siguiente">›</button>
      ${SEM_CLASES !== lunesDe(hoy()) ? '<button class="btn chico" id="csH">Esta semana</button>' : ''}<span class="sp"></span>
      <button class="btn" id="csAd">${ico('lapiz')} Horarios</button><button class="btn acento" id="csN">${ico('plus')} Clase</button></div>
    ${hay ? `<div class="semana">${dias.filter(f => clasesDelDia(f).length || diaSemana(f) !== 0).map(f => `<div class="dia ${f === hoy() ? 'hoy' : ''}"><h4>${DIAS_C[diaSemana(f)]} ${dm(f)}</h4>
      ${clasesDelDia(f).map(c => claseCard(c, f)).join('') || '<div class="muted chico" style="padding:6px 0">—</div>'}</div>`).join('')}</div>`
      : `<div class="card">${vacio('clases', 'Cargá los horarios de las clases: por ejemplo "Principiantes" lunes, miércoles y viernes a las 18:00, cupo 12.')}<div style="text-align:center"><button class="btn acento" id="csN2">${ico('plus')} Cargar la primera clase</button></div></div>`}`;
  const re = () => PANTALLAS.clases(main);
  $('#csA').onclick = () => { SEM_CLASES = sumarDias(SEM_CLASES, -7); re(); };
  $('#csS').onclick = () => { SEM_CLASES = sumarDias(SEM_CLASES, 7); re(); };
  if ($('#csH')) $('#csH').onclick = () => { SEM_CLASES = lunesDe(hoy()); re(); };
  $('#csN').onclick = () => editarClase({}, re); if ($('#csN2')) $('#csN2').onclick = () => editarClase({}, re);
  $('#csAd').onclick = () => adminHorarios(re);
  main.onclick = e => { const b = e.target.closest('[data-clase]'); if (b) ir('asistencia', { clase: +b.dataset.clase, fecha: b.dataset.fecha }, true); };
};

function adminHorarios(luego) {
  const l = DB.todos('clases').slice().sort((a, b) => (a.activo === false) - (b.activo === false) || minutos(a.hora) - minutos(b.hora));
  const m = modal('Horarios de las clases', `<div class="lista">${l.map(c => `<div class="it" data-ec="${c.id}" style="${c.activo === false ? 'opacity:.5' : ''}">
      <div class="av" style="background:${esc(c.color || '#1b1e24')};color:#fff">${hhmm(c.hora).slice(0, 2)}</div><div class="tx"><b>${esc(c.nombre)} · ${hhmm(c.hora)}</b>
      <small>${(c.dias || []).map(d => DIAS_C[d]).join(', ')} · ${c.cupo ? 'cupo ' + c.cupo : 'sin cupo'} · ${cupoFijo(c)} fijos${c.profe ? ' · ' + esc(c.profe) : ''}${c.activo === false ? ' · ya no se da' : ''}</small></div>${ico('flecha')}</div>`).join('') || vacio('clases', 'No hay clases')}</div>`,
    `<button class="btn" data-cerrar>Cerrar</button><button class="btn acento" id="ahN">${ico('plus')} Clase</button>`);
  $('#ahN', m).onclick = () => { m.cerrar(); editarClase({}, luego); };
  m.querySelector('.lista').onclick = e => { const b = e.target.closest('[data-ec]'); if (b) { m.cerrar(); editarClase(DB.get('clases', b.dataset.ec), luego); } };
}

function editarClase(c, luego) {
  const dias = new Set(c.dias || []);
  const m = modal(c.id ? 'Modificar clase' : 'Nueva clase', `<div class="form">
    <div class="campo full"><label>Nombre</label><input id="ec_n" value="${esc(c.nombre || '')}" placeholder="Ej. Principiantes, Avanzados, Skills, Funcional" autofocus></div>
    <div class="campo full"><label>Días</label><div class="pasos" id="ecD">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" class="paso ${dias.has(d) ? 'logrado' : ''}" data-d="${d}">${DIAS[d]}</button>`).join('')}</div></div>
    <div class="campo"><label>Hora</label><input type="time" id="ec_h" value="${esc(c.hora || '18:00')}"></div>
    <div class="campo"><label>Dura (minutos)</label><input id="ec_du" inputmode="numeric" value="${esc(c.duracion || 60)}"></div>
    <div class="campo"><label>Cupo (lugares)</label><input id="ec_c" inputmode="numeric" value="${esc(c.cupo ?? 12)}"><div class="muted chico">0 = sin límite</div></div>
    <div class="campo"><label>Nivel (opcional)</label><select id="ec_ni">${opciones(DB.cfg.niveles, c.nivel || '', 'Todos los niveles')}</select></div>
    <div class="campo"><label>Profe (opcional)</label><input id="ec_p" value="${esc(c.profe || '')}"></div>
    <div class="campo"><label>Color</label><div class="pasos" id="ecCo">${COLORES.map(x => `<button type="button" class="paso" data-co="${x}" style="width:40px;background:${x};${(c.color || COLORES[0]) === x ? 'outline:3px solid var(--txt);outline-offset:2px' : ''}">&nbsp;</button>`).join('')}</div></div>
    ${c.id ? `<div class="campo full"><label class="chk"><input type="checkbox" id="ec_ac" ${c.activo !== false ? 'checked' : ''}> Se sigue dando (si la destildás, deja de aparecer)</label></div>` : ''}</div>`,
    `${c.id ? `<button class="btn rojo" id="ecB">${ico('trash')} Borrar</button>` : ''}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ecOk">${ico('check')} Guardar</button>`, 'ancho');
  let color = c.color || COLORES[0];
  $('#ecD', m).onclick = e => { const b = e.target.closest('[data-d]'); if (!b) return; const d = +b.dataset.d; dias.has(d) ? dias.delete(d) : dias.add(d); b.classList.toggle('logrado'); };
  $('#ecCo', m).onclick = e => { const b = e.target.closest('[data-co]'); if (!b) return; color = b.dataset.co; $$('#ecCo [data-co]', m).forEach(x => (x.style.outline = x === b ? '3px solid var(--txt)' : '')); };
  $('#ecOk', m).onclick = async () => {
    try {
      const nombre = val('ec_n', m); if (!nombre) throw new Error('Poné el nombre de la clase');
      if (!dias.size) throw new Error('Elegí al menos un día');
      const cupo = parseInt(val('ec_c', m)) || 0;
      if (c.id && cupo && cupoFijo(c) > cupo) throw new Error(`Ya hay ${cupoFijo(c)} alumnos fijos: el cupo no puede ser menor`);
      Object.assign(c, { nombre, dias: [...dias].sort(), hora: val('ec_h', m) || '18:00', duracion: parseInt(val('ec_du', m)) || 60, cupo, nivel: val('ec_ni', m), profe: val('ec_p', m), color,
        activo: c.id ? $('#ec_ac', m).checked : true });
      await DB.guardar('clases', c); await DB.anotar('Clase guardada', `${nombre} ${c.hora}`);
      m.cerrar(); toast('Guardado'); luego && luego();
    } catch (e) { fallo(e); }
  };
  if ($('#ecB', m)) $('#ecB', m).onclick = async () => {
    const usada = DB.donde('asistencias', x => x.clase_id === c.id).length;
    if (usada) return toast('Esa clase ya tiene asistencias: destildá "Se sigue dando" en vez de borrarla', true);
    if (!await confirmar(`¿Borrar la clase ${esc(c.nombre)} ${c.hora}?`, 'Borrar', true)) return;
    for (const i of DB.donde('inscripciones', i => i.clase_id === c.id)) await DB.borrar('inscripciones', i.id);
    for (const r of DB.donde('reservas', r => r.clase_id === c.id)) await DB.borrar('reservas', r.id);
    await DB.borrar('clases', c.id); m.cerrar(); toast('Clase borrada'); luego && luego();
  };
}

PANTALLAS.asistencia = async (main, { clase, fecha }) => {
  const c = DB.get('clases', clase); if (!c) { main.innerHTML = vacio('clases', 'Esa clase no existe'); return; }
  titulo(`${c.nombre} ${hhmm(c.hora)}`);
  const l = listaClase(c, fecha);
  main.innerHTML = `<div class="card"><div class="fila"><div class="sp"><h2 style="margin:0">${esc(c.nombre)} · ${hhmm(c.hora)}</h2>
      <div class="muted">${esc(fechaLarga(fecha))}${c.profe ? ' · ' + esc(c.profe) : ''}${c.nivel ? ' · ' + esc(c.nivel) : ''}</div></div>
      <div style="text-align:right"><b style="font-size:26px">${l.ocupados}${l.cupo ? '/' + l.cupo : ''}</b><div class="muted chico">${l.cupo ? (l.libres ? `${l.libres} lugar${l.libres === 1 ? '' : 'es'} libre${l.libres === 1 ? '' : 's'}` : 'COMPLETA') : 'anotados'}</div></div></div>
      ${l.cupo ? `<div class="cupo ${l.ocupados >= l.cupo ? 'lleno' : l.ocupados >= l.cupo * .8 ? 'casi' : ''}"><i style="width:${Math.min(100, l.ocupados / l.cupo * 100)}%"></i></div>` : ''}
      <div class="fila" style="margin-top:12px"><button class="btn" id="asT">${ico('check')} Vinieron todos</button><button class="btn" id="asE" ${l.cupo && !l.libres ? 'disabled' : ''}>${ico('plus')} Agregar alumno (clase suelta)</button>
        <span class="sp"></span><span class="pill ok">${l.presentes} vinieron</span></div></div>
    <div class="card" style="padding:6px 14px">${l.lista.map(x => { const e = estadoCuota(x.a);
      return `<div class="asis">${avatar(x.a)}<div class="tx" data-alu="${x.a.id}" style="cursor:pointer"><b>${esc(x.a.nombre)}</b><small class="muted">${x.tipo === 'EXTRA' ? 'Clase suelta / recupera · ' : ''}${esc(x.a.nivel || '')}</small>
        <div><span class="pill ${e.clase}">${esc(e.corto || 'Sin cuota')}</span>${(x.a.saldo || 0) > 0.009 ? ` <span class="pill mal">Debe ${money(x.a.saldo)}</span>` : ''}</div></div>
        ${x.tipo === 'FIJO' && x.presente === null ? `<button class="ib" data-av="${x.a.id}" title="Avisó que no viene">${ico('x')}</button>` : x.tipo === 'EXTRA' && x.presente === null ? `<button class="ib" data-qx="${x.a.id}" title="Sacar de esta clase">${ico('trash')}</button>` : ''}
        <button class="tg ${x.presente === true ? 'si' : x.presente === false ? 'no' : ''}" data-as="${x.a.id}">${x.presente === true ? '✓ Vino' : x.presente === false ? 'Faltó' : 'Tocá si vino'}</button></div>`; }).join('')
      || vacio('alumnos', 'No hay nadie anotado. Anotá alumnos fijos desde su ficha o agregá uno para esta clase.')}</div>
    ${l.avisaron.length ? `<div class="card"><h2>Avisaron que no vienen</h2>${l.avisaron.map(a => `<div class="it" style="cursor:default">${avatar(a)}<div class="tx"><b>${esc(a.nombre)}</b><small>Su lugar queda libre para esta clase</small></div><button class="btn chico" data-vv="${a.id}">Sí viene</button></div>`).join('')}</div>` : ''}`;
  const re = () => PANTALLAS.asistencia(main, { clase, fecha });
  $('#asT').onclick = async () => { try { for (const x of l.lista) if (x.presente === null) await marcarAsistencia(c.id, fecha, x.a.id, true); re(); } catch (e) { fallo(e); } };
  $('#asE').onclick = () => elegirAlumno('Agregar a esta clase', async a => { try { await reservaExtra(c.id, fecha, a.id); toast(`${a.nombre} anotado para esta clase`); re(); } catch (e) { fallo(e); } },
    a => !l.lista.some(x => x.a.id === a.id));
  main.onclick = async e => {
    const b = e.target.closest('[data-as],[data-av],[data-vv],[data-qx],[data-alu]'); if (!b) return;
    try {
      if (b.dataset.as) { const x = l.lista.find(y => y.a.id === +b.dataset.as); await marcarAsistencia(c.id, fecha, x.a.id, x.presente === null ? true : x.presente === true ? false : null); return re(); }
      if (b.dataset.av) { await avisaFalta(c.id, fecha, +b.dataset.av); toast('Anotado: avisó que no viene'); return re(); }
      if (b.dataset.vv) { await avisaFalta(c.id, fecha, +b.dataset.vv, true); return re(); }
      if (b.dataset.qx) { await avisaFalta(c.id, fecha, +b.dataset.qx, true); return re(); }
      if (b.dataset.alu) return ir('ficha', { id: +b.dataset.alu }, true);
    } catch (er) { fallo(er); }
  };
};
