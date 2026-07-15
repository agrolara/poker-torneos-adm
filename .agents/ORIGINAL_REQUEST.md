# Original User Request

## Initial Request — 2026-07-15T00:43:59-04:00

Implement a public "Estructuras y Simulador de Premios" explorer directly on the Landing Page (`Landing.tsx`) so that unregistered visitors can browse the blind structures database and simulate payouts.

Working directory: C:\Users\Usuario\Documents\antigravity\Poker torneos adm
Integrity mode: development

## Requirements

### R1. Botón y Modal de Exploración Pública
* Agregar un botón destacado ("Explorar Estructuras de Ciegas") en la página de inicio pública (`Landing.tsx`).
* Al hacer clic, debe abrir una interfaz modal o sección interactiva responsiva que cargue de forma pública y asíncrona la lista de estructuras de la base de datos `blind_structures`.

### R2. Visualización Detallada de Niveles y Descansos (Breaks)
* Al seleccionar una estructura del listado, se debe mostrar el detalle completo de sus niveles (incluyendo ciegas chica/grande, ante y duración).
* Los descansos (breaks) configurados en la estructura deben resaltarse visualmente con estilo verde destacado, indicando su posición exacta y duración.

### R3. Simulador de Premios Interactivo
* Dentro del detalle de la estructura, agregar una sección interactiva de "Simulador de Premios".
* El visitante puede ingresar de forma libre la "Cantidad de Jugadores" y "Valor de Entrada (Buy-in)".
* El sistema calculará automáticamente:
  1. El pozo total bruto.
  2. La deducción del Rake acumulado (según la tasa configurada en la estructura).
  3. El pozo neto a repartir.
  4. La distribución exacta de los premios (1°, 2°, 3° lugar, etc.) aplicando los porcentajes personalizados cargados desde la estructura de ciegas.
* Todo debe recalcularse en tiempo real al modificar los valores de entrada.

### R4. Responsividad Total y Estilo Premium
* La interfaz completa debe ajustarse automáticamente a pantallas móviles, tablets y escritorios, manteniendo la consistencia de estilos oscuros y vidrio (glassmorphism) de la aplicación.

## Acceptance Criteria

### Interfaz Pública y Carga de Datos
- [ ] El botón de exploración es visible en la Landing Page sin necesidad de estar logueado.
- [ ] La lista de estructuras se carga correctamente de Supabase y es legible.
- [ ] Al hacer clic en una estructura se despliegan sus niveles ordenados secuencialmente, con los breaks destacados en color verde.

### Simulador y Distribución de Premios
- [ ] El simulador calcula y muestra el pozo neto restando el Rake ingresado/configurado.
- [ ] El desglose de puestos muestra los porcentajes cargados de la estructura (ej. 60%-25%-15% o similar) y calcula los CLP correctos para cada puesto del podio.
- [ ] Modificar el número de jugadores o buy-in actualiza los cálculos instantáneamente en pantalla.

### Responsividad y Estilos
- [ ] El modal y la tabla se adaptan a anchos de pantalla móviles (menores a 480px) apilando los componentes de forma vertical sin desbordar el contenedor.
- [ ] La aplicación compila sin errores de TypeScript y Vite (`npm run build`).

## Follow-up — 2026-07-15T05:14:40Z

Enhance the main dashboard (`Dashboard.tsx`) for organizers and leagues with advanced financial KPIs, detailed completed tournament history cards, and an expanded leaderboard displaying games played, wins, and position trends.

Working directory: C:\Users\Usuario\Documents\antigravity\Poker torneos adm
Integrity mode: development

## Requirements

### R1. KPIs Financieros Avanzados
* Agregar tarjetas de métricas en la fila superior del Dashboard:
  - **Premios Distribuidos**: Suma total de los montos pagados.
  - **Rake de Liga Acumulado**: Total consolidado de rake de la liga en torneos completados.
  - **Promedio de Recompras**: Cantidad media de recompras por jugador en fechas completadas.
* El diseño debe integrarse con el estilo oscuro y neón de la aplicación.

### R2. Historial de Fechas Enriquecido con Mini-Podios
* En la lista de torneos (pestaña "Fechas de Campeonato"), cada torneo completado debe mostrar:
  - **Mini Podio**: Los nombres de los ganadores del 1°, 2° y 3° lugar (con emoticonos de medallas 🥇, 🥈, 🥉).
  - **Finanzas de la Fecha**: Recaudación total, rake recolectado en la fecha y pozo neto repartido.

### R3. Leaderboard Expandido con Rendimiento y Tendencias
* Ampliar la tabla de clasificación de la liga (Leaderboard) para incluir:
  - **PJ (Partidas Jugadas)**: Número de fechas jugadas.
  - **Victorias**: Cantidad de primer lugares obtenidos.
  - **Tendencia Visual**: Flecha dorada `▲` si subió de rango respecto a la fecha anterior, flecha roja `▼` si bajó, o un punto gris `●` si se mantuvo igual.

### R4. Responsividad Total y Absoluta
* La cuadrícula superior, las filas de torneos y las columnas de la tabla del ranking deben adaptarse de forma fluida a pantallas desde 320px de ancho en adelante.
* En celulares, los elementos deben apilarse verticalmente de manera limpia, ocultando información no crítica para evitar desbordamientos horizontales.

## Acceptance Criteria

### Cálculos y KPIs
- [ ] Los KPIs se calculan y muestran correctamente sumando los datos reales del historial de torneos.
- [ ] El promedio de recompras se renderiza con un decimal (ej. "1.2 recompras").

### Historial y Ranking
- [ ] Las filas de torneos finalizados muestran las medallas 🥇, 🥈, 🥉 junto con los nombres de los jugadores correspondientes.
- [ ] El ranking calcula y muestra correctamente los indicadores de tendencia en base al historial cronológico de fechas de campeonato.
- [ ] Las columnas de PJ y Victorias muestran los valores correspondientes para cada jugador.

### Responsividad y Calidad
- [ ] El dashboard no presenta desbordamientos horizontales ni textos superpuestos en dispositivos móviles (viewport de 360px a 480px).
- [ ] La aplicación compila sin errores de TypeScript y Vite (`npm run build`).
