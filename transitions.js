/**
 * VRTX Studio — Shared Interactions
 * • Page fade transitions
 * • IntersectionObserver scroll reveals
 * • Glass header on scroll
 * • Stats counter animation
 * • Mobile hamburger nav
 * • Marquee duplication
 */

/* ── Page Transition ─────────────────────────────────────── */
(function () {
    const overlay = document.getElementById('page-transition');
    if (!overlay) return;

    // Fade the overlay OUT on page load (coming in fresh)
    window.addEventListener('pageshow', () => {
        overlay.classList.remove('active');
    });

    // Intercept same-origin link clicks → fade then navigate
    // (Xoá sự kiện click này để không còn fade đen khi chuyển trang)
    /*
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
            href.startsWith('http') && !href.startsWith(location.origin)
        ) return;

        e.preventDefault();
        overlay.classList.add('active');
        setTimeout(() => { window.location.href = href; }, 440);
    });
    */
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
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

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
