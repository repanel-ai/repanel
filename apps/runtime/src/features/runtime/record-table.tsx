import type { Field, RecordDto, RecordId, Resource } from "@repanel/contracts";
import {
  Skeleton,
  SortArrowIcon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@repanel/ui";
import type { ReactNode } from "react";
import { RecordCell } from "./record-cell";
import type { TableSort } from "./table-state";

/**
 * Sorting a relation would order the rows by the key behind the label rather
 * than by the label the column shows, and a json value has no order a human
 * means by it. Every other column can be sorted from its header.
 */
const UNSORTABLE: ReadonlyArray<Field["type"]> = ["relation", "json"];

const PENDING_ROWS = 20;

export interface RecordTableProps {
  projectKey: string;
  resource: Resource;
  /** The view's columns, resolved to fields, in the order it declares them. */
  columns: Field[];
  records: RecordDto[];
  isPending: boolean;
  sort: TableSort;
  onSort: (field: string) => void;
  onOpen: (id: RecordId) => void;
  /** Shown in place of the rows when there are none to show. */
  empty: ReactNode;
  /** The footer. It is the last thing inside the frame, so it meets the rows. */
  footer?: ReactNode;
}

/**
 * The table, its header and its footer as one bounded object: the frame scrolls
 * its rows and nothing else, so with four rows the footer meets row four and
 * with a full page it sits at the bottom of the scroll — never with dead space
 * above it (DESIGN.md BUILD REQUIREMENT 2).
 */
export function RecordTable({
  projectKey,
  resource,
  columns,
  records,
  isPending,
  sort,
  onSort,
  onOpen,
  empty,
  footer,
}: RecordTableProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border",
        // While the rows are on their way the frame holds the height they will
        // need, so nothing on the screen moves when they arrive.
        isPending ? "flex-1" : "flex-[0_1_auto]",
      )}
    >
      <div className={cn("min-h-0 flex-[0_1_auto]", isPending ? "overflow-hidden" : "overflow-auto")}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((field) => (
                <ColumnHeader
                  key={field.key}
                  field={field}
                  sort={sort}
                  onSort={onSort}
                />
              ))}
            </TableRow>
          </TableHeader>

          {isPending ? (
            <PendingRows columns={columns.length} />
          ) : (
            <TableBody>
              {records.map((record) => (
                <TableRow
                  key={String(record.id)}
                  tabIndex={0}
                  onClick={() => onOpen(record.id)}
                  onKeyDown={(event) => {
                    // A relation link inside the row answers for itself; only a
                    // key pressed on the row is the row's to act on.
                    if (event.target !== event.currentTarget) return;
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    onOpen(record.id);
                  }}
                  className="cursor-pointer hover:bg-muted"
                >
                  {columns.map((field) => (
                    <TableCell key={field.key}>
                      <RecordCell
                        projectKey={projectKey}
                        field={field}
                        value={record.values[field.key] ?? null}
                        isIdentity={field.key === resource.primaryKey}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

              {records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-auto border-b-0">
                    {empty}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          )}
        </Table>
      </div>
      {footer}
    </div>
  );
}

function ColumnHeader({
  field,
  sort,
  onSort,
}: {
  field: Field;
  sort: TableSort;
  onSort: (field: string) => void;
}) {
  const sortable = !UNSORTABLE.includes(field.type);
  const active = sort.field === field.key;

  return (
    <TableHead
      aria-sort={
        sortable ? (active ? (sort.direction === "asc" ? "ascending" : "descending") : "none") : undefined
      }
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(field.key)}
          className={cn(
            "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 outline-none",
            "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
            active && "text-foreground",
          )}
        >
          {field.label}
          {active && <SortArrowIcon className={cn("size-3", sort.direction === "desc" && "rotate-180")} />}
        </button>
      ) : (
        field.label
      )}
    </TableHead>
  );
}

/**
 * The shape of the page while it is on its way. The columns are the
 * definition's, so they are already known and already drawn; only the values
 * are missing, and the rows say so without saying anything to a screen reader.
 */
function PendingRows({ columns }: { columns: number }) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: PENDING_ROWS }, (_, row) => (
        <tr key={row}>
          {Array.from({ length: columns }, (_, cell) => (
            <td key={cell} className="h-row border-b border-border px-2.5 align-middle">
              <Skeleton className="h-3" style={{ width: widthFor(row, cell) }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/**
 * Placeholder bars in a few widths rather than one: a column of identical bars
 * reads as a loading bar chart, and text does not arrive rectangular.
 */
const WIDTHS = ["72%", "54%", "88%", "46%", "66%"];

function widthFor(row: number, cell: number): string {
  return WIDTHS[(row * 3 + cell * 2) % WIDTHS.length] ?? "60%";
}
