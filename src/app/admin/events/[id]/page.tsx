import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import RotateButton from "./rotate-button";
import { requireBoard } from "@/lib/auth";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireBoard();
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const checkinCount = await prisma.checkin.count({ where: { eventId: id } });

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  const baseUrl = process.env.BASE_URL ?? `${protocol}://${host}`;
  const checkinUrl = `${baseUrl}/checkin/${event.checkinToken}`;
  const qrDataUrl = await QRCode.toDataURL(checkinUrl);

  return (
    <main className="flex-1 p-8 max-w-md mx-auto w-full flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{event.name}</h1>
      <p className="text-sm text-gray-500">{event.date.toLocaleString()}</p>
      <p className="text-sm text-gray-500">Operational attendance only</p>
      <p className="text-sm text-gray-500">
        Check-in window: {event.checkinOpensAt.toLocaleString()} –{" "}
        {event.checkinClosesAt.toLocaleString()}
      </p>
      <p className="text-sm">
        Check-ins so far: <strong>{checkinCount}</strong>
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="Check-in QR code" width={256} height={256} />
      <p className="text-xs break-all text-gray-500">{checkinUrl}</p>

      <RotateButton eventId={event.id} />
    </main>
  );
}
