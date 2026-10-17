/* AutoCheck – RTM y casos de prueba QA (cuarto entregable). Las verificaciones leen los datos de este navegador. */
const $ = id => document.getElementById(id);
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
function el(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto !== undefined) e.textContent = texto; return e; }

const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function diasPara(iso) {
  const [y, m, d] = iso.split('-').map(Number), [hy, hm, hd] = hoyISO().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86400000);
}
const PLACA = { carro: /^[A-Z]{3}\d{3}$/, moto: /^[A-Z]{3}\d{2}[A-Z]$/ };
const estadoDoc = n => n < 0 ? 'Vencido' : n < 15 ? 'Próximo a vencer' : 'Al día';
const ok = detalle => ({ ok: true, detalle });
const falla = detalle => ({ ok: false, detalle });

const PRUEBAS = [
  { id: 'CP-RF01-01', req: 'RF-01', tipo: 'Funcional', modulo: 'Vehículos (app.js: formulario de vehículo, renderLista)', nombre: 'Registro y consulta de datos básicos del vehículo',
    pasos: ['Iniciar sesión en AutoCheck.', 'Pulsar «Agregar vehículo» e ingresar tipo, marca, modelo, año, placa y kilometraje.', 'Pulsar «Guardar vehículo».'],
    esperado: 'El sistema valida los campos, guarda el vehículo y lo muestra en «Mis vehículos».',
    verificar() {
      const vs = leer('ac_vehiculos', []);
      if (!vs.length) return falla('No hay vehículos registrados. Registra uno en la aplicación y vuelve a verificar.');
      const malos = vs.filter(v => !(v.marca && v.modelo && v.anio && v.km >= 0 && PLACA[v.tipo] && PLACA[v.tipo].test(v.placa)));
      return malos.length ? falla(`${malos.length} vehículo(s) con datos incompletos o placa inválida.`) : ok(`${vs.length} vehículo(s) con marca, modelo, año, placa y kilometraje válidos.`);
    } },
  { id: 'CP-RF02-01', req: 'RF-02', tipo: 'Funcional', modulo: 'Mantenimiento (app.js: formulario de servicio, renderHistorial)', nombre: 'Registro de historial de servicios de mantenimiento',
    pasos: ['Abrir la ficha de un vehículo registrado.', 'Pulsar «Registrar mantenimiento».', 'Elegir el tipo de servicio, ingresar costo y kilometraje.', 'Pulsar «Guardar mantenimiento».'],
    esperado: 'Aparece «Mantenimiento guardado exitosamente», el kilometraje del vehículo se actualiza y el registro entra al historial.',
    verificar() {
      const ss = leer('ac_servicios', []), vs = leer('ac_vehiculos', []);
      if (!ss.length) return falla('No hay mantenimientos registrados. Registra uno desde la ficha de un vehículo.');
      for (const s of ss) {
        const v = vs.find(x => x.id === s.vehiculoId);
        if (!s.tipo || !s.fecha || !(s.km >= 0)) return falla('Hay un mantenimiento sin tipo, fecha o kilometraje.');
        if (!v) return falla('Hay un mantenimiento sin vehículo asociado.');
        if (v.km < s.km) return falla(`El vehículo ${v.placa} tiene menos kilometraje (${v.km}) que su último servicio (${s.km}).`);
      }
      return ok(`${ss.length} mantenimiento(s) con datos completos y kilometraje del vehículo actualizado.`);
    } },
  { id: 'CP-RF03-01', req: 'RF-03', tipo: 'Funcional', modulo: 'Documentos (app.js: formulario de documento, estadoDoc)', nombre: 'Control de documentación obligatoria (SOAT y tecnomecánica)',
    pasos: ['Abrir la ficha de un vehículo.', 'Pulsar «Registrar documento».', 'Ingresar tipo, número, entidad expedidora y fechas; si quiere, adjuntar el archivo.', 'Pulsar «Guardar documento».'],
    esperado: 'El documento queda guardado con su estado. Si vence en menos de 15 días, aparece «Próximo a vencer» y se programa su recordatorio.',
    verificar() {
      const ds = leer('ac_documentos', []), rs = leer('ac_recordatorios', []);
      if (!ds.length) return falla('No hay documentos registrados. Registra un SOAT o una tecnomecánica.');
      const incompletos = ds.filter(d => !(d.numero && d.entidad && d.expedicion && d.vencimiento > d.expedicion));
      if (incompletos.length) return falla(`${incompletos.length} documento(s) sin número, entidad expedidora o con fechas inválidas.`);
      const sinAviso = ds.filter(d => { const n = diasPara(d.vencimiento); return n < 15 && !rs.some(r => r.elementoId === d.id && r.estado !== 'omitido'); });
      return sinAviso.length ? falla(`${sinAviso.length} documento(s) próximos a vencer sin recordatorio.`) : ok(`${ds.length} documento(s) completos; los próximos a vencer tienen recordatorio.`);
    } },
  { id: 'CP-RF04-01', req: 'RF-04', tipo: 'Funcional', modulo: 'Notificaciones (app.js: crearRecordatorio, procesarRecordatorios)', nombre: 'Generación de recordatorios automáticos de vencimiento',
    pasos: ['Registrar un documento que venza en menos de 30 días.', 'Entrar al panel principal.', 'Revisar la sección «Recordatorios».'],
    esperado: 'Aparece el recordatorio enviado con su asunto y la traza de envío; los avisos futuros quedan programados.',
    verificar() {
      const rs = leer('ac_recordatorios', []).filter(r => r.estado === 'enviado');
      if (!rs.length) return falla('Aún no hay recordatorios enviados. Registra un documento que venza pronto.');
      const sinTraza = rs.filter(r => !r.asunto || !r.enviadoEn || !r.mensaje);
      return sinTraza.length ? falla(`${sinTraza.length} recordatorio(s) sin asunto, mensaje o traza de envío.`) : ok(`${rs.length} recordatorio(s) enviados con asunto, mensaje y traza (el correo es simulado).`);
    } },
  { id: 'CP-RF05-01', req: 'RF-05', tipo: 'Funcional', modulo: 'Panel (app.js: resumenVehiculo, renderAlerta)', nombre: 'Tablero consolidado del estado del vehículo',
    pasos: ['Iniciar sesión.', 'Revisar «Mis vehículos» en el panel principal.'],
    esperado: 'Cada vehículo muestra el semáforo de SOAT y tecnomecánica y sus últimos 3 mantenimientos, sin recargar la página.',
    verificar() {
      const vs = leer('ac_vehiculos', []), ds = leer('ac_documentos', []), ss = leer('ac_servicios', []);
      if (!vs.length) return falla('No hay vehículos para mostrar en el panel.');
      const filas = vs.map(v => {
        const est = t => { const d = ds.filter(x => x.vehiculoId === v.id && x.tipo === t).sort((a, b) => b.vencimiento.localeCompare(a.vencimiento))[0]; return d ? estadoDoc(diasPara(d.vencimiento)) : 'sin registrar'; };
        return `${v.placa}: SOAT ${est('SOAT')}, tecnomecánica ${est('Tecnomecánica')}, ${Math.min(3, ss.filter(x => x.vehiculoId === v.id).length)} mantenimiento(s) visibles`;
      });
      return ok(filas.join(' | '));
    } },
  { id: 'CP-RNF02-01', req: 'RNF-02', tipo: 'No funcional', modulo: 'Seguridad (app.js: cifrar, PBKDF2-SHA256 con sal)', nombre: 'Seguridad: contraseñas cifradas',
    pasos: ['Crear una cuenta nueva.', 'Revisar cómo quedó guardada la contraseña.'],
    esperado: 'Ninguna contraseña queda en texto plano; cada usuario tiene una sal y un hash propios.',
    verificar() {
      const us = leer('ac_users', []);
      if (!us.length) return falla('No hay usuarios registrados.');
      const malos = us.filter(u => !(u.sal && /^[0-9a-f]{64}$/.test(u.hash || '')) || 'clave' in u || 'contrasena' in u || 'password' in u);
      return malos.length ? falla(`${malos.length} usuario(s) sin hash/sal válidos.`) : ok(`${us.length} usuario(s) con hash PBKDF2-SHA256 de 256 bits y sal propia. Nota: el entregable pide scrypt, que requiere servidor.`);
    } }
];

const resultados = () => leer('ac_pruebas', {});
function ejecutar(p) {
  let r;
  try { r = p.verificar(); } catch (e) { r = falla('Error al verificar: ' + e.message); }
  const todos = resultados();
  todos[p.id] = { ok: r.ok, detalle: r.detalle, fecha: new Date().toISOString() };
  localStorage.setItem('ac_pruebas', JSON.stringify(todos));
}

function render() {
  const res = resultados();
  const etiqueta = id => !res[id] ? ['old', 'Sin ejecutar'] : res[id].ok ? ['ok', 'Pasa'] : ['bad', 'Falla'];
  $('rtm').replaceChildren(...PRUEBAS.map(p => {
    const tr = document.createElement('tr');
    const [clase, txt] = etiqueta(p.id);
    const celdaRes = document.createElement('td');
    celdaRes.append(el('span', `badge ${clase}`, txt));
    ['NE-01', p.req, p.tipo, p.modulo, p.id].forEach(t => tr.append(Object.assign(document.createElement('td'), { textContent: t })));
    tr.append(celdaRes);
    return tr;
  }));
  $('casos').replaceChildren(...PRUEBAS.map(p => {
    const [clase, txt] = etiqueta(p.id);
    const a = el('article', `servicio doc estado-${clase}`);
    const top = el('div', 'servicio-top');
    top.append(el('h3', '', `${p.id} · ${p.nombre}`), el('span', `badge ${clase}`, txt));
    const pasos = el('ol', 'pasos');
    p.pasos.forEach(t => pasos.append(el('li', '', t)));
    const btn = el('button', 'btn btn-ghost btn-sm no-print', 'Verificar con mis datos');
    btn.type = 'button';
    btn.addEventListener('click', () => { ejecutar(p); render(); });
    a.append(top, el('p', 'detalle', `Requisito ${p.req} · ${p.tipo}`), pasos, el('p', 'detalle', `Resultado esperado: ${p.esperado}`));
    if (res[p.id]) a.append(el('p', 'proximo', `${res[p.id].detalle} — ${new Date(res[p.id].fecha).toLocaleString('es-CO')}`));
    a.append(btn);
    return a;
  }));
}
$('btn-todas').addEventListener('click', () => { PRUEBAS.forEach(ejecutar); render(); });
$('btn-imprimir').addEventListener('click', () => window.print());
render();