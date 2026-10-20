import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { z } from "zod";
import { BigTitle, BrandBand, Kicker, Logo, useEnter } from "../components";
import { BRAND } from "../data";
import { C, ESFERA, display, sans } from "../theme";

export const contactSchema = z.object({
  phone: z.string(),
  email: z.string(),
  web: z.string(),
});

export type ContactProps = z.infer<typeof contactSchema>;

export const defaultContact: ContactProps = {
  phone: "0996700600",
  email: "admin@integroecuador.com",
  web: BRAND.web,
};

const Icon: React.FC<{ d: React.ReactNode }> = ({ d }) => (
  <svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const PHONE = <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />;
const MAIL = (
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 6l-10 7L2 6" />
  </>
);
const WEB = (
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
  </>
);

const ContactItem: React.FC<{ label: string; value: string; icon: React.ReactNode; delay: number; size: number }> = ({ label, value, icon, delay, size }) => {
  const p = useEnter(delay);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: p, translate: `0px ${(1 - p) * 60}px` }}>
      <div style={{ width: 96, height: 96, borderRadius: 48, border: `4px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 26, letterSpacing: "0.2em", color: C.lavender }}>{label}</div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: size, lineHeight: 0.95, color: C.paper }}>{value}</div>
      </div>
    </div>
  );
};

export const Contact: React.FC<ContactProps> = ({ phone, email, web }) => {
  const frame = useCurrentFrame();
  const logo = useEnter(10, 12);

  return (
    <AbsoluteFill name="Contacto" style={{ background: ESFERA }}>
      <BrandBand height={16} />
      <div style={{ position: "absolute", left: 120, top: 110, display: "flex", flexDirection: "column", gap: 28 }}>
        <Kicker delay={4} color={C.paper} bar={C.gold}>
          Contacto
        </Kicker>
        <BigTitle lines={["Lleva tu liga al", "siguiente nivel"]} delay={6} size={170} color={C.paper} />
      </div>
      <div style={{ position: "absolute", right: 120, top: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, scale: logo }}>
        <Logo size={250} />
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 24, letterSpacing: "0.16em", color: C.paper }}>{BRAND.credit.toUpperCase()}</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 470,
          background: C.ink,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 18,
          padding: "0 120px",
          translate: interpolate(frame, [22, 44], ["0px 470px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
        }}
      >
        <ContactItem label="LLÁMANOS" value={phone} icon={<Icon d={PHONE} />} delay={42} size={72} />
        <ContactItem label="ESCRÍBENOS" value={email} icon={<Icon d={MAIL} />} delay={50} size={72} />
        <ContactItem label="WEB" value={web} icon={<Icon d={WEB} />} delay={58} size={72} />
      </div>
    </AbsoluteFill>
  );
};
