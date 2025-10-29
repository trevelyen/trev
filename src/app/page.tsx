'use client';

import { useEffect, useState } from 'react';
import { useSpring, animated } from '@react-spring/web';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setMounted(true);
    setShowContent(true);
    setIsMobile(window.innerWidth < 768);

    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      if (newIsMobile !== isMobile) {
        setShowContent(false);
        setTimeout(() => {
          setIsMobile(newIsMobile);
          setShowContent(true);
        }, 300);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  const springs = useSpring({
    opacity: showContent && !showCard ? 1 : 0,
    transform: showCard ? 'translateX(-100vw)' : 'translateX(0)',
    config: { tension: 280, friction: 60 }
  });

  const hoverSpring = useSpring({
    glowIntensity: isHovered ? 1 : 0,
    config: { tension: 300, friction: 40 }
  });

  const cardSpring = useSpring({
    opacity: showCard ? 1 : 0,
    transform: showCard ? 'translateX(0)' : 'translateX(100vw)',
    config: { tension: 280, friction: 60 }
  });

  const handleLogoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowContent(false);
    setTimeout(() => {
      setShowCard(true);
    }, 300);
  };

  const handleScreenClick = () => {
    if (showCard) {
      setShowCard(false);
      setTimeout(() => {
        setShowContent(true);
      }, 300);
    }
  };

  return (
    <div
      className={`relative min-h-screen bg-black overflow-hidden flex ${isMobile ? 'items-end justify-center' : 'items-center justify-start'}`}
      onClick={handleScreenClick}
    >
      {/* Subtle gradient backdrop */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-cyan-950/10 via-black to-purple-950/10" />

      {/* Main content */}
      <animated.div
        style={springs}
        className={`relative z-10 ${isMobile ? 'pl-0 pb-16' : 'pl-20 pb-0'}`}>
        {/* Logo/Brand name */}
        <h1
          className="text-8xl mb-8 relative cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleLogoClick}
        >
          <span className="relative inline-block">

            {/* Main text */}
            <animated.span
              className="relative"
              style={{
                fontFamily: 'var(--font-inter)',
                fontWeight: 100,
                letterSpacing: '0.15em',
                transform: 'scaleX(1.2)',
                backgroundImage: hoverSpring.glowIntensity.to(v =>
                  v > 0.5
                    ? 'linear-gradient(90deg, #22d3ee 0%, #c084fc 25%, #22d3ee 50%, #c084fc 75%, #22d3ee 100%)'
                    : 'linear-gradient(90deg, #06b6d4 0%, #a855f7 25%, #06b6d4 50%, #a855f7 75%, #06b6d4 100%)'
                ),
                backgroundSize: '200% 100%',
                animation: 'flow 8s linear infinite',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: hoverSpring.glowIntensity.to(v => `brightness(${1 + v * 1.5})`),
                textShadow: hoverSpring.glowIntensity.to(v =>
                  `0 0 ${20 + v * 80}px rgba(0, 255, 255, ${0.2 + v * 0.8}), 0 0 ${40 + v * 160}px rgba(147, 51, 234, ${0.15 + v * 0.85})`
                )
              }}>
              trevelyen
            </animated.span>

          </span>
        </h1>

      </animated.div>

      {/* Card overlay */}
      {showCard && (
        <animated.div
          style={cardSpring}
          className="absolute inset-0 flex items-center justify-center z-20"
        >
          <div
            className="bg-black/80 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-8 max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
          <p className="text-cyan-100/90 text-lg leading-relaxed" style={{ fontFamily: 'var(--font-inter)' }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
          </p>
        </div>
      </animated.div>
      )}

      <style jsx>{`
        @keyframes flow {
          0% {
            background-position: 200% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
}
