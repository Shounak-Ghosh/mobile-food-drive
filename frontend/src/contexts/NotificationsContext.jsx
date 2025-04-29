import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Notification from '../components/Notification';

// Create the context
const NotificationsContext = createContext();

// Custom hook to use notifications
export const useNotifications = () => useContext(NotificationsContext);

// Notification types that should be stored in history
const IMPORTANT_NOTIFICATION_TYPES = [
  'reservation_expiring', 
  'food_expiring',
  'pickup_reminder',
  'food_pickup_thank_you'
];

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [wsConnection, setWsConnection] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Handle authentication state changes
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedUserId = localStorage.getItem('userId');
    
    if (storedUserId) {
      setUserId(parseInt(storedUserId, 10));
      
      // Fetch notifications from backend if user is logged in
      if (token) {
        fetchNotifications(token);
      }
    }
    
    // Listen for storage events (for logout across tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'userId' || e.key === 'accessToken') {
        if (!e.newValue) {
          // Token was removed, update state
          setUserId(null);
          setNotifications([]);
          setUnreadCount(0);
          if (wsConnection) {
            wsConnection.close();
            setWsConnection(null);
          }
        } else if (e.key === 'userId' && e.newValue) {
          setUserId(parseInt(e.newValue, 10));
          // Fetch notifications when logged in on another tab
          const token = localStorage.getItem('accessToken');
          if (token) {
            fetchNotifications(token);
          }
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [wsConnection]);

  // Fetch stored notifications from the backend
  const fetchNotifications = async (token) => {
    try {
      const response = await axios.get('http://localhost:8000/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data && Array.isArray(response.data)) {
        // Format backend notifications to match local format
        const formattedNotifications = response.data.map(notification => ({
          id: notification.notification_id,
          message: notification.message,
          severity: notification.severity,
          timestamp: new Date(notification.created_at),
          type: notification.notification_type,
          read: notification.read
        }));
        
        setNotifications(formattedNotifications);
        
        // Count unread notifications
        const unreadNotifications = formattedNotifications.filter(n => !n.read);
        setUnreadCount(unreadNotifications.length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Handle WebSocket connection
  useEffect(() => {
    if (!wsConnection) {
      const ws = new WebSocket('ws://localhost:8000/markers/ws');
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnection(ws);
        
        // Send authentication if we have a token
        const token = localStorage.getItem('accessToken');
        if (token) {
          ws.send(JSON.stringify({
            type: 'auth',
            token
          }));
        }
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'notification') {
          // Check if notification is for current user or a general broadcast
          if (!data.user_id || data.user_id === userId) {
            addNotification(data.message, data.severity || 'info', data.notificationType);
          }
        } else if (data.type === 'auth_success') {
          console.log('WebSocket authenticated for user ID:', data.user_id);
        } else if (data.type === 'auth_error') {
          console.error('WebSocket authentication error:', data.message);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnection(null);
        
        // Try to reconnect after a delay if user is still logged in
        if (localStorage.getItem('accessToken')) {
          setTimeout(() => {
            setWsConnection(null); // This will trigger reconnection
          }, 5000);
        }
      };
      
      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    }
  }, [wsConnection, userId]);

  // Process the notification queue
  useEffect(() => {
    if (notificationQueue.length > 0 && !isOpen) {
      const nextNotification = notificationQueue[0];
      setCurrentNotification(nextNotification);
      setIsOpen(true);
      setNotificationQueue(prevQueue => prevQueue.slice(1));
    }
  }, [notificationQueue, isOpen]);

  // Check if a notification is important enough to store in history
  const isImportantNotification = (notificationType) => {
    return IMPORTANT_NOTIFICATION_TYPES.includes(notificationType);
  };

  const addNotification = useCallback((message, severity = 'info', notificationType = null) => {
    const newNotification = {
      id: Date.now(),
      message,
      severity,
      timestamp: new Date(),
      type: notificationType,
      read: false
    };
    
    // Always add to the popup queue
    setNotificationQueue(prev => [...prev, newNotification]);
    
    // Only store important notifications in history
    if (isImportantNotification(notificationType)) {
      setNotifications(prev => [...prev, newNotification]);
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => {
      const notificationToRemove = prev.find(notification => notification.id === id);
      if (notificationToRemove && !notificationToRemove.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(notification => notification.id !== id);
    });
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    // Update local state
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
    setUnreadCount(0);
    
    // Also update on the backend
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        await axios.post('http://localhost:8000/notifications/mark-read', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Error marking notifications as read on server:', error);
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    // Wait a bit before processing the next notification
    setTimeout(() => {
      setCurrentNotification(null);
    }, 300);
  }, []);

  // Value to be provided
  const value = {
    notifications,
    addNotification,
    removeNotification,
    markAllNotificationsAsRead,
    unreadCount,
    fetchNotifications
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {currentNotification && (
        <Notification
          open={isOpen}
          onClose={handleClose}
          message={currentNotification.message}
          severity={currentNotification.severity}
        />
      )}
    </NotificationsContext.Provider>
  );
};

export default NotificationsContext; 