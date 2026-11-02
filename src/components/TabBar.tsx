"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlusIcon, SearchIcon, ShelfIcon, UserIcon } from "./icons";

const TABS = [
  { href: "/shelf", label: "Shelf", Icon: ShelfIcon },
  { href: "/search", label: "Discover", Icon: SearchIcon },
  { href: "/add", label: "Rank a book", Icon: PlusIcon, rank: true },
  { href: "/you", label: "You", Icon: UserIcon },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar__inner">
        {TABS.map(({ href, label, Icon, rank }) => {
          const current = path === href || path.startsWith(href + "/");
          return rank ? (
            <Link key={href} href={href} className="tab tab--rank" aria-label={label} aria-current={current ? "page" : undefined}>
              <Icon size={24} />
            </Link>
          ) : (
            <Link key={href} href={href} className="tab" aria-current={current ? "page" : undefined}>
              <Icon strokeWidth={current ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
