/* AutoCheck – Paso 2: cuenta de usuario (RF-01, RF-02, RNF-02)
   Los datos viven en localStorage del navegador (prototipo sin servidor). */

const $ = id => document.getElementById(id);
const KEY_USERS = 'ac_users';
const KEY_SESSION = 'ac_session';

/* ---------- Almacenamiento ---------- */
function leer(key, porDefecto) {
  try { return JSON.parse(localStorage.getItem(key)) ?? porDefecto; }
  catch { return porDefecto; }
}
const guardar = (key, valor) => localStorage.setItem(key, JSON.stringify(valor));

/* ---------- Cifrado de contraseña: PBKDF2-SHA256 con sal aleatoria ---------- */
const aHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const deHex = hex => new Uint8Array(hex.match(/../g).map(h => parseInt(h, 16)));

async function cifrar(clave, salHex) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: deHex(salHex), iterations: 100000, hash: 'SHA-256' }, material, 256);
  return aHex(bits);
}
const nuevaSal = () => aHex(crypto.getRandomValues(new Uint8Array(16)));

/* ---------- Mensajes de error ---------- */
function errorCampo(id, mensaje) {
  const input = $(id);
  const aviso = document.querySelector(`[data-for="${id}"]`);
  aviso.textContent = mensaje || '';
  input.toggleAttribute('aria-invalid', !!mensaje);
  if (mensaje) input.setAttribute('aria-invalid', 'true');
}
function errorForm(id, mensaje) {
  const caja = $(id);
  caja.textContent = mensaje || '';
  caja.hidden = !mensaje;
}

/* ---------- CU-01 Registrarse ---------- */
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_DOC = /^[A-Za-z0-9]{5,15}$/;
const REGEX_TEL = /^\d{7,10}$/;

// Validación compartida entre registro y perfil. idPropio excluye al propio usuario de los duplicados.
function validarDatos(d, usuarios, idPropio) {
  const otros = usuarios.filter(u => u.id !== idPropio);
  return {
    nombre: !d.nombre ? 'Escribe tu nombre.' : d.nombre.length > 50 ? 'Máximo 50 caracteres.' : '',
    apellido: !d.apellido ? 'Escribe tu apellido.' : d.apellido.length > 50 ? 'Máximo 50 caracteres.' : '',
    documento: !d.documento ? 'Escribe tu número de documento.'
      : !REGEX_DOC.test(d.documento) ? 'Usa de 5 a 15 letras o números, sin espacios ni puntos.'
      : otros.some(u => u.tipoDoc === d.tipoDoc && u.documento === d.documento) ? 'Este documento ya está registrado.' : '',
    correo: !d.correo ? 'Escribe tu correo electrónico.'
      : !REGEX_CORREO.test(d.correo) ? 'El correo no tiene un formato válido. Ejemplo: nombre@correo.com'
      : otros.some(u => u.correo === d.correo) ? 'Este correo ya tiene una cuenta. Inicia sesión o usa otro correo.' : '',
    telefono: d.telefono && !REGEX_TEL.test(d.telefono) ? 'Usa solo números, entre 7 y 10 dígitos.' : ''
  };
}

$('form-registro').addEventListener('submit', async e => {
  e.preventDefault();
  errorForm('registro-error', '');
  const usuarios = leer(KEY_USERS, []);
  const datos = {
    nombre: $('reg-nombre').value.trim(),
    apellido: $('reg-apellido').value.trim(),
    tipoDoc: $('reg-tipodoc').value,
    documento: $('reg-documento').value.replace(/\s/g, '').toUpperCase(),
    correo: $('reg-correo').value.trim().toLowerCase(),
    telefono: $('reg-telefono').value.replace(/\s/g, '')
  };
  const clave = $('reg-clave').value;

  const err = validarDatos(datos, usuarios, null);
  const eClave = !clave ? 'Escribe una contraseña.' : clave.length < 8 ? 'La contraseña debe tener al menos 8 caracteres.' : '';
  errorCampo('reg-nombre', err.nombre);
  errorCampo('reg-apellido', err.apellido);
  errorCampo('reg-documento', err.documento);
  errorCampo('reg-correo', err.correo);
  errorCampo('reg-telefono', err.telefono);
  errorCampo('reg-clave', eClave);
  if (Object.values(err).some(Boolean) || eClave) return;

  if (!window.crypto?.subtle) {
    return errorForm('registro-error', 'Tu navegador no permite cifrar la contraseña. Abre la página con Live Server o desde un navegador actualizado.');
  }

  const sal = nuevaSal();
  const usuario = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    ...datos, sal,
    hash: await cifrar(clave, sal),
    plan: 'gratis',
    creado: new Date().toISOString()
  };
  usuarios.push(usuario);
  guardar(KEY_USERS, usuarios);
  guardar(KEY_SESSION, usuario.id); // entra directo tras crear la cuenta
  e.target.reset();
  location.hash = '';
  mostrar();
});

/* ---------- CU-02 Iniciar sesión ---------- */
$('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  errorForm('login-error', '');
  const correo = $('login-correo').value.trim().toLowerCase();
  const clave = $('login-clave').value;
  if (!correo || !clave) return errorForm('login-error', 'Escribe tu correo y tu contraseña.');
  if (!window.crypto?.subtle) return errorForm('login-error', 'Tu navegador no permite verificar la contraseña. Abre la página con Live Server o desde un navegador actualizado.');

  const usuario = leer(KEY_USERS, []).find(u => u.correo === correo);
  const ok = usuario && (await cifrar(clave, usuario.sal)) === usuario.hash;
  // Flujo alterno 2a: credenciales incorrectas (mismo mensaje para no revelar cuál falló)
  if (!ok) return errorForm('login-error', 'El correo o la contraseña no coinciden. Revisa los datos e inténtalo de nuevo.');

  guardar(KEY_SESSION, usuario.id);
  e.target.reset();
  location.hash = '';
  mostrar();
});

/* ---------- Sesión ---------- */
const usuarioActual = () => leer(KEY_USERS, []).find(u => u.id === leer(KEY_SESSION, null));

$('btn-salir').addEventListener('click', () => {
  localStorage.removeItem(KEY_SESSION);
  location.hash = '';
  mostrar();
});

/* ---------- Pestañas y vistas ---------- */
function pestana(nombre) {
  const registro = nombre === 'registro';
  $('form-registro').hidden = !registro;
  $('form-login').hidden = registro;
  $('tab-registro').setAttribute('aria-selected', registro);
  $('tab-login').setAttribute('aria-selected', !registro);
}
$('tab-login').addEventListener('click', () => { location.hash = 'login'; });
$('tab-registro').addEventListener('click', () => { location.hash = 'registro'; });

function mostrar() {
  const usuario = usuarioActual();
  $('vista-auth').hidden = !!usuario;
  $('vista-panel').hidden = !usuario;
  if (usuario) {
    $('panel-saludo').textContent = `Hola, ${usuario.nombre.split(' ')[0]}`;
    $('panel-plan').textContent = usuario.plan === 'premium' ? 'Plan Premium' : 'Plan Gratis';
    $('limite-aviso').hidden = true;
    procesarRecordatorios();
    renderLista();
    vista('lista');
    document.title = 'AutoCheck – Mi panel';
  } else {
    pestana(location.hash === '#registro' ? 'registro' : 'login');
    document.title = 'AutoCheck – Mi cuenta';
  }
}
/* ---------- Vehículos (RF-03, RF-04) ---------- */
const KEY_VEH = 'ac_vehiculos';
const PLACA = { carro: /^[A-Z]{3}\d{3}$/, moto: /^[A-Z]{3}\d{2}[A-Z]$/ };
const HINT_PLACA = { carro: 'Carro: 3 letras y 3 números (AAA123).', moto: 'Moto: 3 letras, 2 números y 1 letra (AAA12A).' };
const verPlaca = p => `${p.slice(0, 3)} ${p.slice(3)}`;
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}
let vehiculoActual = null;
const vehiculosDe = u => leer(KEY_VEH, []).filter(v => v.userId === u.id);

function vista(nombre) {
  ['lista', 'form', 'ficha', 'perfil'].forEach(n => { $('sec-' + n).hidden = n !== nombre; });
}

// CU-04: lista de vehículos del propietario
function renderLista() {
  const lista = vehiculosDe(usuarioActual());
  const cont = $('lista-vehiculos');
  cont.replaceChildren();
  renderAlerta(lista);
  renderBandeja();
  $('vacio').hidden = lista.length > 0;       // flujo alterno 2a: sin vehículos, ofrece CU-03
  document.querySelector('#sec-lista .sub').hidden = lista.length === 0;
  lista.forEach(v => {
    const tarjeta = el('article', 'v-card');
    tarjeta.append(
      el('span', 'plate', verPlaca(v.placa)),
      el('h3', '', `${v.marca} ${v.modelo}`),
      el('p', '', `${cap(v.tipo)} · ${v.anio} · ${v.km.toLocaleString('es-CO')} km`)
    );
    tarjeta.append(...resumenVehiculo(v));
    const ver = el('button', 'btn btn-ghost', 'Ver ficha');
    ver.type = 'button';
    ver.addEventListener('click', () => verFicha(v));
    tarjeta.append(ver);
    cont.append(tarjeta);
  });
}

function verFicha(v) {
  $('ficha-placa').textContent = verPlaca(v.placa);
  $('ficha-titulo').textContent = `${v.marca} ${v.modelo}`;
  const datos = [['Tipo de vehículo', cap(v.tipo)], ['Marca', v.marca], ['Modelo', v.modelo],
    ['Año de fabricación', v.anio], ['Placa', verPlaca(v.placa)], ['Kilometraje actual', `${v.km.toLocaleString('es-CO')} km`]];
  $('ficha-datos').replaceChildren(...datos.map(([k, val]) => {
    const d = el('div');
    d.append(el('dt', '', k), el('dd', '', String(val)));
    return d;
  }));
  vehiculoActual = v;
  $('form-servicio').hidden = true;
  $('servicio-ok').hidden = true;
  renderHistorial();
  $('form-documento').hidden = true;
  $('doc-ok').hidden = true;
  renderDocumentos();
  renderTalleres();
  vista('ficha');
}

// CU-03: abrir formulario (flujo alterno 4c: límite del plan gratuito)
function abrirFormulario() {
  const u = usuarioActual();
  if (u.plan === 'gratis' && vehiculosDe(u).length >= 1) {
    $('limite-aviso').hidden = false;
    return;
  }
  $('form-vehiculo').reset();
  ['v-marca', 'v-modelo', 'v-anio', 'v-placa', 'v-km'].forEach(id => errorCampo(id, ''));
  errorForm('vehiculo-error', '');
  $('placa-hint').textContent = HINT_PLACA.carro;
  vista('form');
}
$('btn-agregar').addEventListener('click', abrirFormulario);
$('btn-agregar-vacio').addEventListener('click', abrirFormulario);
$('btn-cancelar').addEventListener('click', () => vista('lista'));   // flujo alterno 3a: no guarda nada
$('btn-volver').addEventListener('click', () => { renderLista(); vista('lista'); });
$('v-tipo').addEventListener('change', e => { $('placa-hint').textContent = HINT_PLACA[e.target.value]; });

$('btn-premium').addEventListener('click', () => {
  const usuarios = leer(KEY_USERS, []);
  usuarios.find(u => u.id === usuarioActual().id).plan = 'premium';
  guardar(KEY_USERS, usuarios);
  mostrar();
});

$('form-vehiculo').addEventListener('submit', e => {
  e.preventDefault();
  const u = usuarioActual();
  const tipo = $('v-tipo').value;
  const marca = $('v-marca').value.trim();
  const modelo = $('v-modelo').value.trim();
  const anioTxt = $('v-anio').value.trim();
  const placa = $('v-placa').value.replace(/\s/g, '').toUpperCase();
  const kmTxt = $('v-km').value.trim();
  const anio = Number(anioTxt), km = Number(kmTxt);
  const anioMax = new Date().getFullYear();

  const eMarca = marca ? '' : 'Escribe la marca. Ejemplo: Chevrolet.';
  const eModelo = modelo ? '' : 'Escribe el modelo. Ejemplo: Spark GT.';
  const eAnio = !anioTxt ? 'Escribe el año de fabricación.'
    : (!Number.isInteger(anio) || anio < 1980 || anio > anioMax) ? `El año debe estar entre 1980 y ${anioMax}.` : '';
  let ePlaca = !placa ? 'Escribe la placa.' : !PLACA[tipo].test(placa) ? `Formato inválido. ${HINT_PLACA[tipo]}` : '';
  if (!ePlaca && leer(KEY_VEH, []).some(v => v.placa === placa)) ePlaca = 'Esta placa ya está registrada.';
  const eKm = !kmTxt ? 'Escribe el kilometraje actual.'
    : (!Number.isInteger(km) || km < 0) ? 'El kilometraje debe ser un número entero mayor o igual a 0.' : '';

  errorCampo('v-marca', eMarca); errorCampo('v-modelo', eModelo); errorCampo('v-anio', eAnio);
  errorCampo('v-placa', ePlaca); errorCampo('v-km', eKm);
  if (eMarca || eModelo || eAnio || ePlaca || eKm) return;

  const todos = leer(KEY_VEH, []);
  todos.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), userId: u.id, tipo, marca, modelo, anio, placa, km, creado: new Date().toISOString() });
  guardar(KEY_VEH, todos);
  renderLista();
  vista('lista');
});

/* ---------- Mantenimiento (RF-05, RF-06) ---------- */
const KEY_SERV = 'ac_servicios';
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fechaLarga = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }); };
const pesos = n => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// CU-06: historial ordenado de la fecha más reciente a la más antigua (RF-06)
function renderHistorial() {
  const servicios = leer(KEY_SERV, [])
    .filter(s => s.vehiculoId === vehiculoActual.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.km - a.km);   // misma fecha: primero el de más kilómetros
  $('sin-servicios').hidden = servicios.length > 0;   // flujo alterno 2a
  const prom = $('prom-km');
  prom.hidden = servicios.length < 2;
  if (servicios.length >= 2) {
    const asc = [...servicios].reverse();
    const x = Math.max(0, (asc[asc.length - 1].km - asc[0].km) / (asc.length - 1));
    prom.textContent = `Kilometraje promedio entre servicios: ${Math.round(x).toLocaleString('es-CO')} km`;
  }
  $('lista-servicios').replaceChildren(...servicios.map(s => {
    const item = el('article', 'servicio');
    const top = el('div', 'servicio-top');
    top.append(el('h3', '', s.tipo), el('span', 'fecha', fechaLarga(s.fecha)));
    const partes = [`${s.km.toLocaleString('es-CO')} km`];
    if (s.costo !== null) partes.push(pesos(s.costo));
    item.append(top, el('p', 'detalle', partes.join(' · ')));
    if (s.obs) item.append(el('p', 'detalle', s.obs));
    item.append(el('p', 'proximo', `Próximo servicio: ${fechaLarga(s.proximo)}`));
    return item;
  }));
}

$('btn-nuevo-servicio').addEventListener('click', () => {
  $('form-servicio').reset();
  ['m-fecha', 'm-km', 'm-costo', 'm-proximo'].forEach(id => errorCampo(id, ''));
  errorForm('servicio-error', '');
  $('m-fecha').max = hoyISO();                       // no se permiten fechas futuras
  $('m-fecha').value = hoyISO();
  $('servicio-ok').hidden = true;
  $('form-servicio').hidden = false;
  $('m-tipo').focus();
});
$('btn-cancelar-servicio').addEventListener('click', () => { $('form-servicio').hidden = true; });

// CU-05: registrar servicio
$('form-servicio').addEventListener('submit', e => {
  e.preventDefault();
  const tipo = $('m-tipo').value;
  const fecha = $('m-fecha').value;
  const kmTxt = $('m-km').value.trim();
  const costoTxt = $('m-costo').value.trim();
  const proximo = $('m-proximo').value;
  const obs = $('m-obs').value.trim();
  const km = Number(kmTxt), costo = Number(costoTxt);

  const eFecha = !fecha ? 'Elige la fecha en que se hizo el servicio.' : fecha > hoyISO() ? 'La fecha de realización no puede ser posterior a hoy.' : '';
  const eKm = !kmTxt ? 'Escribe el kilometraje del servicio.' : (!Number.isInteger(km) || km < 0) ? 'El kilometraje debe ser un entero mayor o igual a 0.' : '';
  const eCosto = costoTxt && (isNaN(costo) || costo < 0) ? 'El costo debe ser un número mayor o igual a 0.' : '';
  const eProx = !proximo ? 'Elige la fecha del próximo servicio.' : (fecha && proximo <= fecha) ? 'La fecha del próximo servicio debe ser posterior a la de realización.' : '';

  errorCampo('m-fecha', eFecha); errorCampo('m-km', eKm); errorCampo('m-costo', eCosto); errorCampo('m-proximo', eProx);
  if (eFecha || eKm || eCosto || eProx) return;     // flujo alterno 4a: vuelve al formulario

  const todos = leer(KEY_SERV, []);
  todos.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    vehiculoId: vehiculoActual.id, tipo, fecha, km,
    costo: costoTxt ? costo : null, obs, proximo, creado: new Date().toISOString()
  });
  guardar(KEY_SERV, todos);
  crearRecordatorio(vehiculoActual, 'servicio', todos[todos.length - 1]);
  procesarRecordatorios();
  if (km > vehiculoActual.km) {                      // CP-RF02-01: el vehículo queda con el kilometraje del servicio
    const vs = leer(KEY_VEH, []);
    const vv = vs.find(x => x.id === vehiculoActual.id);
    vv.km = km;
    guardar(KEY_VEH, vs);
    vehiculoActual = vv;
  }
  verFicha(vehiculoActual);
  $('servicio-ok').hidden = false;
});

/* ---------- Documentos (RF-07, RF-08) ---------- */
const KEY_DOCS = 'ac_documentos';

// Días que faltan para una fecha (negativo si ya pasó)
function diasPara(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const [hy, hm, hd] = hoyISO().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86400000);
}
// Estado según RF-05 (cuarto entregable): al día, próximo a vencer (menos de 15 días) o vencido
const DIAS_PROXIMO = 15;
function estadoDoc(venc) {
  const n = diasPara(venc);
  if (n < 0) return { clave: 'bad', texto: 'Vencido', detalle: `Venció hace ${-n} ${-n === 1 ? 'día' : 'días'}` };
  if (n === 0) return { clave: 'warn', texto: 'Próximo a vencer', detalle: 'Vence hoy' };
  if (n < DIAS_PROXIMO) return { clave: 'warn', texto: 'Próximo a vencer', detalle: `Vence en ${n} ${n === 1 ? 'día' : 'días'}` };
  return { clave: 'ok', texto: 'Al día', detalle: `Vence en ${n} días` };
}

// CU-08: documentos del vehículo con su fecha de vencimiento
function renderDocumentos() {
  const docs = leer(KEY_DOCS, [])
    .filter(d => d.vehiculoId === vehiculoActual.id)
    .sort((a, b) => b.vencimiento.localeCompare(a.vencimiento));
  $('sin-docs').hidden = docs.length > 0;            // flujo alterno 2a
  $('lista-docs').replaceChildren(...docs.map(d => {
    // Si hay una renovación posterior del mismo tipo, este queda como "Anterior"
    const reemplazado = docs.some(o => o.tipo === d.tipo && o.vencimiento > d.vencimiento);
    const est = reemplazado ? { clave: 'old', texto: 'Anterior', detalle: `Venció el ${fechaLarga(d.vencimiento)}` } : estadoDoc(d.vencimiento);
    const item = el('article', `servicio doc estado-${est.clave === 'ok' ? 'ok' : est.clave}`);
    const top = el('div', 'servicio-top');
    top.append(el('h3', '', d.tipo), el('span', `badge ${est.clave}`, est.texto));
    item.append(top,
      el('p', 'detalle', `N.º ${d.numero}${d.entidad ? ' · ' + d.entidad : ''} · Expedido el ${fechaLarga(d.expedicion)}`),
      el('p', 'proximo', `Vence el ${fechaLarga(d.vencimiento)} · ${est.detalle}`));
    return item;
  }));
}

$('btn-nuevo-doc').addEventListener('click', () => {
  $('form-documento').reset();
  ['d-numero', 'd-entidad', 'd-expedicion', 'd-vencimiento'].forEach(id => errorCampo(id, ''));
  errorForm('documento-error', '');
  $('doc-ok').hidden = true;
  $('form-documento').hidden = false;
  $('d-tipo').focus();
});
$('btn-cancelar-doc').addEventListener('click', () => { $('form-documento').hidden = true; });

// CU-07: registrar documento
$('form-documento').addEventListener('submit', e => {
  e.preventDefault();
  const tipo = $('d-tipo').value;
  const numero = $('d-numero').value.trim();
  const entidad = $('d-entidad').value.trim();
  const expedicion = $('d-expedicion').value;
  const vencimiento = $('d-vencimiento').value;

  const eNum = numero ? '' : 'Escribe el número del documento.';
  const eEnt = entidad ? '' : 'Escribe la entidad que expidió el documento.';
  const eExp = expedicion ? '' : 'Elige la fecha de expedición.';
  const eVen = !vencimiento ? 'Elige la fecha de vencimiento.'
    : (expedicion && vencimiento <= expedicion) ? 'La fecha de vencimiento debe ser posterior a la de expedición.' : '';

  errorCampo('d-numero', eNum); errorCampo('d-entidad', eEnt); errorCampo('d-expedicion', eExp); errorCampo('d-vencimiento', eVen);
  if (eNum || eEnt || eExp || eVen) return;                  // flujo alterno 4a

  const todos = leer(KEY_DOCS, []);
  todos.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    vehiculoId: vehiculoActual.id, tipo, numero, entidad, expedicion, vencimiento, creado: new Date().toISOString()
  });
  guardar(KEY_DOCS, todos);
  crearRecordatorio(vehiculoActual, 'documento', todos[todos.length - 1]);
  procesarRecordatorios();
  $('form-documento').hidden = true;
  $('doc-ok').hidden = false;
  renderDocumentos();
});

/* ---------- Estado del vehículo en el panel (RF-13, RF-14) ---------- */
const ultimoDoc = (vehId, tipo) => leer(KEY_DOCS, [])
  .filter(d => d.vehiculoId === vehId && d.tipo === tipo)
  .sort((a, b) => b.vencimiento.localeCompare(a.vencimiento))[0];

function resumenVehiculo(v) {
  const filas = ['SOAT', 'Tecnomecánica'].map(tipo => {
    const d = ultimoDoc(v.id, tipo);
    const fila = el('p', 'estado-linea');
    if (!d) fila.append(el('span', '', tipo), el('span', 'badge old', 'Sin registrar'));
    else { const est = estadoDoc(d.vencimiento); fila.append(el('span', '', tipo), el('span', `badge ${est.clave}`, est.texto)); }
    return fila;
  });
  const ult = leer(KEY_SERV, []).filter(s => s.vehiculoId === v.id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const prox = el('p', 'estado-linea');
  prox.append(el('span', '', 'Próximo servicio'), el('span', '', ult ? `${ult.tipo} · ${fechaLarga(ult.proximo)}` : 'Sin servicios'));
  const recientes = leer(KEY_SERV, []).filter(s => s.vehiculoId === v.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3);
  const ultimos = recientes.length ? [el('p', 'mini-titulo', 'Últimos mantenimientos'), ...recientes.map(s => {
    const f = el('p', 'estado-linea');
    f.append(el('span', '', s.tipo), el('span', '', fechaLarga(s.fecha)));
    return f;
  })] : [];
  return [...filas, prox, ...ultimos];
}

// CU-12: alerta de vencimiento (RF-13)
function renderAlerta(lista) {
  let vencidos = 0, proximos = 0;
  lista.forEach(v => ['SOAT', 'Tecnomecánica'].forEach(t => {
    const d = ultimoDoc(v.id, t);
    if (!d) return;
    const c = estadoDoc(d.vencimiento).clave;
    if (c === 'bad') vencidos++; else if (c === 'warn') proximos++;
  }));
  const caja = $('alerta-doc');
  const partes = [];
  if (vencidos) partes.push(`${vencidos} ${vencidos === 1 ? 'documento vencido' : 'documentos vencidos'}`);
  if (proximos) partes.push(`${proximos} ${proximos === 1 ? 'documento próximo a vencer' : 'documentos próximos a vencer'}`);
  caja.hidden = partes.length === 0;
  caja.classList.toggle('grave', vencidos > 0);
  caja.textContent = partes.length ? `Atención: tienes ${partes.join(' y ')}. Abre la ficha del vehículo para ver el detalle.` : '';
}

/* ---------- Recordatorios (RF-09 a RF-12; RF-04 del cuarto entregable) ---------- */
const KEY_REC = 'ac_recordatorios';
const AVISOS = { documento: [30, 15, 5], servicio: [15, 5] };   // días antes del evento
const sumarDias = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// CU-09: generar recordatorios. Los avisos que aún no llegan quedan programados; si ya pasaron
// fechas de aviso, se envía solo el más cercano al evento para no repetir mensajes.
function crearRecordatorio(veh, tipoElemento, elem) {
  const esDoc = tipoElemento === 'documento';
  const fechaEvento = esDoc ? elem.vencimiento : elem.proximo;
  const dias = diasPara(fechaEvento);
  const offsets = AVISOS[tipoElemento];
  const aCrear = offsets.filter(o => o < dias);
  const pasados = offsets.filter(o => o >= dias);
  if (pasados.length) aCrear.push(Math.min(...pasados));
  const todos = leer(KEY_REC, []);
  // Un registro más nuevo del mismo tipo reemplaza los recordatorios pendientes anteriores
  todos.forEach(r => {
    if (r.vehiculoId === veh.id && r.tipoElemento === tipoElemento && r.etiqueta === elem.tipo && r.estado === 'pendiente' && r.fechaEvento < fechaEvento) r.estado = 'omitido';
  });
  aCrear.forEach(o => todos.push({
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '-' + o,
    userId: veh.userId, vehiculoId: veh.id, placa: veh.placa, tipoElemento,
    etiqueta: elem.tipo, fechaEvento, diasAntes: o, fechaAviso: sumarDias(fechaEvento, -o),
    asunto: esDoc ? `Recordatorio de vencimiento de ${elem.tipo}` : `Recordatorio de próximo servicio: ${elem.tipo}`,
    estado: 'pendiente', mensaje: '', enviadoEn: null
  }));
  guardar(KEY_REC, todos);
}

// CU-10: enviar los recordatorios cuya fecha de aviso llegó (push del navegador + correo simulado con traza)
function procesarRecordatorios() {
  const u = usuarioActual();
  if (!u) return;
  const todos = leer(KEY_REC, []);
  let cambio = false;
  todos.forEach(r => {
    if (r.userId !== u.id || r.estado !== 'pendiente' || r.fechaAviso > hoyISO()) return;
    const n = diasPara(r.fechaEvento);
    const cuando = n < 0 ? `venció hace ${-n} ${-n === 1 ? 'día' : 'días'}` : n === 0 ? 'vence hoy' : `vence en ${n} ${n === 1 ? 'día' : 'días'}`;
    r.mensaje = r.tipoElemento === 'documento'
      ? `Tu ${r.etiqueta} (${verPlaca(r.placa)}) ${cuando}.`
      : `El próximo servicio "${r.etiqueta}" de ${verPlaca(r.placa)} ${n < 0 ? 'estaba programado hace ' + (-n) + ' días' : n === 0 ? 'es hoy' : 'es en ' + n + ' días'}.`;
    r.estado = 'enviado';
    r.enviadoEn = new Date().toISOString();
    cambio = true;
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(r.asunto || 'AutoCheck', { body: r.mensaje }); } catch { /* el navegador no permite la notificación */ }
    }
  });
  if (cambio) guardar(KEY_REC, todos);
}

function renderBandeja() {
  const u = usuarioActual();
  if (!u) return;
  const mios = leer(KEY_REC, []).filter(r => r.userId === u.id);
  const pendientes = mios.filter(r => r.estado === 'pendiente').sort((a, b) => a.fechaAviso.localeCompare(b.fechaAviso));
  const enviados = mios.filter(r => r.estado === 'enviado').sort((a, b) => b.enviadoEn.localeCompare(a.enviadoEn)).slice(0, 10);
  const items = [...enviados.map(r => {
    const a = el('article', 'servicio');
    const top = el('div', 'rec-top');
    top.append(el('h3', '', r.mensaje), el('span', 'badge ok', 'Enviado'));
    a.append(top, el('p', 'detalle', `Correo simulado · Asunto: «${r.asunto || 'Recordatorio'}» · Traza de envío: ${new Date(r.enviadoEn).toLocaleString('es-CO')}`));
    return a;
  }), ...pendientes.slice(0, 6).map(r => {
    const a = el('article', 'servicio doc estado-old');
    const top = el('div', 'rec-top');
    top.append(el('h3', '', `${r.etiqueta} · ${verPlaca(r.placa)}`), el('span', 'badge prog', 'Programado'));
    a.append(top, el('p', 'detalle', `Aviso el ${fechaLarga(r.fechaAviso)}${r.diasAntes ? ` (${r.diasAntes} días antes)` : ''}. Fecha del evento: ${fechaLarga(r.fechaEvento)}.`));
    return a;
  })];
  if (pendientes.length > 6) items.push(el('p', 'detalle-txt', `y ${pendientes.length - 6} recordatorios programados más.`));
  if (!enviados.length && !pendientes.length) items.push(el('p', 'empty soon', 'Aún no tienes recordatorios. Se crean al registrar un mantenimiento o un documento.'));
  $('lista-rec').replaceChildren(...items);
  $('btn-avisos').hidden = !('Notification' in window) || Notification.permission !== 'default';
}
$('btn-avisos').addEventListener('click', () => Notification.requestPermission().then(renderBandeja));

// Revisa cada minuto si llegó la fecha de aviso de algún recordatorio
setInterval(() => {
  if (!usuarioActual()) return;
  procesarRecordatorios();
  if (!$('sec-lista').hidden) renderBandeja();
}, 60000);

/* ---------- Talleres recomendados (RF-17, CU-14, fase futura) ---------- */
function renderTalleres() {
  const ult = leer(KEY_SERV, []).filter(s => s.vehiculoId === vehiculoActual.id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  $('bloque-talleres').hidden = !ult;                 // precondición: hay un próximo servicio
  if (!ult) return;
  const talleres = leer('ac_talleres', []).filter(t => t.servicios.includes(ult.tipo));
  $('talleres-intro').textContent = `Para tu próximo servicio: ${ult.tipo.toLowerCase()} (${fechaLarga(ult.proximo)}).`;
  $('lista-talleres').replaceChildren(...(talleres.length ? talleres.map(t => {
    const a = el('article', 'servicio');
    const top = el('div', 'servicio-top');
    top.append(el('h3', '', t.nombre), el('span', 'fecha', t.ciudad));
    a.append(top, el('p', 'detalle', `${t.direccion} · Tel. ${t.telefono}`));
    return a;
  }) : [el('p', 'empty soon', 'Aún no hay talleres aliados que ofrezcan este servicio.')]));   // flujo alterno 3a
}

/* ---------- Perfil: el usuario consulta y edita sus datos ---------- */
const CAMPOS_PERFIL = { nombre: 'p-nombre', apellido: 'p-apellido', documento: 'p-documento', correo: 'p-correo', telefono: 'p-tel' };

function abrirPerfil() {
  const u = usuarioActual();
  $('p-nombre').value = u.nombre || '';
  $('p-apellido').value = u.apellido || '';
  $('p-tipodoc').value = u.tipoDoc || 'CC';
  $('p-documento').value = u.documento || '';
  $('p-correo').value = u.correo || '';
  $('p-tel').value = u.telefono || '';
  Object.values(CAMPOS_PERFIL).forEach(id => errorCampo(id, ''));
  $('perfil-ok').hidden = true;
  vista('perfil');
}
$('btn-perfil').addEventListener('click', abrirPerfil);
$('btn-volver-perfil').addEventListener('click', () => { renderLista(); vista('lista'); });

$('form-perfil').addEventListener('submit', e => {
  e.preventDefault();
  $('perfil-ok').hidden = true;
  const usuarios = leer(KEY_USERS, []);
  const u = usuarios.find(x => x.id === usuarioActual().id);
  const datos = {
    nombre: $('p-nombre').value.trim(),
    apellido: $('p-apellido').value.trim(),
    tipoDoc: $('p-tipodoc').value,
    documento: $('p-documento').value.replace(/\s/g, '').toUpperCase(),
    correo: $('p-correo').value.trim().toLowerCase(),
    telefono: $('p-tel').value.replace(/\s/g, '')
  };
  const err = validarDatos(datos, usuarios, u.id);
  Object.entries(CAMPOS_PERFIL).forEach(([k, id]) => errorCampo(id, err[k]));
  if (Object.values(err).some(Boolean)) return;

  Object.assign(u, datos);                 // la sal, el hash y el plan no se modifican
  guardar(KEY_USERS, usuarios);
  $('panel-saludo').textContent = `Hola, ${u.nombre.split(' ')[0]}`;
  $('perfil-ok').hidden = false;
});

window.addEventListener('hashchange', mostrar);
mostrar();