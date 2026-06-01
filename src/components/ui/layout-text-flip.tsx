import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

type Item = {
  name: string;
  role?: string;
};

export const LayoutTextFlip = ({
  text = "From Jepi Okta Mipa, Thanks to",
  words = [],
  duration = 3000,
}: {
  text?: string;
  words?: Item[];
  duration?: number;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!words.length) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, duration);

    return () => clearInterval(interval);
  }, [words, duration]);

  const current = words[currentIndex];

  return (
    <motion.div
      layout
      transition={{
        layout: {
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
      className="flex items-center gap-2 flex-wrap"
    >
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {text}
      </span>

      <div className="relative overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 py-1">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentIndex}
            initial={{
              x: -8,
              opacity: 0,
              filter: "blur(6px)",
            }}
            animate={{
              x: 0,
              opacity: 1,
              filter: "blur(0px)",
            }}
            exit={{
              x: 8,
              opacity: 0,
              filter: "blur(6px)",
            }}
            transition={{
              type: "spring",
              stiffness: 140,
              damping: 20,
            }}
            className="flex items-center whitespace-nowrap"
          >
            {current.role && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                {current.role},
              </span>
            )}
            <span className="text-xs text-black dark:text-white ml-1">
              {" "}
              {current.name}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
