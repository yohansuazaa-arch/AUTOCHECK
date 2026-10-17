/* AutoCheck – Administrar seguridad y datos (CU-15; RNF-02 a RNF-05)
   La clave de acceso es solo de prototipo: en producción vendría de una cuenta de administración real. */
const CLAVE_ADMIN = 'AutoCheck2026';
const KEY_USERS = 'ac_users';
const KEY_TALLERES = 'ac_talleres';
const KEY_SOL = 'ac_solicitudes_taller';
const KEY_CITAS = 'ac_citas';
const $ = id => document.getElementById(id);
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const guardar = (k, v) => localStorage.setItem(k, JSON.stringify(v));
function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}
function errorCampo(id, msg) {
  document.querySelector(`[data-for="${id}"]`).textContent = msg || '';
  if (msg) $(id).setAttribute('aria-invalid', 'true'); else $(id).removeAttribute('aria-invalid');
}

function registrar(operacion, resultado) {
  const log = leer('ac_log', []);
  log.unshift({ fecha: new Date().toISOString(), operacion, resultado });
  localStorage.setItem('ac_log', JSON.stringify(log.slice(0, 50)));
}

function fila(titulo, clase, estado, detalle) {
  const a = el('article', `servicio doc estado-${clase}`);
  const top = el('div', 'servicio-top');
  top.append(el('h3', '', titulo), el('span', `badge ${clase}`, estado));
  a.append(top, el('p', 'detalle', detalle));
  return a;
}

/* ---------- Menú lateral y secciones ---------- */
const SECCIONES = ['seguridad', 'datos', 'solicitudes', 'talleres', 'citas', 'respaldo'];
const esMovil = () => window.matchMedia('(max-width: 800px)').matches;

// El estado del menú y la sección activa se recuerdan solo durante la sesión (no entran en la copia de respaldo)
function ponerMenu(abierto) {
  $('admin-panel').classList.toggle('menu-cerrado', !abierto);
  $('btn-menu').setAttribute('aria-expanded', String(abierto));
}
function alternarMenu(abierto) {
  ponerMenu(abierto);
  sessionStorage.setItem('admin_menu', abierto ? '1' : '0');
}

function irA(sec) {
  if (!SECCIONES.includes(sec)) sec = 'seguridad';
  SECCIONES.forEach(s => {
    $('sec-' + s).hidden = s !== sec;
    const b = document.querySelector(`.menu-item[data-sec="${s}"]`);
    if (s === sec) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  sessionStorage.setItem('admin_seccion', sec);
  if (esMovil()) ponerMenu(false);                   // en pantallas pequeñas el menú se cierra al elegir
  window.scrollTo({ top: 0 });
}

function iniciarMenu() {
  const guardado = sessionStorage.getItem('admin_menu');
  ponerMenu(!esMovil() && guardado !== '0');
  irA(sessionStorage.getItem('admin_seccion') || 'seguridad');
}

document.querySelectorAll('.menu-item[data-sec]').forEach(b => b.addEventListener('click', () => irA(b.dataset.sec)));
$('btn-menu').addEventListener('click', () => alternarMenu($('admin-panel').classList.contains('menu-cerrado')));
$('btn-menu-cerrar').addEventListener('click', () => alternarMenu(false));
$('admin-fondo').addEventListener('click', () => alternarMenu(false));
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && esMovil() && !$('admin-panel').hidden && !$('admin-panel').classList.contains('menu-cerrado')) alternarMenu(false);
});

/* ---------- Validación de datos de usuario (misma regla que app.js) ---------- */
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_DOC = /^[A-Za-z0-9]{5,15}$/;
const REGEX_TEL = /^\d{7,10}$/;
function validarDatos(d, usuarios, idPropio) {
  const otros = usuarios.filter(u => u.id !== idPropio);
  return {
    nombre: !d.nombre ? 'Escribe el nombre.' : d.nombre.length > 50 ? 'Máximo 50 caracteres.' : '',
    apellido: !d.apellido ? 'Escribe el apellido.' : d.apellido.length > 50 ? 'Máximo 50 caracteres.' : '',
    documento: !d.documento ? 'Escribe el número de documento.'
      : !REGEX_DOC.test(d.documento) ? 'Usa de 5 a 15 letras o números, sin espacios ni puntos.'
      : otros.some(u => u.tipoDoc === d.tipoDoc && u.documento === d.documento) ? 'Este documento ya está registrado.' : '',
    correo: !d.correo ? 'Escribe el correo electrónico.'
      : !REGEX_CORREO.test(d.correo) ? 'El correo no tiene un formato válido.'
      : otros.some(u => u.correo === d.correo) ? 'Este correo ya pertenece a otra cuenta.' : '',
    telefono: d.telefono && !REGEX_TEL.test(d.telefono) ? 'Usa solo números, entre 7 y 10 dígitos.' : ''
  };
}

/* ---------- Talleres aliados ---------- */
// El administrador los consulta y puede dar de baja uno
function renderTalleresAdmin() {
  const lista = leer(KEY_TALLERES, []);
  $('admin-talleres').replaceChildren(...(lista.length ? lista.map(t => {
    const a = el('article', 'servicio');
    const top = el('div', 'servicio-top');
    top.append(el('h3', '', t.nombre), el('span', 'fecha', t.ciudad));
    const quitar = el('button', 'btn btn-ghost', 'Dar de baja');
    quitar.type = 'button';
    quitar.addEventListener('click', () => {
      if (!confirm(`¿Dar de baja el taller "${t.nombre}"? Dejará de recomendarse a los propietarios.`)) return;
      guardar(KEY_TALLERES, leer(KEY_TALLERES, []).filter(x => x.id !== t.id));
      registrar('Taller aliado', `dado de baja (${t.nombre})`);
      renderEstado();
    });
    a.append(top, el('p', 'detalle', `${t.direccion} · Tel. ${t.telefono}`), el('p', 'proximo', `Servicios: ${t.servicios.join(', ')}`), quitar);
    return a;
  }) : [el('p', 'empty soon', 'Todavía no hay talleres aliados registrados.')]));
}

/* ---------- Solicitudes de talleres: aceptar o rechazar ---------- */
function resolverSolicitud(id, aceptar) {
  const todas = leer(KEY_SOL, []);
  const s = todas.find(x => x.id === id);
  if (!s || s.estado !== 'pendiente') return;
  if (aceptar) {
    const talleres = leer(KEY_TALLERES, []);
    if (!talleres.some(t => t.id === s.id)) {
      talleres.push({ id: s.id, nombre: s.nombre, direccion: s.direccion, ciudad: s.ciudad, telefono: s.telefono, servicios: s.servicios });
      guardar(KEY_TALLERES, talleres);
    }
  }
  s.estado = aceptar ? 'aceptada' : 'rechazada';
  s.resueltaEn = new Date().toISOString();
  guardar(KEY_SOL, todas);
  registrar('Solicitud de taller', `${aceptar ? 'aceptada' : 'rechazada'} (${s.nombre})`);
  renderEstado();
}

function renderSolicitudes() {
  const todas = leer(KEY_SOL, []);
  const pend = todas.filter(s => s.estado === 'pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha));
  const resueltas = todas.filter(s => s.estado !== 'pendiente').sort((a, b) => b.resueltaEn.localeCompare(a.resueltaEn)).slice(0, 5);
  $('sol-badge').textContent = `${pend.length} ${pend.length === 1 ? 'pendiente' : 'pendientes'}`;
  $('menu-sol-badge').textContent = String(pend.length);   // contador en el menú lateral
  $('menu-sol-badge').hidden = pend.length === 0;

  const items = pend.map(s => {
    const a = el('article', 'servicio');
    const top = el('div', 'servicio-top');
    top.append(el('h3', '', s.nombre), el('span', 'fecha', s.ciudad));
    const acciones = el('div', 'acciones');
    const ok = el('button', 'btn btn-solid', 'Aceptar');
    const no = el('button', 'btn btn-ghost', 'Rechazar');
    ok.type = no.type = 'button';
    ok.addEventListener('click', () => resolverSolicitud(s.id, true));
    no.addEventListener('click', () => {
      if (confirm(`¿Rechazar la solicitud del taller "${s.nombre}"?`)) resolverSolicitud(s.id, false);
    });
    acciones.append(ok, no);
    a.append(top,
      el('p', 'detalle', `${s.direccion} · Tel. ${s.telefono}`),
      el('p', 'proximo', `Servicios: ${s.servicios.join(', ')}`),
      el('p', 'detalle', `Solicitud enviada el ${new Date(s.fecha).toLocaleString('es-CO')}`),
      acciones);
    return a;
  });
  if (!pend.length) items.push(el('p', 'empty soon', 'No hay solicitudes pendientes.'));

  resueltas.forEach(s => {
    const a = el('article', 'servicio doc estado-old');
    const top = el('div', 'servicio-top');
    const acept = s.estado === 'aceptada';
    top.append(el('h3', '', s.nombre), el('span', `badge ${acept ? 'ok' : 'bad'}`, acept ? 'Aceptada' : 'Rechazada'));
    a.append(top, el('p', 'detalle', `${s.ciudad} · Resuelta el ${new Date(s.resueltaEn).toLocaleString('es-CO')}`));
    items.push(a);
  });
  $('admin-solicitudes').replaceChildren(...items);
}

/* ---------- Citas en talleres: aprobar, cambiar o rechazar ---------- */
const verPlaca = p => `${p.slice(0, 3)} ${p.slice(3)}`;
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fechaLarga = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }); };
const horaLarga = h => { const [hh, mm] = h.split(':').map(Number); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'p. m.' : 'a. m.'}`; };
const ESTADO_CITA = {
  pendiente: { clave: 'warn', texto: 'Pendiente' },
  aprobada: { clave: 'ok', texto: 'Aprobada' },
  rechazada: { clave: 'bad', texto: 'Rechazada' },
  cancelada: { clave: 'old', texto: 'Cancelada' }
};
let editandoCita = null;

function propietario(id) {
  const u = leer(KEY_USERS, []).find(x => x.id === id);
  if (!u) return 'Propietario no encontrado';
  return `${`${u.nombre || ''} ${u.apellido || ''}`.trim()} · ${u.correo}${u.telefono ? ' · Tel. ' + u.telefono : ''}`;
}
function avisoCita(msg) { $('cita-ok').textContent = msg; $('cita-ok').hidden = false; }

function aprobarCita(id) {
  const todas = leer(KEY_CITAS, []);
  const c = todas.find(x => x.id === id);
  if (!c || c.estado !== 'pendiente') return;
  c.estado = 'aprobada'; c.resueltaEn = new Date().toISOString(); c.tallerNotificadoEn = c.resueltaEn; c.vista = false;
  guardar(KEY_CITAS, todas);
  registrar('Cita', `aprobada (${verPlaca(c.placa)}, ${c.tallerNombre})`);
  avisoCita('Cita aprobada. Se notificó al taller (simulado) y el propietario verá la respuesta en su panel.');
  renderEstado();
}

// Rechaza una cita pendiente o cancela una aprobada, con un motivo opcional para el propietario
function cerrarCita(id, nuevoEstado) {
  const todas = leer(KEY_CITAS, []);
  const c = todas.find(x => x.id === id);
  if (!c || !['pendiente', 'aprobada'].includes(c.estado)) return;
  const motivo = window.prompt(nuevoEstado === 'rechazada' ? 'Motivo del rechazo (opcional):' : 'Motivo de la cancelación (opcional):', '');
  if (motivo === null) return;
  c.estado = nuevoEstado; c.notaAdmin = motivo.trim(); c.resueltaEn = new Date().toISOString(); c.vista = false;
  if (nuevoEstado === 'cancelada') c.motivoCancelacion = 'Cancelada por el administrador.';
  guardar(KEY_CITAS, todas);
  registrar('Cita', `${nuevoEstado} (${verPlaca(c.placa)}, ${c.tallerNombre})`);
  avisoCita(nuevoEstado === 'rechazada' ? 'Cita rechazada. El propietario verá la respuesta en su panel.' : 'Cita cancelada. El propietario verá la respuesta en su panel.');
  renderEstado();
}

function abrirCambioCita(c) {
  editandoCita = c.id;
  $('cita-ok').hidden = true;
  $('cita-form-titulo').textContent = c.estado === 'pendiente' ? 'Cambiar y aprobar cita' : 'Cambiar cita aprobada';
  const o = c.original || { tallerNombre: c.tallerNombre, fecha: c.fecha, hora: c.hora };
  $('cita-form-resumen').textContent = `${verPlaca(c.placa)} · ${c.vehiculo} · ${c.servicio}. El propietario pidió: ${o.tallerNombre}, ${fechaLarga(o.fecha)} a las ${horaLarga(o.hora)}.`;

  const todos = leer(KEY_TALLERES, []);
  const opciones = todos.filter(t => t.servicios.includes(c.servicio)).map(t => ({ id: t.id, texto: `${t.nombre} · ${t.ciudad}` }));
  if (!opciones.some(o2 => o2.id === c.tallerId)) {   // el taller de la cita sigue disponible aunque ya no esté activo
    opciones.unshift({ id: c.tallerId, texto: `${c.tallerNombre}${todos.some(t => t.id === c.tallerId) ? '' : ' (ya no está activo)'}` });
  }
  $('ca-taller').replaceChildren(...opciones.map(op => { const e = el('option', '', op.texto); e.value = op.id; return e; }));
  $('ca-taller').value = c.tallerId;
  $('ca-fecha').min = hoyISO();
  $('ca-fecha').value = c.fecha;
  $('ca-hora').value = c.hora;
  $('ca-nota').value = c.notaAdmin || '';
  ['ca-taller', 'ca-fecha', 'ca-hora'].forEach(id => errorCampo(id, ''));
  $('form-cita-admin').hidden = false;
  $('form-cita-admin').scrollIntoView({ behavior: 'smooth' });
}
$('btn-cancelar-ca').addEventListener('click', () => { editandoCita = null; $('form-cita-admin').hidden = true; });

$('form-cita-admin').addEventListener('submit', e => {
  e.preventDefault();
  const todas = leer(KEY_CITAS, []);
  const c = todas.find(x => x.id === editandoCita);
  if (!c) return;
  const tallerId = $('ca-taller').value, fecha = $('ca-fecha').value, hora = $('ca-hora').value, nota = $('ca-nota').value.trim();
  const eTaller = tallerId ? '' : 'Elige un taller.';
  const eFecha = !fecha ? 'Elige la fecha.' : fecha < hoyISO() ? 'La fecha no puede ser anterior a hoy.' : '';
  const eHora = !hora ? 'Elige la hora.' : (hora < '07:00' || hora > '18:00') ? 'Elige una hora entre las 7:00 a. m. y las 6:00 p. m.' : '';
  errorCampo('ca-taller', eTaller); errorCampo('ca-fecha', eFecha); errorCampo('ca-hora', eHora);
  if (eTaller || eFecha || eHora) return;

  const t = leer(KEY_TALLERES, []).find(x => x.id === tallerId);
  const cambio = tallerId !== c.tallerId || fecha !== c.fecha || hora !== c.hora;
  const ahora = new Date().toISOString();
  Object.assign(c, {
    tallerId, tallerNombre: t ? t.nombre : c.tallerNombre, tallerCiudad: t ? t.ciudad : c.tallerCiudad,
    fecha, hora, notaAdmin: nota, estado: 'aprobada', resueltaEn: ahora, tallerNotificadoEn: ahora, vista: false
  });
  guardar(KEY_CITAS, todas);
  registrar('Cita', `${cambio ? 'cambiada y aprobada' : 'aprobada'} (${verPlaca(c.placa)}, ${c.tallerNombre})`);
  editandoCita = null;
  $('form-cita-admin').hidden = true;
  avisoCita('Cita guardada y aprobada. Se notificó al taller (simulado) y el propietario verá los datos actualizados en su panel.');
  renderEstado();
});

function tarjetaCitaAdmin(c) {
  const est = ESTADO_CITA[c.estado] || ESTADO_CITA.pendiente;
  const a = el('article', `servicio doc estado-${est.clave}`);
  const top = el('div', 'servicio-top');
  top.append(el('h3', '', `${c.servicio} · ${c.tallerNombre}`), el('span', `badge ${est.clave}`, est.texto));
  a.append(top,
    el('p', 'detalle', `${verPlaca(c.placa)} · ${c.vehiculo}`),
    el('p', 'detalle', `Propietario: ${propietario(c.userId)}`),
    el('p', 'proximo', `${c.estado === 'aprobada' ? 'Agendada' : 'Solicitada'} para el ${fechaLarga(c.fecha)} a las ${horaLarga(c.hora)}`));
  const o = c.original;
  if (c.estado === 'aprobada' && o && (o.fecha !== c.fecha || o.hora !== c.hora || o.tallerNombre !== c.tallerNombre)) {
    a.append(el('p', 'detalle', `Cambiada por el administrador. Solicitud original: ${o.tallerNombre}, ${fechaLarga(o.fecha)} a las ${horaLarga(o.hora)}.`));
  }
  if (c.obs) a.append(el('p', 'detalle', `Observaciones del propietario: ${c.obs}`));
  if (c.notaAdmin) a.append(el('p', 'detalle', `Mensaje al propietario: ${c.notaAdmin}`));
  if (c.estado === 'cancelada' && c.motivoCancelacion) a.append(el('p', 'detalle', c.motivoCancelacion));
  if (c.estado === 'aprobada' && c.tallerNotificadoEn) a.append(el('p', 'detalle', `Taller notificado (simulado) el ${new Date(c.tallerNotificadoEn).toLocaleString('es-CO')}.`));
  a.append(el('p', 'detalle', `Solicitud enviada el ${new Date(c.creada).toLocaleString('es-CO')}`));

  const acciones = el('div', 'acciones acciones-item');
  const boton = (txt, clase, fn) => { const b = el('button', `btn ${clase} btn-sm`, txt); b.type = 'button'; b.addEventListener('click', fn); acciones.append(b); };
  if (c.estado === 'pendiente') {
    boton('Aprobar', 'btn-solid', () => aprobarCita(c.id));
    boton('Cambiar', 'btn-ghost', () => abrirCambioCita(c));
    boton('Rechazar', 'btn-ghost btn-danger', () => cerrarCita(c.id, 'rechazada'));
  } else if (c.estado === 'aprobada') {
    boton('Cambiar', 'btn-ghost', () => abrirCambioCita(c));
    boton('Cancelar cita', 'btn-ghost btn-danger', () => cerrarCita(c.id, 'cancelada'));
  }
  if (acciones.children.length) a.append(acciones);
  return a;
}

function renderCitasAdmin() {
  const todas = leer(KEY_CITAS, []);
  const porFecha = (a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`);
  const pend = todas.filter(c => c.estado === 'pendiente').sort(porFecha);
  const aprob = todas.filter(c => c.estado === 'aprobada').sort(porFecha);
  const otras = todas.filter(c => c.estado === 'rechazada' || c.estado === 'cancelada')
    .sort((a, b) => (b.resueltaEn || b.creada).localeCompare(a.resueltaEn || a.creada)).slice(0, 5);

  $('cita-badge').textContent = `${pend.length} ${pend.length === 1 ? 'pendiente' : 'pendientes'}`;
  $('menu-cita-badge').textContent = String(pend.length);        // contador en el menú lateral
  $('menu-cita-badge').hidden = pend.length === 0;

  const items = [];
  items.push(el('p', 'mini-titulo', 'Pendientes de revisión'));
  items.push(...(pend.length ? pend.map(tarjetaCitaAdmin) : [el('p', 'empty soon', 'No hay solicitudes de cita pendientes.')]));
  if (aprob.length) { items.push(el('p', 'mini-titulo', 'Aprobadas')); items.push(...aprob.map(tarjetaCitaAdmin)); }
  if (otras.length) { items.push(el('p', 'mini-titulo', 'Rechazadas y canceladas (las 5 más recientes)')); items.push(...otras.map(tarjetaCitaAdmin)); }
  $('admin-citas').replaceChildren(...items);
}

/* ---------- Detalle de "Datos almacenados" ---------- */
const COLECCIONES = [['Usuarios', 'ac_users'], ['Vehículos', 'ac_vehiculos'], ['Servicios', 'ac_servicios'],
  ['Documentos', 'ac_documentos'], ['Recordatorios', 'ac_recordatorios'], ['Talleres aliados', KEY_TALLERES],
  ['Solicitudes de talleres', KEY_SOL], ['Citas en talleres', KEY_CITAS]];
const OCULTAR = ['sal', 'hash', 'clave'];            // nunca se muestran datos de contraseña
const TIPOS_DOC = { CC: 'CC', CE: 'CE', TI: 'TI', PA: 'Pasaporte' };
let detalleAbierto = null;                           // { nombre, key }
let editandoId = null;

const formato = v => v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);

function tarjetaLectura(r) {
  const a = el('article', 'servicio');
  Object.entries(r).filter(([k]) => !OCULTAR.includes(k)).forEach(([k, v]) => a.append(el('p', 'detalle', `${k}: ${formato(v)}`)));
  return a;
}

function tarjetaUsuario(u) {
  const a = el('article', 'servicio');
  const top = el('div', 'servicio-top');
  top.append(el('h3', '', `${u.nombre || ''} ${u.apellido || ''}`.trim() || '(sin nombre)'),
    el('span', `badge ${u.plan === 'premium' ? 'prog' : 'old'}`, u.plan === 'premium' ? 'Premium' : 'Gratis'));
  const doc = u.documento ? `${TIPOS_DOC[u.tipoDoc] || u.tipoDoc || ''} ${u.documento}`.trim() : 'Sin documento';
  const editar = el('button', 'btn btn-ghost', 'Editar');
  editar.type = 'button';
  editar.addEventListener('click', () => editarUsuario(u));
  a.append(top,
    el('p', 'detalle', `${doc} · ${u.correo}`),
    el('p', 'detalle', `Teléfono: ${formato(u.telefono)} · Creado el ${u.creado ? new Date(u.creado).toLocaleDateString('es-CO') : '—'}`),
    editar);
  return a;
}

function refrescarDetalle() {
  if (!detalleAbierto) { $('admin-detalle').hidden = true; return; }
  const { nombre, key } = detalleAbierto;
  const datos = leer(key, []);
  $('admin-detalle').hidden = false;
  $('detalle-titulo').textContent = nombre;
  $('detalle-lista').replaceChildren(...(datos.length
    ? datos.map(r => key === KEY_USERS ? tarjetaUsuario(r) : tarjetaLectura(r))
    : [el('p', 'empty soon', 'No hay registros guardados.')]));
}

function abrirDetalle(nombre, key) {
  detalleAbierto = { nombre, key };
  editandoId = null;
  $('form-usuario-admin').hidden = true;
  $('ua-ok').hidden = true;
  refrescarDetalle();
  $('admin-detalle').scrollIntoView({ behavior: 'smooth' });
}
$('btn-cerrar-detalle').addEventListener('click', () => {
  detalleAbierto = null; editandoId = null;
  $('form-usuario-admin').hidden = true;
  refrescarDetalle();
});

/* ---------- Editar un usuario (el hash y la sal no se tocan) ---------- */
const CAMPOS_AU = { nombre: 'au-nombre', apellido: 'au-apellido', documento: 'au-documento', correo: 'au-correo', telefono: 'au-tel' };

function editarUsuario(u) {
  editandoId = u.id;
  $('au-nombre').value = u.nombre || '';
  $('au-apellido').value = u.apellido || '';
  $('au-tipodoc').value = u.tipoDoc || 'CC';
  $('au-documento').value = u.documento || '';
  $('au-correo').value = u.correo || '';
  $('au-tel').value = u.telefono || '';
  $('au-plan').value = u.plan || 'gratis';
  Object.values(CAMPOS_AU).forEach(id => errorCampo(id, ''));
  $('ua-ok').hidden = true;
  $('form-usuario-admin').hidden = false;
  $('form-usuario-admin').scrollIntoView({ behavior: 'smooth' });
  $('au-nombre').focus();
}
$('btn-cancelar-ua').addEventListener('click', () => { editandoId = null; $('form-usuario-admin').hidden = true; });

$('form-usuario-admin').addEventListener('submit', e => {
  e.preventDefault();
  const usuarios = leer(KEY_USERS, []);
  const u = usuarios.find(x => x.id === editandoId);
  if (!u) return;
  const datos = {
    nombre: $('au-nombre').value.trim(),
    apellido: $('au-apellido').value.trim(),
    tipoDoc: $('au-tipodoc').value,
    documento: $('au-documento').value.replace(/\s/g, '').toUpperCase(),
    correo: $('au-correo').value.trim().toLowerCase(),
    telefono: $('au-tel').value.replace(/\s/g, '')
  };
  const err = validarDatos(datos, usuarios, u.id);
  Object.entries(CAMPOS_AU).forEach(([k, id]) => errorCampo(id, err[k]));
  if (Object.values(err).some(Boolean)) return;

  Object.assign(u, datos, { plan: $('au-plan').value });
  guardar(KEY_USERS, usuarios);
  registrar('Usuario', `editado (${u.correo})`);
  editandoId = null;
  $('form-usuario-admin').hidden = true;
  renderEstado();
  $('ua-ok').hidden = false;
});

/* ---------- Estado general ---------- */
function renderEstado() {
  renderTalleresAdmin();
  renderSolicitudes();
  renderCitasAdmin();
  const users = leer(KEY_USERS, []);
  const cifrado = users.every(u => u.sal && u.hash && !u.clave);
  const https = location.protocol === 'https:';
  $('admin-estado').replaceChildren(
    fila('Cifrado de contraseñas', cifrado ? 'ok' : 'bad', cifrado ? 'Activo' : 'Revisar',
      `${users.length} de ${users.length} cuentas con hash PBKDF2-SHA256 y sal (RNF-02).`),
    fila('Conexión HTTPS', https ? 'ok' : 'warn', https ? 'Activa' : 'No activa en modo local',
      `Protocolo actual: ${location.protocol} En producción todos los datos deben viajar por HTTPS (RNF-03).`),
    fila('Disponibilidad del servicio', navigator.onLine ? 'ok' : 'warn', navigator.onLine ? 'Disponible' : 'Sin conexión',
      'Medir el 99 % mensual (RNF-04) y los 3 segundos con 500 usuarios (RNF-05) requiere un servidor con monitoreo.')
  );
  $('admin-conteos').replaceChildren(...COLECCIONES.map(([n, k]) => {
    const d = el('div', 'clicable');
    d.tabIndex = 0;
    d.setAttribute('role', 'button');
    d.title = 'Ver detalle';
    d.append(el('dt', '', n), el('dd', '', String(leer(k, []).length)));
    d.addEventListener('click', () => abrirDetalle(n, k));
    d.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrirDetalle(n, k); } });
    return d;
  }));
  refrescarDetalle();
  $('admin-log').replaceChildren(...leer('ac_log', []).slice(0, 10).map(l => {
    const a = el('article', 'servicio');
    a.append(el('h3', '', `${l.operacion}: ${l.resultado}`), el('p', 'detalle', new Date(l.fecha).toLocaleString('es-CO')));
    return a;
  }));
}

// CU-15: copia de respaldo (descarga un archivo JSON con todos los datos de AutoCheck)
$('btn-respaldo').addEventListener('click', () => {
  $('respaldo-ok').hidden = true; $('respaldo-error').hidden = true;
  try {
    const datos = {};
    Object.keys(localStorage).filter(k => k.startsWith('ac_') && k !== 'ac_session').forEach(k => { datos[k] = leer(k, null); });
    const blob = new Blob([JSON.stringify({ generado: new Date().toISOString(), datos }, null, 2)], { type: 'application/json' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `autocheck-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    registrar('Copia de respaldo', 'generada');
    $('respaldo-ok').textContent = 'Copia de respaldo generada y operación registrada.';
    $('respaldo-ok').hidden = false;
  } catch (err) {                                    // flujo alterno 4a
    registrar('Copia de respaldo', 'error');
    $('respaldo-error').textContent = 'No se pudo generar la copia de respaldo. El error quedó registrado.';
    $('respaldo-error').hidden = false;
  }
  renderEstado();
});

/* ---------- Acceso ---------- */
function mostrar() {
  const dentro = sessionStorage.getItem('ac_admin') === '1';
  $('admin-acceso').hidden = dentro;
  $('admin-panel').hidden = !dentro;
  $('btn-salir-admin').hidden = !dentro;
  $('btn-menu').hidden = !dentro;
  if (dentro) { renderEstado(); iniciarMenu(); }
}
$('form-admin').addEventListener('submit', e => {
  e.preventDefault();
  if ($('admin-pin').value !== CLAVE_ADMIN) {
    $('admin-error').textContent = 'La clave no es correcta.';
    $('admin-error').hidden = false;
    return;
  }
  sessionStorage.setItem('ac_admin', '1');
  e.target.reset(); $('admin-error').hidden = true;
  mostrar();
});
$('btn-salir-admin').addEventListener('click', () => {
  sessionStorage.removeItem('ac_admin');
  sessionStorage.removeItem('admin_seccion');
  detalleAbierto = null; editandoId = null;
  mostrar();
});
mostrar();