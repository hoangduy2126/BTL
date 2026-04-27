<p align="center">
  <img src="assets/images/VRTX_BANNER.webp" alt="VRTX Studio Logo" width="50%"/>
</p>


# VRTX Studio — Portfolio Website

> *Brand Identity · Motion Design · Product Design · Web Design · Sound Engineering*

A multi-page portfolio website for **VRTX Studio**, an independent design studio founded by 5 members of VNU-UET. Built with Three.js, vanilla HTML, CSS, and JavaScript — no frameworks.

Live site: [https://vrtxstdio.pages.dev](https://vrtxstdio.pages.dev)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Pages](#pages)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Build & Deployment](#build--deployment)
- [Team](#team)

---

## Overview

VRTX Studio's portfolio site is designed to reflect the studio's identity: bold, considered, and precise. The homepage features an interactive 3D logo scene built in Three.js that visitors can orbit with their cursor. The rest of the site uses a clean editorial layout to present selected works, services, team, and a contact form.

The project was built as a midterm assignment for the Web Development course at VNU-UET (2026).

---

## Features

- **Interactive 3D hero** — Three.js scene with an orbiteable VRTX logo on the homepage
- **Animated loading screen** — "Initializing 3D Environment" preloader before the scene mounts
- **Multi-page architecture** — 5 core pages + 5 individual project case study pages
- **Project gallery pages** — scrollable image galleries with full project metadata (client, scope, year)
- **Video showcase** — embedded local `.mp4` video grids on motion design project pages
- **Scrolling client marquee** — auto-scrolling ticker strip on the Works page
- **Contact form** — with client-side validation and a success confirmation state
- **Responsive layout** — mobile navigation with hamburger menu
- **Cloudflare Pages deployment** — static hosting with global CDN

---

## Pages

| Page | File | Description |
|---|---|---|
| Home | `index.html` | Interactive 3D logo scene, main entry point |
| Work | `works.html` | Selected project listing with client marquee |
| Services | `services.html` | Five service disciplines with images and descriptions |
| About | `about.html` | Studio story, team profiles, stats, and testimonials |
| Contact | `contact.html` | Enquiry form with service and budget selectors |
| Project — Invicta | `project-invicta.html` | Product design & brand identity case study |
| Project — The Daily Form | `project-dailyform.html` | Brand identity case study |
| Project — Fubon Guardians | `project-fubon.html` | Motion design & visual identity with video |
| Project — FlyFly | `project-flyfly.html` | Web design & UX/UI case study |
| Project — Big Take | `project-bigtake.html` | Sound design & short film case study |

---

## Tech Stack

| Layer | Technology |
|---|---|
| 3D rendering | [Three.js](https://threejs.org/) (r128) |
| Markup | HTML5 |
| Styling | CSS3 (custom properties, flexbox, grid) |
| Scripting | Vanilla JavaScript (ES6+) |
| Build tool | [Vite](https://vitejs.dev/) |
| Hosting | [Cloudflare Pages](https://pages.cloudflare.com/) |
| Image format | `.webp` (optimized via Vite asset pipeline) |
| Video format | `.mp4` (local assets) |

---

## Project Structure

```
vrtxstdio/
├── public/
│   └── favicon/
├── src/
│   ├── assets/               # Images (.webp), videos (.mp4), logo files
│   ├── styles/               # CSS files per page + global base
│   │   ├── base.css
│   │   ├── home.css
│   │   ├── works.css
│   │   ├── services.css
│   │   ├── about.css
│   │   ├── contact.css
│   │   └── project.css
│   ├── scripts/              # JavaScript per page
│   │   ├── three-scene.js    # Three.js 3D logo setup & orbit controls
│   │   ├── loader.js         # Loading screen logic
│   │   ├── nav.js            # Mobile navigation toggle
│   │   ├── marquee.js        # Client logo scrolling strip
│   │   └── contact.js        # Form validation & submission
│   └── components/           # Shared HTML partials (nav, footer)
├── index.html
├── works.html
├── services.html
├── about.html
├── contact.html
├── project-invicta.html
├── project-dailyform.html
├── project-fubon.html
├── project-flyfly.html
├── project-bigtake.html
├── vite.config.js
├── package.json
└── README.md
```

> **Note:** Asset filenames are hashed by Vite at build time (e.g. `VRTX_LOGO-DuCynY7p.webp`). Always reference assets through their source paths in `src/assets/` — do not hardcode hashed filenames.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/vrtxstdio.git
cd vrtxstdio

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The site will be available at `http://localhost:5173`.

### Available Scripts

```bash
npm run dev        # Start local dev server with hot reload
npm run build      # Build for production (outputs to /dist)
npm run preview    # Preview the production build locally
```

---

## Build & Deployment

The site is deployed automatically to **Cloudflare Pages** on every push to the `main` branch.

### Manual build

```bash
npm run build
```

The production-ready output is placed in `/dist`. All assets are hashed and optimized by Vite. The `dist/` folder is what Cloudflare Pages serves.

### Cloudflare Pages settings

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `18` |

### Environment

No environment variables are required. The site is fully static — the contact form uses a client-side handler and does not require a backend.

---

## Three.js Scene

The homepage 3D scene is initialized in `src/scripts/three-scene.js`. Key details:

- **Renderer:** `WebGLRenderer` with `antialias: true`, transparent background
- **Camera:** `PerspectiveCamera`, FOV 45°, positioned at z = 5
- **Orbit:** Mouse-driven rotation applied directly to the logo mesh (no OrbitControls dependency)
- **Model:** The VRTX logo is loaded as a `.webp` texture mapped onto a plane geometry, or as a 3D mesh exported from the design tool
- **Lighting:** Ambient light + one directional light to define edge contrast
- **Resize handling:** Window resize listener updates camera aspect ratio and renderer size

To modify the 3D scene, edit `src/scripts/three-scene.js`.

---

## Team

| Name | Role |
|---|---|
| Tran Gia Bao | Marketing Manager |
| Hoang Duc Duy | Creative Director |
| Nguyen Pham Son Ha | Senior Designer |
| Ho Trung Hieu | Senior Sound Engineer |
| Tran Khanh Long | Digital Artist |

VNU-UET · Vietnam National University, Hanoi · 2026

---

## License

This project was created as a midterm academic assignment. All design work, images, and video content belong to their respective authors and studios. Third-party project work (Invicta, Fubon Guardians, etc.) is referenced for educational portfolio purposes only.

---

*© 2026 VRTX Inc. — Creating memorable brand experiences for impact.*
