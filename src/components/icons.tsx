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
export const HomeIcon = (p: P) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </Base>
);
export const BellIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Base>
);
export const ScanIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13 9v6M17 9v6" />
  </Base>
);
export const BookOpenIcon = (p: P) => (
  <Base {...p}>
    <path d="M3 5.5C5 4.5 8 4.5 12 6.5c4-2 7-2 9-1v13c-2-1-5-1-9 1-4-2-7-2-9-1z" />
    <path d="M12 6.5v13" />
  </Base>
);
export const LockIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Base>
);
export const ShareIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <path d="M12 15V3M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </Base>
);
export const SparkIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </Base>
);
export const HeartIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Base strokeWidth={2} {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill={filled ? "currentColor" : "none"} />
  </Base>
);
export const CommentIcon = (p: P) => (
  <Base strokeWidth={2} {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
  </Base>
);
export const MoreIcon = (p: P) => (
  <Base strokeWidth={2.4} {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  </Base>
);
export const PokeIcon = (p: P) => (
  <Base {...p}>
    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2" />
    <path d="M15 11a1.5 1.5 0 0 1 3 0v3.5A6.5 6.5 0 0 1 11.5 21h-.6a5 5 0 0 1-4-2l-2.6-3.6a1.5 1.5 0 0 1 2.3-1.9L9 15.5" />
    <path d="M4.5 4.5 3 3M7 3.2 6.6 1.5M3.2 7 1.5 6.6" />
  </Base>
);
