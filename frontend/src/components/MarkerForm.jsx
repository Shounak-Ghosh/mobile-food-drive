import React, { useState } from 'react';
import axios from 'axios';

const MarkerForm = ({ onClose, position, onMarkerAdded }) => {
  const [formData, setFormData] = useState({
    food_type: '',
    quantity: '',
    description: '',
    dietary_tags: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dietaryOptions = [
    'vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free', 
    'dairy-free', 'nut-free', 'organic', 'non-perishable'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tag) => {
    setFormData(prev => {
      const currentTags = [...prev.dietary_tags];
      if (currentTags.includes(tag)) {
        return { ...prev, dietary_tags: currentTags.filter(t => t !== tag) };
      } else {
        return { ...prev, dietary_tags: [...currentTags, tag] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Add console.log to debug the request
      console.log('Submitting marker with position:', position);
      
      const { data } = await axios.post('/api/markers', {
        latitude: position.lat,
        longitude: position.lng,
        food_display_info: {
          food_type: formData.food_type,
          quantity: formData.quantity,
          description: formData.description,
          dietary_tags: formData.dietary_tags  // Include dietary tags in food_display_info
        }
      });
      
      onMarkerAdded(data);
      onClose();
    } catch (err) {
      console.error('Error creating marker:', err);
      setError(`Failed to create marker: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Food Donation</h2>
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {/* Location display */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Location</label>
            <div className="p-2 bg-gray-100 rounded">
              <p className="text-sm">Latitude: {position.lat.toFixed(6)}</p>
              <p className="text-sm">Longitude: {position.lng.toFixed(6)}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This is where your donation will appear on the map
            </p>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Food Type</label>
            <input
              type="text"
              name="food_type"
              value={formData.food_type}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
              placeholder="e.g., Vegetables, Canned Goods"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Quantity</label>
            <input
              type="text"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
              placeholder="e.g., 2 bags, 5 cans"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              rows="3"
              required
              placeholder="Describe the food items you're donating"
            ></textarea>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Dietary Tags</label>
            <div className="flex flex-wrap gap-2">
              {dietaryOptions.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`px-3 py-1 rounded-full text-sm ${
                    formData.dietary_tags.includes(tag)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-100"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Donation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MarkerForm;
