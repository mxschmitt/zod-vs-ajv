import Ajv, { type JSONSchemaType, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

// --- Setup Ajv ---

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// --- Generic validator ---

function validateRequestPayload<T>(
  validate: ValidateFunction<T>,
  data: unknown
): T {
  if (validate(data)) {
    return data; // narrowed to T by Ajv's type guard
  }
  throw new Error(
    `Validation failed:\n${validate.errors!.map((e) => `  → ${e.instancePath || "/"}: ${e.message}`).join("\n")}`
  );
}

// --- Types (must be defined explicitly for Ajv's JSONSchemaType) ---

interface Address {
  street: string;
  city: string;
  zip: string;
  country: "US" | "CA" | "GB" | "DE";
  coords: [number, number];
}

interface DeepChild {
  value: number;
  child: null;
}

interface DeepRef {
  value: number;
  child: DeepChild | null;
}

interface UpdateFoobarResponse {
  id: string;
  name: string;
  age: number;
  email: string;
  role: "admin" | "editor" | "viewer";
  active: boolean;
  score: number | null;
  tags: string[];
  metadata: Record<string, string | number | boolean>;
  address: Address;
  previousAddresses: Address[];
  preferences: {
    theme: "light" | "dark";
    notifications: {
      email: boolean;
      sms: boolean;
      frequency: "daily" | "weekly" | "never";
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
    deepRef: DeepRef;
  };
}

// --- JSON Schema (typed with JSONSchemaType<T>) ---

const addressSchema: JSONSchemaType<Address> = {
  type: "object",
  properties: {
    street: { type: "string", minLength: 1 },
    city: { type: "string" },
    zip: { type: "string", pattern: "^\\d{5}(-\\d{4})?$" },
    country: { type: "string", enum: ["US", "CA", "GB", "DE"] },
    coords: {
      type: "array",
      items: [
        { type: "number", minimum: -90, maximum: 90 },
        { type: "number", minimum: -180, maximum: 180 },
      ],
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ["street", "city", "zip", "country", "coords"],
  additionalProperties: false,
};

const schema: JSONSchemaType<UpdateFoobarResponse> = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", minLength: 1, maxLength: 255 },
    age: { type: "integer", minimum: 0 },
    email: { type: "string", format: "email" },
    role: { type: "string", enum: ["admin", "editor", "viewer"] },
    active: { type: "boolean" },
    score: { type: "number", minimum: 0, maximum: 100, nullable: true },
    tags: { type: "array", items: { type: "string" }, minItems: 1 },
    metadata: {
      type: "object",
      required: [],
      additionalProperties: {
        oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
      },
    },
    address: addressSchema,
    previousAddresses: { type: "array", items: addressSchema },
    preferences: {
      type: "object",
      properties: {
        theme: { type: "string", enum: ["light", "dark"] },
        notifications: {
          type: "object",
          properties: {
            email: { type: "boolean" },
            sms: { type: "boolean" },
            frequency: { type: "string", enum: ["daily", "weekly", "never"] },
          },
          required: ["email", "sms", "frequency"],
          additionalProperties: false,
        },
        languages: { type: "array", items: { type: "string" } },
      },
      required: ["theme", "notifications", "languages"],
      additionalProperties: false,
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: { type: "string", format: "date-time", nullable: true },
    ttl: { type: "integer", minimum: 1, nullable: true },
    nested: {
      type: "object",
      properties: {
        matrix: {
          type: "array",
          items: { type: "array", items: { type: "number" } },
        },
        lookup: {
          type: "object",
          required: [],
          additionalProperties: { type: "array", items: { type: "number" } },
        },
        deepRef: {
          type: "object",
          properties: {
            value: { type: "number" },
            child: {
              type: "object",
              nullable: true,
              properties: {
                value: { type: "number" },
                child: { type: "null", nullable: true },  // always null
              },
              required: ["value", "child"],
              additionalProperties: false,
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

const validateFoobar = ajv.compile(schema);

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

console.log("=== Ajv Validation ===\n");

try {
  const result: UpdateFoobarResponse = validateRequestPayload(validateFoobar, validPayload);
  console.log("VALID payload passed ✓");
  console.log("  Type-safe access — result.preferences.notifications.frequency:", result.preferences.notifications.frequency);
  console.log("  Nested — result.nested.deepRef.child?.value:", result.nested.deepRef.child?.value);
  console.log("  Languages:", result.preferences.languages);
} catch (e: any) {
  console.error("VALID payload unexpectedly failed:", e.message);
}

console.log();

try {
  validateRequestPayload(validateFoobar, invalidPayload);
  console.error("INVALID payload unexpectedly passed");
} catch (e: any) {
  console.log("INVALID payload rejected ✓");
  console.log(e.message);
}
