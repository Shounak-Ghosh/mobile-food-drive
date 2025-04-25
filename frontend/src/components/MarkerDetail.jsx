import React, { useCallback } from 'react';
import axios from 'axios';

const MarkerDetail = ({ marker, onClose, onReserve }) => {
  const currentUserId = parseInt(localStorage.getItem('userId'), 10);
  const isDonator = marker.donator_user_id === currentUserId;

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
    } catch (err) {
      alert('Could not reserve: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-lg max-w-md w-full">
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
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Reserve button or Time Left */}
      {!marker.receiver_user_id && !isDonator && (
        <div className="flex justify-end">
          <button
            onClick={handleReserve}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Reserve
          </button>
        </div>
      )}

      {marker.receiver_user_id && (
        <div className="mt-2">
          <p className="text-sm text-gray-600">
            Reserved until: {formatDate(marker.reserved_until)}
          </p>
          <p className="text-sm text-gray-600">
            Time left: {getTimeLeft()}
          </p>
        </div>
      )}
    </div>
  );
};

export default MarkerDetail;
