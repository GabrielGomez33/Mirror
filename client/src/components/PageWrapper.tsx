// src/components/PageWrapper.tsx

import React from 'react'
import NavBar from './NavBar'
import Background from './Background' // <- Must exist and be imported

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative min-h-screen text-white font-sans bg-transparent">
      <Background />
      <NavBar />
      <main className="pt-20 px-6 max-w-4xl mx-auto">
        {children}
      </main>
    </div>
  )
}

export default PageWrapper
