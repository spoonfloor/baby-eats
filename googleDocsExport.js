const GOOGLE_DOCS_API_BASE = 'https://docs.googleapis.com/v1/documents';

class GoogleDocsExportError extends Error {
  constructor(message, { code = 'google_docs_export_error', userMessage = '' } = {}) {
    super(message);
    this.name = 'GoogleDocsExportError';
    this.code = code;
    this.userMessage = userMessage || message;
  }
}

function normalizePayload(payload) {
  const stores = Array.isArray(payload?.stores)
    ? payload.stores
        .map((store) => {
          const label = String(store?.label || '').trim();
          const aisles = Array.isArray(store?.aisles)
            ? store.aisles
                .map((aisle) => {
                  const aisleLabel = String(aisle?.label || '').trim();
                  const items = Array.isArray(aisle?.items)
                    ? aisle.items.map((item) => String(item || '').trim()).filter(Boolean)
                    : [];
                  if (!items.length) return null;
                  return { label: aisleLabel, items };
                })
                .filter(Boolean)
            : [];
          if (!label || !aisles.length) return null;
          return { label, aisles };
        })
        .filter(Boolean)
    : [];
  return {
    title: String(payload?.title || '').trim() || 'Shopping List',
    stores,
  };
}

function buildGoogleDocsShoppingListParagraphs(payload) {
  const normalized = normalizePayload(payload);
  const paragraphs = [];
  normalized.stores.forEach((store, storeIndex) => {
    if (storeIndex > 0) {
      paragraphs.push({ kind: 'spacer', text: '' });
    }
    paragraphs.push({ kind: 'store', text: store.label });
    store.aisles.forEach((aisle) => {
      if (aisle.label) {
        paragraphs.push({ kind: 'aisle', text: aisle.label });
      }
      aisle.items.forEach((item) => {
        paragraphs.push({ kind: 'item', text: item });
      });
    });
  });
  return paragraphs;
}

function buildGoogleDocsShoppingListDocumentRequests(payload) {
  const paragraphs = buildGoogleDocsShoppingListParagraphs(payload);
  if (!paragraphs.length) {
    return [];
  }

  const text = `${paragraphs.map((paragraph) => paragraph.text).join('\n')}\n`;
  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text,
      },
    },
  ];

  let index = 1;
  paragraphs.forEach((paragraph) => {
    const textLength = paragraph.text.length;
    const textEnd = index + textLength;
    const paragraphEnd = textEnd + 1;

    if (paragraph.kind === 'store' && textLength > 0) {
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: index,
            endIndex: textEnd,
          },
          textStyle: {
            bold: true,
          },
          fields: 'bold',
        },
      });
    }

    if (paragraph.kind === 'item') {
      requests.push({
        createParagraphBullets: {
          range: {
            startIndex: index,
            endIndex: paragraphEnd,
          },
          bulletPreset: 'BULLET_CHECKBOX',
        },
      });
    }

    index = paragraphEnd;
  });

  return requests;
}

async function googleDocsJsonFetch(url, { accessToken, method = 'GET', body } = {}) {
  if (typeof fetch !== 'function') {
    throw new GoogleDocsExportError('Global fetch is unavailable in Electron main.', {
      code: 'google_docs_network_unavailable',
      userMessage: 'Google Docs export is unavailable because network support is missing.',
    });
  }
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${String(accessToken || '').trim()}`,
      'content-type': 'application/json',
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(data?.error?.message || data?.message || '').trim();
    throw new GoogleDocsExportError(
      `Google Docs API request failed (${response.status}). ${message}`.trim(),
      {
        code: response.status === 401 ? 'google_docs_unauthorized' : 'google_docs_api_failed',
        userMessage: message || 'Google Docs export failed. Please try again.',
      },
    );
  }
  return data;
}

async function exportShoppingListToGoogleDocs({ accessToken, payload }) {
  const normalized = normalizePayload(payload);
  if (!normalized.stores.length) {
    throw new GoogleDocsExportError('Cannot export an empty shopping list.', {
      code: 'google_docs_empty_payload',
      userMessage: 'No unchecked shopping items are available to export.',
    });
  }

  const createResponse = await googleDocsJsonFetch(GOOGLE_DOCS_API_BASE, {
    accessToken,
    method: 'POST',
    body: {
      title: normalized.title,
    },
  });

  const documentId = String(createResponse?.documentId || '').trim();
  if (!documentId) {
    throw new GoogleDocsExportError('Google Docs did not return a document ID.', {
      code: 'google_docs_missing_document_id',
      userMessage: 'Google Docs export failed before the document could be opened.',
    });
  }

  const requests = buildGoogleDocsShoppingListDocumentRequests(normalized);
  if (requests.length) {
    await googleDocsJsonFetch(`${GOOGLE_DOCS_API_BASE}/${documentId}:batchUpdate`, {
      accessToken,
      method: 'POST',
      body: { requests },
    });
  }

  return {
    documentId,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

module.exports = {
  GoogleDocsExportError,
  buildGoogleDocsShoppingListDocumentRequests,
  buildGoogleDocsShoppingListParagraphs,
  exportShoppingListToGoogleDocs,
};
