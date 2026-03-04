# Zod vs Ajv — Request Payload Validation

Comparison of Zod and Ajv for validating typed request payloads in TypeScript.

## Run

```bash
npm install
npx tsx validate-zod.ts
npx tsx validate-ajv.ts
```

## Key Finding

**Zod is the clear winner for TypeScript projects.**

The decisive difference: with Zod, you define the schema once and derive the TypeScript type from it. With Ajv, you must define the TypeScript interface _and_ the JSON Schema separately — maintaining two parallel definitions of the same shape.

```ts
// Zod: single source of truth
const Schema = z.object({ name: z.string(), age: z.number() });
type MyType = z.infer<typeof Schema>; // derived automatically

// Ajv: two definitions that must stay in sync
interface MyType { name: string; age: number }
const schema: JSONSchemaType<MyType> = { /* ...rewrite the same shape as JSON Schema... */ };
```

Ajv's `JSONSchemaType<T>` catches mismatches at compile time, so the two definitions can't silently drift apart. But the duplication itself is the problem — it's more code, more maintenance, and more room for friction during refactors.

## Comparison

| | Zod | Ajv |
|---|---|---|
| Schema = Type | Yes — `z.infer` derives the type | No — interface and schema defined separately |
| Verbosity | Compact, chainable API | ~2x more code for the same shape |
| Transforms | Built-in (e.g. `Set` to `Array`) | Not supported |
| Standard | Zod-specific | JSON Schema (language-agnostic) |
| Cross-language | No | Yes — JSON Schema works in any language |

## When Ajv still makes sense

- You need to share schemas across languages (e.g. Python, Go, Java all validate the same payload)
- You're working with OpenAPI / Swagger, which uses JSON Schema natively
- You receive schemas at runtime from an external source

For everything else in TypeScript, use Zod.
