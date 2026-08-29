# Dominio de Logística Internacional — Guía de referencia del equipo

Este documento combina lo que dibujamos en el whiteboard, lo aprendido en el video de importación marítima en México, y cómo Nauta (nuestra referencia de producto) encaja o modifica cada parte. Objetivo: que todos entendamos el mismo flujo antes de tocar entidades/schema.

---

## 1. El flujo completo, de punta a punta

```
CLIENTE ──$/PO──▶ PROVEEDOR ──BC (Booking Conf)──▶ 🚢 (carga)
                                    │
                                    ▼
                          BL (Bill of Lading)
                          + Invoice + Packing List
                                    │
                                    ▼
                          🚢 en tránsito (ETA)
                                    │
                                    ▼
                     Arrival Notice (AN) — llega a puerto
                                    │
                                    ▼
              Documento Virtual Aduanero ──▶ Pedimento ──▶ Validar
                                    │
                                    ▼
                          "Previo" (revisión física, 1-3 hrs) ──▶ Aduana
                                    │
                          ┌─────────┴─────────┐
                       🟢 Verde              🔴 Rojo
                  No toca revisión      Revisión física
                  (destino final)       por autoridad
                                    │
                                    ▼
                    Entrega ──▶ Cuenta de gastos ──▶ Factura P/ Aprobación
```

Esto es exactamente el mismo flujo del whiteboard, solo ordenado en secuencia. Cada flecha del diagrama es un **trigger** potencial de un run en nuestro sistema.

---

## 2. Documentos clave (los que ya modelamos como `type` en `documents`)

| Doc | Quién lo emite | Qué certifica | Dónde entra en el flow |
|---|---|---|---|
| **PO** (Purchase Order) | Cliente | La orden de compra al proveedor | Inicio, antes de cualquier tracking |
| **BC** (Booking Confirmation) | Naviera | Espacio reservado en el barco | Trigger de `Ari` — nace la operación |
| **BL** (Bill of Lading) | Naviera | Contrato de transporte + título de propiedad de la carga. *"Sin esto, no hay pasillo"* (como quedó escrito en el whiteboard: contrato, sin esto no hay nada) | Se emite al zarpar, dispara verificación |
| **Invoice** | Proveedor | Precio, qué hay | Reconciliación cruzada (agente `Recon`) |
| **Packing List** | Proveedor | Info detallada de cómo viene empacado | Reconciliación cruzada |
| **Arrival Notice (AN)** | Naviera | Aviso de que el barco llegó a puerto destino | Trigger de cambio de estado a `arrived_at_port` |

**Regla de reconciliación (la que ya identificamos en Kit Pagos y aplica igual aquí):** BL, Invoice y Packing List deben coincidir en contenedor, peso y monto. Cualquier discrepancia = evento `warning` o `critical` según severidad.

---

## 3. Lo nuevo del video que no estaba explícito en nuestro modelo

El video agrega tres pasos entre "arrived at port" y "delivered" que **nuestro estado actual `customs` estaba tratando como una sola caja negra**. En realidad son sub-pasos:

1. **Revalidación del BL con la naviera** — antes de poder hacer cualquier trámite, hay que confirmar que el BL sigue vigente/correcto
2. **"Previo"** — una revisión física de la mercancía ante la operadora portuaria (no la aduana todavía), toma de 1 a 3 horas según el video. Es el paso donde se verifica que lo físico coincide con lo declarado
3. **Pedimento** — el documento fiscal-aduanero que se valida y paga antes del despacho final. El video recomienda usar una "cuenta de gastos" (cuenta puente) para estos pagos

Y el punto más importante para nuestro modelo de datos: **el resultado de la revisión aduanera no es binario "pasó/no pasó" — es un semáforo**:
- 🟢 **Verde** = desaduanamiento libre, no toca revisión física, va directo a destino final
- 🔴 **Rojo** = revisión física obligatoria por la autoridad aduanera

Esto es un dato que hoy **no tenemos modelado explícitamente** en `containers` ni en `events`.

---

## 4. Qué cambia o refina en nuestras entidades actuales

### `containers` — considerar agregar:
- `customs_light` (`'green' | 'red' | null`) — el resultado del semáforo aduanero, es información crítica que el front debería poder mostrar como estado visual
- `previo_completed_at` (timestamp, nullable) — cuándo se completó la revisión física previa

### `events` — el `category` debería poder distinguir:
- `bl_revalidation`
- `previo_scheduled` / `previo_completed`
- `pedimento_validated`
- `customs_light_assigned` (verde/rojo)

Esto nos da granularidad para que el agente `Ari` pueda generar eventos específicos en cada sub-paso, no solo un genérico "en aduana".

### `decisions` — nuevo caso de uso real:
Cuando el semáforo sale **rojo**, ese es un momento de **human-in-the-loop** perfecto para la demo: el agente detecta el resultado, y el humano decide cómo proceder (ej. escalar al agente aduanal, notificar al cliente del retraso esperado). Encaja exactamente con `execution_mode: 'requires_approval'`.

---

## 5. Cómo esto se conecta con Nauta (para no perder el hilo del "para qué")

Lo que vimos de Nauta antes sigue aplicando igual aquí, ahora con más detalle de dónde interviene:

- **"Operational brain"**: la capa canónica (`brain/canonical.model.ts`) es donde unificamos PO + BC + BL + Invoice + Packing List + AN en un solo registro por operación — exactamente lo que Nauta describe como unificar "ERP, TMS, WMS, shipment, document, email" en una capa AI-ready.
- **Agentes con nombre y responsabilidad única**: con este flujo más detallado, tiene sentido que el agente `Ari` no solo monitoree tránsito marítimo, sino que también sepa reconocer los sub-pasos de aduana (revalidación, previo, pedimento, semáforo) como parte de su `flow_step`.
- **"No envían alerta y esperan, actúan"**: cuando sale semáforo verde, el agente debería poder avanzar el `flow_step` a `customs_cleared` automáticamente sin pedir aprobación — solo interviene humano en rojo o en discrepancia documental.
- **Financiero medible**: el video menciona costos de almacenaje/demoras si no se manda documentación 5-7 días antes de la llegada del barco. Esto es una alerta `warning` perfectamente automatizable: si `eta - hoy < 7 días` y faltan documentos, el agente debería generar el evento proactivamente, antes de que se convierta en gasto (esto es literalmente el ángulo de ROI que Nauta usa: "cada alerta se ata a un resultado financiero medible").

---

## 6. Preguntas abiertas para el equipo

- [ ] ¿Modelamos el semáforo verde/rojo como campo en `containers`, o como el último `event` de categoría `customs_light_assigned`? (recomendación: ambos — el campo para query rápida, el evento para historial/timeline)
- [ ] ¿El "previo" (revisión física, 1-3 hrs) amerita su propio `flow_step` en `runs`, o va anidado dentro de `customs`?
- [ ] ¿Vamos a simular la parte de "cuenta de gastos"/pago de pedimento en el prototipo, o queda fuera de alcance del hackathon?

---

## Glosario rápido (para no perderse en la jerga)

- **PO** — Purchase Order, la orden de compra
- **BC** — Booking Confirmation, reserva de espacio en el barco
- **BL** — Bill of Lading, el contrato de transporte y título de propiedad de la carga
- **AN** — Arrival Notice, aviso de llegada a puerto
- **Previo** — revisión física de la mercancía ante la operadora portuaria (antes de aduana)
- **Pedimento** — documento fiscal-aduanero que se valida y paga para el despacho
- **Semáforo (verde/rojo)** — resultado automatizado de la revisión aduanera; verde = libre, rojo = revisión física obligatoria
- **ETA** — tiempo estimado para llegar (como quedó anotado en el whiteboard)
