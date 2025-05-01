import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import MarkerForm from "./MarkerForm";
import MarkerDetail from "./MarkerDetail";
import debounce from "lodash/debounce";
import { useNotifications } from "../contexts/NotificationsContext";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const Map = forwardRef(({ center, selectedTags = [], foodSearchQuery = '' }, ref) => {
  const [markers, setMarkers] = useState([]);
  const [filteredMarkers, setFilteredMarkers] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [showAddMarkerForm, setShowAddMarkerForm] = useState(false);
  const [addMarkerPosition, setAddMarkerPosition] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [wsConnection, setWsConnection] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const { addNotification } = useNotifications();

  // Get current user ID on mount
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      setCurrentUserId(userId);
      console.log('Map: Current user ID:', userId);
    }
  }, []);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!wsConnection && token) {
      console.log('Map: Initializing WebSocket connection');
      
      // Add a delay before reconnecting to prevent rapid connection attempts
      const connectWebSocket = () => {
        try {
          // Check if the backend server is accessible before attempting WebSocket connection
          fetch('http://localhost:8000/markers?north=90&south=-90&east=180&west=-180')
            .then(() => {
              // Server is accessible, proceed with WebSocket connection
              const ws = new WebSocket('ws://localhost:8000/markers/ws');
              let pingInterval = null;
              let isClosing = false; // Flag to track if the connection is intentionally closing
              
              ws.onopen = () => {
                console.log('Map: WebSocket connected successfully');
                setWsConnection(ws);
                setWsConnected(true);
                
                // Send authentication immediately after connection
                try {
                  ws.send(JSON.stringify({
                    type: 'auth',
                    token
                  }));
                  console.log('Map: Authentication sent to WebSocket');
                  
                  // Set up a ping every 30 seconds to keep the connection alive
                  pingInterval = setInterval(() => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                      try {
                        ws.send(JSON.stringify({ type: 'ping' }));
                        console.log('Map: Ping sent');
                      } catch (pingError) {
                        console.error('Map: Error sending ping:', pingError);
                        clearInterval(pingInterval);
                      }
                    } else {
                      console.warn('Map: Cannot send ping, connection not open');
                      clearInterval(pingInterval);
                    }
                  }, 30000);
                } catch (authError) {
                  console.error('Map: Error sending authentication to WebSocket:', authError);
                }
              };
              
              ws.onerror = (error) => {
                console.error('Map: WebSocket error:', error);
                setWsConnected(false);
                // Don't set wsConnection to null here to prevent reconnection loops
              };
              
              ws.onmessage = (event) => {
                try {
                  const data = JSON.parse(event.data);
                  console.log('Map: Received WebSocket message:', data.type);
                  
                  if (data.type === 'auth_success') {
                    console.log('Map: WebSocket authenticated successfully');
                  } else if (data.type === 'auth_error') {
                    console.error('Map: WebSocket authentication error:', data.message);
                  } else if (data.type === 'marker_update') {
                    console.log('Map: Received marker update:', data.marker.marker_id);
                    const updatedMarker = data.marker;
                    
                    // If the marker is picked up or expired, remove it from the map
                    if (updatedMarker.status === 'picked_up' || updatedMarker.status === 'expired') {
                      setMarkers(prevMarkers => 
                        prevMarkers.filter(m => m.marker_id !== updatedMarker.marker_id)
                      );
                      
                      // If this was the selected marker, close the detail view
                      if (selectedMarker && selectedMarker.marker_id === updatedMarker.marker_id) {
                        setSelectedMarker(null);
                        
                        // If it was expired due to time limit, add an explanatory notification
                        if (updatedMarker.status === 'expired') {
                          addNotification({
                            message: `The ${updatedMarker.food_type} donation has expired and is no longer available.`,
                            severity: 'info'
                          });
                        }
                      }
                    } else {
                      // Update the marker if it's already in our list
                      setMarkers(prevMarkers => {
                        const index = prevMarkers.findIndex(m => m.marker_id === updatedMarker.marker_id);
                        if (index >= 0) {
                          console.log('Map: Updating existing marker:', updatedMarker.marker_id);
                          const newMarkers = [...prevMarkers];
                          newMarkers[index] = updatedMarker;
                          
                          // If this was the selected marker, update it as well
                          if (selectedMarker && selectedMarker.marker_id === updatedMarker.marker_id) {
                            console.log('Map: Updating selected marker with WebSocket data');
                            setSelectedMarker(updatedMarker);
                          }
                          
                          return newMarkers;
                        }
                        // If it's a new marker and it's available or reserved, add it to the map
                        if (updatedMarker.status === 'available' || updatedMarker.status === 'reserved') {
                          console.log('Map: Adding new marker from WebSocket:', updatedMarker.marker_id);
                          return [...prevMarkers, updatedMarker];
                        }
                        return prevMarkers;
                      });
                    }
                  } else if (data.type === 'notification' && data.notificationType === 'marker_expired') {
                    // Handle marker expiration notifications by refreshing markers
                    console.log('Map: Received marker expiration notification, refreshing markers');
                    fetchMarkersInView();
                  }
                } catch (parseError) {
                  console.error('Map: Error parsing WebSocket message:', parseError, event.data);
                }
              };
              
              ws.onclose = (event) => {
                console.log(`Map: WebSocket disconnected with code ${event.code}, reason: ${event.reason}`);
                setWsConnected(false);
                setWsConnection(null);
                
                // Clear ping interval
                if (pingInterval) {
                  clearInterval(pingInterval);
                  pingInterval = null;
                }
                
                // Try to reconnect after a delay if connection wasn't closed intentionally
                // and the user is still logged in
                if (!isClosing && event.code !== 1000 && event.code !== 1001 && localStorage.getItem('accessToken')) {
                  console.log('Map: Scheduling WebSocket reconnection');
                  // Use progressive backoff for reconnection
                  setTimeout(() => {
                    setWsConnection(null);
                  }, 5000); // 5 seconds delay for reconnection
                }
              };
              
              // Safe close method that won't throw if already closing/closed
              const safeClose = (code = 1000, reason = 'Cleanup') => {
                if (!isClosing && ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                  try {
                    isClosing = true;
                    ws.close(code, reason);
                  } catch (error) {
                    console.error('Map: Error closing WebSocket connection:', error);
                  }
                }
              };
              
              return safeClose; // Return the safe close function
            })
            .catch(error => {
              console.error('Map: Backend server is not accessible, delaying WebSocket connection:', error);
              setTimeout(() => setWsConnection(null), 10000); // Try again in 10 seconds
            });
        } catch (connectionError) {
          console.error('Map: Error establishing WebSocket connection:', connectionError);
          // Schedule retry with longer delay
          setTimeout(() => {
            setWsConnection(null);
          }, 10000); // 10 seconds delay
          return null;
        }
      };
      
      const closeFunc = connectWebSocket();
      
      return () => {
        // Use the safe close function if available
        if (typeof closeFunc === 'function') {
          closeFunc(1000, 'Component unmounted');
        }
      };
    }
  }, [wsConnection, selectedMarker]);

  // Function to check if a marker should be visible to the current user
  const shouldShowMarker = useCallback((marker) => {
    // Always show available markers
    if (marker.status === 'available') {
      return true;
    }
    
    // If marker is reserved, only show if:
    // - Current user is the donator (creator of the marker)
    // - Current user is the one who reserved it
    if (marker.status === 'reserved') {
      return marker.user_id === currentUserId || marker.receiver_user_id === currentUserId;
    }
    
    // For other statuses (picked_up, expired), hide the marker
    return false;
  }, [currentUserId]);

  // Filter markers based on tags, search query, and reservation status
  useEffect(() => {
    let filtered = [...markers];
    
    // First, filter by visibility status (hide reserved markers not belonging to current user)
    filtered = filtered.filter(shouldShowMarker);
    
    // Filter by food search query if provided
    if (foodSearchQuery && foodSearchQuery.trim() !== '') {
      const query = foodSearchQuery.toLowerCase().trim();
      console.log(`Filtering by search query: "${query}"`);
      filtered = filtered.filter(marker => {
        const foodTypeMatch = marker.food_type && marker.food_type.toLowerCase().includes(query);
        const descriptionMatch = marker.description && marker.description.toLowerCase().includes(query);
        return foodTypeMatch || descriptionMatch;
      });
      console.log(`Found ${filtered.length} markers matching search query`);
    }
    
    // Filter by tags if any are selected
    if (selectedTags.length > 0) {
      console.log(`Filtering by tags: ${selectedTags.join(', ')}`);
      filtered = filtered.filter(marker => {
        // Check if marker has dietary tags
        if (!marker.dietary_tags || !Array.isArray(marker.dietary_tags)) {
          return false;
        }
        
        // Convert dietary tags to lowercase for case-insensitive comparison
        const markerTags = marker.dietary_tags.map(tag => tag.toLowerCase());
        
        // Check if all selected tags are present in the marker's tags
        return selectedTags.every(tag => 
          markerTags.includes(tag.toLowerCase())
        );
      });
      console.log(`Found ${filtered.length} markers matching selected tags`);
    }
    
    console.log(`Total filtered markers: ${filtered.length} (from ${markers.length} total)`);
    setFilteredMarkers(filtered);
  }, [markers, selectedTags, foodSearchQuery, shouldShowMarker]);

  const fetchMarkersInView = useCallback(
    debounce(() => {
      if (mapRef) {
        const bounds = mapRef.getBounds();
        if (!bounds) return;

        const north = bounds.getNorthEast().lat();
        const east = bounds.getNorthEast().lng();
        const south = bounds.getSouthWest().lat();
        const west = bounds.getSouthWest().lng();

        // Include tags in the query if they are selected
        const tagsParam = selectedTags.length > 0 ? `&tags=${selectedTags.join(',')}` : '';
        const url = `http://localhost:8000/markers?north=${north}&south=${south}&east=${east}&west=${west}${tagsParam}`;

        fetch(url)
          .then((res) => res.json())
          .then((data) => {
            console.log("Fetched markers:", data);
            // Include all markers - we'll filter out which ones to show in the useEffect
            setMarkers(data);
          })
          .catch((err) => console.error("Error fetching markers:", err));
      }
    }, 300), // 300ms delay
    [mapRef, selectedTags]
  );

  // Expose functions to parent components
  useImperativeHandle(ref, () => ({
    refreshMarkers: () => {
      fetchMarkersInView();
    },
    searchFood: (query) => {
      // If this is ever called directly, use it to filter markers
      console.log("Map: searchFood called with query:", query);
      if (query && query.trim() !== '') {
        const searchText = query.toLowerCase().trim();
        // Filter markers by the search text and visibility
        const filtered = markers
          .filter(shouldShowMarker)
          .filter(marker => {
            const foodTypeMatch = marker.food_type && marker.food_type.toLowerCase().includes(searchText);
            const descriptionMatch = marker.description && marker.description.toLowerCase().includes(searchText);
            return foodTypeMatch || descriptionMatch;
          });
        setFilteredMarkers(filtered);
      } else {
        // If query is empty, apply visibility filter and any dietary filters
        const filtered = markers.filter(shouldShowMarker);
        
        if (selectedTags.length > 0) {
          const tagFiltered = filtered.filter(marker => {
            if (!marker.dietary_tags || !Array.isArray(marker.dietary_tags)) {
              return false;
            }
            const markerTags = marker.dietary_tags.map(tag => tag.toLowerCase());
            return selectedTags.every(tag => markerTags.includes(tag.toLowerCase()));
          });
          setFilteredMarkers(tagFiltered);
        } else {
          // No search query and no tags, show all visible markers
          setFilteredMarkers(filtered);
        }
      }
    }
  }));

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => console.error("Error getting user location:", error)
    );
    
    // Clean up window.map reference when component unmounts
    return () => {
      if (window.map) {
        window.map = null;
      }
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      const stored = localStorage.getItem("mapCenter");
      if (stored && mapRef) {
        const center = JSON.parse(stored);
        mapRef.panTo(center);
        mapRef.setZoom(15);
      }
    };

    window.addEventListener("centerChanged", handler);
    return () => window.removeEventListener("centerChanged", handler);
  }, [mapRef]);

  // Update the selected marker when markers array changes
  useEffect(() => {
    if (selectedMarker) {
      // Find the updated version of the selected marker in the markers array
      const updatedMarker = markers.find(m => m.marker_id === selectedMarker.marker_id);
      
      if (updatedMarker) {
        console.log('Map: Updating selected marker from markers array:', updatedMarker);
        // Only update if there's a real change to avoid unnecessary re-renders
        if (JSON.stringify(updatedMarker) !== JSON.stringify(selectedMarker)) {
          setSelectedMarker(updatedMarker);
        }
      } else {
        // If marker is no longer in the array (e.g., it was picked up or expired)
        console.log('Map: Selected marker is no longer available, closing detail view');
        setSelectedMarker(null);
      }
    }
  }, [markers, selectedMarker]);

  // Handle marker click
  const handleMarkerClick = useCallback((marker) => {
    console.log("Marker clicked:", marker);
    
    // Immediately show the marker with data we already have
    setSelectedMarker(marker);
    
    // Then fetch the latest marker data directly from the server
    const fetchLatestMarkerData = async () => {
      try {
        const response = await fetch(`http://localhost:8000/markers/${marker.marker_id}`);
        if (response.ok) {
          const updatedMarker = await response.json();
          console.log("Map: Fetched fresh marker data:", updatedMarker);
          
          // Only update if there's a significant change to avoid unnecessary re-renders
          const currentSelected = markers.find(m => m.marker_id === marker.marker_id) || marker;
          if (updatedMarker.status !== currentSelected.status || 
              updatedMarker.receiver_user_id !== currentSelected.receiver_user_id) {
            setSelectedMarker(updatedMarker);
          }
        }
      } catch (error) {
        console.error("Error fetching updated marker:", error);
        // We already set the marker above, so no need to do anything here
      }
    };
    
    fetchLatestMarkerData();
  }, [markers]);

  // Test WebSocket connection periodically
  useEffect(() => {
    if (wsConnection) {
      // Test if the connection is still alive
      const testConnection = () => {
        if (wsConnection.readyState !== WebSocket.OPEN) {
          console.log("Map: WebSocket not open, reconnecting...");
          setWsConnection(null); // This will trigger reconnection
          setWsConnected(false);
        }
      };
      
      // Test connection every 30 seconds
      const intervalId = setInterval(testConnection, 30000);
      
      return () => clearInterval(intervalId);
    }
  }, [wsConnection]);

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={(map) => {
          setMapRef(map);
          // Make map available globally for the Header component
          window.map = map;
        }}
        onIdle={fetchMarkersInView}
        options={{
          gestureHandling: "greedy",
          disableDefaultUI: true,
          styles: [
            {
              featureType: "all",
              elementType: "geometry",
              stylers: [{ color: "#ebe3cd" }]
            },
            {
              featureType: "all",
              elementType: "labels.text.fill",
              stylers: [{ color: "#523735" }]
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#d5cba7" }]
            },
            {
              featureType: "road.highway",
              elementType: "geometry",
              stylers: [{ color: "#c2b88f" }]
            },
            {
              featureType: "road.arterial",
              elementType: "geometry",
              stylers: [{ color: "#cec594" }]
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#5c5035" }]
            },
            {
              featureType: "water",
              elementType: "geometry.fill",
              stylers: [{ color: "#b9d3c2" }]
            },
            {
              featureType: "poi.park",
              elementType: "geometry.fill",
              stylers: [{ color: "#22311d" }, { lightness: 60 }]
            }
          ]
        }}
      >
        {filteredMarkers.map((marker, index) => (
          <Marker
            key={marker.marker_id || index}
            position={{
              lat: marker.latitude,
              lng: marker.longitude,
            }}
            onClick={() => handleMarkerClick(marker)}
            icon={{
              url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path fill="none" stroke="#fc5e03" stroke-width="2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5" fill="#fc5e03"/>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(35, 40),
              anchor: new window.google.maps.Point(20, 40),
            }}
          />
        ))}
      </GoogleMap>

      {selectedMarker && (
        <div className="absolute bottom-4 left-4 z-10">
          <MarkerDetail
            marker={selectedMarker}
            onClose={() => setSelectedMarker(null)}
            onReserve={upd => {
              console.log("Map: Marker was reserved, updating selected marker:", upd);
              setSelectedMarker(upd);
              
              // Also refresh the markers list to show updated data everywhere
              fetchMarkersInView();
            }}
          />
        </div>
      )}

      <button
        className="absolute bottom-4 right-4 p-3 text-white rounded-full shadow-lg hover:opacity-90"
        onClick={() => {
          // Get the current center of the map as the initial position
          const initialPosition = mapRef?.getCenter()?.toJSON() || center;
          setAddMarkerPosition(initialPosition);
          setShowAddMarkerForm(true);
        }}
        style={{ backgroundColor: '#5a3812', color: 'white' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {showAddMarkerForm && addMarkerPosition && (
        <MarkerForm
          position={addMarkerPosition}
          onMarkerAdded={(m) => {
            setMarkers((prev) => [...prev, m]);
            // If the marker was added successfully, close the form
            setShowAddMarkerForm(false);
          }}
          onClose={() => setShowAddMarkerForm(false)}
        />
      )}
    </div>
  );
});

export default Map;
