import { TabBar, tabClasses } from "@repanel/ui";
import { Link, useLocation } from "react-router";
import { relatedTitle, type RelatedList } from "./detail-layout";

/** The panel holding the record's own sections. It is always the first tab. */
export const DETAILS_TAB = "details";

/**
 * The panel holding what has been done to the record. It is always the last.
 *
 * The name starts with a mark no definition identifier may contain, so a
 * relationship called `activity` and this panel can never be the same address —
 * the runtime's own tab does not compete with the customer's vocabulary for a
 * word. `Details` needs no such care: it is the absence of the parameter rather
 * than a value of it.
 */
export const ACTIVITY_TAB = "-activity";

/**
 * Which panel of a record is open. It lives in the address, so a tab can be
 * linked to, gone back from and reloaded into — the same rule the table's
 * search and filters follow.
 */
export function currentTab(search: string, lists: RelatedList[]): string {
  const asked = new URLSearchParams(search).get("tab");
  if (asked === ACTIVITY_TAB) return ACTIVITY_TAB;
  return lists.some((list) => list.relationship.key === asked) ? (asked as string) : DETAILS_TAB;
}

export interface RecordTabsProps {
  lists: RelatedList[];
  current: string;
}

/**
 * The record's own facts, then each set of records it is related to, then what
 * has been done to it. The relationship tabs wear the dotted rule, because what
 * they lead to belongs to a different record — the same signature the values
 * carry, at the scale of a whole panel (DESIGN.md §5).
 *
 * `Details` and `Activity` do not wear it, and that is the same rule rather
 * than an exception to it: both panels are about this record.
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
      {tab(ACTIVITY_TAB, "Activity", false)}
    </TabBar>
  );
}
