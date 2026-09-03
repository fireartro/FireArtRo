import { Fragment } from "react";
import { splitBlogBody } from "@/lib/blogApi";

export default function BlogBody({ body }) {
  return (
    <div className="fa-blog-body" data-testid="blog-body">
      {splitBlogBody(body).map((lines, paragraphIndex) => (
        <p key={`${paragraphIndex}-${lines[0]}`}>
          {lines.map((line, lineIndex) => (
            <Fragment key={`${lineIndex}-${line}`}>
              {lineIndex > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
