import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker as GoogleMapMarker, InfoWindow } from '@react-google-maps/api';
import axios from 'axios';
import MarkerForm from './MarkerForm';
import MarkerDetail from './MarkerDetail';

const containerStyle = {
  width: '100%',
  height: '100%',
};

// Define libraries as a static array to avoid performance warnings
const libraries = ['places'];

const Map = ({ center }) => {
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [socket, setSocket] = useState(null);
  const [showAddMarkerForm, setShowAddMarkerForm] = useState(false);
  const [addMarkerPosition, setAddMarkerPosition] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [socketError, setSocketError] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: libraries,
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

  // Function to fetch markers within current map bounds
  const fetchMarkers = useCallback(async () => {
    if (!bounds) return;
    
    try {
      const { data } = await axios.get('/api/markers', {
        params: {
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
        },
      });
      // Ensure data is an array before setting markers
      if (Array.isArray(data)) {
        setMarkers(data);
      } else {
        console.error('Expected array of markers but got:', data);
        setMarkers([]);
      }
    } catch (error) {
      console.error('Error fetching markers:', error);
      setMarkers([]);
    }
  }, [bounds]);

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    if (!isLoaded) return;
    
    let wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${wsProtocol}//${window.location.host}/api/ws/markers`;
    
    console.log('Attempting to connect to WebSocket at:', wsUrl);
    
    const newSocket = new WebSocket(wsUrl);
    
    newSocket.onopen = () => {
      console.log('WebSocket connected');
      setSocketError(false);
    };
    
    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'marker_update') {
          // Update markers based on real-time data
          setMarkers(prevMarkers => {
            // Ensure prevMarkers is an array
            const currentMarkers = Array.isArray(prevMarkers) ? prevMarkers : [];
            const updatedMarkers = [...currentMarkers];
            const index = updatedMarkers.findIndex(m => m.marker_id === data.marker.marker_id);
            
            if (index !== -1) {
              updatedMarkers[index] = data.marker;
            } else if (isMarkerInBounds(data.marker, bounds)) {
              updatedMarkers.push(data.marker);
            }
            
            return updatedMarkers;
          });
        } else if (data.type === 'marker_delete') {
          // Remove deleted marker
          setMarkers(prevMarkers => {
            // Ensure prevMarkers is an array
            const currentMarkers = Array.isArray(prevMarkers) ? prevMarkers : [];
            return currentMarkers.filter(m => m.marker_id !== data.marker_id);
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    newSocket.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setSocketError(true);
    };
    
    setSocket(newSocket);
    
    return () => {
      if (newSocket && newSocket.readyState === WebSocket.OPEN) {
        newSocket.close();
      }
    };
  }, [isLoaded, bounds]);

  // Fetch markers when map bounds change
  useEffect(() => {
    if (bounds) {
      fetchMarkers();
    }
  }, [bounds, fetchMarkers]);

  // Handle map load and bounds changes
  const onMapLoad = useCallback((map) => {
    setMapRef(map);
    try {
      const initialBounds = map.getBounds();
      if (initialBounds) {
        setBounds({
          north: initialBounds.getNorthEast().lat(),
          south: initialBounds.getSouthWest().lat(),
          east: initialBounds.getNorthEast().lng(),
          west: initialBounds.getSouthWest().lng(),
        });
      }
    } catch (error) {
      console.error('Error getting map bounds:', error);
      // Set default bounds based on center
      if (center) {
        setBounds({
          north: center.lat + 0.1,
          south: center.lat - 0.1,
          east: center.lng + 0.1,
          west: center.lng - 0.1,
        });
      }
    }
  }, [center]);

  const onBoundsChanged = useCallback(() => {
    if (!mapRef) return;
    
    try {
      const newBounds = mapRef.getBounds();
      if (newBounds) {
        setBounds({
          north: newBounds.getNorthEast().lat(),
          south: newBounds.getSouthWest().lat(),
          east: newBounds.getNorthEast().lng(),
          west: newBounds.getSouthWest().lng(),
        });
      }
    } catch (error) {
      console.error('Error getting updated map bounds:', error);
    }
  }, [mapRef]);

  // Helper function to check if a marker is within current bounds
  const isMarkerInBounds = (marker, bounds) => {
    if (!bounds) return false;
    if (!marker || typeof marker.latitude !== 'number' || typeof marker.longitude !== 'number') return false;
    
    return (
      marker.latitude <= bounds.north &&
      marker.latitude >= bounds.south &&
      marker.longitude <= bounds.east &&
      marker.longitude >= bounds.west
    );
  };

  // Handle map click for adding new marker
  const handleMapClick = useCallback((event) => {
    if (showAddMarkerForm) return;
    
    try {
      const newPosition = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      
      console.log('Setting marker position:', newPosition);
      setAddMarkerPosition(newPosition);
      setShowAddMarkerForm(true);
    } catch (error) {
      console.error('Error handling map click:', error);
    }
  }, [showAddMarkerForm]);

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
    return <div className="p-4 text-red-500">Error loading Google Maps API: {loadError.message}</div>;
  }

  if (!isLoaded) {
    return <div className="p-4">Loading Google Maps...</div>;
  }

  return (
    <div className="relative w-full h-full">
      {socketError && (
        <div className="absolute top-2 left-2 right-2 z-10 bg-yellow-100 text-yellow-800 p-2 rounded shadow-md">
          Real-time updates unavailable. Refresh the page to try again.
        </div>
      )}
      
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={onMapLoad}
        onBoundsChanged={onBoundsChanged}
        onClick={handleMapClick}
      >
        {Array.isArray(markers) && markers.map(marker => (
          <GoogleMapMarker
            key={marker.marker_id}
            position={{ lat: marker.latitude, lng: marker.longitude }}
            onClick={() => setSelectedMarker(marker)}
          />
        ))}
        
        {selectedMarker && (
          <InfoWindow
            position={{ lat: selectedMarker.latitude, lng: selectedMarker.longitude }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div>
              <MarkerDetail 
                marker={selectedMarker} 
                onClose={() => setSelectedMarker(null)}
              />
            </div>
          </InfoWindow>
        )}
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
      
      {/* User Location Button */}
      {userLocation && (
        <button
          className="absolute bottom-16 right-4 p-2 bg-white text-blue-500 rounded-full shadow-lg hover:bg-gray-100 flex items-center"
          onClick={() => {
            if (mapRef) {
              mapRef.panTo(userLocation);
              mapRef.setZoom(15);
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm">My Location</span>
        </button>
      )}

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
