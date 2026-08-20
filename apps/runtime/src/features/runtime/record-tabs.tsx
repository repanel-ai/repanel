import { TabBar, tabClasses } from "@repanel/ui";
import { Link, useLocation } from "react-router";
import { relatedTitle, type RelatedList } from "./detail-layout";

/** The panel holding the record's own sections. It is always the first tab. */
export const DETAILS_TAB = "details";

/**
 * Which panel of a record is open. It lives in the address, so a tab can be
 * linked to, gone back from and reloaded into — the same rule the table's
 * search and filters follow.
 */
export function currentTab(search: string, lists: RelatedList[]): string {
  const asked = new URLSearchParams(search).get("tab");
  return lists.some((list) => list.relationship.key === asked) ? (asked as string) : DETAILS_TAB;
}

export interface RecordTabsProps {
  lists: RelatedList[];
  current: string;
}

/**
 * The record's own facts, then each set of records it is related to. The
 * relationship tabs wear the dotted rule, because what they lead to belongs to
 * a different record — the same signature the values carry, at the scale of a
 * whole panel (DESIGN.md §5).
 */
export function RecordTabs({ lists, current }: RecordTabsProps) {
  const location = useLocation();

  const tab = (key: string, label: string, isRelation: boolean) => (
    <li key={key}>
      <Link
        to={{ search: key === DETAILS_TAB ? "" : `?tab=${encodeURIComponent(key)}` }}
        // The way back to the table rides in the router's state, and moving
        // between tabs must not drop it.
        state={location.state}
        aria-current={key === current ? "page" : undefined}
        className={tabClasses(key === current)}
      >
        <span
          className={
            isRelation
              ? "underline decoration-muted-foreground decoration-dotted decoration-1 underline-offset-[3px]"
              : undefined
          }
        >
          {label}
        </span>
      </Link>
    </li>
  );

  return (
    <TabBar label="Record">
      {tab(DETAILS_TAB, "Details", false)}
      {lists.map((list) => tab(list.relationship.key, relatedTitle(list), true))}
    </TabBar>
  );
}
