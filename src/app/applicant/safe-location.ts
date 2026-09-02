export function safeHumanLocation(value: string | null | undefined) {
  const location = value?.trim() ?? "";
  if (location.length < 2 || location.length > 200) return null;
  if (/[:][/][/]|^(?:javascript|data|vbscript|mailto):|[<>\u0000-\u001f\u007f]/i.test(location) || !/[\p{L}\p{N}]/u.test(location)) return null;
  return location;
}

export function mapSearchUrl(value: string | null | undefined) {
  const location = safeHumanLocation(value);
  return location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;
}
