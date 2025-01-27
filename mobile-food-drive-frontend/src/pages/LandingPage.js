import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Map from '../components/Map';
import Notification from '../components/Notification';

const LandingPage = () => {
  const [center, setCenter] = useState({ lat: 0, lng: 0 });
  const [logoutMessage, setLogoutMessage] = useState(false);
  const navigate = useNavigate(); 

  const handleLogout = () => {
    console.log('Logout clicked');
    localStorage.removeItem('authToken');
    
     // Redirect to login page and pass state for the logout notification
     navigate('/login', { state: { message: 'Successfully logged out', severity: 'success' } });
  };

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Error fetching location:', error);
      }
    );
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ flex: '0 0 auto' }}>
        <Header onLogout={handleLogout} />
      </div>

      <Notification
        open={logoutMessage}
        onClose={() => setLogoutMessage(false)}
        message="Successfully logged out"
      />

      {/* Map */}
      <div style={{ flex: '1 1 auto', overflow: 'hidden' }}>
        <Map center={center} />
      </div>
    </div>
  );
};

export default LandingPage;
