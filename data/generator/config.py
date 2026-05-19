"""
Configuracion del generador de data sintetica.

Los arquetipos son FIELES a las 4 senales que Felipe identifica en la transcripcion:
1. Incremento de ventas
2. Plazos comprimidos
3. Ciclicidad agricola (arrocero en cosecha)
4. Ciclicidad comercio Q4
+ Estable como negativo
"""
from __future__ import annotations
from datetime import date, timedelta
from dataclasses import dataclass

# =============================================================================
# Universo del demo
# =============================================================================

SEED = 42
N_PROVEEDORES = 65
HISTORIA_MESES = 18

HOY = date(2026, 5, 19)  # Fecha "actual" del demo
INICIO_HISTORIA = date(HOY.year - 1, HOY.month, 1) - timedelta(days=30 * 6)

# =============================================================================
# Distribucion de arquetipos (fiel a Felipe)
# =============================================================================

DISTRIBUCION_ARQUETIPOS = {
    "estable":                  0.60,   # negativo (contrapartida necesaria)
    "incremento_ventas":        0.12,   # Senal 1 de Felipe
    "plazos_comprimidos":       0.10,   # Senal 2 de Felipe
    "ciclicidad_agricola":      0.09,   # Senal 3 de Felipe (arrocero/cosecha)
    "ciclicidad_comercio_q4":   0.09,   # Senal 4 de Felipe (Q4)
}

# =============================================================================
# Compradores ficticios (5)
# =============================================================================

COMPRADORES = [
    {
        "nit": "900123456-7",
        "razon_social": "Sodecorp Servicios S.A.S.",  # estilo Sodexo, servicios alimentarios
        "sector_ciiu": "5613",
        "plazo_promedio_proveedores": 60,
        "estacionalidad_q4": 0.65,
        "tasa_aceptacion_facturas": 0.92,
    },
    {
        "nit": "900234567-8",
        "razon_social": "Acemport Retail Colombia S.A.",  # estilo ACER, retail
        "sector_ciiu": "4759",
        "plazo_promedio_proveedores": 30,
        "estacionalidad_q4": 0.80,
        "tasa_aceptacion_facturas": 0.88,
    },
    {
        "nit": "900345678-9",
        "razon_social": "Constructora Andina del Centro S.A.",
        "sector_ciiu": "4290",
        "plazo_promedio_proveedores": 45,
        "estacionalidad_q4": 0.30,
        "tasa_aceptacion_facturas": 0.85,
    },
    {
        "nit": "900456789-0",
        "razon_social": "Industrias Manufactureras del Valle S.A.",
        "sector_ciiu": "1090",
        "plazo_promedio_proveedores": 45,
        "estacionalidad_q4": 0.40,
        "tasa_aceptacion_facturas": 0.90,
    },
    {
        "nit": "900567890-1",
        "razon_social": "Distribuidora Nacional de Insumos Ltda.",
        "sector_ciiu": "4641",
        "plazo_promedio_proveedores": 30,
        "estacionalidad_q4": 0.45,
        "tasa_aceptacion_facturas": 0.87,
    },
]

# =============================================================================
# Sectores CIIU posibles para proveedores con probabilidades
# =============================================================================

SECTORES_CIIU = {
    "estable": [
        ("4711", "Comercio al por menor, supermercados", 0.12),
        ("4641", "Mayorista de textiles", 0.10),
        ("1090", "Manufactura alimentos", 0.10),
        ("1820", "Imprentas y servicios graficos", 0.08),
        ("5611", "Restaurantes", 0.08),
        ("4290", "Construccion obras civiles", 0.07),
        ("2599", "Manufactura productos metalicos", 0.07),
        ("4711", "Comercio al por menor", 0.06),
        ("6201", "Desarrollo de software", 0.06),
        ("5630", "Bares", 0.05),
        ("9602", "Peluquerias", 0.05),
        ("4651", "Mayorista equipos computo", 0.05),
        ("7022", "Consultoria gestion", 0.05),
        ("4399", "Servicios construccion", 0.06),
    ],
    "incremento_ventas": [
        ("4759", "Comercio articulos hogar", 0.20),
        ("4641", "Mayorista de textiles", 0.15),
        ("4711", "Comercio retail", 0.15),
        ("1410", "Confeccion ropa", 0.15),
        ("1090", "Alimentos", 0.10),
        ("5611", "Restaurantes", 0.10),
        ("4651", "Mayorista equipos", 0.15),
    ],
    "plazos_comprimidos": [
        ("4290", "Construccion", 0.25),
        ("2599", "Manufactura metalica", 0.20),
        ("4641", "Mayorista textiles", 0.15),
        ("1090", "Alimentos", 0.15),
        ("4399", "Servicios construccion", 0.15),
        ("4651", "Mayorista equipos", 0.10),
    ],
    "ciclicidad_agricola": [
        ("0119", "Cultivo de arroz", 0.50),
        ("0111", "Cereales", 0.20),
        ("0113", "Hortalizas", 0.15),
        ("0125", "Frutales", 0.10),
        ("0163", "Apoyo agropecuario", 0.05),
    ],
    "ciclicidad_comercio_q4": [
        ("4759", "Comercio articulos hogar", 0.25),
        ("4711", "Comercio retail", 0.20),
        ("4641", "Mayorista textiles", 0.15),
        ("4753", "Comercio juguetes y deportes", 0.15),
        ("4773", "Cosmeticos", 0.10),
        ("1410", "Confeccion ropa", 0.15),
    ],
}

# =============================================================================
# Parametros por arquetipo (distribuciones de monto, frecuencia, plazo)
# =============================================================================

@dataclass
class ArquetipoParams:
    monto_base_log_mean: float       # mediana de monto en escala log (en COP)
    monto_log_sigma: float            # dispersion log-normal
    frecuencia_facturas_mes: float    # media de facturas/mes (Poisson)
    plazo_base_dias: float            # plazo tipico
    plazo_sigma_dias: float
    prob_outcome_aceptado: float      # P(outcome=aceptada | hay oferta)
    prob_oferta_factoring: float      # P(hubo oferta historica)
    inyectar_senal: bool              # si activar la senal especifica

ARQUETIPO_PARAMS = {
    "estable": ArquetipoParams(
        monto_base_log_mean=15.8,    # ~$7M COP mediana
        monto_log_sigma=0.5,
        frecuencia_facturas_mes=4.0,
        plazo_base_dias=30,
        plazo_sigma_dias=2,
        prob_outcome_aceptado=0.08,  # raramente acepta (no necesita)
        prob_oferta_factoring=0.10,
        inyectar_senal=False,
    ),
    "incremento_ventas": ArquetipoParams(
        monto_base_log_mean=15.5,
        monto_log_sigma=0.45,
        frecuencia_facturas_mes=5.0,
        plazo_base_dias=30,
        plazo_sigma_dias=3,
        prob_outcome_aceptado=0.40,  # alta propensity
        prob_oferta_factoring=0.55,
        inyectar_senal=True,
    ),
    "plazos_comprimidos": ArquetipoParams(
        monto_base_log_mean=16.0,
        monto_log_sigma=0.5,
        frecuencia_facturas_mes=3.5,
        plazo_base_dias=30,
        plazo_sigma_dias=2,
        prob_outcome_aceptado=0.45,
        prob_oferta_factoring=0.60,
        inyectar_senal=True,
    ),
    "ciclicidad_agricola": ArquetipoParams(
        monto_base_log_mean=16.2,
        monto_log_sigma=0.6,
        frecuencia_facturas_mes=3.0,
        plazo_base_dias=45,
        plazo_sigma_dias=4,
        prob_outcome_aceptado=0.50,
        prob_oferta_factoring=0.65,
        inyectar_senal=True,
    ),
    "ciclicidad_comercio_q4": ArquetipoParams(
        monto_base_log_mean=15.7,
        monto_log_sigma=0.55,
        frecuencia_facturas_mes=4.5,
        plazo_base_dias=30,
        plazo_sigma_dias=3,
        prob_outcome_aceptado=0.42,
        prob_oferta_factoring=0.55,
        inyectar_senal=True,
    ),
}

# =============================================================================
# Hero providers (curados para la demo)
# =============================================================================

HEROES = [
    {
        "external_handle": "HERO_LLANO",
        "razon_social": "Distribuidora El Llano S.A.S.",
        "arquetipo": "incremento_ventas",
        "sector_ciiu": "4641",
        "sector_nombre": "Mayorista de textiles",
        "tamano": "pequena",
        "ciudad": "Bogota",
        "comprador_nit": "900123456-7",  # Sodecorp
        "narrative": "+47% facturacion en 60 dias vendiendo a Sodecorp",
    },
    {
        "external_handle": "HERO_ANDES",
        "razon_social": "Comercializadora Andes S.A.",
        "arquetipo": "plazos_comprimidos",
        "sector_ciiu": "4290",
        "sector_nombre": "Construccion obras civiles",
        "tamano": "mediana",
        "ciudad": "Medellin",
        "comprador_nit": "900234567-8",  # Acemport
        "narrative": "Plazos pasaron de 30 a 15 dias en ultimas 6 facturas",
    },
    {
        "external_handle": "HERO_TOLIMA",
        "razon_social": "Arrocera del Tolima Ltda.",
        "arquetipo": "ciclicidad_agricola",
        "sector_ciiu": "0119",
        "sector_nombre": "Cultivo de arroz",
        "tamano": "mediana",
        "ciudad": "Ibague",
        "comprador_nit": "900123456-7",  # Sodecorp
        "narrative": "Pico de cosecha actual (Mayo-Junio arroz Tolima)",
    },
    {
        "external_handle": "HERO_TEXTIL",
        "razon_social": "Textiles Bogota S.A.",
        "arquetipo": "ciclicidad_comercio_q4",
        "sector_ciiu": "1410",
        "sector_nombre": "Confeccion de ropa",
        "tamano": "mediana",
        "ciudad": "Bogota",
        "comprador_nit": "900234567-8",  # Acemport (retail)
        "narrative": "Inicio de temporada alta Q4 confecciones",
    },
    {
        "external_handle": "HERO_ESTABLE",
        "razon_social": "Industrias Estables S.A.",
        "arquetipo": "estable",
        "sector_ciiu": "1820",
        "sector_nombre": "Imprenta y servicios graficos",
        "tamano": "mediana",
        "ciudad": "Cali",
        "comprador_nit": "900123456-7",
        "narrative": "Negativo claro: 18 meses planos, sin senales",
    },
]
