import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNotifications } from '../contexts/NotificationsContext';

const NotificationsHistory = () => {
  const { notifications, markAllNotificationsAsRead, unreadCount, fetchNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const currentUserId = parseInt(localStorage.getItem('userId'), 10);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  
  // Fetch notifications when component mounts to ensure the bell is shown correctly
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchNotifications(token);
    }
  }, [fetchNotifications]);

  // Mark notifications as read when panel is opened
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAllNotificationsAsRead();
    }
  }, [isOpen, unreadCount, markAllNotificationsAsRead]);
  
  // Fetch notifications from the server when the panel is opened
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(localStorage.getItem('accessToken'));
    }
  }, [isOpen, fetchNotifications]);
  
  // Add click outside handler to close the notification panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen && 
        panelRef.current && 
        buttonRef.current && 
        !panelRef.current.contains(event.target) && 
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter notifications to verify they belong to the current user
  const validNotifications = useMemo(() => {
    return notifications.filter(notification => {
      // Check if this notification has marker_info for role-based filtering
      if (notification.marker_info) {
        // For donator-specific notifications, verify the user is the donator
        if (notification.marker_info.user_role === 'donator' && 
            notification.marker_info.donator_id !== currentUserId) {
          return false;
        }
        
        // For reserver-specific notifications, verify the user is the reserver
        if (notification.marker_info.user_role === 'reserver' && 
            notification.marker_info.reserver_id !== currentUserId) {
          return false;
        }
      }
      
      // Also apply content-based filtering as a backup
      if (notification.type === 'donation_reserved' && 
          !notification.message.includes('Someone has reserved your')) {
        return false;
      }
      
      if ((notification.type === 'reservation_expiring' || notification.type === 'food_pickup_confirmation') && 
          !notification.message.includes("You've") && 
          !notification.message.includes("Your food reservation")) {
        return false;
      }
      
      return true;
    });
  }, [notifications, currentUserId]);

  // Sort notifications by timestamp (most recent first)
  const sortedNotifications = [...validNotifications].sort((a, b) => 
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
        ref={buttonRef}
        onClick={togglePanel}
        className="relative p-2 rounded-full text-white hover:bg-[#1a2517]"
        style={{ transition: 'background-color 0.2s ease' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Notification badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-red-500 text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications panel */}
      {isOpen && (
        <div 
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 rounded-md shadow-lg overflow-hidden z-20" 
          style={{ backgroundColor: '#E1D9D1' }}
        >
          <div className="py-2 px-3 border-b border-gray-200" style={{ backgroundColor: '#22311d', color: 'white' }}>
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
                  <li key={notification.id} className="px-4 py-3 hover:bg-opacity-50" style={{ backgroundColor: '#E1D9D1' }}>
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