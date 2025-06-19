// src/context/IntakeContext.tsx

import {createContext, useContext, useState} from 'react'

import type {ReactNode} from 'react'

type IntakeData = {
	photo?: File
	faceAnalysis?: any
	name?: string
	personality?: string
	fears?: string
	voice?: Blob
	voicePrompt?: string
	voiceDuration?: number
	voiceMetadata?: object
	userRegistered?: boolean
	userLoggedIn?: boolean
}

type IntakeContextType = {
	getIntake: IntakeData
	updateIntake: (data: Partial<IntakeData>) => void
}

const IntakeContext = createContext<IntakeContextType | undefined>(undefined)

export const IntakeProvider = ({children}: {children: ReactNode}) => {
	const [getIntake, setIntake] = useState<IntakeData>({})

	const updateIntake = (data: Partial<IntakeData>) => {
		setIntake((prev) => ({...prev, ...data}))
	}

	return (
		<IntakeContext.Provider value={{getIntake, updateIntake}}>
			{children}
		</IntakeContext.Provider>
	)
}

export const useIntake = () => {
	const context = useContext(IntakeContext)
	if(!context){
		throw new Error('useIntake must be used within IntakeProvider')
	}
	return context
}
