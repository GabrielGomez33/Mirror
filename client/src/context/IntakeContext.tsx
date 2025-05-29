import {createContext, useContext, useState} from 'react'

import type {ReactNode} from 'react'

type IntakeData = {
	photo?: File
	name?: string
	personality?: string
	fears?: string
	voice?: Blob
}

type IntakeContextType = {
	intake: IntakeData
	updateIntake: (data: Partial<IntakeData>) => void
}

const IntakeContext = createContext<IntakeContextType | undefined>(undefined)

export const IntakeProvider = ({children}: {children: ReactNode}) => {
	const [intake, setIntake] = useState<IntakeData>({})

	const updateIntake = (data: Partial<IntakeData>) => {
		setIntake((prev) => ({...prev, ...data}))
	}

	return (
		<IntakeContext.Provider value={{intake, updateIntake}}>
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
