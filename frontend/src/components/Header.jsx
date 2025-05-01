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

const Header = ({ onLogout, onTagsChange, onFoodSearch }) => {
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
      
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['geocode'],
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (place.geometry) {
          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
          localStorage.setItem("mapCenter", JSON.stringify(location));
          window.dispatchEvent(new Event("centerChanged"));
          
          // Move map to this location
          if (window.map) {
            window.map.panTo(location);
            window.map.setZoom(15);
          }
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
    setIsAddressSearch(!isAddressSearch);
    
    // Clear input when switching modes
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setSearchText('');
    
    // Clear any existing autocomplete when switching modes
    if (autocompleteRef.current) {
      window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      autocompleteRef.current = null;
    }
    
    // Force recreation of the input component by changing its key
    setInputKey(prevKey => prevKey + 1);
    
    if (isAddressSearch && onFoodSearch) {
      // Going from address search to food search
      onFoodSearch('');
    }
  };

  const handleSearchTextChange = (e) => {
    const newValue = e.target.value;
    setSearchText(newValue);
    
    // Only use debounced search in food search mode
    if (!isAddressSearch) {
      debouncedSearch(newValue);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    if (isAddressSearch && inputRef.current && inputRef.current.value.trim()) {
      // If in address search mode and there's text, manually geocode
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: inputRef.current.value }, (results, status) => {
        if (status === "OK" && results[0]) {
          const location = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          };
          
          localStorage.setItem("mapCenter", JSON.stringify(location));
          window.dispatchEvent(new Event("centerChanged"));
          
          // Move map to this location
          if (window.map) {
            window.map.panTo(location);
            window.map.setZoom(15);
          }
        }
      });
    }
  };

  const clearSearch = () => {
    setSearchText('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    
    // Cancel any pending debounced searches
    debouncedSearch.cancel();
    
    // Clear the search results without debounce only in food search mode
    if (!isAddressSearch && onFoodSearch) {
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
              value={searchText}
              onChange={handleSearchTextChange}
              inputProps={{ 'aria-label': 'search' }}
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
  onFoodSearch: PropTypes.func
};

export default Header;