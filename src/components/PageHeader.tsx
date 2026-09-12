import React from 'react';
import { motion } from 'motion/react';

/**
 * Shared public page header — the studio's modern editorial masthead.
 *
 * One component, every public page: a mono kicker, a big serif statement
 * headline (blur-in), a supporting line, and an optional right-side meta
 * column with small actions. Pages opt into eyebrow/tagline content so the
 * old "kicker + giant name + tagline" duplication disappears.
 */
export interface PageHeaderProps {
  /** Small mono eyebrow, e.g. "Fine Art Studio & Gallery" */
  kicker?: string;
  /** Serif statement headline, e.g. "Paintings from the roadside imagination" */
  statement: string;
  /** One supporting sentence */
  support?: string;
  /** Right-hand meta rows: [{ label, value }] */
  meta?: Array<{ label: string; value: string }>;
  /** Small actions under the meta column */
  actions?: React.ReactNode;
  /** Extra content rendered below the header rule (sliders, filters…) */
  children?: React.ReactNode;
  /** Left accent line color — defaults to the amber accent token */
  accentClass?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  kicker,
  statement,
  support,
  meta,
  actions,
  children,
  accentClass = 'bg-amber-500',
}) => {
  return (
    <header className="relative pb-8 sm:pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        {/* Statement column */}
        <div className={`lg:col-span-8 space-y-4 ${meta && meta.length ? '' : 'lg:col-span-12'}`}>
          {kicker && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
            >
              <span className={`h-px w-8 ${accentClass}`} />
              <span>{kicker}</span>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-serif font-black uppercase tracking-tight leading-[0.95] text-foreground text-4xl sm:text-5xl md:text-6xl"
          >
            {statement}
          </motion.h1>

          {support && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="max-w-2xl text-sm sm:text-base leading-relaxed text-muted-foreground"
            >
              {support}
            </motion.p>
          )}
        </div>

        {/* Meta column */}
        {meta && meta.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-4 space-y-3 font-mono text-[11px] border-l border-line pl-5 lg:pl-6"
          >
            {meta.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <span className="uppercase tracking-widest text-muted-foreground">{row.label}</span>
                <span className="text-right font-bold text-foreground">{row.value}</span>
              </div>
            ))}
            {actions && <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div>}
          </motion.div>
        )}
      </div>

      {children && <div className="mt-8">{children}</div>}
    </header>
  );
};
