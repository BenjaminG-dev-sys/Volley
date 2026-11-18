import "server-only";

import { headers } from "next/headers";
import { BRAND } from "@/lib/brand";
import { ROLE_LABEL, type Role } from "@/lib/types";

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function tempPassword(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://ecuavoley.integroecuador.com";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export function accessEmail(p: { name: string | null; email: string; password: string; role: Role; url: string }) {
  const login = `${p.url}/ingresar`;
  const subject = `Tu acceso a ${BRAND.short} (${ROLE_LABEL[p.role]})`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
<div style="background:${BRAND.colors.navy};color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
<div style="font-size:13px;opacity:.85">${esc(BRAND.name)}</div>
<div style="font-size:20px;font-weight:bold">Planilla electrónica · Voley EC</div></div>
<div style="border:1px solid #ddd;border-top:0;padding:22px;border-radius:0 0 10px 10px">
<p>Hola${p.name ? " " + esc(p.name) : ""},</p>
<p>Se creó tu cuenta con el rol <b>${esc(ROLE_LABEL[p.role])}</b>.</p>
<table style="background:#f3f5fa;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:15px">
<tr><td style="padding:4px 12px 4px 0;color:#555">Usuario</td><td><b>${esc(p.email)}</b></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Contraseña temporal</td><td><b style="font-family:monospace;font-size:16px">${esc(p.password)}</b></td></tr></table>
<p style="text-align:center;margin:22px 0"><a href="${login}" style="background:${BRAND.colors.red};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Ingresar</a></p>
<p style="font-size:14px">Al ingresar por primera vez te pediremos crear tu propia contraseña. Te enviaremos un código de 6 dígitos a este correo para confirmarlo.</p>
<p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:10px">Voley EC · un producto de ${esc(BRAND.builtBy.name)} · integroecuador.com</p></div></div>`;
  return { subject, html };
}
