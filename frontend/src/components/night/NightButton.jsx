import { forwardRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const NightButton = forwardRef(function NightButton(
  {
    as: Element,
    to,
    href,
    variant = "primary",
    showArrow = true,
    className,
    children,
    ...props
  },
  ref,
) {
  const classes = cn("nr-button", `nr-button--${variant}`, className);
  const content = (
    <>
      <span className="nr-button__label">{children}</span>
      {showArrow && <ArrowUpRight className="nr-button__icon" aria-hidden="true" />}
      <span className="nr-button__flare" aria-hidden="true" />
    </>
  );

  if (to) {
    return <Link ref={ref} to={to} className={classes} {...props}>{content}</Link>;
  }

  if (href) {
    return <a ref={ref} href={href} className={classes} {...props}>{content}</a>;
  }

  const Component = Element || "button";
  return (
    <Component ref={ref} type={Component === "button" ? "button" : undefined} className={classes} {...props}>
      {content}
    </Component>
  );
});

export default NightButton;
