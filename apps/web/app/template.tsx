"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(4px)", scale: 0.99 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      transition={{ ease: "easeOut", duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
