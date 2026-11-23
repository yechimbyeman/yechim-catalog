-- YECHIM E-Catalog / 2026-11-23
-- Protect imported manufacturer characteristics if a future catalog refresh
-- accidentally sends empty specs or omits manufacturer_specs.
-- Intentional updates to the actual manufacturer_specs object are still allowed.
CREATE OR REPLACE FUNCTION public.yechim_preserve_manufacturer_specs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  IF jsonb_typeof(OLD.specs->'manufacturer_specs') = 'object'
     AND (NEW.specs IS NULL
          OR NOT (NEW.specs ? 'manufacturer_specs')
          OR NEW.specs->'manufacturer_specs' = '{}'::jsonb)
  THEN
    NEW.specs := jsonb_set(
      COALESCE(NEW.specs, '{}'::jsonb),
      '{manufacturer_specs}',
      OLD.specs->'manufacturer_specs',
      true
    );
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS yechim_preserve_manufacturer_specs_on_update ON public.yechim_enrichment;
CREATE TRIGGER yechim_preserve_manufacturer_specs_on_update
BEFORE UPDATE OF specs ON public.yechim_enrichment
FOR EACH ROW
EXECUTE FUNCTION public.yechim_preserve_manufacturer_specs();
