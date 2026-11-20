-- 038: recipe_hpp hanya untuk dipanggil fungsi definer internal (record_sale, produce_recipe, dst).
-- Sebelumnya EXECUTE dari PUBLIC/anon/authenticated: staff (dan anon) bisa baca HPP via rpc/recipe_hpp.
revoke execute on function public.recipe_hpp(uuid, uuid, integer) from public, anon, authenticated, staff;
