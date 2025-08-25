import { useState, useEffect, useCallback, useMemo } from "react";

export default function HeroSection() {
  // Memoize event date so it doesn't recreate on every render
  const eventDate = useMemo(() => new Date("2025-12-25T06:00:00"), []);

  const calculateTimeLeft = useCallback(() => {
    const difference = +eventDate - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  }, [eventDate]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  return (
    <section className="relative bg-black text-white h-[70vh] flex flex-col justify-center items-center text-center overflow-hidden">
      {/* Background Video */}
      <video
        className="absolute inset-0 w-full h-full object-cover opacity-60"
        src="/videos/hero-video.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Overlay Content */}
      <div className="relative z-10 max-w-full px-4">
        <h1 className="font-bold mb-4 whitespace-nowrap text-[clamp(2.5rem,6vw,5rem)]">
          FUN RUN: Takbo Para Sa Youth
        </h1>

        <p className="mb-6 whitespace-nowrap text-[clamp(1.25rem,2.5vw,1rem)]">
          Lace up for a cause. A family-friendly event to raise support for youth programs, camps, and outreach. Walk, jog, or run — everyone’s welcome!
        </p>
        <br></br>
        {/* Countdown Timer */}
        <div className="flex justify-center gap-4 text-center">
          {["days", "hours", "minutes", "seconds"].map((unit) => (
            <div key={unit}>
              <p className="text-3xl md:text-5xl font-bold">
                {timeLeft[unit] ?? "0"}
              </p>
              <span className="uppercase text-sm">{unit}</span>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-8">
          <a
            href="#registration-form"
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full text-white text-lg font-semibold transition"
          >
            Register Now
          </a>
        </div>
      </div>
    </section>
  );
}
