import React from "react";
import { Audio } from "@remotion/media";
import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { staticFile } from "remotion";
import { Admin } from "./scenes/Admin";
import { Contact, ContactProps } from "./scenes/Contact";
import { Intro } from "./scenes/Intro";
import { LiveScore } from "./scenes/LiveScore";
import { Profiles } from "./scenes/Profiles";
import { Rules } from "./scenes/Rules";
import { Scorer } from "./scenes/Scorer";
import { Stats } from "./scenes/Stats";
import { Tournaments } from "./scenes/Tournaments";
import { SCENES, TRANSITION } from "./timeline";

export { PROMO_DURATION, SCENES } from "./timeline";

const t = linearTiming({ durationInFrames: TRANSITION });
const s = springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION });

// La música (public/music.mp3) se genera con `npm run music` a partir de timeline.ts y data.ts,
// así que los golpes caen en los cortes, los puntos y los momentos clave de cada escena.
export const Promo: React.FC<ContactProps> = ({ phone, email, web }) => (
  <>
    <TransitionSeries>
      <TransitionSeries.Sequence name="Intro" durationInFrames={SCENES.intro}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={t} />
      <TransitionSeries.Sequence name="Reglamento" durationInFrames={SCENES.rules}>
        <Rules />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={s} />
      <TransitionSeries.Sequence name="Mesa" durationInFrames={SCENES.scorer}>
        <Scorer />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={s} />
      <TransitionSeries.Sequence name="Marcador" durationInFrames={SCENES.live}>
        <LiveScore />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom-left" })} timing={t} />
      <TransitionSeries.Sequence name="Estadisticas" durationInFrames={SCENES.stats}>
        <Stats />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={s} />
      <TransitionSeries.Sequence name="Torneo" durationInFrames={SCENES.tournaments}>
        <Tournaments />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-top" })} timing={t} />
      <TransitionSeries.Sequence name="Admin" durationInFrames={SCENES.admin}>
        <Admin />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={s} />
      <TransitionSeries.Sequence name="Ligas y app" durationInFrames={SCENES.profiles}>
        <Profiles />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={t} />
      <TransitionSeries.Sequence name="Contacto" durationInFrames={SCENES.contact}>
        <Contact phone={phone} email={email} web={web} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Audio name="Música" src={staticFile("music.mp3")} />
  </>
);
