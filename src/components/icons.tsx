import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 22, children, strokeWidth = 1.8, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);
export const PlusIcon = (p: P) => (
  <Base strokeWidth={2.2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const ShelfIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 4v16M10 4v16M15 5l4 15" />
  </Base>
);
export const UserIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Base>
);
export const CloseIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);
export const BackIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Base>
);
export const ArrowIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);
export const BookmarkIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </Base>
);
export const FileIcon = (p: P) => (
  <Base {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Base>
);
export const BoltIcon = (p: P) => (
  <Base strokeWidth={2.2} {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </Base>
);
