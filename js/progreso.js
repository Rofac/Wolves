/* Calistenia: habilidades con progresiones, logros de cada alumno, pruebas cada tanto y rutinas por nivel. */
'use strict';

function spark(lista, mejorMenor) {
  if (lista.length < 2) return '';
  const v = lista.map(r => r.valor), mn = Math.min(...v), mx = Math.max(...v), W = 220, H = 56, pad = 6;
  const x = i => pad + i * (W - pad * 2) / (v.length - 1), y = n => H - pad - (mx === mn ? .5 : (n - mn) / (mx - mn)) * (H - pad * 2);
  const pts = v.map((n, i) => `${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="#f26a2e" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${v.map((n, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(n).toFixed(1)}" r="${i === v.length - 1 ? 4 : 2.5}" fill="${i === v.length - 1 ? '#e2372b' : '#f26a2e'}"/>`).join('')}</svg>`;
}

/* ---------- ficha: progreso ---------- */
function fichaProgreso(a, c) {
  const hs = habilidades(), ls = logrosDe(a.id);
  const total = hs.reduce((s, h) => s + h.pasos.length, 0), hechos = hs.reduce((s, h) => s + nivelHabilidad(a.id, h), 0);
  c.innerHTML = `<div class="kpis"><div class="kpi oscuro"><small>Pasos logrados</small><b>${hechos}</b><div class="sub">de ${total}</div></div>
      <div class="kpi"><small>Último logro</small><b style="font-size:16px">${ls.length ? (() => { const u = ls.slice().sort((x, y) => y.fecha.localeCompare(x.fecha) || y.id - x.id)[0], h = DB.get('habilidades', u.habilidad_id); return h ? esc(h.nombre) + ': ' + esc(h.pasos[u.paso]?.nombre || '') : '—'; })() : '—'}</b></div></div>
    <p class="muted chico" style="margin-top:0">Tocá un paso cuando lo logra. Los pasos anteriores se toman como logrados.</p>
    ${hs.map(h => { const n = nivelHabilidad(a.id, h);
      return `<div class="skill"><h4>${esc(h.nombre)}<span class="sp" style="flex:1"></span><span class="muted chico">${n}/${h.pasos.length}</span></h4>
        <div class="barra-sk"><i style="width:${h.pasos.length ? n / h.pasos.length * 100 : 0}%"></i></div>
        <div class="pasos">${h.pasos.map((p, i) => { const l = ls.find(x => x.habilidad_id === h.id && x.paso === i);
          return `<button class="paso ${i < n ? 'logrado' : ''}" data-h="${h.id}" data-p="${i}" title="${l ? 'Logrado el ' + dmy(l.fecha) : ''}"><span class="n">${i < n ? '✓' : i + 1}</span>${esc(p.nombre)}${l ? ` <small style="opacity:.75">${dm(l.fecha)}</small>` : ''}</button>`; }).join('')}</div></div>`; }).join('')
      || vacio('progreso', 'No hay habilidades cargadas (Calistenia > Habilidades)')}`;
  c.onclick = async e => {
    const b = e.target.closest('[data-h]'); if (!b) return;
    const h = DB.get('habilidades', b.dataset.h), i = +b.dataset.p, n = nivelHabilidad(a.id, h);
    try {
      if (i < n) {
        if (!await confirmar(`¿Sacar "${esc(h.pasos[i].nombre)}"${i < n - 1 ? ' y los pasos que siguen' : ''} de los logros de ${esc(a.nombre)}?`, 'Sacar', true)) return;
        for (const l of DB.donde('logros', l => l.alumno_id === a.id && l.habilidad_id === h.id && l.paso >= i)) await DB.borrar('logros', l.id);
      } else {
        await DB.guardar('logros', { alumno_id: a.id, habilidad_id: h.id, paso: i, fecha: hoy() });
        await DB.anotar('Logro', `${a.nombre}: ${h.nombre} · ${h.pasos[i].nombre}`);
        fichaProgreso(a, c);
        if (a.telefono && await confirmar(`🏆 ¡${esc(a.nombre.split(' ')[0])} logró <b>${esc(h.nombre)}: ${esc(h.pasos[i].nombre)}</b>! ¿Le mandás la felicitación por WhatsApp?`, 'Mandar'))
          abrirWa(a.telefono, `🔥 ¡Felicitaciones ${a.nombre.split(' ')[0]}! Lograste ${h.nombre}: ${h.pasos[i].nombre}. ¡Sigamos así! 💪 — ${DB.cfg.nombre}`);
        return;
      }
      fichaProgreso(a, c);
    } catch (er) { fallo(er); }
  };
}

/* ---------- ficha: pruebas ---------- */
function fichaPruebas(a, c) {
  const ps = pruebas();
  c.innerHTML = `<div class="fila" style="margin-bottom:12px"><span class="muted chico sp">Cada tanto tomale las pruebas para ver cómo mejora.</span><button class="btn acento" id="fpN">${ico('test')} Cargar resultados</button></div>
    <div class="grid g2">${ps.map(p => { const hs = historialPrueba(a.id, p.id), u = hs[hs.length - 1], ant = hs[hs.length - 2], mj = mejorDe(p, hs);
      const dif = u && ant ? r2(u.valor - ant.valor) : null, bien = dif !== null && (p.mejor === 'menor' ? dif < 0 : dif > 0);
      return `<div class="card" data-pr="${p.id}" style="cursor:pointer;margin:0"><div class="fila"><b class="sp">${esc(p.nombre)}</b>${u ? `<span class="muted chico">${dmy(u.fecha)}</span>` : ''}</div>
        ${u ? `<div class="fila" style="align-items:baseline"><b style="font-size:28px">${esc(fmtValor(p, u.valor))}</b>${dif !== null && dif !== 0 ? `<span class="mejora ${bien ? 'ok' : 'mal'}">${dif > 0 ? '▲ +' : '▼ −'}${esc(fmtValor(p, Math.abs(dif)))}</span>` : ''}</div>
          <div class="muted chico">Mejor marca: ${esc(fmtValor(p, mj.valor))} (${dmy(mj.fecha)}) · ${hs.length} ${hs.length === 1 ? 'vez' : 'veces'}</div>${spark(hs)}` : '<div class="muted" style="padding:10px 0">Sin resultados todavía</div>'}</div>`; }).join('')
      || vacio('test', 'No hay pruebas cargadas (Calistenia > Pruebas)')}</div>`;
  $('#fpN').onclick = () => cargarResultados(a, () => fichaPruebas(a, c));
  c.onclick = e => { const b = e.target.closest('[data-pr]'); if (b && !e.target.closest('#fpN')) historialUI(a, DB.get('pruebas', b.dataset.pr), () => fichaPruebas(a, c)); };
}
function cargarResultados(a, luego) {
  const ps = pruebas();
  const m = modal(`${ico('test')} Resultados de ${esc(a.nombre.split(' ')[0])}`, `<div class="campo"><label>Fecha de la prueba</label><input type="date" id="crF" value="${hoy()}" style="max-width:220px"></div>
    <p class="muted chico">Completá sólo las que hizo.</p><div class="form">${ps.map(p => { const u = historialPrueba(a.id, p.id).pop();
      return `<div class="campo"><label>${esc(p.nombre)} (${p.unidad === 'seg' ? 'segundos' : esc(p.unidad)})</label><input data-cr="${p.id}" inputmode="decimal" placeholder="${u ? 'antes: ' + esc(num(u.valor)) : ''}"></div>`; }).join('')}</div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="crOk">${ico('check')} Guardar</button>`, 'ancho');
  $('#crOk', m).onclick = async () => {
    try {
      const f = val('crF', m); let n = 0;
      for (const i of $$('[data-cr]', m)) { if (!i.value.trim()) continue; const v = aNum(i.value); if (isNaN(v) || v < 0) throw new Error('Revisá los números'); await DB.guardar('resultados', { alumno_id: a.id, prueba_id: +i.dataset.cr, fecha: f, valor: v }); n++; }
      if (!n) throw new Error('No completaste ninguna prueba');
      await DB.anotar('Pruebas', `${a.nombre}: ${n} resultado${n === 1 ? '' : 's'}`); m.cerrar(); toast('Guardado'); luego && luego();
    } catch (e) { fallo(e); }
  };
}
function historialUI(a, p, luego) {
  const hs = historialPrueba(a.id, p.id).reverse();
  const m = modal(esc(p.nombre) + ' · ' + esc(a.nombre), `${spark(hs.slice().reverse())}<table class="t"><thead><tr><th>Fecha</th><th class="r">Resultado</th><th></th></tr></thead><tbody>
    ${hs.map(r => `<tr><td>${dmy(r.fecha)}</td><td class="r"><b>${esc(fmtValor(p, r.valor))}</b></td><td class="r"><button class="ib" data-del="${r.id}">${ico('trash')}</button></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Sin resultados</td></tr>'}</tbody></table>`,
    `<button class="btn" data-cerrar>Cerrar</button>`);
  m.onclick = async e => { const b = e.target.closest('[data-del]'); if (!b) return; if (!await confirmar('¿Borrar este resultado?', 'Borrar', true)) return; await DB.borrar('resultados', b.dataset.del); m.cerrar(); luego && luego(); };
}

/* ---------- rutinas ---------- */
function textoRutina(r, a) {
  return `*${DB.cfg.nombre}* · Rutina ${r.nombre} (${r.nivel || ''})${a ? '\nPara: ' + a.nombre : ''}\n\n` + r.ejercicios.map((e, i) => `${i + 1}. ${e.nombre}: ${e.series && e.series !== '1' ? e.series + ' x ' : ''}${e.dosis}${e.descanso ? ' · descanso ' + e.descanso : ''}${e.nota ? ' (' + e.nota + ')' : ''}`).join('\n') + (r.notas ? '\n\n' + r.notas : '') + '\n\n💪 ¡A entrenar!';
}
function verRutina(r, a) {
  const m = modal(`${ico('rutina')} ${esc(r.nombre)}`, `<div class="fila" style="margin-bottom:6px">${r.nivel ? `<span class="lvl">${esc(r.nivel)}</span>` : ''}${a ? `<span class="muted">Para ${esc(a.nombre)}</span>` : ''}</div>
    ${r.ejercicios.map((e, i) => `<div class="ej"><div class="n">${i + 1}</div><div class="tx"><b>${esc(e.nombre)}</b>${e.nota ? `<div class="muted chico">${esc(e.nota)}</div>` : ''}${e.descanso ? `<div class="muted chico">Descanso ${esc(e.descanso)}</div>` : ''}</div>
      <div class="dosis">${e.series && e.series !== '1' ? esc(e.series) + ' × ' : ''}${esc(e.dosis)}</div></div>`).join('')}${r.notas ? `<p class="muted">${esc(r.notas)}</p>` : ''}`,
    `<button class="btn" id="vrPr">${ico('imprimir')} Imprimir</button><button class="btn acento" id="vrWa">${ico('wa')} Mandar por WhatsApp</button>`);
  $('#vrWa', m).onclick = () => a ? abrirWa(a.telefono, textoRutina(r, a)) : compartirTexto(r.nombre, textoRutina(r));
  $('#vrPr', m).onclick = () => window.print();
}
function editarRutina(r, luego) {
  let ej = (r.ejercicios || []).map(e => Object.assign({}, e)); if (!ej.length) ej.push({ nombre: '', series: '3', dosis: '10', descanso: '', nota: '' });
  const m = modal(r.id ? 'Modificar rutina' : 'Nueva rutina', `<div class="form"><div class="campo"><label>Nombre</label><input id="er_n" value="${esc(r.nombre || '')}" placeholder="Ej. Full body A"></div>
    <div class="campo"><label>Nivel</label><select id="er_ni">${opciones(DB.cfg.niveles, r.nivel || DB.cfg.niveles[0])}</select></div></div>
    <div id="erE"></div><button class="btn chico" id="erMas" type="button">${ico('plus')} Ejercicio</button>
    <div class="campo" style="margin-top:12px"><label>Notas (opcional)</label><textarea id="er_no">${esc(r.notas || '')}</textarea></div>`,
    `${r.id ? `<button class="btn rojo" id="erB">${ico('trash')} Borrar</button>` : ''}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="erOk">${ico('check')} Guardar</button>`, 'ancho');
  const leerE = () => $$('[data-ei]', m).forEach(f => { const i = +f.dataset.ei; ej[i] = { nombre: $('[data-k=nombre]', f).value, series: $('[data-k=series]', f).value, dosis: $('[data-k=dosis]', f).value, descanso: $('[data-k=descanso]', f).value, nota: $('[data-k=nota]', f).value }; });
  const pintar = () => {
    $('#erE', m).innerHTML = ej.map((e, i) => `<div data-ei="${i}" style="border:1px solid var(--borde);border-radius:12px;padding:10px;margin-bottom:8px">
      <div class="fila"><b class="sp">${i + 1}.</b>${i ? `<button class="ib" data-up="${i}" title="Subir">▲</button>` : ''}<button class="ib" data-rm="${i}" title="Quitar">${ico('x')}</button></div>
      <div class="form"><div class="campo full"><label>Ejercicio</label><input data-k="nombre" value="${esc(e.nombre)}"></div>
      <div class="campo"><label>Series</label><input data-k="series" value="${esc(e.series)}" inputmode="numeric"></div><div class="campo"><label>Reps / tiempo</label><input data-k="dosis" value="${esc(e.dosis)}" placeholder="10 · 30 seg · 5 por pierna"></div>
      <div class="campo"><label>Descanso</label><input data-k="descanso" value="${esc(e.descanso)}" placeholder="90 seg"></div><div class="campo"><label>Nota</label><input data-k="nota" value="${esc(e.nota)}"></div></div></div>`).join('');
  };
  pintar();
  $('#erMas', m).onclick = () => { leerE(); ej.push({ nombre: '', series: '3', dosis: '10', descanso: '', nota: '' }); pintar(); };
  $('#erE', m).onclick = e => { const up = e.target.closest('[data-up]'), rm = e.target.closest('[data-rm]'); if (!up && !rm) return; leerE();
    if (rm) ej.splice(+rm.dataset.rm, 1); else { const i = +up.dataset.up; [ej[i - 1], ej[i]] = [ej[i], ej[i - 1]]; } pintar(); };
  $('#erOk', m).onclick = async () => { try { leerE(); const nombre = val('er_n', m); if (!nombre) throw new Error('Poné el nombre');
    const lista = ej.filter(e => e.nombre.trim()); if (!lista.length) throw new Error('Agregá al menos un ejercicio');
    await DB.guardar('rutinas', Object.assign(r, { nombre, nivel: val('er_ni', m), ejercicios: lista, notas: val('er_no', m) })); m.cerrar(); toast('Guardado'); luego && luego(); } catch (e) { fallo(e); } };
  if ($('#erB', m)) $('#erB', m).onclick = async () => { if (!await confirmar('¿Borrar esta rutina?', 'Borrar', true)) return; await DB.borrar('rutinas', r.id); m.cerrar(); luego && luego(); };
}

/* ---------- catálogo: habilidades y pruebas ---------- */
function editarHabilidad(h, luego) {
  const m = modal(h.id ? 'Modificar habilidad' : 'Nueva habilidad', `<div class="campo"><label>Nombre</label><input id="eh_n" value="${esc(h.nombre || '')}" placeholder="Ej. Muscle-up" autofocus></div>
    <div class="campo"><label>Pasos de la progresión, uno por renglón (del más fácil al más difícil)</label><textarea id="eh_p" style="min-height:200px">${esc((h.pasos || []).map(p => p.nombre).join('\n'))}</textarea></div>
    <p class="muted chico">Si cambiás el orden de los pasos, los logros ya anotados quedan en el número de paso que tenían.</p>`,
    `${h.id ? `<button class="btn rojo" id="ehB">${ico('trash')} Quitar</button>` : ''}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ehOk">${ico('check')} Guardar</button>`);
  $('#ehOk', m).onclick = async () => { try { const nombre = val('eh_n', m); const pasos = $('#eh_p', m).value.split('\n').map(x => x.trim()).filter(Boolean).map(n => ({ nombre: n }));
    if (!nombre) throw new Error('Poné el nombre'); if (!pasos.length) throw new Error('Escribí al menos un paso');
    await DB.guardar('habilidades', Object.assign(h, { nombre, pasos, orden: h.orden || (Math.max(0, ...DB.todos('habilidades').map(x => x.orden || 0)) + 1), activo: true })); m.cerrar(); toast('Guardado'); luego && luego(); } catch (e) { fallo(e); } };
  if ($('#ehB', m)) $('#ehB', m).onclick = async () => { if (!await confirmar(`¿Quitar "${esc(h.nombre)}"? Los logros ya anotados quedan guardados pero no se muestran.`, 'Quitar', true)) return; h.activo = false; await DB.guardar('habilidades', h); m.cerrar(); luego && luego(); };
}
function editarPrueba(p, luego) {
  const m = modal(p.id ? 'Modificar prueba' : 'Nueva prueba', `<div class="campo"><label>Nombre</label><input id="ep_n" value="${esc(p.nombre || '')}" placeholder="Ej. Dominadas máximas" autofocus></div>
    <div class="form"><div class="campo"><label>Se mide en</label><select id="ep_u">${opciones([{ v: 'reps', t: 'Repeticiones' }, { v: 'seg', t: 'Segundos' }, { v: 'kg', t: 'Kilos (lastre)' }, { v: 'cm', t: 'Centímetros' }], p.unidad || 'reps')}</select></div>
      <div class="campo"><label>Es mejor</label><select id="ep_m">${opciones([{ v: 'mayor', t: 'Más alto (más reps, más tiempo)' }, { v: 'menor', t: 'Más bajo (menos tiempo)' }], p.mejor || 'mayor')}</select></div></div>`,
    `${p.id ? `<button class="btn rojo" id="epB">${ico('trash')} Quitar</button>` : ''}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="epOk">${ico('check')} Guardar</button>`);
  $('#epOk', m).onclick = async () => { try { const nombre = val('ep_n', m); if (!nombre) throw new Error('Poné el nombre');
    await DB.guardar('pruebas', Object.assign(p, { nombre, unidad: val('ep_u', m), mejor: val('ep_m', m), orden: p.orden || (Math.max(0, ...DB.todos('pruebas').map(x => x.orden || 0)) + 1), activo: true })); m.cerrar(); toast('Guardado'); luego && luego(); } catch (e) { fallo(e); } };
  if ($('#epB', m)) $('#epB', m).onclick = async () => { if (!await confirmar(`¿Quitar "${esc(p.nombre)}"? Los resultados anotados quedan guardados.`, 'Quitar', true)) return; p.activo = false; await DB.guardar('pruebas', p); m.cerrar(); luego && luego(); };
}
/* día de pruebas: una prueba para muchos alumnos */
function diaDePruebas(luego) {
  const ps = pruebas(); if (!ps.length) return toast('Primero cargá una prueba', true);
  let nivel = '';
  const m = modal(`${ico('test')} Día de pruebas`, `<div class="form"><div class="campo"><label>Prueba</label><select id="dpP">${opciones(ps.map(p => ({ v: p.id, t: p.nombre })))}</select></div>
    <div class="campo"><label>Fecha</label><input type="date" id="dpF" value="${hoy()}"></div><div class="campo full"><label>Alumnos</label><select id="dpN">${opciones(DB.cfg.niveles, '', 'Todos los niveles')}</select></div></div>
    <div id="dpL"></div>`, `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="dpOk">${ico('check')} Guardar</button>`, 'ancho');
  const pintar = () => { const p = DB.get('pruebas', val('dpP', m));
    $('#dpL', m).innerHTML = alumnosActivos().filter(a => !nivel || a.nivel === nivel).map(a => { const u = historialPrueba(a.id, p.id).pop();
      return `<div class="asis">${avatar(a)}<div class="tx"><b>${esc(a.nombre)}</b><small class="muted">${u ? 'Última: ' + esc(fmtValor(p, u.valor)) + ' (' + dmy(u.fecha) + ')' : 'Primera vez'}</small></div><input data-dp="${a.id}" inputmode="decimal" style="width:110px" placeholder="${p.unidad === 'seg' ? 'seg' : esc(p.unidad)}"></div>`; }).join('') || vacio('alumnos', 'No hay alumnos'); };
  pintar();
  $('#dpP', m).onchange = pintar; $('#dpN', m).onchange = e => { nivel = e.target.value; pintar(); };
  $('#dpOk', m).onclick = async () => { try { const pid = +val('dpP', m), f = val('dpF', m); let n = 0;
    for (const i of $$('[data-dp]', m)) { if (!i.value.trim()) continue; const v = aNum(i.value); if (isNaN(v) || v < 0) throw new Error('Revisá los números'); await DB.guardar('resultados', { alumno_id: +i.dataset.dp, prueba_id: pid, fecha: f, valor: v }); n++; }
    if (!n) throw new Error('No cargaste ningún resultado'); await DB.anotar('Día de pruebas', `${DB.get('pruebas', pid).nombre}: ${n}`); m.cerrar(); toast(`Guardados ${n} resultados`); luego && luego(); } catch (e) { fallo(e); } };
}

let TAB_CALI = 'habilidades', RK_PRUEBA = null, RK_NIVEL = '';
PANTALLAS.progreso = async (main) => {
  titulo('Calistenia');
  main.innerHTML = `<div class="tabsf" id="pgT">${[['habilidades', 'Habilidades'], ['pruebas', 'Pruebas'], ['ranking', 'Ranking'], ['rutinas', 'Rutinas por nivel']].map(([k, t]) => `<button data-t="${k}" class="${TAB_CALI === k ? 'act' : ''}">${t}</button>`).join('')}</div><div id="pgC"></div>`;
  const re = () => PANTALLAS.progreso(main);
  $('#pgT').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { TAB_CALI = b.dataset.t; re(); } };
  const c = $('#pgC'), alus = alumnosActivos();
  if (TAB_CALI === 'habilidades') {
    c.innerHTML = `<div class="fila" style="margin-bottom:12px"><span class="muted chico sp">Cada habilidad tiene sus pasos. Los logros se marcan en la ficha de cada alumno, pestaña Progreso.</span><button class="btn acento" id="pgN">${ico('plus')} Habilidad</button></div>
      ${habilidades().map(h => `<div class="skill" data-eh="${h.id}" style="cursor:pointer"><h4>${esc(h.nombre)}<span style="flex:1"></span><span class="muted chico">${ico('lapiz')}</span></h4><div class="pasos">${h.pasos.map((p, i) => {
        const n = alus.filter(a => nivelHabilidad(a.id, h) === i + 1).length; return `<span class="paso" style="cursor:inherit"><span class="n">${i + 1}</span>${esc(p.nombre)}${n ? ` <span class="pill acento">${n}</span>` : ''}</span>`; }).join('')}</div></div>`).join('')}`;
    $('#pgN').onclick = () => editarHabilidad({}, re);
    c.onclick = e => { const b = e.target.closest('[data-eh]'); if (b) editarHabilidad(DB.get('habilidades', b.dataset.eh), re); };
  } else if (TAB_CALI === 'pruebas') {
    c.innerHTML = `<div class="fila" style="margin-bottom:12px"><span class="muted chico sp">Pruebas para tomar cada tanto (por ejemplo una vez por mes) y ver cómo mejora cada uno.</span>
        <button class="btn" id="pgN">${ico('plus')} Prueba</button><button class="btn acento" id="pgD">${ico('test')} Día de pruebas</button></div>
      <div class="card" style="padding:6px 14px"><div class="lista">${pruebas().map(p => { const n = new Set(DB.donde('resultados', r => r.prueba_id === p.id).map(r => r.alumno_id)).size;
        return `<div class="it" data-ep="${p.id}"><div class="av">${ico('test')}</div><div class="tx"><b>${esc(p.nombre)}</b><small>${p.unidad === 'seg' ? 'segundos' : esc(p.unidad)} · ${n} alumno${n === 1 ? '' : 's'} con resultados</small></div>${ico('lapiz')}</div>`; }).join('')}</div></div>`;
    $('#pgN').onclick = () => editarPrueba({}, re); $('#pgD').onclick = () => diaDePruebas(re);
    c.onclick = e => { const b = e.target.closest('[data-ep]'); if (b) editarPrueba(DB.get('pruebas', b.dataset.ep), re); };
  } else if (TAB_CALI === 'ranking') {
    const ps = pruebas(); RK_PRUEBA = RK_PRUEBA && DB.get('pruebas', RK_PRUEBA) ? RK_PRUEBA : ps[0] && ps[0].id;
    const p = DB.get('pruebas', RK_PRUEBA);
    const filas = p ? alus.filter(a => !RK_NIVEL || a.nivel === RK_NIVEL).map(a => ({ a, m: mejorDe(p, historialPrueba(a.id, p.id)) })).filter(x => x.m)
      .sort((x, y) => p.mejor === 'menor' ? x.m.valor - y.m.valor : y.m.valor - x.m.valor) : [];
    c.innerHTML = `<div class="fila" style="margin-bottom:12px"><select id="rkP" style="width:auto">${opciones(ps.map(x => ({ v: x.id, t: x.nombre })), RK_PRUEBA)}</select>
        <select id="rkN" style="width:auto">${opciones(DB.cfg.niveles, RK_NIVEL, 'Todos los niveles')}</select><span class="sp"></span>${filas.length ? `<button class="btn" id="rkW">${ico('compartir')} Compartir</button>` : ''}</div>
      <div class="card" style="padding:6px 14px"><div class="lista">${filas.map((x, i) => `<div class="it" data-alu="${x.a.id}"><div class="av" style="${i < 3 ? 'background:var(--grad);color:#0b0b0d;border:0' : ''}">${i + 1}</div>${avatar(x.a)}
        <div class="tx"><b>${esc(x.a.nombre)}</b><small>${esc(x.a.nivel || '')} · ${dmy(x.m.fecha)}</small></div><b style="font-size:18px">${esc(fmtValor(p, x.m.valor))}</b></div>`).join('') || vacio('trofeo', 'Todavía no hay resultados de esta prueba')}</div></div>`;
    if ($('#rkP')) $('#rkP').onchange = e => { RK_PRUEBA = +e.target.value; re(); };
    $('#rkN').onchange = e => { RK_NIVEL = e.target.value; re(); };
    if ($('#rkW')) $('#rkW').onclick = () => compartirTexto('Ranking', `🏆 *${DB.cfg.nombre}* · Ranking ${p.nombre}${RK_NIVEL ? ' (' + RK_NIVEL + ')' : ''}\n\n` + filas.slice(0, 10).map((x, i) => `${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${x.a.nombre}: ${fmtValor(p, x.m.valor)}`).join('\n'));
    c.onclick = e => { const b = e.target.closest('[data-alu]'); if (b) { TAB_FICHA = 'pruebas'; ir('ficha', { id: +b.dataset.alu }, true); } };
  } else {
    c.innerHTML = `<div class="fila" style="margin-bottom:12px"><span class="muted chico sp">Se pueden mandar por WhatsApp a cada alumno desde su ficha.</span><button class="btn acento" id="pgN">${ico('plus')} Rutina</button></div>
      ${DB.cfg.niveles.map(nv => { const rs = DB.donde('rutinas', r => r.nivel === nv); return `<div class="card"><h2><span class="lvl">${esc(nv)}</span></h2>${rs.map(r => `<div class="it" data-vr="${r.id}"><div class="av">${ico('rutina')}</div>
        <div class="tx"><b>${esc(r.nombre)}</b><small>${r.ejercicios.length} ejercicios: ${esc(r.ejercicios.slice(0, 3).map(e => e.nombre).join(', '))}…</small></div><button class="ib" data-er="${r.id}">${ico('lapiz')}</button></div>`).join('') || '<div class="muted chico">Sin rutinas</div>'}</div>`; }).join('')}`;
    $('#pgN').onclick = () => editarRutina({}, re);
    c.onclick = e => { const ed = e.target.closest('[data-er]'); if (ed) return editarRutina(DB.get('rutinas', ed.dataset.er), re); const b = e.target.closest('[data-vr]'); if (b) verRutina(DB.get('rutinas', b.dataset.vr)); };
  }
};
