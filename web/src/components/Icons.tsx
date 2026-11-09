const icon = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function DownloadIcon() {
  return (
    <svg {...icon}>
      <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
    </svg>
  );
}

export function FilterIcon() {
  return (
    <svg {...icon}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

export function PersonIcon() {
  return (
    <svg {...icon}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg {...icon}>
      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg {...icon}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}
