import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import RotateButton from "./rotate-button";
import SlotForm from "./slot-form";
import { requireBoard } from "@/lib/auth";

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  await requireBoard();
  const { id } = await params;
  const { token } = await searchParams;
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id,name,cycle_id,starts_at,checkin_opens_at,checkin_closes_at,checkins(count)").eq("id", id).maybeSingle();
  if (!event) notFound();
  const { data: slots } = await supabase.from("event_slots").select("id,starts_at,ends_at,capacity").eq("event_id", id);
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  const baseUrl = process.env.BASE_URL ?? `${protocol}://${host}`;
  const checkinUrl = token ? `${baseUrl}/checkin/${token}` : null;
  const qrDataUrl = checkinUrl ? await QRCode.toDataURL(checkinUrl) : null;
  return <main className="flex-1 p-8 max-w-md mx-auto w-full flex flex-col gap-4"><h1 className="text-xl font-semibold">{event.name}</h1><p className="text-sm text-gray-500">{new Date(event.starts_at).toLocaleString()}</p><p className="text-sm text-gray-500">Operational attendance only</p><p className="text-sm text-gray-500">Check-in window: {new Date(event.checkin_opens_at).toLocaleString()} – {new Date(event.checkin_closes_at).toLocaleString()}</p><p className="text-sm">Check-ins so far: <strong>{event.checkins[0]?.count ?? 0}</strong></p>{qrDataUrl && <><Image unoptimized src={qrDataUrl} alt="Check-in QR code" width={256} height={256} /><p className="text-xs break-all text-gray-500">{checkinUrl}</p></>}{!qrDataUrl && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">For security, the raw check-in token is shown only when created or rotated. Rotate it to display a new QR code.</p>}<RotateButton eventId={event.id} />{event.cycle_id && <SlotForm cycleId={event.cycle_id} eventId={event.id} />}<ul className="text-sm">{(slots ?? []).map((slot) => <li key={slot.id}>{new Date(slot.starts_at).toLocaleString()} · cap {slot.capacity}</li>)}</ul></main>;
}
