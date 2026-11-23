-- YECHIM E-Catalog: preserve manufacturer_specs in public RU/UZ product rows.
-- Applied to Supabase on 2026-11-23. This file retains the published database definition for reproducibility.
-- Existing security mode, filtering, and price/stock columns are unchanged.
CREATE OR REPLACE FUNCTION public.get_public_catalog()
 RETURNS TABLE(eman_id text, source_url text, sku text, name text, eman_brand text, brand text, category text, subcategory text, price numeric, currency text, image_url text, description text, specs jsonb, mounting_scheme_url text, additional_images jsonb, badge text, discount_percent integer, sort_order integer, updated_at timestamp with time zone, product_tags text[], is_featured boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.eman_id,
    p.source_url,
    coalesce(nullif(trim(e.yechim_sku), ''), p.sku),
    p.name,
    p.brand as eman_brand,
    coalesce(e.yechim_brand, case when p.eman_group = 'Мебельная подсветка' then 'YECHIM LIGHTING' else upper(p.brand) end) as brand,
    coalesce(e.yechim_category, p.category, p.eman_group) as category,
    e.yechim_subcategory as subcategory,
    p.price,
    p.currency,
    p.image_url,
    concat_ws(E'\\n\\n', nullif(p.extra->>'eman_description', ''), nullif(e.description, '')) as description,
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
             from jsonb_each(e.specs - 'manufacturer_specs') as item)
          when jsonb_typeof(e.specs) = 'array' then e.specs
          else '[]'::jsonb
        end)
        ||
        (case when jsonb_typeof(e.specs->'manufacturer_specs') = 'object'
          then jsonb_build_array(jsonb_build_object('name','manufacturer_specs','value',e.specs->'manufacturer_specs'))
          else '[]'::jsonb end),
      'uz',
        (case
          when jsonb_typeof(e.specs) = 'object' and jsonb_typeof(e.specs->'uz') = 'array' then e.specs->'uz'
          else '[]'::jsonb
        end)
        ||
        (case when jsonb_typeof(e.specs->'manufacturer_specs') = 'object'
          then jsonb_build_array(jsonb_build_object('name','manufacturer_specs','value',e.specs->'manufacturer_specs'))
          else '[]'::jsonb end)
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
$function$
;
