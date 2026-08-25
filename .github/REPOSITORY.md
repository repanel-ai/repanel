# Repository metadata

The three things GitHub shows before anyone reads a word of the README. They
live here because they are set through GitHub's own settings rather than in a
file the repository serves — this page is the copy, so it is reviewed like
everything else and does not get reinvented at launch.

## Description

The About box. One line, no tagline stacking:

```
A first-class admin for every stack — your coding agent is the adapter. Local-first, no signup: npx repanel dev.
```

Website field: leave empty until there is a site worth the click. The README is
better than a placeholder.

## Topics

Fourteen, in this order. They are what the repository is *found* by, so each one
is a phrase somebody actually searches:

```
admin-ui  back-office  internal-tools  developer-tools
postgres  postgresql  typescript  nestjs  react
mcp  model-context-protocol  ai-agents  coding-agent  self-hosted
```

Both applied in one go, by a maintainer with push access:

```bash
gh repo edit repanel-ai/repanel \
  --description "A first-class admin for every stack — your coding agent is the adapter. Local-first, no signup: npx repanel dev." \
  --add-topic admin-ui --add-topic back-office --add-topic internal-tools \
  --add-topic developer-tools --add-topic postgres --add-topic postgresql \
  --add-topic typescript --add-topic nestjs --add-topic react \
  --add-topic mcp --add-topic model-context-protocol --add-topic ai-agents \
  --add-topic coding-agent --add-topic self-hosted
```

## Social preview

The image every link to this repository unfurls as — in a tweet, in Slack, in a
Discord embed. GitHub shows a generic card until one is uploaded, and a generic
card is what a link looks like when nobody was paying attention.

**Not committed to the repository.** It is uploaded once, by hand, at
**Settings → General → Social preview → Upload an image**, and there is nothing
to keep in sync afterwards.

What to make:

- **1280 × 640 PNG.** Twitter and Slack crop the edges, so keep everything that
  matters inside the middle 1120 × 560.
- **The frame** is `docs/media/admin-record.png`, scaled to bleed off the right
  edge rather than sitting centred with margins. The product is the picture.
- **Two lines of text** on the left, on the light chrome, nothing else:
  **RePanel** and *A first-class admin for every stack*.
- **Light theme.** It is the theme the screenshots are taken in and the one that
  survives being shown small.
- No logos in the corners, no gradient, no drop shadow, no "open source" badge.

**Re-take it when the runtime's chrome changes.** It is a screenshot, and a
stale one is a promise about what the product looks like that the product no
longer keeps. The same rule as `docs/media/`, which the README's own pair lives
in.
