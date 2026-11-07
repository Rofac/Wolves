/* Inicio: lo de hoy de un vistazo. */
'use strict';

function claseCard(c, fecha, conFecha) {
  const l = listaClase(c, fecha), pct = l.cupo ? Math.min(100, l.ocupados / l.cupo * 100) : 0;
  return `<div class="clase" data-clase="${c.id}" data-fecha="${fecha}" style="border-left-color:${esc(c.color || '#1b1e24')}">
    <div class="fila"><span class="h">${hhmm(c.hora)}</span><span class="sp"></span>${c.nivel ? `<span class="lvl">${esc(c.nivel)}</span>` : ''}</div>
    <b>${esc(c.nombre)}</b><small>${conFecha ? esc(fechaLarga(fecha)) + ' · ' : ''}${c.profe ? esc(c.profe) + ' · ' : ''}${l.cupo ? `${l.ocupados}/${l.cupo} anotados` : `${l.ocupados} anotados`}${l.presentes ? ` · ${l.presentes} vinieron` : ''}</small>
    ${l.cupo ? `<div class="cupo ${l.ocupados >= l.cupo ? 'lleno' : l.ocupados >= l.cupo * .8 ? 'casi' : ''}"><i style="width:${pct}%"></i></div>` : ''}</div>`;
}

function recordarCuota(a) {
  const msg = (DB.cfg.msg_vencida || '').replace(/\{nombre\}/g, a.nombre.split(' ')[0]).replace(/\{gym\}/g, DB.cfg.nombre).replace(/\{vence\}/g, dmy(a.vencimiento));
  abrirWa(a.telefono, msg);
}

PANTALLAS.inicio = async (main) => {
  titulo('Inicio');
  const h = hoy(), alumnos = alumnosActivos();
  const est = alumnos.map(a => ({ a, e: estadoCuota(a) }));
  const venc = est.filter(x => x.e.e === 'mal').sort((x, y) => x.a.vencimiento.localeCompare(y.a.vencimiento));
  const porv = est.filter(x => x.e.e === 'warn').sort((x, y) => x.a.vencimiento.localeCompare(y.a.vencimiento));
  const deben = alumnos.filter(a => (a.saldo || 0) > 0.009);
  const cumple = alumnos.filter(a => a.nacimiento && [0, 1, 2, 3, 4, 5, 6].some(n => sumarDias(h, n).slice(5) === a.nacimiento.slice(5)))
    .sort((x, y) => x.nacimiento.slice(5).localeCompare(y.nacimiento.slice(5)));
  const cHoy = clasesDelDia(h);
  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes();
  const proxima = cHoy.find(c => minutos(c.hora) + (+c.duracion || 60) >= ahoraMin);
  const cj = caja(h, h);
  const ocultarPlata = DB.cfg.pin && !DESBLOQUEADO;
  const logros = DB.donde('logros', l => l.fecha >= sumarDias(h, -7)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id).slice(0, 8);
  const diasCopia = DB.cfg.ultima_copia ? diasEntre(DB.cfg.ultima_copia.slice(0, 10), h) : null;
  const avisarCopia = alumnos.length && (diasCopia === null || diasCopia >= (+DB.cfg.aviso_copia_dias || 7));

  main.innerHTML = `
    ${!DB.cfg.direccion_ok && !abonosActivos().some(a => a.precio > 0) ? `<div class="card" style="border-color:var(--acento);border-width:2px">
      <h2>${ico('config')} Para empezar</h2><ol style="margin:0 0 12px;padding-left:20px;line-height:1.8">
      <li>Poné el nombre del gimnasio y el precio de la cuota en <b>Configuración</b>.</li><li>Cargá los horarios en <b>Clases</b> (día, hora y cupo).</li>
      <li>Agregá los alumnos y anotalos en sus horarios.</li></ol><button class="btn acento" data-ir="config">Ir a Configuración</button></div>` : ''}
    ${avisarCopia ? `<div class="card fila" style="background:var(--warn-bg);border-color:var(--warn-bg)">${ico('alerta')}<div class="sp"><b>${diasCopia === null ? 'Todavía no hiciste ninguna copia de seguridad' : `Hace ${diasCopia} días que no hacés una copia de seguridad`}</b>
      <div class="chico">Si la tablet se rompe o se pierde, sin copia se pierde todo. Mandala a tu Google Drive o WhatsApp.</div></div><button class="btn pri" id="inCopia">${ico('copia')} Hacer copia</button></div>` : ''}
    <div class="kpis">
      <div class="kpi oscuro"><small>Clases hoy</small><b>${cHoy.length}</b><div class="sub">${proxima ? `Próxima: ${hhmm(proxima.hora)} ${esc(proxima.nombre)}` : cHoy.length ? 'Ya terminaron' : 'No hay clases'}</div></div>
      <div class="kpi" data-ir="alumnos"><small>Alumnos</small><b>${alumnos.length}</b><div class="sub">${est.filter(x => x.e.e === 'ok').length} al día</div></div>
      <div class="kpi" id="kVenc"><small>Cuotas vencidas</small><b class="${venc.length ? 'mal' : ''}">${venc.length}</b><div class="sub">${porv.length} por vencer</div></div>
      <div class="kpi" data-ir="caja"><small>Cobrado hoy</small><b>${ocultarPlata ? ico('candado') : money(cj.entra)}</b><div class="sub">${cj.nCuotas} cuota${cj.nCuotas === 1 ? '' : 's'}</div></div>
    </div>
    <div class="grid g2">
      <div>
        <div class="card"><h2>${ico('clases')} Hoy, ${esc(fechaLarga(h))}<span class="sp"></span><button class="btn chico" data-ir="clases">Ver semana</button></h2>
          ${cHoy.map(c => claseCard(c, h)).join('') || vacio('clases', 'Hoy no hay clases. Cargá los horarios en Clases.')}</div>
        ${logros.length ? `<div class="card"><h2>${ico('trofeo')} Logros de la semana</h2><div class="lista">${logros.map(l => {
          const a = DB.get('alumnos', l.alumno_id), hb = DB.get('habilidades', l.habilidad_id); if (!a || !hb) return '';
          return `<div class="it" data-alu="${a.id}">${avatar(a)}<div class="tx"><b>${esc(a.nombre)}</b><small>${esc(hb.nombre)}: ${esc(hb.pasos[l.paso]?.nombre || '')}</small></div><span class="pill acento">${dm(l.fecha)}</span></div>`; }).join('')}</div></div>` : ''}
      </div>
      <div>
        <div class="card" id="cVenc"><h2>${ico('alerta')} Cuotas para cobrar</h2>
          ${[...venc, ...porv].slice(0, 30).map(x => `<div class="it" data-alu="${x.a.id}">${avatar(x.a)}<div class="tx"><b>${esc(x.a.nombre)}</b><small class="${x.e.clase}">${esc(x.e.t)}</small></div>
            ${x.a.telefono ? `<button class="ib" data-wa="${x.a.id}" title="Recordar por WhatsApp">${ico('wa')}</button>` : ''}<button class="btn chico acento" data-cob="${x.a.id}">Cobrar</button></div>`).join('')
            || vacio('check', 'Todos al día')}
          ${venc.length + porv.length > 30 ? `<p class="muted chico">Y ${venc.length + porv.length - 30} más: mirá la lista en Alumnos.</p>` : ''}</div>
        ${deben.length ? `<div class="card"><h2>${ico('caja')} Deben plata</h2>${deben.map(a => `<div class="it" data-alu="${a.id}">${avatar(a)}<div class="tx"><b>${esc(a.nombre)}</b><small>Debe ${money2(a.saldo)}</small></div></div>`).join('')}</div>` : ''}
        ${cumple.length ? `<div class="card"><h2>${ico('torta')} Cumpleaños</h2>${cumple.map(a => {
          const dd = diasEntre(h, h.slice(0, 4) + a.nacimiento.slice(4)) < 0 ? diasEntre(h, (+h.slice(0, 4) + 1) + a.nacimiento.slice(4)) : diasEntre(h, h.slice(0, 4) + a.nacimiento.slice(4));
          return `<div class="it" data-alu="${a.id}">${avatar(a)}<div class="tx"><b>${esc(a.nombre)}</b><small>${dd === 0 ? '¡HOY!' : dd === 1 ? 'Mañana' : fechaLarga(sumarDias(h, dd))} · cumple ${(edad(a.nacimiento) || 0) + (dd === 0 ? 0 : 1)}</small></div>
            ${a.telefono ? `<button class="ib" data-feliz="${a.id}" title="Saludar">${ico('wa')}</button>` : ''}</div>`; }).join('')}</div>` : ''}
      </div>
    </div>`;
  if ($('#inCopia')) $('#inCopia').onclick = () => hacerCopia();
  $('#kVenc').onclick = () => { FILTRO_ALU = 'vencidos'; ir('alumnos'); };
  main.onclick = e => {
    const b = e.target.closest('[data-clase],[data-alu],[data-wa],[data-cob],[data-feliz]'); if (!b) return;
    if (b.dataset.wa) { e.stopPropagation(); return recordarCuota(DB.get('alumnos', b.dataset.wa)); }
    if (b.dataset.feliz) { e.stopPropagation(); const a = DB.get('alumnos', b.dataset.feliz); return abrirWa(a.telefono, `¡Feliz cumple ${a.nombre.split(' ')[0]}! 🎉 Te saludamos de ${DB.cfg.nombre}. ¡A seguir entrenando!`); }
    if (b.dataset.cob) { e.stopPropagation(); return cobrar(+b.dataset.cob, recargar); }
    if (b.dataset.clase) return ir('asistencia', { clase: +b.dataset.clase, fecha: b.dataset.fecha }, true);
    if (b.dataset.alu) return ir('ficha', { id: +b.dataset.alu }, true);
  };
};
