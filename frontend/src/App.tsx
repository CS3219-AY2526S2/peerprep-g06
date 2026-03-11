import { Routes, Route } from 'react-router-dom';
import Login from '../src/pages/Login';
import Signup from '../src/pages/Signup';
import Index from '../src/pages/Index';
import Match from './pages/Match';
import Account from './pages/Account';
import { ProtectedRoute } from './components/ProtectedRoute';

const App = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected routes */}
      <Route
        path="/match"
        element={
          <ProtectedRoute>
            <Match />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<div>404 Not Found</div>} />
    </Routes>
  );
};

export default App;
