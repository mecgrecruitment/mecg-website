import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseAlumniDirectory, type AlumniDirectory } from "./model";

// Returns null when the directory cannot be read (RPC missing before the
// migration, access refused, or a malformed response) so the page shows an
// unavailable state and no partial entries.
export async function loadAlumniDirectory(): Promise<AlumniDirectory | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("alumni_directory");
    if (error) throw error;
    return parseAlumniDirectory(data);
  } catch (error) {
    console.error("alumni_directory unavailable", error);
    return null;
  }
}
