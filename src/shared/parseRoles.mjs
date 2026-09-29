// API Gateway entrega el claim "roles" del JWT como un string con formato
// "[ADMIN]" o "[ADMIN, OPERADOR]" (no como array real). Esta función lo
// normaliza a un array de strings limpio, sin importar el formato de entrada.
export function parseRoles(rolesRaw) {
  if (!rolesRaw) return [];
  if (Array.isArray(rolesRaw)) return rolesRaw;
  const str = String(rolesRaw).trim();
  const cleaned = str.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map((r) => r.trim()).filter(Boolean);
}
