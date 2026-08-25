import type { Definition, Resource } from "@repanel/contracts";
import { formFields } from "./form-draft";
import { ArrowLeftIcon, FormFields, Skeleton, useToaster } from "@repanel/ui";
import { Fragment, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ApiError } from "../../lib/api-client";
import { ErrorState } from "./error-state";
import { RecordForm } from "./record-form";
import { RecordNotFound } from "./record-not-found";
import { runtimeRoutes } from "./routes";
import { Screen } from "./screen";
import { useRecord } from "./use-runtime";

/** Which write this screen is: the two differ only in what they open with. */
export type FormMode = "create" | "update";

/**
 * The screen a record is filled in on.
 *
 * It exists only where the definition says it may. A resource that does not
 * declare the write has no form here, no entry point to one anywhere else, and
 * an address typed by hand is answered the way any other address this admin has
 * no screen for is (DECISIONS #055) — the opt-in is checked where the screen is
 * drawn rather than only where the buttons are, so there is one place it can be
 * got wrong instead of three.
 */
export function FormPage({
  projectKey,
  definition,
  mode,
}: {
  projectKey: string;
  definition: Definition;
  mode: FormMode;
}) {
  const { resourceKey = "", recordId = "" } = useParams();
  const resource = definition.resources.find((candidate) => candidate.key === resourceKey);

  if (!resource) return <NoSuchScreen message={`This admin has no resource \`${resourceKey}\`.`} />;

  if (!offers(resource, mode)) {
    return (
      <NoSuchScreen
        message={
          mode === "create"
            ? `This admin does not create ${resource.label.plural.toLowerCase()}.`
            : `This admin does not change ${resource.label.plural.toLowerCase()}.`
        }
      />
    );
  }

  return mode === "create" ? (
    <CreateScreen projectKey={projectKey} resource={resource} />
  ) : (
    <EditScreen
      key={`${resource.key}/${recordId}`}
      projectKey={projectKey}
      resource={resource}
      recordId={recordId}
    />
  );
}

function CreateScreen({ projectKey, resource }: { projectKey: string; resource: Resource }) {
  const navigate = useNavigate();
  const { notify } = useToaster();
  const back = runtimeRoutes.resource(projectKey, resource.key);

  return (
    <FormScreen
      back={back}
      backLabel={resource.label.plural}
      title={`New ${resource.label.singular.toLowerCase()}`}
    >
      <RecordForm
        projectKey={projectKey}
        resource={resource}
        onWritten={(record) => {
          void navigate(runtimeRoutes.record(projectKey, resource.key, record.id), { replace: true });
          notify({ tone: "positive", title: `${resource.label.singular} created` });
        }}
        onLeave={() => void navigate(back)}
      />
    </FormScreen>
  );
}

function EditScreen({
  projectKey,
  resource,
  recordId,
}: {
  projectKey: string;
  resource: Resource;
  recordId: string;
}) {
  const navigate = useNavigate();
  const { notify } = useToaster();
  const record = useRecord(projectKey, resource.key, recordId);
  const back = runtimeRoutes.record(projectKey, resource.key, recordId);

  return (
    <FormScreen
      back={back}
      backLabel={resource.label.singular}
      title={`Edit ${resource.label.singular.toLowerCase()}`}
    >
      {record.isPending && <PendingForm resource={resource} />}

      {record.isError &&
        (isMissing(record.error) ? (
          <RecordNotFound
            resource={resource}
            back={runtimeRoutes.resource(projectKey, resource.key)}
          />
        ) : (
          <ErrorState
            title={`This ${resource.label.singular.toLowerCase()} could not be read`}
            message={messageOf(record.error)}
            onRetry={() => void record.refetch()}
          />
        ))}

      {record.data && (
        <RecordForm
          projectKey={projectKey}
          resource={resource}
          record={record.data}
          onWritten={() => {
            void navigate(back);
            notify({ tone: "positive", title: "Changes saved" });
          }}
          onLeave={() => void navigate(back)}
        />
      )}
    </FormScreen>
  );
}

/** The frame both forms sit in: the way back, what is being filled in, and it. */
function FormScreen({
  back,
  backLabel,
  title,
  children,
}: {
  back: string;
  backLabel: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Screen scrolls>
      <Link
        to={back}
        className={
          "inline-flex w-fit items-center gap-1.5 rounded-sm text-small text-muted-foreground " +
          "outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45"
        }
      >
        <ArrowLeftIcon className="size-3.5" />
        {backLabel}
      </Link>
      <h1 className="text-title font-semibold tracking-[-0.02em]">{title}</h1>
      {children}
    </Screen>
  );
}

/**
 * The shape of the form while the record it opens with is on its way. The
 * fields are the definition's, so they are already known and already drawn;
 * only the values are missing. It stands in for an edit and only ever for one:
 * a record being made has nothing on its way.
 */
function PendingForm({ resource }: { resource: Resource }) {
  return (
    <>
      <FormFields aria-hidden="true" className="w-full max-w-form">
        {formFields(resource, "update").map((field) => (
          <Fragment key={field.key}>
            <div className="border-b border-border py-2 pr-2 pl-2.5">
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="border-b border-border py-2 pr-2.5 pl-2">
              <Skeleton className="h-control w-full" />
            </div>
          </Fragment>
        ))}
      </FormFields>
      <span role="status" className="sr-only">
        Loading record
      </span>
    </>
  );
}

function NoSuchScreen({ message }: { message: string }) {
  return (
    <Screen>
      <ErrorState title="There is no such screen here" message={message} />
    </Screen>
  );
}

function offers(resource: Resource, mode: FormMode): boolean {
  return mode === "create" ? resource.writes.create : resource.writes.update;
}

/** The record is not there, as opposed to something having gone wrong. */
function isMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong reading this record.";
}
