# Guión demo EDN — versión interactiva (con simulador en vivo)

> 25 minutos · Audiencia: Felipe + Emma + equipo técnico de EDN
> Demo URL: **https://edm-demo-pi.vercel.app**
> Repo: **https://github.com/frincones/EDM**

---

## Pre-demo (5 min antes)

- [ ] Abrir 2 pestañas del browser:
   - Pestaña 1: https://edm-demo-pi.vercel.app/feed (queda visible)
   - Pestaña 2: https://edm-demo-pi.vercel.app/simulador (para interactuar)
- [ ] Verificar que `/feed` diga "● conectado" arriba
- [ ] Tener listo el guión

---

## Minuto 0–3 — El problema reformulado

> "Felipe, en mayo nos dijiste algo que se nos quedó: *'el banco sabe quién necesita factoring estructuralmente — el problema es saber cuándo específicamente lo necesita.'*
> Te traemos esa respuesta. Y para que no nos creas a ciegas, vas a poder probar el sistema con tus propias manos hoy mismo."

Mostrar números del problema:
- 5.000 proveedores Sodexo+ACER
- ~10% conversión cold call
- 4.500 llamadas/mes desperdiciadas

---

## Minuto 3–6 — Dashboard `/leads` (con buscador)

> "Estos son los 84 leads priorizados que el motor scoreó hoy. Verde = alta propensión."

**Mostrar buscador:**
- Escribir "Arrocera" → filtra a 1 fila → Arrocera del Tolima en top
- Limpiar búsqueda
- Slider de score mínimo: arrastrar a 70 → muestra solo los altos

> "Tu equipo comercial empieza el día acá."

---

## Minuto 6–10 — Detalle de Arrocera del Tolima (HERO)

Click en Arrocera del Tolima.

**Mostrar (de arriba hacia abajo):**

1. **Sección "En lenguaje simple"** (lo nuevo):
   > Felipe lee el párrafo en español. Sin terminología técnica.

2. **SHAP Waterfall** — barras verdes/rojas:
   > "Este score 100 se compone así: el punto de partida del modelo era 50.  
   > '+47% por estar en cosecha agrícola' (Tolima en mayo) → +28 al score.  
   > '+109% crecimiento YoY' → +19 al score.  
   > Te muestro CADA componente. No es magia."

3. **Tabla "Facturas que más pesaron en la señal"**:
   > "Estas 5 facturas son las que el motor 'miró' para decidir. Mirá la columna 'vs promedio histórico' — esta del 12 de mayo es 91% más alta que el promedio de Arrocera."

4. **Sector Baseline**:
   > "Y se compara con el sector arrocero — ticket promedio del sector vs el suyo. Está bien por encima."

---

## Minuto 10–12 — Metodología (`/metodologia`)

Cambiar a `/metodologia`.

> "Acá la transparencia total: estos son los 5 arquetipos del modelo, y cada uno con TU cita textual que originó la idea."

Mostrar arquetipo "Ciclicidad agrícola" con la quote:
> *"Si alguien hace una operación de factoring hoy, que es del sector arrocero, y el sector arrocero hace muchas operaciones de factoring en este momento, porque son cíclicas las operaciones..."*  
> — **Felipe, llamada de descubrimiento**

> "Cada arquetipo está soportado por algo que VOS dijiste. No inventamos nada."

Mostrar gráfico de distribución de arquetipos y de scores.

---

## ⭐ Minuto 12–18 — Simulador en vivo (el momento killer)

Cambiar a `/simulador`. La pestaña de `/feed` debe seguir abierta en otra ventana visible.

> "Ahora vamos a hacer algo que NINGÚN demo te va a permitir hacer: vas a inyectar tu propia factura y ver cómo el sistema reacciona en vivo."

### Opción A — Escenario pre-armado

Click en **🌾 Cosecha sorpresiva**.

Verán:
1. Los 5 pasos del pipeline ejecutándose con timing real:
   - POST /ingest a Edge Function de Supabase → 234ms
   - INSERT en facturas → 145ms
   - REFRESH features point-in-time → 612ms
   - POST /score al Lambda XGBoost en AWS → 423ms
   - INSERT signal + Realtime push → 89ms
2. Antes/Después con el score subiendo
3. **En la otra pestaña /feed: aparece la nueva señal con highlight + toast**

> "Eso que viste fue una factura REAL viajando por una arquitectura REAL — Supabase, AWS Lambda, vuelta a Supabase. En 1.5 segundos."

### Opción B — Pedirle a Felipe

> "Felipe, ahora elegí TÚ un proveedor del dropdown, dame un monto que quieras, y un plazo. Lo metemos juntos."

Felipe llena el form → submit → mismo flujo. Score cambia.

---

## Minuto 18–20 — Sistema (`/sistema`)

> "Y para los técnicos: este es el estado de cada pieza en vivo."

Mostrar health checks:
- Supabase: OK · 234ms · model_version v1 · 23 features
- AWS Lambda: OK
- Vercel: OK

Mostrar tablas con counts (cuántos eventos, facturas, signals).

Mostrar los últimos 15 eventos ingresados — los que Felipe acaba de generar aparecen ahí con su timestamp.

> "Felipe, esto es lo que tu equipo de DevOps podrá monitorear todos los días."

---

## Minuto 20–22 — Feed con alertas (`/feed`)

> "Última pieza: el feed que verá tu comercial."

En `/feed` (en una pestaña), buscar "Arrocera" arriba.

> "Ahora dejo esa búsqueda activa. Si llega cualquier señal que mencione Arrocera, vamos a tener una alerta arriba a la derecha."

Volver a `/simulador`, ejecutar otro escenario:
- En `/feed`: aparece el AlertToast: 🔔 Arrocera del Tolima... Score 99/100

---

## Minuto 22–25 — Cierre + handoff de verificación

> "Felipe, te paso 4 cosas para que tu equipo valide después de la reunión:
> 
> 1. **URL pública del Lambda** — pueden hacerle curl, ver que devuelve los mismos scores
>    `https://gq2wqiw2n46rafrh2aekl4jkzi0iueth.lambda-url.us-east-1.on.aws/health`
> 
> 2. **Repo GitHub público** — código del modelo, schema SQL, generador  
>    `https://github.com/frincones/EDM`
> 
> 3. **El script `validate_end_to_end.py`** — corre 5 chequeos automáticos:
>    - Modelo en S3 hash = local hash
>    - Signals provienen del modelo v1
>    - Lambda /score = scores precomputados
>    - Vercel data = Supabase data
>    - Realtime push funciona
> 
> 4. **La URL del simulador** — pueden seguir agregando facturas y mirar cómo reacciona el modelo
>    `https://edm-demo-pi.vercel.app/simulador`
> 
> Si en algún momento tu equipo encuentra algo que no cuadra, lo discutimos. La transparencia es por diseño."

**Cerrar con:**
> "¿Cuándo agendamos el piloto con Sodexo o ACER?"

---

## Cómo Felipe puede verificar TODO por su cuenta (post-demo)

| Qué validar | Cómo |
|------------|------|
| ¿El modelo es real, no random? | `/sistema` → click en Lambda URL → ver score; repetir con mismo ID = mismo score |
| ¿Las señales vienen de SU pipeline? | `/simulador` → inyectar factura → verla aparecer en `/feed` con su timestamp |
| ¿La explicación es del modelo, no plantilla? | Cambiar features en form (monto, plazo) → ver razones SHAP cambiar |
| ¿La data es real de Supabase? | `/sistema` → tabla "Tablas" con cuentas en vivo + último timestamp |
| ¿El modelo aprende? | Ver `/metodologia` → AUC 0.807, dataset 1.506 outcomes históricos |
| ¿Los arquetipos coinciden con lo que dije? | `/metodologia` → cada arquetipo tiene MI cita textual |
| ¿La arquitectura es producción-grade? | Repo GitHub → leer `infra/aws/deploy_lambda.sh`, `infra/supabase/migrations/` |

---

## Recuperación si algo falla durante la demo

| Problema | Fallback |
|----------|----------|
| Lambda cold start lento (3-5s) | Decirle a Felipe: "vamos a 'despertar' al Lambda" → click en /sistema (hace health check) → ahora warm. |
| Internet falla | Tener `/leads`, `/leads/[hero-id]`, `/metodologia` ya cargados en el browser cache |
| Supabase momentáneamente lento | Mostrar el código del simulador en otra pestaña — Felipe ve la lógica igual |
| Escenario falla | Hacer la inyección manual con el form — más lento pero igual de impactante |

---

## URLs claves para tener listas

- **Demo en vivo:** https://edm-demo-pi.vercel.app
- **Simulador (la pestaña que más vas a usar):** https://edm-demo-pi.vercel.app/simulador
- **Feed (otra pestaña abierta):** https://edm-demo-pi.vercel.app/feed
- **Lambda URL pública:** https://gq2wqiw2n46rafrh2aekl4jkzi0iueth.lambda-url.us-east-1.on.aws/health
- **Repo:** https://github.com/frincones/EDM

---

## Costo total del sistema mostrado: **$0**

Free tiers de Supabase + AWS Lambda + Vercel + S3.

En producción real con EDN, el costo escalaría a ~$60-150 USD/mes hasta ~10M predicciones/mes.
