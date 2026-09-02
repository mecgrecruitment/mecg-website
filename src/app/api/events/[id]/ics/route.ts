import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeHumanLocation } from "@/app/applicant/safe-location";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data, error }, scheduleResult] = await Promise.all([
    supabase.rpc("public_recruitment"),
    supabase.rpc("applicant_schedule"),
  ]);
  const schedule = scheduleResult.data && typeof scheduleResult.data === "object"
    ? scheduleResult.data as { rsvps?: { eventId: string; eventName: string; startsAt: string; endsAt: string; location?: string | null }[] }
    : {};
  const bookedEvent = (schedule.rsvps ?? []).find((item) => item.eventId === id);
  if (error && !bookedEvent) {
    console.error("public_recruitment failed", error);
    return NextResponse.json({ error: "Calendar is unavailable, try again" }, { status: 503 });
  }
  const events = data && typeof data === "object" ? (data as { events?: { id: string; name: string; startsAt: string; endsAt?: string | null; location?: string | null }[] }).events ?? [] : [];
  const publicEvent = events.find((item) => item.id === id);
  const event = bookedEvent
    ? { id, name: bookedEvent.eventName, startsAt: bookedEvent.startsAt, endsAt: bookedEvent.endsAt, location: bookedEvent.location }
    : publicEvent;
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt ?? start.getTime() + 60 * 60 * 1000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  // RFC 5545 3.3.11: backslash, comma, semicolon, and newline are structural in TEXT
  // values and must be backslash-escaped before interpolation into an ICS field.
  const escapeIcsText = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\r?\n/g, "\\n");
  const safeLocation = safeHumanLocation(event.location);
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","BEGIN:VEVENT",`UID:${event.id}@mecg`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escapeIcsText(event.name)}`, safeLocation ? `LOCATION:${escapeIcsText(safeLocation)}` : "", "END:VEVENT","END:VCALENDAR"].filter(Boolean).join("\r\n");
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar", "Content-Disposition": `attachment; filename="mecg-event.ics"` } });
}
