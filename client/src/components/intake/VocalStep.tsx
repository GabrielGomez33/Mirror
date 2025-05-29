// src/components/intake/VocalStep.tsx

import {useEffect, useRef, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useIntake} from '../../context/IntakeContext'

const VocalStep = () => {
	const navigate = useNavigate()
	const {updateIntake} = useIntake()

	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const audioChunks = useRef<Blob[]>([])
	const [getRecording, setRecording] = useState<boolean>(false)
	const [getAudioURL, setAudioURL] = useState<string | null>(null)

	useEffect(() => {
		if(!navigator.mediaDevices){
			alert('Audio recording is not supported on this browser :( ')
		}
	}, [])

	const startRecording = async () => {
		try{
			const stream = await navigator.mediaDevices.getUserMedia({audio: true})
			const recorder = new MediaRecorder(stream)
			mediaRecorderRef.current = recorder
			audioChunks.current = []

			recorder.ondataavailable = (e: BlobEvent) => {
				audioChunks.current.push(e.data)
			}

			recorder.onstop = () => {
				const blob = new Blob(audioChunks.current, {type: 'audio/webm'})
				setAudioURL(URL.createObjectURL(blob))
				updateIntake({voice: blob})
			}

			recorder.start()
			setRecording(true)
			
		} catch(err){
			console.error('Error accessing microphone:', err)
			alert('Could not start recording')	
		}
	}

	const stopRecording = () => {
		mediaRecorderRef.current?.stop()
		setRecording(false)
	}

	const handleNext = () => {
		navigate('/intake/personality')
	}

	return(
		<div className="text-white p-8 text-center">
			<h2 className="text-3x1 font-bold mb-4">Your Voice</h2>
			<p className="mb-6 text-gray-300">Please Record yourself reading this prompt out loud: </p>
			<blockquote>
				"The sun rose behind the hills, and with it, a new version of me"
			</blockquote>

			{!getRecording ? (
				<button onClick={startRecording} className="px-6 py-3 bg-white text-black rounded-md hover:bg-gray-200 transition">
					Start Recording
				</button>
			): (
			    <button onClick={stopRecording} className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition">
				    Stop Recording
			    </button>	
			)}

			{getAudioURL && (
				<div className="mt-6">
					<p className="mb-2">Preview your recording:</p>
					<audio controls src={getAudioURL} className="mx-auto"/>
				</div>
			)}

			<div className="mt-8">
				<button onClick={handleNext} className="px-6 py-3 bg-white text-black rounded-md hover:bg-gray-200 transition">
					Continue
				</button>
			</div>
			
		</div>
	)
	
}

export default VocalStep
