// src/components/intake/SubmitStep.tsx

import {useNavigate} from 'react-router-dom'
import {useIntake} from '../../context/IntakeContext'

const SubmitStep = () => {
	const navigate = useNavigate()
	const {getIntake} = useIntake()

	const handleSubmit = async () => {
		try{
			const formData = new FormData()
			if(getIntake.photo) formData.append('photo', getIntake.photo)
			if(getIntake.voice) formData.append('voice', getIntake.voice)
			if(getIntake.personality) formData.append('personality', getIntake.personality)

			await fetch('mirror/api/submit', {
				method: 'POST',
				body: formData,
			})

			navigate('/results')
		}catch(error){
			console.error('Submission failed', error)
			alert('An error occured. Please try again.')
		}
	}

	return (
		<div className="text-white p-8 text-center space-y-6">
			<h2 className="text-3x1 font-bold">Confirm & Submit</h2>

			<div className="space-y-2">
				{getIntake.photo && (
					<div>
						<p className="text-sm text-gray-300">Photo:</p>
						<img src={URL.createObjectURL(getIntake.photo)} className="w-24 h-24 rounded-full mx-auto"/>
						
					</div>
				)}

				{getIntake.voice && (
					<div>
						<p className="text-sm text-gray-300">Voice Recording:</p>
						<audio controls src={URL.createObjectURL(getIntake.voice)} className="mx-auto" />
					</div>
				)}

				{getIntake.personality && (
					<div>
						<p className="text-sm text-gray-300">Personality: {getIntake.personality}</p>
					</div>
				)}
				
			</div>

			<button onClick={handleSubmit} className="px-6 py-3 bg-white text-black rounded-x1 font-medium shadow-md hover:bg-gray-200 transition">
				Submit My Profile
			</button>
		</div>
	)
}

export default SubmitStep
