/** Queue status alone cannot determine whether the offered booking was confirmed. */
export function waitlistState(
  entry: {
    status: string;
    offer_expires_at: string | null;
    offered_booking?: { status: string; hold_expires_at: string | null } | null;
  },
  now = Date.now(),
) {
  if (entry.status === "cancelled")
    return { label: "Retirado", canOffer: false, canRemove: false };
  if (entry.status === "waiting")
    return { label: "Aguardando", canOffer: true, canRemove: true };
  const booking = entry.offered_booking;
  if (booking?.status === "confirmed" || booking?.status === "completed")
    return {
      label:
        booking.status === "confirmed"
          ? "Reserva confirmada"
          : "Atendimento concluído",
      canOffer: false,
      canRemove: false,
    };
  const expires = booking?.hold_expires_at || entry.offer_expires_at;
  const expired =
    (!!expires && Date.parse(expires) <= now) ||
    ["cancelled", "expired"].includes(booking?.status || "");
  return {
    label: expired
      ? "Oferta encerrada; reavaliar disponibilidade"
      : "Pré-reserva oferecida",
    canOffer: expired,
    canRemove: expired,
  };
}
