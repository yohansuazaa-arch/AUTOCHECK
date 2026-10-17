# ✓ AutoCheck

**Porque lo que te mueve importa, mantén todo en check.**

AutoCheck es una aplicación web que centraliza el mantenimiento y los documentos de tu carro o moto, y te avisa antes de que algo venza. Está pensada inicialmente para propietarios particulares en Colombia.

> Proyecto PA-PIA · Ingeniería de Software I · Institución Universitaria Pascual Bravo

> ⚠️ **Estado: prototipo.** No tiene servidor. Todos los datos se guardan en el `localStorage` del navegador, así que cada navegador tiene sus propios datos.

---

## El problema

Casi todos llevamos el control del vehículo en recordatorios sueltos, papeles en la guantera o de memoria. Cuando la información está dispersa, es fácil olvidar una fecha y eso termina en multas por SOAT o tecnomecánica vencidos, gastos inesperados, fallas mecánicas y tiempo perdido.

## Funcionalidades

### Propietarios
- **Cuenta de usuario:** registro con nombre, apellido, documento, correo y teléfono, e inicio de sesión. Las contraseñas se cifran con PBKDF2-SHA256 y sal aleatoria.
- **Perfil editable:** el usuario puede consultar y actualizar sus datos.
- **Vehículos:** registro de carros y motos (marca, modelo, año, placa y kilometraje), con validación del formato de placa. El plan gratuito permite 1 vehículo; Premium (de prueba) permite varios.
- **Mantenimiento:** registro de servicios (aceite, frenos, llantas, motor, otros) e historial ordenado del más reciente al más antiguo.
- **Documentos:** control del SOAT y la tecnomecánica con estado *Al día*, *Próximo a vencer* o *Vencido*.
- **Recordatorios:** avisos a 30, 15 y 5 días para documentos y a 15 y 5 días para mantenimientos, con notificaciones del navegador y correo simulado en una bandeja.
- **Talleres recomendados:** según el próximo servicio, se sugieren talleres aliados (fase futura).

### Talleres
- Formulario para **solicitar ser taller aliado**. La solicitud queda pendiente hasta que el administrador la revise.

### Administración
- **Estado de seguridad:** cifrado de contraseñas, HTTPS y disponibilidad.
- **Datos almacenados:** cada recuadro abre el detalle de esa colección; los usuarios se pueden consultar y **editar** (incluido el plan).
- **Solicitudes de talleres:** el administrador puede **aceptar** o **rechazar**. Al aceptar, el taller pasa a ser aliado y se recomienda a los propietarios.
- **Talleres aliados:** consulta y baja de talleres.
- **Copia de respaldo:** descarga un JSON con todos los datos y registra la operación.

## Estructura del proyecto

```
├── index.html      Página de presentación
├── styles.css      Estilos generales
├── app.html        Cuenta del propietario (acceso, vehículos, mantenimiento, documentos, perfil)
├── app.css         Estilos de la aplicación
├── app.js          Lógica de la aplicación del propietario
├── taller.html     Solicitud para ser taller aliado
├── taller.js       Lógica de solicitudes de talleres
├── admin.html      Panel de administración
└── admin.js        Lógica del panel de administración
```

## Cómo ejecutarlo

No requiere instalación ni dependencias.

1. Clona el repositorio:
   ```bash
   git clone https://github.com/<tu-usuario>/<tu-repositorio>.git
   cd <tu-repositorio>
   ```
2. Ábrelo con un servidor local. Se recomienda la extensión **Live Server** de VS Code, ya que el cifrado de contraseñas usa `crypto.subtle`, que solo funciona en `localhost` o con HTTPS. También sirve, por ejemplo:
   ```bash
   python -m http.server 5500
   ```
3. Entra a `http://localhost:5500/index.html`.

### Acceso de administrador
Abre `admin.html`. La clave es solo de prototipo y está definida en la constante `CLAVE_ADMIN` de `admin.js`. En producción debe reemplazarse por una cuenta de administración real.

## Tecnologías

- HTML5, CSS3 y JavaScript (sin frameworks)
- Web Crypto API (PBKDF2-SHA256)
- `localStorage` y `sessionStorage`
- Notifications API del navegador

## Próximos pasos

- Migrar el almacenamiento a un backend con API REST y base de datos (la propuesta del equipo es ASP.NET Core con SQL Server, y React en el frontend).
- Autenticación real para el administrador.
- Envío real de correos para los recordatorios y para avisar a los talleres cuando su solicitud sea resuelta.
- Despliegue con HTTPS y monitoreo de disponibilidad.

## Equipo

| Integrante | Rol |
|---|---|
| Yohan Felipe Suaza Cano | CEO |
| Juan José Quiros Usma | CTO |
| Yoselyn Puerta Vélez | CMO |

---

Hecho con ✓ en la Institución Universitaria Pascual Bravo, Medellín.
