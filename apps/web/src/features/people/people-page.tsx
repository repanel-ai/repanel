import type { AddedPersonDto, PersonDto } from "@repanel/contracts";
import {
  Badge,
  Button,
  Card,
  Dialog,
  FormError,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToaster,
} from "@repanel/ui";
import { type FormEvent, useState } from "react";
import { useParams } from "react-router";
import { messageOf } from "../../lib/api-client";
import { formatDay } from "../../lib/format-date";
import { PageHead } from "../../page-head";
import { OperatorCredentials } from "./operator-credentials";
import { useAddOperator, usePeople, useRevokePerson } from "./use-people";

/**
 * Who may use this project's admin.
 *
 * Two roles and no more: the owner configures RePanel, an operator uses what
 * comes out of it. There is nothing finer to set here because there is nothing
 * finer to set — what an operator may do is what the definition allows anybody
 * to do (DECISIONS #062).
 *
 * A new operator's password is held in component state and nowhere else — not
 * in the query cache, not in the list the API answers with. It exists for as
 * long as this screen is showing it.
 */
export function PeoplePage() {
  const { id = "" } = useParams();
  const people = usePeople(id);
  const add = useAddOperator(id);
  const revoke = useRevokePerson(id);
  const { notify } = useToaster();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [added, setAdded] = useState<AddedPersonDto | null>(null);
  const [removing, setRemoving] = useState<PersonDto | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    add.mutate(
      { email, name },
      {
        onSuccess: (result) => {
          setAdded(result);
          setEmail("");
          setName("");
          // Somebody who already had a RePanel account arrives with no password
          // to pass on, and the panel below has nothing to show: say it here.
          if (!result.password) {
            notify({ tone: "positive", title: `${result.person.email} can use this admin` });
          }
        },
      },
    );
  }

  function confirmRevoke() {
    if (!removing) return;
    const person = removing;
    revoke.mutate(person.userId, {
      onSuccess: () => {
        setRemoving(null);
        notify({ tone: "positive", title: `${person.email} can no longer use this admin` });
      },
    });
  }

  return (
    <>
      <PageHead title="People" meta="who may use this admin, and who configures it" />

      <Card className="flex min-w-0 flex-col gap-5 p-5">
        <form className="flex flex-col gap-2" onSubmit={submit}>
          <Label htmlFor="operator-email">Add an operator</Label>
          <div className="flex flex-wrap items-start gap-2">
            <Input
              id="operator-email"
              type="email"
              required
              placeholder="ravi@example.com"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-w-56 flex-1"
            />
            <Input
              aria-label="Their name"
              required
              placeholder="Ravi"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-w-40 flex-1"
            />
            <Button
              type="submit"
              disabled={add.isPending || email.trim() === "" || name.trim() === ""}
            >
              {add.isPending ? "Adding…" : "Add operator"}
            </Button>
          </div>
          <p className="text-small text-muted-foreground">
            They get a RePanel login for this admin. They cannot open the console, mint agent
            tokens, reach the database connection, or publish.
          </p>
          <FormError message={messageOf(add.error)} />
        </form>

        {added?.password && (
          <OperatorCredentials
            email={added.person.email}
            password={added.password}
            onDismiss={() => setAdded(null)}
          />
        )}

        {people.isPending && <Skeleton className="h-16 w-full" />}
        <FormError message={messageOf(people.error)} />

        {people.data && (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>
                    <span className="sr-only">Revoke</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.data.map((person) => (
                  <TableRow key={person.userId}>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="truncate">{person.name}</div>
                        <div className="truncate text-nav-meta text-muted-foreground">
                          {person.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge tone="neutral">
                        {person.role === "owner" ? "Owner" : "Operator"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDay(person.addedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* The owner has no control here: a project with nobody
                          who can configure it is a project nobody can fix. */}
                      {person.role === "operator" && (
                        <Button variant="outline" onClick={() => setRemoving(person)}>
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog
        open={removing !== null}
        title={`Revoke ${removing?.name ?? ""}?`}
        confirmLabel="Revoke"
        pending={revoke.isPending ? "Revoking…" : undefined}
        onConfirm={confirmRevoke}
        onCancel={() => setRemoving(null)}
      >
        They lose this admin on their next request, whatever they have open.{" "}
        {removing?.email} keeps their RePanel account — add them again to let them back in.
        {revoke.error && (
          <span className="text-destructive-text"> {messageOf(revoke.error)}</span>
        )}
      </Dialog>
    </>
  );
}
