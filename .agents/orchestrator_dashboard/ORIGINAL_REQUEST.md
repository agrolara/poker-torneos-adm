# Original User Request

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
