'use client'

import { animated, SpringValue } from '@react-spring/web'

interface CircleGlowProps {
  glowIntensity: SpringValue<number>
}

export default function CircleGlow({ glowIntensity }: CircleGlowProps) {
  return (
    <div className='absolute inset-[-1px] rounded-xl overflow-hidden pointer-events-none'>
      <animated.video
        className='absolute top-1/2 left-1/2'
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: '1500px',
          height: '1580px',
          marginTop: '-790px',
          marginLeft: '-450px',
          filter: glowIntensity.to((v) => `brightness(${1 + v * 0.5})`),
          objectFit: 'cover',
        }}>
        <source
          src='/circleGlow.mp4'
          type='video/mp4'
        />
      </animated.video>
    </div>
  )
}
