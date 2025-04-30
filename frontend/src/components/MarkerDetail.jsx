import React, { useCallback } from 'react';
import axios from 'axios';
import { useNotifications } from '../contexts/NotificationsContext';

const MarkerDetail = ({ marker, onClose, onReserve }) => {
  const currentUserId = parseInt(localStorage.getItem('userId'), 10);
  const isDonator = marker.donator_user_id === currentUserId;
  const isReserver = marker.receiver_user_id === currentUserId;
  const { addNotification } = useNotifications();

  const formatDate = (dateString) => new Date(dateString).toLocaleString();

  const getTimeLeft = useCallback(() => {
    if (!marker.reserved_until) return null;
    const diffMs = new Date(marker.reserved_until) - new Date();
    if (diffMs <= 0) return 'Expired';
    const mins = Math.ceil(diffMs / 60000);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      return `${hrs}h ${rem}m`;
    }
    return `${mins}m`;
  }, [marker.reserved_until]);

  const handleReserve = async () => {
    try {
      const { data: updated } = await axios.patch(
        `http://localhost:8000/markers/${marker.marker_id}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      onReserve?.(updated);
      
      // Show a notification when food is reserved
      addNotification(
        `You've reserved ${marker.food_type}. Please pick it up within 2 hours.`,
        'success',
        'reservation_expiring'
      );
    } catch (err) {
      addNotification(
        'Could not reserve: ' + (err.response?.data?.detail || err.message),
        'error'
      );
    }
  };

  const handlePickup = async () => {
    try {
      await axios.post(
        `http://localhost:8000/markers/${marker.marker_id}/pickup`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      
      // Show success notification
      addNotification(
        `You've picked up ${marker.food_type}. Thank you message sent to ${marker.donator_name}. Enjoy!`,
        'success',
        null // Not an important notification that needs to be stored
      );
      
      // Close the detail view since the marker will be removed from the map
      onClose();
    } catch (err) {
      addNotification(
        'Could not mark as picked up: ' + (err.response?.data?.detail || err.message),
        'error',
        null
      );
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-lg max-w-md w-full" style={{ backgroundColor: '#E1D9D1' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-xl font-bold">{marker.food_type}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
               viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="mb-3">
        <p className="text-gray-700">{marker.description}</p>
        <p className="text-sm text-gray-600 mt-1">Quantity: {marker.quantity}</p>
      </div>

      <div className="mb-3">
        <p className="text-sm text-gray-600">Posted by: {marker.donator_name}</p>
        <p className="text-sm text-gray-600">Posted on: {formatDate(marker.creation_date)}</p>
      </div>

      {marker.dietary_tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {marker.dietary_tags.map(tag => (
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
        {!marker.receiver_user_id && !isDonator && (
          <div className="flex justify-end">
            <button
              onClick={handleReserve}
              className="px-4 py-2 text-white rounded hover:opacity-90"
              style={{ backgroundColor: '#5a3812' }}
            >
              Reserve
            </button>
          </div>
        )}

        {marker.receiver_user_id && isReserver && (
          <div>
            <p className="text-sm text-gray-600">
              Reserved until: {formatDate(marker.reserved_until)}
            </p>
            <p className={`text-sm ${getTimeLeft() === 'Expired' ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
              Time left: {getTimeLeft()}
            </p>
            <div className="flex justify-end mt-2">
              <button
                onClick={handlePickup}
                className="px-4 py-2 text-white rounded hover:opacity-90"
                style={{ backgroundColor: '#5a3812' }}
              >
                Mark as Picked Up
              </button>
            </div>
          </div>
        )}

        {marker.receiver_user_id && !isReserver && (
          <div>
            <p className="text-sm text-gray-600">
              Reserved until: {formatDate(marker.reserved_until)}
            </p>
            <p className={`text-sm ${getTimeLeft() === 'Expired' ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
              Time left: {getTimeLeft()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkerDetail;
