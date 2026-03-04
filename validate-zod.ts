import { z } from "zod";

// --- Generic validator ---

function validateRequestPayload<T>(
  schema: z.ZodType<T>,
  data: unknown
): T {
  return schema.parse(data); // throws ZodError on failure
}

// --- Complex schema ---

const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.enum(["US", "CA", "GB", "DE"]),
  coords: z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]),
});

const UpdateFoobarResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  age: z.number().int().nonnegative(),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
  active: z.boolean(),
  score: z.number().min(0).max(100).nullable(),
  tags: z.array(z.string()).min(1),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  address: AddressSchema,
  previousAddresses: z.array(AddressSchema).default([]),
  preferences: z.object({
    theme: z.enum(["light", "dark"]),
    notifications: z.object({
      email: z.boolean(),
      sms: z.boolean(),
      frequency: z.union([z.literal("daily"), z.literal("weekly"), z.literal("never")]),
    }),
    languages: z.set(z.string()).transform((s) => [...s]), // set → array
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  ttl: z.number().int().positive().optional(),
  nested: z.object({
    matrix: z.array(z.array(z.number())),
    lookup: z.record(z.string(), z.array(z.number())),
    deepRef: z.lazy(() =>
      z.object({
        value: z.number(),
        child: z
          .object({ value: z.number(), child: z.null() })
          .nullable(),
      })
    ),
  }),
});

type UpdateFoobarResponse = z.infer<typeof UpdateFoobarResponseSchema>;

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
    languages: new Set(["en", "de"]),
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

console.log("=== Zod Validation ===\n");

try {
  const result: UpdateFoobarResponse = validateRequestPayload(UpdateFoobarResponseSchema, validPayload);
  console.log("VALID payload passed ✓");
  console.log("  Type-safe access — result.preferences.notifications.frequency:", result.preferences.notifications.frequency);
  console.log("  Nested — result.nested.deepRef.child?.value:", result.nested.deepRef.child?.value);
  console.log("  Set→Array — result.preferences.languages:", result.preferences.languages);
} catch (e: any) {
  console.error("VALID payload unexpectedly failed:", e.errors);
}

console.log();

try {
  validateRequestPayload(UpdateFoobarResponseSchema, invalidPayload);
  console.error("INVALID payload unexpectedly passed");
} catch (e: any) {
  console.log("INVALID payload rejected ✓");
  for (const issue of e.issues) {
    console.log(`  → ${issue.path.join(".")}: ${issue.message}`);
  }
}
