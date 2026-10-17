/* AutoCheck – Talleres aliados, fase futura (RF-16, CU-13, AD-06)
   El taller envía una solicitud; el administrador la acepta o la rechaza desde admin.html. */
const $ = id => document.getElementById(id);
const KEY_TALLERES = 'ac_talleres';
const KEY_SOL = 'ac_solicitudes_taller';
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

function errorCampo(id, msg) {
  document.querySelector(`[data-for="${id}"]`).textContent = msg || '';
  if (msg) $(id).setAttribute('aria-invalid', 'true'); else $(id).removeAttribute('aria-invalid');
}
function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

// Solo se listan los talleres ya aceptados por el administrador
function renderTalleres() {
  const lista = leer(KEY_TALLERES, []);
  $('lista-talleres-reg').replaceChildren(...(lista.length ? lista.map(t => {
    const a = el('article', 'servicio');
    const top = el('div', 'servicio-top');
    top.append(el('h3', '', t.nombre), el('span', 'fecha', t.ciudad));
    a.append(top, el('p', 'detalle', `${t.direccion} · Tel. ${t.telefono}`), el('p', 'proximo', `Servicios: ${t.servicios.join(', ')}`));
    return a;
  }) : [el('p', 'empty soon', 'Todavía no hay talleres aliados registrados.')]));
}

const clave = (n, c) => `${n}|${c}`.toLowerCase();

$('form-taller').addEventListener('submit', e => {
  e.preventDefault();
  $('taller-ok').hidden = true;
  const nombre = $('t-nombre').value.trim();
  const direccion = $('t-dir').value.trim();
  const ciudad = $('t-ciudad').value.trim();
  const telefono = $('t-tel').value.replace(/\s/g, '');
  const servicios = [...document.querySelectorAll('input[name="serv"]:checked')].map(c => c.value);

  // Evita duplicar una solicitud pendiente o un taller ya aliado
  const repetido = nombre && ciudad && (
    leer(KEY_SOL, []).some(s => s.estado === 'pendiente' && clave(s.nombre, s.ciudad) === clave(nombre, ciudad)) ||
    leer(KEY_TALLERES, []).some(t => clave(t.nombre, t.ciudad) === clave(nombre, ciudad)));

  const errores = {
    't-nombre': !nombre ? 'Escribe el nombre del taller.' : repetido ? 'Ya hay una solicitud pendiente o un taller aliado con ese nombre en esa ciudad.' : '',
    't-dir': direccion ? '' : 'Escribe la dirección.',
    't-ciudad': ciudad ? '' : 'Escribe la ciudad.',
    't-tel': !telefono ? 'Escribe el teléfono.' : !/^\d{7,10}$/.test(telefono) ? 'Usa solo números, entre 7 y 10 dígitos.' : '',
    't-servicios': servicios.length ? '' : 'Elige al menos un tipo de servicio.',
    't-acuerdo': $('t-acuerdo').checked ? '' : 'Necesitas un acuerdo de alianza vigente para registrarte.'
  };
  Object.entries(errores).forEach(([id, msg]) => errorCampo(id, msg));
  if (Object.values(errores).some(Boolean)) return;       // flujo alterno 4a

  const todas = leer(KEY_SOL, []);
  todas.push({
    id: String(Date.now()), nombre, direccion, ciudad, telefono, servicios,
    estado: 'pendiente', fecha: new Date().toISOString(), resueltaEn: null
  });
  localStorage.setItem(KEY_SOL, JSON.stringify(todas));
  e.target.reset();
  $('taller-ok').hidden = false;
  renderTalleres();
});
renderTalleres();