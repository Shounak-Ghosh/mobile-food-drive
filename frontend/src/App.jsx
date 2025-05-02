import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate
} from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LandingPage from "./pages/LandingPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AccountDetails from "./pages/AccountDetails";
import axios from "axios";

function App() {
  useEffect(() => {
    // Set up authorization header
    const token = localStorage.getItem("accessToken");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
    
    // Set up response interceptor for token refresh
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // If error is 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Get refresh token from storage
            const refreshToken = localStorage.getItem("refreshToken");
            
            if (!refreshToken) {
              // No refresh token available, logout
              handleLogout();
              return Promise.reject(error);
            }
            
            // Request new access token
            const response = await axios.post('http://localhost:8000/auth/refresh', {
              refresh_token: refreshToken
            });
            
            // Store new access token
            const { access_token } = response.data;
            localStorage.setItem('accessToken', access_token);
            
            // Update authorization header and retry
            axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
            
            return axios(originalRequest);
          } catch (refreshError) {
            // If refresh fails, redirect to login
            console.error("Token refresh failed:", refreshError);
            handleLogout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
    
    // Clean up interceptor on component unmount
    return () => {
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const handleLogin = (tokens) => {
    // Store both access and refresh tokens
    if (tokens?.access_token) {
      localStorage.setItem("accessToken", tokens.access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${tokens.access_token}`;
    }
    
    if (tokens?.refresh_token) {
      localStorage.setItem("refreshToken", tokens.refresh_token);
    }
    
    // Store user ID if available
    if (tokens?.user_id) {
      localStorage.setItem("userId", tokens.user_id);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    delete axios.defaults.headers.common["Authorization"];
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register onRegister={handleLogin} />} />
        
        {/* Protected Routes - require authentication */}
        <Route
          path="/landing"
          element={
            <ProtectedRoute>
              <LandingPage onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account-details"
          element={
            <ProtectedRoute>
              <AccountDetails onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        
        {/* Catch-all route for any undefined routes */}
        <Route 
          path="*" 
          element={
            <ProtectedRoute>
              <Navigate to="/landing" replace />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
