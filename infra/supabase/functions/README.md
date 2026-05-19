# Supabase Edge Functions

## `/ingest`

Endpoint único de entrada para eventos del ecosistema EDN.

### En producción

EDN configura un **outbox pattern** en su core (Postgres) y un dispatcher que postea
cada evento a este endpoint con firma HMAC en el header `X-EDN-Signature`.

### En el demo

El script `data/generator/backfill_via_ingest.py` actúa como ese dispatcher,
enviando los ~15K eventos sintéticos al mismo endpoint. La lógica que ejecuta es idéntica.

### Deploy

```bash
# Vía Supabase CLI (si está instalado)
supabase functions deploy ingest --project-ref wicnndedakeuvxkzmelz

# O via Management API (POST multipart al endpoint de funciones)
python infra/supabase/deploy_functions.py
```

### Test manual

```powershell
$body = @{
  event_id = (New-Guid).Guid
  event_type = "factura_emitida"
  payload = @{
    external_id = "TEST-001"
    relacion_id = "<uuid>"
    proveedor_id = "<uuid>"
    comprador_id = "<uuid>"
    monto_bruto_centavos = 1000000000
    impuestos_centavos = 190000000
    monto_neto_centavos = 1190000000
    fecha_emision = "2026-05-19"
    fecha_vencimiento = "2026-06-18"
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "$env:NEXT_PUBLIC_SUPABASE_URL/functions/v1/ingest" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY" } `
  -ContentType "application/json" `
  -Body $body
```
