import { useLayoutEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";

const KEYWORDS = ["lumină.", "mișcare.", "aer.", "ritm."];
const INITIAL_DELAY = 450;
const TYPE_DELAY = 85;
const HOLD_DELAY = 3200;
const DELETE_DELAY = 55;
const PAUSE_DELAY = 180;

const sliceCharacters = (value, length) => Array.from(value).slice(0, length).join("");

export const HeroTypingTitle = ({
  titleLead = CMS_DEFAULTS.homePage.hero.titleLead,
  titleTail = CMS_DEFAULTS.homePage.hero.titleTail,
}) => {
  const prefix = titleTail.startsWith("în ") ? "în " : "";
  const keywords = useMemo(() => titleTail === CMS_DEFAULTS.homePage.hero.titleTail
    ? KEYWORDS : [titleTail.slice(prefix.length)], [prefix, titleTail]);
  const sizer = keywords.reduce((longest, word) => word.length > longest.length ? word : longest, "");
  const reduceMotion = useReducedMotion();
  const [displayedWord, setDisplayedWord] = useState("");
  const [phase, setPhase] = useState("typing");

  useLayoutEffect(() => {
    if (reduceMotion) return undefined;

    let timeoutId = 0;
    let active = true;
    let currentWordIndex = 0;
    let currentWord = "";
    let currentPhase = "typing";

    const publish = () => {
      if (!active) return;
      setDisplayedWord(currentWord);
      setPhase(currentPhase);
    };

    const schedule = (delay) => {
      timeoutId = window.setTimeout(() => {
        if (!active) return;

        const targetWord = keywords[currentWordIndex];

        if (currentPhase === "typing") {
          const nextLength = Array.from(currentWord).length + 1;
          currentWord = sliceCharacters(targetWord, nextLength);
          if (nextLength === Array.from(targetWord).length) currentPhase = "holding";
          publish();
          schedule(currentPhase === "holding" ? HOLD_DELAY : TYPE_DELAY);
          return;
        }

        if (currentPhase === "holding") {
          currentPhase = "deleting";
          publish();
          schedule(DELETE_DELAY);
          return;
        }

        if (currentPhase === "deleting") {
          const nextLength = Math.max(0, Array.from(currentWord).length - 1);
          currentWord = sliceCharacters(targetWord, nextLength);
          if (nextLength === 0) currentPhase = "paused";
          publish();
          schedule(currentPhase === "paused" ? PAUSE_DELAY : DELETE_DELAY);
          return;
        }

        currentWordIndex = (currentWordIndex + 1) % keywords.length;
        currentWord = "";
        currentPhase = "typing";
        publish();
        schedule(TYPE_DELAY);
      }, delay);
    };

    publish();
    schedule(INITIAL_DELAY);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [keywords, reduceMotion]);

  const visualWord = reduceMotion ? keywords[0] : displayedWord;
  const caretVisible = !reduceMotion && (phase === "typing" || phase === "deleting");

  return (
    <h1 id="nr-hero-title" className="nr-hero__title">
      <span className="nr-hero__accessible-title">{titleLead} {titleTail}</span>
      <span className="nr-hero__title-line" aria-hidden="true">{titleLead}</span>
      <span className="nr-hero__title-line" aria-hidden="true">
        {prefix}
        <span className="nr-hero__keyword-slot">
          <span className="nr-hero__keyword-sizer">{sizer}</span>
          <span className="nr-hero__keyword-active">
            <span className="nr-hero__keyword" data-phase={phase}>{visualWord}</span>
            {caretVisible && <span className="nr-hero__caret" aria-hidden="true" />}
          </span>
        </span>
      </span>
    </h1>
  );
};

export default HeroTypingTitle;
