import HomeGallery from "@/components/night/HomeGallery";
import HomePackages from "@/components/night/HomePackages";
import HomeAbout from "@/components/night/HomeAbout";
import HomePartners from "@/components/night/HomePartners";
import HomeBrief from "@/components/night/HomeBrief";

export default function HomeRunway() {
  return (
    <div className="fa-home fa-film" data-testid="home-showcase">
      <HomeGallery />
      <HomePackages />
      <HomeAbout />
      <HomePartners />
      <HomeBrief />
    </div>
  );
}
