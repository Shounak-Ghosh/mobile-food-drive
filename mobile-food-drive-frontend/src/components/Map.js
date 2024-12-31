import React from 'react';
import { GoogleMap, LoadScript } from '@react-google-maps/api';

const Map = ({ center }) => {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY; // Environment variable for API key

  if (!apiKey) {
    console.error('Google Maps API key is missing. Set REACT_APP_GOOGLE_MAPS_API_KEY in your .env file.');
    return <div>Google Maps API key is missing. Please configure it.</div>;
  }

  return (
    <LoadScript googleMapsApiKey={apiKey}>
      <GoogleMap
        mapContainerStyle={{
          width: '100%',
          height: '100%', // Allow the map to fill its container
        }}
        center={center}
        zoom={12}
      >
        {/* Additional map elements can be added here */}
      </GoogleMap>
    </LoadScript>
  );
};

export default Map;
