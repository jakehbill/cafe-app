import Link from "next/link";

/** Matches app `BrandTopBar` rendered size. */
export const LOGO_WIDTH = 188;
export const LOGO_HEIGHT = 43;

type BeanedLogoProps = {
  href?: string;
  /** Invert to white for dark surfaces (hero). */
  inverted?: boolean;
  className?: string;
  priority?: boolean;
};

export function BeanedLogo({
  href = "/",
  inverted = false,
  className = "",
  priority = false,
}: BeanedLogoProps) {
  const focusRing = inverted
    ? "focus-visible:outline-paper"
    : "focus-visible:outline-ink";

  return (
    <Link
      href={href}
      className={`flex h-[43px] shrink-0 items-center justify-start transition-opacity duration-300 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${focusRing} ${className}`}
      aria-label="Beaned home"
    >
      {/* Same asset as app homepage */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/beaned-logo.svg"
        alt=""
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={`h-[43px] w-[188px] object-contain object-left ${
          inverted ? "brightness-0 invert" : ""
        }`}
        decoding={priority ? "sync" : "async"}
      />
    </Link>
  );
}
