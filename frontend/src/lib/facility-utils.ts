export function formatResidentLocation(
  unit: string | null | undefined,
  room: string | null | undefined,
  bed: string | null | undefined,
  compact?: boolean,
): string {
  const u = unit || null;
  const r = room || null;
  const b = bed || null;

  if (compact) {
    if (r && b) return `Rm ${r}, Bed ${b}`;
    if (r) return `Rm ${r}`;
    if (u) return u;
    if (b) return `Bed ${b}`;
    return "Resident";
  }
  if (u && r && b) return `${u}, Room ${r}, Bed ${b}`;
  if (u && r) return `${u}, Room ${r}`;
  if (r && b) return `Room ${r}, Bed ${b}`;
  if (r) return `Room ${r}`;
  if (u) return u;
  if (b) return `Bed ${b}`;
  return "Resident";
}

export function buildResidentLocationParams(
  unit: string | null | undefined,
  room: string | null | undefined,
  bed: string | null | undefined,
): string {
  const params = new URLSearchParams();
  if (unit) params.set("unit", unit);
  if (room) params.set("room", room);
  if (bed) params.set("bed", bed);
  const str = params.toString();
  return str ? `&${str}` : "";
}
