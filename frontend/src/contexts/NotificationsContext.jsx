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
  'food_pickup_thank_you',
  'donation_reserved',
  'food_pickup_confirmation',
  'reservation_expired',
  'donation_available_again',
  'food_picked_up_notification',
  'marker_expired'
];

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [wsConnection, setWsConnection] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Keep track of recent notifications to prevent duplicates
  const [recentNotifications, setRecentNotifications] = useState([]);
  
  // Check if a notification is a duplicate (same message within last 3 seconds)
  const isDuplicateNotification = useCallback((message) => {
    const now = Date.now();
    // Check for exact message match in recent notifications
    const isDuplicate = recentNotifications.some(
      n => n.message === message && now - n.timestamp < 5000
    );
    
    // Also check for duplicates in existing notifications history
    const isDuplicateInHistory = notifications.some(
      n => n.message === message && now - n.timestamp.getTime() < 5000
    );
    
    return isDuplicate || isDuplicateInHistory;
  }, [recentNotifications, notifications]);
  
  // Add to recent notifications list with auto cleanup
  const trackRecentNotification = useCallback((message) => {
    const notificationTracker = { message, timestamp: Date.now() };
    setRecentNotifications(prev => [...prev, notificationTracker]);
    
    // Clean up old notifications after 5 seconds
    setTimeout(() => {
      setRecentNotifications(prev => 
        prev.filter(n => n !== notificationTracker)
      );
    }, 5000);
  }, []);

  const addNotification = useCallback((notification) => {
    console.log('Adding notification:', notification);
    
    // Prevent duplicate notifications
    if (isDuplicateNotification(notification.message)) {
      console.log('Duplicate notification prevented:', notification.message);
      return;
    }
    
    // Track this notification to prevent duplicates
    trackRecentNotification(notification.message);
    
    // Always add to the popup queue
    setNotificationQueue(prev => [...prev, notification]);
    
    // Only store important notifications in history
    if (notification.type && isImportantNotification(notification.type)) {
      console.log('Adding to notification history:', notification);
      // Always set new notifications as unread
      const newNotification = { ...notification, read: false };
      setNotifications(prev => [...prev, newNotification]);
      // Increment unread count
      setUnreadCount(prev => prev + 1);
      
      // Play a notification sound if available
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Could not play notification sound:', e));
      } catch (e) {
        console.log('Sound notification not supported:', e);
      }
    }
  }, [isDuplicateNotification, trackRecentNotification]);

  // Check if a notification is important enough to store in history
  const isImportantNotification = (notificationType) => {
    return IMPORTANT_NOTIFICATION_TYPES.includes(notificationType);
  };

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
        const formattedNotifications = response.data.map(notification => {
          // Try to extract marker_info from the related_id if possible
          let marker_info = null;
          
          // Extract notification type and message content to determine user roles
          const isReserverMessage = 
            notification.message.includes("You've reserved") || 
            notification.message.includes("Your food reservation") ||
            notification.message.includes("You've picked up");
            
          const isDonatorMessage = 
            notification.message.includes("Someone has reserved your") || 
            notification.message.includes("Your donation of") || 
            notification.message.includes("The reservation for your") ||
            notification.message.includes("Your food has been picked up");  // Check specifically for pickup messages
          
          // If we can determine the role from the message, create a placeholder marker_info
          if (isReserverMessage || isDonatorMessage) {
            marker_info = {
              user_role: isReserverMessage ? 'reserver' : 'donator',
              // We don't have the exact IDs, but we know the current user has the determined role
              donator_id: isDonatorMessage ? parseInt(localStorage.getItem('userId'), 10) : null,
              reserver_id: isReserverMessage ? parseInt(localStorage.getItem('userId'), 10) : null
            };
          }
          
          return {
            id: notification.notification_id,
            message: notification.message,
            severity: notification.severity,
            timestamp: new Date(notification.created_at),
            type: notification.notification_type,
            read: notification.read,
            marker_info: marker_info
          };
        });
        
        setNotifications(formattedNotifications);
        
        // Count unread notifications
        const unreadNotifications = formattedNotifications.filter(n => !n.read);
        setUnreadCount(unreadNotifications.length);
        
        // Specifically check for pickup notifications for donators to ensure they see them
        const hasPickupNotification = formattedNotifications.some(notification => 
          notification.message.includes("Your food has been picked up") ||
          (notification.type === 'food_pickup_confirmation' && 
           notification.marker_info?.user_role === 'donator')
        );
        
        // If there are pickup notifications but they're all marked read,
        // make sure at least one is unread to trigger the red badge
        if (hasPickupNotification && !unreadNotifications.some(n => 
          n.message.includes("Your food has been picked up") || 
          (n.type === 'food_pickup_confirmation' && n.marker_info?.user_role === 'donator'))) {
          // Find the most recent pickup notification
          const pickupNotifications = formattedNotifications.filter(n => 
            n.message.includes("Your food has been picked up") || 
            (n.type === 'food_pickup_confirmation' && n.marker_info?.user_role === 'donator')
          );
          
          if (pickupNotifications.length > 0) {
            // Sort by timestamp, newest first
            pickupNotifications.sort((a, b) => b.timestamp - a.timestamp);
            
            // Mark the most recent one as unread to ensure badge is visible
            const updatedNotifications = formattedNotifications.map(n => 
              n.id === pickupNotifications[0].id ? {...n, read: false} : n
            );
            
            setNotifications(updatedNotifications);
            setUnreadCount(prev => prev + 1);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Process an incoming WebSocket notification
  const processWebSocketNotification = useCallback((data) => {
    console.log('Notifications: Processing new WebSocket notification');
    
    // Check if this is a duplicate before adding
    if (!isDuplicateNotification(data.message)) {
      console.log('Notifications: Adding new notification:', data.message);
      const newNotification = {
        id: Date.now(),
        message: data.message,
        severity: data.severity || 'info',
        timestamp: new Date(),
        type: data.notificationType || null,
        read: false, // Explicitly set to unread
        // Store marker_info to help with role-based filtering
        marker_info: data.marker_info || null
      };
      
      addNotification(newNotification);
      
      // Force update the unread count (additional safety measure)
      if (data.notificationType && isImportantNotification(data.notificationType)) {
        console.log('Notifications: Incrementing unread count for important notification');
        setUnreadCount(prev => prev + 1);
      }
    } else {
      console.log('Notifications: Prevented duplicate WebSocket notification:', data.message);
    }
  }, [isDuplicateNotification, addNotification, isImportantNotification]);

  // Handle WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000; // Start with 3 seconds
    let pingInterval = null;
    let healthCheckInterval = null;
    let isClosing = false;
    let reconnectTimeout = null;
    
    // Function to check backend health
    const checkBackendHealth = async () => {
      try {
        const response = await fetch('http://localhost:8000/');
        return response.ok;
      } catch (error) {
        console.error('Notifications: Backend health check failed:', error);
        return false;
      }
    };

    // Function to establish WebSocket connection
    const establishConnection = async () => {
      // Check backend health before attempting connection
      const isBackendHealthy = await checkBackendHealth();
      if (!isBackendHealthy) {
        console.log('Notifications: Backend not healthy, delaying connection attempt');
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
          reconnectTimeout = setTimeout(() => {
            reconnectAttempts++;
            establishConnection();
          }, delay);
        }
        return;
      }

      if (!wsConnection && token) {
        console.log('Notifications: Initializing WebSocket connection');
        try {
          const ws = new WebSocket('ws://localhost:8000/markers/ws');
          
          ws.onopen = () => {
            console.log('Notifications: WebSocket connected successfully');
            setWsConnection(ws);
            reconnectAttempts = 0; // Reset reconnect attempts on successful connection
            
            // Send authentication immediately after connection
            try {
              ws.send(JSON.stringify({
                type: 'auth',
                token
              }));
              console.log('Notifications: Authentication sent to WebSocket');
              
              // Set up a ping every 30 seconds to keep the connection alive
              pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  try {
                    ws.send(JSON.stringify({ type: 'ping' }));
                    console.log('Notifications: Ping sent');
                  } catch (pingError) {
                    console.error('Notifications: Error sending ping:', pingError);
                    clearInterval(pingInterval);
                    // Don't close the connection on ping error, just clear the interval
                  }
                } else {
                  console.warn('Notifications: Cannot send ping, connection not open');
                  clearInterval(pingInterval);
                }
              }, 30000);

              // Set up health check interval
              healthCheckInterval = setInterval(async () => {
                const isHealthy = await checkBackendHealth();
                if (!isHealthy && ws.readyState === WebSocket.OPEN) {
                  console.log('Notifications: Backend health check failed, closing connection');
                  safeClose(1006, 'Backend health check failed');
                }
              }, 60000); // Check every minute
            } catch (authError) {
              console.error('Notifications: Error sending authentication to WebSocket:', authError);
              safeClose(4000, 'Authentication error');
            }
          };
          
          ws.onerror = (error) => {
            console.error('Notifications: WebSocket error:', {
              readyState: ws.readyState,
              url: ws.url,
              timestamp: new Date().toISOString(),
              error: error
            });
            
            // Log the WebSocket state
            const states = {
              0: 'CONNECTING',
              1: 'OPEN',
              2: 'CLOSING',
              3: 'CLOSED'
            };
            console.log(`Notifications: WebSocket state at error: ${states[ws.readyState]}`);
          };
          
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log('Notifications: Received WebSocket message type:', data.type);
              
              if (data.type === 'notification') {
                // First check if this notification is meant for this user
                if (!data.user_id || parseInt(data.user_id, 10) === userId) {
                  console.log('Notifications: Received notification for current user');
                  
                  // Get current user id for role verification
                  const currentUserId = parseInt(localStorage.getItem('userId'), 10);
                  
                  // Additional verification to prevent wrong message showing to wrong user
                  let shouldShowNotification = true;
                  
                  // If we have marker_info, use it for more precise verification
                  if (data.marker_info) {
                    console.log('Notifications: Verifying role using marker_info:', data.marker_info);
                    
                    // Check user role match
                    if (data.marker_info.user_role === 'donator' && data.marker_info.donator_id !== currentUserId) {
                      console.log('Notifications: Filtering notification: user is not the donator');
                      shouldShowNotification = false;
                    }
                    
                    if (data.marker_info.user_role === 'reserver' && data.marker_info.reserver_id !== currentUserId) {
                      console.log('Notifications: Filtering notification: user is not the reserver');
                      shouldShowNotification = false;
                    }
                  } 
                  // Fallback to text-based filtering if no marker_info
                  else {
                    // For reservation notifications, verify content matches role
                    if (data.notificationType === 'donation_reserved') {
                      // This type is only for donators
                      if (!data.message.includes("Someone has reserved your")) {
                        console.log('Notifications: Filtering out wrong reservation notification for donator');
                        shouldShowNotification = false;
                      }
                    }
                    
                    if (data.notificationType === 'reservation_expiring') {
                      // This type is only for reservers
                      if (!data.message.includes("You've reserved") && !data.message.includes("Your food reservation")) {
                        console.log('Notifications: Filtering out wrong reservation notification for reserver');
                        shouldShowNotification = false;
                      }
                    }
                  }
                  
                  // Only show the notification if it passed our role check
                  if (shouldShowNotification) {
                    processWebSocketNotification(data);
                  } else {
                    console.log('Notifications: Notification filtered out based on role check');
                  }
                } else {
                  console.log('Notifications: Ignoring notification for different user');
                }
              } else if (data.type === 'auth_success') {
                console.log('Notifications: WebSocket authenticated for user ID:', data.user_id);
              } else if (data.type === 'auth_error') {
                console.error('Notifications: WebSocket authentication error:', data.message);
                safeClose(4000, 'Authentication error');
              }
            } catch (parseError) {
              console.error('Notifications: Error parsing WebSocket message:', parseError, event.data);
            }
          };
          
          ws.onclose = (event) => {
            console.log(`Notifications: WebSocket disconnected with code ${event.code}, reason: ${event.reason}`);
            setWsConnection(null);
            
            // Clear intervals
            if (pingInterval) {
              clearInterval(pingInterval);
              pingInterval = null;
            }
            if (healthCheckInterval) {
              clearInterval(healthCheckInterval);
              healthCheckInterval = null;
            }
            
            // Clear any existing reconnect timeout
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = null;
            }
            
            // Try to reconnect after a delay if user is still logged in
            // and it wasn't an intentional close
            if (!isClosing && event.code !== 1000 && localStorage.getItem('accessToken')) {
              if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts); // Exponential backoff
                console.log(`Notifications: Scheduling WebSocket reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`);
                reconnectTimeout = setTimeout(() => {
                  reconnectAttempts++;
                  establishConnection();
                }, delay);
              } else {
                console.log('Notifications: Max reconnection attempts reached, giving up');
              }
            }
          };
          
          // Safe close method that won't throw if already closing/closed
          const safeClose = (code = 1000, reason = 'Cleanup') => {
            if (!isClosing && ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
              try {
                isClosing = true;
                ws.close(code, reason);
              } catch (error) {
                console.error('Notifications: Error closing WebSocket connection:', error);
              }
            }
          };
          
          return safeClose;
        } catch (connectionError) {
          console.error('Notifications: Error establishing WebSocket connection:', connectionError);
          // Schedule retry with exponential backoff
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
            console.log(`Notifications: Scheduling initial connection retry ${reconnectAttempts + 1} in ${delay}ms`);
            reconnectTimeout = setTimeout(() => {
              reconnectAttempts++;
              establishConnection();
            }, delay);
          }
          return null;
        }
      }
    };

    // Initial connection attempt
    const closeFunc = establishConnection();
    
    return () => {
      // Clear intervals
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
      
      // Clear any pending reconnect timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      // Use the safe close function if available
      if (typeof closeFunc === 'function') {
        closeFunc(1000, 'Component unmounted');
      }
    };
  }, [wsConnection, userId, isDuplicateNotification, processWebSocketNotification]);

  // Immediately auto-reconnect if WebSocket connection fails
  useEffect(() => {
    if (wsConnection) {
      // Test if the connection is still alive
      const testConnection = () => {
        if (wsConnection.readyState !== WebSocket.OPEN) {
          console.log("Notifications: WebSocket not open, reconnecting...");
          setWsConnection(null); // This will trigger reconnection
        }
      };
      
      // Test connection every 30 seconds
      const intervalId = setInterval(testConnection, 30000);
      
      return () => clearInterval(intervalId);
    }
  }, [wsConnection]);

  // Process the notification queue
  useEffect(() => {
    if (notificationQueue.length > 0 && !isOpen) {
      const nextNotification = notificationQueue[0];
      setCurrentNotification(nextNotification);
      setIsOpen(true);
      setNotificationQueue(prevQueue => prevQueue.slice(1));
    }
  }, [notificationQueue, isOpen]);

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