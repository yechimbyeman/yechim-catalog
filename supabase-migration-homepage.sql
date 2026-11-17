-- YECHIM E-Catalog update + homepage banners, featured products and product labels
-- Run this once in Supabase SQL Editor before deploying the updated frontend.

alter table public.yechim_enrichment
  add column if not exists yechim_sku text;

alter table public.yechim_enrichment
  add column if not exists discount_percent integer not null default 0;

alter table public.yechim_enrichment
  add column if not exists product_tags text[] not null default '{}';

alter table public.yechim_enrichment
  add column if not exists is_featured boolean not null default false;

create table if not exists public.yechim_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  subtitle text not null default '',
  button_text text not null default '',
  link_url text not null default '?catalog=1',
  image_url text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.yechim_banners enable row level security;
drop policy if exists "Public can view active YECHIM banners" on public.yechim_banners;
create policy "Public can view active YECHIM banners" on public.yechim_banners for select to anon, authenticated using (active = true);
drop policy if exists "Authenticated team can manage YECHIM banners" on public.yechim_banners;
create policy "Authenticated team can manage YECHIM banners" on public.yechim_banners for all to authenticated using (true) with check (true);

-- New enrichment rows created by the sync are visible by default.
alter table public.yechim_enrichment alter column published set default true;

alter table public.yechim_enrichment
  drop constraint if exists yechim_enrichment_discount_percent_check;
alter table public.yechim_enrichment
  add constraint yechim_enrichment_discount_percent_check
  check (discount_percent between 0 and 99);

-- Existing products are published by default. Products added by later syncs are
-- also visible unless explicitly disabled in the YECHIM dashboard.
update public.yechim_enrichment set published = true where published = false;

drop function if exists public.get_public_catalog();

create function public.get_public_catalog()
returns table (
  eman_id text, source_url text, sku text, name text, eman_brand text, brand text, category text,
  subcategory text, price numeric, currency text, image_url text, description text, specs jsonb,
  mounting_scheme_url text, additional_images jsonb, badge text, discount_percent integer, sort_order integer, updated_at timestamptz, product_tags text[], is_featured boolean
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
    e.updated_at,
    coalesce(e.product_tags, '{}'::text[]),
    coalesce(e.is_featured, false)
  from public.eman_products p
  left join public.yechim_enrichment e on e.eman_id = p.eman_id
  where coalesce(e.published, true) = true
  order by coalesce(e.sort_order, 0) asc, p.name asc
$$;

revoke all on function public.get_public_catalog() from public;
grant execute on function public.get_public_catalog() to anon, authenticated;
