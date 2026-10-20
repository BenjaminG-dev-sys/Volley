import React from "react";
import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { Admin } from "./scenes/Admin";
import { Contact, ContactProps } from "./scenes/Contact";
import { Intro } from "./scenes/Intro";
import { LiveScore } from "./scenes/LiveScore";
import { Profiles } from "./scenes/Profiles";
import { Rules } from "./scenes/Rules";
import { Scorer } from "./scenes/Scorer";
import { Stats } from "./scenes/Stats";
import { Tournaments } from "./scenes/Tournaments";

export const SCENES = {
  intro: 110,
  rules: 170,
  scorer: 180,
  live: 160,
  stats: 170,
  tournaments: 165,
  admin: 190,
  profiles: 165,
  contact: 210,
};
export const TRANSITION = 15;
export const PROMO_DURATION =
  Object.values(SCENES).reduce((a, b) => a + b, 0) - TRANSITION * (Object.keys(SCENES).length - 1);

const t = linearTiming({ durationInFrames: TRANSITION });
const s = springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION });

export const Promo: React.FC<ContactProps> = ({ phone, email, web }) => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Intro" durationInFrames={110}>
      <Intro />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={t} />
    <TransitionSeries.Sequence name="Reglamento" durationInFrames={170}>
      <Rules />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={s} />
    <TransitionSeries.Sequence name="Mesa" durationInFrames={180}>
      <Scorer />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={s} />
    <TransitionSeries.Sequence name="Marcador" durationInFrames={160}>
      <LiveScore />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom-left" })} timing={t} />
    <TransitionSeries.Sequence name="Estadisticas" durationInFrames={170}>
      <Stats />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={s} />
    <TransitionSeries.Sequence name="Torneo" durationInFrames={165}>
      <Tournaments />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={wipe({ direction: "from-top" })} timing={t} />
    <TransitionSeries.Sequence name="Admin" durationInFrames={190}>
      <Admin />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={s} />
    <TransitionSeries.Sequence name="Ligas y app" durationInFrames={165}>
      <Profiles />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={t} />
    <TransitionSeries.Sequence name="Contacto" durationInFrames={210}>
      <Contact phone={phone} email={email} web={web} />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
