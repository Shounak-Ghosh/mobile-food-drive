import React, { useState, useEffect, useCallback } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import MarkerForm from "./MarkerForm";
import debounce from "lodash/debounce";
import MarkerDetail from "./MarkerDetail";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const Map = ({ center }) => {
  const [markers, setMarkers] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [showAddMarkerForm, setShowAddMarkerForm] = useState(false);
  const [addMarkerPosition, setAddMarkerPosition] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);

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

  const fetchMarkersInView = useCallback(
    debounce(() => {
      if (mapRef) {
        const bounds = mapRef.getBounds();
        if (!bounds) return;

        const north = bounds.getNorthEast().lat();
        const east = bounds.getNorthEast().lng();
        const south = bounds.getSouthWest().lat();
        const west = bounds.getSouthWest().lng();

        const url = `http://localhost:8000/markers?north=${north}&south=${south}&east=${east}&west=${west}`;

        fetch(url)
          .then((res) => res.json())
          .then((data) => {
            console.log("Fetched markers:", data);
            setMarkers(data);
          })
          .catch((err) => console.error("Error fetching markers:", err));
      }
    }, 300), // 300ms delay
    [mapRef]
  );

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
        }}
      >
        {markers.map((marker, index) => (
          <Marker
          key={index}
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

      {/* Floating Detail Panel */}
      {selectedMarker && (
        <div className="absolute bottom-4 left-4 z-10">
          <MarkerDetail
            marker={selectedMarker}
            onClose={() => setSelectedMarker(null)}
          />
        </div>
      )}

      {/* Add Marker Button */}
      <button
        className="absolute bottom-4 right-4 p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600"
        onClick={() => {
          const newPosition = mapRef?.getCenter()?.toJSON() || center;
          setAddMarkerPosition(newPosition);
          setShowAddMarkerForm(true);
        }}
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

      {/* Marker Form Modal */}
      {showAddMarkerForm && addMarkerPosition && (
        <MarkerForm
          onClose={() => {
            setShowAddMarkerForm(false);
            setAddMarkerPosition(null);
          }}
          position={addMarkerPosition}
          onMarkerAdded={(m) => setMarkers((prev) => [...prev, m])}
        />
      )}
    </div>
  );
};

export default Map;
