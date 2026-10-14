import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { z } from "zod";
import { Ball, BigTitle, Kicker, useEnter } from "../components";
import { C, display, sans } from "../theme";

export const contactSchema = z.object({
  phone: z.string(),
  email: z.string(),
});

export type ContactProps = z.infer<typeof contactSchema>;

export const defaultContact: ContactProps = {
  phone: "0996700600",
  email: "admin@integroecuador.com",
};

const PhoneIcon = () => (
  <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke={C.volt} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);

const MailIcon = () => (
  <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke={C.volt} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 6l-10 7L2 6" />
  </svg>
);

const ContactItem: React.FC<{ label: string; value: string; icon: React.ReactNode; delay: number; size: number }> = ({ label, value, icon, delay, size }) => {
  const p = useEnter(delay);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: p, translate: `0px ${(1 - p) * 60}px` }}>
      <div style={{ width: 120, height: 120, borderRadius: 60, border: `4px solid ${C.volt}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 30, letterSpacing: "0.2em", color: "#a1a1a3" }}>{label}</div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: size, lineHeight: 0.95, color: C.paper }}>{value}</div>
      </div>
    </div>
  );
};

export const Contact: React.FC<ContactProps> = ({ phone, email }) => {
  const frame = useCurrentFrame();
  const ball = useEnter(10, 12);

  return (
    <AbsoluteFill name="Contacto" style={{ backgroundColor: C.volt }}>
      <div style={{ position: "absolute", left: 120, top: 110, display: "flex", flexDirection: "column", gap: 30 }}>
        <Kicker delay={4}>Contacto</Kicker>
        <BigTitle lines={["Lleva tu liga al", "siguiente nivel"]} delay={6} size={190} />
      </div>
      <div style={{ position: "absolute", right: 120, top: 110, display: "flex", alignItems: "center", gap: 16, scale: ball }}>
        <Ball size={70} color={C.ink} rotate={frame * 2} />
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 64, color: C.ink }}>VOLEY EC</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 480,
          background: C.ink,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: 40,
          padding: "0 120px",
          translate: interpolate(frame, [22, 44], ["0px 480px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <ContactItem label="LLÁMANOS" value={phone} icon={<PhoneIcon />} delay={42} size={110} />
        <ContactItem label="ESCRÍBENOS" value={email} icon={<MailIcon />} delay={52} size={96} />
      </div>
    </AbsoluteFill>
  );
};
