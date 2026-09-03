import useManagedContent from "@/hooks/useManagedContent";
import { CMS_DEFAULTS } from "@/data/cmsDefaults";

export default function HomeAbout() {
  const homePage = useManagedContent("homePage", CMS_DEFAULTS.homePage);
  const copy = homePage.about;
  const lastWord = copy.title.lastIndexOf(" ");
  return (
    <section
      id="intro"
      className="fa-about"
      data-home-scene="about"
      data-testid="home-about"
      aria-labelledby="fa-about-title"
    >
      <div className="fa-about__image" aria-hidden="true" />
      <div className="fa-about__shade" aria-hidden="true" />

      <div className="nr-shell fa-about__inner">
        <p className="fa-kicker">{copy.eyebrow}</p>
        <div className="fa-about__copy">
          <h2 id="fa-about-title">{copy.title.slice(0, lastWord + 1)}<em>{copy.title.slice(lastWord + 1)}</em></h2>
          {copy.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </div>
    </section>
  );
}
