# Task F-2 · Primary key generation — the create form

Screenshots of the built runtime served by `repanel dev` against **Crewbase's
own database**, at 1440×900 and 2×. `job_openings` is Crewbase's one writable
resource; its `id` column is `uuid ... default gen_random_uuid()`.

| | light |
|---|---|
| `primaryKeyGeneration: "database"` — as committed | `create-database-light.png` |
| `primaryKeyGeneration: "client"` — the same resource, declared the other way | `create-client-light.png` |

**`create-database-light`** is the corrected form and the default one. The key
column has a default, so there is no control for it: `Airline`, `Title`,
`Status` and nothing else. The insert leaves `id` out, the database generates
it, and `RETURNING` carries it back — which is what puts the operator on the new
record's own address a moment later.

**`create-client-light`** is what `"primaryKeyGeneration": "client"` draws: the
key first, marked required, ahead of every field that describes the record. It
is on this form and on no other — an edit refuses the key under either value,
because a key addresses the record rather than describing it (DECISIONS #059).
The second shot was taken against a local edit of the same resource and is not
what the repository declares; Crewbase's key is generated, and says so.

## Proven against postgres, not against a fixture

Both directions were run through the served API on Crewbase's own rows:

```
POST …/job_openings/records  {values:{airline_id, title, status}}          201, id gen_random_uuid() issued
POST …/job_openings/records  {values:{id, …}}                              422, values.id — "issued by the database"
POST …/job_openings/records  {values:{id, …}}   under "client"             201, the key that was typed
PATCH …/job_openings/records/:id  {values:{id}} under "client"             422, values.id — "set when it is made"
```

Every refusal carries a path and a hint (DECISIONS #008), so the sentence lands
under the input it names.
