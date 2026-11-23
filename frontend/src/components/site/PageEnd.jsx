import HomeReviews from "@/components/night/HomeReviews";
import HomeBlog from "@/components/blog/HomeBlog";
import Footer from "@/components/site/Footer";

export default function PageEnd({ showBlog = false, showFacebookWidget = false }) {
  return (
    <>
      {showBlog && <HomeBlog />}
      <HomeReviews showFacebookWidget={showFacebookWidget} />
      <Footer />
    </>
  );
}
