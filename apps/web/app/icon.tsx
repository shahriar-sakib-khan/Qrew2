// app/icon.tsx
import { ImageResponse } from "next/og";

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      // The same SVG geometry and color logic is applied here.
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        width={32}
        height={32}
      >
        <polygon points="5,75 5,55 25,55 25,75" fill="#56D9A3" />
        <polygon points="25,25 25,5 45,5 45,25" fill="#229E93" />
        <polygon points="25,55 5,55 5,25 25,25" fill="#56D9A3" />
        <polygon points="5,25 25,5 25,25" fill="#56D9A3" />
        <polygon points="25,5 75,5 75,25 25,25" fill="#2FD8C7" />
        <polygon points="75,5 95,25 75,25" fill="#2FD8C7" />
        <polygon points="75,25 95,25 95,45 75,45" fill="#304FFE" />
        <polygon points="75,45 95,45 95,75 75,75" fill="#F97D3C" />
        <polygon points="95,75 75,95 75,75" fill="#F97D3C" />
        <polygon points="75,75 95,75 95,95 75,95" fill="#BE356B" />
        <polygon points="75,75 75,95 25,95 25,75" fill="#FFAC1E" />
        <polygon points="25,95 5,75 25,75" fill="#FFAC1E" />
        <polygon points="25,75 5,75 5,55 25,55" fill="#0B8248" />
        <polygon points="50,75 75,75 95,95 70,95" fill="#7E57C2" />
      </svg>
    ),
    // ImageResponse options
    {
      ...size,
    }
  );
}
