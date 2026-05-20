"""Apply migration 0004 and test helper functions."""
from data.generator.supabase_client import mgmt_sql
import sys
import json

sql = open('infra/supabase/migrations/0004_helpers.sql', 'r', encoding='utf-8').read()
s, b = mgmt_sql(sql)
print(f'Apply status: {s}')
if s >= 300:
    print(b[:1500])
    sys.exit(1)
print('Migration applied OK')

print('\n== system_counts() ==')
s, b = mgmt_sql("SELECT system_counts() AS data;")
print(b[:600])

print('\n== archetype_distribution() ==')
s, b = mgmt_sql("SELECT * FROM archetype_distribution();")
print(b[:500])

print('\n== score_distribution(10) ==')
s, b = mgmt_sql("SELECT * FROM score_distribution(10);")
print(b[:500])

print('\n== sector_baseline for Arrocera =\=')
s, b = mgmt_sql("""SELECT * FROM sector_baseline((SELECT id FROM proveedores WHERE razon_social ILIKE '%Arrocera del Tolima%' LIMIT 1));""")
print(b[:400])

print('\n== top_facturas_para_lead Arrocera ==')
s, b = mgmt_sql("""SELECT * FROM top_facturas_para_lead((SELECT id FROM relaciones WHERE proveedor_id = (SELECT id FROM proveedores WHERE razon_social ILIKE '%Arrocera del Tolima%' LIMIT 1) LIMIT 1), 3);""")
print(b[:600])
