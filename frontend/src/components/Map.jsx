import {React, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import MarkerForm from './MarkerForm';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const Map = ({ center }) => {
  const [markers, setMarkers] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [showAddMarkerForm, setShowAddMarkerForm] = useState(false);
  const [addMarkerPosition, setAddMarkerPosition] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, // API key from .env
  });

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('Got user location:', userPos);
          setUserLocation(userPos);
        },
        (error) => {
          console.error('Error getting user location:', error);
        }
      );
    }
  }, []);

  // Handle new marker added
  const handleMarkerAdded = (newMarker) => {
    setMarkers(prevMarkers => {
      // Ensure prevMarkers is an array
      const currentMarkers = Array.isArray(prevMarkers) ? prevMarkers : [];
      return [...currentMarkers, newMarker];
    });
    setShowAddMarkerForm(false);
    setAddMarkerPosition(null);
  };

  if (loadError) {
    return <div>Error loading Google Maps API</div>;
  }

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="relative w-full h-full">
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={12}
      options={{
        mapTypeControl: true,    // Removes map/satellite switcher
        gestureHandling: "greedy", // apparently? improves touch UX on mobile
        disableDefaultUI: true  
      }}
    >
    </GoogleMap>
    {/* Add Marker Button */}
    <button
        className="absolute bottom-4 right-4 p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600"
        onClick={() => {
          // Use the current map center if no position is set
          const newPosition = mapRef ? mapRef.getCenter().toJSON() : center;
          console.log('Setting marker position from button:', newPosition);
          setAddMarkerPosition(newPosition);
          setShowAddMarkerForm(true);
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
      
      {/* Marker Form Modal */}
      {showAddMarkerForm && addMarkerPosition && (
        <MarkerForm
          onClose={() => {
            setShowAddMarkerForm(false);
            setAddMarkerPosition(null);
          }}
          position={addMarkerPosition}
          onMarkerAdded={handleMarkerAdded}
        />
      )}
    </div>
  );
};

export default Map;
