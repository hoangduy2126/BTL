/**
 * VRTX Studio — Shared Interactions
 * • Page fade transitions
 * • IntersectionObserver scroll reveals
 * • Glass header on scroll
 * • Stats counter animation
 * • Mobile hamburger nav
 * • Marquee duplication
 */

/* ── Page Transition ──────────────────────────────────────────── */
(function () {
    const overlay = document.getElementById('page-transition');
    if (!overlay) return;

    // Fade the overlay OUT on page load (coming in fresh)
    window.addEventListener('pageshow', () => {
        overlay.classList.remove('active');
    });

    // Intercept same-origin link clicks → fade then navigate
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (!a) return;

        const href = a.getAttribute('href');
        // Skip: external, anchor, mailto/tel, new-tab
        if (
            !href ||
            href.startsWith('#') ||
            href.startsWith('mailto') ||
            href.startsWith('tel') ||
            a.target === '_blank' ||
            (href.startsWith('http') && !href.startsWith(location.origin))
        ) return;

        e.preventDefault();
        overlay.classList.add('active');
        setTimeout(() => { window.location.href = href; }, 420);
    });
})();

/* ── Scroll Reveal (IntersectionObserver) ───────────────── */
(function () {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -10px 0px' });

    items.forEach(el => obs.observe(el));
})();

/* ── Glass Header on Scroll ─────────────────────────────── */
(function () {
    const header = document.querySelector('header');
    if (!header) return;

    // Don't apply on index (overflow: hidden, no scroll)
    if (document.body.style.overflow === 'hidden') return;

    const onScroll = () => {
        header.classList.toggle('scrolled', window.scrollY > 55);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
})();

/* ── Stats Counter Animation ─────────────────────────────── */
(function () {
    const stats = document.querySelectorAll('.stat-number[data-target]');
    if (!stats.length) return;

    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el     = entry.target;
            const target = parseFloat(el.dataset.target);
            const suffix = el.dataset.suffix || '';
            const dur    = 1600;
            const start  = performance.now();

            function update(now) {
                const progress = Math.min((now - start) / dur, 1);
                const value    = Math.round(easeOutExpo(progress) * target);
                el.textContent = value + suffix;
                if (progress < 1) requestAnimationFrame(update);
            }
            requestAnimationFrame(update);
            obs.unobserve(el);
        });
    }, { threshold: 0.5 });

    stats.forEach(el => obs.observe(el));
})();

/* ── Marquee Init (duplicate items for seamless loop) ────── */
(function () {
    const track = document.querySelector('.marquee-track');
    if (!track) return;
    const original = track.innerHTML;
    track.innerHTML = original + original;
})();

/* ── Mobile Hamburger Nav ────────────────────────────────── */
(function () {
    const burger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobile-nav');
    if (!burger || !mobileNav) return;

    burger.addEventListener('click', () => {
        const isOpen = burger.classList.toggle('open');
        mobileNav.classList.toggle('open', isOpen);
        // Prevent body scroll while open
        document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close on link click
    mobileNav.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            burger.classList.remove('open');
            mobileNav.classList.remove('open');
            document.body.style.overflow = '';
        });
    });
})();

/* ── Theme Toggle ────────────────────────────────────────── */
(function () {
    const initTheme = () => {
        const isLight = localStorage.getItem('vrtx-theme') === 'light';
        document.body.classList.toggle('light-mode', isLight);
    };
    initTheme(); // Run immediately

    document.addEventListener('DOMContentLoaded', () => {
        const toggleBtn = document.getElementById('theme-toggle');
        if (!toggleBtn) return;
        
        toggleBtn.addEventListener('click', () => {
            document.documentElement.classList.add('theme-transitioning');
            const isLight = document.body.classList.toggle('light-mode');
            localStorage.setItem('vrtx-theme', isLight ? 'light' : 'dark');
            
            setTimeout(() => {
                document.documentElement.classList.remove('theme-transitioning');
            }, 400);
        });
    });
})();

/* ── Back To Top Scroll ──────────────────────────────────── */
(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('back-to-top');
        if (!btn) return;
        
        btn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    });
})();

/* ── Force Scroll Top on Load ────────────────────────────── */
(function () {
    // Prevent browser from restoring scroll position
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    // Scroll to top on load/show
    window.addEventListener('pageshow', () => {
        window.scrollTo(0, 0);
    });
    // Extra insurance for DOM content
    document.addEventListener('DOMContentLoaded', () => {
        window.scrollTo(0, 0);
    });
})();

/* ── Service Number Count-Up Animation ──────────────────────── */
(function () {
    const accents = document.querySelectorAll('.service-num-accent');
    if (!accents.length) return;

    const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const target = parseInt(el.textContent, 10);
            if (isNaN(target)) return;
            const dur = 900;
            const start = performance.now();
            function update(now) {
                const p = Math.min((now - start) / dur, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                const val = Math.round(eased * target);
                el.textContent = String(val).padStart(2, '0');
                if (p < 1) requestAnimationFrame(update);
            }
            requestAnimationFrame(update);
            obs.unobserve(el);
        });
    }, { threshold: 0.6 });

    accents.forEach(el => obs.observe(el));
})();

/* ── Orbit Hint Auto-Fade ────────────────────────────────────── */
(function () {
    const hint = document.getElementById('orbit-hint');
    if (!hint) return;
    // Fade out after 3.5s of no drag interaction
    let fadeTimer = setTimeout(() => hint.classList.add('fade-out'), 3500);
    const canvas = document.querySelector('canvas');
    if (canvas) {
        const reset = () => {
            hint.classList.remove('fade-out');
            clearTimeout(fadeTimer);
            fadeTimer = setTimeout(() => hint.classList.add('fade-out'), 3000);
        };
        canvas.addEventListener('pointerdown', reset);
    }
})();

/* ── Loading Screen Percentage Counter ──────────────────────── */
(function () {
    const pct = document.getElementById('loading-percent');
    if (!pct) return;
    const dur = 1600; // matches loading-bar animation roughly
    const start = performance.now();
    function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 2);
        pct.textContent = Math.round(eased * 100) + '%';
        if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();

/* ── Floating Work Card Thumbnail Preview ────────────────────── */
(function () {
    // Only on works page - look for work cards with thumbnails
    const cards = document.querySelectorAll('.work-card[data-thumb], .work-card[data-thumbs]');
    if (!cards.length) return;

    // Create floating preview element
    const preview = document.createElement('div');
    preview.id = 'work-thumb-preview';
    document.body.appendChild(preview);

    let mx = 0, my = 0;
    let slideshowInterval = null;

    document.addEventListener('mousemove', e => {
        mx = e.clientX;
        my = e.clientY;
        if (preview.classList.contains('visible')) {
            // Offset so it sits top-right of the cursor
            preview.style.left = (mx + 20) + 'px';
            preview.style.top  = (my - 80) + 'px';
        }
    });

    cards.forEach(card => {
        const thumbsAttr = card.dataset.thumbs || card.dataset.thumb;
        if (!thumbsAttr) return;
        
        const urls = thumbsAttr.split(',').map(u => u.trim());
        
        card.addEventListener('mouseenter', () => {
            preview.innerHTML = ''; // Clear previous slides
            
            const slides = urls.map((url, i) => {
                const div = document.createElement('div');
                div.className = 'thumb-slide' + (i === 0 ? ' active' : '');
                div.style.backgroundImage = `url('${url}')`;
                preview.appendChild(div);
                return div;
            });
            
            let current = 0;
            if (slides.length > 1) {
                slideshowInterval = setInterval(() => {
                    slides[current].classList.remove('active');
                    current = (current + 1) % slides.length;
                    slides[current].classList.add('active');
                }, 1200); // 1.2s per slide
            }

            preview.style.left = (mx + 20) + 'px';
            preview.style.top  = (my - 80) + 'px';
            preview.classList.add('visible');
        });
        
        card.addEventListener('mouseleave', () => {
            preview.classList.remove('visible');
            clearInterval(slideshowInterval);
        });
    });
})();
