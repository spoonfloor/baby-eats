-- Match recipe stepper / modal fractional servings (e.g. 0.25 steps).
ALTER TABLE public.menu_plan_recipe
  DROP CONSTRAINT IF EXISTS menu_plan_recipe_qty_check;

ALTER TABLE public.menu_modal_override
  DROP CONSTRAINT IF EXISTS menu_modal_override_override_qty_check;

ALTER TABLE public.menu_plan_recipe
  ALTER COLUMN qty TYPE numeric(10, 4) USING qty::numeric(10, 4),
  ADD CONSTRAINT menu_plan_recipe_qty_range CHECK (qty >= 0::numeric AND qty <= 99::numeric);

ALTER TABLE public.menu_modal_override
  ALTER COLUMN override_qty TYPE numeric(10, 4) USING override_qty::numeric(10, 4),
  ADD CONSTRAINT menu_modal_override_qty_range CHECK (override_qty > 0::numeric AND override_qty <= 99::numeric);
