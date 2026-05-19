# EDM Demo — Factoring Signals Engine

> Demo de motor ML para identificar **cuándo** ofrecer factoring a cada proveedor en el ecosistema EDN (Bancolombia × Oregon Interfactura).

## El problema

EDN llama hoy a sus ~5.000 proveedores en modo "spray and pray" con ~10% de conversión. El motor de crédito de Bancolombia ya resuelve **quién** necesita factoring estructuralmente — pero nadie resuelve **cuándo** específicamente lo necesita. Esa es la oportunidad: usar el flujo documental (OC → factura → aceptación) para detectar señales de timing.

## Arquitectura

```
[Generador sintético]  ──POST──►  [Supabase Edge /ingest]
                                          │
                                          ▼
                              [Supabase Postgres]
                                ┌────────────────┐
                                │ Raw + Curated  │
                                │ + Features SQL │
                                └────────┬───────┘
                                         │ DB Webhook on INSERT factura
                                         ▼
                              [AWS Lambda /score]
                                XGBoost + SHAP
                                model.pkl de S3
                                         │
                                         ▼
                              [Supabase signals]
                                         │ Realtime
                                         ▼
                              [Vercel Next.js Dashboard]
```

- **Supabase Postgres** — data lake + feature store + auth + realtime
- **AWS Lambda (container)** — inferencia ML (XGBoost + SHAP)
- **AWS S3** — almacenamiento del modelo entrenado
- **Vercel Next.js** — dashboard frontend
- **Google Colab / local Python** — training offline

## Los 5 arquetipos (fiel a Felipe)

Basados en las 4 señales que Felipe identifica + el contrapuesto negativo:

1. **Estable** (60%) — sin señal, negativo
2. **Incremento de ventas** (12%) — vende más de lo histórico a un comprador
3. **Plazos comprimidos** (10%) — vencimientos pasan de 30 → 15 días
4. **Ciclicidad agrícola** (9%) — pico de cosecha (arrocero)
5. **Ciclicidad comercio Q4** (9%) — octubre-diciembre

## Estructura del repo

```
edm-demo/
├── infra/            # Setup AWS + Supabase (SQL, Edge Functions, CI/CD)
├── data/             # Generador de data sintética (Python + Faker)
├── ml/               # Notebook training (XGBoost + SHAP)
├── lambda/           # Container inferencia (FastAPI + Mangum)
├── web/              # Next.js dashboard (Tailwind + shadcn/ui)
├── demo/             # Replay script + guión de presentación
└── Transcripciones/  # Transcripciones llamadas con EDN
```

## Setup local

```powershell
# 1. Cargar variables de entorno
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

# 2. Dependencias Python (data + ml)
pip install -r data/requirements.txt
pip install -r ml/requirements.txt

# 3. Dependencias Node (web)
cd web && npm install

# 4. Generar data sintética
python data/generator/main.py

# 5. Cargar a Supabase via /ingest
python data/generator/backfill.py
```

## Deploy

| Componente | Comando |
|------------|---------|
| Supabase schema | `python infra/supabase/apply_migrations.py` |
| Edge Function | API de management (script en `infra/supabase/`) |
| Lambda | Push a `main` → GitHub Actions construye y deploya |
| Frontend | `cd web && vercel --prod --token=$env:VERCEL_TOKEN` |

## Demo (presentación)

Ver [`demo/guion.md`](demo/guion.md) para el guión de los 20 minutos.

Replay en vivo: `python demo/replay.py`

## Stack

| Capa | Tecnología | Costo demo |
|------|-----------|------------|
| Database + Auth + Realtime | Supabase | $0 (free tier) |
| ML Inference | AWS Lambda container | $0 (1M req/mes free) |
| Model storage | AWS S3 | $0 (5GB free) |
| Frontend | Next.js 15 + Vercel | $0 (Hobby) |
| Training | Google Colab / local | $0 |
| ML Library | XGBoost + SHAP | $0 (OSS) |
| **Total demo** | | **$0** |
