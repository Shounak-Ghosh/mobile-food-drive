import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { CircularProgress } from '@mui/material';

const ProtectedRoute = ({ children }) => {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem("accessToken");
      
      if (!token) {
        setIsAuthenticated(false);
        setIsVerifying(false);
        return;
      }
      
      try {
        // Set the token in headers
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        
        // Verify the token by making a request to the auth/me endpoint
        await axios.get('http://localhost:8000/auth/me');
        
        // If the request is successful, the token is valid
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Token verification failed:", error);
        
        // Clear invalid tokens
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userId");
        delete axios.defaults.headers.common["Authorization"];
        
        setIsAuthenticated(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, []);

  if (isVerifying) {
    // Show loading spinner while verifying token
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#E1D9D1'
      }}>
        <CircularProgress style={{ color: '#5a3812' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login with state indicating where user was trying to go
    return (
      <Navigate 
        to="/login" 
        state={{ 
          from: location.pathname,
          message: "Please log in to access this page",
          severity: "warning"
        }} 
        replace 
      />
    );
  }

  return children;
};

export default ProtectedRoute;
