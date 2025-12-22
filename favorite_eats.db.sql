BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "favorite_eats" (
	"field1"	TEXT,
	"field2"	TEXT
);
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
INSERT INTO "favorite_eats" VALUES ('BEGIN TRANSACTION;',NULL);
INSERT INTO "favorite_eats" VALUES ('CREATE TABLE IF NOT EXISTS ingredient_store_location (',NULL);
INSERT INTO "favorite_eats" VALUES ('ID	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('ingredient_id	INTEGER NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('store_location_id	INTEGER NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('PRIMARY KEY(ID AUTOINCREMENT)',NULL);
INSERT INTO "favorite_eats" VALUES ('FOREIGN KEY(ingredient_id) REFERENCES ingredients(ID)',NULL);
INSERT INTO "favorite_eats" VALUES ('FOREIGN KEY(store_location_id) REFERENCES store_locations(ID)',NULL);
INSERT INTO "favorite_eats" VALUES (');',NULL);
INSERT INTO "favorite_eats" VALUES ('CREATE TABLE IF NOT EXISTS ingredients (',NULL);
INSERT INTO "favorite_eats" VALUES ('ID	INTEGER NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('name	TEXT NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('variant	TEXT',NULL);
INSERT INTO "favorite_eats" VALUES ('location_at_home	TEXT',NULL);
INSERT INTO "favorite_eats" VALUES ('hide_from_shopping_list	INTEGER DEFAULT 0',NULL);
INSERT INTO "favorite_eats" VALUES ('size	TEXT',NULL);
INSERT INTO "favorite_eats" VALUES ('PRIMARY KEY(ID AUTOINCREMENT)',NULL);
INSERT INTO "favorite_eats" VALUES (');',NULL);
INSERT INTO "favorite_eats" VALUES ('CREATE TABLE IF NOT EXISTS recipe_ingredient_map (',NULL);
INSERT INTO "favorite_eats" VALUES ('ID	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('recipe_id	INTEGER NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('ingredient_id	INTEGER NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('section_id	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('quantity	TEXT',NULL);
INSERT INTO "favorite_eats" VALUES ('unit	TEXT',NULL);
INSERT INTO "favorite_eats" VALUES ('prep_notes	TEXT',NULL);
INSERT INTO "favorite_eats" VALUES ('is_optional	INTEGER DEFAULT 0',NULL);
INSERT INTO "favorite_eats" VALUES ('subrecipe_id	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('PRIMARY KEY(ID AUTOINCREMENT)',NULL);
INSERT INTO "favorite_eats" VALUES ('FOREIGN KEY(ingredient_id) REFERENCES ingredients(ID)',NULL);
INSERT INTO "favorite_eats" VALUES ('FOREIGN KEY(recipe_id) REFERENCES recipes(ID)',NULL);
INSERT INTO "favorite_eats" VALUES ('FOREIGN KEY(section_id) REFERENCES recipe_sections(ID)',NULL);
INSERT INTO "favorite_eats" VALUES ('FOREIGN KEY(subrecipe_id) REFERENCES recipes(ID)',NULL);
INSERT INTO "favorite_eats" VALUES (');',NULL);
INSERT INTO "favorite_eats" VALUES ('CREATE TABLE IF NOT EXISTS recipe_sections (',NULL);
INSERT INTO "favorite_eats" VALUES ('ID	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('recipe_id	INTEGER NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('name	TEXT NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('sort_order	INTEGER NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('PRIMARY KEY(ID AUTOINCREMENT)',NULL);
INSERT INTO "favorite_eats" VALUES ('FOREIGN KEY(recipe_id) REFERENCES recipes(ID)',NULL);
INSERT INTO "favorite_eats" VALUES (');',NULL);
INSERT INTO "favorite_eats" VALUES ('CREATE TABLE IF NOT EXISTS recipe_steps (',NULL);
INSERT INTO "favorite_eats" VALUES ('ID	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('recipe_id	INTEGER NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('section_id	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('step_number	INTEGER NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('instructions	TEXT NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('PRIMARY KEY(ID)',NULL);
INSERT INTO "favorite_eats" VALUES ('FOREIGN KEY(recipe_id) REFERENCES recipes(ID)',NULL);
INSERT INTO "favorite_eats" VALUES ('FOREIGN KEY(section_id) REFERENCES recipe_sections(ID)',NULL);
INSERT INTO "favorite_eats" VALUES (');',NULL);
INSERT INTO "favorite_eats" VALUES ('CREATE TABLE IF NOT EXISTS recipes (',NULL);
INSERT INTO "favorite_eats" VALUES ('ID	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('title	TEXT NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('servings_default	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('servings_min	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('servings_max	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('PRIMARY KEY(ID AUTOINCREMENT)',NULL);
INSERT INTO "favorite_eats" VALUES (');',NULL);
INSERT INTO "favorite_eats" VALUES ('CREATE TABLE IF NOT EXISTS store_locations (',NULL);
INSERT INTO "favorite_eats" VALUES ('ID	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('store_id	INTEGER NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('name	TEXT NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('aisle_number	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('sort_order	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('PRIMARY KEY(ID AUTOINCREMENT)',NULL);
INSERT INTO "favorite_eats" VALUES ('FOREIGN KEY(store_id) REFERENCES stores(ID)',NULL);
INSERT INTO "favorite_eats" VALUES (');',NULL);
INSERT INTO "favorite_eats" VALUES ('CREATE TABLE IF NOT EXISTS stores (',NULL);
INSERT INTO "favorite_eats" VALUES ('ID	INTEGER',NULL);
INSERT INTO "favorite_eats" VALUES ('chain_name	TEXT NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('location_name	TEXT NOT NULL',NULL);
INSERT INTO "favorite_eats" VALUES ('PRIMARY KEY(ID AUTOINCREMENT)',NULL);
INSERT INTO "favorite_eats" VALUES (');',NULL);
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (1','10');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (2','11');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (3','12');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (4','13');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (5','14');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (6','15');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (7','16');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (8','17');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (9','18');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (10','19');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (11','20');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (12','21');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (13','22');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (14','23');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (15','24');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (16','25');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (17','26');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (18','27');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (19','28');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (20','29');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (21','30');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (22','31');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (23','32');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (24','33');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (25','34');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (26','35');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (27','36');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (55','64');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (56','65');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (57','66');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (58','67');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (59','68');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (60','69');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (61','70');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (62','71');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (63','72');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (64','73');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (65','74');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (66','75');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (67','76');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (68','77');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (69','78');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (70','79');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (71','80');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (72','81');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (73','82');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (74','83');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (75','84');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (76','85');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (77','86');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (78','87');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (79','88');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (80','89');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (81','90');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (82','91');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (83','92');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (84','93');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (85','94');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (86','95');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (87','96');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (88','97');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (89','98');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (90','99');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (91','100');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (92','101');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (93','102');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (94','103');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (95','104');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (96','105');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (97','106');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (98','107');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (99','108');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (100','109');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (101','110');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (102','111');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (103','5');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (104','112');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (105','113');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (106','114');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (108','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (109','116');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (110','117');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (111','118');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (112','119');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (113','120');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (114','121');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (115','122');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (116','123');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (117','124');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (118','125');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (119','126');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (120','127');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (121','128');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (122','129');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (123','130');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (124','131');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (125','132');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredient_store_location VALUES (126','133');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (2','''flour''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (3','''sugar''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (4','''baking powder''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (5','''salt''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (6','''oat milk''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (7','''vinegar''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (8','''oil''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (9','''water''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (10','''dates''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (11','''grapes''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (12','''berries''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (13','''kiwi''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (14','''melon''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (15','''grapefruit''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (16','''clementine''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (17','''pears''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (18','''nectarines''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (19','''lemons''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (20','''celery''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (21','''scallions''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (22','''cabbage''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (23','''carrots''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (24','''broccoli''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (25','''cauliflower''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (26','''cucumber''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (27','''apples''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (28','''bananas''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (29','''tomato''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (30','''avocado''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (31','''potato''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (32','''onion''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (33','''garlic''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (34','''mushrooms''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (35','''lettuce''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (36','''spinach''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (64','''soap''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (65','''toothpaste''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (66','''epsom salt''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (67','''shampoo''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (68','''deodorant''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (69','''blueberries''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (70','''cherries''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (71','''strawberries''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (72','''corn''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (73','''peas''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (74','''edamame''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (75','''fries''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (76','''just folded eggs''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (77','''beyond beef patties''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (78','''chickn’ tenders''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (79','''ice cream''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (80','''sponges''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (81','''trash bags''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (82','''compost bags''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (83','''dish soap''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (84','''all purpose cleaner''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (85','''parchment''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (86','''aluminum foil''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (87','''waxed paper''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (88','''paper towels''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (89','''toilet paper''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (90','''cat litter''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (91','''tea''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (92','''pasta''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (93','''marinara sauce''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (94','''olive oil''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (95','''ponzu''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (96','''beans''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (97','''rice''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (98','''veg broth''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (99','''bread''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (100','''bagels''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (101','''buns''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (102','''chips''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (103','''crackers''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (104','''seaweed''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (105','''cookies''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (106','''walnuts''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (107','''pepitas''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (108','''goji berries''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (109','''just egg''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (110','''hummus''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (111','''salsa''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (112','''oatmeal''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (113','''granola''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (114','''nutritional yeast''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (116','''flour''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (117','''date syrup''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (118','''syrup''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (119','''honey''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (120','''jam''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (121','''nocciolata''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (122','''almond butter''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (123','''pistachio butter''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (124','''coffee''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (125','''yogurt''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (126','''oatmilk''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (127','''earth balance''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (128','''butter''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (129','''coconut water''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (130','''tofu''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (131','''ramen''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (132','''veganaise''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (133','''breakfast links''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (134','''black pepper''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (135','''chuck''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (136','''chuck''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (137','''cashews''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (138','''garlic powder''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (139','''basil''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (140','''oregano''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (141','''lasagna noodles''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (142','''parmesan''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (143','''basil''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO ingredients VALUES (147','''pine nuts''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (1','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (2','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (3','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (4','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (5','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (6','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (7','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (8','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (9','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (10','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (11','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (12','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (13','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (14','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (15','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (16','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (17','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (18','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (19','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (20','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (21','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (22','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (23','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (24','3');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (25','3');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (27','3');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (28','3');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (29','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_ingredient_map VALUES (30','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_sections VALUES (1','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_sections VALUES (2','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_sections VALUES (3','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_sections VALUES (7','3');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (1','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (2','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (3','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (4','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (5','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (6','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (7','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (8','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (9','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (10','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (11','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (12','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (13','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (14','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (15','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (16','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (17','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (18','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (19','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (20','2');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (21','3');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (22','3');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (23','3');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipe_steps VALUES (24','3');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipes VALUES (1','''pancakes''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipes VALUES (2','''lasagna''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO recipes VALUES (3','''vegan parmesan''');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (1','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (2','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (3','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (4','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (5','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (6','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (7','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (8','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (9','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (10','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO store_locations VALUES (11','1');
INSERT INTO "favorite_eats" VALUES ('INSERT INTO stores VALUES (1','''whole foods''');
INSERT INTO "favorite_eats" VALUES ('COMMIT;',NULL);
INSERT INTO "ingredient_sizes" VALUES (1,23,'large',1);
INSERT INTO "ingredient_sizes" VALUES (4,32,'medium',2);
INSERT INTO "ingredient_sizes" VALUES (5,32,'large',3);
INSERT INTO "ingredient_sizes" VALUES (7,171,'large',1);
INSERT INTO "ingredient_store_location" VALUES (1,10,1);
INSERT INTO "ingredient_store_location" VALUES (2,11,1);
INSERT INTO "ingredient_store_location" VALUES (3,12,1);
INSERT INTO "ingredient_store_location" VALUES (4,13,1);
INSERT INTO "ingredient_store_location" VALUES (5,14,1);
INSERT INTO "ingredient_store_location" VALUES (6,15,1);
INSERT INTO "ingredient_store_location" VALUES (7,16,1);
INSERT INTO "ingredient_store_location" VALUES (8,17,1);
INSERT INTO "ingredient_store_location" VALUES (9,18,1);
INSERT INTO "ingredient_store_location" VALUES (10,19,1);
INSERT INTO "ingredient_store_location" VALUES (11,20,1);
INSERT INTO "ingredient_store_location" VALUES (12,21,1);
INSERT INTO "ingredient_store_location" VALUES (13,22,1);
INSERT INTO "ingredient_store_location" VALUES (14,23,1);
INSERT INTO "ingredient_store_location" VALUES (15,24,1);
INSERT INTO "ingredient_store_location" VALUES (16,25,1);
INSERT INTO "ingredient_store_location" VALUES (17,26,1);
INSERT INTO "ingredient_store_location" VALUES (18,27,1);
INSERT INTO "ingredient_store_location" VALUES (19,28,1);
INSERT INTO "ingredient_store_location" VALUES (20,29,1);
INSERT INTO "ingredient_store_location" VALUES (21,30,1);
INSERT INTO "ingredient_store_location" VALUES (22,31,1);
INSERT INTO "ingredient_store_location" VALUES (23,32,1);
INSERT INTO "ingredient_store_location" VALUES (24,33,1);
INSERT INTO "ingredient_store_location" VALUES (25,34,1);
INSERT INTO "ingredient_store_location" VALUES (26,35,1);
INSERT INTO "ingredient_store_location" VALUES (27,36,1);
INSERT INTO "ingredient_store_location" VALUES (55,64,2);
INSERT INTO "ingredient_store_location" VALUES (56,65,2);
INSERT INTO "ingredient_store_location" VALUES (57,66,2);
INSERT INTO "ingredient_store_location" VALUES (58,67,2);
INSERT INTO "ingredient_store_location" VALUES (59,68,2);
INSERT INTO "ingredient_store_location" VALUES (60,69,3);
INSERT INTO "ingredient_store_location" VALUES (61,70,3);
INSERT INTO "ingredient_store_location" VALUES (62,71,3);
INSERT INTO "ingredient_store_location" VALUES (63,72,3);
INSERT INTO "ingredient_store_location" VALUES (64,73,3);
INSERT INTO "ingredient_store_location" VALUES (65,74,3);
INSERT INTO "ingredient_store_location" VALUES (66,75,3);
INSERT INTO "ingredient_store_location" VALUES (67,76,3);
INSERT INTO "ingredient_store_location" VALUES (68,77,3);
INSERT INTO "ingredient_store_location" VALUES (69,78,3);
INSERT INTO "ingredient_store_location" VALUES (70,79,3);
INSERT INTO "ingredient_store_location" VALUES (71,80,4);
INSERT INTO "ingredient_store_location" VALUES (72,81,4);
INSERT INTO "ingredient_store_location" VALUES (73,82,4);
INSERT INTO "ingredient_store_location" VALUES (74,83,4);
INSERT INTO "ingredient_store_location" VALUES (75,84,4);
INSERT INTO "ingredient_store_location" VALUES (76,85,4);
INSERT INTO "ingredient_store_location" VALUES (77,86,4);
INSERT INTO "ingredient_store_location" VALUES (78,87,4);
INSERT INTO "ingredient_store_location" VALUES (79,88,4);
INSERT INTO "ingredient_store_location" VALUES (80,89,4);
INSERT INTO "ingredient_store_location" VALUES (81,90,4);
INSERT INTO "ingredient_store_location" VALUES (82,91,4);
INSERT INTO "ingredient_store_location" VALUES (83,92,5);
INSERT INTO "ingredient_store_location" VALUES (84,93,5);
INSERT INTO "ingredient_store_location" VALUES (85,94,5);
INSERT INTO "ingredient_store_location" VALUES (86,95,5);
INSERT INTO "ingredient_store_location" VALUES (87,96,5);
INSERT INTO "ingredient_store_location" VALUES (88,97,5);
INSERT INTO "ingredient_store_location" VALUES (89,98,5);
INSERT INTO "ingredient_store_location" VALUES (90,99,6);
INSERT INTO "ingredient_store_location" VALUES (91,100,6);
INSERT INTO "ingredient_store_location" VALUES (92,101,6);
INSERT INTO "ingredient_store_location" VALUES (93,102,7);
INSERT INTO "ingredient_store_location" VALUES (94,103,7);
INSERT INTO "ingredient_store_location" VALUES (95,104,7);
INSERT INTO "ingredient_store_location" VALUES (96,105,7);
INSERT INTO "ingredient_store_location" VALUES (97,106,7);
INSERT INTO "ingredient_store_location" VALUES (98,107,7);
INSERT INTO "ingredient_store_location" VALUES (99,108,7);
INSERT INTO "ingredient_store_location" VALUES (100,109,8);
INSERT INTO "ingredient_store_location" VALUES (101,110,8);
INSERT INTO "ingredient_store_location" VALUES (102,111,8);
INSERT INTO "ingredient_store_location" VALUES (103,150,9);
INSERT INTO "ingredient_store_location" VALUES (104,112,9);
INSERT INTO "ingredient_store_location" VALUES (105,113,9);
INSERT INTO "ingredient_store_location" VALUES (106,114,9);
INSERT INTO "ingredient_store_location" VALUES (108,116,10);
INSERT INTO "ingredient_store_location" VALUES (109,116,10);
INSERT INTO "ingredient_store_location" VALUES (110,117,10);
INSERT INTO "ingredient_store_location" VALUES (111,118,10);
INSERT INTO "ingredient_store_location" VALUES (112,119,10);
INSERT INTO "ingredient_store_location" VALUES (113,120,10);
INSERT INTO "ingredient_store_location" VALUES (114,121,10);
INSERT INTO "ingredient_store_location" VALUES (115,122,10);
INSERT INTO "ingredient_store_location" VALUES (116,123,10);
INSERT INTO "ingredient_store_location" VALUES (117,124,10);
INSERT INTO "ingredient_store_location" VALUES (118,125,11);
INSERT INTO "ingredient_store_location" VALUES (119,155,11);
INSERT INTO "ingredient_store_location" VALUES (120,127,11);
INSERT INTO "ingredient_store_location" VALUES (121,128,11);
INSERT INTO "ingredient_store_location" VALUES (122,129,11);
INSERT INTO "ingredient_store_location" VALUES (123,130,11);
INSERT INTO "ingredient_store_location" VALUES (124,131,11);
INSERT INTO "ingredient_store_location" VALUES (125,132,11);
INSERT INTO "ingredient_store_location" VALUES (126,133,11);
INSERT INTO "ingredient_variants" VALUES (1,3,'granulated',1);
INSERT INTO "ingredient_variants" VALUES (2,7,'apple cider',1);
INSERT INTO "ingredient_variants" VALUES (3,8,'canola',1);
INSERT INTO "ingredient_variants" VALUES (4,19,'fresh',1);
INSERT INTO "ingredient_variants" VALUES (5,22,'purple',1);
INSERT INTO "ingredient_variants" VALUES (6,32,'yellow',1);
INSERT INTO "ingredient_variants" VALUES (7,34,'Baby Bella',1);
INSERT INTO "ingredient_variants" VALUES (8,35,'butter',1);
INSERT INTO "ingredient_variants" VALUES (9,36,'baby',1);
INSERT INTO "ingredient_variants" VALUES (10,69,'frozen',1);
INSERT INTO "ingredient_variants" VALUES (11,70,'frozen',1);
INSERT INTO "ingredient_variants" VALUES (12,71,'frozen',1);
INSERT INTO "ingredient_variants" VALUES (13,72,'frozen',1);
INSERT INTO "ingredient_variants" VALUES (14,73,'frozen',1);
INSERT INTO "ingredient_variants" VALUES (15,74,'frozen',1);
INSERT INTO "ingredient_variants" VALUES (16,75,'frozen',1);
INSERT INTO "ingredient_variants" VALUES (17,93,'Rao’s',1);
INSERT INTO "ingredient_variants" VALUES (18,94,'extra-virgin',1);
INSERT INTO "ingredient_variants" VALUES (19,99,'dave''s killer thin-sliced',1);
INSERT INTO "ingredient_variants" VALUES (20,109,'liquid',1);
INSERT INTO "ingredient_variants" VALUES (21,130,'firm',1);
INSERT INTO "ingredient_variants" VALUES (22,133,'beyond beef',1);
INSERT INTO "ingredient_variants" VALUES (23,135,'Impossible',1);
INSERT INTO "ingredient_variants" VALUES (24,137,'raw',1);
INSERT INTO "ingredient_variants" VALUES (25,139,'dried',1);
INSERT INTO "ingredient_variants" VALUES (26,140,'dried',1);
INSERT INTO "ingredient_variants" VALUES (27,141,'no-boil',1);
INSERT INTO "ingredient_variants" VALUES (28,142,'vegan',1);
INSERT INTO "ingredient_variants" VALUES (29,143,'fresh',1);
INSERT INTO "ingredient_variants" VALUES (30,160,'vegetable',1);
INSERT INTO "ingredient_variants" VALUES (31,161,'red',1);
INSERT INTO "ingredient_variants" VALUES (32,162,'ground',1);
INSERT INTO "ingredient_variants" VALUES (33,163,'ground',1);
INSERT INTO "ingredient_variants" VALUES (34,164,'ground',1);
INSERT INTO "ingredient_variants" VALUES (35,165,'ground',1);
INSERT INTO "ingredient_variants" VALUES (36,166,'ground',1);
INSERT INTO "ingredient_variants" VALUES (37,151,'all purpose',1);
INSERT INTO "ingredient_variants" VALUES (38,151,'cake',2);
INSERT INTO "ingredient_variants" VALUES (39,151,'almond',3);
INSERT INTO "ingredient_variants" VALUES (41,171,'Pee Pee Edition',1);
INSERT INTO "ingredients" VALUES (3,'sugar','granulated','pantry',0,NULL,NULL,1,0,'sugar',0,0,NULL);
INSERT INTO "ingredients" VALUES (7,'vinegar','apple cider','above fridge',0,NULL,NULL,1,0,'vinegar',0,0,NULL);
INSERT INTO "ingredients" VALUES (8,'oil','canola','pantry',0,NULL,NULL,1,0,'oil',0,0,NULL);
INSERT INTO "ingredients" VALUES (9,'water',NULL,NULL,1,NULL,NULL,1,1,'water',0,0,NULL);
INSERT INTO "ingredients" VALUES (10,'dates','','cereal cabinet',0,NULL,NULL,1,0,'dates',0,0,NULL);
INSERT INTO "ingredients" VALUES (11,'grapes','','fridge',0,NULL,NULL,1,0,'grape',1,0,NULL);
INSERT INTO "ingredients" VALUES (12,'berries','','fridge',0,NULL,NULL,1,0,'berries',0,0,NULL);
INSERT INTO "ingredients" VALUES (13,'kiwi','','fruit stand',0,NULL,'≈1 lemon',1,0,'kiwi',0,0,NULL);
INSERT INTO "ingredients" VALUES (14,'melon','','fridge',0,NULL,NULL,1,0,'melon',0,0,NULL);
INSERT INTO "ingredients" VALUES (15,'grapefruit','','fridge',0,NULL,NULL,1,0,'grapefruit',0,0,NULL);
INSERT INTO "ingredients" VALUES (16,'clementine','','fruit stand',0,NULL,NULL,1,0,'clementine',0,0,NULL);
INSERT INTO "ingredients" VALUES (17,'pears','','fruit stand',0,NULL,NULL,1,0,'pears',0,0,NULL);
INSERT INTO "ingredients" VALUES (18,'nectarines','','fruit stand',0,NULL,NULL,1,0,'nectarines',0,0,NULL);
INSERT INTO "ingredients" VALUES (19,'lemon juice','fresh','fridge',0,NULL,'≈1 lemon',1,0,'lemon juice',0,0,NULL);
INSERT INTO "ingredients" VALUES (20,'celery','','fridge',0,NULL,NULL,1,0,'celery',0,0,NULL);
INSERT INTO "ingredients" VALUES (21,'scallions','','fridge',0,NULL,NULL,1,0,'scallion',1,0,NULL);
INSERT INTO "ingredients" VALUES (22,'cabbage','purple','fridge',0,NULL,NULL,1,0,'cabbage',0,0,NULL);
INSERT INTO "ingredients" VALUES (23,'carrot','','fridge',0,'large',NULL,1,0,'carrot',0,0,NULL);
INSERT INTO "ingredients" VALUES (24,'broccoli','','fridge',0,NULL,NULL,1,0,'broccoli',0,0,NULL);
INSERT INTO "ingredients" VALUES (25,'cauliflower','','fridge',0,NULL,NULL,1,0,'cauliflower',0,0,NULL);
INSERT INTO "ingredients" VALUES (26,'cucumber','','fridge',0,NULL,NULL,1,0,'cucumber',0,0,NULL);
INSERT INTO "ingredients" VALUES (27,'apple','','fruit stand',0,NULL,NULL,1,0,'apple',0,0,NULL);
INSERT INTO "ingredients" VALUES (28,'banana','','fruit stand',0,NULL,NULL,1,0,'banana',0,0,NULL);
INSERT INTO "ingredients" VALUES (29,'tomato','','pantry',0,NULL,NULL,1,0,'tomato',0,0,NULL);
INSERT INTO "ingredients" VALUES (30,'avocado','','fridge',0,NULL,NULL,1,0,'avocado',0,0,NULL);
INSERT INTO "ingredients" VALUES (31,'potato','','pantry',0,NULL,NULL,1,0,'potato',0,0,NULL);
INSERT INTO "ingredients" VALUES (32,'onion','yellow','fridge',0,'medium-to-large',NULL,1,0,'onion',0,0,NULL);
INSERT INTO "ingredients" VALUES (33,'garlic',NULL,'pantry',0,NULL,NULL,1,0,'garlic',0,0,NULL);
INSERT INTO "ingredients" VALUES (34,'mushrooms','Baby Bella','fridge',0,NULL,NULL,1,0,'mushrooms',0,0,NULL);
INSERT INTO "ingredients" VALUES (35,'lettuce','butter','fridge',0,NULL,NULL,1,0,'lettuce',0,0,NULL);
INSERT INTO "ingredients" VALUES (36,'spinach','baby','fridge',0,NULL,NULL,1,0,'spinach',0,0,NULL);
INSERT INTO "ingredients" VALUES (64,'soap','',NULL,0,NULL,NULL,1,0,'soap',0,0,NULL);
INSERT INTO "ingredients" VALUES (65,'toothpaste','',NULL,0,NULL,NULL,1,0,'toothpaste',0,0,NULL);
INSERT INTO "ingredients" VALUES (66,'epsom salt','',NULL,0,NULL,NULL,1,0,'epsom salt',0,0,NULL);
INSERT INTO "ingredients" VALUES (67,'shampoo','',NULL,0,NULL,NULL,1,0,'shampoo',0,0,NULL);
INSERT INTO "ingredients" VALUES (68,'deodorant','',NULL,0,NULL,NULL,1,0,'deodorant',0,0,NULL);
INSERT INTO "ingredients" VALUES (69,'blueberries','frozen','freezer',0,NULL,NULL,1,0,'blueberries',0,0,NULL);
INSERT INTO "ingredients" VALUES (70,'cherries','frozen','fridge',0,NULL,NULL,1,0,'cherries',0,0,NULL);
INSERT INTO "ingredients" VALUES (71,'strawberries','frozen','fridge',0,NULL,NULL,1,0,'strawberries',0,0,NULL);
INSERT INTO "ingredients" VALUES (72,'corn','frozen','freezer',0,NULL,NULL,1,0,'corn',0,0,NULL);
INSERT INTO "ingredients" VALUES (73,'peas','frozen','freezer',0,NULL,NULL,1,0,'peas',0,0,NULL);
INSERT INTO "ingredients" VALUES (74,'edamame','frozen','freezer',0,NULL,NULL,1,0,'edamame',0,0,NULL);
INSERT INTO "ingredients" VALUES (75,'fries','frozen','freezer',0,NULL,NULL,1,0,'fries',0,0,NULL);
INSERT INTO "ingredients" VALUES (76,'just folded eggs','','freezer',0,NULL,NULL,1,0,'just folded eggs',0,0,NULL);
INSERT INTO "ingredients" VALUES (77,'beyond beef patties','','freezer',0,NULL,NULL,1,0,'beyond beef patties',0,0,NULL);
INSERT INTO "ingredients" VALUES (78,'chickn’ tenders','','freezer',0,NULL,NULL,1,0,'chickn’ tenders',0,0,NULL);
INSERT INTO "ingredients" VALUES (79,'ice cream','','freezer',0,NULL,NULL,1,0,'ice cream',0,0,NULL);
INSERT INTO "ingredients" VALUES (80,'sponges','',NULL,0,NULL,NULL,1,0,'sponges',0,0,NULL);
INSERT INTO "ingredients" VALUES (81,'trash bags','',NULL,0,NULL,NULL,1,0,'trash bags',0,0,NULL);
INSERT INTO "ingredients" VALUES (82,'compost bags','',NULL,0,NULL,NULL,1,0,'compost bags',0,0,NULL);
INSERT INTO "ingredients" VALUES (83,'dish soap','',NULL,0,NULL,NULL,1,0,'dish soap',0,0,NULL);
INSERT INTO "ingredients" VALUES (84,'All purpose cleaner','','',0,'',NULL,1,0,'All purpose cleaner',0,0,NULL);
INSERT INTO "ingredients" VALUES (85,'parchment','','pantry',0,NULL,NULL,1,0,'parchment',0,0,NULL);
INSERT INTO "ingredients" VALUES (86,'aluminum foil','','fridge',0,'',NULL,1,0,'aluminum foil',0,0,NULL);
INSERT INTO "ingredients" VALUES (87,'waxed paper','',NULL,0,NULL,NULL,1,0,'waxed paper',0,0,NULL);
INSERT INTO "ingredients" VALUES (88,'paper towels','',NULL,0,NULL,NULL,1,0,'paper towels',0,0,NULL);
INSERT INTO "ingredients" VALUES (89,'toilet paper','',NULL,0,NULL,NULL,1,0,'toilet paper',0,0,NULL);
INSERT INTO "ingredients" VALUES (90,'cat litter','',NULL,0,NULL,NULL,1,0,'cat litter',0,0,NULL);
INSERT INTO "ingredients" VALUES (91,'tea','',NULL,0,NULL,NULL,1,0,'tea',0,0,NULL);
INSERT INTO "ingredients" VALUES (92,'pasta','','pantry',0,NULL,NULL,1,0,'pasta',0,0,NULL);
INSERT INTO "ingredients" VALUES (93,'marinara sauce','Rao’s','fridge',0,NULL,NULL,1,0,'marinara sauce',0,0,NULL);
INSERT INTO "ingredients" VALUES (94,'olive oil','extra-virgin','above fridge',0,NULL,NULL,1,0,'olive oil',0,0,NULL);
INSERT INTO "ingredients" VALUES (95,'ponzu','','fridge',0,NULL,NULL,1,0,'ponzu',0,0,NULL);
INSERT INTO "ingredients" VALUES (96,'beans','','pantry',0,NULL,NULL,1,0,'beans',0,0,NULL);
INSERT INTO "ingredients" VALUES (97,'rice','','pantry',0,NULL,NULL,1,0,'rice',0,1,NULL);
INSERT INTO "ingredients" VALUES (98,'veg broth','','fridge',0,NULL,NULL,1,0,'veg broth',0,0,NULL);
INSERT INTO "ingredients" VALUES (99,'bread','dave''s killer thin-sliced','fridge',0,NULL,NULL,1,0,'bread',0,0,NULL);
INSERT INTO "ingredients" VALUES (100,'bagels','','fridge',0,NULL,NULL,1,0,'bagels',0,0,NULL);
INSERT INTO "ingredients" VALUES (101,'buns','','fridge',0,NULL,NULL,1,0,'buns',0,0,NULL);
INSERT INTO "ingredients" VALUES (102,'chips','','pantry',0,NULL,NULL,1,0,'chips',0,0,NULL);
INSERT INTO "ingredients" VALUES (103,'crackers','','pantry',0,NULL,NULL,1,0,'crackers',0,0,NULL);
INSERT INTO "ingredients" VALUES (104,'seaweed','','pantry',0,NULL,NULL,1,0,'seaweed',0,0,NULL);
INSERT INTO "ingredients" VALUES (105,'cookies','','pantry',0,NULL,NULL,1,0,'cookies',0,0,NULL);
INSERT INTO "ingredients" VALUES (106,'walnuts','','cereal cabinet',0,NULL,NULL,1,0,'walnuts',0,0,NULL);
INSERT INTO "ingredients" VALUES (107,'pepitas','','cereal cabinet',0,NULL,NULL,1,0,'pepitas',0,0,NULL);
INSERT INTO "ingredients" VALUES (108,'goji berries','','cereal cabinet',0,NULL,NULL,1,0,'goji berries',0,0,NULL);
INSERT INTO "ingredients" VALUES (109,'just egg','liquid','fridge',0,NULL,NULL,1,0,'just egg',0,0,NULL);
INSERT INTO "ingredients" VALUES (110,'hummus','','fridge',0,NULL,NULL,1,0,'hummus',0,0,NULL);
INSERT INTO "ingredients" VALUES (111,'salsa','','fridge',0,NULL,NULL,1,0,'salsa',0,0,NULL);
INSERT INTO "ingredients" VALUES (112,'oatmeal','','pantry',0,NULL,NULL,1,0,'oatmeal',0,0,NULL);
INSERT INTO "ingredients" VALUES (113,'granola','','cereal cabinet',0,NULL,NULL,1,0,'granola',0,0,NULL);
INSERT INTO "ingredients" VALUES (114,'nutritional yeast',NULL,'spices',0,NULL,NULL,1,0,'nutritional yeast',0,0,NULL);
INSERT INTO "ingredients" VALUES (116,'flour','','pantry',0,NULL,NULL,1,0,'flour',0,1,NULL);
INSERT INTO "ingredients" VALUES (117,'date syrup','','pantry',0,NULL,NULL,1,0,'date syrup',0,0,NULL);
INSERT INTO "ingredients" VALUES (118,'syrup','','fridge',0,NULL,NULL,1,0,'syrup',0,0,NULL);
INSERT INTO "ingredients" VALUES (119,'honey','','pantry',0,NULL,NULL,1,0,'honey',0,0,NULL);
INSERT INTO "ingredients" VALUES (120,'jam','','fridge',0,NULL,NULL,1,0,'jam',0,0,NULL);
INSERT INTO "ingredients" VALUES (121,'nocciolata','','cereal cabinet',0,NULL,NULL,1,0,'nocciolata',0,0,NULL);
INSERT INTO "ingredients" VALUES (122,'almond butter','','cereal cabinet',0,NULL,NULL,1,0,'almond butter',0,0,NULL);
INSERT INTO "ingredients" VALUES (123,'pistachio butter','','cereal cabinet',0,NULL,NULL,1,0,'pistachio butter',0,0,NULL);
INSERT INTO "ingredients" VALUES (124,'coffee','','freezer',0,NULL,NULL,1,0,'coffee',0,0,NULL);
INSERT INTO "ingredients" VALUES (125,'yogurt','','fridge',0,NULL,NULL,1,0,'yogurt',0,0,NULL);
INSERT INTO "ingredients" VALUES (127,'earth balance','','fridge',0,NULL,NULL,1,0,'earth balance',0,0,NULL);
INSERT INTO "ingredients" VALUES (128,'butter','','fridge',0,NULL,NULL,1,0,'butter',0,0,NULL);
INSERT INTO "ingredients" VALUES (129,'coconut water','','fridge',0,NULL,NULL,1,0,'coconut water',0,0,NULL);
INSERT INTO "ingredients" VALUES (130,'tofu','firm','fridge',0,NULL,NULL,1,0,'tofu',0,0,NULL);
INSERT INTO "ingredients" VALUES (131,'ramen','','pantry',0,NULL,NULL,1,0,'ramen',0,0,NULL);
INSERT INTO "ingredients" VALUES (132,'veganaise','','fridge',0,NULL,NULL,1,0,'veganaise',0,0,NULL);
INSERT INTO "ingredients" VALUES (133,'breakfast links','beyond beef','freezer',0,NULL,NULL,1,0,'breakfast links',0,0,NULL);
INSERT INTO "ingredients" VALUES (134,'black pepper',NULL,'spices',0,NULL,NULL,1,0,'black pepper',0,0,NULL);
INSERT INTO "ingredients" VALUES (135,'chuck','Impossible','fridge',0,NULL,NULL,1,0,'chuck',0,0,NULL);
INSERT INTO "ingredients" VALUES (137,'cashews','raw','cereal cabinet',0,NULL,NULL,1,0,'cashews',0,0,NULL);
INSERT INTO "ingredients" VALUES (138,'garlic powder',NULL,'spices',0,NULL,NULL,1,0,'garlic powder',0,0,NULL);
INSERT INTO "ingredients" VALUES (139,'basil','dried','spices',0,NULL,NULL,1,0,'basil',0,0,NULL);
INSERT INTO "ingredients" VALUES (140,'oregano','dried','spices',0,NULL,NULL,1,0,'oregano',0,0,NULL);
INSERT INTO "ingredients" VALUES (141,'lasagna noodles','no-boil','pantry',0,NULL,NULL,1,0,'lasagna noodles',0,0,NULL);
INSERT INTO "ingredients" VALUES (142,'parmesan','vegan','fridge',0,NULL,NULL,1,0,'parmesan',0,0,NULL);
INSERT INTO "ingredients" VALUES (143,'basil','fresh','fridge',0,NULL,NULL,1,0,'basil',0,0,NULL);
INSERT INTO "ingredients" VALUES (147,'pine nuts',NULL,'freezer',0,NULL,NULL,1,0,'pine nuts',0,0,NULL);
INSERT INTO "ingredients" VALUES (150,'salt',NULL,'spices',0,NULL,NULL,1,0,'salt',0,1,NULL);
INSERT INTO "ingredients" VALUES (151,'flour','all purpose','pantry',0,'','',1,0,'flour',0,1,NULL);
INSERT INTO "ingredients" VALUES (152,'granulated sugar',NULL,'pantry',0,NULL,NULL,1,0,'granulated sugar',0,0,NULL);
INSERT INTO "ingredients" VALUES (153,'baking powder',NULL,'spices',0,NULL,NULL,1,0,'baking powder',0,0,NULL);
INSERT INTO "ingredients" VALUES (155,'oat milk',NULL,'fridge',0,NULL,NULL,1,0,'oat milk',0,0,NULL);
INSERT INTO "ingredients" VALUES (157,'apple cider vinegar',NULL,'above fridge',0,NULL,NULL,1,0,'apple cider vinegar',0,0,NULL);
INSERT INTO "ingredients" VALUES (158,'canola oil',NULL,'pantry',0,NULL,NULL,1,0,'canola oil',0,0,NULL);
INSERT INTO "ingredients" VALUES (159,'sesame oil','','pantry',0,'','',1,0,'sesame oil',0,0,NULL);
INSERT INTO "ingredients" VALUES (160,'broth','vegetable','fridge',0,'','',1,0,'broth',0,0,NULL);
INSERT INTO "ingredients" VALUES (161,'lentils','red','pantry',0,'','',1,0,'lentils',0,0,NULL);
INSERT INTO "ingredients" VALUES (162,'cumin','ground','spices',0,'','',1,0,'cumin',0,0,NULL);
INSERT INTO "ingredients" VALUES (163,'coriander','ground','spices',0,'','',1,0,'coriander',0,0,NULL);
INSERT INTO "ingredients" VALUES (164,'turmeric','ground','spices',0,'','',1,0,'turmeric',0,0,NULL);
INSERT INTO "ingredients" VALUES (165,'cardamom','ground','spices',0,'','',1,0,'cardamom',0,0,NULL);
INSERT INTO "ingredients" VALUES (166,'cinnamon','ground','spices',0,'','',1,0,'cinnamon',0,0,NULL);
INSERT INTO "ingredients" VALUES (167,'tomato paste','','fridge',0,'','',1,0,'tomato paste',0,0,NULL);
INSERT INTO "ingredients" VALUES (168,'vegan yogurt','','fridge',0,'','',1,0,'vegan yogurt',0,0,NULL);
INSERT INTO "ingredients" VALUES (170,'nutritional yeast','','spices',0,'','butt',1,0,'nutritional yeast',0,0,NULL);
INSERT INTO "ingredients" VALUES (171,'Banquo''s Ghosticles','Pee Pee Edition','',0,'large','Don''t do pee pee',1,0,'Banquo''s Ghosticles',0,0,NULL);
INSERT INTO "ingredients" VALUES (172,'apple cider vinegar','Pee Pee Edition','',0,'large',NULL,1,0,'apple cider vinegar',0,0,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (34,1,151,NULL,'2.25','cup',NULL,0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (35,1,152,NULL,'3','tbsp',NULL,0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (36,1,153,NULL,'1.5','tbsp',NULL,0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (37,1,150,NULL,'0.75','tsp',NULL,0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (38,1,155,NULL,'1.5','cup',NULL,0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (39,1,9,NULL,'0.5','cup',NULL,0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (40,1,157,NULL,'2','tsp',NULL,0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (41,1,158,NULL,'3','tbsp',NULL,0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (81,5,159,NULL,'1','tbsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (82,5,32,NULL,'1','cup','finely chopped',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (83,5,33,NULL,'2','clove','finely chopped',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (84,5,160,NULL,'3','cup','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (85,5,161,NULL,'1','cup','rinsed and picked over',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (86,5,162,NULL,'1','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (87,5,163,NULL,'1','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (88,5,164,NULL,'1','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (89,5,165,NULL,'0.25','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (90,5,166,NULL,'0.25','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (91,5,167,NULL,'2','tbsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (92,5,150,NULL,'1','tsp','or to taste',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (93,5,168,NULL,'','','garnish',1,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (182,3,147,NULL,'0.75','cup','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (183,3,114,NULL,'0.25','cup','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (184,3,150,NULL,'0.5','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (185,3,138,NULL,'99','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (274,2,94,NULL,'2','tbsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (275,2,32,NULL,'1','','chopped',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (276,2,23,NULL,'2','','chopped',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (277,2,34,NULL,'8','oz','chopped',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (278,2,150,NULL,'0.5','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (279,2,36,NULL,'10','oz','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (280,2,33,NULL,'2','clove','pressed or minced',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (281,2,134,NULL,'to taste','','freshly ground',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (282,2,135,NULL,'12','oz','',1,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (283,2,137,NULL,'1','cup','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (284,2,130,NULL,'4','oz','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (285,2,170,NULL,'0.5','cup','',0,NULL,NULL,'butt');
INSERT INTO "recipe_ingredient_map" VALUES (286,2,19,NULL,'0.25','cup','',0,NULL,NULL,'≈1 lemon');
INSERT INTO "recipe_ingredient_map" VALUES (287,2,150,NULL,'0.5','tbsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (288,2,139,NULL,'2','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (289,2,140,NULL,'2','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (290,2,138,NULL,'1','tsp','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (291,2,9,NULL,'0.5','cup','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (292,2,93,NULL,'4.5','cup','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (293,2,141,NULL,'18','','',0,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (294,2,142,NULL,'','','',1,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (295,2,143,NULL,'','','',1,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_map" VALUES (296,18,172,NULL,'77','drop','fleeeped',0,NULL,1,'Don''t do pee pee');
INSERT INTO "recipe_ingredient_substitutes" VALUES (2,3,'3',NULL,23,NULL,'medium','chopped');
INSERT INTO "recipe_ingredient_substitutes" VALUES (4,29,NULL,NULL,114,NULL,NULL,NULL);
INSERT INTO "recipe_ingredient_substitutes" VALUES (5,42,'1','tbsp',94,'extra-virgin','','');
INSERT INTO "recipe_sections" VALUES (1,2,'Filling',1);
INSERT INTO "recipe_sections" VALUES (2,2,'Cashew Cream',2);
INSERT INTO "recipe_sections" VALUES (3,2,'Assembly',3);
INSERT INTO "recipe_sections" VALUES (8,3,'Alpha',1);
INSERT INTO "recipe_sections" VALUES (9,3,'Bravo',2);
INSERT INTO "recipe_sections" VALUES (10,3,'Charlie',3);
INSERT INTO "recipe_steps" VALUES (1,1,5,'In a large bowl, whisk together the flour, baking powder, salt and sugar.','step');
INSERT INTO "recipe_steps" VALUES (2,1,1,'Pour the milk, water and oil into the bowl with the dry ingredients, and stir with a large spoon until just combined. A few lumps are okay. Don‘t over-mix or your pancakes won''t be as fluffy.','step');
INSERT INTO "recipe_steps" VALUES (3,1,3,'Heat a large griddle or pan over medium-high heat.','step');
INSERT INTO "recipe_steps" VALUES (4,1,2,'Grease the pan with vegan butter and drop about ⅓ by cup of the batter onto it.','step');
INSERT INTO "recipe_steps" VALUES (5,1,4,'Cook until bubbles form, then flip and cook until golden brown on the other side, about 1-2 minutes.','step');
INSERT INTO "recipe_steps" VALUES (26,5,1,'In a 3-quart stockpot or other medium-sized soup pot, heat the sesame oil over medium heat.','step');
INSERT INTO "recipe_steps" VALUES (27,5,2,'Once the oil is hot, add the onion and garlic. Cook, stirring often, until the onion is translucent, about 6 minutes.','step');
INSERT INTO "recipe_steps" VALUES (28,5,3,'Stirring constantly, add the broth, lentils, and spices (but not the salt).','step');
INSERT INTO "recipe_steps" VALUES (29,5,4,'Bring to a low boil, then reduce the heat to low, cover, and simmer for about 20 minutes, or until lentils are very tender.','step');
INSERT INTO "recipe_steps" VALUES (30,5,5,'Stir in the tomato paste and salt until well combined.','step');
INSERT INTO "recipe_steps" VALUES (31,5,6,'Cook several minutes more, or until the soup reaches the desired consistency, adding more water if needed.','step');
INSERT INTO "recipe_steps" VALUES (25,5,7,'Gather the ingredients.','step');
INSERT INTO "recipe_steps" VALUES (32,5,8,'Garnish with a dollop of vegan yogurt.','step');
INSERT INTO "recipe_steps" VALUES (33,3,1,'Filling','heading');
INSERT INTO "recipe_steps" VALUES (36,3,1,'Flavors.','step');
INSERT INTO "recipe_steps" VALUES (39,3,1,'Butts.','step');
INSERT INTO "recipe_steps" VALUES (34,3,2,'Funky nuggests.','step');
INSERT INTO "recipe_steps" VALUES (37,3,2,'Ganache','heading');
INSERT INTO "recipe_steps" VALUES (35,3,3,'Smurfs.','step');
INSERT INTO "recipe_steps" VALUES (38,3,3,'Smurves.','step');
INSERT INTO "recipe_steps" VALUES (6,2,1,'Preheat the oven to 425°F.','step');
INSERT INTO "recipe_steps" VALUES (7,2,2,'In a large skillet over medium heat, warm the olive oil.','step');
INSERT INTO "recipe_steps" VALUES (8,2,3,'Once shimmering, add the onion, carrots, mushrooms, salt and several twists of black pepper.','step');
INSERT INTO "recipe_steps" VALUES (9,2,4,'Cook, stirring every couple of minutes; at about 4 minutes add the chuck if using, then continue cooking until most of the moisture is gone and the vegetables are tender and turning golden on the edges, and the chuck is browned.','step');
INSERT INTO "recipe_steps" VALUES (10,2,5,'Add spinach and cook until wilted.','step');
INSERT INTO "recipe_steps" VALUES (11,2,6,'Add the garlic and cook until fragrant, stirring constantly, about 30 seconds.','step');
INSERT INTO "recipe_steps" VALUES (12,2,7,'Remove the skillet from the heat and season to taste with salt and pepper.','step');
INSERT INTO "recipe_steps" VALUES (13,2,8,'In a blender, combine the cashew cream ingredients.','step');
INSERT INTO "recipe_steps" VALUES (14,2,9,'Blend until the mixture is smooth and creamy, stopping to scrape down the sides as necessary.','step');
INSERT INTO "recipe_steps" VALUES (15,2,10,'Set aside.','step');
INSERT INTO "recipe_steps" VALUES (16,2,11,'Assemble the lasagne in a 9x13 inch baking dish by layering: 1 cup tomato sauce, 6 noodles, ½ cup cashew ricotta, half of the veggies, 1 cup tomato sauce, 6 noodles, ½ cup cashew ricotta, remaining veggies, 1 cup tomato sauce, 6 noodles, and finish with 1 cup tomato sauce.','step');
INSERT INTO "recipe_steps" VALUES (17,2,12,'Wrap a sheet of heavy duty aluminum foil around the top of the lasagna, making sure it’s taut so it doesn’t touch the top.','step');
INSERT INTO "recipe_steps" VALUES (18,2,13,'Bake, covered, for 25 minutes at 425°F.','step');
INSERT INTO "recipe_steps" VALUES (19,2,14,'Remove the foil, rotate the pan by 180°, and continue cooking for about 5 to 10 more minutes, until it’s steaming and lightly bubbling at the corners.','step');
INSERT INTO "recipe_steps" VALUES (20,2,15,'Remove the pan from the oven and let the lasagna cool for 15 to 20 minutes before serving, so it has time to set and cool down to a reasonable temperature.','step');
INSERT INTO "recipe_steps" VALUES ('tmp-step-1765411724945',18,1,'','step');
INSERT INTO "recipes" VALUES (1,'Pancakes',4,2,8);
INSERT INTO "recipes" VALUES (2,'Lasagna',6,6,6);
INSERT INTO "recipes" VALUES (3,'Vegan Parmesan',NULL,NULL,NULL);
INSERT INTO "recipes" VALUES (5,'Red Lentil Dahl',6,2,12);
INSERT INTO "recipes" VALUES (18,'Um Beefies',NULL,NULL,NULL);
INSERT INTO "recipes" VALUES (28,'Newone',NULL,NULL,NULL);
INSERT INTO "size_classes" VALUES ('small',1);
INSERT INTO "size_classes" VALUES ('medium',2);
INSERT INTO "size_classes" VALUES ('large',3);
INSERT INTO "store_locations" VALUES (1,1,'produce',NULL,1);
INSERT INTO "store_locations" VALUES (2,1,'health and beauty',NULL,2);
INSERT INTO "store_locations" VALUES (3,1,'frozen food',NULL,3);
INSERT INTO "store_locations" VALUES (4,1,'cleaning products',NULL,4);
INSERT INTO "store_locations" VALUES (5,1,'pasta',NULL,5);
INSERT INTO "store_locations" VALUES (6,1,'bakery',NULL,6);
INSERT INTO "store_locations" VALUES (7,1,'snack foods',NULL,7);
INSERT INTO "store_locations" VALUES (8,1,'deli',NULL,8);
INSERT INTO "store_locations" VALUES (9,1,'breakfast',NULL,9);
INSERT INTO "store_locations" VALUES (10,1,'baking',NULL,10);
INSERT INTO "store_locations" VALUES (11,1,'dairy',NULL,11);
INSERT INTO "stores" VALUES (1,'Whole Foods','ocean avenue');
INSERT INTO "units" VALUES ('tsp','teaspoon','teaspoons','volume',10,0);
INSERT INTO "units" VALUES ('tbsp','tablespoon','tablespoons','volume',11,0);
INSERT INTO "units" VALUES ('cup','cup','cups','volume',12,0);
INSERT INTO "units" VALUES ('pt','pint','pints','volume',13,0);
INSERT INTO "units" VALUES ('qt','quart','quarts','volume',14,0);
INSERT INTO "units" VALUES ('gal','gallon','gallons','volume',15,0);
INSERT INTO "units" VALUES ('floz','fluid ounce','fluid ounces','volume',16,0);
INSERT INTO "units" VALUES ('ml','milliliter','milliliters','volume',20,0);
INSERT INTO "units" VALUES ('l','liter','liters','volume',21,0);
INSERT INTO "units" VALUES ('g','gram','grams','mass',30,0);
INSERT INTO "units" VALUES ('kg','kilogram','kilograms','mass',31,0);
INSERT INTO "units" VALUES ('oz','ounce','ounces','mass',32,0);
INSERT INTO "units" VALUES ('lb','pound','pounds','mass',33,0);
INSERT INTO "units" VALUES ('each','each','each','count',40,0);
INSERT INTO "units" VALUES ('pkg','package','packages','count',41,0);
INSERT INTO "units" VALUES ('can','can','cans','count',42,0);
INSERT INTO "units" VALUES ('jar','jar','jars','count',43,0);
INSERT INTO "units" VALUES ('bunch','bunch','bunches','count',44,0);
INSERT INTO "units" VALUES ('clove','clove','cloves','count',45,0);
INSERT INTO "units" VALUES ('slice','slice','slices','count',46,0);
INSERT INTO "units" VALUES ('pinch','pinch','pinches','misc',50,0);
INSERT INTO "units" VALUES ('dash','dash','dashes','misc',51,0);
INSERT INTO "units" VALUES ('drop','drop','drops','misc',52,0);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ingredient_sizes_unique" ON "ingredient_sizes" (
	"ingredient_id",
	lower("size")
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ingredient_variants_unique" ON "ingredient_variants" (
	"ingredient_id",
	lower("variant")
);
CREATE INDEX IF NOT EXISTS "idx_rih_recipe_section_sort" ON "recipe_ingredient_headings" (
	"recipe_id",
	"section_id",
	"sort_order",
	"ID"
);
CREATE INDEX IF NOT EXISTS "idx_rim_recipe_paren" ON "recipe_ingredient_map" (
	"recipe_id",
	"parenthetical_note"
);
CREATE INDEX IF NOT EXISTS "idx_rim_recipe_section_sort" ON "recipe_ingredient_map" (
	"recipe_id",
	"section_id",
	"sort_order",
	"ID"
);
CREATE INDEX IF NOT EXISTS "idx_substitutes_recipe_ingredient_id" ON "recipe_ingredient_substitutes" (
	"recipe_ingredient_id"
);
COMMIT;
