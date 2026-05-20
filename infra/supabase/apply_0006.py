from data.generator.supabase_client import mgmt_sql
sql = open('infra/supabase/migrations/0006_feed_montos.sql', 'r', encoding='utf-8').read()
s, b = mgmt_sql(sql)
print('Apply 0006:', s)
if s >= 300: print(b[:500])
else: print('OK')

# Verify
s, b = mgmt_sql("SELECT signal_id, proveedor_nombre, score, monto_potencial_centavos, factura_monto_neto_centavos FROM v_top_leads LIMIT 3;")
print('\nv_top_leads sample:')
print(b[:1500])
