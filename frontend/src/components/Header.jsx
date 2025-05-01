import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, InputBase, Menu, MenuItem, IconButton, Paper,
  Tooltip, Typography
} from '@mui/material';
import {
  Search as SearchIcon,
  AccountCircle as AccountCircleIcon,
  FilterAlt as FilterIcon,
  FilterAltOff as FilterOffIcon,
  Clear as ClearIcon,
  LocationOn as LocationOnIcon,
} from '@mui/icons-material';
import NotificationsHistory from './NotificationsHistory';
import debounce from 'lodash/debounce';
import axios from 'axios';
import PropTypes from 'prop-types';

const dietaryOptions = [
  'vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free',
  'dairy-free', 'nut-free', 'organic', 'non-perishable'
];

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

const Header = ({ onLogout, onTagsChange, onFoodSearch, onMenuClose }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [userPreferencesLoaded, setUserPreferencesLoaded] = useState(false);
  const [isAddressSearch, setIsAddressSearch] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const filterRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [inputKey, setInputKey] = useState(0);
  
  // Inject custom styles for the Google Places Autocomplete
  useEffect(() => {
    // Add custom styles
    const styleEl = document.createElement('style');
    styleEl.type = 'text/css';
    styleEl.appendChild(document.createTextNode(autocompleteStyles));
    document.head.appendChild(styleEl);
    
    return () => {
      // Clean up when component unmounts
      document.head.removeChild(styleEl);
    };
  }, []);

  // Set up Google Places autocomplete when in address search mode
  useEffect(() => {
    if (window.google && inputRef.current && isAddressSearch) {
      // Clear any existing autocomplete
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      
      // Create the autocomplete instance - using the same config as MarkerForm
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        { 
          types: ['address'],
          fields: ['formatted_address', 'geometry'],
          componentRestrictions: { country: 'us' }
        }
      );

      // Add listener for place selection - keep it simple like in MarkerForm
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        
        if (!place.geometry || !place.geometry.location) return;
        
        // Set search text to the formatted address
        if (place.formatted_address) {
          setSearchText(place.formatted_address);
        }
        
        // Get location coordinates
        const newPosition = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        
        console.log("Place selected, moving map to:", newPosition);
        
        // Store the selected location
        localStorage.setItem("mapCenter", JSON.stringify(newPosition));
        window.dispatchEvent(new Event("centerChanged"));
        
        // Move map to this location
        if (window.map) {
          window.map.panTo(newPosition);
          window.map.setZoom(15);
        }
      });
      
      // Set placeholder for address search
      if (inputRef.current) {
        inputRef.current.placeholder = "Search for an address...";
      }
    } else if (!isAddressSearch && autocompleteRef.current) {
      // If switching to food search mode, clear any existing autocomplete
      window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      autocompleteRef.current = null;
    }
    
    // Clear food search when switching to address
    if (isAddressSearch && onFoodSearch) {
      onFoodSearch('');
    }
    
    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isAddressSearch, onFoodSearch]);

  // Fetch user's dietary preferences on mount
  useEffect(() => {
    const fetchUserPreferences = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          const response = await axios.get('http://localhost:8000/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.data && response.data.dietary_tags) {
            // Set the user's dietary preferences as the default selected tags
            setSelectedTags(response.data.dietary_tags);
            // Notify parent component of the initial tag selection
            if (onTagsChange) {
              onTagsChange(response.data.dietary_tags);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user preferences:', error);
      } finally {
        setUserPreferencesLoaded(true);
      }
    };

    if (!userPreferencesLoaded) {
      fetchUserPreferences();
    }
  }, [onTagsChange, userPreferencesLoaded]);

  // Create a debounced search function that only triggers after 300ms of inactivity
  const debouncedSearch = useCallback(
    debounce((searchValue) => {
      if (onFoodSearch && !isAddressSearch) {
        onFoodSearch(searchValue);
      }
    }, 300),
    [onFoodSearch, isAddressSearch]
  );

  // Add click outside handler for filter menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if the click is on the filter button
      const isFilterButton = event.target.closest('button[aria-label="Filter results"]');
      if (filterOpen && filterRef.current && !filterRef.current.contains(event.target) && !isFilterButton) {
        setFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterOpen]);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    
    // Call onMenuClose callback if provided
    if (onMenuClose) {
      onMenuClose();
    }
  };

  const goToAccountDetails = () => {
    handleMenuClose();
    navigate('/account-details');
  };

  const handleTagToggle = (tag) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    
    setSelectedTags(newTags);
    
    // Notify parent component of tag changes
    if (onTagsChange) {
      onTagsChange(newTags);
    }
  };

  const toggleSearchMode = () => {
    // Clear all search-related state
    setSearchText('');
    
    // Clear input field to prevent input/autocomplete confusion
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    
    // Clear any existing autocomplete when switching modes
    if (autocompleteRef.current) {
      window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      autocompleteRef.current = null;
    }
    
    // Toggle the search mode
    setIsAddressSearch(!isAddressSearch);
    
    // Force recreation of the input component by changing its key
    // This is crucial for Google Places to initialize correctly
    setInputKey(prevKey => prevKey + 1);
    
    // Clear food search when switching from food search to address search
    if (!isAddressSearch && onFoodSearch) {
      // Going from food search to address search
      onFoodSearch('');
    }
  };

  const handleSearchTextChange = (e) => {
    const newValue = e.target.value;
    
    // In address search mode, we let Google Places handle the input
    // Only update our local state for display purposes
    setSearchText(newValue);
    
    // For food search mode, trigger the debounced search
    if (!isAddressSearch) {
      debouncedSearch(newValue);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    if (isAddressSearch && inputRef.current && inputRef.current.value.trim()) {
      // If in address search mode and there's text, manually geocode
      const searchValue = inputRef.current.value.trim();
      console.log("Geocoding address from Enter key:", searchValue);
      
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: searchValue }, (results, status) => {
        if (status === "OK" && results[0]) {
          const newPosition = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          };
          
          console.log("Geocoding result from Enter key:", newPosition);
          
          // Store the selected location
          localStorage.setItem("mapCenter", JSON.stringify(newPosition));
          window.dispatchEvent(new Event("centerChanged"));
          
          // Move map to this location
          if (window.map) {
            window.map.panTo(newPosition);
            window.map.setZoom(15);
          }
        } else {
          console.warn("Geocoding failed:", status);
        }
      });
    } else if (!isAddressSearch && onFoodSearch) {
      // Trigger food search with current input value
      onFoodSearch(inputRef.current?.value || '');
    }
  };

  const clearSearch = () => {
    // Clear the search state and input field
    setSearchText('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    
    // Cancel any pending debounced searches
    debouncedSearch.cancel();
    
    // Clear the search results
    if (!isAddressSearch && onFoodSearch) {
      // Only trigger food search clear if in food search mode
      onFoodSearch('');
    }
  };

  const toggleFilterMenu = () => {
    setFilterOpen(!filterOpen);
  };

  // Reset filters to user's preferences from account
  const resetToUserPreferences = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const response = await axios.get('http://localhost:8000/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data && response.data.dietary_tags) {
          // Set the user's dietary preferences
          setSelectedTags(response.data.dietary_tags);
          // Notify parent component
          if (onTagsChange) {
            onTagsChange(response.data.dietary_tags);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  };

  return (
    <AppBar position="static" style={{ backgroundColor: '#22311d' }}>
      <Toolbar style={{ position: 'relative' }}>
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: 500 }}>
            <Tooltip title={isAddressSearch ? "Search for locations" : "Search for food"}>
              <IconButton 
                size="small" 
                onClick={toggleSearchMode}
                style={{ color: 'white' }}
                aria-label={isAddressSearch ? "Search for locations" : "Search for food"}
              >
                {isAddressSearch ? <LocationOnIcon /> : <SearchIcon />}
              </IconButton>
            </Tooltip>

            <InputBase
              key={inputKey}
              inputRef={inputRef}
              placeholder={isAddressSearch ? "Search for an address..." : "Search for food (e.g., pizza, vegetables, meals)..."}
              defaultValue=""
              onChange={handleSearchTextChange}
              inputProps={{ 
                'aria-label': 'search',
                autoComplete: isAddressSearch ? 'off' : 'on' // Important for Google Places
              }}
              style={{
                marginLeft: 8,
                color: 'white',
                backgroundColor: '#5a3812',
                borderRadius: 4,
                padding: '4px 8px',
                width: '100%',
              }}
            />

            {searchText && (
              <IconButton 
                size="small" 
                onClick={clearSearch}
                style={{ color: 'white' }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            )}

            {!isAddressSearch && (
              <Tooltip title="Filter results">
                <IconButton 
                  size="small" 
                  onClick={toggleFilterMenu}
                  style={{ color: 'white', marginLeft: 4 }}
                  aria-label="Filter results"
                >
                  {selectedTags.length > 0 ? <FilterOffIcon /> : <FilterIcon />}
                  {selectedTags.length > 0 && (
                    <div className="absolute -top-1 -right-1 bg-green-700 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {selectedTags.length}
                    </div>
                  )}
                </IconButton>
              </Tooltip>
            )}
          </form>

          {/* Filter Menu */}
          {filterOpen && (
            <Paper
              ref={filterRef}
              elevation={3}
              style={{
                position: 'absolute',
                top: '100%',
                left: 5,
                marginTop: 8,
                padding: 12,
                backgroundColor: '#E1D9D1',
                zIndex: 1300,
                width: '90%',
                maxWidth: 450
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <Typography variant="subtitle2">Filter Food By Dietary Preferences</Typography>
                <div className="text-xs">
                  <button 
                    className="text-[#5a3812] hover:underline mr-2" 
                    onClick={() => {
                      setSelectedTags([]);
                      if (onTagsChange) onTagsChange([]);
                    }}
                  >
                    Clear All
                  </button>
                  <button 
                    className="text-[#22311d] hover:underline" 
                    onClick={resetToUserPreferences}
                  >
                    Reset to My Preferences
                  </button>
                </div>
              </div>
              
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                {dietaryOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedTags.includes(tag)
                        ? 'text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                    style={selectedTags.includes(tag) ? { backgroundColor: '#22311d' } : {}}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </Paper>
          )}
        </div>

        <div className="flex items-center">
          <NotificationsHistory />
          
          <IconButton onClick={handleMenuOpen} style={{ color: 'white' }}>
            <AccountCircleIcon />
          </IconButton>
        </div>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            style: {
              backgroundColor: '#E1D9D1',
              borderRadius: '6px',
            }
          }}
        >
          <MenuItem onClick={goToAccountDetails} style={{ color: '#22311d' }}>Account Details</MenuItem>
          <MenuItem
            onClick={() => {
              handleMenuClose();
              onLogout();
            }}
            style={{ color: '#22311d' }}
          >
            Log Out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

Header.propTypes = {
  onLogout: PropTypes.func,
  onTagsChange: PropTypes.func,
  onFoodSearch: PropTypes.func,
  onMenuClose: PropTypes.func
};

export default Header;