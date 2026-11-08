-- 032: record_sale/update_sale_record simpan hpp_at_sale PER UNIT (format lama; dashboard & laporan mengalikan qty).
-- 029 keliru menyimpan total (v_hpp_unit * v_qty). Belum ada data tercatat via RPC ini.
do $$
declare f regprocedure; d text;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname in ('record_sale','update_sale_record')
  loop
    d := pg_get_functiondef(f);
    if strpos(d, 'v_hpp_unit * v_qty, 0') > 0 then
      execute replace(d, 'v_hpp_unit * v_qty, 0', 'v_hpp_unit, 0');
    end if;
  end loop;
end $$;

-- cek: harus 0
select count(*) as sisa_total from pg_proc
 where pronamespace = 'public'::regnamespace and strpos(pg_get_functiondef(oid), 'v_hpp_unit * v_qty, 0') > 0;
