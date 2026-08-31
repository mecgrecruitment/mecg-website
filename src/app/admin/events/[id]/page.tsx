import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import RotateButton from "./rotate-button";
import SlotForm from "./slot-form";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const { token } = await searchParams;
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id,name,cycle_id,starts_at,checkin_opens_at,checkin_closes_at,checkins(count)").eq("id", id).maybeSingle();
  if (!event) notFound();
  if (
    !event.cycle_id
    || (!hasPermission(user.memberships, event.cycle_id, "MANAGE_CYCLE")
      && !hasPermission(user.memberships, event.cycle_id, "RECRUITMENT_OPERATIONS"))
  ) redirect("/access-denied");
  const { data: slots } = await supabase.from("event_slots").select("id,starts_at,ends_at,capacity").eq("event_id", id);
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  const baseUrl = process.env.BASE_URL ?? `${protocol}://${host}`;
  const checkinUrl = token ? `${baseUrl}/checkin/${token}` : null;
  const qrDataUrl = checkinUrl ? await QRCode.toDataURL(checkinUrl) : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6 sm:p-10">
      <header>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mecg-orange-ink">Attendance event</p>
        <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">{event.name}</h1>
        <p className="mt-1.5 text-[15px] text-mecg-navy/55">{new Date(event.starts_at).toLocaleString()}</p>
      </header>

      <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Operational attendance only</p>
        <p className="mt-3 text-sm text-mecg-navy/60">
          Check-in window: {new Date(event.checkin_opens_at).toLocaleString()} – {new Date(event.checkin_closes_at).toLocaleString()}
        </p>
        <p className="mt-1.5 text-sm">
          Check-ins so far: <strong className="font-semibold text-mecg-navy">{event.checkins[0]?.count ?? 0}</strong>
        </p>
      </section>

      <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Check-in QR code</p>
        {qrDataUrl ? (
          <div className="mt-3 flex flex-col items-start gap-2">
            <Image unoptimized src={qrDataUrl} alt="Check-in QR code" width={256} height={256} className="rounded-xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]" />
            <p className="break-all text-xs text-mecg-navy/55">{checkinUrl}</p>
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-mecg-orange/[0.1] p-3 text-sm text-mecg-orange-ink shadow-[inset_0_0_0_1px_rgba(254,144,77,0.3)]">
            For security, the raw check-in token is shown only when created or rotated. Rotate it to display a new QR code.
          </p>
        )}
        <div className="mt-3.5">
          <RotateButton eventId={event.id} />
        </div>
      </section>

      {event.cycle_id && <SlotForm cycleId={event.cycle_id} eventId={event.id} />}

      <section>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">RSVP slots</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {(slots ?? []).map((slot) => (
            <li key={slot.id} className="text-sm text-mecg-navy/70">
              {new Date(slot.starts_at).toLocaleString()} · cap {slot.capacity}
            </li>
          ))}
        </ul>
        {!slots?.length && <p className="text-sm text-mecg-navy/45">No slots yet.</p>}
      </section>
    </main>
  );
}
