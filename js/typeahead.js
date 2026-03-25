// Reusable typeahead / type-along dropdown controller (v1)
// Designed to satisfy docs/ux/ux_ingredient-type-ahead.md

(function () {
  if (typeof window === 'undefined') return;

  // Blur-time near-match correction for ingredient name/unit/variant (Levenshtein vs pool).
  const INGREDIENT_BLUR_NORMALIZATION_ENABLED = false;

  // --- Global per-session exemption set for normalization ("Undo" exempts exact raw string)
  const normalizationExemptions = new Set();
  window._typeaheadNormalizationExemptions = normalizationExemptions;

  // --- Small toast helper (reuse global if available)
  const showUndoToast =
    typeof window.showUndoToast === 'function'
      ? window.showUndoToast
      : function showUndoToastFallback({ message, onUndo }) {
          try {
            let host = document.getElementById('typeaheadToastHost');
            if (!host) {
              host = document.createElement('div');
              host.id = 'typeaheadToastHost';
              host.className = 'typeahead-toast-host';
              document.body.appendChild(host);
            }

            const toast = document.createElement('div');
            toast.className = 'typeahead-toast';

            const msg = document.createElement('div');
            msg.className = 'typeahead-toast__msg';
            msg.textContent = message || '';
            toast.appendChild(msg);

            const undoBtn = document.createElement('button');
            undoBtn.type = 'button';
            undoBtn.className = 'typeahead-toast__undo';
            undoBtn.textContent = 'Undo';
            undoBtn.addEventListener('click', () => {
              try {
                if (typeof onUndo === 'function') onUndo();
              } finally {
                if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
              }
            });
            toast.appendChild(undoBtn);

            host.appendChild(toast);

            const t = window.setTimeout(() => {
              if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
            }, 4500);

            toast.addEventListener('mouseenter', () => {
              try {
                window.clearTimeout(t);
              } catch (_) {}
            });

            return toast;
          } catch (_) {
            return null;
          }
        };

  // --- Text helpers
  const norm = (s) => (s || '').toString().trim();
  const lower = (s) => norm(s).toLowerCase();

  // Levenshtein distance (small strings; OK for our pool sizes)
  function levenshtein(a, b) {
    a = lower(a);
    b = lower(b);
    if (a === b) return 0;
    const al = a.length;
    const bl = b.length;
    if (!al) return bl;
    if (!bl) return al;

    const v0 = new Array(bl + 1);
    const v1 = new Array(bl + 1);
    for (let i = 0; i <= bl; i++) v0[i] = i;

    for (let i = 0; i < al; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < bl; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= bl; j++) v0[j] = v1[j];
    }

    return v0[bl];
  }

  function isNearMatchCandidate(input, candidate) {
    const s = norm(input);
    const c = norm(candidate);
    if (!s || !c) return false;
    if (s.length < 3) return false; // v1 rule
    if (lower(s) === lower(c)) return false;

    const d = levenshtein(s, c);
    // Conservative heuristic (v1; exact math intentionally deferred in spec)
    // - short strings: only 1 edit
    // - longer strings: up to 2 edits
    if (s.length <= 5) return d <= 1;
    return d <= 2;
  }

  function findBestNearMatch(input, pool) {
    const s = norm(input);
    if (!s || s.length < 3) return null;

    let best = null;
    let bestD = Infinity;
    let tie = false;

    for (const cand of pool || []) {
      if (!isNearMatchCandidate(s, cand)) continue;
      const d = levenshtein(s, cand);
      if (d < bestD) {
        best = cand;
        bestD = d;
        tie = false;
      } else if (d === bestD) {
        tie = true;
      }
    }

    if (!best || tie) return null;
    return best;
  }

  function findBestNearMatchForUnit(input, pool) {
    // Units are prone to dangerous false positives (e.g., tbsp -> tsp).
    // For v1 we only attempt near-match normalization if there is a prefix relationship
    // between input and candidate (in either direction).
    const s = norm(input);
    if (!s || s.length < 3) return null;
    const sL = lower(s);

    let best = null;
    let bestD = Infinity;
    let tie = false;

    for (const cand of pool || []) {
      const c = norm(cand);
      if (!c) continue;
      const cL = lower(c);
      if (sL === cL) continue;
      const prefixOk = sL.startsWith(cL) || cL.startsWith(sL);
      if (!prefixOk) continue;
      if (!isNearMatchCandidate(s, c)) continue;
      const d = levenshtein(s, c);
      if (d < bestD) {
        best = c;
        bestD = d;
        tie = false;
      } else if (d === bestD) {
        tie = true;
      }
    }

    if (!best || tie) return null;
    return best;
  }

  // --- Pool helpers (DB-backed)
  function safeExec(db, sql, params) {
    try {
      return db.exec(sql, params);
    } catch (err) {
      console.warn('typeahead: db.exec failed', err);
      return [];
    }
  }

  function columnFromExec(result, colIdx) {
    if (!Array.isArray(result) || result.length === 0) return [];
    const vals = result[0]?.values;
    if (!Array.isArray(vals)) return [];
    return vals
      .map((row) => (Array.isArray(row) ? row[colIdx] : null))
      .map((v) => norm(v))
      .filter((v) => v.length > 0);
  }

  // --- Ranking / filtering
  function filterAndRank(pool, query) {
    const q = lower(query);
    const items = (pool || []).map((v) => norm(v)).filter((v) => v.length > 0);
    if (!q) {
      // empty query: alphabetical
      return items.sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
    }

    const matches = [];
    for (const item of items) {
      const li = lower(item);
      const idx = li.indexOf(q);
      if (idx === -1) continue;
      const isPrefix = idx === 0;
      matches.push({ item, isPrefix });
    }

    matches.sort((a, b) => {
      if (a.isPrefix !== b.isPrefix) return a.isPrefix ? -1 : 1;
      return a.item.localeCompare(b.item, undefined, { sensitivity: 'base' });
    });

    return matches.map((m) => m.item);
  }

  function filterAndRankPreservePoolOrderOnEmpty(pool, query) {
    const q = lower(query);
    const items = (pool || []).map((v) => norm(v)).filter((v) => v.length > 0);
    if (!q) {
      // Keep pool order (caller controls canonical order).
      return items;
    }
    return filterAndRank(items, q);
  }

  // --- Dropdown UI (single active instance)
  class TypeaheadDropdown {
    constructor() {
      this.el = null;
      this.items = [];
      this.highlightIdx = 0;
      this.isOpen = false;
      this.anchorInput = null;
      this.config = null;
      this.fixedWidth = null;
      this._updateReqId = 0;

      this._onScroll = (e) => {
        // Close on page scroll, but NOT when the dropdown list itself scrolls
        // (arrowing through items can scroll the internal list).
        try {
          const t = e && e.target ? e.target : null;
          if (t && this.el && (t === this.el || this.el.contains(t))) return;
        } catch (_) {}
        this.close();
      };
    }

    ensureEl() {
      if (this.el) return this.el;
      const el = document.createElement('div');
      el.className = 'typeahead-dropdown';
      el.style.display = 'none';

      // Prevent clicks inside dropdown from causing row blur/commit.
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // keep focus in the input
        const inp = this.anchorInput;
        if (inp && typeof inp.focus === 'function') inp.focus();
      });

      el.addEventListener('click', (e) => {
        const t = e.target;
        const row = t && t.closest ? t.closest('.typeahead-item') : null;
        const empty = t && t.closest ? t.closest('.typeahead-empty') : null;
        if (row) {
          const value =
            row.dataset && row.dataset.value
              ? row.dataset.value
              : row.textContent;
          this.pick(value);
          return;
        }
        if (empty) {
          this.close();
        }
      });

      document.body.appendChild(el);
      this.el = el;
      return el;
    }

    open(input, config) {
      if (!input) return;
      this.ensureEl();
      this.anchorInput = input;
      this.config = config || null;
      this.isOpen = true;
      this.fixedWidth = null; // assigned on first position

      window.addEventListener('scroll', this._onScroll, true);

      this.update();
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.anchorInput = null;
      this.config = null;
      this.items = [];
      this.highlightIdx = 0;
      if (this.el) this.el.style.display = 'none';
      window.removeEventListener('scroll', this._onScroll, true);
    }

    getQuery() {
      const inp = this.anchorInput;
      // Special-case: allow one-time forced empty query (used for "open on focus"
      // for units so the user sees the full list immediately).
      if (inp && inp._typeaheadForceEmptyQueryOnce) {
        inp._typeaheadForceEmptyQueryOnce = false;
        return '';
      }
      if (this.config && typeof this.config.getQuery === 'function') {
        try {
          return norm(this.config.getQuery(inp));
        } catch (_) {}
      }
      return inp ? norm(inp.value) : '';
    }

    async getPool() {
      const cfg = this.config;
      if (!cfg || typeof cfg.getPool !== 'function') return [];
      const inp = this.anchorInput;
      return await cfg.getPool(inp);
    }

    async update() {
      if (!this.isOpen || !this.anchorInput) return;
      const el = this.ensureEl();
      const anchor = this.anchorInput;
      const query = this.getQuery();
      if (this.config && this.config.closeOnEmptyQuery && !query) {
        this.close();
        return;
      }

      const reqId = ++this._updateReqId;
      const pool = await this.getPool();
      if (reqId !== this._updateReqId) return; // stale async update
      if (!this.isOpen || !this.anchorInput) return;
      if (this.anchorInput !== anchor) return; // focus moved during async fetch
      // Per-instance list behavior (defaults to current filter+rank).
      let ranked = [];
      try {
        if (this.config && typeof this.config.getItems === 'function') {
          ranked = this.config.getItems(pool, query, anchor) || [];
        } else {
          ranked = filterAndRank(pool, query);
        }
      } catch (_) {
        ranked = filterAndRank(pool, query);
      }

      // Above-the-fold cap (scroll for the rest). Default stays 8.
      let maxVisible = 8;
      try {
        const v = this.config && this.config.maxVisible;
        if (Number.isFinite(Number(v))) {
          maxVisible = Math.max(1, Math.floor(Number(v)));
        }
      } catch (_) {}

      // Render
      el.innerHTML = '';

      // If the only match is the exact current value, avoid showing a weird "echo" list.
      const qLower = lower(query);
      const isOnlyExact =
        qLower && ranked.length === 1 && lower(ranked[0]) === qLower;

      if (ranked.length === 0 || isOnlyExact) {
        const empty = document.createElement('div');
        empty.className = 'typeahead-empty';
        empty.textContent = isOnlyExact ? 'No other matches' : 'No matches';
        el.appendChild(empty);
        this.items = [];
        this.highlightIdx = 0;
      } else {
        const container = document.createElement('div');
        container.className = 'typeahead-list';
        // Cap visible rows; allow scroll for the rest.
        // 34px matches the intended row height implied by CSS (see .typeahead-list max-height).
        container.style.maxHeight = `${maxVisible * 34}px`;
        el.appendChild(container);

        ranked.forEach((item, idx) => {
          const row = document.createElement('div');
          row.className = 'typeahead-item';
          row.dataset.value = item;
          row.textContent = item;
          if (idx === this.highlightIdx) row.classList.add('is-highlighted');
          container.appendChild(row);
        });

        this.items = ranked;
        // Always ensure deterministic top highlight.
        if (this.highlightIdx == null || this.highlightIdx < 0)
          this.highlightIdx = 0;
        if (this.highlightIdx >= this.items.length) this.highlightIdx = 0;

        // Clamp visible height to 8 rows (scroll below the fold).
        // We'll do this via CSS max-height, but set it here for safety.
        el.dataset.maxVisible = String(maxVisible);
      }

      this.position();
    }

    position() {
      if (!this.isOpen || !this.anchorInput || !this.el) return;
      const el = this.el;
      const inp = this.anchorInput;

      const rect = inp.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth || 0;
      const vh =
        window.innerHeight || document.documentElement.clientHeight || 0;

      const GAP = 8;
      const MARGIN = 8;
      const MIN_W = 240;
      const MAX_W = 420;

      const baseW = Math.max(rect.width, MIN_W);
      const width = Math.min(Math.max(baseW, MIN_W), MAX_W);
      if (this.fixedWidth == null) this.fixedWidth = width;

      // Default left aligned to input; scoot to avoid cutoff
      let left = rect.left;
      const w = this.fixedWidth;
      if (left + w > vw - MARGIN) left = vw - MARGIN - w;
      if (left < MARGIN) left = MARGIN;

      // Compute available vertical space (prefer below)
      const belowTop = rect.bottom + GAP;
      const aboveBottom = rect.top - GAP;
      const availBelow = vh - MARGIN - belowTop;
      const availAbove = aboveBottom - MARGIN;

      const preferBelow = availBelow >= 160 || availBelow >= availAbove;
      const placeBelow = preferBelow;

      // Set maxHeight to available space and let list scroll internally.
      const maxH = Math.max(80, placeBelow ? availBelow : availAbove);

      let top = placeBelow ? belowTop : null;
      let bottom = placeBelow ? null : vh - aboveBottom;

      el.style.position = 'fixed';
      el.style.left = `${Math.round(left)}px`;
      el.style.width = `${Math.round(w)}px`;
      el.style.maxHeight = `${Math.floor(maxH)}px`;
      el.style.top = top != null ? `${Math.round(top)}px` : '';
      el.style.bottom = bottom != null ? `${Math.round(bottom)}px` : '';
      el.style.display = 'block';
    }

    setHighlight(nextIdx) {
      if (!this.isOpen || !this.el) return;
      if (!Array.isArray(this.items) || this.items.length === 0) return;
      const len = this.items.length;
      let idx = nextIdx;
      // Clamp, do not wrap (wrapping felt surprising in practice).
      if (idx < 0) idx = 0;
      if (idx >= len) idx = len - 1;
      this.highlightIdx = idx;

      const rows = this.el.querySelectorAll('.typeahead-item');
      rows.forEach((r, i) => {
        r.classList.toggle('is-highlighted', i === this.highlightIdx);
      });

      const active = rows[this.highlightIdx];
      if (active && typeof active.scrollIntoView === 'function') {
        // Keep it visible in the internal scroller
        active.scrollIntoView({ block: 'nearest' });
      }
    }

    moveHighlight(delta) {
      if (!this.isOpen) return;
      if (!Array.isArray(this.items) || this.items.length === 0) return;
      this.setHighlight((this.highlightIdx || 0) + delta);
    }

    pick(value) {
      if (!this.isOpen || !this.anchorInput) return;
      const v = norm(value);
      if (!v) return;
      const inp = this.anchorInput;
      let caretPos = null;
      const hasCustomSetValue =
        this.config && typeof this.config.setValue === 'function';
      if (hasCustomSetValue) {
        try {
          const res = this.config.setValue(v, inp);
          if (res && Number.isFinite(res.caretPos)) caretPos = res.caretPos;
        } catch (_) {}
      } else {
        inp.value = v;
      }
      try {
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (_) {}

      // Keep focus, close dropdown
      try {
        inp.focus();
        if (typeof inp.setSelectionRange === 'function') {
          // If custom setValue returned a caret position, respect it (e.g. textarea line replacement).
          if (caretPos != null) inp.setSelectionRange(caretPos, caretPos);
          // Default behavior: keep caret at the end for normal inputs.
          else if (!hasCustomSetValue)
            inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      } catch (_) {}

      if (this.config && typeof this.config.onPick === 'function') {
        try {
          this.config.onPick(v, inp);
        } catch (_) {}
      }

      this.close();
    }

    pickHighlighted() {
      if (!Array.isArray(this.items) || this.items.length === 0) return false;
      const idx = this.highlightIdx || 0;
      const v = this.items[idx];
      if (!v) return false;
      this.pick(v);
      return true;
    }
  }

  const dropdown = new TypeaheadDropdown();

  // --- Pool cache + invalidation
  const poolCache = {
    nameAll: null,
    unitAll: null,
    sizeAll: null,
    variantsByName: new Map(), // lower(name) -> string[]
    _cols: new Map(), // tableName -> lowercased column names[]
  };

  function invalidatePools() {
    poolCache.nameAll = null;
    poolCache.unitAll = null;
    poolCache.sizeAll = null;
    poolCache.variantsByName = new Map();
    poolCache._cols = new Map();
  }

  window.addEventListener('favoriteEats:db-updated', () => invalidatePools());

  // Expose a callable invalidation hook.
  window.typeaheadInvalidatePools = invalidatePools;

  // --- Field adapters
  function getDb() {
    return window.dbInstance || null;
  }

  function getTableColumns(db, tableName) {
    const key = lower(tableName);
    if (poolCache._cols.has(key)) return poolCache._cols.get(key) || [];
    if (!db || !tableName) return [];
    const result = safeExec(db, `PRAGMA table_info(${tableName});`);
    const cols =
      Array.isArray(result) && result.length > 0 && Array.isArray(result[0].values)
        ? result[0].values
            .map((row) => (Array.isArray(row) ? row[1] : null)) // PRAGMA: [cid, name, type, notnull, dflt_value, pk]
            .map((v) => lower(v))
            .filter((v) => v.length > 0)
        : [];
    poolCache._cols.set(key, cols);
    return cols;
  }

  function tableHasColumn(db, tableName, colName) {
    const cols = getTableColumns(db, tableName);
    return cols.includes(lower(colName));
  }

  async function getNamePool() {
    if (poolCache.nameAll) return poolCache.nameAll;
    const db = getDb();
    if (!db) return [];
    const hasDeprecated = tableHasColumn(db, 'ingredients', 'is_deprecated');
    const hasHide = tableHasColumn(db, 'ingredients', 'hide_from_shopping_list');

    let where = `name IS NOT NULL AND trim(name) != ''`;
    if (hasDeprecated) where += ` AND COALESCE(is_deprecated, 0) = 0`;
    else if (hasHide) where += ` AND COALESCE(hide_from_shopping_list, 0) = 0`;

    const q = safeExec(
      db,
      `SELECT DISTINCT name
       FROM ingredients
       WHERE ${where}
       ORDER BY name COLLATE NOCASE;`
    );
    const out = columnFromExec(q, 0);
    poolCache.nameAll = out;
    return out;
  }

  async function getUnitPool() {
    if (poolCache.unitAll) return poolCache.unitAll;
    const db = getDb();
    if (!db) return [];
    // Keep it simple: suggest unit codes.
    const hasHidden = tableHasColumn(db, 'units', 'is_hidden');
    const where = hasHidden
      ? `code IS NOT NULL AND trim(code) != '' AND COALESCE(is_hidden, 0) = 0`
      : `code IS NOT NULL AND trim(code) != ''`;
    const q = safeExec(
      db,
      `SELECT DISTINCT code
       FROM units
       WHERE ${where}
       ORDER BY COALESCE(sort_order, 999999) ASC,
                code COLLATE NOCASE;`
    );
    const official = columnFromExec(q, 0) || [];
    poolCache.unitAll = official;
    return official;
  }

  async function getSizePool() {
    if (poolCache.sizeAll) return poolCache.sizeAll;
    const db = getDb();
    if (!db) return [];

    // Sizes show up in multiple places across schema revisions.
    // We merge them into a single suggestion pool.
    const pools = [];

    // Per-recipe ingredient sizes (primary use in the tray)
    pools.push(
      columnFromExec(
        safeExec(
          db,
          `SELECT DISTINCT size
           FROM recipe_ingredient_map
           WHERE size IS NOT NULL AND trim(size) != ''
           ORDER BY size COLLATE NOCASE;`
        ),
        0
      )
    );

    // Substitute sizes
    pools.push(
      columnFromExec(
        safeExec(
          db,
          `SELECT DISTINCT size
           FROM recipe_ingredient_substitutes
           WHERE size IS NOT NULL AND trim(size) != ''
           ORDER BY size COLLATE NOCASE;`
        ),
        0
      )
    );

    // Shopping item / ingredient sizes list table (if present)
    pools.push(
      columnFromExec(
        safeExec(
          db,
          `SELECT DISTINCT size
           FROM ingredient_sizes
           WHERE size IS NOT NULL AND trim(size) != ''
           ORDER BY size COLLATE NOCASE;`
        ),
        0
      )
    );

    // Legacy single-value ingredient.size (if present)
    if (tableHasColumn(db, 'ingredients', 'size')) {
      pools.push(
        columnFromExec(
          safeExec(
            db,
            `SELECT DISTINCT size
             FROM ingredients
             WHERE size IS NOT NULL AND trim(size) != ''
             ORDER BY size COLLATE NOCASE;`
          ),
          0
        )
      );
    }

    const out = [];
    const seen = new Set();
    pools.flat().forEach((s) => {
      const v = norm(s);
      if (!v) return;
      const k = lower(v);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(v);
    });

    out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    poolCache.sizeAll = out;
    return out;
  }

  async function getVariantPoolForName(nameText) {
    const key = lower(nameText);
    if (!key) return [];
    if (poolCache.variantsByName.has(key))
      return poolCache.variantsByName.get(key) || [];
    const db = getDb();
    if (!db) return [];

    const ingHasDeprecated = tableHasColumn(db, 'ingredients', 'is_deprecated');
    const ingHasHide = tableHasColumn(db, 'ingredients', 'hide_from_shopping_list');
    const ingVisibilityClause = ingHasDeprecated
      ? `AND COALESCE(i.is_deprecated, 0) = 0`
      : ingHasHide
      ? `AND COALESCE(i.hide_from_shopping_list, 0) = 0`
      : ``;
    const ingVisibilityClauseNoAlias = ingHasDeprecated
      ? `AND COALESCE(is_deprecated, 0) = 0`
      : ingHasHide
      ? `AND COALESCE(hide_from_shopping_list, 0) = 0`
      : ``;

    // Prefer list table when present; fall back to legacy ingredients.variant.
    let q = [];
    try {
      q = safeExec(
        db,
        `SELECT DISTINCT v.variant
         FROM ingredient_variants v
         JOIN ingredients i ON i.ID = v.ingredient_id
         WHERE lower(i.name) = lower(?)
           AND v.variant IS NOT NULL
           AND trim(v.variant) != ''
           ${ingVisibilityClause}
         ORDER BY v.variant COLLATE NOCASE;`,
        [nameText]
      );
    } catch (_) {
      q = safeExec(
        db,
        `SELECT DISTINCT variant
         FROM ingredients
         WHERE lower(name) = lower(?)
           AND variant IS NOT NULL
           AND trim(variant) != ''
           ${ingVisibilityClauseNoAlias}
         ORDER BY variant COLLATE NOCASE;`,
        [nameText]
      );
    }
    let out = columnFromExec(q, 0);
    if (!out || out.length === 0) {
      // Fallback if the join/table doesn't exist.
      const q2 = safeExec(
        db,
        `SELECT DISTINCT variant
         FROM ingredients
         WHERE lower(name) = lower(?)
           AND variant IS NOT NULL
           AND trim(variant) != ''
           ${ingVisibilityClauseNoAlias}
         ORDER BY variant COLLATE NOCASE;`,
        [nameText]
      );
      out = columnFromExec(q2, 0);
    }
    poolCache.variantsByName.set(key, out);
    return out;
  }

  // --- Normalization on blur
  async function maybeNormalizeOnBlur(
    inputEl,
    poolProvider,
    { mode = 'default' } = {}
  ) {
    const raw = norm(inputEl.value);
    if (!raw) return;
    if (raw.length < 3) return;
    if (normalizationExemptions.has(raw)) return;

    const pool = await poolProvider();
    if (!Array.isArray(pool) || pool.length === 0) return;

    // Never normalize if the exact value already exists in the pool (case-insensitive).
    const rawLower = lower(raw);
    const hasExact = pool.some((v) => lower(v) === rawLower);
    if (hasExact) return;

    const best =
      mode === 'unit'
        ? findBestNearMatchForUnit(raw, pool)
        : findBestNearMatch(raw, pool);
    if (!best) return;

    // Apply normalization
    inputEl.value = best;
    try {
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (_) {}

    showUndoToast({
      message: `Corrected “${raw}” → “${best}”`,
      onUndo: () => {
        normalizationExemptions.add(raw);
        inputEl.value = raw;
        try {
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (_) {}
        try {
          inputEl.focus();
          if (typeof inputEl.select === 'function') inputEl.select();
        } catch (_) {}
      },
    });
  }

  // --- Attachment helpers
  function attachTypeaheadToInput({
    inputEl,
    getPool,
    onPick,
    openOnFocus,
    maxVisible,
    getItems,
    getQuery,
    setValue,
    closeOnEmptyQuery,
    openOnlyWhenQueryNonEmpty,
    ignoreInputTypes,
  }) {
    if (!inputEl) return;
    const cfg = {
      getPool,
      onPick,
      maxVisible,
      getItems,
      getQuery,
      setValue,
      closeOnEmptyQuery,
      openOnlyWhenQueryNonEmpty,
      ignoreInputTypes,
    };

    // If Escape is used to cancel the row, suppress blur-time normalization/toasts.
    inputEl._typeaheadSuppressNextNormalize = false;

    // v2 behavior: dropdown is OFF by default; it opens only on user keystroke
    // (input events) or explicit ArrowDown, and stays closed on focus unless
    // explicitly enabled via openOnFocus.

    // Optional: open on focus (used for ingredient unit field)
    if (openOnFocus) {
      inputEl.addEventListener('focus', (e) => {
        // Avoid programmatic focus (e.g., initial render/tab-order helpers).
        if (e && e.isTrusted === false) return;

        // Show full pool on focus regardless of current value.
        inputEl._typeaheadForceEmptyQueryOnce = true;

        if (!dropdown.isOpen || dropdown.anchorInput !== inputEl) {
          dropdown.open(inputEl, cfg);
          return;
        }

        dropdown.highlightIdx = 0;
        dropdown.update();
      });
    }

    // Live open/update (trusted user edits only)
    inputEl.addEventListener('input', (e) => {
      // Ignore programmatic/synthetic input events (prefill/autosize).
      if (e && e.isTrusted === false) return;

      const inputType =
        e && typeof e.inputType === 'string' ? e.inputType : '';
      if (
        cfg.ignoreInputTypes &&
        Array.isArray(cfg.ignoreInputTypes) &&
        inputType &&
        cfg.ignoreInputTypes.includes(inputType)
      ) {
        // Avoid opening/refreshing suggestions during paste/drop actions.
        dropdown.close();
        return;
      }

      if (!dropdown.isOpen || dropdown.anchorInput !== inputEl) {
        if (cfg.openOnlyWhenQueryNonEmpty) {
          let q = '';
          try {
            q =
              typeof cfg.getQuery === 'function'
                ? norm(cfg.getQuery(inputEl))
                : norm(inputEl.value);
          } catch (_) {}
          if (!q) return;
        }
        dropdown.open(inputEl, cfg);
        return;
      }

      dropdown.highlightIdx = 0; // deterministic top highlight after filter changes
      dropdown.update();
    });

    // Close on blur
    inputEl.addEventListener('blur', () => {
      // Close first; normalization may run after (and can reopen on focus later).
      if (dropdown.isOpen && dropdown.anchorInput === inputEl) dropdown.close();
    });

    // Keyboard controls (must prevent row-level Enter commit when dropdown open)
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Row-level handler will cancel the row; we must not fire normalization on the blur it triggers.
        inputEl._typeaheadSuppressNextNormalize = true;
      }
      if (!dropdown.isOpen || dropdown.anchorInput !== inputEl) {
        // Allow ArrowDown to explicitly open the dropdown while focused.
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          dropdown.open(inputEl, cfg);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        // If list is empty, treat ArrowDown as "reopen/update" (no-op otherwise)
        if (!dropdown.items || dropdown.items.length === 0) {
          dropdown.update();
        } else {
          dropdown.moveHighlight(1);
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (!dropdown.items || dropdown.items.length === 0) {
          dropdown.update();
        } else {
          dropdown.moveHighlight(-1);
        }
        return;
      }

      if (e.key === 'Enter') {
        // Only intercept Enter if there is something to pick.
        if (dropdown.items && dropdown.items.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          dropdown.pickHighlighted();
        }
      }
    });
  }

  function setupIngredientRowTabOrder(rowEl, orderedFields) {
    if (!rowEl) return;
    const order = Array.isArray(orderedFields) ? orderedFields : [];
    const inputs = Array.from(rowEl.querySelectorAll('.ingredient-edit-input'));
    if (inputs.length === 0) return;

    const byField = new Map();
    inputs.forEach((inp) => {
      const f = inp.dataset && inp.dataset.field ? inp.dataset.field : '';
      if (f) byField.set(f, inp);
    });

    const getNextField = (currentField, dir) => {
      const idx = order.indexOf(currentField);
      if (idx === -1) return null;
      for (let step = 1; step <= order.length; step += 1) {
        const nextIdx =
          dir > 0
            ? (idx + step) % order.length
            : (idx - step + order.length * 2) % order.length;
        const candidate = order[nextIdx];
        if (candidate && byField.has(candidate)) return candidate;
      }
      return null;
    };

    inputs.forEach((inp) => {
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const f = inp.dataset && inp.dataset.field ? inp.dataset.field : '';
        if (!f) return;

        e.preventDefault();
        e.stopPropagation();

        const dir = e.shiftKey ? -1 : 1;
        const nextField = getNextField(f, dir);
        const nextInp = nextField ? byField.get(nextField) : null;
        if (nextInp) {
          nextInp.focus();
          if (typeof nextInp.select === 'function') nextInp.select();
        }
      });
    });
  }

  // Public: wire a freshly-created ingredient edit row.
  // Assumes row contains inputs with data-field: name, unit, var.
  window.setupIngredientTypeaheadRow = function setupIngredientTypeaheadRow(
    rowEl
  ) {
    if (!rowEl) return;

    // Tab order follows visual order in the row.
    setupIngredientRowTabOrder(rowEl, [
      'qtymin',
      'qtymax',
      'name',
      'isrecipe',
      'recipe',
      'unit',
      'size',
      'var',
      'prep',
      'notes',
      'isopt',
      'isaprx',
    ]);

    const nameInput = rowEl.querySelector(
      '.ingredient-edit-input[data-field="name"]'
    );
    const unitInput = rowEl.querySelector(
      '.ingredient-edit-input[data-field="unit"]'
    );
    const sizeInput = rowEl.querySelector(
      '.ingredient-edit-input[data-field="size"]'
    );
    const varInput = rowEl.querySelector(
      '.ingredient-edit-input[data-field="var"]'
    );

    // NAME
    if (nameInput) {
      attachTypeaheadToInput({
        inputEl: nameInput,
        getPool: async () => await getNamePool(),
        openOnFocus: true,
      });

      nameInput.addEventListener('blur', async () => {
        if (nameInput._typeaheadSuppressNextNormalize) {
          nameInput._typeaheadSuppressNextNormalize = false;
          return;
        }
        if (!INGREDIENT_BLUR_NORMALIZATION_ENABLED) return;
        await maybeNormalizeOnBlur(nameInput, async () => await getNamePool());
      });
    }

    // UNIT
    if (unitInput) {
      attachTypeaheadToInput({
        inputEl: unitInput,
        getPool: async () => await getUnitPool(),
        openOnFocus: true,
        getItems: (pool, query) =>
          filterAndRankPreservePoolOrderOnEmpty(pool, query),
      });

      unitInput.addEventListener('blur', async () => {
        if (unitInput._typeaheadSuppressNextNormalize) {
          unitInput._typeaheadSuppressNextNormalize = false;
          return;
        }
        if (!INGREDIENT_BLUR_NORMALIZATION_ENABLED) return;
        await maybeNormalizeOnBlur(unitInput, async () => await getUnitPool(), {
          mode: 'unit',
        });
      });
    }

    // SIZE (show full list on focus, like units; no normalization)
    if (sizeInput) {
      attachTypeaheadToInput({
        inputEl: sizeInput,
        getPool: async () => await getSizePool(),
        openOnFocus: true,
        maxVisible: 10,
      });
    }

    // VARIANT (scoped to current name input value)
    if (varInput) {
      const getScopeName = () => {
        const liveName = nameInput ? norm(nameInput.value) : '';
        return liveName;
      };

      attachTypeaheadToInput({
        inputEl: varInput,
        getPool: async () => {
          const n = getScopeName();
          return await getVariantPoolForName(n);
        },
        openOnFocus: true,
      });

      varInput.addEventListener('blur', async () => {
        if (varInput._typeaheadSuppressNextNormalize) {
          varInput._typeaheadSuppressNextNormalize = false;
          return;
        }
        if (!INGREDIENT_BLUR_NORMALIZATION_ENABLED) return;
        const n = getScopeName();
        await maybeNormalizeOnBlur(
          varInput,
          async () => await getVariantPoolForName(n)
        );
      });
    }
  };

  // Public (for other pages in future)
  window.favoriteEatsTypeahead = {
    close: () => dropdown.close(),
    invalidate: invalidatePools,
    attach: (args) => attachTypeaheadToInput(args || {}),
    getNamePool: async () => await getNamePool(),
  };
})();
