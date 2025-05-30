// src/components/intake/SubmitStep.tsx

import{useIntake} from '../../context/IntakeContext'

const SubmitStep = () => {
	const {getIntake} = useIntake()

	const handleSubmit = () => {
		console.log('Submitting intake data:', getIntake)
		alert('Submitting data')
		
	}

	return(
		<div className="text-white p-8 text-center">
			<h2 className="text-3x1 font-bold mb-4">Submit Your Reflection</h2>
			<p className="mb-6">Thank you for your honesty. This helps others understand you.</p>
			<button onClick={handleSubmit} className="px-6 py-3 bg-green-500 text-white rounded-x1 font-medium shadow-md hover:bg-green-600 transition">
				Submit
			</button>
		</div>
	)
}

export default SubmitStep
