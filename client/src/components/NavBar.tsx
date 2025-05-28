// src/components/NavBar.tsx

import React from 'react'

const NavBar = () => {
	return(
        <nav className="w-full py-4 px-6 text-white flex justify-between items-center bg-opacity-10 backdrop-blur-sm border-b border-white/10">
            <h1 className="text-xl font-bold">Mirror</h1>
            <div>
                <a href="#" className="text-sm hover:underline">About</a>
            </div>
        </nav>
	)
}

export default NavBar
