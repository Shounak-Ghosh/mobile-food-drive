import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Map from '../components/Map';

const LandingPage = () => {
  const [center, setCenter] = useState({ lat: 0, lng: 0 });

  const handleLogout = () => {
    console.log('Logged out');
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

      {/* Map */}
      <div style={{ flex: '1 1 auto', overflow: 'hidden' }}>
        <Map center={center} />
      </div>
    </div>
  );
};

export default LandingPage;
