import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

/**
 * Aceternity UI — Infinite Moving Cards
 * https://ui.aceternity.com/components/infinite-moving-cards
 * CSS-marquee of duplicated content, pauses on hover.
 */
export interface InfiniteMovingCardItem {
  title: string;
  meta?: string;
  quote?: string;
}

export const InfiniteMovingCards: React.FC<{
  items: InfiniteMovingCardItem[];
  direction?: 'left' | 'right';
  speed?: 'slow' | 'normal' | 'fast';
  pauseOnHover?: boolean;
  className?: string;
}> = ({ items, direction = 'left', speed = 'slow', pauseOnHover = true, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(false);

  const addAnimation = React.useCallback(() => {
    if (containerRef.current && scrollerRef.current && !start) {
      const scrollerContent = Array.from(scrollerRef.current.children);
      scrollerContent.forEach((item) => {
        const duplicatedItem = item.cloneNode(true);
        scrollerRef.current?.appendChild(duplicatedItem);
      });
      setAnimationDirection();
      setSpeed();
      setStart(true);
    }
  }, [start]);

  const setAnimationDirection = () => {
    if (containerRef.current) {
      containerRef.current.style.setProperty(
        '--animation-direction',
        direction === 'left' ? 'forwards' : 'reverse'
      );
    }
  };

  const setSpeed = () => {
    if (containerRef.current) {
      const duration = speed === 'fast' ? '25s' : speed === 'normal' ? '45s' : '70s';
      containerRef.current.style.setProperty('--animation-duration', duration);
    }
  };

  useEffect(() => {
    addAnimation();
  }, [addAnimation]);

  return (
    <div
      ref={containerRef}
      className={cn('scroller relative z-20 max-w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_12%,white_88%,transparent)]', className)}
      style={{
        '--animation-direction': 'forwards',
        '--animation-duration': '70s',
      } as React.CSSProperties}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          'flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-2',
          start && 'animate-marquee',
          pauseOnHover && 'hover:[animation-play-state:paused]'
        )}
      >
        {items.map((item, idx) => (
          <li
            key={`${item.title}-${idx}`}
            className="w-[260px] max-w-full shrink-0 border border-line bg-surface px-6 py-4 md:w-[320px]"
          >
            <span className="block text-xs font-mono font-bold uppercase tracking-widest text-foreground">
              {item.title}
            </span>
            {item.meta && (
              <span className="mt-1 block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {item.meta}
              </span>
            )}
            {item.quote && (
              <span className="mt-2 block font-serif text-xs italic leading-relaxed text-muted-foreground">
                “{item.quote}”
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
