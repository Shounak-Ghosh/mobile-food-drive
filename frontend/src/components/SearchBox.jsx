import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import PropTypes from "prop-types";

// CSS styles for Google Places Autocomplete dropdown
const autocompleteStyles = `
  .pac-container {
    background-color: #E1D9D1;
    border-radius: 4px;
    border: 1px solid #5a3812;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    font-family: inherit;
    margin-top: 4px;
    z-index: 1500;
  }
  
  .pac-item {
    padding: 8px 12px;
    cursor: pointer;
    color: #22311d;
    border-top: 1px solid rgba(90, 56, 18, 0.2);
  }
  
  .pac-item:hover, .pac-item-selected {
    background-color: rgba(90, 56, 18, 0.1);
  }
  
  .pac-item-query {
    font-size: 14px;
    color: #22311d;
    font-weight: bold;
  }
  
  .pac-matched {
    font-weight: bold;
  }
  
  .pac-icon {
    color: #5a3812;
  }
  
  /* Hide Google logo */
  .pac-logo:after {
    display: none !important;
  }
`;

const SearchBox = forwardRef(({ onPlaceSelected, placeholder, darkMode = false }, ref) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    clearInput: () => {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    selectFirstResult: () => {
      // Check if the autocomplete dropdown is visible and has items
      const pacContainer = document.querySelector('.pac-container');
      if (pacContainer && pacContainer.style.display !== 'none') {
        const firstItem = pacContainer.querySelector('.pac-item');
        if (firstItem) {
          // Simulate a click on the first item
          firstItem.click();
          return true;
        }
      }
      
      // If no dropdown or no items, use geocoding like the original Enter handler
      if (inputRef.current?.value?.trim() && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: inputRef.current.value.trim() }, (results, status) => {
          if (status === "OK" && results[0] && results[0].geometry) {
            const location = {
              lat: results[0].geometry.location.lat(),
              lng: results[0].geometry.location.lng()
            };
            // Create a place-like object to match the autocomplete API
            const place = {
              geometry: results[0].geometry,
              formatted_address: results[0].formatted_address
            };
            onPlaceSelected(location, place);
          }
        });
        return true;
      }
      return false;
    },
    getValue: () => inputRef.current?.value || ''
  }));

  // Inject custom styles for the Google Places Autocomplete once on component mount
  useEffect(() => {
    // Check if styles are already added to avoid duplicates
    if (!document.getElementById('google-places-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'google-places-style';
      styleEl.type = 'text/css';
      styleEl.appendChild(document.createTextNode(autocompleteStyles));
      document.head.appendChild(styleEl);
    }
    
    // Cleanup function will only run when component unmounts
    return () => {
      if (autocompleteRef.current) {
        try {
          // Clean up event listeners
          window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
          autocompleteRef.current = null;
        } catch (err) {
          console.warn("Error cleaning up autocomplete:", err);
        }
      }
    };
  }, []);

  // Initialize autocomplete when input ref is available
  useEffect(() => {
    if (!window.google || !window.google.maps || !window.google.maps.places || !inputRef.current) {
      return;
    }
    
    // Only create once
    if (!autocompleteRef.current) {
      try {
        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ["geocode"],
          fields: ["formatted_address", "geometry", "name"],
          componentRestrictions: { country: "us" }
        });

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current.getPlace();
          
          if (place.geometry) {
            const location = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            };
            onPlaceSelected(location, place);
          }
        });
      } catch (err) {
        console.error("Error initializing Places Autocomplete:", err);
      }
    }
  }, [onPlaceSelected]);
  
  // Function to handle Enter key press
  const handleKeyDown = (e) => {
    // If Enter key is pressed, prevent form submission and geocode the input value
    if (e.key === 'Enter' && inputRef.current?.value?.trim()) {
      e.preventDefault();
      
      // Try to select the first result from the dropdown
      const pacContainer = document.querySelector('.pac-container');
      if (pacContainer && pacContainer.style.display !== 'none') {
        const firstItem = pacContainer.querySelector('.pac-item');
        if (firstItem) {
          // Simulate a click on the first item
          firstItem.click();
          return;
        }
      }
      
      // Fallback to geocoding if no dropdown or no items
      if (window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: inputRef.current.value.trim() }, (results, status) => {
          if (status === "OK" && results[0] && results[0].geometry) {
            const location = {
              lat: results[0].geometry.location.lat(),
              lng: results[0].geometry.location.lng()
            };
            // Create a place-like object to match the autocomplete API
            const place = {
              geometry: results[0].geometry,
              formatted_address: results[0].formatted_address
            };
            onPlaceSelected(location, place);
          }
        });
      }
    }
  };

  // Match the InputBase component styling
  const darkModeStyle = {
    width: "100%",
    color: "white",
    backgroundColor: "#5a3812",
    borderRadius: "4px",
    padding: "4px 8px",
    border: "none",
    outline: "none",
    fontSize: "1rem",
    fontFamily: "Roboto, Arial, sans-serif",
    lineHeight: "1.4375em",
    height: "36px", // Match the height of InputBase in the Header component
    boxSizing: "border-box"
  };

  return (
    <input
      ref={inputRef}
      placeholder={placeholder || "Search for a location"}
      className={darkMode ? "" : "w-full max-w-md px-4 py-2 rounded border border-gray-300"}
      onKeyDown={handleKeyDown}
      style={darkMode ? darkModeStyle : { color: "black" }}
    />
  );
});

SearchBox.propTypes = {
  onPlaceSelected: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  darkMode: PropTypes.bool
};

SearchBox.displayName = 'SearchBox';

export default SearchBox;
