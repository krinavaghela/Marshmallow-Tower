## Marshmallow Tower Lab

**Build. Test. Iterate.**

A small, polished 3D building experiment: drag marshmallows into a build space, connect them with spaghetti (tape auto-reinforces connections), then run a lightweight “pseudo-physics” stability test (no heavy simulation).

### Tech
- Vite
- Three.js
- JavaScript (no React)

### Local setup

```bash
npm install
npm run dev
```

Then open the local URL printed in your terminal.

### Production build

```bash
npm run build
npm run preview
```

### Deploy (static hosting)
This is a static Vite build. Deploy the `dist/` folder.
- **Vercel**: import the repo → Framework: Vite → Build: `npm run build` → Output: `dist`
- **Netlify**: Build: `npm run build` → Publish directory: `dist`

### How to play (V1)
- **Build**: drag **Marshmallow** into the build area.
- **Connect**: drag **Spaghetti** to snap between marshmallows (tape applies automatically until it runs out).
- **Inspect**: right-drag to rotate, scroll to zoom.
- **Top**: click **Add Top**.
- **Test**: press **Test Tower** for wobble/partial/fail outcomes.
- **Reset**: start over any time.

### Stability logic (pseudo-physics)
V1 avoids full physics and instead evaluates a few structural heuristics:
- **Base width** (is the footprint wide enough?)
- **Connections** (does the tower have enough joints/edges?)
- **Top support** (is the top marshmallow supported by enough sticks?)
- **Top-heaviness** (simple center-of-mass proxy vs base radius)

### Scoring
Score is primarily based on **height**, multiplied by a stability factor (unstable towers score less), with a small efficiency nudge.

### Project structure
- `src/scene/`: renderer, camera, lighting, materials, table
- `src/tower/`: snap lattice, tower model, view meshes, placement UX
- `src/stability/`: evaluator + wobble/collapse animation + scoring
- `src/ui/`: minimal HUD and intro overlay

### V2 ideas (intentionally out of scope for V1)
- A curated set of “challenge cards” (wide base, arch, minimal sticks)
- Better weak-point explanation (one sentence + targeted highlight)
- A gentle undo (single-step) instead of full reset
- More tactile materials (subtle SSS-ish look via lighting + fresnel)
- Screenshot/share card of your tower + score

