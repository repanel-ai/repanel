#!/usr/bin/env bash
#
# Every commit in a pull request must carry a Signed-off-by line matching its
# author — the Developer Certificate of Origin, which RePanel takes in place of
# a CLA. `git commit -s` writes exactly the line this looks for.
#
# It is written out here rather than delegated to a third-party action on
# purpose: it is fifteen lines, it reads the repository and nothing else, and a
# project that publishes a threat model should not hand its commit gate to an
# unaudited dependency.
#
# Merge commits are exempt: their author did not write the contribution.
#
# Expects BASE_SHA and HEAD_SHA in the environment.
set -euo pipefail

: "${BASE_SHA:?BASE_SHA is required}"
: "${HEAD_SHA:?HEAD_SHA is required}"

missing=0

while read -r sha; do
  [ -z "$sha" ] && continue
  author="$(git log -1 --format='%an <%ae>' "$sha")"
  subject="$(git log -1 --format='%h %s' "$sha")"

  # -F and -x: the author string is data, not a pattern, and the line must be
  # the whole line rather than something a commit body merely mentions.
  if git log -1 --format='%B' "$sha" | grep -qFx "Signed-off-by: $author"; then
    echo "  ok  $subject"
  else
    echo "MISSING $subject"
    echo "        expected: Signed-off-by: $author"
    missing=$((missing + 1))
  fi
done < <(git rev-list --no-merges "$BASE_SHA..$HEAD_SHA")

if [ "$missing" -gt 0 ]; then
  cat <<EOF

$missing commit(s) are not signed off.

RePanel takes contributions under the Developer Certificate of Origin 1.1
(see DEVELOPER_CERTIFICATE). Signing off certifies you have the right to
contribute the change; it is not a copyright assignment, and there is no CLA.

Sign off the whole branch and force-push:

    git rebase --signoff $BASE_SHA
    git push --force-with-lease

New commits get it from \`git commit -s\`.
EOF
  exit 1
fi

echo
echo "All commits are signed off."
