import type {
  ActionResultDto,
  Definition,
  RecordDto,
  RecordId,
  RecordListDto,
  RecordValues,
} from "@repanel/contracts";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

/**
 * Everything the rendered admin reads: the definition it draws itself from, and
 * the pages of records it draws. Both come from the project's own routes, and
 * nothing in this app fetches anything anywhere else.
 */

/** Every cache key this feature reads comes from here. */
export const runtimeKeys = {
  all: ["runtime"] as const,
  project: (projectKey: string) => [...runtimeKeys.all, projectKey] as const,
  definition: (projectKey: string) => [...runtimeKeys.project(projectKey), "definition"] as const,
  /**
   * Every page of one resource's list, whatever was asked for it. It is the
   * prefix the questions below are built from, so putting a resource's table
   * out of date is one key rather than one key per search, filter and page an
   * operator has been through.
   */
  resourceRecords: (projectKey: string, resourceKey: string) =>
    [...runtimeKeys.project(projectKey), "records", resourceKey] as const,
  /**
   * `query` is the serialized table state — the same string the address bar
   * carries and the request is made of, so two questions share a cache entry
   * exactly when they are the same question.
   */
  records: (projectKey: string, resourceKey: string, query: string) =>
    [...runtimeKeys.resourceRecords(projectKey, resourceKey), query] as const,
  record: (projectKey: string, resourceKey: string, id: RecordId) =>
    [...runtimeKeys.project(projectKey), "record", resourceKey, String(id)] as const,
  /**
   * Filed under the record it belongs to, so putting one record out of date
   * puts the lists hanging off it out of date with it.
   */
  related: (projectKey: string, resourceKey: string, id: RecordId, relationshipKey: string, query: string) =>
    [...runtimeKeys.record(projectKey, resourceKey, id), "related", relationshipKey, query] as const,
};

/** Every value in these paths came out of a definition or an address bar. */
function resourcePath(projectKey: string, resourceKey: string): string {
  return `/runtime/${encodeURIComponent(projectKey)}/resources/${encodeURIComponent(resourceKey)}`;
}

function recordPath(projectKey: string, resourceKey: string, id: RecordId): string {
  return `${resourcePath(projectKey, resourceKey)}/records/${encodeURIComponent(String(id))}`;
}

function asked(path: string, query: string): string {
  return query === "" ? path : `${path}?${query}`;
}

export function useDefinition(projectKey: string) {
  return useQuery({
    queryKey: runtimeKeys.definition(projectKey),
    queryFn: () => api.get<Definition>(`/runtime/${encodeURIComponent(projectKey)}/definition`),
  });
}

export function useRecords(projectKey: string, resourceKey: string, query: string) {
  return useQuery({
    queryKey: runtimeKeys.records(projectKey, resourceKey, query),
    queryFn: () => api.get<RecordListDto>(asked(`${resourcePath(projectKey, resourceKey)}/records`, query)),
  });
}

/** One record, in full: hidden fields included, sensitive ones never sent. */
export function useRecord(projectKey: string, resourceKey: string, id: RecordId) {
  return useQuery({
    queryKey: runtimeKeys.record(projectKey, resourceKey, id),
    queryFn: () => api.get<RecordDto>(recordPath(projectKey, resourceKey, id)),
  });
}

/**
 * A page of the records one record is related to. Whichever way the
 * relationship points, the page is the target resource's own list narrowed to
 * this record — the API decides that; this only asks.
 */
export function useRelatedRecords(
  projectKey: string,
  resourceKey: string,
  id: RecordId,
  relationshipKey: string,
  query: string,
) {
  return useQuery({
    queryKey: runtimeKeys.related(projectKey, resourceKey, id, relationshipKey, query),
    queryFn: () =>
      api.get<RecordListDto>(
        asked(
          `${recordPath(projectKey, resourceKey, id)}/related/${encodeURIComponent(relationshipKey)}`,
          query,
        ),
      ),
  });
}

/**
 * Running one of a record's actions. The action key is all that is sent: what
 * the action does was decided when the definition was written, and the API
 * reads it from there rather than from here.
 *
 * On success two things are put out of date, because an action can be read in
 * two places. A status the action set is on screen by the time the notice about
 * it is, and the table the operator came from shows the new one when they go
 * back rather than the one they acted on.
 */
export function useRunAction(projectKey: string, resourceKey: string, id: RecordId) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (actionKey: string) =>
      api.post<ActionResultDto>(
        `${recordPath(projectKey, resourceKey, id)}/actions/${encodeURIComponent(actionKey)}`,
      ),
    onSuccess: () =>
      Promise.all([
        // The record, and with it every list hanging off it — `related` is
        // filed under `record`, so one key covers this whole screen.
        client.invalidateQueries({ queryKey: runtimeKeys.record(projectKey, resourceKey, id) }),
        // And every page of the resource's own table, which draws the same
        // fields an action has just changed. None of it is mounted, so nothing
        // is refetched now: it is marked stale, and read again when it is next
        // looked at. That the table would refetch on mount anyway is a property
        // of a default, and this is a fact about what the action changed.
        client.invalidateQueries({ queryKey: runtimeKeys.resourceRecords(projectKey, resourceKey) }),
      ]),
  });
}

/**
 * Creating a record. What comes back is the record itself — the write and the
 * read are one statement, through the same select list and the same mapper a
 * detail read uses (DECISIONS #056) — so it is put in the cache under its own
 * key rather than thrown away and asked for again a moment later.
 *
 * Then the two keys a write can be read through are put out of date: the record
 * itself, and every page of the resource's table, which draws the fields the
 * write has just set. It is the same pair an action invalidates, for the same
 * reason — a change nobody invalidated is a screen that quietly disagrees with
 * the database.
 */
export function useCreateRecord(projectKey: string, resourceKey: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (values: RecordValues) =>
      api.post<RecordDto>(`${resourcePath(projectKey, resourceKey)}/records`, { values }),
    onSuccess: (record) => written(client, projectKey, resourceKey, record),
  });
}

/**
 * Correcting a record. The values are what changed and nothing else: `PATCH`
 * leaves every field the write does not name exactly as it was, which is the
 * only thing that keeps last-write-wins (DECISIONS #056) from meaning that
 * whoever saved last wrote every column.
 */
export function useUpdateRecord(projectKey: string, resourceKey: string, id: RecordId) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (values: RecordValues) =>
      api.patch<RecordDto>(recordPath(projectKey, resourceKey, id), { values }),
    onSuccess: (record) => written(client, projectKey, resourceKey, record),
  });
}

/** What a write leaves behind in the cache, whichever write it was. */
function written(
  client: QueryClient,
  projectKey: string,
  resourceKey: string,
  record: RecordDto,
): Promise<unknown> {
  client.setQueryData(runtimeKeys.record(projectKey, resourceKey, record.id), record);

  return Promise.all([
    // The record, and with it every list hanging off it.
    client.invalidateQueries({ queryKey: runtimeKeys.record(projectKey, resourceKey, record.id) }),
    // And every page of the resource's own table, whatever was asked for it.
    client.invalidateQueries({ queryKey: runtimeKeys.resourceRecords(projectKey, resourceKey) }),
  ]);
}
