# Multiplayer Tetris

The deployable app is in `Multiplayer Tetris Game Design (1)/`.

## Cloudflare Pages

Configure the Pages project with:

- **Root directory:** `Multiplayer Tetris Game Design (1)`
- **Build command:** `pnpm run build`
- **Build output directory:** `dist`
- **Node.js version:** `22`

Cloudflare will install dependencies from `pnpm-lock.yaml` and serve the generated Vite build. The app-local `_headers` file adds response security headers to the deployment.