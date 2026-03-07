import { Routes, Route } from 'react-router-dom';
import Login from '../src/pages/Login';
import Signup from '../src/pages/Signup';
import Index from '../src/pages/Index';
import Match from './pages/Match';

const App = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/match" element={<Match />} />

      {/* Fallback */}
      <Route path="*" element={<div>404 Not Found</div>} />
    </Routes>
  );
};

export default App;
