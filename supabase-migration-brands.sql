-- YECHIM managed brands: run once in Supabase SQL Editor.
create table if not exists public.yechim_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_url text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.yechim_brands enable row level security;
drop policy if exists "Public can view active YECHIM brands" on public.yechim_brands;
create policy "Public can view active YECHIM brands" on public.yechim_brands for select to anon, authenticated using (active = true);
drop policy if exists "Authenticated team can manage YECHIM brands" on public.yechim_brands;
create policy "Authenticated team can manage YECHIM brands" on public.yechim_brands for all to authenticated using (true) with check (true);
grant select on public.yechim_brands to anon, authenticated;
grant insert, update, delete on public.yechim_brands to authenticated;
insert into public.yechim_brands (name,image_url,active,sort_order) values
('STARAX','./assets/brands/STARAX.png',true,1),
('SAMET','./assets/brands/SAMET.png',true,2),
('CEBI','./assets/brands/CEBI.png',true,3),
('MESAN','./assets/brands/MESAN.png',true,4),
('YECHIM LIGHTING','./assets/brands/YECHIM LIGHTING.png',true,5)
on conflict (name) do nothing;
