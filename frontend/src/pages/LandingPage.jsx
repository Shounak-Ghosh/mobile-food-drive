import { useState, useEffect, useRef } from "react";
import Header from "../components/Header";
import { useJsApiLoader } from "@react-google-maps/api";
import Map from "../components/Map";
import { useNotifications } from "../contexts/NotificationsContext";
import axios from "axios";

// Move libraries outside component to prevent unnecessary reloads
const libraries = ['places', 'marker'];

const LandingPage = () => {
  const [center, setCenter] = useState({ lat: 0, lng: 0 });
  const [selectedTags, setSelectedTags] = useState([]);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const mapRef = useRef(null);
  const { addNotification } = useNotifications();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const handleLogout = () => {
    console.log("Logout clicked");
    // Clear all authentication and user data from localStorage
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    
    // Clear auth headers
    delete axios.defaults.headers.common["Authorization"];
    
    // For additional security
    sessionStorage.clear();

    // Redirect to login page and pass state for the logout notification
    // Using window.location ensures a complete page refresh which is more reliable
    window.location.href = "/login?message=Successfully logged out";
  };

  const handleTagsChange = (tags) => {
    console.log("Tags changed:", tags);
    setSelectedTags(tags);
    
    // Send notification about filter
    if (tags.length > 0) {
      addNotification({
        message: `Showing food with ${tags.join(', ')} preferences`,
        severity: 'info'
      });
    } else if (tags.length === 0 && selectedTags.length > 0) {
      // If tags were cleared
      addNotification({
        message: 'Cleared all dietary filters',
        severity: 'info'
      });
    }
    
    // No need to manually refresh markers here as the filtering happens in the Map component
  };

  const handleMenuClose = () => {
    // Refresh markers when the menu closes
    console.log('LandingPage: handleMenuClose called, refreshing markers');
    if (mapRef.current) {
      mapRef.current.refreshMarkers();
    }
  };

  const handleFoodSearch = (query) => {
    // Only log when the query actually changes
    if (query !== foodSearchQuery) {
      console.log(`Food search: ${query || '<empty string>'}`);
    }
    
    setFoodSearchQuery(query);
    
    if (query && query.trim() !== '' && mapRef.current) {
      addNotification({
        message: `Searching for "${query}" in nearby food donations`,
        severity: 'info'
      });
      mapRef.current.searchFood(query);
    } else if (mapRef.current) {
      // If empty query, reset to show all markers
      mapRef.current.refreshMarkers();
    }
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
        console.error("Error fetching location:", error);
        addNotification({
          message: "Could not get your location. Using default location instead.",
          severity: "warning"
        });
      }
    );
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#E1D9D1" }}>
      {/* Header */}
      <div style={{ flex: "0 0 auto" }}>
       {isLoaded && (
         <Header 
           onLogout={handleLogout} 
           onTagsChange={handleTagsChange} 
           onMenuClose={handleMenuClose}
           onFoodSearch={handleFoodSearch}
         />
       )}
      </div>

      {/* Map */}
      <div style={{ flex: "1 1 auto", overflow: "hidden" }}>
        {isLoaded && (
          <Map 
            ref={mapRef} 
            center={center} 
            selectedTags={selectedTags}
            foodSearchQuery={foodSearchQuery} 
          />
        )}
      </div>
    </div>
  );
};

export default LandingPage;
