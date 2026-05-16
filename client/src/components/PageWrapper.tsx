// src/components/PageWrapper.tsx

import React from 'react'
import NavBar from './NavBar'
import Background from './Background' // <- Must exist and be imported

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative min-h-screen text-white font-sans bg-transparent">
      <Background />
      <NavBar />
      {/*
        Phase 7: changed <main> to <div>. The document-level <main>
        landmark lives in App.tsx (id="main-content"); having a second
        one here trips Lighthouse's "single main landmark" rule and
        confuses screen readers.
      */}
      <div className="pt-20 px-6 max-w-4xl mx-auto">
        {children}
      </div>
    </div>
  )
}

export default PageWrapper
