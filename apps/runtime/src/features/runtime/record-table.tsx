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

/**
 * How tightly the rows are set. A list nested inside one record is read in
 * passing rather than worked in, so it runs compact.
 */
export type TableDensity = "default" | "compact";

const HEAD_HEIGHT: Record<TableDensity, string> = { default: "h-head", compact: "h-head-compact" };
const ROW_HEIGHT: Record<TableDensity, string> = { default: "h-row", compact: "h-row-compact" };

/** As many placeholder rows as the page it is standing in for will hold. */
const PENDING_ROWS: Record<TableDensity, number> = { default: 20, compact: 5 };

/**
 * A quantity is read against the quantities above and below it, so it is set
 * flush right where the digits line up — with the tabular figures the root
 * already guarantees, that makes a column of numbers one shape.
 *
 * An identity is not a quantity. It is a name that happens to be digits, it is
 * never summed or compared, and it stays where names go — the same distinction
 * `RecordCell` makes when it declines to put separators in an id.
 */
function isQuantity(field: Field, resource: Resource): boolean {
  return field.type === "number" && field.key !== resource.primaryKey;
}

export interface RecordTableProps {
  projectKey: string;
  resource: Resource;
  /** The view's columns, resolved to fields, in the order it declares them. */
  columns: Field[];
  records: RecordDto[];
  isPending: boolean;
  /**
   * How the rows are ordered, and how to reorder them. A list with no address
   * of its own has nowhere to keep an ordering, so it is given neither and its
   * headers are labels.
   */
  sort?: TableSort;
  onSort?: (field: string) => void;
  onOpen: (id: RecordId) => void;
  density?: TableDensity;
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
  density = "default",
  empty,
  footer,
}: RecordTableProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border",
        // While the rows are on their way the frame holds the height they will
        // need, so nothing on the screen moves when they arrive. A compact list
        // draws exactly the rows it is about to have, so it needs no reserve.
        isPending && density === "default" ? "flex-1" : "flex-[0_1_auto]",
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
                  alignRight={isQuantity(field, resource)}
                  density={density}
                />
              ))}
            </TableRow>
          </TableHeader>

          {isPending ? (
            <PendingRows
              columns={columns.map((field) => isQuantity(field, resource))}
              density={density}
            />
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
                    <TableCell
                      key={field.key}
                      className={cn(ROW_HEIGHT[density], isQuantity(field, resource) && "text-right")}
                    >
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
  alignRight,
  density,
}: {
  field: Field;
  sort?: TableSort;
  onSort?: (field: string) => void;
  /** Whether the column's values sit against its right edge, so the head does too. */
  alignRight: boolean;
  density: TableDensity;
}) {
  const sortable = onSort !== undefined && !UNSORTABLE.includes(field.type);
  const active = sort?.field === field.key;

  return (
    <TableHead
      aria-sort={
        sortable ? (active ? (sort?.direction === "asc" ? "ascending" : "descending") : "none") : undefined
      }
      className={cn(HEAD_HEIGHT[density], alignRight && "text-right")}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(field.key)}
          className={cn(
            "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 outline-none",
            "transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
            // The arrow moves to the label's other side so the label itself
            // stays flush with the edge the column is aligned to.
            alignRight && "flex-row-reverse",
            active && "text-foreground",
          )}
        >
          {field.label}
          {active && <SortArrowIcon className={cn("size-3", sort?.direction === "desc" && "rotate-180")} />}
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
function PendingRows({ columns, density }: { columns: boolean[]; density: TableDensity }) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: PENDING_ROWS[density] }, (_, row) => (
        <tr key={row}>
          {columns.map((alignRight, cell) => (
            <td
              key={cell}
              className={cn(ROW_HEIGHT[density], "border-b border-border px-2.5 align-middle")}
            >
              <Skeleton
                className={cn("h-3", alignRight && "ml-auto")}
                style={{ width: widthFor(row, cell) }}
              />
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
