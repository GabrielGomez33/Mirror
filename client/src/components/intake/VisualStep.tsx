import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIntake } from '../../context/IntakeContext'

const VisualStep = () => {
  const navigate = useNavigate()
  const { updateIntake } = useIntake()

  const [getPreview, setPreview] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    updateIntake({ photo: file })

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }

    reader.readAsDataURL(file) // 🔧 Fixed typo: DataUrl → DataURL
  }

  const handleNext = () => {
    navigate('/intake/vocal')
  }

  return (
    <div className="text-white p-8 text-center">
      <h2 className="text-3xl font-bold mb-4">Your Visual Identity</h2>
      <p className="mb-6 text-gray-300">
        Upload a recent photo or avatar. This helps reviewers understand your presence.
      </p>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="mb-4 block mx-auto"
      />

      {getPreview && (
        <img
          src={getPreview}
          alt="Preview"
          className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border border-white"
        />
      )}

      <button
        onClick={handleNext}
        className="px-6 py-3 bg-white text-black rounded-md hover:bg-gray-200 transition"
      >
        Continue
      </button>
    </div>
  )
}

export default VisualStep
