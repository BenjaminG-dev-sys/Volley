import React from "react";
import { Composition, Folder } from "remotion";
import { PROMO_DURATION, Promo, SCENES } from "./Promo";
import { Admin } from "./scenes/Admin";
import { Contact, contactSchema, defaultContact } from "./scenes/Contact";
import { Intro } from "./scenes/Intro";
import { LiveScore } from "./scenes/LiveScore";
import { Profiles } from "./scenes/Profiles";
import { Rules } from "./scenes/Rules";
import { Scorer } from "./scenes/Scorer";
import { Stats } from "./scenes/Stats";
import { Tournaments } from "./scenes/Tournaments";
import { FPS, HEIGHT, WIDTH } from "./theme";

const size = { width: WIDTH, height: HEIGHT, fps: FPS };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={PROMO_DURATION}
      schema={contactSchema}
      defaultProps={defaultContact}
      {...size}
    />
    <Folder name="Escenas">
      <Composition id="Intro" component={Intro} durationInFrames={SCENES.intro} {...size} />
      <Composition id="Reglamento" component={Rules} durationInFrames={SCENES.rules} {...size} />
      <Composition id="Mesa" component={Scorer} durationInFrames={SCENES.scorer} {...size} />
      <Composition id="Marcador" component={LiveScore} durationInFrames={SCENES.live} {...size} />
      <Composition id="Estadisticas" component={Stats} durationInFrames={SCENES.stats} {...size} />
      <Composition id="Torneo" component={Tournaments} durationInFrames={SCENES.tournaments} {...size} />
      <Composition id="Admin" component={Admin} durationInFrames={SCENES.admin} {...size} />
      <Composition id="Ligas" component={Profiles} durationInFrames={SCENES.profiles} {...size} />
      <Composition
        id="Contacto"
        component={Contact}
        durationInFrames={SCENES.contact}
        schema={contactSchema}
        defaultProps={defaultContact}
        {...size}
      />
    </Folder>
  </>
);
