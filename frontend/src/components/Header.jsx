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
import SearchBox from './SearchBox';
import debounce from 'lodash/debounce';
import axios from 'axios';
import PropTypes from 'prop-types';

const dietaryOptions = [
  'vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free',
  'dairy-free', 'nut-free', 'organic', 'non-perishable', 'pescatarian',
  'egg-free', 'shellfish-free'
];

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
  const [inputKey, setInputKey] = useState(0);
  const searchBoxRef = useRef(null);
  
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
        
        // Trigger a refresh when filter menu is closed by clicking outside
        if (onMenuClose) {
          onMenuClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterOpen, onMenuClose]);

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
    
    // Update local state
    setSelectedTags(newTags);
    
    // Notify parent component of tag changes
    if (onTagsChange) {
      onTagsChange(newTags);
    }
    
    // Trigger map refresh with a small delay to ensure state updates are processed
    setTimeout(() => {
      if (onMenuClose) {
        console.log('Header: Refreshing map after tag toggle:', tag);
        onMenuClose();
      }
    }, 50);
  };

  const toggleSearchMode = () => {
    // Clear all search-related state
    setSearchText('');
    
    // Clear input field value
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    
    // Toggle mode AFTER cleanup
    const newMode = !isAddressSearch;
    setIsAddressSearch(newMode);
    
    // Force recreation of the input component by changing its key
    setInputKey(prevKey => prevKey + 1);
    
    // Clear food search when switching from food search to address search
    if (!newMode && onFoodSearch) {
      onFoodSearch('');
    }
  };

  const handleSearchTextChange = (e) => {
    const newValue = e.target.value;
    
    // Only update state if value actually changed to reduce renders
    if (newValue !== searchText) {
      setSearchText(newValue);
      
      // For food search mode, trigger the debounced search
      if (!isAddressSearch) {
        debouncedSearch(newValue);
      }
    }
  };

  const handleSearchSubmit = (e) => {
    // Always prevent default form submission
    e.preventDefault();
    
    if (isAddressSearch && searchBoxRef.current) {
      // In address search mode, try to auto-select the first result
      searchBoxRef.current.selectFirstResult();
    } else if (!isAddressSearch && onFoodSearch && inputRef.current) {
      // In food search mode, trigger search with current value
      onFoodSearch(inputRef.current.value);
    }
  };

  const clearSearch = () => {
    // Clear the search state
    setSearchText('');
    
    // In address search mode, clear the SearchBox's input using the ref
    if (isAddressSearch && searchBoxRef.current) {
      searchBoxRef.current.clearInput();
    } else if (inputRef.current) {
      // In food search mode, clear the InputBase directly
      inputRef.current.value = '';
      
      // Cancel any pending debounced searches
      debouncedSearch.cancel();
      
      // Clear the search results
      if (onFoodSearch) {
        onFoodSearch('');
      }
    }
  };

  const toggleFilterMenu = () => {
    setFilterOpen(!filterOpen);
  };

  // Handle place selection from SearchBox
  const handlePlaceSelection = (location, place) => {
    if (place && place.formatted_address) {
      setSearchText(place.formatted_address);
    }
    
    console.log("Place selected in SearchBox:", location);
    
    // Store the selected location
    localStorage.setItem("mapCenter", JSON.stringify(location));
    window.dispatchEvent(new Event("centerChanged"));
    
    // Move map to this location
    if (window.map) {
      window.map.panTo(location);
      window.map.setZoom(15);
    }
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
  
  // Clear all filters and refresh the map
  const clearAllFilters = () => {
    // Update local state
    setSelectedTags([]);
    
    // Update parent component's state
    if (onTagsChange) {
      onTagsChange([]);
    }
    
    // Force immediate refresh with a small delay to ensure state updates are processed
    setTimeout(() => {
      if (onMenuClose) {
        console.log('Header: Forcing map refresh after clearing all filters');
        onMenuClose();
      }
    }, 50);
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

            {isAddressSearch ? (
              <div style={{ flexGrow: 1, marginLeft: 8, width: '100%' }}>
                <SearchBox 
                  key={inputKey}
                  ref={searchBoxRef}
                  onPlaceSelected={handlePlaceSelection} 
                  placeholder="Search for an address..."
                  darkMode={true}
                />
              </div>
            ) : (
              <InputBase
                key={inputKey}
                inputRef={inputRef}
                placeholder="Search for food (e.g., pizza, vegetables, meals)..."
                defaultValue=""
                onChange={handleSearchTextChange}
                inputProps={{ 'aria-label': 'search' }}
                style={{
                  marginLeft: 8,
                  color: 'white',
                  backgroundColor: '#5a3812',
                  borderRadius: 4,
                  padding: '4px 8px',
                  width: '100%',
                  height: '36px'
                }}
              />
            )}

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
                    onClick={clearAllFilters}
                  >
                    Clear All
                  </button>
                  <button 
                    className="text-[#22311d] hover:underline" 
                    onClick={() => {
                      resetToUserPreferences();
                      // Also trigger a refresh after resetting preferences
                      if (onMenuClose) setTimeout(() => onMenuClose(), 100);
                    }}
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