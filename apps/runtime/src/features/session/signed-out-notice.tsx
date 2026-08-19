/**
 * What an unauthenticated visitor sees. The runtime never asks for credentials
 * — signing in happens in the console, and this says where that is.
 */
export function SignedOutNotice({ consoleUrl }: { consoleUrl: string }) {
  return (
    <main className="flex min-h-screen flex-col items-start gap-2 p-6">
      <p>You are not signed in.</p>
      <a className="underline" href={`${consoleUrl}/login`}>
        Sign in to RePanel
      </a>
    </main>
  );
}
