# Lambda — Factoring Signals Engine inference

Container image que aloja XGBoost + SHAP detrás de una API REST (FastAPI + Mangum).

## Endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/health` | Keep-warm + info de la version del modelo |
| POST | `/score` | Score por `relacion_id` o `factura_id` |
| POST | `/score-and-emit` | Score + INSERT automático a `signals` (target del webhook) |
| POST | `/score-batch` | Score múltiples leads en una sola llamada |

## Local test

```bash
cd lambda
pip install -r requirements.txt
# Necesita .env cargado en el entorno
python -c "from app.handler import app; import uvicorn; uvicorn.run(app, port=8000)"

# Test:
curl http://localhost:8000/health
curl -X POST http://localhost:8000/score -H "content-type: application/json" \
  -d '{"relacion_id": "<uuid>"}'
```

## Deploy

Automatizado via GitHub Actions cuando se hace push a `main` que toque `lambda/**`:

1. Build container (Dockerfile)
2. Push a ECR (`edm-lambda-factoring`)
3. Create/update Lambda function (`edm-factoring-scorer`)
4. Create/update Function URL público

### GitHub Secrets requeridos

| Secret | Valor |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | de `.env` AWS user |
| `AWS_SECRET_ACCESS_KEY` | de `.env` AWS user |
| `SUPABASE_URL` | `https://wicnndedakeuvxkzmelz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | de `.env` |

Configurar en: `https://github.com/frincones/EDM/settings/secrets/actions`

## Costo demo

- 1 Lambda function (always-free hasta 1M req/mes)
- 1 ECR repo (500 MB free)
- Total: $0
