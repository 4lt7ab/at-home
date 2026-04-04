/**
 * AnimationStyles -- injects shared keyframe animations via a <style> element.
 * Mount once at the app root. Components reference keyframes by name in
 * inline styles (e.g., `animation: "spin 0.6s linear infinite"`).
 */
export function AnimationStyles() {
  return (
    <style>{`
      @keyframes highlight-flash {
        0% { background-color: var(--flash-color); }
        100% { background-color: transparent; }
      }
      @keyframes slide-in-left {
        from { transform: translateX(-12px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes scale-bump {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      @keyframes pulse-alive {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @keyframes glow-pulse {
        0%, 100% { box-shadow: 0 0 4px var(--glow-color); }
        50% { box-shadow: 0 0 16px var(--glow-color); }
      }
      @keyframes toast-in {
        from { transform: translateY(8px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes toast-out {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(8px); opacity: 0; }
      }
      @keyframes shimmer {
        0% { background-position: -200px 0; }
        100% { background-position: calc(200px + 100%) 0; }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `}</style>
  );
}
