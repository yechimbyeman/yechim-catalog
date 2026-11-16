-- YECHIM Catalog / Supabase production schema
create extension if not exists pgcrypto;

create table if not exists public.eman_products (
  eman_id text primary key,
  source_url text not null,
  sku text,
  name text not null,
  brand text not null,
  eman_group text,
  category text,
  price numeric,
  currency text default 'UZS',
  image_url text,
  extra jsonb default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists public.yechim_enrichment (
  eman_id text primary key references public.eman_products(eman_id) on delete cascade,
  published boolean not null default true,
  yechim_sku text,
  yechim_brand text,
  yechim_category text,
  yechim_subcategory text,
  description text,
  specs jsonb not null default '{}'::jsonb,
  mounting_scheme_url text,
  additional_images jsonb not null default '[]'::jsonb,
  badge text,
  discount_percent integer not null default 0 check (discount_percent between 0 and 99),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_eman_products_brand on public.eman_products(brand);
create index if not exists idx_eman_products_category on public.eman_products(category);
create index if not exists idx_eman_products_sku on public.eman_products(sku);
create index if not exists idx_enrichment_published on public.yechim_enrichment(published);

create or replace function public.touch_enrichment_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end; $$;

drop trigger if exists trg_touch_enrichment on public.yechim_enrichment;
create trigger trg_touch_enrichment
before update on public.yechim_enrichment
for each row execute function public.touch_enrichment_updated_at();

-- Client-facing function. Only explicitly published YECHIM products are returned to anonymous users.
create or replace function public.get_public_catalog()
returns table (
  eman_id text, source_url text, sku text, name text, eman_brand text, brand text, category text,
  subcategory text, price numeric, currency text, image_url text, description text, specs jsonb,
  mounting_scheme_url text, additional_images jsonb, badge text, discount_percent integer, sort_order integer, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.eman_id,
    p.source_url,
    coalesce(e.yechim_sku, p.sku),
    p.name,
    p.brand as eman_brand,
    coalesce(e.yechim_brand, case when p.eman_group = 'Мебельная подсветка' then 'YECHIM LIGHTING' else upper(p.brand) end) as brand,
    coalesce(e.yechim_category, p.category, p.eman_group) as category,
    e.yechim_subcategory as subcategory,
    p.price,
    p.currency,
    p.image_url,
    concat_ws(E'\n\n', nullif(p.extra->>'eman_description', ''), nullif(e.description, '')) as description,
    jsonb_build_object(
      'ru',
        (case
          when jsonb_typeof(p.extra->'eman_specs') = 'array' then p.extra->'eman_specs'
          else '[]'::jsonb
        end)
        ||
        (case
          when jsonb_typeof(e.specs) = 'object' and jsonb_typeof(e.specs->'ru') = 'array' then e.specs->'ru'
          when jsonb_typeof(e.specs) = 'object' and jsonb_typeof(e.specs->'ru') = 'object' then
            (select coalesce(jsonb_agg(jsonb_build_object('name', item.key, 'value', item.value)), '[]'::jsonb)
             from jsonb_each(e.specs->'ru') as item)
          when jsonb_typeof(e.specs) = 'object' and not (e.specs ? 'ru') and not (e.specs ? 'uz') then
            (select coalesce(jsonb_agg(jsonb_build_object('name', item.key, 'value', item.value)), '[]'::jsonb)
             from jsonb_each(e.specs) as item)
          when jsonb_typeof(e.specs) = 'array' then e.specs
          else '[]'::jsonb
        end),
      'uz',
        case
          when jsonb_typeof(e.specs) = 'object' and jsonb_typeof(e.specs->'uz') = 'array' then e.specs->'uz'
          else '[]'::jsonb
        end
    ) as specs,
    e.mounting_scheme_url,
    e.additional_images,
    e.badge,
    coalesce(e.discount_percent, 0) as discount_percent,
    e.sort_order,
    e.updated_at
  from public.eman_products p
  join public.yechim_enrichment e on e.eman_id = p.eman_id
  where e.published = true
  order by e.sort_order asc, p.name asc
$$;

revoke all on function public.get_public_catalog() from public;
grant execute on function public.get_public_catalog() to anon, authenticated;

-- RLS: authenticated dashboard users can manage enrichment; base Eman data is read-only there.
alter table public.eman_products enable row level security;
alter table public.yechim_enrichment enable row level security;

drop policy if exists "authenticated read eman products" on public.eman_products;
create policy "authenticated read eman products"
on public.eman_products for select
to authenticated using (true);

drop policy if exists "authenticated read enrichment" on public.yechim_enrichment;
create policy "authenticated read enrichment"
on public.yechim_enrichment for select
using (auth.role() = 'authenticated');

drop policy if exists "authenticated insert enrichment" on public.yechim_enrichment;
create policy "authenticated insert enrichment"
on public.yechim_enrichment for insert
to authenticated with check (true);

drop policy if exists "authenticated update enrichment" on public.yechim_enrichment;
create policy "authenticated update enrichment"
on public.yechim_enrichment for update
to authenticated using (true) with check (true);

drop policy if exists "authenticated delete enrichment" on public.yechim_enrichment;
create policy "authenticated delete enrichment"
on public.yechim_enrichment for delete
to authenticated using (true);

-- The view needs read access for the public client.
grant select on public.public_catalog to anon, authenticated;
revoke all on public.eman_products from anon;
revoke all on public.yechim_enrichment from anon;

-- Storage bucket for YECHIM-only images and mounting schemes.
insert into storage.buckets (id, name, public)
values ('yechim-assets', 'yechim-assets', true)
on conflict (id) do update set public = true;

-- Public can read assets; authenticated dashboard users can manage them.
drop policy if exists "public read yechim assets" on storage.objects;
create policy "public read yechim assets"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'yechim-assets');

drop policy if exists "authenticated upload yechim assets" on storage.objects;
create policy "authenticated upload yechim assets"
on storage.objects for insert
 to authenticated with check (bucket_id = 'yechim-assets');

drop policy if exists "authenticated update yechim assets" on storage.objects;
create policy "authenticated update yechim assets"
on storage.objects for update
 to authenticated using (bucket_id = 'yechim-assets') with check (bucket_id = 'yechim-assets');

drop policy if exists "authenticated delete yechim assets" on storage.objects;
create policy "authenticated delete yechim assets"
on storage.objects for delete
 to authenticated using (bucket_id = 'yechim-assets');

-- Optional: lock down public schema functions by default in production.
