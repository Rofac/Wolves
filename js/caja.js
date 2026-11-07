/* Cobros y caja: cuota, deuda, otros ingresos, gastos, informes por día, semana, mes y año. */
'use strict';

/* filas de pago: puede pagar con varios medios; el último se completa con lo que falta */
function zonaPagos(cont, total, permitirCta = true) {
  const medios = [...DB.cfg.medios, ...(permitirCta ? [CTA] : [])];
  let filas = [{ medio: medios[0], monto: total }];
  const pintar = () => {
    cont.innerHTML = filas.map((f, i) => `<div class="pagos-fila"><div><label>${i ? 'Otro medio' : 'Medio de pago'}</label><select data-pm="${i}">${opciones(medios, f.medio)}</select></div>
      <div><label>Monto</label>${campoMonto(`data-pv="${i}"`, f.monto)}</div>${i ? `<button class="ib" data-px="${i}" title="Quitar">${ico('x')}</button>` : '<span></span>'}</div>`).join('') +
      `<div class="fila"><button class="btn chico" type="button" data-pmas>${ico('plus')} Pagar con otro medio</button><span class="sp"></span><span id="zpRes" class="chico" style="font-weight:800"></span></div>`;
    res();
  };
  const res = () => {
    const s = r2(filas.reduce((a, f) => a + n0(f.monto), 0)), d = r2(total.v - s);
    const el = cont.querySelector('#zpRes');
    if (el) el.innerHTML = Math.abs(d) < 0.01 ? '<span class="ok">✓ Justo</span>' : d > 0 ? `<span class="mal">Falta ${money2(d)}</span>` : `<span class="warn">Sobra ${money2(-d)}</span>`;
  };
  total = { v: total };
  cont.oninput = e => {
    const i = e.target.dataset.pv; if (i === undefined) return;
    filas[+i].monto = e.target.value;
    // si cambia un medio que no es el último, el último se completa con lo que falta
    if (+i < filas.length - 1) { const k = filas.length - 1, resto = r2(total.v - filas.slice(0, -1).reduce((a, f) => a + n0(f.monto), 0));
      filas[k].monto = Math.max(0, resto); const el = cont.querySelector(`[data-pv="${k}"]`); if (el && document.activeElement !== el) el.value = fmtIn(filas[k].monto); }
    res();
  };
  cont.onchange = e => { const i = e.target.dataset.pm; if (i !== undefined) filas[+i].medio = e.target.value; };
  cont.onclick = e => {
    if (e.target.closest('[data-pmas]')) { const s = filas.reduce((a, f) => a + n0(f.monto), 0); filas.push({ medio: medios.find(m => !filas.some(f => f.medio === m)) || medios[0], monto: Math.max(0, r2(total.v - s)) }); pintar(); }
    const x = e.target.closest('[data-px]'); if (x) { filas.splice(+x.dataset.px, 1); pintar(); }
  };
  pintar();
  return {
    total(t) { const antes = total.v; total.v = t; if (filas.length === 1 || Math.abs(filas.reduce((a, f) => a + n0(f.monto), 0) - antes) < 0.01) { filas[filas.length - 1].monto = r2(t - filas.slice(0, -1).reduce((a, f) => a + n0(f.monto), 0)); pintar(); } else res(); },
    pagos: () => filas.map(f => ({ medio: f.medio, monto: n0(f.monto) })),
  };
}

function cobrar(aid, luego) {
  if (!aid) return elegirAlumno('¿A quién le cobrás?', a => cobrar(a.id, luego));
  const a = DB.get('alumnos', aid), abs = abonosActivos();
  if (!abs.length) return toast('Primero cargá la cuota en Configuración', true);
  let ab = DB.get('abonos', a.abono_id) || abs[0];
  const m = modal(`${ico('caja')} Cobrar cuota`, `<div class="fila" style="margin-bottom:12px">${avatar(a)}<div><b>${esc(a.nombre)}</b><div class="chico ${estadoCuota(a).clase}">${esc(estadoCuota(a).t)}</div></div></div>
    <div class="form"><div class="campo"><label>Cuota</label><select id="cbA">${opciones(abs.map(x => ({ v: x.id, t: x.nombre })), ab.id)}</select></div>
      <div class="campo"><label>Importe</label>${campoMonto('id="cbI"', ab.precio)}</div>
      <div class="campo"><label>Descuento (opcional)</label>${campoMonto('id="cbD"', '')}</div>
      <div class="campo"><label>Pagado hasta</label><input type="date" id="cbV"></div></div>
    <div id="cbTot" style="font-size:22px;font-weight:900;margin:4px 0 12px"></div>
    <div id="cbP"></div><div class="campo" style="margin-top:8px"><label>Nota (opcional)</label><input id="cbN"></div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn acento" id="cbOk">${ico('check')} Cobrar</button>`, 'ancho');
  const tot = () => r2(n0($('#cbI', m).value) - n0($('#cbD', m).value));
  const zp = zonaPagos($('#cbP', m), tot());
  const ponAbono = () => { ab = DB.get('abonos', val('cbA', m)); $('#cbI', m).value = fmtIn(ab.precio); $('#cbV', m).value = renovacion(a, ab).vence; act(); };
  const act = () => { const t = tot(); $('#cbTot', m).innerHTML = `Total: ${money2(t)} <span class="muted chico" style="font-weight:600">· desde ${dmy(renovacion(a, ab).desde)}</span>`; zp.total(t); };
  $('#cbA', m).onchange = ponAbono; $('#cbI', m).addEventListener('input', act); $('#cbD', m).addEventListener('input', act);
  $('#cbV', m).value = renovacion(a, ab).vence; act();
  $('#cbOk', m).onclick = async () => {
    try {
      const c = await cobrarCuota({ alumno_id: a.id, abono_id: ab.id, importe: $('#cbI', m).value, descuento: $('#cbD', m).value, pagos: zp.pagos(), vence: $('#cbV', m).value, nota: val('cbN', m) });
      m.cerrar(); toast('Cobrado'); luego && luego(); verCobro(c.id);
    } catch (e) { fallo(e); }
  };
}
function cobrarDeudaUI(aid, luego) {
  const a = DB.get('alumnos', aid);
  const m = modal('Cobrar deuda', `<p style="margin-top:0"><b>${esc(a.nombre)}</b> debe <b class="mal">${money2(a.saldo)}</b></p>
    <div class="campo"><label>Cuánto paga</label>${campoMonto('id="cdM"', a.saldo)}</div><div id="cdP"></div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn acento" id="cdOk">${ico('check')} Cobrar</button>`);
  const zp = zonaPagos($('#cdP', m), a.saldo, false);
  $('#cdM', m).addEventListener('input', () => zp.total(n0($('#cdM', m).value)));
  $('#cdOk', m).onclick = async () => { try { const c = await cobrarDeuda({ alumno_id: a.id, monto: $('#cdM', m).value, pagos: zp.pagos() }); m.cerrar(); toast('Cobrado'); luego && luego(); verCobro(c.id); } catch (e) { fallo(e); } };
}

function textoRecibo(c) {
  const a = DB.get('alumnos', c.alumno_id);
  return `*${DB.cfg.nombre}*\nRecibo N° ${c.id} · ${dmy(c.fecha)}\n${a ? a.nombre : ''}\n` +
    (c.tipo === 'CUOTA' ? `${c.concepto}: del ${dmy(c.desde)} al ${dmy(c.vence)}\n` : 'Pago de deuda\n') +
    (c.descuento ? `Importe ${money2(c.importe)} · Descuento ${money2(c.descuento)}\n` : '') +
    `*Total: ${money2(c.total)}*\nPagó con: ${c.pagos.map(p => `${p.medio} ${money2(p.monto)}`).join(' + ')}\n¡Gracias!`;
}
function verCobro(id, luego) {
  const c = DB.get('cobros', id), a = DB.get('alumnos', c.alumno_id);
  const m = modal(`Recibo N° ${c.id}`, `<div style="text-align:center;margin-bottom:10px"><img src="img/logo.png" style="width:90px;border-radius:50%"><h3 style="margin:6px 0 0">${esc(DB.cfg.nombre)}</h3>
      <div class="muted chico">${esc(DB.cfg.direccion || '')}${DB.cfg.telefono ? ' · ' + esc(DB.cfg.telefono) : ''}</div></div>
    ${c.estado !== 'ACTIVO' ? `<div class="pill mal" style="margin-bottom:10px">ANULADO el ${dmy(c.anulado)}: ${esc(c.motivo)}</div>` : ''}
    <table class="t"><tr><td>Fecha</td><td class="r">${dmy(c.fecha)} ${c.fecha.slice(11)}</td></tr><tr><td>Alumno</td><td class="r"><b>${esc(a ? a.nombre : c.alumno_borrado ? 'Alumno borrado' : '')}</b></td></tr>
      ${c.tipo === 'CUOTA' ? `<tr><td>${esc(c.concepto)}</td><td class="r">${dmy(c.desde)} al ${dmy(c.vence)}</td></tr>` : '<tr><td colspan="2">Pago de deuda</td></tr>'}
      ${c.descuento ? `<tr><td>Importe</td><td class="r">${money2(c.importe)}</td></tr><tr><td>Descuento</td><td class="r">− ${money2(c.descuento)}</td></tr>` : ''}
      ${c.pagos.map(p => `<tr><td>${esc(p.medio)}</td><td class="r">${money2(p.monto)}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td class="r">${money2(c.total)}</td></tr></table>${c.nota ? `<p class="muted chico">${esc(c.nota)}</p>` : ''}`,
    `${c.estado === 'ACTIVO' ? `<button class="btn rojo" id="vcAn">${ico('trash')} Anular</button>` : ''}<button class="btn" id="vcPr">${ico('imprimir')} Imprimir</button>
     <button class="btn acento" id="vcWa">${ico('wa')} Mandar por WhatsApp</button>`);
  $('#vcWa', m).onclick = () => abrirWa(a && a.telefono, textoRecibo(c));
  $('#vcPr', m).onclick = () => window.print();
  if ($('#vcAn', m)) $('#vcAn', m).onclick = async () => {
    if (DB.cfg.pin && !DESBLOQUEADO && !await pedirPin('anular un cobro')) return;
    const mot = await pedirTexto('Anular cobro', 'Motivo (ej. se cargó mal)'); if (mot === null) return;
    try { await anularCobro(c.id, mot); m.cerrar(); toast('Cobro anulado: se volvió a la fecha de vencimiento anterior'); luego ? luego() : recargar(); } catch (e) { fallo(e); }
  };
}

function cargarMovimiento(tipo, luego) {
  const nom = { INGRESO: 'Otro ingreso', GASTO: 'Gasto', RETIRO: 'Retiro de plata' }[tipo];
  const m = modal(nom, `<div class="form">
    ${tipo === 'GASTO' ? `<div class="campo"><label>Tipo de gasto</label><select id="mvC">${opciones(DB.cfg.categorias_gasto)}</select></div>` : ''}
    <div class="campo ${tipo === 'GASTO' ? '' : 'full'}"><label>${tipo === 'INGRESO' ? 'Qué es (ej. venta de bebida, clase suelta)' : tipo === 'RETIRO' ? 'Quién retira / para qué' : 'Detalle'}</label><input id="mvD" autofocus></div>
    <div class="campo"><label>Importe</label>${campoMonto('id="mvM"', '')}</div>
    <div class="campo"><label>${tipo === 'INGRESO' ? 'Cómo entró' : 'De dónde sale'}</label><select id="mvMe">${opciones(DB.cfg.medios)}</select></div>
    <div class="campo"><label>Fecha</label><input type="date" id="mvF" value="${hoy()}"></div></div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="mvOk">${ico('check')} Guardar</button>`);
  $('#mvOk', m).onclick = async () => { try { await movimiento({ tipo, concepto: val('mvD', m), categoria: val('mvC', m), medio: val('mvMe', m), monto: $('#mvM', m).value, fecha: val('mvF', m) }); m.cerrar(); toast('Guardado'); luego && luego(); } catch (e) { fallo(e); } };
}

let PER_CAJA = 'hoy', CAJA_D = '', CAJA_H = '';
function rangoCaja() {
  const h = hoy();
  if (PER_CAJA === 'hoy') return [h, h, 'Hoy'];
  if (PER_CAJA === 'ayer') { const a = sumarDias(h, -1); return [a, a, 'Ayer']; }
  if (PER_CAJA === 'semana') return [lunesDe(h), h, 'Esta semana'];
  if (PER_CAJA === 'mes') return [h.slice(0, 8) + '01', h, 'Este mes'];
  if (PER_CAJA === 'mesant') { const d = sumarMeses(h.slice(0, 8) + '01', -1); return [d, sumarDias(h.slice(0, 8) + '01', -1), 'Mes anterior']; }
  if (PER_CAJA === 'anio') return [h.slice(0, 4) + '-01-01', h, 'Este año'];
  return [CAJA_D || h, CAJA_H || h, 'Período'];
}
PANTALLAS.caja = async (main) => {
  titulo('Caja');
  const [d, h, nom] = rangoCaja(), r = caja(d, h);
  main.innerHTML = `<div class="fila" style="margin-bottom:12px"><div class="seg" id="cjP">${[['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Semana'], ['mes', 'Mes'], ['mesant', 'Mes anterior'], ['anio', 'Año'], ['otro', 'Elegir']]
      .map(([k, t]) => `<button data-p="${k}" class="${PER_CAJA === k ? 'act' : ''}">${t}</button>`).join('')}</div>
      ${PER_CAJA === 'otro' ? `<input type="date" id="cjD" value="${d}" style="width:auto"><input type="date" id="cjH" value="${h}" style="width:auto">` : ''}</div>
    <div class="fila" style="margin-bottom:14px"><button class="btn acento" id="cjCob">${ico('caja')} Cobrar cuota</button><button class="btn" id="cjIng">${ico('plus')} Otro ingreso</button>
      <button class="btn" id="cjGas">Gasto</button><button class="btn" id="cjRet">Retiro</button><span class="sp"></span><button class="btn" id="cjPr">${ico('imprimir')} Imprimir</button></div>
    <div class="kpis"><div class="kpi oscuro"><small>Entró · ${esc(nom)}</small><b>${money(r.entra)}</b><div class="sub">${r.nCuotas} cuota${r.nCuotas === 1 ? '' : 's'}${r.deudas ? ' · deudas ' + money(r.deudas) : ''}</div></div>
      <div class="kpi"><small>Gastos y retiros</small><b>${money(r.gastos + r.retiros)}</b><div class="sub">gastos ${money(r.gastos)} · retiros ${money(r.retiros)}</div></div>
      <div class="kpi"><small>Queda</small><b class="${r.neto < 0 ? 'mal' : 'ok'}">${money(r.neto)}</b><div class="sub">${dmy(d)}${d !== h ? ' al ' + dmy(h) : ''}</div></div>
      <div class="kpi"><small>Quedó debiendo</small><b class="${r.fiado ? 'warn' : ''}">${money(r.fiado)}</b><div class="sub">cuotas sin pagar en el período</div></div></div>
    <div class="grid g2">
      <div class="card"><h2>${ico('caja')} Por medio de pago</h2><div class="tabla-x"><table class="t"><thead><tr><th>Medio</th><th class="r">Cuotas</th><th class="r">Otros</th><th class="r">Salió</th><th class="r">Neto</th></tr></thead><tbody>
        ${r.medios.map(x => `<tr><td><b>${esc(x.medio)}</b></td><td class="r">${money(x.cuotas + x.deudas)}</td><td class="r">${money(x.ingresos)}</td><td class="r">${x.gastos + x.retiros ? '− ' + money(x.gastos + x.retiros) : ''}</td><td class="r"><b>${money(x.neto)}</b></td></tr>`).join('')
          || '<tr><td colspan="5" class="muted">Sin movimientos</td></tr>'}
        ${r.medios.length > 1 ? `<tr class="tot"><td>Total</td><td class="r">${money(r.cuotas + r.deudas)}</td><td class="r">${money(r.ingresos)}</td><td class="r">${r.gastos + r.retiros ? '− ' + money(r.gastos + r.retiros) : ''}</td><td class="r">${money(r.neto)}</td></tr>` : ''}</tbody></table></div></div>
      <div class="card"><h2>${ico('reloj')} Día por día</h2><div class="tabla-x"><table class="t"><thead><tr><th>Día</th><th class="r">Entró</th><th class="r">Salió</th><th class="r">Neto</th></tr></thead><tbody>
        ${r.dias.map(x => `<tr><td>${DIAS_C[diaSemana(x.dia)]} ${dmy(x.dia)}</td><td class="r">${money(x.entra)}</td><td class="r">${x.sale ? '− ' + money(x.sale) : ''}</td><td class="r"><b>${money(x.entra - x.sale)}</b></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin movimientos</td></tr>'}</tbody></table></div></div></div>
    <div class="card" style="padding:6px 14px"><h2 style="margin:10px 0 4px">Movimientos</h2><div class="lista">
      ${[...r.cobros.map(c => ({ f: c.fecha, html: `<div class="it" data-cb="${c.id}">${avatar(DB.get('alumnos', c.alumno_id))}<div class="tx"><b>${esc(DB.get('alumnos', c.alumno_id)?.nombre || (c.alumno_borrado ? 'Alumno borrado' : ''))}</b><small>${dmy(c.fecha)} ${c.fecha.slice(11)} · ${c.tipo === 'CUOTA' ? esc(c.concepto) : 'Pago de deuda'} · ${c.pagos.map(p => esc(p.medio)).join(' + ')}</small></div><b class="num">${money2(c.total)}</b></div>` })),
         ...r.movs.map(x => ({ f: x.fecha, html: `<div class="it" data-mv="${x.id}"><div class="av">${x.tipo === 'INGRESO' ? '+' : '−'}</div><div class="tx"><b>${x.tipo === 'INGRESO' ? 'Ingreso' : x.tipo === 'GASTO' ? 'Gasto' + (x.categoria ? ': ' + esc(x.categoria) : '') : 'Retiro'}</b><small>${dmy(x.fecha)} · ${esc(x.concepto)} · ${esc(x.medio)}</small></div><b class="num ${x.tipo === 'INGRESO' ? '' : 'mal'}">${x.tipo === 'INGRESO' ? '' : '− '}${money2(x.monto)}</b></div>` }))]
        .sort((a, b) => b.f.localeCompare(a.f)).map(x => x.html).join('') || vacio('caja', 'No hay movimientos en este período')}</div></div>`;
  const re = () => PANTALLAS.caja(main);
  $('#cjP').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; PER_CAJA = b.dataset.p; re(); };
  if ($('#cjD')) { $('#cjD').onchange = e => { CAJA_D = e.target.value; re(); }; $('#cjH').onchange = e => { CAJA_H = e.target.value; re(); }; }
  $('#cjCob').onclick = () => cobrar(null, re);
  $('#cjIng').onclick = () => cargarMovimiento('INGRESO', re); $('#cjGas').onclick = () => cargarMovimiento('GASTO', re); $('#cjRet').onclick = () => cargarMovimiento('RETIRO', re);
  $('#cjPr').onclick = () => imprimirCaja(r, nom);
  main.onclick = async e => {
    const b = e.target.closest('[data-cb],[data-mv]'); if (!b) return;
    if (b.dataset.cb) return verCobro(+b.dataset.cb, re);
    const x = DB.get('movimientos', b.dataset.mv);
    if (await confirmar(`¿Borrar este movimiento de ${money2(x.monto)}?`, 'Borrar', true)) { try { x.estado = 'ANULADO'; await DB.guardar('movimientos', x); await DB.anotar('Movimiento borrado', `${x.concepto} ${money2(x.monto)}`); re(); } catch (er) { fallo(er); } }
  };
};
function imprimirCaja(r, nom) {
  const m = modal(`Caja · ${esc(nom)}`, `<h3 style="margin-top:0">${esc(DB.cfg.nombre)} · Caja del ${dmy(r.desde)}${r.desde !== r.hasta ? ' al ' + dmy(r.hasta) : ''}</h3>
    <table class="t"><thead><tr><th>Medio</th><th class="r">Entró</th><th class="r">Salió</th><th class="r">Neto</th></tr></thead><tbody>
    ${r.medios.map(x => `<tr><td>${esc(x.medio)}</td><td class="r">${money2(x.cuotas + x.deudas + x.ingresos)}</td><td class="r">${money2(x.gastos + x.retiros)}</td><td class="r">${money2(x.neto)}</td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td class="r">${money2(r.entra)}</td><td class="r">${money2(r.gastos + r.retiros)}</td><td class="r">${money2(r.neto)}</td></tr></tbody></table>
    <p class="chico">Cuotas cobradas: ${r.nCuotas} · Quedó debiendo: ${money2(r.fiado)}</p>`, `<button class="btn" data-cerrar>Cerrar</button><button class="btn pri" id="icP">${ico('imprimir')} Imprimir</button>`);
  $('#icP', m).onclick = () => window.print();
}
