import React from "react";

interface VideoPlayerProps {
  /** Public URL or path to the video (mp4, webm, etc.) */
  src: string;
  /** Optional poster image shown before playback */
  poster?: string;
  /** Tailwind / custom class overrides */
  className?: string;
}

export function VideoPlayer({ src, poster, className }: VideoPlayerProps) {
  return (
    <video
      className={className ?? "w-full h-full"}
      src={src}
      poster={poster}
      controls
      autoPlay
      muted
      loop
      playsInline
    />
  );
} 