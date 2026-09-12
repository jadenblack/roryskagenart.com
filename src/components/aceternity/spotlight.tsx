import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';

/**
 * Aceternity UI — Spotlight
 * https://ui.aceternity.com/components/spotlight
 * A large elliptical light beam. Static, decorative, pointer-events-none.
 */
export const Spotlight: React.FC<{
  className?: string;
  fill?: string;
}> = ({ className, fill }) => {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1440 320"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spotlight-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="5%" stopColor={fill || '#3E3E3E'} stopOpacity="1" />
          <stop offset="95%" stopColor={fill || '#3E3E3E'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,160 L489.924,0 L569.924,0 L1440,320 L0,320 Z"
        fill="url(#spotlight-grad)"
      />
    </svg>
  );
};

/**
 * Aceternity UI — Spotlight Card (mouse-follow variant for grid cards)
 */
export const SpotlightCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}> = ({ children, className = '', spotlightColor = 'rgba(217, 119, 6, 0.14)' }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = React.useState(0);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!divRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={() => {
        setIsFocused(true);
        setOpacity(0.6);
      }}
      onBlur={() => {
        setIsFocused(false);
        setOpacity(0);
      }}
      onMouseEnter={() => setOpacity(0.6)}
      onMouseLeave={() => setOpacity(0)}
      className={className}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
};

/**
 * Aceternity UI — Parallax Scroll progress bar (used as section divider accent)
 */
export const ScrollProgress: React.FC<{ className?: string }> = ({ className }) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      style={{ scaleX }}
      className={`fixed top-0 left-0 right-0 h-0.5 origin-left z-50 ${className || ''}`}
    />
  );
};

/**
 * Aceternity UI — Parallax wrapper: translates children on scroll
 */
export const ParallaxY: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** negative = moves up as you scroll down */
  offset?: [number, number];
}> = ({ children, className, offset = [40, -40] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], offset);
  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
};
