# Board consulting hub

`/admin/consulting` shows the board's consulting working documents: plans, packets, prospect and contact lists, campaigns, tasks and decisions. Only active BOARD and OWNER memberships can open it (`requireBoard()` on pages, `isBoardMember()` in the file route).

## Why the content is encrypted

This repository is public, and the documents include named contacts, unsent outreach and unapproved pricing. They are committed only as `content/consulting-hub.enc` (AES-256-GCM over a gzip container; format in `src/lib/consulting-hub/format.ts`). The server decrypts it at request time with the `CONSULTING_HUB_KEY` environment variable (base64, 32 bytes). Without the key the hub shows an "isn't available" notice. Nothing else in the site depends on it.

Do not commit plaintext hub content, company names or a key to this repository. Tests use synthetic fixtures only.

## Updating the content

The source of truth is the MECG operations workspace. `board/consulting/hub/hub.json` there lists what is included and how it is grouped; `overview.md` is the hub's front page.

```sh
node scripts/consulting-hub/build.mjs --key-file ~/.config/mecg/consulting-hub.key [--source <ops workspace>]
```

The script renders Markdown to HTML (raw HTML escaped, links resolved to hub URLs or dropped), packs the PDFs, Office files, images and standalone HTML, encrypts, and checks that the result decrypts before writing it. Commit the new `.enc` and deploy through the normal pipeline.

## Rotating the key

Generate a key with `node scripts/consulting-hub/build.mjs --new-key`, rebuild with it, set `CONSULTING_HUB_KEY` in Vercel Production to the same value, and deploy. Old ciphertext stays in Git history, so a leaked key exposes old versions too: rotate on any suspected leak.

## Safety notes

- Hub files are served with `Cache-Control: private, no-store`. Standalone HTML runs under a CSP `sandbox` (set by both the route and `next.config.ts`), so its scripts get an opaque origin and cannot use the board session.
- Document titles are not put in page metadata, so browser history shows only "Consulting hub".
