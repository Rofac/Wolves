/* Configuración, copias de seguridad, licencia y "Más" (en el celular). */
'use strict';

PANTALLAS.mas = async (main) => {
  titulo('Más');
  main.innerHTML = `<div class="card" style="padding:6px 14px"><div class="lista">
    <div class="it" data-ir2="progreso"><div class="av">${ico('progreso')}</div><div class="tx"><b>Calistenia</b><small>Habilidades, pruebas, ranking y rutinas por nivel</small></div>${ico('flecha')}</div>
    <div class="it" data-ir2="config"><div class="av">${ico('config')}</div><div class="tx"><b>Configuración</b><small>Cuotas, datos del gimnasio, clave, licencia</small></div>${ico('flecha')}</div>
    <div class="it" id="maCopia"><div class="av">${ico('copia')}</div><div class="tx"><b>Copia de seguridad</b><small>${DB.cfg.ultima_copia ? 'Última: ' + dmy(DB.cfg.ultima_copia) : 'Nunca se hizo'}</small></div>${ico('flecha')}</div></div></div>`;
  main.onclick = e => { const b = e.target.closest('[data-ir2]'); if (b) ir(b.dataset.ir2, null, true); if (e.target.closest('#maCopia')) hacerCopia(); };
};

async function hacerCopia() {
  const antes = DB.cfg.ultima_copia; await DB.setCfg('ultima_copia', ahora(), true);
  const j = DB.exportar(), txt = JSON.stringify(j);
  const nombre = `Copia ${(DB.cfg.nombre || 'Calistenia').replace(/[^\w áéíóúñÁÉÍÓÚÑ-]/g, '')} ${hoy()} ${ahora().slice(11).replace(':', 'h')}.json`;
  const file = new File([txt], nombre, { type: 'application/json' });
  let ok = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Copia de seguridad', text: `Copia de seguridad de ${DB.cfg.nombre} (${dmy(hoy())})` }); ok = true; }
    catch (e) { if (e.name === 'AbortError') { await DB.setCfg('ultima_copia', antes || '', true); return; } }
  }
  if (!ok) { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = nombre; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  toast(ok ? 'Copia enviada' : 'Copia descargada en la carpeta Descargas');
  if (ACTUAL === 'inicio' || ACTUAL === 'config' || ACTUAL === 'mas') recargar();
}
function restaurarCopia(j) {
  return (async () => {
    const n = (j.data && j.data.alumnos || []).length;
    if (!await confirmar(`Se van a REEMPLAZAR todos los datos de esta tablet por la copia de <b>${esc(j.gym || '')}</b> del <b>${esc(dmy(j.fecha))} ${esc((j.fecha || '').slice(11))}</b> (${n} alumnos). ¿Seguro?`, 'Sí, restaurar', true)) return;
    try { await DB.copiaDiaria(); await DB.importar(j); toast('Copia restaurada'); setTimeout(() => location.reload(), 900); } catch (e) { fallo(e); }
  })();
}

let LIC_ESTADO = null;
PANTALLAS.config = async (main) => {
  titulo('Configuración');
  const c = DB.cfg, lic = LIC_ESTADO = await LIC.estado(), copias = await DB.copiasInternas();
  const abs = DB.todos('abonos').filter(a => a.activo !== false);
  main.innerHTML = `
    <div class="card"><h2>${ico('inicio')} Datos del gimnasio</h2><div class="form">
      <div class="campo full"><label>Nombre (aparece en recibos y mensajes; la licencia va a este nombre)</label><input id="cf_n" value="${esc(c.nombre)}"></div>
      <div class="campo"><label>Dirección</label><input id="cf_d" value="${esc(c.direccion)}"></div><div class="campo"><label>Teléfono</label><input id="cf_t" value="${esc(c.telefono)}"></div></div>
      <button class="btn pri" id="cfG1">${ico('check')} Guardar</button></div>

    <div class="card"><h2>${ico('caja')} Cuotas<span class="sp"></span><button class="btn chico acento" id="cfAbN">${ico('plus')} Cuota</button></h2>
      <div class="lista">${abs.map(a => `<div class="it" data-ab="${a.id}"><div class="tx"><b>${esc(a.nombre)}</b><small>${a.duracion} ${a.tipo === 'DIAS' ? 'día' + (a.duracion == 1 ? '' : 's') : a.duracion == 1 ? 'mes' : 'meses'}</small></div><b class="num ${a.precio ? '' : 'mal'}">${a.precio ? money(a.precio) : 'Poné el precio'}</b>${ico('lapiz')}</div>`).join('')}</div>
      <div class="form" style="margin-top:12px"><div class="campo"><label>Si paga antes de que venza</label><select id="cf_r">${opciones([{ v: 'VENCIMIENTO', t: 'Sigue desde el vencimiento (no pierde días)' }, { v: 'HOY', t: 'Cuenta desde el día que paga' }], c.renovacion)}</select></div>
        <div class="campo"><label>Avisar "por vencer" (días antes)</label><input id="cf_av" inputmode="numeric" value="${esc(c.dias_aviso)}"></div>
        <div class="campo full"><label>Mensaje para recordar la cuota por WhatsApp ({nombre}, {gym}, {vence})</label><textarea id="cf_msg">${esc(c.msg_vencida)}</textarea></div></div>
      <button class="btn pri" id="cfG2">${ico('check')} Guardar</button></div>

    <div class="card"><h2>${ico('rutina')} Listas</h2><div class="form">
      <div class="campo"><label>Niveles (uno por renglón)</label><textarea id="cf_ni">${esc(c.niveles.join('\n'))}</textarea></div>
      <div class="campo"><label>Medios de pago (uno por renglón)</label><textarea id="cf_me">${esc(c.medios.join('\n'))}</textarea></div>
      <div class="campo full"><label>Tipos de gasto (uno por renglón)</label><textarea id="cf_ga">${esc(c.categorias_gasto.join('\n'))}</textarea></div></div>
      <button class="btn pri" id="cfG3">${ico('check')} Guardar</button></div>

    <div class="card"><h2>${ico('copia')} Copia de seguridad</h2>
      <p style="margin-top:0">Todo está guardado <b>en esta tablet</b>. Si se rompe, se pierde o la resetean, sólo se recupera con una copia.
        Tocá "Hacer copia" y mandala a <b>Google Drive</b> o a tu <b>WhatsApp</b> (por ejemplo a vos mismo). Conviene una vez por semana.</p>
      <p class="${!c.ultima_copia ? 'mal' : ''}"><b>Última copia:</b> ${c.ultima_copia ? dmy(c.ultima_copia) + ' ' + c.ultima_copia.slice(11) : 'nunca'}</p>
      <div class="fila"><button class="btn acento" id="cfCp">${ico('copia')} Hacer copia</button><label class="btn" style="margin:0">${ico('subir')} Restaurar una copia<input type="file" accept=".json,application/json" id="cfRs" hidden></label>
        <label class="chk" style="margin-left:6px">Avisar cada <input id="cf_ac" inputmode="numeric" value="${esc(c.aviso_copia_dias)}" style="width:64px;min-height:38px;padding:6px"> días</label></div>
      ${copias.length ? `<p class="muted chico" style="margin-bottom:6px">Además la app guarda sola una copia por día adentro de la tablet (las últimas 5), por si se borra algo sin querer:</p>
        <div class="fila">${copias.map(x => `<button class="btn chico" data-ci="${x.k}">${dmy(x.fecha)}</button>`).join('')}</div>` : ''}</div>

    <div class="card"><h2>${ico('candado')} Clave del dueño</h2>
      <p style="margin-top:0" class="muted">Si la ponés, la pide para entrar a la Caja, a la Configuración y para anular cobros. Así los profes pueden usar la tablet para la asistencia sin ver la plata.</p>
      <div class="fila"><input id="cf_pin" type="password" inputmode="numeric" placeholder="${c.pin ? 'Nueva clave (4 a 8 números)' : '4 a 8 números'}" style="max-width:240px" autocomplete="new-password">
        <button class="btn pri" id="cfPin">${c.pin ? 'Cambiar clave' : 'Poner clave'}</button>${c.pin ? `<button class="btn rojo" id="cfPinQ">Quitar clave</button>` : ''}</div></div>

    <div class="card"><h2>${ico('check')} Licencia</h2>
      <div class="estado-cuota ${lic.activa ? (lic.por_vencer ? 'warn' : 'ok') : lic.bloqueado ? 'mal' : 'warn'}" style="margin-bottom:12px"><div class="tx"><b>${esc(lic.mensaje)}</b></div></div>
      <label>Código de esta tablet (mandáselo a quien te vendió la app para pedir la licencia)</label>
      <div class="fila" style="margin-bottom:12px"><b style="font-size:22px;letter-spacing:2px;user-select:all" id="cfEq">${esc(lic.equipo)}</b><button class="btn chico" id="cfEqC">Copiar</button>
        <button class="btn chico" id="cfEqW">${ico('wa')} Mandar</button></div>
      <label>Clave de licencia</label><textarea id="cf_lic" style="font-family:monospace;min-height:70px">${esc(c.licencia || '')}</textarea>
      <button class="btn pri" id="cfLic" style="margin-top:10px">Activar</button></div>

    <div class="card"><h2>${ico('config')} Apariencia y ayuda</h2><div class="fila">
      <div class="seg" id="cfTema">${[['', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, t]) => `<button data-tm="${k}" class="${(c.tema || '') === k ? 'act' : ''}">${t}</button>`).join('')}</div>
      <button class="btn" id="cfAct">${ico('reloj')} Registro de actividad</button><button class="btn" id="cfInst">Cómo instalar la app</button></div></div>
    <div class="card"><h2>Acerca de</h2><div class="fila"><div class="sp"><b style="font-size:18px">RoFac</b><div class="muted chico">Versión 1.0</div></div>
      <button class="btn" id="cfLegal">Términos y privacidad</button></div></div>`;
  const re = () => PANTALLAS.config(main);
  const lineas = id => $('#' + id).value.split('\n').map(x => x.trim()).filter(Boolean);
  $('#cfG1').onclick = async () => { try { const n = val('cf_n'); if (!n) throw new Error('Poné el nombre'); await DB.setCfg('nombre', n); await DB.setCfg('direccion', val('cf_d')); await DB.setCfg('telefono', val('cf_t')); pintarMenu(); toast('Guardado'); arrancarLicencia(); re(); } catch (e) { fallo(e); } };
  $('#cfG2').onclick = async () => { try { await DB.setCfg('renovacion', val('cf_r')); await DB.setCfg('dias_aviso', Math.max(0, parseInt(val('cf_av')) || 5)); await DB.setCfg('msg_vencida', $('#cf_msg').value.trim() || CONFIG_INICIAL.msg_vencida); toast('Guardado'); } catch (e) { fallo(e); } };
  $('#cfG3').onclick = async () => { try { const ni = lineas('cf_ni'), me = lineas('cf_me'), ga = lineas('cf_ga'); if (!ni.length || !me.length) throw new Error('Tiene que haber al menos un nivel y un medio de pago');
    if (me.includes(CTA)) throw new Error('Ese nombre de medio está reservado'); await DB.setCfg('niveles', ni); await DB.setCfg('medios', me); await DB.setCfg('categorias_gasto', ga.length ? ga : ['Otros']); toast('Guardado'); } catch (e) { fallo(e); } };
  $('#cfAbN').onclick = () => editarAbono({}, re);
  main.onclick = async e => {
    const ab = e.target.closest('[data-ab]'); if (ab) return editarAbono(DB.get('abonos', ab.dataset.ab), re);
    const ci = e.target.closest('[data-ci]'); if (ci) { const j = await DB.copiaInterna(ci.dataset.ci); if (j) restaurarCopia(j); }
  };
  $('#cfCp').onclick = () => hacerCopia();
  $('#cf_ac').onchange = e => DB.setCfg('aviso_copia_dias', Math.max(1, parseInt(e.target.value) || 7), true);
  $('#cfRs').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { restaurarCopia(JSON.parse(await f.text())); } catch (x) { fallo(new Error('No se pudo leer el archivo de copia')); } };
  $('#cfPin').onclick = async () => { const p = val('cf_pin'); if (!/^\d{4,8}$/.test(p)) return toast('La clave tiene que ser de 4 a 8 números', true); await DB.setCfg('pin', await sha256(p), true); DESBLOQUEADO = true; await DB.anotar('Clave del dueño cambiada'); toast('Clave guardada'); re(); };
  if ($('#cfPinQ')) $('#cfPinQ').onclick = async () => { if (!await confirmar('¿Quitar la clave del dueño?', 'Quitar', true)) return; await DB.setCfg('pin', '', true); toast('Clave quitada'); re(); };
  $('#cfEqC').onclick = async () => { try { await navigator.clipboard.writeText(lic.equipo); toast('Código copiado'); } catch (e) { toast('Mantené apretado el código para copiarlo'); } };
  $('#cfEqW').onclick = () => abrirWa('', `Hola! Te paso el código de la tablet para la licencia de ${DB.cfg.nombre}: ${lic.equipo}`);
  $('#cfLic').onclick = async () => { const k = $('#cf_lic').value.replace(/\s/g, ''); const r = await LIC.verificar(k, DB.cfg.nombre, lic.equipo);
    if (k && !r.activa) return toast(r.mensaje, true); await DB.setCfg('licencia', k, true); await DB.anotar('Licencia cargada'); toast(r.activa ? '¡Licencia activada!' : 'Licencia borrada'); await arrancarLicencia(); re(); };
  $('#cfTema').onclick = async e => { const b = e.target.closest('[data-tm]'); if (!b) return; await DB.setCfg('tema', b.dataset.tm, true); aplicarTema(); re(); };
  $('#cfAct').onclick = () => modal('Registro de actividad', `<table class="t">${DB.todos('actividad').slice(-300).reverse().map(a => `<tr><td class="chico muted" style="white-space:nowrap">${dmy(a.fecha)} ${a.fecha.slice(11)}</td><td><b>${esc(a.accion)}</b><div class="chico muted">${esc(a.detalle)}</div></td></tr>`).join('') || '<tr><td class="muted">Sin actividad</td></tr>'}</table>`, '', 'ancho');
  $('#cfInst').onclick = ayudaInstalar;
  $('#cfLegal').onclick = verLegal;
};

function editarAbono(a, luego) {
  const m = modal(a.id ? 'Modificar cuota' : 'Nueva cuota', `<div class="form"><div class="campo full"><label>Nombre</label><input id="eb_n" value="${esc(a.nombre || '')}" placeholder="Ej. Mensual libre, 3 veces por semana, Trimestral"></div>
    <div class="campo"><label>Precio</label>${campoMonto('id="eb_p"', a.precio ?? '')}</div>
    <div class="campo"><label>Dura</label><div class="fila" style="flex-wrap:nowrap"><input id="eb_d" inputmode="numeric" value="${esc(a.duracion || 1)}" style="width:80px"><select id="eb_t">${opciones([{ v: 'MESES', t: 'mes(es)' }, { v: 'DIAS', t: 'día(s)' }], a.tipo || 'MESES')}</select></div></div></div>`,
    `${a.id ? `<button class="btn rojo" id="ebB">${ico('trash')} Quitar</button>` : ''}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ebOk">${ico('check')} Guardar</button>`);
  $('#ebOk', m).onclick = async () => { try { const nombre = val('eb_n', m), precio = r2(n0($('#eb_p', m).value)), duracion = parseInt(val('eb_d', m)) || 1;
    if (!nombre) throw new Error('Poné el nombre'); if (precio < 0) throw new Error('Precio inválido');
    const viejo = a.precio; await DB.guardar('abonos', Object.assign(a, { nombre, precio, duracion, tipo: val('eb_t', m), activo: true }));
    await DB.anotar('Cuota guardada', `${nombre} ${money(precio)}${viejo !== undefined && viejo !== precio ? ' (antes ' + money(viejo) + ')' : ''}`); m.cerrar(); toast('Guardado'); luego && luego(); } catch (e) { fallo(e); } };
  if ($('#ebB', m)) $('#ebB', m).onclick = async () => { if (abonosActivos().length < 2) return toast('Tiene que quedar al menos una cuota', true); if (!await confirmar(`¿Quitar "${esc(a.nombre)}"?`, 'Quitar', true)) return; a.activo = false; await DB.guardar('abonos', a); m.cerrar(); luego && luego(); };
}

function ayudaInstalar() {
  modal('Cómo instalar la app', `<ol style="padding-left:20px;line-height:1.7;margin-top:0">
    <li>En la tablet, abrí <b>Chrome</b> y entrá a la dirección de la app.</li>
    <li>Tocá el menú <b>⋮</b> (arriba a la derecha) y elegí <b>"Instalar aplicación"</b> o <b>"Agregar a la pantalla principal"</b>.</li>
    <li>Queda el ícono de Wolves en la pantalla. De ahí en más se abre como cualquier app, <b>sin internet</b>.</li></ol>
    <p><b>Importante:</b> los datos quedan en la tablet. No borres los datos de Chrome ni "desinstales" la app sin antes hacer una copia de seguridad.</p>`, '<button class="btn pri" data-cerrar>Entendido</button>');
}
