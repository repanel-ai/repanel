import { Dialog, Input, Label } from "@repanel/ui";
import { useState } from "react";
import { useNavigate } from "react-router";
import { messageOf } from "../../lib/api-client";
import { useCreateProject } from "./use-projects";

/**
 * Naming a project is the whole of creating one: everything else about it —
 * the key it routes by, the secret it signs with — is minted for it.
 *
 * The dialog's body is a paragraph, so what goes in it is phrasing content: a
 * label, a field, and a failure said in a span rather than the `FormError`
 * paragraph every other form uses.
 */
export function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateProject();
  const [name, setName] = useState("");

  function submit() {
    create.mutate(
      { name },
      {
        onSuccess: (project) => {
          setName("");
          onClose();
          navigate(`/p/${project.id}`);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      title="New project"
      confirmLabel="Create"
      pending={create.isPending ? "Creating…" : undefined}
      onConfirm={submit}
      onCancel={() => {
        create.reset();
        onClose();
      }}
    >
      <Label htmlFor="project-name" className="mb-1.5 block">
        Name
      </Label>
      <Input
        id="project-name"
        required
        autoFocus
        placeholder="Crewbase"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && name.trim() !== "") submit();
        }}
      />
      <span className="mt-1.5 block text-small">
        Name it after the application it administers.
      </span>
      {messageOf(create.error) && (
        <span role="alert" className="mt-2 block text-small text-destructive-text">
          {messageOf(create.error)}
        </span>
      )}
    </Dialog>
  );
}
