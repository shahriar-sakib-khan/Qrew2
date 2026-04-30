// components/ui/logo.tsx
import type { FC } from "react";

interface QrewLogoProps {
  className?: string;
}

export const QrewLogo: FC<QrewLogoProps> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      {/* 1. Main Bottom Green Ribbon */}
      <polygon points="5,75 5,55 25,55 25,75" fill="#56D9A3" />

      {/* 2. Top-Left Inner Dark Teal Intersection Block */}
      <polygon points="25,25 25,5 45,5 45,25" fill="#229E93" />

      {/* 3. Main Left Green Ribbon */}
      <polygon points="25,55 5,55 5,25 25,25" fill="#56D9A3" />

      {/* 4. Top-Left Outer Green Corner */}
      <polygon points="5,25 25,5 25,25" fill="#56D9A3" />

      {/* 5. Main Top Cyan Ribbon */}
      <polygon points="25,5 75,5 75,25 25,25" fill="#2FD8C7" />

      {/* 6. Top-Right Outer Cyan Corner */}
      <polygon points="75,5 95,25 75,25" fill="#2FD8C7" />

      {/* 7. Top-Right Inner Dark Blue Intersection Block */}
      <polygon points="75,25 95,25 95,45 75,45" fill="#304FFE" />

      {/* 8. Main Right Orange Ribbon */}
      <polygon points="75,45 95,45 95,75 75,75" fill="#F97D3C" />

      {/* 9. Bottom-Right Outer Orange Corner */}
      <polygon points="95,75 75,95 75,75" fill="#F97D3C" />

      {/* 10. Bottom-Right Inner Dark Orange-Red Intersection Block */}
      {/* This area is partially covered by the Q tail. */}
      <polygon points="75,75 95,75 95,95 75,95" fill="#BE356B" />

      {/* 11. Main Bottom Gold Ribbon */}
      <polygon points="75,75 75,95 25,95 25,75" fill="#FFAC1E" />

      {/* 12. Bottom-Left Outer Gold Corner */}
      <polygon points="25,95 5,75 25,75" fill="#FFAC1E" />

      {/* 13. Bottom-Left Inner Dark Green Intersection Block */}
      <polygon points="25,75 5,75 5,55 25,55" fill="#0B8248" />

      {/* Q's Tail (Purple Ribbon), placed last to be on top */}
      <polygon points="50,75 75,75 95,95 70,95" fill="#7E57C2" />
    </svg>
  );
};
