import { prisma } from "@/lib/db";
import { isCheckinWindowOpen } from "@/lib/rush.js";
import CheckinForm from "./checkin-form";

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const event = await prisma.event.findUnique({ where: { checkinToken: token } });

  if (!event) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p>This check-in link isn&apos;t valid.</p>
      </main>
    );
  }

  const open = isCheckinWindowOpen(event, new Date());

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">{event.name}</h1>
      <p className="text-sm text-gray-500">
        {event.date.toLocaleString()}
      </p>
      {open ? (
        <CheckinForm token={token} />
      ) : (
        <p className="text-gray-600">Check-in is not open for this event right now.</p>
      )}
    </main>
  );
}
