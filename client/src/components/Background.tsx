// src/components/Background.tsx

const Background = () => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        background: 'linear-gradient(to bottom, #0000, #111111, #000000)',
        opacity: 0.9
      }}
    />
  )
}

export default Background
