import type { SVGProps } from "react";

/** Small line-icon set for the public site (1.5px stroke, inherits colour). */
const PATHS: Record<string, React.ReactNode> = {
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 12 3.5 6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="1.5" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" />
    </>
  ),
  cloche: (
    <>
      <path d="M3 17.5h18M4.5 17.5a7.5 7.5 0 0 1 15 0" />
      <path d="M12 10V8.5m-1.5 0h3" />
    </>
  ),
  "chef-hat": (
    <>
      <path d="M7 14.5v4.5h10v-4.5" />
      <path d="M7 14.5a4 4 0 0 1-.9-7.9 5.5 5.5 0 0 1 11.8 0 4 4 0 0 1-.9 7.9Z" />
      <path d="M7 17h10" />
    </>
  ),
  glass: <path d="M8 3.5h8l-.6 5a3.4 3.4 0 0 1-6.8 0L8 3.5Zm4 8.4V20m-3.5.5h7" />,
  pay: (
    <>
      <ellipse cx="10" cy="7" rx="6" ry="2.5" />
      <path d="M4 7v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7" />
      <path d="M8 16.3c.6.1 1.3.2 2 .2 3.3 0 6-1.1 6-2.5M16 11.5c2.4.3 4 1.2 4 2.3v3.7c0 1.4-2.7 2.5-6 2.5-2.3 0-4.3-.5-5.3-1.3" />
    </>
  ),
  growth: <path d="m3.5 17 6-6 4 4 7-7.5m0 0H15m5.5 0V13" />,
  training: (
    <>
      <path d="m2.5 9.5 9.5-4.5 9.5 4.5-9.5 4.5-9.5-4.5Z" />
      <path d="M6.5 11.5v4.3c0 1.2 2.5 2.7 5.5 2.7s5.5-1.5 5.5-2.7v-4.3M21.5 9.5v5" />
    </>
  ),
  team: (
    <>
      <circle cx="12" cy="8" r="3" />
      <circle cx="5.5" cy="10" r="2.2" />
      <circle cx="18.5" cy="10" r="2.2" />
      <path d="M6.5 19.5a5.5 5.5 0 0 1 11 0M2 18.5a3.8 3.8 0 0 1 5-3.3M22 18.5a3.8 3.8 0 0 0-5-3.3" />
    </>
  ),
  perks: <path d="m12 3.5 2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.1 6-.8L12 3.5Z" />,
  star: <path d="m12 3.5 2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.1 6-.8L12 3.5Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  home: <path d="M4 11 12 4.5l8 6.5M6 9.5V19.5h12V9.5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path d="m4 6.5 8 6 8-6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  // Admin navigation
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
    </>
  ),
  inbox: <path d="M4 13.5 6.5 5h11l2.5 8.5M4 13.5V19h16v-5.5M4 13.5h4.5l1 2h5l1-2H20" />,
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="0.5" />
      <rect x="14" y="4" width="6" height="6" rx="0.5" />
      <rect x="4" y="14" width="6" height="6" rx="0.5" />
      <path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 18.5v1.5M20 14v1.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.2a5.5 5.5 0 0 1 3 4.8" />
    </>
  ),
  shield: <path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-2.5Z" />,
  external: <path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v5.5H4.5V6H10" />,
  logout: <path d="M14.5 8V5.5h-9v13h9V16M10 12h10.5m-3-3 3 3-3 3" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {PATHS[name] ?? PATHS.star}
    </svg>
  );
}

/** Brand marks for the footer (filled). */
export function SocialIcon({ name, className }: { name: "instagram" | "linkedin" | "facebook"; className?: string }) {
  const paths = {
    instagram:
      "M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1.1.4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1.1.4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1.1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1.1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 4.9a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8Zm0 8.1a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm5.1-9.4a1.1 1.1 0 1 0 0 2.3 1.1 1.1 0 0 0 0-2.3Z",
    linkedin:
      "M20.4 2H3.6C2.7 2 2 2.7 2 3.6v16.8c0 .9.7 1.6 1.6 1.6h16.8c.9 0 1.6-.7 1.6-1.6V3.6c0-.9-.7-1.6-1.6-1.6ZM8 19H5V9.5h3V19ZM6.5 8.2a1.7 1.7 0 1 1 0-3.5 1.7 1.7 0 0 1 0 3.5ZM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5s-1.8 1.2-1.8 2.4V19h-3V9.5h2.8v1.3h.1c.4-.7 1.4-1.5 2.8-1.5 3 0 3.6 2 3.6 4.6V19Z",
    facebook:
      "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z",
  };
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <path d={paths[name]} />
    </svg>
  );
}
