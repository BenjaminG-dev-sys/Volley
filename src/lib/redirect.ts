/**
 * Ruta interna segura para redirigir tras iniciar sesión.
 * Rechaza URLs absolutas y las relativas al protocolo (`//host`, `/\host`), que el
 * navegador resolvería hacia otro dominio.
 */
export function safeNext(next: string | null | undefined): string {
  const n = (next ?? "").trim();
  return /^\/(?![/\\])/.test(n) && !/[\r\n\t]/.test(n) ? n : "/";
}
