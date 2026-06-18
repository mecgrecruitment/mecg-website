import { redirect } from "next/navigation";

export async function GET() {
  redirect("/internal/hash/export");
}
