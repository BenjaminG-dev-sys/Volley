// Validación de cédula de identidad ecuatoriana (personas naturales).
// 10 dígitos: provincia (01–24, o 30 para ecuatorianos en el exterior),
// tercer dígito < 6 y dígito verificador por módulo 10.

const COEFFICIENTS = [2, 1, 2, 1, 2, 1, 2, 1, 2];

export function cedulaCheckDigit(first9: string): number {
  const sum = COEFFICIENTS.reduce((acc, c, i) => {
    const p = Number(first9[i]) * c;
    return acc + (p > 9 ? p - 9 : p);
  }, 0);
  return (10 - (sum % 10)) % 10;
}

export function validateCedula(raw: string): string | null {
  const c = raw.trim();
  if (!/^\d{10}$/.test(c)) return "La cédula debe tener 10 dígitos.";
  const province = Number(c.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return "Código de provincia inválido.";
  if (Number(c[2]) >= 6) return "El tercer dígito no corresponde a una persona natural.";
  if (cedulaCheckDigit(c.slice(0, 9)) !== Number(c[9])) return "Dígito verificador incorrecto.";
  return null;
}

export const isValidCedula = (c: string) => validateCedula(c) === null;

/** Genera una cédula válida (para datos de demostración) a partir de una semilla. */
export function makeCedula(province: number, serial: number): string {
  const first9 = `${String(province).padStart(2, "0")}${String(serial % 10_000_000).padStart(7, "0")}`;
  // Fuerza el tercer dígito < 6
  const fixed = first9.slice(0, 2) + String(Number(first9[2]) % 6) + first9.slice(3);
  return fixed + cedulaCheckDigit(fixed);
}
