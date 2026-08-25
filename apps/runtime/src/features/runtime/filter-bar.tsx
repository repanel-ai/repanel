import type { DateRangeFilter as DateRange, Field, Filter, Resource } from "@repanel/contracts";
import { Select } from "@repanel/ui";
import type { ReactNode } from "react";
import { DateRangeFilter } from "./date-range-filter";
import { RelationPicker } from "./relation-picker";
import { SearchBox } from "./search-box";
import type { FilterValue } from "./table-state";

export interface FilterBarProps {
  /** Which admin this is, so a relation filter can ask what it may narrow to. */
  projectKey: string;
  resource: Resource;
  search: string;
  filters: Record<string, FilterValue>;
  onSearch: (term: string) => void;
  onFilter: (field: string, value: FilterValue | undefined) => void;
  onClearAll: () => void;
  /** Whether anything is currently narrowing the table. */
  isNarrowed: boolean;
}

/**
 * Everything that narrows the table, and the one place each of those values
 * lives: a filter's trigger shows what it is set to, and `Clear all` is the
 * only control that speaks for the set as a whole. No value appears twice
 * (DESIGN.md BUILD REQUIREMENT 1).
 */
export function FilterBar({
  projectKey,
  resource,
  search,
  filters,
  onSearch,
  onFilter,
  onClearAll,
  isNarrowed,
}: FilterBarProps) {
  const view = resource.views.table;
  const fields = new Map(resource.fields.map((field) => [field.key, field]));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {view.search.length > 0 && (
        <SearchBox
          value={search}
          onSearch={onSearch}
          label={resource.label.plural}
          fields={view.search.map((key) => fields.get(key)?.label.toLowerCase() ?? key)}
        />
      )}

      {view.filters.map((filter) => {
        const field = fields.get(filter.field);
        return field ? (
          <FilterControl
            key={filter.field}
            projectKey={projectKey}
            filter={filter}
            field={field}
            value={filters[filter.field]}
            onChange={(value) => onFilter(filter.field, value)}
          />
        ) : null;
      })}

      {isNarrowed && (
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-sm text-small text-muted-foreground underline underline-offset-[3px] outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function FilterControl({
  projectKey,
  filter,
  field,
  value,
  onChange,
}: {
  projectKey: string;
  filter: Filter;
  field: Field;
  value: FilterValue | undefined;
  onChange: (value: FilterValue | undefined) => void;
}) {
  if (filter.kind === "dateRange") {
    return (
      <DateRangeFilter
        label={field.label}
        value={value as DateRange | undefined}
        onChange={onChange}
        hasTime={field.type === "dateTime"}
      />
    );
  }

  if (filter.kind === "boolean") {
    return (
      <Choice label={field.label} value={value} onChange={onChange}>
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </Choice>
    );
  }

  if (filter.kind === "enum" && field.type === "enum") {
    return (
      <Choice label={field.label} value={value} onChange={onChange}>
        <option value="">Any</option>
        {field.values.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Choice>
    );
  }

  // A relation is filtered by the key it points at, and the key is chosen the
  // same way it is on a form: by the name the resource on the other side is
  // read by (DECISIONS #060). Nothing chosen is `Any`, which is what every
  // other filter here calls it.
  return (
    <div className="w-56">
      <RelationPicker
        projectKey={projectKey}
        target={field.type === "relation" ? field.target : field.key}
        value={typeof value === "string" ? value : null}
        onChange={(id) => onChange(id ?? undefined)}
        clearable
        label={field.label}
        placeholder="Any"
      />
    </div>
  );
}

function Choice({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: FilterValue | undefined;
  onChange: (value: FilterValue | undefined) => void;
  children: ReactNode;
}) {
  const current = typeof value === "string" ? value : "";
  return (
    <Select
      label={label}
      value={current}
      isSet={current !== ""}
      onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
    >
      {children}
    </Select>
  );
}
