import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useJsApiLoader } from "@react-google-maps/api";
import Map from "../components/Map";
import Notification from "../components/Notification";

// Move libraries outside component to prevent unnecessary reloads
const libraries = ['places', 'marker'];

const LandingPage = () => {
  const [center, setCenter] = useState({ lat: 0, lng: 0 });
  const [logoutMessage, setLogoutMessage] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const navigate = useNavigate();
  const mapRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const handleLogout = () => {
    console.log("Logout clicked");
    localStorage.removeItem("accessToken");

    // Redirect to login page and pass state for the logout notification
    navigate("/login", {
      state: { message: "Successfully logged out", severity: "success" },
    });
  };

  const handleTagsChange = (tags) => {
    console.log("Tags changed:", tags);
    setSelectedTags(tags);
  };

  const handleMenuClose = () => {
    // Refresh markers when the menu closes
    if (mapRef.current) {
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
      }
    );
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ flex: "0 0 auto" }}>
       {isLoaded && <Header onLogout={handleLogout} onTagsChange={handleTagsChange} onMenuClose={handleMenuClose} />}
      </div>

      <Notification
        open={logoutMessage}
        onClose={() => setLogoutMessage(false)}
        message="Successfully logged out"
      />

      {/* Map */}
      <div style={{ flex: "1 1 auto", overflow: "hidden" }}>
        {isLoaded && <Map ref={mapRef} center={center} selectedTags={selectedTags} />}
      </div>
    </div>
  );
};

export default LandingPage;
