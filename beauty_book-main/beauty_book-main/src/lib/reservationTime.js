const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function normalizeTime(value) {
  const candidate = String(value ?? "").trim();
  return TIME_PATTERN.test(candidate) ? candidate.slice(0, 5) : "";
}

/**
 * Returns the actual selected appointment time across current and legacy shapes.
 * `time_slot` is the canonical database field. Some older payloads also contain
 * a `time` value initialised to 00:00, which must not mask a real time_slot.
 */
export function getReservationTime(reservation = {}) {
  const canonical = normalizeTime(reservation.time_slot ?? reservation.timeSlot);
  const selected = normalizeTime(reservation.selectedTime);
  const legacy = normalizeTime(reservation.time);

  const preferred = canonical || selected;
  if (preferred && preferred !== "00:00") return preferred;
  if (legacy && legacy !== "00:00") return legacy;
  return preferred || legacy;
}

