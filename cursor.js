/**
 * VRTX Studio — Custom Animated Cursor
 * Dot that follows exactly + ring that lags behind with spring interpolation.
 * Ring expands and shows a label when hovering interactive elements.
 */
(function () {
    // Only run on fine-pointer (mouse) devices
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const dot  = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;

    let mx = -200, my = -200;   // mouse real position
    let rx = -200, ry = -200;   // ring smoothed position

    /* ── Mouse tracking ─────────────────────────────────── */
    document.addEventListener('mousemove', (e) => {
        mx = e.clientX;
        my = e.clientY;
    });

    document.addEventListener('mouseleave', () => {
        dot.style.opacity  = '0';
        ring.style.opacity = '0';
    });

    document.addEventListener('mouseenter', () => {
        dot.style.opacity  = '1';
        ring.style.opacity = '1';
    });

    /* ── Hovered-element detection ──────────────────────── */
    function resolveLabel(el) {
        if (!el) return null;
        const card = el.closest('.work-card');
        if (card) return 'View';
        const a = el.closest('a, button, [role="button"]');
        if (!a) return null;
        const ariaLabel = a.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel.slice(0, 6);
        return '↗';
    }

    document.addEventListener('mouseover', (e) => {
        const label = resolveLabel(e.target);
        if (label !== null) {
            ring.classList.add('is-link');
            ring.textContent = label;
        }
    });

    document.addEventListener('mouseout', (e) => {
        const label = resolveLabel(e.target);
        if (label !== null) {
            ring.classList.remove('is-link');
            ring.textContent = '';
        }
    });

    /* ── Mousedown/up scale feedback ────────────────────── */
    document.addEventListener('mousedown', () => {
        dot.style.width  = '12px';
        dot.style.height = '12px';
    });
    document.addEventListener('mouseup', () => {
        dot.style.width  = '7px';
        dot.style.height = '7px';
    });

    /* ── Render loop — spring lerp for ring ─────────────── */
    function lerp(a, b, t) { return a + (b - a) * t; }

    function tick() {
        // Dot follows instantly (via CSS left/top, not transform, to keep blend-mode)
        dot.style.left = mx + 'px';
        dot.style.top  = my + 'px';

        // Ring lags with spring
        rx = lerp(rx, mx, 0.11);
        ry = lerp(ry, my, 0.11);
        ring.style.left = rx + 'px';
        ring.style.top  = ry + 'px';

        requestAnimationFrame(tick);
    }
    tick();
})();
