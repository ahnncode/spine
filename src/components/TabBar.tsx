"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReaderTypeSync } from "./ReaderTypeSync";
import { HomeIcon, PlusIcon, SearchIcon, ShelfIcon, UserIcon } from "./icons";
import { useUnread } from "./useUnread";

const TABS = [
  { href: "/feed", label: "Feed", Icon: HomeIcon },
  { href: "/search", label: "Discover", Icon: SearchIcon },
  { href: "/add", label: "Rank a book", Icon: PlusIcon, rank: true },
  { href: "/shelf", label: "Shelf", Icon: ShelfIcon },
  { href: "/you", label: "You", Icon: UserIcon },
];

export function TabBar() {
  const path = usePathname();
  const unread = useUnread();
  return (
    <nav className="tabbar" aria-label="Main">
      <ReaderTypeSync />
      <div className="tabbar__inner">
        {TABS.map(({ href, label, Icon, rank }) => {
          const current = path === href || path.startsWith(href + "/");
          return rank ? (
            <Link key={href} href={href} className="tab tab--rank" aria-label={label} aria-current={current ? "page" : undefined}>
              <Icon size={24} />
            </Link>
          ) : (
            <Link key={href} href={href} className="tab" aria-current={current ? "page" : undefined}
              aria-label={href === "/feed" && unread ? `${label}, ${unread} new` : undefined}>
              <span className="tab__icon">
                <Icon strokeWidth={current ? 2.2 : 1.8} />
                {href === "/feed" && unread > 0 && <span className="tab__dot" aria-hidden="true" />}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
