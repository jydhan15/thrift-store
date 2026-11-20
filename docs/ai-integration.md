# AI integration (Level 4)
- **Provider / model:** Google Gemini through `GeminiProvider` (model from `GEMINI_MODEL`, default `gemini-2.0-flash`). `OpenAIProvider` is the second implementation.
- **Endpoint:** `POST /api/v1/ai/assistant` body `{ "text": "warm jacket under 1000 pesos" }` (login required).
- **Retrieval:** the API first searches the database by keywords from the request and sends at most 15 real, in-stock candidates to the model. The model never sees the whole catalog or user data.
- **Prompt strategy:** a fixed system prompt says to treat shopper text as data, pick up to 5 items using only the given ids, and answer only as JSON. The user text and candidates are sent as one JSON payload.
- **Validation:** the reply is parsed with zod (`picks[] {id, reason}`), then any product id that is not in the candidate list is discarded. The frontend loads real product data by id, so the model cannot invent items or prices.
- **Failure handling:** timeout 8 s. On provider error, bad JSON, or timeout, the proxy returns keyword search results with `aiAssisted: false` and `source: "keyword_fallback"`; if even that finds nothing, 503 `AI_UNAVAILABLE`. Raw provider errors are never returned.
- **Cost controls:** 10 requests/minute per client (rate limit), input max 300 characters, `maxOutputTokens` 600, 15 candidates max, 5-minute in-memory cache.
- **Privacy:** only the shopper text and public product fields go to the provider. No emails, passwords, tokens, or order data. The UI labels results "AI-assisted".
- **Test:** `tests/api.test.js` "AI assistant fallback" simulates a provider outage.
