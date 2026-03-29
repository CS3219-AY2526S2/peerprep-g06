import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from '../src/pages/Login';
import Signup from '../src/pages/Signup';
import Index from '../src/pages/Index';
import Match from './pages/Match';
import Queue from './pages/Queue';
import Account from './pages/Account';
import DevPanel from './pages/DevPanel';
import Questions from './pages/Questions';
import Session from './pages/Session';

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
        path="/queue"
        element={
          <ProtectedRoute>
            <Queue />
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

      <Route
        path="/session/:sessionId"
        element={
          <ProtectedRoute>
            <Session />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dev-panel"
        element={
          <ProtectedRoute requiredRole="developer">
            <DevPanel />
          </ProtectedRoute>
        }
      />

      <Route
        path="/questions"
        element={
          <ProtectedRoute>
            <Questions />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<div>404 Not Found</div>} />
    </Routes>
  );
};

export default App;
