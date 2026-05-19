# Llamada de descubrimiento — EDN (Bancolombia × Oregon Interfactura)

> Fuente: Recording 131 (sesión de descubrimiento con Felipe / equipo EDN)
> Procesado: 2026-05-19
> Estado: notas estructuradas de la llamada — no es transcripción verbatim

---

## 1. Identidad del cliente

**EDN** es un **joint venture entre Bancolombia (Colombia) y Oregon Interfactura (México)**.

- Producto: ecosistema digital B2B que digitaliza la cadena de abastecimiento end-to-end
- Crecimiento: ~50% año contra año
- Problema principal de escala: el back-office (procesos internos) no escala al mismo ritmo que el negocio

## 2. Flujo de producto que opera EDN

El producto cubre el ciclo completo entre comprador y proveedor:

```
Orden de Compra → Factura electrónica → Nota de recepción → Aceptación → Pago / Recaudo → Conciliación → Factoring
```

Cumplimiento regulatorio: **DIAN** (Colombia) para facturación electrónica.

## 3. Clientes representativos mencionados

| Cliente | Volumen de proveedores |
|---------|------------------------|
| Sodexo  | ~3.000 proveedores     |
| Acer    | ~2.000 proveedores     |

Total exposición transaccional: > 5.000 proveedores activos en el ecosistema solo entre estos dos.

## 4. Stack interno y herramientas

- **ERP interno de EDN: CIESA** (donde se hace facturación propia y conciliación de cobros)
- **Sin acceso al CRM de Bancolombia** (modelo de venta apalancado en la fuerza comercial del banco pero sin el dato)
- Tienen CRM propio
- Sin chatbot ni línea estructurada de atención al cliente

## 5. Dolor principal identificado

### El problema del "cuándo"

EDN **no sabe cuándo ofrecer factoring** a cada proveedor.

**Comportamiento actual:**
- Llaman a **todos** los proveedores cada vez que ven una factura
- Es un enfoque **"spray and pray"** (rociar y rezar)
- **Tasa de éxito: ~10%**
- Para Sodexo + Acer solos: tendrían que llamar a 5.000 proveedores

**Por qué duele:**
- Inviable operativamente
- Ineficiente (90% de llamadas son desperdicio)
- Degrada la experiencia del proveedor (acoso comercial)
- Genera fricción con el cliente final (mal percepción de marca EDN)

### Lo que SÍ está resuelto

El **"quién necesita financiación" estructuralmente** ya lo resuelve Bancolombia con su motor de crédito (análisis de estados financieros en ~5 minutos).

### Lo que NO está resuelto (la gran oportunidad)

El **"cuándo" — el timing — la oportunidad transaccional**. Nadie lo resuelve. Y EDN está **sentado sobre la data que lo respondería**: el flujo documental completo entre comprador y proveedor.

## 6. Patrones / señales mencionadas en la llamada

Felipe mencionó casos concretos de proveedores que sí necesitarían factoring por momentos puntuales:

- **Caso arrocero**: necesidad alta de liquidez en meses de cosecha (estacionalidad sectorial)
- **Comercio Q4**: incrementos típicos en octubre–diciembre por temporada de fin de año
- **Crecimiento súbito**: proveedor que incrementa ventas 30–50% en pocos meses
- **Compresión de plazos**: proveedor cuyos plazos de cobro pasan de 30 a 15 días (señal fuerte de necesidad de caja)

Estos son **arquetipos de señales** que el motor ML debería detectar.

## 7. Otros dolores secundarios mencionados ("problemas buenos" / quick wins)

### 7.1 Facturación interna manual de EDN
- Una persona cruza manualmente las transacciones del mes contra precios pactados por cliente
- Emite la factura en CIESA (ERP interno)
- Genera **errores y omisiones**
- Candidato a RPA + matching automático transacciones↔precios

### 7.2 Conciliación de cobros manual
- Ingresan los comprobantes a CIESA uno por uno
- Trabajo repetitivo de bajo valor

### 7.3 Validación de XMLs en delivery (onboarding de clientes)
- 100% manual: comparan XML del cliente contra XML de EDN línea por línea
- Cuello de botella para acelerar onboarding
- Candidato a comparador automático de XMLs

## 8. Mapa de procesos de EDN (consolidado)

### Procesos core (producto)
- Emisión y recepción de factura electrónica (DIAN)
- Gestión de órdenes de compra
- Notas de recepción
- Aceptación de facturas
- Operación de factoring
- Pago y recaudo
- Conciliación contra ERP del cliente

### Procesos de delivery / onboarding
- Integración con ERP del cliente
- Validación / debugging de XMLs (manual)
- Setup de procesos de facturación y declaración de pagos
- Acompañamiento técnico

### Procesos internos administrativos
- Facturación propia (manual)
- Conciliación de cobros (manual)
- Liquidación de precios por cliente

### Procesos comerciales
- Venta apalancada en fuerza comercial de Bancolombia
- CRM propio
- Generación de leads para factoring (hoy "spray and pray")
- Traducción de releases técnicos a material comercial (gap funcional ↔ mercado)

### Procesos de soporte / atención
- Atención a clientes (sin chatbot, sin línea estructurada)

### Procesos de riesgo financiero
- Análisis estructural de necesidad de financiación → resuelto por motor de crédito de Bancolombia (~5 min)
- Análisis de oportunidad / timing → **NO EXISTE** (este es el dolor principal)

## 9. Restricciones y contexto adicional

- El producto que venden los proveedores **no es estandarizado** entre sectores — por eso el motor no puede depender del catálogo, debe depender del **comportamiento documental**
- Bancolombia ya tiene la pieza de análisis estructural de crédito → EDN debería complementar, no competir
- Equipo técnico de EDN sofisticado: Felipe va a llevar a su equipo a la siguiente sesión técnica
- Afinidad cultural / técnica con **GCP** (por Bancolombia)

## 10. Decisiones estratégicas tomadas a partir de la llamada

| Decisión | Razón |
|----------|-------|
| Atacar el dolor "cuándo ofrecer factoring" como producto principal | Mayor valor estratégico, tocan unit economics del factoring |
| Producto: **Factoring Signals Engine** (motor de propensity ML) | Resuelve "cuándo" sobre data que ya existe |
| Stack: **GCP** (BigQuery + Vertex AI + Cloud Run + Vercel) | Afinidad Bancolombia, time-to-value rápido, equipo chico |
| Modelo ML: **XGBoost** sobre features tabulares (no deep learning) | Estándar en fintech para propensity scoring real-time |
| Demo: **infra real, data sintética** en GCP free tier (~$5 USD) | Máxima credibilidad técnica con cero presupuesto |
| Quick wins paralelos: RPA facturación interna + comparador de XMLs | Liberan capacidad de gente, financian el proyecto ML |

## 11. Siguiente paso comprometido

- Construir el **demo del Factoring Signals Engine** en 1 semana
- Presentarlo a Felipe + su equipo técnico
- Validar en sesión técnica el volumen y profundidad histórica de su data
- Si va bien: piloto con **Sodexo o Acer** como caso inicial

---

## Anexo: arquetipos de proveedores (input para data sintética del demo)

Para reconstruir señales detectables, se diseñaron 5 arquetipos:

1. **Crecimiento súbito** (positivo) — +30–50% ventas en últimos 2 meses
2. **Plazos comprimidos** (positivo) — vencimientos pasaron de 30 → 15 días en últimas 6 facturas
3. **Estacional arrocero** (positivo) — pico de facturación en meses de cosecha
4. **Q4 comercio** (positivo) — incremento típico octubre–diciembre
5. **Estable** (negativo) — facturación flat, sin cambios → no necesita factoring

Distribución sugerida para el demo: 70% estables, 30% repartido entre los 4 arquetipos positivos.
