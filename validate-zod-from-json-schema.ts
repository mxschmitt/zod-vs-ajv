import { z } from "zod";

// --- JSON Schema (same structure as validate-ajv.ts) ---
// NOTE: No `as const` — fromJSONSchema expects mutable arrays for `enum`/`required`.

const addressJsonSchema = {
  type: "object" as const,
  properties: {
    street: { type: "string" as const, minLength: 1 },
    city: { type: "string" as const },
    zip: { type: "string" as const, pattern: "^\\d{5}(-\\d{4})?$" },
    country: { type: "string" as const, enum: ["US", "CA", "GB", "DE"] },
    coords: {
      type: "array" as const,
      items: [
        { type: "number" as const, minimum: -90, maximum: 90 },
        { type: "number" as const, minimum: -180, maximum: 180 },
      ],
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ["street", "city", "zip", "country", "coords"],
  additionalProperties: false,
};

const jsonSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" as const, format: "uuid" },
    name: { type: "string" as const, minLength: 1, maxLength: 255 },
    age: { type: "integer" as const, minimum: 0 },
    email: { type: "string" as const, format: "email" },
    role: { type: "string" as const, enum: ["admin", "editor", "viewer"] },
    active: { type: "boolean" as const },
    score: {
      oneOf: [
        { type: "number" as const, minimum: 0, maximum: 100 },
        { type: "null" as const },
      ],
    },
    tags: { type: "array" as const, items: { type: "string" as const }, minItems: 1 },
    metadata: {
      type: "object" as const,
      additionalProperties: {
        oneOf: [{ type: "string" as const }, { type: "number" as const }, { type: "boolean" as const }],
      },
    },
    address: addressJsonSchema,
    previousAddresses: { type: "array" as const, items: addressJsonSchema },
    preferences: {
      type: "object" as const,
      properties: {
        theme: { type: "string" as const, enum: ["light", "dark"] },
        notifications: {
          type: "object" as const,
          properties: {
            email: { type: "boolean" as const },
            sms: { type: "boolean" as const },
            frequency: { type: "string" as const, enum: ["daily", "weekly", "never"] },
          },
          required: ["email", "sms", "frequency"],
          additionalProperties: false,
        },
        languages: { type: "array" as const, items: { type: "string" as const } },
      },
      required: ["theme", "notifications", "languages"],
      additionalProperties: false,
    },
    createdAt: { type: "string" as const, format: "date-time" },
    updatedAt: { type: "string" as const, format: "date-time" },
    deletedAt: {
      oneOf: [{ type: "string" as const, format: "date-time" }, { type: "null" as const }],
    },
    ttl: { type: "integer" as const, minimum: 1 },
    nested: {
      type: "object" as const,
      properties: {
        matrix: {
          type: "array" as const,
          items: { type: "array" as const, items: { type: "number" as const } },
        },
        lookup: {
          type: "object" as const,
          additionalProperties: { type: "array" as const, items: { type: "number" as const } },
        },
        deepRef: {
          type: "object" as const,
          properties: {
            value: { type: "number" as const },
            child: {
              oneOf: [
                {
                  type: "object" as const,
                  properties: {
                    value: { type: "number" as const },
                    child: { type: "null" as const },
                  },
                  required: ["value", "child"],
                  additionalProperties: false,
                },
                { type: "null" as const },
              ],
            },
          },
          required: ["value", "child"],
          additionalProperties: false,
        },
      },
      required: ["matrix", "lookup", "deepRef"],
      additionalProperties: false,
    },
  },
  required: [
    "id", "name", "age", "email", "role", "active", "score", "tags",
    "metadata", "address", "previousAddresses", "preferences",
    "createdAt", "updatedAt", "deletedAt", "nested",
  ],
  additionalProperties: false,
};

// --- Convert JSON Schema → Zod schema ---

const UpdateFoobarResponseSchema = z.fromJSONSchema(jsonSchema);

// --- KEY FINDING: z.infer<typeof UpdateFoobarResponseSchema> is `unknown` ---
// fromJSONSchema returns a ZodType<unknown>, so you do NOT get structural types.
// This means you lose the main Zod advantage (single source of truth for types).

type UpdateFoobarResponseInferred = z.infer<typeof UpdateFoobarResponseSchema>;
// ^ This is `unknown`, NOT a structural type.

// --- Workaround: Define the type manually and cast after validation ---

interface UpdateFoobarResponse {
  id: string;
  name: string;
  age: number;
  email: string;
  role: string;
  active: boolean;
  score: number | null;
  tags: string[];
  metadata: Record<string, string | number | boolean>;
  address: {
    street: string;
    city: string;
    zip: string;
    country: string;
    coords: [number, number];
  };
  previousAddresses: Array<{
    street: string;
    city: string;
    zip: string;
    country: string;
    coords: [number, number];
  }>;
  preferences: {
    theme: string;
    notifications: {
      email: boolean;
      sms: boolean;
      frequency: string;
    };
    languages: string[];
  };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  ttl?: number;
  nested: {
    matrix: number[][];
    lookup: Record<string, number[]>;
    deepRef: {
      value: number;
      child: { value: number; child: null } | null;
    };
  };
}

// --- Generic validator ---

function validateRequestPayload(
  schema: z.ZodType,
  data: unknown
): UpdateFoobarResponse {
  // Runtime validation works fine — the schema enforces the JSON Schema rules.
  // But we must cast because the inferred type is `unknown`.
  return schema.parse(data) as UpdateFoobarResponse;
}

// --- Test data ---

const validPayload = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  name: "Test Foobar",
  age: 30,
  email: "test@example.com",
  role: "admin",
  active: true,
  score: 87.5,
  tags: ["important", "reviewed"],
  metadata: { source: "api", version: 3, beta: true },
  address: {
    street: "123 Main St",
    city: "Springfield",
    zip: "62704",
    country: "US",
    coords: [39.7817, -89.6501],
  },
  previousAddresses: [
    { street: "456 Oak Ave", city: "Shelbyville", zip: "62565-1234", country: "US", coords: [39.53, -88.79] },
  ],
  preferences: {
    theme: "dark",
    notifications: { email: true, sms: false, frequency: "weekly" },
    languages: ["en", "de"],
  },
  createdAt: "2025-01-15T10:30:00Z",
  updatedAt: "2025-06-01T14:00:00Z",
  deletedAt: null,
  ttl: 3600,
  nested: {
    matrix: [[1, 2], [3, 4], [5, 6]],
    lookup: { a: [1, 2, 3], b: [4, 5] },
    deepRef: { value: 1, child: { value: 2, child: null } },
  },
};

const invalidPayload = {
  ...validPayload,
  email: "not-an-email",
  age: -5,
  tags: [],
  address: { ...validPayload.address, zip: "bad" },
};

// --- Run ---

console.log("=== Zod fromJSONSchema Validation ===\n");

console.log("--- Type inference result ---");
console.log("  z.infer<typeof UpdateFoobarResponseSchema> = unknown");
console.log("  fromJSONSchema does NOT produce structural types.");
console.log("  You must define types manually and cast after .parse().\n");

// 1) Runtime validation — valid payload
try {
  const result = validateRequestPayload(UpdateFoobarResponseSchema, validPayload);
  console.log("VALID payload passed ✓");
  console.log("  result.preferences.notifications.frequency:", result.preferences.notifications.frequency);
  console.log("  result.nested.deepRef.child?.value:", result.nested.deepRef.child?.value);
  console.log("  result.address.coords:", result.address.coords);
  console.log("  result.tags:", result.tags);
  console.log("  typeof result.age:", typeof result.age);
} catch (e: any) {
  console.error("VALID payload unexpectedly failed:", e.message);
  if (e.issues) {
    for (const issue of e.issues) {
      console.log(`  → ${issue.path.join(".")}: ${issue.message}`);
    }
  }
}

console.log();

// 2) Runtime validation — invalid payload
try {
  validateRequestPayload(UpdateFoobarResponseSchema, invalidPayload);
  console.error("INVALID payload unexpectedly passed");
} catch (e: any) {
  console.log("INVALID payload rejected ✓");
  if (e.issues) {
    for (const issue of e.issues) {
      console.log(`  → ${issue.path.join(".")}: ${issue.message}`);
    }
  } else {
    console.log(e.message);
  }
}

// 3) Summary
console.log("\n--- Summary ---");
console.log("  Runtime validation: WORKS (fromJSONSchema validates correctly)");
console.log("  Type inference:     DOES NOT WORK (z.infer gives `unknown`)");
console.log("  Workaround:         Define interface manually + cast after .parse()");
console.log("  Conclusion:         Same situation as AJV — types and schema are separate.");
console.log("                      You lose Zod's single-source-of-truth advantage.");
