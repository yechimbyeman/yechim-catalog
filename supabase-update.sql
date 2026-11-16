-- YECHIM E-Catalog update: discount percentage support
-- Run this once in Supabase SQL Editor before deploying the updated frontend.

alter table public.yechim_enrichment
  add column if not exists yechim_sku text;

alter table public.yechim_enrichment
  add column if not exists discount_percent integer not null default 0;

alter table public.yechim_enrichment
  drop constraint if exists yechim_enrichment_discount_percent_check;
alter table public.yechim_enrichment
  add constraint yechim_enrichment_discount_percent_check
  check (discount_percent between 0 and 99);

drop function if exists public.get_public_catalog();

create function public.get_public_catalog()
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
