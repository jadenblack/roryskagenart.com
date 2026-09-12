import React from 'react';
import { motion } from 'motion/react';

interface TextGenerateProps {
  words: string;
  className?: string;
  filter?: [number, number];
  duration?: number;
  delay?: number;
}

/**
 * Aceternity UI — Text Generate Effect
 * https://ui.aceternity.com/components/text-generate-effect
 * Words fade and blur into place, staggered left to right.
 */
export const TextGenerateEffect: React.FC<TextGenerateProps> = ({
  words,
  className,
  filter = [10, 0],
  duration = 0.5,
  delay = 0,
}) => {
  const wordsArray = words.split(' ');

  return (
    <span className={className}>
      {wordsArray.map((word, idx) => (
        <motion.span
          key={idx}
          initial={{ opacity: 0, filter: `blur(${filter[0]}px)` }}
          animate={{ opacity: 1, filter: `blur(${filter[1]}px)` }}
          transition={{
            duration,
            delay: delay + idx * 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block"
        >
          {word}
          {idx < wordsArray.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </span>
  );
};
