// src/components/intake/RegistrationStep.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import { registerUser } from '../../services/api';

const RegistrationStep = () => {
  const navigate = useNavigate();
  const { updateIntake } = useIntake();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await registerUser({ username, email, password });

      updateIntake({ userRegistered: true });
      setMessage('✅ Registration successfu!');

      navigate('/intake/submit');
    } catch (err: any) {
      setMessage('❌ ' + err.message);
      console.error('REGISTRATION FAILED: ', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white/10 rounded-xl shadow-md max-w-md mx-auto">
      <h2 className="text-xl font-bold text-white text-center">Create Account</h2>

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full p-2 rounded bg-gray-900 text-white border border-gray-600"
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 rounded bg-gray-900 text-white border border-gray-600"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 rounded bg-gray-900 text-white border border-gray-600"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded w-full disabled:opacity-50"
      >
        {loading ? 'Registering...' : 'Register'}
      </button>

      {message && <p className="text-white text-sm text-center">{message}</p>}
    </form>
  );
};

export default RegistrationStep;
