import { Toaster } from "@/components/ui/toaster"
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import AdminDashboard from '@/pages/admin/AdminDashboard.jsx';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/signup" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/verify" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
