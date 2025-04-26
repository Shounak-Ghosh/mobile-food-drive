import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, InputBase, Menu, MenuItem, IconButton, Paper, Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material';

const dietaryOptions = [
  'vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free',
  'dairy-free', 'nut-free', 'organic', 'non-perishable'
];

const Header = ({ onLogout, onTagsChange, onMenuClose }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dietaryAnchorEl, setDietaryAnchorEl] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (window.google && inputRef.current) {
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
        }
      });
    }
  }, []);

  // Add click outside handler
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

  return (
    <AppBar position="static" style={{ backgroundColor: '#8B4513' }}>
      <Toolbar style={{ position: 'relative' }}>
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <SearchIcon style={{ color: 'white' }} />
          <InputBase
            inputRef={inputRef}
            placeholder="Search…"
            inputProps={{ 'aria-label': 'search' }}
            style={{
              marginLeft: 8,
              color: 'white',
              backgroundColor: '#5a3812',
              borderRadius: 4,
              padding: '4px 8px',
              width: '100%',
              maxWidth: 400,
            }}
          />
          <div style={{ position: 'relative' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={toggleDietaryMenu}
              style={{
                marginLeft: 12,
                color: 'white',
                borderColor: 'white',
                borderRadius: 20,
                textTransform: 'none',
              }}
            >
              Dietary Preferences
            </Button>

            {dietaryAnchorEl && (
              <Paper
                ref={menuRef}
                elevation={3}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 5,
                  marginTop: 8,
                  padding: 12,
                  backgroundColor: 'white',
                  zIndex: 1300,
                  width: '100%'
                }}
              >
                <label className="block text-gray-700 mb-1">Select your Dietary Preferences</label>
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
        </div>

        <IconButton onClick={handleMenuOpen} style={{ color: 'white' }}>
          <AccountCircleIcon />
        </IconButton>

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