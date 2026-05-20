from data.generator.supabase_client import mgmt_sql
sql = open('infra/supabase/migrations/0005_anon_read.sql', 'r', encoding='utf-8').read()
s, b = mgmt_sql(sql)
print('Apply 0005:', s)
if s >= 300:
    print(b[:500])
else:
    print('OK')

s, b = mgmt_sql("SELECT COUNT(*) AS n FROM proveedores;")
print('proveedores:', b)
s, b = mgmt_sql("SELECT COUNT(*) AS n FROM compradores;")
print('compradores:', b)
