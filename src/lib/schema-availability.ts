// A deploy puts new code in front of the database for as long as it takes
// someone to run `supabase db push`. For rush intake that window has to be
// harmless: a missing column or function should leave the new feature dormant,
// never break the page it sits on or stop an applicant submitting.
//
// This is narrow on purpose. Only "the object is not there" counts. A timeout,
// a permission error or a constraint violation is a real failure and must still
// surface, or a genuine outage reads as "the feature is off".

type SchemaError = { code?: string; message?: string } | null | undefined;

// PostgREST reports its schema cache misses with its own codes; Postgres
// reports the underlying condition when the call reaches it.
const MISSING_OBJECT_CODES = new Set([
  "PGRST202", // function not found in schema cache
  "PGRST204", // column not found in schema cache
  "42883", // undefined_function
  "42703", // undefined_column
  "42P01", // undefined_table
]);

export function isMissingSchemaObject(error: SchemaError): boolean {
  if (!error) return false;
  return Boolean(error.code && MISSING_OBJECT_CODES.has(error.code));
}
