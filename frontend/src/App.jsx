import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import SendMoney from './pages/SendMoney';
import OTPScreen from './pages/OTPScreen';
import ResultScreen from './pages/ResultScreen';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';

function HistoryPage() {
  return <Profile />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-dark-bg font-inter max-w-[430px] mx-auto relative overflow-x-hidden shadow-2xl">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/home" element={<Home />} />
            <Route path="/send" element={<SendMoney />} />
            <Route path="/otp" element={<OTPScreen />} />
            <Route path="/result" element={<ResultScreen />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
    </BrowserRouter>
  );
}
