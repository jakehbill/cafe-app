import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary";
type Tone = "onInk" | "onPaper";

type SharedProps = {
  children: ReactNode;
  variant?: Variant;
  tone?: Tone;
  className?: string;
};

type ButtonAsButton = SharedProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof SharedProps> & {
    href?: undefined;
  };

type ButtonAsLink = SharedProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof SharedProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const base =
  "inline-flex items-center justify-center rounded-md px-7 py-3.5 text-[0.9375rem] font-medium tracking-[-0.01em] transition-[background-color,color,border-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Tone, Record<Variant, string>> = {
  onInk: {
    primary:
      "bg-paper text-ink hover:bg-paper-deep focus-visible:outline-paper active:scale-[0.98]",
    secondary:
      "border border-hairline-light bg-transparent text-paper hover:border-paper/60 hover:bg-white/5 focus-visible:outline-paper active:scale-[0.98]",
  },
  onPaper: {
    primary:
      "bg-ink text-paper hover:bg-ink-soft focus-visible:outline-ink active:scale-[0.98]",
    secondary:
      "border border-border bg-transparent text-ink hover:border-ink/35 hover:bg-ink/[0.03] focus-visible:outline-ink active:scale-[0.98]",
  },
};

export function Button({
  children,
  variant = "primary",
  tone = "onPaper",
  className = "",
  ...props
}: ButtonProps) {
  const classes = `${base} ${variants[tone][variant]} ${className}`.trim();

  if ("href" in props && props.href) {
    const { href, ...linkProps } = props;
    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as ButtonAsButton;
  return (
    <button type={buttonProps.type ?? "button"} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
