/** Ghost outline — black stroke, transparent fill (adapts via currentColor). */
export function GhostIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M16 4.25C10.8 4.25 6.75 8.45 6.75 13.35V17.4c0 .55-.22 1.08-.62 1.38l-1.05.82c1.02.62 2.15 1.02 3.35.78.62 1.85 1.82 2.92 3.32 2.92.88 0 1.62-.42 2.05-1.05.43.63 1.17 1.05 2.05 1.05 1.5 0 2.7-1.07 3.32-2.92 1.2.24 2.33-.16 3.35-.78l-1.05-.82a1.75 1.75 0 0 1-.62-1.38V13.35C25.25 8.45 21.2 4.25 16 4.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse
        cx="12.6"
        cy="12.9"
        rx="1.05"
        ry="1.65"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <ellipse
        cx="19.4"
        cy="12.9"
        rx="1.05"
        ry="1.65"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <ellipse
        cx="16"
        cy="17.2"
        rx="1.25"
        ry="1.85"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}
