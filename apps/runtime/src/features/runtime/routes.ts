/** Where a rendered admin's screens live. Every link in the runtime is built here. */
export const runtimeRoutes = {
  resource: (projectKey: string, resourceKey: string) =>
    `/a/${encodeURIComponent(projectKey)}/r/${encodeURIComponent(resourceKey)}`,
  record: (projectKey: string, resourceKey: string, id: string | number) =>
    `${runtimeRoutes.resource(projectKey, resourceKey)}/${encodeURIComponent(String(id))}`,
};
