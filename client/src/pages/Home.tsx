import {useNavigate} from 'react-router-dom'

import PageWrapper from '../components/PageWrapper'
import Button from '../components/Button'

const Home = () => {
    const navigate = useNavigate()
    return (
    <PageWrapper>
      <div className="text-center space-y-6">
        <h2 className="text-3xl font-bold">Begin Your Reflection</h2>
        <p className="text-gray-300 max-w-md mx-auto">
          Mirror helps you see yourself through the eyes of others.
        </p>
        <Button label="Start Session" onClick={() => navigate('/intake/welcome')} />
      </div>
    </PageWrapper>
  )
}

export default Home
