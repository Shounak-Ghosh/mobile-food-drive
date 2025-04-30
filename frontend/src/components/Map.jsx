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
  const [searchQuery, setSearchQuery] = useState('');
  const { addNotification } = useNotifications();

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/markers/ws');
    
    ws.onopen = () => {
      console.log('Map WebSocket connected');
      setWsConnection(ws);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'marker_update') {
        const updatedMarker = data.marker;
        
        // If the marker is picked up or expired, remove it from the map
        if (updatedMarker.status === 'picked_up' || updatedMarker.status === 'expired') {
          setMarkers(prevMarkers => 
            prevMarkers.filter(m => m.marker_id !== updatedMarker.marker_id)
          );
          
          // If this was the selected marker, close the detail view
          if (selectedMarker && selectedMarker.marker_id === updatedMarker.marker_id) {
            setSelectedMarker(null);
          }
        } else {
          // Update the marker if it's already in our list
          setMarkers(prevMarkers => {
            const index = prevMarkers.findIndex(m => m.marker_id === updatedMarker.marker_id);
            if (index >= 0) {
              const newMarkers = [...prevMarkers];
              newMarkers[index] = updatedMarker;
              return newMarkers;
            }
            // If it's a new marker and it's available or reserved, add it to the map
            if (updatedMarker.status === 'available' || updatedMarker.status === 'reserved') {
              return [...prevMarkers, updatedMarker];
            }
            return prevMarkers;
          });
        }
      }
    };
    
    ws.onclose = () => {
      console.log('Map WebSocket disconnected');
      // Try to reconnect after a delay
      setTimeout(() => {
        setWsConnection(null);
      }, 5000);
    };
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [selectedMarker]);

  // Filter markers based on tags and search query
  useEffect(() => {
    let filtered = [...markers];
    
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
  }, [markers, selectedTags, foodSearchQuery]);

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
            // Only keep markers that are available or reserved
            const visibleMarkers = data.filter(marker => 
              marker.status === 'available' || marker.status === 'reserved'
            );
            setMarkers(visibleMarkers);
          })
          .catch((err) => console.error("Error fetching markers:", err));
      }
    }, 300), // 300ms delay
    [mapRef, selectedTags]
  );

  // Function to search for food by name or description
  const searchFood = (query) => {
    console.log("Searching for food:", query);
    
    if (query.trim() === '') {
      // If search is cleared, reset to show all available markers
      setSearchQuery('');
      // Explicitly show all markers in the current view without filtering
      fetchMarkersInView();
      
      if (searchQuery) { // Only notify if there was a previous search
        addNotification('Showing all available food', 'info', null);
      }
    } else {
      // Set search query for filtering
      setSearchQuery(query);
    }
  };

  // Update filtered markers based on search query and dietary preferences
  useEffect(() => {
    if (searchQuery === '' && markers.length > 0) {
      // If search is empty, show all markers (with dietary filters still applied)
      setFilteredMarkers(
        selectedTags.length > 0 
          ? markers.filter(marker => {
              if (!marker.dietary_tags || marker.dietary_tags.length === 0) return false;
              return selectedTags.every(tag => 
                marker.dietary_tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
              );
            })
          : markers
      );
    } else {
      // Otherwise apply normal filtering
      updateFilteredMarkers();
    }
  }, [searchQuery, selectedTags, markers]);

  const updateFilteredMarkers = () => {
    let filtered = [...markers];
    
    // Apply search query filter if exists
    if (searchQuery && searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(marker => 
        (marker.food_type && marker.food_type.toLowerCase().includes(query)) || 
        (marker.description && marker.description.toLowerCase().includes(query))
      );
      console.log(`Found ${filtered.length} markers matching search "${query}"`);
      
      // Only show notifications when we have a significant change in results
      // and not for every keystroke in real-time search
      if (!filtered.length && markers.length > 0) {
        addNotification(`No food drops found matching "${searchQuery}"`, 'warning', null);
      }
    }
    
    // Apply dietary tag filters if any are selected
    if (selectedTags && selectedTags.length > 0) {
      filtered = filtered.filter(marker => {
        if (!marker.dietary_tags || marker.dietary_tags.length === 0) return false;
        // Check if marker has ALL selected dietary tags
        return selectedTags.every(tag => 
          marker.dietary_tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
        );
      });
      console.log(`Found ${filtered.length} markers matching selected dietary tags`);
    }
    
    // Set the filtered markers state
    setFilteredMarkers(filtered);
  };

  // Expose functions to parent components
  useImperativeHandle(ref, () => ({
    refreshMarkers: () => {
      // Only call fetchMarkersInView if there's no active search query
      if (!searchQuery || searchQuery.trim() === '') {
        fetchMarkersInView();
      }
    },
    searchFood: searchFood
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
  }, []);

  useEffect(() => {
    const handler = () => {
      const stored = localStorage.getItem("mapCenter");
      if (stored && mapRef) {
        const center = JSON.parse(stored);
        mapRef.panTo(center);
        mapRef.setZoom(14);
      }
    };

    window.addEventListener("centerChanged", handler);
    return () => window.removeEventListener("centerChanged", handler);
  }, [mapRef]);

  // Update the selected marker if it gets updated via WebSocket
  useEffect(() => {
    if (selectedMarker) {
      const updatedMarker = markers.find(m => m.marker_id === selectedMarker.marker_id);
      if (updatedMarker) {
        setSelectedMarker(updatedMarker);
      }
    }
  }, [markers, selectedMarker]);

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={setMapRef}
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
            onClick={() => {
              console.log("Marker clicked:", marker);
              setSelectedMarker(marker);
            }}
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
            onReserve={upd => setSelectedMarker(upd)}
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
