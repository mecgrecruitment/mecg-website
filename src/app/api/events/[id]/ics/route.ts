import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_recruitment");
  if (error) {
    console.error("public_recruitment failed", error);
    return NextResponse.json({ error: "Calendar is unavailable, try again" }, { status: 503 });
  }
  const events = data && typeof data === "object" ? (data as { events?: { id: string; name: string; startsAt: string; endsAt?: string | null; location?: string | null }[] }).events ?? [] : [];
  const event = events.find((item) => item.id === id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt ?? start.getTime() + 60 * 60 * 1000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","BEGIN:VEVENT",`UID:${event.id}@mecg`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${event.name}`, event.location ? `LOCATION:${event.location}` : "", "END:VEVENT","END:VCALENDAR"].filter(Boolean).join("\r\n");
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar", "Content-Disposition": `attachment; filename="mecg-event.ics"` } });
}
