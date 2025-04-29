import React, { useState, useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationsContext';

const NotificationsHistory = () => {
  const { notifications, markAllNotificationsAsRead, unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  // Mark notifications as read when panel is opened
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAllNotificationsAsRead();
    }
  }, [isOpen, unreadCount, markAllNotificationsAsRead]);

  // Sort notifications by timestamp (most recent first)
  const sortedNotifications = [...notifications].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'error': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'success': return 'bg-green-100 text-green-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      {/* Button to toggle notifications panel */}
      <button
        onClick={togglePanel}
        className="relative p-2 rounded-full text-gray-600 hover:bg-gray-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Notification badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 px-2 py-1 text-xs font-bold rounded-full bg-red-500 text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-20">
          <div className="py-2 px-3 bg-gray-100 border-b border-gray-200">
            <h3 className="text-sm font-medium">Notifications</h3>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {sortedNotifications.length === 0 ? (
              <div className="py-6 px-4 text-center text-gray-500">
                No notifications yet
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {sortedNotifications.map(notification => (
                  <li key={notification.id} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <span className={`inline-block h-2 w-2 rounded-full ${getSeverityColor(notification.severity)}`}></span>
                      </div>
                      <div className="ml-3 w-0 flex-1">
                        <p className="text-sm text-gray-900">{notification.message}</p>
                        <p className="text-xs text-gray-500">{formatTime(notification.timestamp)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsHistory; 