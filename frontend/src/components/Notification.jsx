import React, { useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';

const Notification = ({ open, onClose, message, severity }) => {
  // Add click outside listener to close notification
  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e) => {
      // Only close if clicking outside the alert
      if (e.target.closest('.MuiAlert-root')) return;
      onClose();
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  return (
    <Snackbar
      open={open}
      autoHideDuration={3000} // Automatically close after 3 seconds
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      style={{ zIndex: 1400 }} // Ensure it's above other elements
    >
      <Alert onClose={onClose} severity={severity} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
};

export default Notification;
