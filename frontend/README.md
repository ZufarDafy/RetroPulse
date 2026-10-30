# RestoPulse Frontend

This directory contains the user interface for **RestoPulse: Offline-Resilient Restaurant POS, Kitchen Display System (KDS), and Field Diagnostic Sandbox**.

Built with **React 18**, **TypeScript**, **Vite**, and **Tailwind CSS**, it features an ultra-responsive Warm & Friendly aesthetic with instant multilingual switching, optimistic UI feedback (<50ms), and real-time chaos engineering simulation.

---

## Key Features

- **Warm & Friendly Design Language:** Polished cream `#fffaf5` canvas, crisp cards, and inviting `#ea580c` warm orange accents.
- **Two Dedicated Main Views:**
  1. **Operations (POS & KDS):** Fast ordering grid and kitchen ticket queue side-by-side for cashiers and cooks.
  2. **Field Sandbox & Logs:** Chaos switches and live diagnostic log streamer with automated root-cause explanations.
  *(Plus a **3 Columns (Split View)** option for widescreen multi-panel monitoring).*
- **Multilingual Support (EN / ID / ZH):** Dynamic runtime localization with instant toggling between English (default), Indonesian, and Simplified Chinese.
- **Optimistic UI (<50ms):** Immediate visual checkout confirmation with confetti and audio feedback, completely eliminating perceived lag.
- **Rapid Double-Tap Debounce Guard:** Locks the checkout button for 1500ms to absorb duplicate clicks during latency spikes.
- **Store-and-Forward Offline Queue:** Automatically queues orders to browser LocalStorage when WiFi drops, and reconciles them upon reconnection via `POST /api/v1/orders/batch-sync`.
- **Interactive Spotlight Tour:** 7-step guided onboarding that physically highlights UI elements with animated cutouts and action tips.

---

## Getting Started

### Prerequisites
- Node.js 18+ or 20+
- npm 9+

### Installation & Development
```bash
# Install dependencies
npm install

# Start development server with instant HMR
npm run dev
```

The application will be accessible at `http://localhost:5173`.

### Production Build
```bash
# Type check and build bundle
npm run build

# Preview production build locally
npm run preview
```

The built static assets are placed in the `dist/` directory.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Base URL of the Go backend API. Leave empty when running behind Nginx reverse proxy or on the same domain. | `""` (relative `/api/v1`) |

---

## Docker Execution

The frontend includes a multi-stage `Dockerfile` and a production `nginx.conf`:
- **Stage 1:** Node.js builder compiles TypeScript and Vite bundle.
- **Stage 2:** Lightweight Nginx Alpine image serves static assets with `no-cache` headers on `index.html` and long-term caching on hashed assets.
