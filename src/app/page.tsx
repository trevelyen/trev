'use client'

import { useEffect, useState } from 'react'
import { useSpring, useTransition, animated, to } from '@react-spring/web'

export default function HomePage() {
  const [, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isCardHovered, setIsCardHovered] = useState(false)
  const [showCard, setShowCard] = useState(false)

  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    setMounted(true)
    setShowContent(true)
    setIsMobile(window.innerWidth < 768)

    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768
      if (newIsMobile !== isMobile) {
        setShowContent(false)
        setTimeout(() => {
          setIsMobile(newIsMobile)
          setShowContent(true)
        }, 300)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobile])

  const springs = useSpring({
    opacity: showContent && !showCard ? 1 : 0,
    transform: showCard ? 'translateX(-100vw)' : 'translateX(0)',
    config: { tension: 280, friction: 60, precision: 0.0001 },
  })

  const hoverSpring = useSpring({
    glowIntensity: isHovered ? 1 : 0,
    config: { tension: 300, friction: 40, precision: 0.0001 },
  })

  const cardHoverSpring = useSpring({
    glowIntensity: isCardHovered ? 1 : 0,
    config: { tension: 300, friction: 40, precision: 0.0001 },
  })

  const cardTransition = useTransition(showCard, {
    from: { opacity: 0, y: 20, scale: 0.95 },
    enter: { opacity: 1, y: 0, scale: 1 },
    leave: { opacity: 0, y: 20, scale: 0.95 },
    config: { tension: 280, friction: 60, precision: 0.0001 },
  })

  const handleLogoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowContent(false)
    setTimeout(() => {
      setShowCard(true)
    }, 300)
  }

  const handleScreenClick = () => {
    if (showCard) {
      setShowCard(false)
      setTimeout(() => {
        setShowContent(true)
      }, 300)
    }
  }

  return (
    <div
      className={`relative min-h-screen bg-black overflow-hidden flex ${isMobile ? 'items-end justify-center' : 'items-center justify-start'}`}
      onClick={handleScreenClick}>
      {/* Subtle gradient backdrop */}
      <div className='absolute inset-0 z-0 bg-gradient-to-br from-cyan-950/10 via-black to-purple-950/10' />

      {/* Main content */}
      <animated.div
        style={springs}
        className={`relative z-10 ${isMobile ? 'pl-0 pb-16 w-full flex justify-center' : 'pl-20 pb-0'}`}>
        {/* Logo/Brand name */}
        <h1
          className={`text-6xl mb-8 relative cursor-pointer ${isMobile ? 'text-center' : ''}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleLogoClick}>
          <span
            className='relative inline-block'
            style={{ marginRight: '-0.15em' }}>
            {/* Main text */}
            <animated.span
              className='relative'
              style={{
                fontFamily: 'var(--font-inter)',
                fontWeight: 100,
                letterSpacing: '0.15em',
                transform: 'scaleX(1.2)',
                backgroundImage: hoverSpring.glowIntensity.to((v) =>
                  v > 0.5
                    ? 'linear-gradient(90deg, #22d3ee 0%, #c084fc 25%, #22d3ee 50%, #c084fc 75%, #22d3ee 100%)'
                    : 'linear-gradient(90deg, #06b6d4 0%, #a855f7 25%, #06b6d4 50%, #a855f7 75%, #06b6d4 100%)'
                ),
                backgroundSize: '200% 100%',
                animation: 'flow 16s linear infinite',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: hoverSpring.glowIntensity.to((v) => `brightness(${1 + v * 1.5})`),
                textShadow: hoverSpring.glowIntensity.to((v) => `0 0 ${20 + v * 80}px rgba(0, 255, 255, ${0.2 + v * 0.8}), 0 0 ${40 + v * 160}px rgba(147, 51, 234, ${0.15 + v * 0.85})`),
              }}>
              trevelyen
            </animated.span>
          </span>
        </h1>
      </animated.div>

      {/* Card overlay */}
      {cardTransition((style, item) =>
        item ? (
          <animated.div
            style={{
              opacity: style.opacity,
              transform: to([style.y, style.scale], (y, scale) => `translate(-50%, calc(-50% + ${y}px)) scale(${scale})`),
              willChange: 'opacity, transform',
            }}
            className='absolute top-1/2 left-1/2 z-20 w-[calc(100vw-2rem)] max-w-4xl'>
            <animated.div
              className={`relative bg-black/60 ${isMobile ? 'backdrop-blur-md' : 'backdrop-blur-xl'} border border-white/10 rounded-xl ${isMobile ? 'p-8' : 'p-16'} shadow-2xl overflow-hidden`}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setIsCardHovered(true)}
              onMouseLeave={() => setIsCardHovered(false)}
              style={{
                boxShadow: style.opacity.to((o) => `0 0 ${60 * o}px rgba(6, 182, 212, ${0.15 * o}), 0 0 ${120 * o}px rgba(168, 85, 247, ${0.1 * o})`),
              }}>
              {/* Animated circular border glow */}
              <div className='absolute inset-[-1px] rounded-xl overflow-hidden pointer-events-none'>
                <animated.div
                  className='absolute top-1/2 left-1/2 rounded-full'
                  style={{
                    width: isMobile ? '512px' : '1024px',
                    height: isMobile ? '512px' : '1024px',
                    marginTop: isMobile ? '-256px' : '-512px',
                    marginLeft: isMobile ? '-256px' : '-512px',
                    background:
                      'conic-gradient(from 0deg, transparent 0deg, transparent 90deg, rgba(6, 182, 212, 0) 120deg, rgba(6, 182, 212, 0.8) 180deg, rgba(168, 85, 247, 0.8) 270deg, rgba(6, 182, 212, 0.8) 320deg, rgba(6, 182, 212, 0) 350deg, transparent 360deg)',
                    animation: 'spin 20s linear infinite',
                    filter: cardHoverSpring.glowIntensity.to((v) => `brightness(${1 + v * 0.5})`),
                    willChange: 'transform',
                  }}
                />
              </div>

              {/* Static border overlay to clean edges */}
              <div className='absolute inset-0 rounded-xl border border-white/10 pointer-events-none' />

              {/* Card background layer - covers most of the animated border */}
              <div className='absolute rounded-xl bg-black backdrop-blur-xl' style={{ inset: '0.5px' }} />

              {/* Content */}
              <div className='relative z-10 text-center text-gray-400' style={{ fontFamily: 'var(--font-manrope)', fontWeight: 400 }}>
                <p className='text-lg leading-relaxed'>
                  curiosity. vision. unwavering commitment. relentless iteration.
                  <br />
                  <br />
                  trevelyen is a force for good, injecting meaning in everything we do.
                  <br />
                  <br />
                  <a
                    href="mailto:dan@trevelyen.com"
                    className="text-cyan-200/50 hover:text-cyan-300 text-shadow-initial transition-colors"
                  >
                    connect
                  </a>
                </p>
              </div>
            </animated.div>
          </animated.div>
        ) : null
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
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
