import React from 'react';
import axios from 'axios';

const MarkerDetail = ({ marker, onClose }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <div className="bg-white rounded-lg p-4 shadow-lg max-w-md w-full">
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-xl font-bold">{marker.food_type}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="mb-3">
        <p className="text-gray-700">{marker.description}</p>
        <p className="text-sm text-gray-600 mt-1">
          Quantity: {marker.quantity}
        </p>
      </div>
      
      <div className="mb-3">
        <p className="text-sm text-gray-600">
          Posted by: {marker.donator_name}
        </p>
        <p className="text-sm text-gray-600">
          Posted on: {formatDate(marker.creation_date)}
        </p>
      </div>
      
      {/* Display dietary tags if they exist */}
      {marker.dietary_tags && marker.dietary_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {marker.dietary_tags.map(tag => (
            <span key={tag} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
      
      <div className="flex justify-end gap-2">
        {!marker.receiver_user_id && (
          <button
            onClick={async () => {
              try {
                const userId = localStorage.getItem('userId');
                if (!userId) {
                  alert('You must be logged in to reserve a donation');
                  return;
                }
                
                await axios.patch(`/api/markers/${marker.marker_id}`, {
                  receiver_user_id: parseInt(userId)
                });
                // You might want to update the UI or close the detail view
              } catch (error) {
                console.error('Error reserving marker:', error);
                alert('Failed to reserve donation. Please try again.');
              }
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Reserve
          </button>
        )}
      </div>
    </div>
  );
};

export default MarkerDetail;