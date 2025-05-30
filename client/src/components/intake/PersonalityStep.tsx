// src/components/intake/PersonalityStep.tsx

import {useNavigate} from 'react-router-dom'
import {useIntake} from '../../context/IntakeContext'

const PersonalityStep = () => {
	const navigate = useNavigate()
	const {updateIntake} = useIntake()

	const handleNext = () => {
		updateIntake({personality: 'placeholder'})
		navigate('/intake/submit')
	}

	return(
		<div className="text-white p-8 text-center">
			<h2 className="text-3x1 font-bold mb-4">Your Personality</h2>
			<p>We will ask a few questions to better understand your inner self.</p>
			{/*TODO: Add form or interface here */}

			<button onClick={handleNext} className="mt-6 px-6 py-3 bg-white text-black rounded-x1 font-medium shadow-md hover:bg-gray-200 transition">
				Continue
			</button>
		</div>
	)
}

export default PersonalityStep
