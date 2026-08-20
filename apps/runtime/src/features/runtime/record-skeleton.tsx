import type { Resource } from "@repanel/contracts";
import { FieldRow, Fields, Section, Skeleton } from "@repanel/ui";
import { sectionFields } from "./detail-layout";

/**
 * Placeholder bars in a few widths rather than one: a column of identical bars
 * reads as a chart, and text does not arrive rectangular.
 */
const WIDTHS = ["58%", "34%", "72%", "46%", "26%"];

/**
 * The shape of the record while it is on its way. The sections and the field
 * labels come out of the definition, so they are known before the values are
 * and are drawn straight away — only the values are missing, and nothing on
 * the screen moves when they arrive.
 */
export function RecordSkeleton({ resource }: { resource: Resource }) {
  return (
    <>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-3 w-20" />
      </div>

      {resource.views.detail.sections.map((section) => {
        const fields = sectionFields(resource, section);
        if (fields.length === 0) return null;

        return (
          <Section key={section.title} title={section.title}>
            <Fields>
              {fields.map((field, index) => (
                <FieldRow key={field.key} label={field.label}>
                  <Skeleton className="h-3" style={{ width: WIDTHS[index % WIDTHS.length] }} />
                </FieldRow>
              ))}
            </Fields>
          </Section>
        );
      })}
    </>
  );
}
