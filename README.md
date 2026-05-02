<p align="center">
  <img src="assets/images/VRTX_BANNER.webp" alt="VRTX Studio Banner" width="100%" />
</p>

<p align="center">
  <a href="https://vrtxstdio.pages.dev"><img src="https://img.shields.io/badge/Live%20Site-vrtxstdio.pages.dev-DC2626?style=flat-square&logo=cloudflare&logoColor=white" alt="Live Site"/></a>
  <a href="https://github.com/hoangduy2126/BTL"><img src="https://img.shields.io/badge/GitHub-hoangduy2126%2FBTL-181717?style=flat-square&logo=github" alt="GitHub"/></a>
  <img src="https://img.shields.io/badge/Three.js-v0.184.0-black?style=flat-square&logo=threedotjs" alt="Three.js"/>
  <img src="https://img.shields.io/badge/Vite-v8.0-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Deployed%20on-Cloudflare%20Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Pages"/>
</p>

# VRTX Studio — Portfolio Website

> *Brand Identity · Motion Design · Product Design · Web Design · Sound Engineering*

A multi-page portfolio website for **VRTX Studio**, an independent creative studio founded by 5 members of VNU-UET. Built with Three.js, vanilla HTML, CSS, and JavaScript — no frameworks.

Midterm Assignment — **Computer Graphics** (2526II_CTE2059_1) · VNU University of Engineering and Technology · 2026

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Pages](#pages)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Build & Deployment](#build--deployment)
- [Three.js Scene](#threejs-scene)
- [Team](#team)
- [License](#license)

---

## Overview

VRTX Studio's portfolio site is designed to reflect the studio's identity: bold, considered, and precise. The homepage features an interactive 3D logo scene built in Three.js that visitors can orbit freely with their cursor. The rest of the site follows a clean editorial layout to present selected works, services, team members, and a contact form.

---

## Features

- **Interactive 3D hero** — Three.js scene with an orbitable VRTX logo on the homepage
- **Animated loading screen** — "Initializing 3D Environment" preloader before the 3D scene mounts
- **Custom cursor** — Branded cursor with hover states powered by `cursor.js`
- **Page transitions** — Smooth cross-page fade animations via `transitions.js`
- **Multi-page architecture** — 5 core pages + 5 individual project case study pages
- **Project gallery pages** — Scrollable image galleries with full project metadata (client, scope, year)
- **Video showcase** — Embedded `.mp4` video grids on motion design project pages
- **Scrolling client marquee** — Auto-scrolling logo ticker strip on the Works page
- **Contact form** — Client-side validation with a success confirmation state
- **Responsive navigation** — Mobile hamburger menu
- **Cloudflare Pages deployment** — Static hosting with global CDN, auto-deploy on push to `main`

---

## Pages

| Page | File | Description |
|---|---|---|
| Home | `index.html` | Interactive 3D logo scene — main entry point |
| Work | `works.html` | Selected project listing with client marquee |
| Services | `services.html` | Five service disciplines with images and descriptions |
| About | `about.html` | Studio story, team profiles, stats, and testimonials |
| Contact | `contact.html` | Enquiry form with service type and budget selectors |
| Project — Invicta | `project-invicta.html` | Product design & brand identity case study |
| Project — The Daily Form | `project-dailyform.html` | Brand identity case study |
| Project — Fubon Guardians | `project-fubon.html` | Motion design & visual identity with video |
| Project — BeFit | `project-aura.html` | UI/UX design & fitness app case study |
| Project — Big Take | `project-bigtake.html` | Sound design & short film case study |

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| 3D rendering | [Three.js](https://threejs.org/) | `^0.184.0` |
| Markup | HTML5 | — |
| Styling | CSS3 (custom properties, flexbox, grid) | — |
| Scripting | Vanilla JavaScript (ES modules) | ES6+ |
| Build tool | [Vite](https://vitejs.dev/) | `^8.0.9` |
| Hosting | [Cloudflare Pages](https://pages.cloudflare.com/) | — |
| Image format | `.webp` | — |
| Video format | `.mp4` | — |

---

## Project Structure

```
BTL/
├── assets/
│   └── images/               # All .webp images, banner, logos, project assets
├── .vscode/                  # Editor settings
├── .gitattributes
├── .gitignore
├── index.html                # Homepage — Three.js 3D scene
├── works.html                # Works listing page
├── services.html             # Services page
├── about.html                # About / team page
├── contact.html              # Contact & enquiry form
├── project-invicta.html      # Case study: Invicta
├── project-dailyform.html    # Case study: The Daily Form
├── project-fubon.html        # Case study: Fubon Guardians
├── project-aura.html         # Case study: BeFit
├── project-bigtake.html      # Case study: Big Take
├── style.css                 # Global stylesheet
├── main.js                   # Three.js scene entry point
├── cursor.js                 # Custom cursor logic
├── transitions.js            # Page transition animations
├── vite.config.js            # Vite configuration
├── package.json
├── package-lock.json
├── bao_cao_du_an.md          # Project report (Vietnamese)
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/hoangduy2126/BTL.git
cd BTL

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

The site is automatically deployed to **Cloudflare Pages** on every push to the `main` branch.

### Manual build

```bash
npm run build
```

The production output is placed in `/dist`. All assets are processed and optimized by Vite before deployment.

### Cloudflare Pages settings

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `18` |
| Branch | `main` |

No environment variables are required. The site is fully static — the contact form uses a client-side handler and does not require a backend.

---

## Three.js Scene

The homepage 3D scene is initialized in `main.js`. Key implementation details:

- **Version:** Three.js `^0.184.0` (installed via npm)
- **Renderer:** `WebGLRenderer` with `antialias: true`, transparent background
- **Camera:** `PerspectiveCamera` with responsive aspect ratio handling
- **Orbit:** Mouse-driven rotation applied to the logo mesh on `mousemove`
- **Loading:** A preloader overlay ("Initializing 3D Environment") dismisses once the scene is ready
- **Resize handling:** `window.resize` listener updates renderer size and camera aspect ratio

To modify the 3D scene, edit `main.js`.

---

## Team

| Name | Role |
|---|---|
| Tran Gia Bao | Marketing Manager |
| Hoang Duc Duy | Creative Director |
| Nguyen Pham Son Ha | Senior Designer |
| Ho Trung Hieu | Senior Sound Engineer |
| Tran Khanh Long | Digital Artist |

**VNU-UET** · Vietnam National University, Hanoi
Course: Computer Graphics — 2526II_CTE2059_1 · 2026

---

## License

This project was created as a midterm academic assignment for VNU-UET. All design work, images, and video content belong to their respective creators. Third-party project work referenced in case studies (Invicta, Fubon Guardians, etc.) is used for educational portfolio purposes only.

---

<p align="center"><i>© 2026 VRTX Inc. — Creating memorable brand experiences for impact.</i></p>
