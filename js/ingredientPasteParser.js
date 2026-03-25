// Ingredient paste parser helpers (qty/unit/name/prep/optional + range/approx).
(function () {
  'use strict';

  const OPTIONAL_PATTERNS = [
    /\boptional\b/i,
    /\bif desired\b/i,
  ];
  const QUALITATIVE_AMOUNT_PATTERNS = [/\bto taste\b/i, /\bas needed\b/i];
  // Product-driven compounds that should stay as full ingredient names.
  // These are lexicalized ingredients, not adjective+base variant pairs.
  const PROTECTED_COMPOUND_NAMES = new Set(
    [
      'green onion',
      'spring onion',
      'bell pepper',
      'chile pepper',
      'jalapeno pepper',
      'serrano pepper',
      'sweet potato',
      'green bean',
      'snap pea',
      'snow pea',
      'bok choy',
      'brussels sprout',
      'baby spinach',
      'garbanzo bean',
      'black-eyed pea',
      'soy sauce',
      'fish sauce',
      'worcestershire sauce',
      'coconut milk',
      'peanut butter',
      'black pepper',
      'white pepper',
      'red pepper',
      'corn syrup',
      'baking soda',
      'baking powder',
      'vanilla extract',
      'orange extract',
    ].map((v) => String(v || '').toLowerCase())
  );

  function normalizeDash(text) {
    return String(text || '')
      .replace(/[‐‑–—]/g, '-')
      .replace(/\s*-\s*/g, '-');
  }

  function singularizeSimpleNoun(noun) {
    const n = String(noun || '').trim().toLowerCase();
    if (!n) return '';
    if (n === 'tomatoes') return 'tomato';
    if (n.endsWith('ies') && n.length > 3) return `${n.slice(0, -3)}y`;
    if (n.endsWith('es') && /(ches|shes|xes|zes|ses)$/.test(n)) {
      return n.slice(0, -2);
    }
    if (n.endsWith('s') && !n.endsWith('ss')) return n.slice(0, -1);
    return n;
  }

  function splitIngredientNameAndVariant(nameText) {
    const raw = normalizeWhitespace(nameText);
    if (!raw) return { name: '', variant: '' };
    const lower = raw.toLowerCase();
    if (PROTECTED_COMPOUND_NAMES.has(lower)) {
      return { name: raw, variant: '' };
    }

    // Keep these as distinct ingredients, not "oil" variants.
    if (lower === 'olive oil' || lower === 'sesame oil') {
      return { name: lower, variant: '' };
    }

    // High-confidence targeted split: olive oil style variants.
    const oliveMatch = normalizeDash(lower).match(
      /^(extra-virgin|virgin|light)\s+olive oil$/
    );
    if (oliveMatch) {
      return {
        name: 'olive oil',
        variant: oliveMatch[1],
      };
    }

    // High-confidence targeted split: sesame oil style variants.
    const sesameMatch = normalizeDash(lower).match(/^(toasted|dark|light)\s+sesame oil$/);
    if (sesameMatch) {
      return {
        name: 'sesame oil',
        variant: sesameMatch[1],
      };
    }

    // Group generic oils under "oil", preserving source modifier as variant.
    // e.g., "canola oil" -> { name: "oil", variant: "canola" }
    const genericOilMatch = lower.match(/^([a-z][a-z-]*(?:\s+[a-z][a-z-]*)?)\s+oil$/);
    if (genericOilMatch) {
      const oilType = normalizeWhitespace(genericOilMatch[1] || '');
      if (oilType && oilType !== 'olive' && oilType !== 'sesame') {
        return {
          name: 'oil',
          variant: oilType,
        };
      }
    }

    // High-confidence tomato processing descriptors.
    const tomatoMatch = normalizeDash(lower).match(
      /^(crushed|diced|whole|peeled|stewed|fire-roasted|roasted|sun-dried)\s+tomatoes?$/
    );
    if (tomatoMatch) {
      return {
        name: 'tomato',
        variant: tomatoMatch[1],
      };
    }

    return { name: raw, variant: '' };
  }

  const UNIT_ALIASES = {
    t: 'tsp',
    teaspoon: 'tsp',
    teaspoons: 'tsp',
    tsp: 'tsp',
    'tsp.': 'tsp',
    tb: 'tbsp',
    tbl: 'tbsp',
    tbspn: 'tbsp',
    tablespoon: 'tbsp',
    tablespoons: 'tbsp',
    tbs: 'tbsp',
    tbsp: 'tbsp',
    'tbsp.': 'tbsp',
    floz: 'fl oz',
    'fl.oz': 'fl oz',
    'fl oz': 'fl oz',
    fluidounce: 'fl oz',
    fluidounces: 'fl oz',
    c: 'cup',
    ounce: 'oz',
    ounces: 'oz',
    oz: 'oz',
    pound: 'lb',
    pounds: 'lb',
    lb: 'lb',
    lbs: 'lb',
    pt: 'pt',
    pint: 'pt',
    pints: 'pt',
    qt: 'qt',
    quart: 'qt',
    quarts: 'qt',
    g: 'g',
    gram: 'g',
    grams: 'g',
    kg: 'kg',
    kilogram: 'kg',
    kilograms: 'kg',
    cup: 'cup',
    cups: 'cup',
    clove: 'clove',
    cloves: 'clove',
    can: 'can',
    cans: 'can',
    bunch: 'bunch',
    bunches: 'bunch',
  };

  const UNICODE_FRACTIONS = {
    '¼': 0.25,
    '½': 0.5,
    '¾': 0.75,
    '⅓': 1 / 3,
    '⅔': 2 / 3,
    '⅛': 0.125,
    '⅜': 0.375,
    '⅝': 0.625,
    '⅞': 0.875,
  };

  function normalizeWhitespace(text) {
    return String(text || '')
      .replace(/\r/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function toFractionAscii(ch) {
    const val = UNICODE_FRACTIONS[ch];
    if (val == null) return null;
    const map = {
      0.25: '1/4',
      0.5: '1/2',
      0.75: '3/4',
      0.3333333333333333: '1/3',
      0.6666666666666666: '2/3',
      0.125: '1/8',
      0.375: '3/8',
      0.625: '5/8',
      0.875: '7/8',
    };
    return map[val] || null;
  }

  function normalizeUnicodeFractionsInText(text) {
    let out = String(text || '');
    out = out.replace(
      /(\d)\s*([¼½¾⅓⅔⅛⅜⅝⅞])/g,
      (_, whole, frac) => `${whole} ${toFractionAscii(frac) || frac}`
    );
    out = out.replace(/([¼½¾⅓⅔⅛⅜⅝⅞])/g, (m) => toFractionAscii(m) || m);
    return out;
  }

  function detectOptional(rawLine) {
    const line = String(rawLine || '');
    return OPTIONAL_PATTERNS.some((rx) => rx.test(line));
  }

  function extractQualitativeAmountPhrases(text) {
    let src = normalizeWhitespace(text);
    const phrases = [];
    if (!src) return { text: '', phrases: [] };

    const addPhrase = (value) => {
      const next = normalizeWhitespace(value || '').toLowerCase();
      if (!next) return;
      if (!phrases.includes(next)) phrases.push(next);
    };

    const leading = src.match(/^(as needed|to taste)\s*,?\s+(.+)$/i);
    if (leading) {
      addPhrase(leading[1]);
      src = normalizeWhitespace(leading[2]);
    }

    const trailing = src.match(/^(.+?)\s+(to taste|as needed)$/i);
    if (trailing) {
      src = normalizeWhitespace(trailing[1]);
      addPhrase(trailing[2]);
    }

    return { text: src, phrases };
  }

  function stripOptionalLanguage(text) {
    let out = String(text || '');
    OPTIONAL_PATTERNS.forEach((rx) => {
      out = out.replace(new RegExp(rx.source, 'gi'), '');
    });
    out = out.replace(/\(\s*,*\s*\)/g, '');
    out = out.replace(/\s+,/g, ',');
    return normalizeWhitespace(out).replace(/^[,;:\-]\s*/, '').trim();
  }

  function parseFractionText(token) {
    const t = normalizeUnicodeFractionsInText(String(token || '')).trim();
    if (!t) return null;

    if (UNICODE_FRACTIONS[t] != null) return UNICODE_FRACTIONS[t];

    const mixed = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) {
      const whole = Number(mixed[1]);
      const num = Number(mixed[2]);
      const den = Number(mixed[3]);
      if (den !== 0) return whole + num / den;
      return null;
    }

    const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) {
      const num = Number(frac[1]);
      const den = Number(frac[2]);
      if (den !== 0) return num / den;
      return null;
    }

    if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
    return null;
  }

  function parseLeadingQuantity(text) {
    const src = normalizeUnicodeFractionsInText(String(text || '').trim());
    if (!src) return { quantity: '', rest: '' };

    const qtyMatch = src.match(
      /^(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\b\s*(.*)$/
    );
    if (!qtyMatch) return { quantity: '', rest: src };

    const quantity = parseFractionText(qtyMatch[1]);
    return {
      quantity: quantity == null ? '' : quantity,
      rest: String(qtyMatch[2] || '').trim(),
    };
  }

  function parseQuantityDescriptor(text) {
    const src = normalizeUnicodeFractionsInText(
      String(text || '')
        .replace(/[–—]/g, '-')
        .trim()
    );
    if (!src) {
      return {
        quantity: '',
        quantityMin: null,
        quantityMax: null,
        quantityIsApprox: false,
        rest: '',
      };
    }

    const approxRegex = /^(about|approx(?:\.|imately)?|around|roughly|~)\s+/i;
    let rest = src;
    let isApprox = false;
    const approxMatch = rest.match(approxRegex);
    if (approxMatch) {
      isApprox = true;
      rest = rest.slice(approxMatch[0].length).trim();
    }

    const numToken = '(\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])';
    const plusRx = new RegExp(`^${numToken}\\s*\\+\\s*${numToken}\\b\\s*(.*)$`, 'i');
    const plusMatch = rest.match(plusRx);
    if (plusMatch) {
      const left = parseFractionText(plusMatch[1]);
      const right = parseFractionText(plusMatch[2]);
      const sum =
        Number.isFinite(left) && Number.isFinite(right)
          ? Number(left) + Number(right)
          : null;
      const tail = String(plusMatch[3] || '').trim();
      return {
        quantity: `${isApprox ? 'about ' : ''}${plusMatch[1]} + ${plusMatch[2]}`.trim(),
        quantityMin: Number.isFinite(sum) ? sum : null,
        quantityMax: Number.isFinite(sum) ? sum : null,
        quantityIsApprox: isApprox,
        rest: tail,
      };
    }

    const rangeRx = new RegExp(`^${numToken}\\s*(?:to|-)\\s*${numToken}\\b\\s*(.*)$`, 'i');
    const rangeMatch = rest.match(rangeRx);
    if (rangeMatch) {
      const min = parseFractionText(rangeMatch[1]);
      const max = parseFractionText(rangeMatch[2]);
      const tail = String(rangeMatch[3] || '').trim();
      const normalizedMin = Number.isFinite(min) ? min : null;
      const normalizedMax = Number.isFinite(max) ? max : null;
      const qtyText = `${isApprox ? 'about ' : ''}${rangeMatch[1]} to ${rangeMatch[2]}`;
      return {
        quantity: qtyText.trim(),
        quantityMin: normalizedMin,
        quantityMax: normalizedMax,
        quantityIsApprox: isApprox,
        rest: tail,
      };
    }

    const single = parseLeadingQuantity(rest);
    if (single.quantity !== '') {
      const qtyText = `${isApprox ? 'about ' : ''}${String(rest).match(
        /^(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])/
      )?.[1] || ''}`.trim();
      const qNum = Number(single.quantity);
      const asNumber = Number.isFinite(qNum) ? qNum : null;
      return {
        quantity: isApprox ? qtyText : single.quantity,
        quantityMin: asNumber,
        quantityMax: asNumber,
        quantityIsApprox: isApprox,
        rest: single.rest,
      };
    }

    return {
      quantity: '',
      quantityMin: null,
      quantityMax: null,
      quantityIsApprox: false,
      rest: src,
    };
  }

  function parseLeadingUnit(text) {
    const src = String(text || '').trim();
    if (!src) return { unit: '', rest: '' };

    const m2 = src.match(/^([A-Za-z]+\.?)\s+([A-Za-z]+\.?)(?:\s+|$)(.*)$/);
    if (m2) {
      const twoWordRaw = `${m2[1]} ${m2[2]}`
        .toLowerCase()
        .replace(/\./g, '')
        .trim();
      const twoWordMapped = UNIT_ALIASES[twoWordRaw];
      if (twoWordMapped) {
        return {
          unit: twoWordMapped,
          rest: String(m2[3] || '').trim(),
        };
      }
    }

    const m1 = src.match(/^([A-Za-z]+\.?)(?:\s+|$)(.*)$/);
    if (!m1) return { unit: '', rest: src };
    const rawUnit = m1[1].toLowerCase().replace(/\.$/, '');
    const mapped = UNIT_ALIASES[rawUnit] || UNIT_ALIASES[`${rawUnit}.`];
    if (!mapped) return { unit: '', rest: src };

    return {
      unit: mapped,
      rest: String(m1[2] || '').trim(),
    };
  }

  function splitPrepNotes(text) {
    const src = String(text || '');
    const commaIdx = src.indexOf(',');
    if (commaIdx === -1) {
      return { head: normalizeWhitespace(src), prepNotes: '' };
    }
    const head = normalizeWhitespace(src.slice(0, commaIdx));
    const prep = normalizeWhitespace(src.slice(commaIdx + 1));
    return { head, prepNotes: prep };
  }

  function extractParenthetical(text) {
    const src = String(text || '');
    const m = src.match(/\(([^)]*)\)/);
    if (!m) return { text: src, parenthetical: '' };
    const inner = normalizeWhitespace(m[1]);
    const next = normalizeWhitespace(src.replace(m[0], ' '));
    return {
      text: next,
      parenthetical: inner,
    };
  }

  function extractHeapingQualifier(text) {
    const src = String(text || '').trim();
    const m = src.match(/^heaping\s+(.*)$/i);
    if (!m) return { text: src, heaping: '' };
    return {
      text: String(m[1] || '').trim(),
      heaping: 'heaping',
    };
  }

  function parseContainerMultiplier(quantityParsed) {
    if (!quantityParsed || quantityParsed.quantityMin == null) return null;
    const src = String(quantityParsed.rest || '').trim();
    if (!src) return null;

    const m = src.match(
      /^(?:x|×)\s+(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s+([A-Za-z]+\.?)\s+(cans?|bottles?|jars?|boxes?|packages?|pkgs?)\b\s*(.*)$/i
    );
    if (!m) return null;

    const packQtyRaw = String(m[1] || '').trim();
    const packUnitRaw = String(m[2] || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const containerRaw = String(m[3] || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const tail = String(m[4] || '').trim();
    const packUnit = UNIT_ALIASES[packUnitRaw] || packUnitRaw;
    const containerUnit = UNIT_ALIASES[containerRaw] || containerRaw;
    const size = normalizeWhitespace(`${packQtyRaw} ${packUnit}`);

    return {
      quantityText: String(quantityParsed.quantity || '').trim(),
      quantityMin: quantityParsed.quantityMin,
      quantityMax: quantityParsed.quantityMax,
      quantityIsApprox: !!quantityParsed.quantityIsApprox,
      unit: containerUnit,
      size,
      rest: tail,
    };
  }

  function parseSingleSizedContainer(quantityParsed) {
    if (!quantityParsed || quantityParsed.quantityMin == null) return null;
    const src = String(quantityParsed.rest || '').trim();
    if (!src) return null;

    const m = src.match(
      /^([A-Za-z]+\.?)\s+(cans?|bottles?|jars?|boxes?|packages?|pkgs?)\b\s*(.*)$/i
    );
    if (!m) return null;

    const sizeUnitRaw = String(m[1] || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const containerRaw = String(m[2] || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const tail = String(m[3] || '').trim();

    const sizeUnit = UNIT_ALIASES[sizeUnitRaw] || sizeUnitRaw;
    const containerUnit = UNIT_ALIASES[containerRaw] || containerRaw;
    const sizeAmount = String(quantityParsed.quantity || '').trim();
    const size = normalizeWhitespace(`${sizeAmount} ${sizeUnit}`);

    return {
      quantityText: '1',
      quantityMin: 1,
      quantityMax: 1,
      quantityIsApprox: false,
      unit: containerUnit,
      size,
      rest: tail,
    };
  }

  function parseIngredientLine(line) {
    const raw = normalizeWhitespace(line);
    if (!raw) return null;

    const optional = detectOptional(raw);
    const qualitative = extractQualitativeAmountPhrases(raw);
    const split = splitPrepNotes(qualitative.text || raw);
    const parentheticalSplit = extractParenthetical(split.head);
    const heapingSplit = extractHeapingQualifier(parentheticalSplit.text);
    const qtyParsed = parseQuantityDescriptor(heapingSplit.text);
    const multiplierParsed = parseContainerMultiplier(qtyParsed);
    const sizedContainerParsed = multiplierParsed
      ? null
      : parseSingleSizedContainer(qtyParsed);
    const unitParsed = multiplierParsed || sizedContainerParsed
      ? {
          unit: (multiplierParsed || sizedContainerParsed).unit,
          rest: (multiplierParsed || sizedContainerParsed).rest,
        }
      : parseLeadingUnit(qtyParsed.rest);
    const combinedPrep = normalizeWhitespace(
      [split.prepNotes, heapingSplit.heaping].filter(Boolean).join(', ')
    );

    const normalizedName = stripOptionalLanguage(
      unitParsed.rest || (multiplierParsed && multiplierParsed.rest) || qtyParsed.rest || split.head
    );
    const nameVariant = splitIngredientNameAndVariant(normalizedName);
    const prep = stripOptionalLanguage(combinedPrep || '');

    return {
      quantity: multiplierParsed || sizedContainerParsed
        ? (multiplierParsed || sizedContainerParsed).quantityText
        : qtyParsed.quantity,
      quantityMin: multiplierParsed || sizedContainerParsed
        ? (multiplierParsed || sizedContainerParsed).quantityMin
        : qtyParsed.quantityMin,
      quantityMax: multiplierParsed || sizedContainerParsed
        ? (multiplierParsed || sizedContainerParsed).quantityMax
        : qtyParsed.quantityMax,
      quantityIsApprox: multiplierParsed || sizedContainerParsed
        ? !!(multiplierParsed || sizedContainerParsed).quantityIsApprox
        : !!qtyParsed.quantityIsApprox,
      unit: unitParsed.unit || '',
      name: nameVariant.name || raw,
      variant: nameVariant.variant || '',
      size: multiplierParsed || sizedContainerParsed
        ? (multiplierParsed || sizedContainerParsed).size
        : '',
      prepNotes: prep,
      parentheticalNote: normalizeWhitespace(
        [
          stripOptionalLanguage(parentheticalSplit.parenthetical || ''),
          ...qualitative.phrases.filter(
            (phrase) => !QUALITATIVE_AMOUNT_PATTERNS.every((rx) => !rx.test(phrase))
          ),
        ]
          .filter(Boolean)
          .join(', ')
      ),
      isOptional: !!optional,
      substitutes: [],
      locationAtHome: '',
      isRecipe: false,
      linkedRecipeId: null,
      recipeText: '',
      isDeprecated: false,
    };
  }

  function parseIngredientLines(multilineText) {
    return String(multilineText || '')
      .split(/\r?\n/)
      .map((line) => parseIngredientLine(line))
      .filter((row) => !!row && !!String(row.name || '').trim());
  }

  window.parseIngredientLine = parseIngredientLine;
  window.parseIngredientLines = parseIngredientLines;
  window.parseIngredientQuantityDescriptor = parseQuantityDescriptor;
})();
