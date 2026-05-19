"""
Generacion de NITs colombianos validos con digito de verificacion.

Algoritmo oficial DIAN:
  - Pesos: 71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3
  - Sumar producto base * peso (de derecha a izquierda)
  - mod 11, si >= 2 -> 11 - mod, sino -> mod
"""
from __future__ import annotations
import random


PESOS = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3]


def digito_verificacion(nit_base: str) -> int:
    """Calcula el DV oficial para un NIT base (sin DV)."""
    base = nit_base.zfill(15)
    suma = sum(int(d) * p for d, p in zip(base, PESOS))
    mod = suma % 11
    if mod >= 2:
        return 11 - mod
    return mod


def generar_nit(rng: random.Random) -> str:
    """Genera un NIT colombiano valido con DV."""
    base = rng.randint(800_000_000, 999_999_999)  # rango NITs juridicos comunes
    dv = digito_verificacion(str(base))
    return f"{base}-{dv}"


def validar_nit(nit_con_dv: str) -> bool:
    """Verifica si un NIT en formato XXX-Y es valido."""
    try:
        base, dv = nit_con_dv.split("-")
        return digito_verificacion(base) == int(dv)
    except (ValueError, AttributeError):
        return False


if __name__ == "__main__":
    rng = random.Random(42)
    for _ in range(5):
        nit = generar_nit(rng)
        print(nit, validar_nit(nit))
