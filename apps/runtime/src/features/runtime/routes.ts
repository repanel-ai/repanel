/** Where a rendered admin's screens live. Every link in the runtime is built here. */
export const runtimeRoutes = {
  resource: (projectKey: string, resourceKey: string) =>
    `/a/${encodeURIComponent(projectKey)}/r/${encodeURIComponent(resourceKey)}`,
  record: (projectKey: string, resourceKey: string, id: string | number) =>
    `${runtimeRoutes.resource(projectKey, resourceKey)}/${encodeURIComponent(String(id))}`,
  /**
   * Filling a form in is being somewhere, so it is a screen with an address
   * rather than something over the screen behind it: it can be linked to, gone
   * back from and reloaded into, which is the rule every other RePanel surface
   * that holds state keeps (DESIGN.md §9, §11).
   */
  newRecord: (projectKey: string, resourceKey: string) =>
    `${runtimeRoutes.resource(projectKey, resourceKey)}/new`,
  editRecord: (projectKey: string, resourceKey: string, id: string | number) =>
    `${runtimeRoutes.record(projectKey, resourceKey, id)}/edit`,
};
