import React from 'react';
import { motion } from 'motion/react';

/**
 * Aceternity UI — Moving Border button
 * https://ui.aceternity.com/components/moving-border
 * A rotating conic-gradient sweeps around the button edge.
 */
export const MovingBorderButton: React.FC<{
  borderRadius?: string;
  children: React.ReactNode;
  as?: 'button';
  containerClassName?: string;
  borderClassName?: string;
  duration?: number;
  className?: string;
  onClick?: () => void;
  [key: string]: any;
}> = ({
  children,
  borderRadius = '0.5rem',
  containerClassName,
  borderClassName,
  duration = 3500,
  className,
  onClick,
  ...otherProps
}) => {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden bg-transparent p-[1px] text-xs ${containerClassName || ''}`}
      style={{ borderRadius }}
      {...otherProps}
    >
      <div
        className="absolute inset-0"
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
      >
        <MovingBorder duration={duration} rx="30%" ry="30%">
          <div
            className={`h-20 w-20 opacity-[0.9] bg-[radial-gradient(#f59e0b_40%,transparent_60%)] ${borderClassName || ''}`}
          />
        </MovingBorder>
      </div>
      <div
        className={`relative bg-slate-900/50 backdrop-blur-xl text-white flex items-center justify-center w-full h-full text-sm antialiased ${className || ''}`}
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
      >
        {children}
      </div>
    </button>
  );
};

export const MovingBorder: React.FC<{
  children: React.ReactNode;
  duration?: number;
  rx?: string;
  ry?: string;
  [key: string]: any;
}> = ({ children, duration = 3000, rx, ry, ...otherProps }) => {
  const rectRef = React.useRef<SVGRectElement>(null);
  const [pathLength, setPathLength] = React.useState(0);

  React.useEffect(() => {
    if (rectRef.current) {
      try {
        setPathLength(rectRef.current.getTotalLength());
      } catch {
        setPathLength(1000);
      }
    }
  }, []);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      className="absolute h-0 w-0"
      aria-hidden="true"
    >
      <rect ref={rectRef} rx={rx} ry={ry} width="100%" height="100%" stroke="none" fill="none" />
      <motion.rect
        rx={rx}
        ry={ry}
        width="100%"
        height="100%"
        fill="none"
        strokeDasharray={`${pathLength || 1000}`}
        strokeDashoffset="0"
        initial={{ strokeDashoffset: pathLength || 1000 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
        style={{ stroke: 'url(#moving-border-gradient)' }}
      />
      <defs>
        <linearGradient id="moving-border-gradient">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="1" />
        </linearGradient>
      </defs>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute h-full w-full">
        {children}
      </svg>
    </svg>
  );
};
