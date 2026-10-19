# Architectural 3D BIM & Penthouse Walkthrough Explorer

An interactive, Awwwards-grade 3D architectural web application featuring continuous camera choreography, structural exploded views, and a virtual interior penthouse tour with interactive 3D door portals.

---

## 🌟 Key Features

- **Cinematic Storytelling & Scroll Choreography**:
  - **Scene 1 (Skyline Monolith)**: High-altitude arrival through a 3-tier volumetric cloud canopy down to the architectural monolith.
  - **Scene 2 (Structural Anatomy)**: 20° structural tilt and a 25-meter 3-tier exploded cutaway revealing the core engineering, floorplates, and elevator shafts.
  - **Scene 3 (Grand Living Salon)**: Seamless transition into the luxury furnished penthouse suite.
- **Lenis Kinetic Glide & Recoil Physics**:
  - Smooth virtual scroll-intent engine with human-speed deceleration (`easeOutQuad` momentum).
  - Continuous motion without abrupt pauses, stops, or secondary snaps.
- **Virtual Penthouse Walkthrough Tour**:
  - Interactive **3D Blue Door Portals** floating directly on room doorways in 3D space.
  - Seamless navigation across 9 distinct penthouse rooms (Grand Living Lounge, Gourmet Kitchen, Terrace Balcony, Master Bedroom, Ensuite, Bedroom 2, Study, and Central Core).
  - 360° pan & look-around controls and WASD keyboard navigation.
- **Real-Time Architectural Lighting**:
  - One-click lighting environments: **Daylight**, **Golden Hour Sunset**, and **Night Architecture** with glowing interior fixtures and horizon atmospheric fog.
- **Optimized for 60 FPS Performance**:
  - Dynamic scene geometry culling (poly count automatically drops from 3.64M to 280K inside rooms for smooth performance on integrated GPUs).
  - ACESFilmic tone mapping and GPU Early-Z hardware depth testing.

---

## 🛠️ Technology Stack

- **3D Graphics**: [Three.js](https://threejs.org/) (WebGL, PerspectiveCamera, OrbitControls, Sky shader)
- **Animation & Scrubbing**: [GSAP](https://greensock.com/gsap/) & ScrollTrigger
- **Smooth Inertia**: [Lenis](https://github.com/darkroomengineering/lenis) (Virtual Scroll Intent)
- **Build & Dev Tooling**: [Vite](https://vitejs.dev/)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (bundled with Node.js)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd demo

# Install dependencies
npm install
```

### Local Development

```bash
# Start Vite development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📦 Production Build & Deployment

```bash
# Compile and bundle for production
npm run build

# Preview production build locally
npm run preview
```

The production output is generated in the `dist/` directory, optimized with relative asset paths for universal hosting.

### Deploying to Hosting Platforms

- **Vercel**: Import the GitHub repository; Vercel automatically detects Vite (`Build command: npm run build`, `Output directory: dist`).
- **Netlify**: Drag-and-drop the `dist` folder or connect your Git repository.
- **GitHub Pages**: Build outputs use relative paths (`base: './'`), so GitHub Pages deployment works out of the box.

---

## 📁 Project Structure

```
├── public/
│   └── models/
│       ├── building.glb       # 13-story architectural building model (41 MB)
│       └── top_floor.glb      # Furnished penthouse floor & rooms (7 MB)
├── src/
│   ├── main.js                # Three.js pipeline, Lenis scroll engine & walkthrough tour
│   └── style.css              # Glassmorphic UI design system, cards, & responsive HUD
├── index.html                 # App layout, story sections & 3D canvas mount
├── vite.config.js             # Vite configuration with relative deployment paths
├── package.json               # Dependencies & scripts
└── .gitignore                 # Production-ready Git ignore rules
```

---

## 📄 License

ISC License. Built for architectural visualization and modern interactive 3D web experiences.
