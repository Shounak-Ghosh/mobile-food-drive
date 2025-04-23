import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, InputBase, Menu, MenuItem, IconButton } from '@mui/material';
import { Search as SearchIcon, AccountCircle as AccountCircleIcon } from '@mui/icons-material';

const Header = ({ onLogout }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();

  const inputRef = useRef(null);

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

  return (
    <AppBar position="static" style={{ backgroundColor: '#8B4513' }}>
      <Toolbar>
        {/* Search Field */}
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
        </div>

        {/* Account Icon */}
        <IconButton onClick={handleMenuOpen} style={{ color: 'white' }}>
          <AccountCircleIcon />
        </IconButton>

        {/* Dropdown Menu */}
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
              onLogout(); // Trigger logout
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
