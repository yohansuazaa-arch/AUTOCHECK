/* AutoCheck – Página de inicio: cada apartado del menú se muestra por separado.
   La vista se elige con el enlace (#problema, #funciones, #planes, #equipo); sin enlace se muestra el inicio. */
const VISTAS = ['inicio', 'problema', 'funciones', 'planes', 'talleres', 'equipo'];
const TITULOS = {
  inicio: 'AutoCheck – Mantén todo en check',
  problema: 'AutoCheck – El problema',
  funciones: 'AutoCheck – Funciones',
  planes: 'AutoCheck – Planes',
  talleres: 'AutoCheck – Talleres aliados',
  equipo: 'AutoCheck – Equipo'
};

function mostrarVista() {
  let nombre = location.hash.replace('#', '');
  if (nombre === 'como-funciona') nombre = 'inicio';      // «Cómo funciona» vive en la vista de inicio
  if (!VISTAS.includes(nombre)) nombre = 'inicio';

  VISTAS.forEach(v => { document.getElementById('vista-' + v).hidden = v !== nombre; });
  document.querySelectorAll('.nav-landing nav a').forEach(a => {
    if (a.getAttribute('href') === '#' + nombre) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = TITULOS[nombre];
  window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', mostrarVista);
mostrarVista();