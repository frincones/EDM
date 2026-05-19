"""Validacion del backfill: cuentas, distribuciones, heroes."""
from data.generator.supabase_client import mgmt_sql


QUERIES = [
    ("Distribucion outcomes factoring", """
        SELECT outcome, COUNT(*) as n
        FROM outcomes_factoring
        GROUP BY outcome ORDER BY n DESC;
    """),
    ("Arquetipo vs outcomes aceptados", """
        SELECT p.arquetipo,
          COUNT(DISTINCT p.id) as n_proveedores,
          COUNT(o.id) as n_ofertas,
          SUM(CASE WHEN o.outcome='aceptada' THEN 1 ELSE 0 END) as n_aceptadas,
          ROUND(100.0 * SUM(CASE WHEN o.outcome='aceptada' THEN 1.0 ELSE 0 END) / NULLIF(COUNT(o.id),0), 1) as pct_acept
        FROM proveedores p
        LEFT JOIN outcomes_factoring o ON o.proveedor_id = p.id
        GROUP BY p.arquetipo ORDER BY p.arquetipo;
    """),
    ("Heroes curados", """
        SELECT razon_social, arquetipo, sector_nombre, ciudad
        FROM proveedores WHERE arquetipo_visible = true
        ORDER BY arquetipo;
    """),
    ("Stats agregadas facturas", """
        SELECT
          ROUND(AVG(monto_bruto_centavos)/100.0/1e6, 1) as monto_avg_millones,
          ROUND(AVG(dias_plazo), 1) as plazo_avg,
          COUNT(*) as n_facturas
        FROM facturas;
    """),
    ("Features_par sample", """
        SELECT
          ROUND(ticket_avg_30d/1e8, 2) as ticket_avg_M,
          ROUND(delta_facturacion_30v90, 2) as delta_30v90,
          ROUND(delta_facturacion_30v180, 2) as delta_30v180,
          ROUND(plazo_avg_30d, 1) as plazo_30d,
          ROUND(delta_plazo_30v180, 1) as delta_plazo,
          mes_actual, is_q4, is_pico_cosecha_agro
        FROM features_par f
        JOIN proveedores p ON p.id = f.proveedor_id
        WHERE p.arquetipo_visible = true
        LIMIT 10;
    """),
]


for title, sql in QUERIES:
    print(f"\n== {title} ==")
    status, body = mgmt_sql(sql)
    print(body)
