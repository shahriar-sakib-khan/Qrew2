"use client";

import { useEffect, useRef } from "react";

export function BackgroundEffects() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();

    type P = { x: number; y: number; v: number; o: number };
    let ps: P[] = [];
    let raf = 0;

    const make = () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      v: Math.random() * 0.25 + 0.05,
      o: Math.random() * 0.35 + 0.15,
    });

    const init = () => {
      ps = [];
      const count = Math.floor((canvas.width * canvas.height) / 8000); // Slightly more particles
      for (let i = 0; i < count; i++) ps.push(make());
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isDark = document.documentElement.classList.contains("dark");

      ps.forEach((p) => {
        p.y -= p.v;
        if (p.y < 0) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + Math.random() * 40;
          p.v = Math.random() * 0.25 + 0.05;
          p.o = Math.random() * 0.35 + 0.15;
        }

        // High contrast for Light Mode, standard white for Dark Mode
        ctx.fillStyle = isDark
          ? `rgba(255, 255, 255, ${p.o})`
          : `rgba(15, 23, 42, ${p.o * 1.5})`; // Slate-900 with boosted opacity

        ctx.fillRect(p.x, p.y, isDark ? 0.7 : 1.2, isDark ? 2.2 : 3); // Slightly thicker in light mode
      });
      raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
      setSize();
      init();
    };

    const observer = new MutationObserver(() => draw());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    window.addEventListener("resize", onResize);
    init();
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <style>{`
        /* Hide grid entirely in Light Mode, show only in Dark Mode */
        .accent-lines { display: none; }
        .dark .accent-lines { display: block; position: absolute; inset: 0; pointer-events: none; opacity: 0.15; }

        .hline, .vline { position: absolute; background: var(--primary); will-change: transform, opacity; }

        .hline { left: 0; right: 0; height: 1px; transform: scaleX(0); transform-origin: 50% 50%; animation: drawX 1.2s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .vline { top: 0; bottom: 0; width: 1px; transform: scaleY(0); transform-origin: 50% 0%; animation: drawY 1.2s cubic-bezier(0.22,0.61,0.36,1) forwards; }

        .hline:nth-child(1) { top: 20%; animation-delay: 0.1s; }
        .hline:nth-child(2) { top: 50%; animation-delay: 0.2s; }
        .hline:nth-child(3) { top: 80%; animation-delay: 0.3s; }
        .vline:nth-child(4) { left: 20%; animation-delay: 0.4s; }
        .vline:nth-child(5) { left: 50%; animation-delay: 0.5s; }
        .vline:nth-child(6) { left: 80%; animation-delay: 0.6s; }

        @keyframes drawX { 0% { transform: scaleX(0); opacity: 0; } 100% { transform: scaleX(1); opacity: 0.4; } }
        @keyframes drawY { 0% { transform: scaleY(0); opacity: 0; } 100% { transform: scaleY(1); opacity: 0.4; } }

        .card-animate { opacity: 0; transform: translateY(20px); animation: fadeUp 0.6s cubic-bezier(0.22,0.61,0.36,1) 0.1s forwards; }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Increased vignette visibility */}
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(80%_60%_at_50%_30%,var(--primary)_0%,transparent_60%)] opacity-[0.08] dark:opacity-[0.1]" />

      <div className="accent-lines fixed inset-0">
        <div className="hline" /> <div className="hline" /> <div className="hline" />
        <div className="vline" /> <div className="vline" /> <div className="vline" />
      </div>

      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full mix-blend-normal pointer-events-none" />
    </>
  );
}
