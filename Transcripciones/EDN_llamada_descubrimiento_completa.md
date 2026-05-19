# Llamada de descubrimiento — EDN (Bancolombia × Oregon Interfactura)

> **Fuente:** Transcripción verbatim (TurboScribe) de la sesión con Felipe (EDN) y Emma (socia de Felipe).
> **Procesado:** 2026-05-19
> **Tipo:** notas estructuradas con anclaje a citas directas

---

## 1. Quiénes están en la llamada

- **Felipe** — contraparte principal en EDN. Tiene rol comercial / de negocio (él mismo lo dice: *"le estás hablando al comercial, entonces me vas a corchar, pero te voy a contar lo que sé"*).
- **Emma** — socia de Felipe en EDN. Se une a los pocos minutos de empezada la llamada.
- **Freddy** — lado vendedor (TDXcore).

> Felipe: *"Sí, ella es mi socia, sí, sí."*

## 2. Qué es EDN — la historia completa

### Origen

EDN (Felipe también lo pronuncia "ADN" / "TCDN" en distintos momentos — es la misma compañía) es un **joint venture entre Bancolombia y Oregon Interfactura** (empresa mexicana).

> *"Oregon es una empresa en México que es el principal producto tecnológico, así se les llama acá, de factura electrónica y todo eso en México. Esa gente tiene como el 33% y esa gente se dedicó a digitalizar las cadenas de abastecimiento."*

- **Oregon Interfactura** tiene **~33% de EDN**
- En México son referentes en factura electrónica
- Han ido más allá de la factura: digitalizan **órdenes de compra, notas de recepción** — toda la cadena de abastecimiento

### Edad y trayectoria

- EDN tiene **4–5 años de existencia**
- Los **primeros 2 años** se dedicaron a **"tropicalización"** del producto mexicano a Colombia
- Razón: la factura electrónica tiene marcos legales distintos por país
  - **México: SAT**
  - **Colombia: DIAN**
- *"Una vez tropicalizado la parte de Oregon que está alrededor de la digitalización de la cadena de abastecimiento, pues empezamos ya a conectar los servicios financieros."*

### Propuesta de valor (palabras de Felipe)

> *"Básicamente es un ecosistema digital en donde se atiende el flujo de las compañías entre clientes y proveedores de compra y venta, que va desde una orden de compra hasta el pago o recaudo... o inclusive la financiación de una factura, es decir, hasta la finalización del proceso."*

### Relación con Bancolombia

Punto crítico: aunque Bancolombia es socio mayoritario, **EDN opera independiente** y **no tiene acceso al stack de Bancolombia**:

> *"Yo no tengo ni el ERP de Bancolombia, yo no tengo el CRM de Bancolombia, yo no tengo nada. Yo lo que tengo con Bancolombia es un modelo de actuación comercial donde yo me apalanco en los equipos comerciales de Bancolombia para vender mi producto."*

- Tienen CRM propio
- Tienen ERP propio: **CIESA**
- Solo trabajan con servicios financieros de Bancolombia (por ahora)

### Crecimiento

- **~50% año contra año** en ventas
- Llevan 1–2 años con crecimientos importantes
- *"El problema es que hay procesos que nosotros no hemos logrado crecer o preparar en la medida en que la compañía viene creciendo. Entonces empiezan a aparecer los problemas buenos."*

## 3. Inventario de dolores ("problemas buenos")

### 3.1 Facturación interna manual (DN factura a sus clientes)

> *"Es una persona mirando, nosotros somos un servicio as a service, entonces mirando las transacciones de cada uno de los clientes, bajando la información, liquidando, cruzando en otra parte donde tiene el precio de cada cliente y con eso logra emitir la factura en un sistema que nosotros tenemos. Pero al final el cruce de transacciones versus precios es un cruce completamente manual."*

**Consecuencia:** *"Algunas veces no le hemos facturado a un cliente o le hemos facturado con muchos errores."*

### 3.2 Conciliación de pagos manual

> *"La conciliación es completamente manual. Cuando nos pagan, nos mandan el comprobante de pago, nosotros tenemos que entrar a nuestro ERP, que es CIESA, entramos a nuestro ERP y lo conciliamos."*

### 3.3 Validación de XMLs en delivery (manual)

> *"Un cliente necesita hacer un desarrollo que es un XML, la factura es un XML y entonces tiene un error. Entonces en las pruebas sale un error. Entonces es el delivery mirando, comparando el XML nuestro versus el XML del cliente a ver en dónde estuvo el error. Eso se pudiese meter en alguna parte donde valora y comparar XML."*

### 3.4 Change management: producto → mercado

> *"El equipo de producto hace desarrollos en la propuesta de valor pero la forma de comunicar un desarrollo por parte del producto a un tercero es muy funcional. ¿Quién traduce eso a temas de mercado? Nosotros hoy presentamos mucho todavía desde la parte funcional y deberíamos presentar un poco más desde las necesidades de los clientes."*

### 3.5 Sin chatbot ni atención estructurada

> *"Nosotros hoy no tenemos un chatbot, por ejemplo, que reciba o una línea de atención que reciba clientes. Aunque nuestro foco es clientes grandes, sin embargo, cuando hay clientes que nos escriben y demás, no tenemos un chatbot que nos responda."*

### 3.6 ⭐ **DOLOR PRIORITARIO**: ¿Cuándo ofrecer factoring?

Felipe lo marca explícitamente como **el caso de uso prioritario**:

> *"Este sería mi caso de uso objetivo, ideal, si lo pudiéramos hacer. No significa que todos los que acabamos de decir no sean viables. Todos son viables. Pero este tiene como cierta prioridad porque le agrega como más valor a mi propuesta de valor."*

## 4. El dolor del Factoring — desarrollado en detalle

### El flujo que EDN cubre

```
[Comprador] → Orden de compra → [Proveedor]
[Proveedor] → Emite factura → [Comprador]
[Comprador] → Nota de recepción
[Comprador] → Aceptación de factura
                  ↓
          Operación de Factoring
                  ↓
              Pago / Recaudo
```

### El problema en palabras de Felipe

> *"Yo tengo un problema. Y es que para que una operación de Factoring se haga, yo tengo que decirle al proveedor: 'oiga proveedor, ¿quiere hacer una operación de Factoring?'. Mi gran problema es: ¿cuándo le debo decir a un proveedor que debe hacer una operación de Factoring?"*

### Las dos preguntas que hay que responder

Felipe distingue claramente dos preguntas y aclara cuál ya está resuelta y cuál no:

| Pregunta | Estado | Quién la resuelve |
|----------|--------|-------------------|
| **¿QUIÉN necesita financiación estructural?** | RESUELTO | Bancolombia, en ~5 min, leyendo estados financieros / flujo de caja |
| **¿CUÁNDO específicamente la necesita?** | **NO RESUELTO** | Esta es la oportunidad de EDN |

> *"El banco constantemente está haciendo análisis de las compañías desde el punto de vista estructural. Entonces el banco es capaz, en términos generales, con todo su analítica, saber quién necesita financiación. El problema [es] cuándo necesita financiación. Y eso es algo que yo creo yo puedo responder. Porque un flujo de caja deficitario, eso es estructural. Eso no significa que tú lo necesites hoy, mañana o pasado mañana. Todavía no te responde el cuándo."*

### Por qué EDN puede responder el "cuándo"

> *"El cuándo creo que yo lo puedo responder si yo tengo la relación de comprador y proveedor. Yo estoy viendo pasar todas las facturas que hay entre un proveedor y un comprador. Yo puedo empezar a establecer algunas tendencias de la información que hay ahí."*

### Señales concretas que Felipe identifica

**Señal 1 — Incremento de ventas:**
> *"Un proveedor le empieza a vender más a un comprador de lo históricamente vendido. Eso es una señal de que puede necesitar financiación. Porque cuando uno incrementa, normalmente necesita mayor financiación."*

**Señal 2 — Compresión de plazos de pago:**
> *"Los vencimientos de las facturas que le emite un proveedor a un comprador son todos los 30. Y de repente esas facturas empiezan a irse hacia el 15. Significa que sí hubo un cambio en los vencimientos, hay cambio en los pagos... seguramente empieza a tener necesidad."*

**Señal 3 — Ciclos sectoriales (arrocero):**
> *"Yo quisiera, tal vez, si alguien hace una operación de factoring hoy, que es del sector arrocero, y el sector arrocero hace muchas operaciones de factoring en este momento, porque son cíclicas las operaciones. Yo necesito saber que en un año, en esta época, tengo que volver a decirle a ese señor: venga, que es usted. Yo sé que en esta época el arroz es cuando están en cosecha, está facturando mucho."*

**Señal 4 — Ciclos sectoriales (comercio Q4):**
> *"El comercio, resulta que el comercio es al final del año, en el Q4 se hacen entre el 40 y 50% de las ventas del sector comercio."*

### Comportamiento actual ("spray and pray")

> *"Yo qué hago, y todo el mercado de factoring qué hace: cada vez que veo una factura, llama a un cliente. 'Oye señor, usted tiene una factura'. 'No, pero bien, no la necesito'. Déjame llamar."*

> *"Tenemos personas llamando cada vez que ven un lead, que es una factura entre un proveedor y un comprador, cuando realmente no lo necesitan. Y el 90% de las veces no lo necesita."*

> *"Solo Sodexo viene aproximadamente con 3.000 proveedores. Y ACER viene a ser otros 2.000 proveedores. Yo no tengo cómo estar llamando todos los días a 5.000 proveedores. Porque les tengo una factura, se vuelve ineficiente y mala experiencia y poco efectivo."*

**Resumen del dolor en su propia voz:**
> *"La idea es como identificar realmente quién sí hay que llamar. Ese es el dolor."*

## 5. Arquitectura técnica de EDN (lo que sabe Felipe)

Felipe aclara que es el comercial, no el técnico, pero da pistas valiosas:

> *"Nosotros tenemos una base de datos. Tenemos un core donde hay una base de datos donde reposa toda esta información."*

### Origen de la data

> *"Esa información, ¿de dónde nace? Nace de un intercambio de documentos, de facturas, que hay entre proveedor y cliente, que es un JSON que por detrás tiene toda la información de forma estandarizada."*

**Implicación técnica:** los documentos son **JSON estandarizados**, lo que facilita enormemente el feature engineering.

### Qué NO está estandarizado

> *"[El] producto que se está vendiendo, eso todavía no está estandarizado."*

Felipe pregunta si esto afecta el análisis. Respuesta dada en la llamada: *"En el caso de uso principal, creería yo que no"* — el motor depende del comportamiento documental, no del catálogo de producto.

### Qué SÍ está estandarizado

- NIT del proveedor
- Total de la factura
- Total de impuestos
- Bruto / neto de cada factura
- Datos de contacto
- **Fecha de emisión y fecha de vencimiento** (Felipe enfatiza: *"eso es importante"*)

### Plataformas

> *"Nosotros tenemos dos plataformas: una plataforma que soporta todo lo que tiene que ver con el comprador, y otra plataforma que tiene que ver con el emisor. Y esas plataformas están conectadas para que a partir de esa conexión fluyan los documentos."*

## 6. Diálogo clave sobre viabilidad técnica

Freddy planteó la viabilidad y Felipe enganchó:

> Freddy: *"Veo que tu mayor dolor es entender cómo poder identificar realmente a quién debo llamar, a quién le deben ofrecer correctamente los servicios de factoring, y eso se hace con análisis de data nomás."*

> Freddy: *"[Bancolombia] su motor de análisis de créditos, por ejemplo, en cinco minutos ellos están dando una respuesta... pero eso lo logran ellos es porque la base de datos de ellos es brutal, y logran hacer algoritmos y mucha inteligencia... que te permite identificar patrones, y con esos patrones disparas acciones."*

> Felipe: *"Eso es básicamente lo que yo quisiera, lo que pasa es que [el motor del banco] no es para responder quién necesita y no cuándo necesita específicamente."*

> Felipe: *"Yo quisiera empezar a hackear esa ecuación. Automatizarla."*

## 7. Compromisos / siguientes pasos pactados

1. **Agendar próxima reunión** con la persona técnica de EDN.
2. **Felipe pidió explícitamente** que se le envíen las preguntas técnicas **por adelantado** para preparar la sesión:
   > *"¿Te puedo pedir un favor? Pensale las preguntas y mándamelas para yo... porque lleguemos y no sea una sesión inefectiva."*
3. Después de la sesión técnica → **mostrar algún tipo de demo, sin compromiso**.
4. **El caso de uso priorizado** = Factoring Signals Engine. Felipe aclaró:
   > *"La prioridad no la dan ustedes... son ustedes los que realmente saben qué valor le va a agregar al negocio esa solución."*
5. Si la data alcanza, el modelo se entrena. Si no:
   > *"Somos de los que va construyendo, o sea, a partir de la data que vayamos obteniendo."*
6. Felipe acepta que el modelo aprenderá **por cliente / por convenio** (cada relación es distinta):
   > *"Una cosa es la ciclicidad de SODEXO, otra cosa es la ciclicidad de ACER, otra cosa es la ciclicidad del arrocero. Pero en la medida en que se vayan vinculando estos convenios, [el modelo] sea capaz de ir entrenándose."*

## 8. Datos sueltos útiles

- Cliente actual referenciado: **Sodexo** (~3.000 proveedores) — ya viene incorporando proveedores al factoring vía EDN.
- Cliente actual referenciado: **ACER** (~2.000 proveedores).
- Total exposición ~5.000 proveedores activos solo entre estos dos.
- ERP propio: **CIESA**.
- Tasa de éxito actual del cold-call factoring: **~10%** (el 90% no lo necesita en el momento).
- Motor de crédito Bancolombia: respuesta en **~5 minutos**.

## 9. Lectura estratégica — implicaciones para la propuesta

| Insight | Implicación |
|---------|-------------|
| Documentos son JSON estandarizados | Pipeline de ingesta y feature engineering es directo (no hay que parsear formatos heterogéneos) |
| Bancolombia ya resuelve el "quién" estructural | La propuesta debe **complementar**, no competir — vendemos el "cuándo" / timing |
| Felipe distingue claramente "quién" vs "cuándo" | Tiene madurez conceptual — la presentación puede ir directo a la solución, sin pedagogía básica |
| Sin acceso a ERP/CRM de Bancolombia | El modelo se entrena con la data propia de EDN, no hay que pelear integraciones con el banco |
| Equipo técnico vendrá a la siguiente sesión | El demo y discurso deben aguantar escrutinio de ingeniería |
| Felipe pide preguntas técnicas por anticipado | Oportunidad para definir bien el cuestionario y filtrar viabilidad de data antes de invertir en demo |
| Felipe acepta el approach incremental ("si no hay data, vamos construyendo") | Margen para arrancar con reglas heurísticas si el histórico positivo es limitado |
| Otros dolores (facturación, conciliación, XML) son secundarios pero "todos viables" | Quick wins paralelos que pueden financiar / aumentar el ticket del deal |

---

## Anexo: glosario de términos usados en la llamada

| Término | Significado |
|---------|-------------|
| **ADN / EDN / TCDN** | Mismo nombre del joint venture (Felipe lo pronuncia varias formas) |
| **Oregon Interfactura** | Socio mexicano, ~33% de la empresa, experto en factura electrónica MX |
| **Tropicalización** | Adaptación del producto mexicano al marco regulatorio colombiano (DIAN) |
| **Factoring** | Financiación de facturas aceptadas — el proveedor cobra anticipado |
| **Cadena de abastecimiento** | Flujo OC → factura → recepción → aceptación → pago |
| **CIESA** | ERP interno de EDN |
| **DIAN / SAT** | Autoridades tributarias de Colombia y México respectivamente |
| **NIT** | Identificador tributario de empresas en Colombia |
