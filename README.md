# Multiplayer Tetris

A Vite + React 19 single-page app. The deployable app lives in `app/`.

## Local development

```bash
cd app
pnpm install
pnpm run dev      # http://localhost:8443
pnpm run build    # outputs to app/dist
```

## Deploying to Cloudflare Pages

The site is fully static — no server, no websockets — so Pages serves the
built `dist/` directory directly.

One-time setup in the Cloudflare dashboard
(**Workers & Pages → Create → Pages → Connect to Git**), selecting the
`oojerinola-bit/noams-app-` repository:

| Setting                 | Value           |
| ----------------------- | --------------- |
| Production branch       | `main`          |
| Root directory          | `app`           |
| Framework preset        | None            |
| Build command           | `pnpm run build`|
| Build output directory  | `dist`          |

Node and pnpm versions are pinned in the repo (`app/.node-version` and the
`packageManager` field in `app/package.json`), so no `NODE_VERSION`
environment variable is needed.

After that, every push to `main` deploys to production and every pull request
gets its own preview URL.

### Notes

- `app/public/_headers` adds response security headers to the deployment.
- `app/.figma/make/site.json` sets `robots.index: false`, which emits a
  `noindex` meta tag and a disallow-all `robots.txt`. Flip it to `true` if you
  want the site indexed by search engines.
