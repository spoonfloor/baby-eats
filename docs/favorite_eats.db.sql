BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "favorite_eats" (
	"field1"	TEXT,
	"field2"	TEXT
);
CREATE TABLE IF NOT EXISTS "ingredient_synonyms" (
	"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
	"ingredient_id"	INTEGER NOT NULL REFERENCES "ingredients"("ID"),
	"synonym"	TEXT NOT NULL COLLATE NOCASE
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ingredient_synonyms_synonym" ON "ingredient_synonyms"("synonym" COLLATE NOCASE);
CREATE TABLE IF NOT EXISTS "ingredient_sizes" (
	"id"	INTEGER,
	"ingredient_id"	INTEGER NOT NULL,
	"size"	TEXT NOT NULL,
	"sort_order"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("ingredient_id") REFERENCES "ingredients"("ID") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "ingredient_store_location" (
	"ID"	INTEGER,
	"ingredient_id"	INTEGER NOT NULL,
	"store_location_id"	INTEGER NOT NULL,
	PRIMARY KEY("ID" AUTOINCREMENT),
	FOREIGN KEY("ingredient_id") REFERENCES "ingredients"("ID"),
	FOREIGN KEY("store_location_id") REFERENCES "store_locations"("ID")
);
CREATE TABLE IF NOT EXISTS "ingredient_variant_store_location" (
	"id"	INTEGER,
	"ingredient_variant_id"	INTEGER NOT NULL,
	"store_location_id"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT),
	UNIQUE("ingredient_variant_id","store_location_id"),
	FOREIGN KEY("ingredient_variant_id") REFERENCES "ingredient_variants"("id") ON DELETE CASCADE,
	FOREIGN KEY("store_location_id") REFERENCES "store_locations"("ID") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "ingredient_variants" (
	"id"	INTEGER,
	"ingredient_id"	INTEGER NOT NULL,
	"variant"	TEXT NOT NULL,
	"sort_order"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("ingredient_id") REFERENCES "ingredients"("ID") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "ingredients" (
	"ID"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL,
	"variant"	TEXT,
	"location_at_home"	TEXT,
	"hide_from_shopping_list"	INTEGER DEFAULT 0,
	"size"	TEXT,
	"parenthetical_note"	TEXT,
	"is_food"	INTEGER NOT NULL DEFAULT 1,
	"is_deprecated"	INTEGER NOT NULL DEFAULT 0,
	"lemma"	TEXT,
	"plural_by_default"	INTEGER NOT NULL DEFAULT 0,
	"is_mass_noun"	INTEGER NOT NULL DEFAULT 0,
	"plural_override"	TEXT,
	"is_hidden"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "recipe_ingredient_headings" (
	"ID"	INTEGER,
	"recipe_id"	INTEGER NOT NULL,
	"section_id"	INTEGER,
	"sort_order"	INTEGER,
	"text"	TEXT,
	PRIMARY KEY("ID")
);
CREATE TABLE IF NOT EXISTS "recipe_ingredient_map" (
	"ID"	INTEGER,
	"recipe_id"	INTEGER NOT NULL,
	"ingredient_id"	INTEGER NOT NULL,
	"section_id"	INTEGER,
	"quantity"	TEXT,
	"unit"	TEXT,
	"prep_notes"	TEXT,
	"is_optional"	INTEGER DEFAULT 0,
	"subrecipe_id"	INTEGER,
	"sort_order"	INTEGER,
	"parenthetical_note"	TEXT,
	"quantity_min"	REAL,
	"quantity_max"	REAL,
	"quantity_is_approx"	INTEGER NOT NULL DEFAULT 0,
	"linked_recipe_id"	INTEGER,
	"recipe_text"	TEXT,
	"is_recipe"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("ID" AUTOINCREMENT),
	FOREIGN KEY("ingredient_id") REFERENCES "ingredients"("ID"),
	FOREIGN KEY("recipe_id") REFERENCES "recipes"("ID"),
	FOREIGN KEY("section_id") REFERENCES "recipe_sections"("ID"),
	FOREIGN KEY("subrecipe_id") REFERENCES "recipes"("ID")
);
CREATE TABLE IF NOT EXISTS "recipe_ingredient_substitutes" (
	"id"	INTEGER,
	"recipe_ingredient_id"	INTEGER NOT NULL,
	"quantity"	TEXT,
	"unit"	TEXT,
	"ingredient_id"	INTEGER NOT NULL,
	"variant"	TEXT,
	"size"	TEXT,
	"prep_notes"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("ingredient_id") REFERENCES "ingredients"("id"),
	FOREIGN KEY("recipe_ingredient_id") REFERENCES "recipe_ingredient_map"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "recipe_tag_map" (
	"id"	INTEGER,
	"recipe_id"	INTEGER NOT NULL,
	"tag_id"	INTEGER NOT NULL,
	"sort_order"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT),
	UNIQUE("recipe_id","tag_id"),
	FOREIGN KEY("recipe_id") REFERENCES "recipes"("ID") ON DELETE CASCADE,
	FOREIGN KEY("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "recipe_sections" (
	"ID"	INTEGER,
	"recipe_id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL,
	"sort_order"	INTEGER NOT NULL,
	PRIMARY KEY("ID" AUTOINCREMENT),
	FOREIGN KEY("recipe_id") REFERENCES "recipes"("ID")
);
CREATE TABLE IF NOT EXISTS "recipe_steps" (
	"ID"	INT,
	"recipe_id"	INT,
	"step_number"	INT,
	"instructions"	TEXT,
	"type"	TEXT
);
CREATE TABLE IF NOT EXISTS "recipes" (
	"ID"	INTEGER,
	"title"	TEXT NOT NULL,
	"servings_default"	INTEGER,
	"servings_min"	INTEGER,
	"servings_max"	INTEGER,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "tags" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL COLLATE NOCASE,
	"is_hidden"	INTEGER NOT NULL DEFAULT 0,
	"sort_order"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tags_name_nocase" ON "tags"("name" COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS "idx_recipe_tag_map_recipe" ON "recipe_tag_map"("recipe_id","sort_order","id");
CREATE INDEX IF NOT EXISTS "idx_recipe_tag_map_tag" ON "recipe_tag_map"("tag_id","recipe_id");
CREATE TABLE IF NOT EXISTS "size_classes" (
	"code"	TEXT,
	"sort_order"	INTEGER NOT NULL,
	PRIMARY KEY("code")
);
CREATE TABLE IF NOT EXISTS "store_locations" (
	"ID"	INTEGER,
	"store_id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL,
	"aisle_number"	INTEGER,
	"sort_order"	INTEGER,
	PRIMARY KEY("ID" AUTOINCREMENT),
	FOREIGN KEY("store_id") REFERENCES "stores"("ID")
);
CREATE TABLE IF NOT EXISTS "stores" (
	"ID"	INTEGER,
	"chain_name"	TEXT NOT NULL,
	"location_name"	TEXT NOT NULL,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "unit_suggestions" (
	"code"	TEXT,
	"use_count"	INTEGER NOT NULL DEFAULT 0,
	"last_used_at"	INTEGER,
	"is_hidden"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("code")
);
CREATE TABLE IF NOT EXISTS "units" (
	"code"	TEXT,
	"name_singular"	TEXT NOT NULL,
	"name_plural"	TEXT NOT NULL,
	"category"	TEXT NOT NULL,
	"sort_order"	INTEGER,
	"is_hidden"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("code")
);