# PwC GenAI Shared Service API

## Overview

The PwC GenAI Shared Service is an OpenAI-compatible API gateway hosted by PwC. It provides access to various LLM and embedding models through a unified interface. The base URL for the EMEA region is:

```
https://genai-sharedservice-emea.pwc.com
```

## Authentication

All requests require an API key passed via the `api-key` header:

```
api-key: <your-api-key>
```

Every endpoint also requires the `api-version` query parameter:

```
?api-version=2024-02-15-preview
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GENAI_BASE_URL` | Base URL of the GenAI service | `https://genai-sharedservice-emea.pwc.com` |
| `GENAI_API_KEY` | Your API key | `sk-...` |
| `GENAI_API_VERSION` | API version string | `2024-02-15-preview` |
| `GENAI_LLM_MODEL` | Default LLM model | `openai.gpt-4o-mini` |
| `GENAI_EMBEDDINGS_MODEL` | Default embeddings model | `azure.text-embedding-3-large` |
| `GENAI_EMBEDDINGS_DIMENSIONS` | Embedding vector dimensions | `1536` |


---

## Endpoints

### 1. Responses (LLM Completions)

Generate text completions from a language model.

**URL:**
```
POST /v1/responses?api-version=2024-02-15-preview
```

**Headers:**
```
api-key: <your-api-key>
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "openai.gpt-4o-mini",
  "input": "Your prompt text here"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model identifier (see [Available Models](#available-models)) |
| `input` | string | Yes | The full prompt/input text |

**Response Formats:**

The API may return responses in multiple formats. The service handles all of them:

**Format 1 — OpenAI Responses API:**
```json
{
  "output": [
    {
      "type": "message",
      "content": [
        {
          "type": "output_text",
          "text": "The generated response text"
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 150,
    "output_tokens": 300
  }
}
```

**Format 2 — Chat Completions:**
```json
{
  "choices": [
    {
      "message": {
        "content": "The generated response text"
      }
    }
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 300
  }
}
```

**Format 3 — Direct response:**
```json
{
  "response": "The generated response text",
  "usage": { ... }
}
```

**Usage object fields (varies by format):**

| Field | Description |
|-------|-------------|
| `input_tokens` / `prompt_tokens` | Number of tokens in the input |
| `output_tokens` / `completion_tokens` | Number of tokens in the output |

---

### 2. Embeddings

Generate vector embeddings for text, used for semantic search.

**URL:**
```
POST /v1/embeddings?api-version=2024-02-15-preview
```

**Headers:**
```
api-key: <your-api-key>
Content-Type: application/json
```

**Request Body (single text):**
```json
{
  "model": "azure.text-embedding-3-large",
  "input": "Text to embed"
}
```

**Request Body (batch):**
```json
{
  "model": "azure.text-embedding-3-large",
  "input": ["Text one", "Text two", "Text three"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Embedding model identifier |
| `input` | string or string[] | Yes | Single text or array of texts to embed |

**Response (single):**
```json
{
  "data": [
    {
      "embedding": [0.0023, -0.0091, ...],
      "index": 0
    }
  ],
  "usage": {
    "total_tokens": 12,
    "prompt_tokens": 12
  }
}
```

**Response (batch):**
```json
{
  "data": [
    { "embedding": [0.0023, ...], "index": 0 },
    { "embedding": [-0.0045, ...], "index": 1 },
    { "embedding": [0.0078, ...], "index": 2 }
  ],
  "usage": {
    "total_tokens": 36,
    "prompt_tokens": 36
  }
}
```

> **Note:** Batch results include an `index` field to maintain ordering. The service sorts by index before returning.

---

### 3. List Models

Retrieve available models and their pricing information.

**URL:**
```
GET /v1/models?api-version=2024-02-15-preview
```

**Headers:**
```
api-key: <your-api-key>
```

**Response:**
```json
{
  "data": [
    {
      "id": "openai.gpt-4o-mini",
      "pricing": {
        "input_cost_per_token": 0.00000015,
        "output_cost_per_token": 0.0000006
      }
    },
    {
      "id": "openai.gpt-4o",
      "pricing": {
        "input_cost_per_token": 0.00000275,
        "output_cost_per_token": 0.000011
      }
    }
  ]
}
```

The pricing object may use different field names depending on the API version:

| Possible field | Description |
|----------------|-------------|
| `pricing.input_cost_per_token` | Cost per input token (USD) |
| `pricing.output_cost_per_token` | Cost per output token (USD) |
| `pricing.prompt_cost_per_token` | Alias for input cost |
| `pricing.completion_cost_per_token` | Alias for output cost |
| `pricing.input_per_1m_tokens` | Cost per 1M input tokens (USD) |
| `pricing.output_per_1m_tokens` | Cost per 1M output tokens (USD) |
| `input_cost_per_token` | Top-level field (some formats) |
| `output_cost_per_token` | Top-level field (some formats) |

> The models list may return items as objects `{ id, pricing, ... }` or as plain strings `"openai.gpt-4o-mini"`. The wrapper under `data` or `models` key also varies.

---

## Available Models

### LLM Models

| Model ID | Input $/1M tokens | Output $/1M tokens | Notes |
|----------|-------------------|---------------------|-------|
| `openai.gpt-4o` | $2.75 | $11.00 | High capability |
| `openai.gpt-4o-mini` | $0.15 | $0.60 | Fast, cheap |
| `openai.gpt-4.1` | $2.00 | $8.00 | |
| `openai.gpt-4.1-mini` | $0.40 | $1.60 | |
| `openai.gpt-4.1-nano` | $0.10 | $0.40 | Fastest, cheapest |
| `openai.gpt-5` | $2.00 | $8.00 | |
| `openai.gpt-5-mini` | $0.40 | $1.60 | |
| `openai.o3` | $2.00 | $8.00 | Reasoning model |
| `openai.o3-mini` | $1.10 | $4.40 | Reasoning model |
| `openai.o4-mini` | $1.10 | $4.40 | Reasoning model |

### Embedding Models

| Model ID | Input $/1M tokens | Notes |
|----------|-------------------|-------|
| `azure.text-embedding-3-large` | $0.13 | 3072 dimensions (configurable) |
| `azure.text-embedding-3-small` | $0.02 | 1536 dimensions |
| `openai.text-embedding-3-large` | $0.13 | Same model, OpenAI prefix |
| `openai.text-embedding-3-small` | $0.02 | Same model, OpenAI prefix |

> Model IDs use a `provider.model-name` format. Both `azure.*` and `openai.*` prefixes may work for the same underlying model.

---

## Error Handling

On failure, the API returns a non-2xx status code with an error message in the response body:

```
HTTP 401 Unauthorized
HTTP 429 Too Many Requests
HTTP 500 Internal Server Error
```

The error body format varies but is typically plain text or JSON.

---

## Usage Example

### cURL — LLM Completion

```bash
curl -X POST "https://genai-sharedservice-emea.pwc.com/v1/responses?api-version=2024-02-15-preview" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai.gpt-4o-mini",
    "input": "What is a Managed Entry Agreement in pharmaceutical reimbursement?"
  }'
```

### cURL — Embeddings

```bash
curl -X POST "https://genai-sharedservice-emea.pwc.com/v1/embeddings?api-version=2024-02-15-preview" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "azure.text-embedding-3-large",
    "input": "Managed Entry Agreements for oncology drugs"
  }'
```

### cURL — List Models

```bash
curl "https://genai-sharedservice-emea.pwc.com/v1/models?api-version=2024-02-15-preview" \
  -H "api-key: YOUR_API_KEY"
```

### Node.js — LLM Completion

```javascript
const response = await fetch(
  'https://genai-sharedservice-emea.pwc.com/v1/responses?api-version=2024-02-15-preview',
  {
    method: 'POST',
    headers: {
      'api-key': process.env.GENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai.gpt-4o-mini',
      input: 'Your prompt here',
    }),
  }
);

const data = await response.json();
// Extract text from whichever response format is returned
const text = data.output?.[0]?.content?.[0]?.text
  || data.choices?.[0]?.message?.content
  || data.response;
```

### Node.js — Batch Embeddings

```javascript
const response = await fetch(
  'https://genai-sharedservice-emea.pwc.com/v1/embeddings?api-version=2024-02-15-preview',
  {
    method: 'POST',
    headers: {
      'api-key': process.env.GENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'azure.text-embedding-3-large',
      input: ['Text one', 'Text two', 'Text three'],
    }),
  }
);

const data = await response.json();
const embeddings = data.data
  .sort((a, b) => a.index - b.index)
  .map(item => item.embedding);
```

---

## Mock Mode

For local development without API access, set `USE_MOCK_AI=true` in your `.env` file. This:

- Returns placeholder text for LLM calls (`[Mock AgentName response]`)
- Generates deterministic pseudo-random embedding vectors (consistent for the same input text)
- Skips all API calls entirely
- Allows full pipeline testing without consuming tokens
