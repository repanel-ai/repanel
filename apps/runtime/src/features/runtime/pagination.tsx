import { Button, Select } from "@repanel/ui";
import { PAGE_SIZES } from "./table-state";

export interface PaginationProps {
  page: number;
  pageSize: number;
  /** How many records there are in total, across every page. */
  total: number;
  /** How many are on this page — the range is what came back, not what was asked for. */
  count: number;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
}

/**
 * The footer of the table's frame: where in the records this page is, how big a
 * page is, and the two steps. It is the last element inside the frame, so it
 * meets the final row rather than the bottom of the screen.
 */
export function Pagination({ page, pageSize, total, count, onPage, onPageSize }: PaginationProps) {
  const from = (page - 1) * pageSize + 1;
  const to = from + count - 1;

  return (
    <div className="flex flex-none items-center gap-2.5 border-t border-border px-2.5 py-2">
      <span className="text-small text-muted-foreground">
        {count === 0 ? "No records" : `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
      </span>
      <div className="flex-1" />
      <Select
        label="Rows"
        value={String(pageSize)}
        onChange={(event) => onPageSize(Number(event.target.value))}
        className="text-small"
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </Select>
      <Button variant="outline" disabled={page === 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <Button variant="outline" disabled={page * pageSize >= total} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}
