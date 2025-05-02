import axios from 'axios';
import { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNotifications } from '../contexts/NotificationsContext';

const MarkerDetail = ({ marker, onClose, onReserve }) => {
  // Create a local state for the marker to ensure immediate updates
  const [localMarker, setLocalMarker] = useState(marker);
  const [isReserving, setIsReserving] = useState(false);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // New loading state
  const currentUserId = parseInt(localStorage.getItem('userId'), 10);
  
  // Derive these values from the local marker so they update immediately
  const isDonator = localMarker.donator_user_id === currentUserId;
  const { addNotification } = useNotifications();

  // Update local marker when the prop changes
  useEffect(() => {
    console.log('MarkerDetail: Updating local marker from props', marker.marker_id);
    setLocalMarker(marker);
    
    // Reset any loading states when we get a new marker
    setIsReserving(false);
    setIsPickingUp(false);
    setIsLoading(false);
  }, [marker]);

  // Force update the localMarker every few seconds to keep it synchronized
  useEffect(() => {
    // If this is a reserved marker, we need to update the time remaining regularly
    if (localMarker.status === 'reserved') {
      const intervalId = setInterval(() => {
        // Only update the localMarker's timestamp to recalculate the time remaining
        setLocalMarker(prevMarker => ({
          ...prevMarker,
          // Include a timestamp to force re-render even if the marker hasn't changed
          _timestamp: Date.now()
        }));
      }, 10000); // Update every 10 seconds
      
      return () => clearInterval(intervalId);
    }
  }, [localMarker.status]);

  // Refresh the marker data from the server periodically
  useEffect(() => {
    // Don't refresh if we're in the middle of an action
    if (isReserving || isPickingUp) {
      return;
    }
    
    const fetchMarkerData = async () => {
      try {
        // Don't set loading state for regular refresh operations
        // as it causes flickering and poor UX
        const token = localStorage.getItem('accessToken');
        if (!token) {
          return;
        }
        
        const { data } = await axios.get(
          `http://localhost:8000/markers/${localMarker.marker_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        // Compare the data with local marker to see if there are changes
        if (data.status !== localMarker.status || 
            data.receiver_user_id !== localMarker.receiver_user_id ||
            data.reserved_until !== localMarker.reserved_until) {
          console.log('MarkerDetail: Updating marker from server with new data', data);
          setLocalMarker(data);
          
          // Also update the parent component's state if needed
          if (onReserve && data.status === 'reserved') {
            onReserve(data);
          }
        }
      } catch (err) {
        console.error('MarkerDetail: Error refreshing marker data:', err);
      }
    };
    
    // Only set up polling for markers that are available or reserved
    if (['available', 'reserved'].includes(localMarker.status)) {
      const intervalId = setInterval(fetchMarkerData, 15000); // Refresh every 15 seconds
      
      // Fetch immediately on mount without loading state
      fetchMarkerData();
      
      return () => clearInterval(intervalId);
    }
  }, [localMarker.marker_id, localMarker.status, localMarker.receiver_user_id, onReserve, isReserving, isPickingUp]);
  
  // Clear loading state after initial render
  useEffect(() => {
    // Clear any loading state after a short delay
    const timer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
      }
    }, 2000); // 2 seconds max loading time
    
    return () => clearTimeout(timer);
  }, [isLoading]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    
    try {
      // Debug information
      console.log("Original timestamp:", dateString);
      
      // SOLUTION: The server sends timestamps without timezone indicator,
      // but they should be interpreted as UTC. Adding 'Z' fixes this.
      const dateStringWithZ = dateString.endsWith('Z') ? dateString : dateString + 'Z';
      const date = new Date(dateStringWithZ);
      
      // Format as New York time
      const etOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
      };
      
      const formattedDate = date.toLocaleString('en-US', etOptions);
      console.log("Formatted with Z added + ET timezone:", formattedDate);
      
      return formattedDate;
    } catch (err) {
      console.error("Error formatting date:", err, dateString);
      return dateString; // Return original if parsing fails
    }
  };

  const getTimeLeft = useCallback(() => {
    if (!localMarker.reserved_until) return null;
    const diffMs = new Date(localMarker.reserved_until) - new Date();
    if (diffMs <= 0) return 'Expired';
    const mins = Math.ceil(diffMs / 60000);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      return `${hrs}h ${rem}m`;
    }
    return `${mins}m`;
  }, [localMarker.reserved_until]);

  const handleReserve = async () => {
    // Prevent double-clicks or multiple reservations
    if (isReserving || isLoading) return;
    
    setIsReserving(true);
    console.log('MarkerDetail: Attempting to reserve marker', localMarker.marker_id);
    
    try {
      const { data: updated } = await axios.patch(
        `http://localhost:8000/markers/${localMarker.marker_id}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      
      console.log('MarkerDetail: Reserve successful, server response:', updated);
      
      // Immediately update the local marker state
      setLocalMarker({
        ...localMarker,
        status: 'reserved',
        receiver_user_id: currentUserId,
        reserved_until: updated.reserved_until
      });
      
      // Also update the parent component's state
      onReserve?.(updated);
      
      // Show immediate notification to confirm reservation
      // This will show right away, and the server-sent notification will come via WebSocket
      addNotification({
        id: Date.now(),
        message: `You've reserved ${localMarker.food_type}. You have 2 hours to pick it up before the reservation expires.`,
        severity: "success",
        timestamp: new Date(),
        type: "reservation_expiring",
        read: false,
        marker_info: {
          donator_id: localMarker.donator_user_id,
          reserver_id: currentUserId,
          food_type: localMarker.food_type,
          user_role: "reserver"
        }
      });
      
      // The server will also send a notification via WebSocket
    } catch (err) {
      console.error('MarkerDetail: Reserve failed:', err);
      
      // Check if it's a conflict (someone else already reserved it)
      if (err.response?.status === 409) {
        // Refresh the marker data to show the current state
        try {
          const { data: freshData } = await axios.get(
            `http://localhost:8000/markers/${localMarker.marker_id}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
              },
            }
          );
          setLocalMarker(freshData);
          onReserve?.(freshData);
        } catch (refreshErr) {
          console.error('MarkerDetail: Error refreshing after conflict:', refreshErr);
        }
      }
      
      // Create error notification object
      const errorNotification = {
        id: Date.now(),
        message: 'Could not reserve: ' + (err.response?.data?.detail || err.message),
        severity: 'error',
        timestamp: new Date(),
        type: null,
        read: false
      };
      
      addNotification(errorNotification);
    } finally {
      setIsReserving(false);
    }
  };

  const handlePickup = async () => {
    // Prevent double-clicks or multiple pickups
    if (isPickingUp || isLoading) return;
    
    setIsPickingUp(true);
    console.log('MarkerDetail: Attempting to pick up marker', localMarker.marker_id);
    
    try {
      // Call the pickup API
      const response = await axios.post(
        `http://localhost:8000/markers/${localMarker.marker_id}/pickup`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      
      console.log('MarkerDetail: Pickup successful', response.data);
      
      // Get current user's name
      const username = localStorage.getItem('userName') || 'A user';
      
      // Extract just the first name for the donator's notification
      const firstName = username.split(' ')[0];
      console.log('MarkerDetail: Using first name for donator notification:', firstName);
      
      // 1. Send notification to the donator - with first name only
      addNotification({
        id: Date.now(),
        message: `Your donation of ${localMarker.food_type} was picked up by ${firstName}. Thank you for sharing!`,
        severity: "success",
        timestamp: new Date(),
        type: "food_picked_up_notification",
        read: false,
        marker_info: {
          donator_id: localMarker.donator_user_id,
          reserver_id: currentUserId,
          food_type: localMarker.food_type,
          user_role: "donator"  // Important: This indicates this notification is for the donator
        }
      });
      
      // 2. Send notification to the pickup person (current user) - full name still shown for donator
      addNotification({
        id: Date.now() + 1, // Ensure unique ID
        message: `You've picked up ${localMarker.food_type} from ${localMarker.donator_name}. Enjoy your food!`,
        severity: "success",
        timestamp: new Date(),
        type: "food_pickup_confirmation",
        read: false,
        marker_info: {
          donator_id: localMarker.donator_user_id,
          reserver_id: currentUserId,
          food_type: localMarker.food_type,
          user_role: "reserver"  // Important: This indicates this notification is for the reserver
        }
      });
      
      // Close the marker detail after successful pickup
      onClose();
      
    } catch (err) {
      console.error('MarkerDetail: Error picking up marker:', err);
      
      // Show error notification
      addNotification({
        id: Date.now(),
        message: `Could not pick up food: ${err.response?.data?.detail || err.message}`,
        severity: "error",
        timestamp: new Date(),
        type: null,
        read: false
      });
    } finally {
      setIsPickingUp(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-4 max-w-md w-full" style={{ backgroundColor: '#E1D9D1' }}>
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-xl font-bold" style={{ color: '#5a3812' }}>{localMarker.food_type}</h2>
        <button 
          onClick={onClose}
          className="text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div className="mb-3">
        <p className="text-gray-800">{localMarker.description}</p>
        <p className="text-gray-600 mt-1">
          Quantity: {localMarker.quantity}
        </p>
      </div>
      
      <div className="mb-3">
        <p className="text-gray-600">
          Posted by: {localMarker.donator_name}
        </p>
        <p className="text-gray-600">
          Posted on: {formatDate(localMarker.creation_date)}
        </p>
      </div>
      
      {/* Display tags if they exist */}
      {localMarker.dietary_tags && localMarker.dietary_tags.length > 0 && (
        <div className="mb-3">
          <p className="text-gray-600 mb-1">Dietary Tags:</p>
          <div className="flex flex-wrap gap-1">
            {localMarker.dietary_tags.map(tag => (
              <span key={tag} className="px-2 py-1 text-sm rounded-full" style={{ backgroundColor: 'rgba(34, 49, 29, 0.2)', color: '#22311d' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* If the marker is reserved by current user, show reservation info */}
      {localMarker.status === 'reserved' && localMarker.receiver_user_id === currentUserId && (
        <div className="mt-2 p-2 rounded" style={{ backgroundColor: 'rgba(90, 56, 18, 0.1)' }}>
          <p className="text-gray-700">
            Reserved until: {formatDate(localMarker.reserved_until)}
          </p>
          <p className="text-gray-700">
            Time left: {getTimeLeft()}
          </p>
        </div>
      )}
      
      <div className="flex justify-end gap-2 mt-4">
        {/* Only show reserve button for available markers */}
        {localMarker.status === 'available' && !isDonator && (
          <button
            onClick={handleReserve}
            className={`px-4 py-2 rounded text-white font-medium ${
              isReserving ? 'opacity-70' : 'hover:opacity-90'
            }`}
            style={{ backgroundColor: isReserving ? '#a0a0a0' : '#22311d' }}
            disabled={isReserving}
          >
            {isReserving ? 'Reserving...' : 'Reserve'}
          </button>
        )}
        
        {/* Show pickup button for reserved markers that user has reserved */}
        {localMarker.status === 'reserved' && 
         localMarker.receiver_user_id === currentUserId && (
          <button
            onClick={handlePickup}
            className={`px-4 py-2 rounded text-white font-medium ${
              isPickingUp ? 'opacity-70' : 'hover:opacity-90'
            }`}
            style={{ backgroundColor: isPickingUp ? '#a0a0a0' : '#5a3812' }}
            disabled={isPickingUp}
          >
            {isPickingUp ? 'Processing...' : 'Confirm Pickup'}
          </button>
        )}
      </div>
    </div>
  );
};

MarkerDetail.propTypes = {
  marker: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onReserve: PropTypes.func.isRequired,
};

export default MarkerDetail;