/**
 * Where a project's rendered admin is served. It is a different origin from the
 * console (DECISIONS #025), so every link to one is absolute and built here —
 * once for the list of admins, once for the operator who is sent straight to one.
 */
export function adminUrl(runtimeUrl: string, projectKey: string): string {
  return `${runtimeUrl}/a/${projectKey}`;
}
