import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { GoogleMap, Marker } from "@react-google-maps/api";
import PropTypes from 'prop-types';

// CSS styles for Google Places Autocomplete dropdown
const autocompleteStyles = `
  .pac-container {
    background-color: #E1D9D1;
    border-radius: 4px;
    border: 1px solid #5a3812;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    font-family: inherit;
    margin-top: 4px;
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

const MarkerForm = ({ onClose, position, onMarkerAdded }) => {
  const [formData, setFormData] = useState({
    food_type: '',
    quantity: '',
    description: '',
    dietary_tags: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [markerPosition, setMarkerPosition] = useState(position);
  const [mapRef, setMapRef] = useState(null);
  const [address, setAddress] = useState('');
  const [isAddressLoading, setIsAddressLoading] = useState(true);
  const locationInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const dietaryOptions = [
    'vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free', 
    'dairy', 'nut', 'organic', 'non-perishable', 'pescatarian',
    'egg', 'shellfish'
  ];

  const containerStyle = {
    width: '100%',
    height: '190px'  // Increased from 180px
  };

  // Inject custom styles for the Google Places Autocomplete
  useEffect(() => {
    // Add custom styles
    const styleEl = document.createElement('style');
    styleEl.type = 'text/css';
    styleEl.appendChild(document.createTextNode(autocompleteStyles));
    document.head.appendChild(styleEl);
    
    return () => {
      // Clean up when component unmounts
      if (document.head.contains(styleEl)) {
        document.head.removeChild(styleEl);
      }
    };
  }, []);

  // Get address from coordinates using Google's Geocoding API
  useEffect(() => {
    if (window.google && markerPosition) {
      setIsAddressLoading(true);
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: markerPosition }, (results, status) => {
        setIsAddressLoading(false);
        if (status === "OK" && results[0]) {
          setAddress(results[0].formatted_address);
          if (locationInputRef.current) {
            locationInputRef.current.value = results[0].formatted_address;
          }
        } else {
          setAddress("Location address not found");
        }
      });
    }
  }, [markerPosition]);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (window.google && locationInputRef.current) {
      // Clear any existing autocomplete
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        locationInputRef.current,
        { 
          types: ['address'],
          fields: ['formatted_address', 'geometry'],
          componentRestrictions: { country: 'us' }
        }
      );
      
      // Add listener for place selection
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        
        if (!place.geometry || !place.geometry.location) return;
        
        // Set marker position to the selected location
        const newPosition = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        
        setMarkerPosition(newPosition);
        
        // Update map
        if (mapRef) {
          mapRef.panTo(newPosition);
          mapRef.setZoom(15);
        }

        // Move focus to the next input field
        const foodTypeInput = document.querySelector('input[name="food_type"]');
        if (foodTypeInput) {
          foodTypeInput.focus();
        }
      });
    }
    
    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [mapRef]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tag) => {
    setFormData(prev => {
      const currentTags = [...prev.dietary_tags];
      if (currentTags.includes(tag)) {
        return { ...prev, dietary_tags: currentTags.filter(t => t !== tag) };
      } else {
        return { ...prev, dietary_tags: [...currentTags, tag] };
      }
    });
  };

  const handleMapClick = (e) => {
    const newPosition = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };
    setMarkerPosition(newPosition);
  };

  const handleMarkerDrag = (e) => {
    const newPosition = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };
    setMarkerPosition(newPosition);
  };

  const handleLocationKeyDown = (e) => {
    // Prevent form submission when pressing Enter in the location field
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If the user presses Enter without selecting from dropdown,
      // manually trigger a search with the current text value
      if (window.google && locationInputRef.current) {
        const searchValue = locationInputRef.current.value;
        
        if (searchValue.trim()) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address: searchValue }, (results, status) => {
            if (status === "OK" && results[0]) {
              const newPosition = {
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng()
              };
              
              setMarkerPosition(newPosition);
              
              if (mapRef) {
                mapRef.panTo(newPosition);
                mapRef.setZoom(15);
              }
              
              // Move focus to the next input field
              const foodTypeInput = document.querySelector('input[name="food_type"]');
              if (foodTypeInput) {
                foodTypeInput.focus();
              }
            }
          });
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Using the selected marker position instead of the initial position
      console.log('Submitting marker with position:', markerPosition);

      const { data } = await axios.post('http://localhost:8000/markers', {
        latitude: markerPosition.lat,
        longitude: markerPosition.lng,
        food_type: formData.food_type,
        quantity: formData.quantity,
        description: formData.description,
        dietary_tags: formData.dietary_tags
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      onMarkerAdded(data);
      onClose();
    } catch (err) {
      console.error('Error creating marker:', err);
      setError(`Failed to create marker: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="h-full overflow-y-auto w-full flex items-center justify-center">
        <div 
          className="bg-white min-h-full md:min-h-0 md:my-4 md:rounded-lg p-5 w-full max-w-3xl mx-auto" 
          style={{ backgroundColor: '#E1D9D1' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl font-bold mb-4">Add Food Donation</h2>
          
          {error && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column - Map and Location */}
            <div className="md:col-span-1">
              <div className="mb-3">
                <label className="block text-gray-700 text-sm font-medium mb-2">Donation Location</label>
                
                <input
                  id="location-search"
                  ref={locationInputRef}
                  type="text"
                  placeholder="Enter address or location"
                  className="w-full p-2 border rounded"
                  onKeyDown={handleLocationKeyDown}
                />
                
                <div className="mt-2 mb-2 border rounded">
                  <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={markerPosition}
                    zoom={15}
                    onLoad={setMapRef}
                    onClick={handleMapClick}
                    options={{
                      streetViewControl: false,
                      mapTypeControl: false,
                      fullscreenControl: false,
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
                    <Marker
                      position={markerPosition}
                      draggable={true}
                      onDragEnd={handleMarkerDrag}
                    />
                  </GoogleMap>
                </div>
                
                <div className="p-2 bg-gray-100 rounded">
                  <p className="text-sm">{isAddressLoading ? 'Loading address...' : address}</p>
                  <p className="text-xs mt-1">Coordinates: ({markerPosition.lat.toFixed(5)}, {markerPosition.lng.toFixed(5)})</p>
                </div>
              </div>
            </div>
            
            {/* Right column - Food information */}
            <div className="md:col-span-1">
              <div className="mb-3">
                <label className="block text-gray-700 text-sm font-medium mb-2">Food Type</label>
                <input
                  type="text"
                  name="food_type"
                  value={formData.food_type}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                  placeholder="e.g., Vegetables, Canned Goods"
                />
              </div>
              
              <div className="mb-3">
                <label className="block text-gray-700 text-sm font-medium mb-2">Quantity</label>
                <input
                  type="text"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                  placeholder="e.g., 2 bags, 5 cans"
                />
              </div>
              
              <div className="mb-3">
                <label className="block text-gray-700 text-sm font-medium mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  rows="2"
                  required
                  placeholder="Describe the food items you're donating"
                ></textarea>
              </div>
              
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Dietary Tags</label>
                <div className="flex flex-wrap gap-2">
                  {dietaryOptions.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className={`px-2.5 py-1 rounded-full text-sm ${
                        formData.dietary_tags.includes(tag)
                          ? 'bg-green-800 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                      onClick={() => handleTagToggle(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Button row - spans both columns */}
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded hover:bg-gray-100"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white rounded hover:opacity-90"
                style={{ backgroundColor: '#5a3812' }}
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Donation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

MarkerForm.propTypes = {
  onClose: PropTypes.func.isRequired,
  position: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired
  }).isRequired,
  onMarkerAdded: PropTypes.func.isRequired
};

export default MarkerForm;