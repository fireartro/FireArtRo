import { useEffect, useRef, useState } from "react";
import { TEAM_GROUP_IMAGE, TEAM_PLACEHOLDERS } from "@/data/homeExperience";

const TEAM_COPY_LAYOUT = {
  production: {
    side: "right",
    anchorX: "26.5%",
    anchorY: "43%",
    copyLines: ["Leagă brief-ul și calendarul de producție.", "Ține echipele din teren în același plan."],
  },
  "show-design": {
    side: "right",
    anchorX: "45.5%",
    anchorY: "44%",
    copyLines: ["Transformă muzica și povestea evenimentului.", "Le dă ritm într-o coregrafie vizuală."],
  },
  "drone-operations": {
    side: "left",
    anchorX: "48.5%",
    anchorY: "44%",
    copyLines: ["Pregătește zborul și verifică scena aeriană.", "Urmărește fiecare mișcare în execuția live."],
  },
  "technical-execution": {
    side: "left",
    anchorX: "72.5%",
    anchorY: "43%",
    copyLines: ["Coordonează montajul și efectele din teren.", "Face ca fiecare semnal să ajungă la timp."],
  },
};

function renderTypedText(text, startDelay, characterInterval = 14) {
  return Array.from(text).map((character, index) => (
    <span
      aria-hidden="true"
      className="fa-team__typed-char"
      data-team-typed-char
      key={`${character}-${index}`}
      style={{ "--team-char-delay": `${startDelay + (index * characterInterval)}ms` }}
    >
      {character === " " ? "\u00a0" : character}
    </span>
  ));
}

export default function HomeTeam() {
  const [activeId, setActiveId] = useState(null);
  const stageRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const active = TEAM_PLACEHOLDERS.find((person) => person.id === activeId);
  const activeLayout = active ? TEAM_COPY_LAYOUT[active.id] : null;

  useEffect(() => () => window.clearTimeout(hoverTimerRef.current), []);

  useEffect(() => {
    if (!activeId) return undefined;

    const dismissOutside = (event) => {
      if (event.target.closest?.("[data-team-person], [data-team-copy]")) return;
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
      setActiveId(null);
      stageRef.current?.style.setProperty("--team-copy-shift-x", "0px");
      stageRef.current?.style.setProperty("--team-copy-shift-y", "0px");
    };

    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [activeId]);

  const queueActivePerson = (personId, delay = 200, onActivate) => {
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setActiveId(personId);
      hoverTimerRef.current = null;
      onActivate?.();
    }, delay);
  };

  const clearActivePerson = () => {
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setActiveId(null);
    resetCopyParallax();
  };

  const updateCopyParallax = (event) => {
    const stage = stageRef.current;
    if (!stage) return;

    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    stage.style.setProperty("--team-copy-shift-x", `${(x * 18).toFixed(2)}px`);
    stage.style.setProperty("--team-copy-shift-y", `${(y * 12).toFixed(2)}px`);
  };

  const resetCopyParallax = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty("--team-copy-shift-x", "0px");
    stage.style.setProperty("--team-copy-shift-y", "0px");
  };

  return (
    <section
      id="intro"
      className="fa-team"
      data-home-scene="team"
      data-testid="home-team"
      data-active-person={activeId || undefined}
      aria-labelledby="fa-team-title"
    >
      <div className="fa-team__heading nr-shell">
        <p className="fa-kicker">Echipa FireArtRo</p>
        <h2 id="fa-team-title">Oamenii din spatele <em>luminii.</em></h2>
      </div>

      <div
        className="fa-team__stage"
        ref={stageRef}
        onPointerMove={(event) => {
          if (event.pointerType === "touch") return;
          if (activeId && !event.target.closest("[data-team-person]")) clearActivePerson();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") clearActivePerson();
        }}
      >
        <img
          className="fa-team__base"
          src={TEAM_GROUP_IMAGE}
          alt="Echipa FireArtRo în zona de producție a unui spectacol nocturn"
          loading="lazy"
          decoding="async"
        />
        <div className="fa-team__atmosphere" aria-hidden="true" />
        <div className="fa-team__people" aria-label="Roluri în echipa FireArtRo">
          {TEAM_PLACEHOLDERS.map((person) => (
            <div
              className="fa-team__person"
              key={person.id}
              data-active={activeId === person.id ? "true" : undefined}
              style={{
                "--person-left": person.crop.left,
                "--person-top": person.crop.top,
                "--person-width": person.crop.width,
                "--person-height": person.crop.height,
              }}
            >
              <img
                className="fa-team__cutout"
                data-team-cutout
                src={person.cutout}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <button
                className="fa-team__portrait"
                type="button"
                data-team-person
                data-copy-side={TEAM_COPY_LAYOUT[person.id].side}
                data-active={activeId === person.id ? "true" : undefined}
                style={{ clipPath: person.clipPolygon }}
                aria-label={`Vezi rolul: ${person.label}`}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") queueActivePerson(person.id);
                }}
                onPointerMove={(event) => {
                  if (event.pointerType !== "touch") updateCopyParallax(event);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "touch") clearActivePerson();
                }}
                onPointerDown={(event) => {
                  if (event.pointerType === "touch") {
                    window.clearTimeout(hoverTimerRef.current);
                    setActiveId(person.id);
                    resetCopyParallax();
                  }
                }}
                onFocus={() => setActiveId(person.id)}
                onBlur={clearActivePerson}
              >
              </button>
            </div>
          ))}
        </div>
        <aside
          className="fa-team__hover-copy"
          data-team-copy
          data-side={activeLayout?.side}
          data-visible={active ? "true" : undefined}
          aria-live="polite"
          aria-hidden={!active}
          style={activeLayout ? {
            "--team-copy-anchor-x": activeLayout.anchorX,
            "--team-copy-anchor-y": activeLayout.anchorY,
          } : undefined}
        >
          {active && (
            <div className="fa-team__hover-copy-inner" key={active.id}>
              <span data-team-role>Echipa FireArtRo</span>
              <h3 data-team-name aria-label={active.name}>
                {renderTypedText(active.name, 120, 24)}
              </h3>
              <p>
                {activeLayout.copyLines.map((line, index) => (
                  <span
                    className="fa-team__copy-line"
                    data-team-copy-line
                    key={line}
                    aria-label={line}
                  >
                    {renderTypedText(
                      line,
                      500 + activeLayout.copyLines
                        .slice(0, index)
                        .reduce((delay, previousLine) => delay + (previousLine.length * 14) + 120, 0),
                    )}
                  </span>
                ))}
              </p>
            </div>
          )}
        </aside>
      </div>

    </section>
  );
}
