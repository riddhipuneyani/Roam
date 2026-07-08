import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Plan } from './pages/Plan';
import { Itinerary } from './pages/Itinerary';
import { StyleGuide } from './pages/StyleGuide';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/style-guide" element={<StyleGuide />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/itinerary/:tripId" element={<Itinerary />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
