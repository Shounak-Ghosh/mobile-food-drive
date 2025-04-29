import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, InputBase, Menu, MenuItem, IconButton, Paper, Button,
  Tooltip, Chip, Typography, Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  AccountCircle as AccountCircleIcon,
  FilterAlt as FilterIcon,
  FilterAltOff as FilterOffIcon,
  LocationOn as LocationIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import NotificationsHistory from './NotificationsHistory';

const dietaryOptions = [
  'vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free',
  'dairy-free', 'nut-free', 'organic', 'non-perishable'
];

const Header = ({ onLogout, onTagsChange, onMenuClose, onFoodSearch, onLocationChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dietaryAnchorEl, setDietaryAnchorEl] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState('food'); // 'food' or 'location'
  const [filterOpen, setFilterOpen] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const filterRef = useRef(null);

  useEffect(() => {
    if (window.google && inputRef.current && searchMode === 'location') {
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['geocode'],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
          localStorage.setItem("mapCenter", JSON.stringify(location));
          window.dispatchEvent(new Event("centerChanged"));
          if (onLocationChange) {
            onLocationChange(location);
          }
        }
      });
    }
  }, [searchMode, onLocationChange]);

  // Add click outside handler for dietary menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dietaryAnchorEl && menuRef.current && !menuRef.current.contains(event.target)) {
        setDietaryAnchorEl(null);
        if (onMenuClose) {
          onMenuClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dietaryAnchorEl, onMenuClose]);

  // Add click outside handler for filter menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterOpen && filterRef.current && !filterRef.current.contains(event.target)) {
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

  const toggleDietaryMenu = (event) => {
    const newState = !dietaryAnchorEl;
    setDietaryAnchorEl(newState ? event.currentTarget : null);
    if (!newState && onMenuClose) {
      onMenuClose();
    }
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

  const handleSearchTextChange = (e) => {
    setSearchText(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    if (searchMode === 'food' && onFoodSearch) {
      onFoodSearch(searchText);
    }
  };

  const toggleSearchMode = () => {
    setSearchText('');
    setSearchMode(prevMode => prevMode === 'food' ? 'location' : 'food');
  };

  const clearSearch = () => {
    setSearchText('');
    if (onFoodSearch) {
      onFoodSearch('');
    }
  };

  const toggleFilterMenu = () => {
    setFilterOpen(!filterOpen);
  };

  return (
    <AppBar position="static" style={{ backgroundColor: '#8B4513' }}>
      <Toolbar style={{ position: 'relative' }}>
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: 500 }}>
            <Tooltip title={searchMode === 'food' ? 'Search for food' : 'Search by location'}>
              <IconButton 
                size="small" 
                onClick={toggleSearchMode}
                style={{ color: 'white' }}
              >
                {searchMode === 'food' ? <SearchIcon /> : <LocationIcon />}
              </IconButton>
            </Tooltip>

            <InputBase
              inputRef={inputRef}
              placeholder={searchMode === 'food' 
                ? "Search for food (e.g., pizza, vegetables, meals)..." 
                : "Enter location to find nearby food..."}
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

            <Tooltip title="Filter results">
              <IconButton 
                size="small" 
                onClick={toggleFilterMenu}
                style={{ color: 'white', marginLeft: 4 }}
              >
                {selectedTags.length > 0 ? <FilterOffIcon /> : <FilterIcon />}
                {selectedTags.length > 0 && (
                  <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {selectedTags.length}
                  </div>
                )}
              </IconButton>
            </Tooltip>
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
                backgroundColor: 'white',
                zIndex: 1300,
                width: '90%',
                maxWidth: 450
              }}
            >
              <Typography variant="subtitle2" className="mb-2">Filter Food By Dietary Preferences</Typography>
              <div className="mb-1">
                {selectedTags.length > 0 && (
                  <div className="flex items-center mb-2">
                    <Typography variant="caption" className="mr-2">Active filters:</Typography>
                    <div className="flex flex-wrap gap-1">
                      {selectedTags.map(tag => (
                        <Chip 
                          key={tag} 
                          label={tag} 
                          size="small" 
                          onDelete={() => handleTagToggle(tag)}
                          color="primary"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Divider className="my-2" />
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
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
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
        >
          <MenuItem onClick={goToAccountDetails}>Account Details</MenuItem>
          <MenuItem
            onClick={() => {
              handleMenuClose();
              onLogout();
            }}
          >
            Log Out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;