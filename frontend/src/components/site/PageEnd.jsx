import HomeReviews from "@/components/night/HomeReviews";
import HomeBlog from "@/components/blog/HomeBlog";
import Footer from "@/components/site/Footer";

export default function PageEnd({ showBlog = false }) {
  return (
    <>
      {showBlog && <HomeBlog />}
      <HomeReviews />
      <Footer />
    </>
  );
}
