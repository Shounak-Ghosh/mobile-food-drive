import { useEffect, useRef } from "react";

const SearchBox = ({ onPlaceSelected }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!window.google || !window.google.maps || !inputRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["geocode"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        onPlaceSelected(location, place);
      }
    });
  }, []);

  return (
    <input
      ref={inputRef}
      placeholder="Search for a location"
      className="w-full max-w-md px-4 py-2 rounded border border-gray-300"
      style={{ color: "black" }}
    />
  );
};

export default SearchBox;
