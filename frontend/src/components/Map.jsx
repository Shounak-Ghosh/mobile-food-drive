import React, { useState, useEffect, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import MarkerForm from "./MarkerForm";
import MarkerDetail from "./MarkerDetail";
import debounce from "lodash/debounce";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const WS_URL = "ws://localhost:8000/markers/ws";

const Map = ({ center }) => {
  const [markers, setMarkers] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [showAddMarkerForm, setShowAddMarkerForm] = useState(false);
  const [addMarkerPosition, setAddMarkerPosition] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // WebSocket for real-time updates
  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socket.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === "marker_update") {
        const m = msg.marker;
        setMarkers(prev => {
          // remove if finished
          if (m.status === "picked_up" || m.status === "expired") {
            return prev.filter(x => x.marker_id !== m.marker_id);
          }
          // otherwise upsert
          const idx = prev.findIndex(x => x.marker_id === m.marker_id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = m;
            return copy;
          }
          return [...prev, m];
        });
        // refresh detail view if open
        setSelectedMarker(sel => sel && sel.marker_id === m.marker_id ? m : sel);
      }
    };
    return () => socket.close();
  }, []);

  // Fetch markers in view
  const fetchMarkersInView = useCallback(debounce(() => {
    if (!mapRef) return;
    const bounds = mapRef.getBounds();
    if (!bounds) return;
    const north = bounds.getNorthEast().lat();
    const east = bounds.getNorthEast().lng();
    const south = bounds.getSouthWest().lat();
    const west = bounds.getSouthWest().lng();

    fetch(`http://localhost:8000/markers?north=${north}&south=${south}&east=${east}&west=${west}`)
      .then(res => res.json())
      .then(data => {
        // only show available or reserved
        setMarkers(data.filter(m => m.status === "available" || m.status === "reserved"));
      });
  }, 300), [mapRef]);

  // On mount / center
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => mapRef?.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        console.error
      );
    }
  }, [mapRef]);

  // New marker added
  const handleMarkerAdded = newM => {
    setMarkers(prev => [...prev, newM]);
    setShowAddMarkerForm(false);
    setAddMarkerPosition(null);
  };

  if (loadError) return <div>Error loading map</div>;
  if (!isLoaded) return <div>Loading map…</div>;

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={map => setMapRef(map)}
        onIdle={fetchMarkersInView}
        options={{ disableDefaultUI: true, gestureHandling: "greedy" }}
      >
        {markers.map(m => (
          <Marker
            key={m.marker_id}
            position={{ lat: m.latitude, lng: m.longitude }}
            onClick={() => setSelectedMarker(m)}
            icon={{
              url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path fill="none" stroke="#fc5e03" stroke-width="2"
                        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5" fill="#fc5e03"/>
                </svg>`),
              scaledSize: new window.google.maps.Size(35,40),
              anchor: new window.google.maps.Point(20,40),
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
        className="absolute bottom-4 right-4 p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600"
        onClick={() => {
          const pos = mapRef ? mapRef.getCenter().toJSON() : center;
          setAddMarkerPosition(pos);
          setShowAddMarkerForm(true);
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
             viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4"/>
        </svg>
      </button>

      {showAddMarkerForm && addMarkerPosition && (
        <MarkerForm
          position={addMarkerPosition}
          onMarkerAdded={handleMarkerAdded}
          onClose={() => setShowAddMarkerForm(false)}
        />
      )}
    </div>
  );
};

export default Map;
