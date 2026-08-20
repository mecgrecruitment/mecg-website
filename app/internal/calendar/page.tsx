import { redirect } from "next/navigation";

// Calendar and Check-ins both listed recruitment_events. Keep one surface
// (/internal/events) with schedule + check-in feed.
export default function CalendarRedirectPage() {
  redirect("/internal/events");
}
