import { useEffect, useState } from "react";

interface CountdownTimerProps {
  /** Timestamp (ISO string or Date) to count down to */
  target: Date | string;
  /** Optional className for styling */
  className?: string;
}

// Helper to compute remaining time pieces
function getTimeRemaining(target: Date) {
  const total = target.getTime() - Date.now();
  const seconds = Math.max(Math.floor((total / 1000) % 60), 0);
  const minutes = Math.max(Math.floor((total / 1000 / 60) % 60), 0);
  const hours = Math.max(Math.floor((total / (1000 * 60 * 60)) % 24), 0);
  const days = Math.max(Math.floor(total / (1000 * 60 * 60 * 24)), 0);
  return { total, days, hours, minutes, seconds };
}

export function CountdownTimer({ target, className }: CountdownTimerProps) {
  const targetDate = typeof target === "string" ? new Date(target) : target;
  const [time, setTime] = useState(() => getTimeRemaining(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeRemaining(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (time.total <= 0) {
    return <span className={className}>We&#39;re live! 🎉</span>;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className={`flex items-center gap-2 font-mono ${className ?? ""}`}>
      <span>{pad(time.hours + time.days * 24)}</span>:
      <span>{pad(time.minutes)}</span>:
      <span>{pad(time.seconds)}</span>
    </div>
  );
} 