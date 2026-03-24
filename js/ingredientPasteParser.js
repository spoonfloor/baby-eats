// Ingredient paste parser helpers (qty/unit/name/prep/optional + range/approx).
(function () {
  'use strict';

  const OPTIONAL_PATTERNS = [
    /\boptional\b/i,
    /\bto taste\b/i,
    /\bas needed\b/i,
    /\bif desired\b/i,
  ];

  const UNIT_ALIASES = {
    teaspoon: 'tsp',
    teaspoons: 'tsp',
    tsp: 'tsp',
    tablespoon: 'tbsp',
    tablespoons: 'tbsp',
    tbs: 'tbsp',
    tbsp: 'tbsp',
    ounce: 'oz',
    ounces: 'oz',
    oz: 'oz',
    pound: 'lb',
    pounds: 'lb',
    lb: 'lb',
    lbs: 'lb',
    cup: 'cup',
    cups: 'cup',
    clove: 'clove',
    cloves: 'clove',
    can: 'can',
    cans: 'can',
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

  function detectOptional(rawLine) {
    const line = String(rawLine || '');
    return OPTIONAL_PATTERNS.some((rx) => rx.test(line));
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
    const t = String(token || '').trim();
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
    const src = String(text || '').trim();
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
    const src = String(text || '').trim();
    if (!src) {
      return {
        quantity: '',
        quantityMin: null,
        quantityMax: null,
        quantityIsApprox: false,
        rest: '',
      };
    }

    const approxRegex = /^(about|approx(?:\.|imately)?|around|~)\s+/i;
    let rest = src;
    let isApprox = false;
    const approxMatch = rest.match(approxRegex);
    if (approxMatch) {
      isApprox = true;
      rest = rest.slice(approxMatch[0].length).trim();
    }

    const numToken = '(\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])';
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

    const m = src.match(/^([A-Za-z]+\.?)(?:\s+|$)(.*)$/);
    if (!m) return { unit: '', rest: src };

    const rawUnit = m[1].replace(/\.$/, '').toLowerCase();
    const mapped = UNIT_ALIASES[rawUnit];
    if (!mapped) return { unit: '', rest: src };

    return {
      unit: mapped,
      rest: String(m[2] || '').trim(),
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

  function parseIngredientLine(line) {
    const raw = normalizeWhitespace(line);
    if (!raw) return null;

    const optional = detectOptional(raw);
    const split = splitPrepNotes(raw);
    const qtyParsed = parseQuantityDescriptor(split.head);
    const unitParsed = parseLeadingUnit(qtyParsed.rest);

    const name = stripOptionalLanguage(unitParsed.rest || qtyParsed.rest || split.head);
    const prep = stripOptionalLanguage(split.prepNotes || '');

    return {
      quantity: qtyParsed.quantity,
      quantityMin: qtyParsed.quantityMin,
      quantityMax: qtyParsed.quantityMax,
      quantityIsApprox: !!qtyParsed.quantityIsApprox,
      unit: unitParsed.unit || '',
      name: name || raw,
      variant: '',
      size: '',
      prepNotes: prep,
      parentheticalNote: '',
      isOptional: !!optional,
      substitutes: [],
      locationAtHome: '',
      subRecipeId: null,
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
