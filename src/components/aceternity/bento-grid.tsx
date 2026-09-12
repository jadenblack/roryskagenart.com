import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Aceternity UI — Bento Grid
 * https://ui.aceternity.com/components/bento-grid
 */
export const BentoGrid: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => {
  return (
    <div
      className={cn(
        'grid md:auto-rows-[19rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-none',
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem: React.FC<{
  className?: string;
  header: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  onClick?: () => void;
}> = ({ className, header, title, description, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group/bento row-span-1 flex flex-col justify-between text-left cursor-pointer transition duration-200 hover:shadow-xl',
        className
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-2 transition duration-200 p-4 space-y-1.5">
        {title}
        {description}
      </div>
    </button>
  );
};
