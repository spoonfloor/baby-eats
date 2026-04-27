-- Household menu: stepper quantities (0 = not on menu; rows removed when off menu from client).
CREATE TABLE public.menu_plan_recipe (
  recipe_id bigint PRIMARY KEY REFERENCES public.recipes (id) ON DELETE CASCADE,
  qty smallint NOT NULL DEFAULT 0 CHECK (qty >= 0 AND qty <= 99),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Modal-only overrides to plan qty (sparse; delete row = no override).
CREATE TABLE public.menu_modal_override (
  recipe_id bigint PRIMARY KEY REFERENCES public.recipes (id) ON DELETE CASCADE,
  override_qty smallint NOT NULL CHECK (override_qty > 0 AND override_qty <= 99),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX menu_plan_recipe_updated_at_idx ON public.menu_plan_recipe (updated_at DESC);
CREATE INDEX menu_modal_override_updated_at_idx ON public.menu_modal_override (updated_at DESC);

ALTER TABLE public.menu_plan_recipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_modal_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_menu_plan_recipe"
  ON public.menu_plan_recipe FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_menu_modal_override"
  ON public.menu_modal_override FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);
