import { useNavigate } from 'react-router-dom'

const WelcomeStep = () => {
  const navigate = useNavigate()

  const handleNext = () => {
    navigate('/intake/visual')
  }

  return (
    <div className="text-white p-8 text-center">
      <h2 className="text-3xl font-bold mb-4">Welcome to Mirror</h2>
      <p className="mb-6 text-gray-300">This is a personal journey. Please answer honestly to gain the most insight.</p>
      <button
        onClick={handleNext}
        className="px-6 py-3 bg-white text-black rounded-md hover:bg-gray-200 transition"
      >
        Begin
      </button>
    </div>
  )
}

export default WelcomeStep
