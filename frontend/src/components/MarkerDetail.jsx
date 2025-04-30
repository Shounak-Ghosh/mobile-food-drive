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

  const formatDate = (dateString) => new Date(dateString).toLocaleString();

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
      
      // The server will send notification via WebSocket
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
      await axios.post(
        `http://localhost:8000/markers/${localMarker.marker_id}/pickup`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      
      console.log('MarkerDetail: Pickup successful');
      
      // The server will send notification via WebSocket
      
      // Close the detail view since the marker will be removed from the map
      onClose();
    } catch (err) {
      console.error('MarkerDetail: Pickup failed:', err);
      
      // Create error notification object
      const errorNotification = {
        id: Date.now(),
        message: 'Could not mark as picked up: ' + (err.response?.data?.detail || err.message),
        severity: 'error',
        timestamp: new Date(),
        type: null,
        read: false
      };
      
      addNotification(errorNotification);
    } finally {
      setIsPickingUp(false);
    }
  };

  // Check if the marker is already reserved by someone else
  const isReservedByOthers = localMarker.status === 'reserved' && localMarker.receiver_user_id !== currentUserId;

  return (
    <div className="bg-white rounded-lg p-4 shadow-lg max-w-md w-full" style={{ backgroundColor: '#E1D9D1' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-xl font-bold">{localMarker.food_type}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
               viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-2 right-10 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-green-900"></div>
        </div>
      )}

      {/* Body */}
      <div className="mb-3">
        <p className="text-gray-700">{localMarker.description}</p>
        <p className="text-sm text-gray-600 mt-1">Quantity: {localMarker.quantity}</p>
      </div>

      <div className="mb-3">
        <p className="text-sm text-gray-600">Posted by: {localMarker.donator_name}</p>
        <p className="text-sm text-gray-600">Posted on: {formatDate(localMarker.creation_date)}</p>
        {isReservedByOthers && (
          <p className="text-sm text-red-600 font-semibold mt-1">This item has been reserved by someone else</p>
        )}
      </div>

      {localMarker.dietary_tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {localMarker.dietary_tags.map(tag => (
            <span key={tag}
                  className="px-2 py-1 text-xs rounded-full"
                  style={{ backgroundColor: '#22311d', color: 'white' }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Reserve/Pickup button or Time Left */}
      <div className="mt-2">
        {localMarker.status === 'available' && !isDonator && !isReservedByOthers && (
          <div className="flex justify-end">
            <button
              onClick={handleReserve}
              disabled={isReserving || isLoading}
              className={`px-4 py-2 text-white rounded hover:opacity-90 ${(isReserving || isLoading) ? 'opacity-70 cursor-not-allowed' : ''}`}
              style={{ backgroundColor: '#5a3812' }}
            >
              {isReserving ? 'Reserving...' : 'Reserve'}
            </button>
          </div>
        )}

        {localMarker.receiver_user_id === currentUserId && localMarker.status === 'reserved' && (
          <div>
            <p className="text-sm text-gray-600">
              Reserved until: {formatDate(localMarker.reserved_until)}
            </p>
            <p className={`text-sm ${getTimeLeft() === 'Expired' ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
              Time left: {getTimeLeft()}
            </p>
            <div className="flex justify-end mt-2">
              <button
                onClick={handlePickup}
                disabled={isPickingUp || isLoading}
                className={`px-4 py-2 text-white rounded hover:opacity-90 ${(isPickingUp || isLoading) ? 'opacity-70 cursor-not-allowed' : ''}`}
                style={{ backgroundColor: '#5a3812' }}
              >
                {isPickingUp ? 'Processing...' : 'Mark as Picked Up'}
              </button>
            </div>
          </div>
        )}

        {localMarker.status === 'reserved' && localMarker.receiver_user_id !== currentUserId && (
          <div>
            <p className="text-sm text-gray-600">
              Reserved until: {formatDate(localMarker.reserved_until)}
            </p>
            <p className={`text-sm ${getTimeLeft() === 'Expired' ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
              Time left: {getTimeLeft()}
            </p>
            <p className="text-sm text-red-600 mt-1">
              This item has been reserved by someone else
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

MarkerDetail.propTypes = {
  marker: PropTypes.shape({
    marker_id: PropTypes.number.isRequired,
    donator_user_id: PropTypes.number.isRequired,
    donator_name: PropTypes.string.isRequired,
    latitude: PropTypes.number.isRequired,
    longitude: PropTypes.number.isRequired,
    creation_date: PropTypes.string.isRequired, 
    status: PropTypes.string.isRequired,
    updated_at: PropTypes.string.isRequired,
    reserved_until: PropTypes.string,
    food_type: PropTypes.string.isRequired,
    quantity: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    dietary_tags: PropTypes.array,
    receiver_user_id: PropTypes.number
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onReserve: PropTypes.func
};

export default MarkerDetail;
