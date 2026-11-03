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
