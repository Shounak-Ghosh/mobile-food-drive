import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Typography,
  Card,
  CardContent,
  Divider,
  Button,
  Chip,
  Box,
  Grid,
  Paper,
  Avatar,
  TextField,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Tab,
  Tabs,
  Drawer,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { 
  Person as PersonIcon, 
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  LocationOn as LocationIcon,
  Restaurant as RestaurantIcon,
  History as HistoryIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../themes/LoginRegisterTheme';
import Notification from '../components/Notification';

const dietaryOptions = [
  'vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free',
  'dairy-free', 'nut-free', 'organic', 'non-perishable'
];

const AccountDetails = () => {
  const [donations, setDonations] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [tabValue, setTabValue] = useState(0);
  const [userData, setUserData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [updatedUserData, setUpdatedUserData] = useState(null);
  const [dietaryPreferencesOpen, setDietaryPreferencesOpen] = useState(false);
  const [dietaryPreferences, setDietaryPreferences] = useState([]);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');
  const userId = parseInt(localStorage.getItem('userId'), 10);
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch main user data
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch user profile data
        const userRes = await axios.get('http://localhost:8000/auth/me', { headers });
        setUserData(userRes.data);
        
        // Set dietary preferences from user data if available
        if (userRes.data.dietary_tags) {
          setDietaryPreferences(userRes.data.dietary_tags);
        }
        
        // Fetch other data in parallel
        const [donRes, resRes] = await Promise.all([
          axios.get('http://localhost:8000/markers/donated', { headers }),
          axios.get('http://localhost:8000/markers/reserved', { headers }),
        ]);

        setDonations(donRes.data);
        setReservations(resRes.data);
      } catch (err) {
        console.error(err);
        setNotification({
          open: true,
          message: 'Error loading account details. Please try again.',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Lazy load transaction history when tab 2 is selected
  useEffect(() => {
    const loadTransactions = async () => {
      if (tabValue === 2 && !transactionsLoaded) {
        setLoading(true);
        try {
          const txRes = await axios.get('http://localhost:8000/transactions/user', { headers });
          const detailedTx = await Promise.all(
            txRes.data.map(async (tx) => {
              const m = await axios.get(
                `http://localhost:8000/markers/${tx.marker_id}`,
                { headers }
              );
              return { ...tx, marker: m.data };
            })
          );
          detailedTx.sort((a, b) => new Date(b.pickup_time) - new Date(a.pickup_time));
          setTransactions(detailedTx);
          setTransactionsLoaded(true);
        } catch (err) {
          console.error(err);
          setNotification({
            open: true,
            message: 'Error loading transaction history. Please try again.',
            severity: 'error'
          });
        } finally {
          setLoading(false);
        }
      }
    };
    loadTransactions();
  }, [tabValue, transactionsLoaded]);

  // Close sidebar on mobile when tab changes
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [tabValue, isMobile]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handlePickup = async (markerId) => {
    try {
      await axios.post(
        `http://localhost:8000/markers/${markerId}/pickup`,
        {},
        { headers }
      );
      setReservations((r) => r.filter((m) => m.marker_id !== markerId));
      const txRes = await axios.get('http://localhost:8000/transactions/user', { headers });
      const detailedTx = await Promise.all(
        txRes.data.map(async (tx) => {
          const m = await axios.get(
            `http://localhost:8000/markers/${tx.marker_id}`,
            { headers }
          );
          return { ...tx, marker: m.data };
        })
      );
      // Resort after pickup
      detailedTx.sort((a, b) => new Date(b.pickup_time) - new Date(a.pickup_time));
      setTransactions(detailedTx);
      
      setNotification({
        open: true,
        message: 'Pickup confirmed successfully!',
        severity: 'success'
      });
    } catch (err) {
      console.error(err);
      setNotification({
        open: true,
        message: 'Could not confirm pickup.',
        severity: 'error'
      });
    }
  };

  const goHome = () => navigate('/landing');

  const handleDietaryPreferencesOpen = () => {
    setDietaryPreferencesOpen(true);
  };

  const handleDietaryPreferencesClose = () => {
    setDietaryPreferencesOpen(false);
  };

  const handleDietaryPreferenceToggle = (preference) => {
    if (dietaryPreferences.includes(preference)) {
      setDietaryPreferences(dietaryPreferences.filter(p => p !== preference));
    } else {
      setDietaryPreferences([...dietaryPreferences, preference]);
    }
  };

  const saveDietaryPreferences = async () => {
    setSavingPreferences(true);
    try {
      // This is a mock implementation - you would need to create this endpoint
      await axios.post('http://localhost:8000/users/preferences', 
        { dietaryPreferences }, 
        { headers }
      );
      
      setDietaryPreferencesOpen(false);
      setNotification({
        open: true,
        message: 'Dietary preferences updated successfully!',
        severity: 'success'
      });
    } catch (err) {
      console.error(err);
      setNotification({
        open: true,
        message: 'Could not update dietary preferences.',
        severity: 'error'
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userId");
    navigate("/login", {
      state: { message: "Successfully logged out", severity: "success" },
    });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Filter to show only available and reserved items in current donations
  const currentReservations = [
    ...donations.filter((m) => m.status !== 'picked_up' && m.status !== 'expired'),
    ...reservations.filter((m) => m.status !== 'expired')
  ];

  // Add expired donations to transaction history for display purposes
  const allTransactionHistory = [
    ...transactions,
    ...donations.filter((m) => m.status === 'expired').map(m => ({
      transaction_id: `expired-${m.marker_id}`, // Create a unique ID
      pickup_time: m.updated_at, // Use the last update time
      marker: m, // Include the full marker data
      transaction_type: 'expired' // Add a type to differentiate
    }))
  ];
  
  // Sort the combined transaction history by date
  allTransactionHistory.sort((a, b) => {
    const dateA = new Date(a.pickup_time || a.marker.updated_at);
    const dateB = new Date(b.pickup_time || b.marker.updated_at);
    return dateB - dateA; // Most recent first
  });

  const SidebarContent = () => (
    <div
      className="flex flex-col p-4 h-full"
      style={{
        backgroundColor: '#22311d',
        color: 'white',
        width: '240px',
      }}
    >
      <div className="flex items-center mb-8">
        <IconButton color="inherit" onClick={goHome} className="mr-2">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" className="text-white">Home Page</Typography>
      </div>
      
      <button
        className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-3 rounded flex items-center"
        onClick={() => setTabValue(0)}
      >
        <PersonIcon className="mr-2" />
        Profile
      </button>
      <button
        className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-3 rounded flex items-center"
        onClick={() => setTabValue(1)}
      >
        <RestaurantIcon className="mr-2" />
        Current Donations
      </button>
      <button
        className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-3 rounded flex items-center"
        onClick={() => setTabValue(2)}
      >
        <HistoryIcon className="mr-2" />
        Transaction History
      </button>
      <button
        className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-3 rounded flex items-center"
        onClick={handleDietaryPreferencesOpen}
      >
        <RestaurantIcon className="mr-2" />
        Dietary Preferences
      </button>
      <div className="mt-auto">
        <button
          className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded w-full"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <ThemeProvider theme={theme}>
      <div className="flex min-h-screen" style={{ backgroundColor: '#E1D9D1' }}>
        {/* Desktop Sidebar */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <SidebarContent />
        </Box>

        {/* Mobile Sidebar */}
        <Drawer
          variant="temporary"
          anchor="left"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box',
              width: 240,
              backgroundColor: '#22311d',
            },
          }}
        >
          <SidebarContent />
        </Drawer>

        <Notification
          open={notification.open}
          onClose={() => setNotification({...notification, open: false})}
          message={notification.message}
          severity={notification.severity}
        />

        {/* Main Content Area */}
        <div className="flex-1 p-8 overflow-auto">
          {/* Mobile Menu Button */}
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
            <IconButton 
              onClick={toggleSidebar}
              sx={{ color: '#5a3812' }}
            >
              <MenuIcon />
            </IconButton>
          </Box>

          {loading ? (
            <div className="flex justify-center items-center h-full">
              <CircularProgress style={{ color: '#8B4513' }} />
            </div>
          ) : (
            <>
              {/* Mobile Tabs */}
              <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={tabValue} 
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    '& .MuiTab-root': { color: '#5a3812' },
                    '& .Mui-selected': { color: '#22311d !important', fontWeight: 'bold' },
                    '& .MuiTabs-indicator': { backgroundColor: '#22311d' }
                  }}
                >
                  <Tab label="Profile" />
                  <Tab label="Current Donations" />
                  <Tab label="Transaction History" />
                </Tabs>
              </Box>
              
              {/* Profile Tab */}
              {tabValue === 0 && userData && (
                <div>
                  <Typography variant="h4" className="mb-6" style={{ color: '#5a3812' }}>
                    My Profile
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Card elevation={3} className="p-4" style={{ backgroundColor: '#E1D9D1' }}>
                        <Box className="flex flex-col items-center text-center p-3">
                          <Avatar
                            style={{ 
                              width: 100, 
                              height: 100, 
                              backgroundColor: '#22311d',
                              fontSize: 40
                            }}
                          >
                            {userData.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="h5" className="mt-3 font-bold">
                            {userData.name}
                          </Typography>
                          <Typography color="textSecondary">
                            {userData.email}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" className="mt-2">
                            Member since {new Date(userData.account_creation_date).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={8}>
                      <Card elevation={3} style={{ backgroundColor: '#E1D9D1' }}>
                        <CardContent>
                          <Typography variant="h6" className="mb-4">
                            Account Information
                          </Typography>
                          
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="textSecondary">
                                Name
                              </Typography>
                              <Typography variant="body1" className="mb-3">
                                {userData.name}
                              </Typography>
                            </Grid>
                            
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="textSecondary">
                                Email
                              </Typography>
                              <Typography variant="body1" className="mb-3">
                                {userData.email}
                              </Typography>
                            </Grid>
                            
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" color="textSecondary">
                                Dietary Preferences
                              </Typography>
                              <Box className="mt-2 mb-3">
                                {dietaryPreferences && dietaryPreferences.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {dietaryPreferences.map(pref => (
                                      <Chip 
                                        key={pref} 
                                        label={pref} 
                                        size="small"
                                        sx={{ backgroundColor: '#22311d', color: 'white' }}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <Typography variant="body2" color="textSecondary">
                                    No dietary preferences set
                                  </Typography>
                                )}
                              </Box>
                              <Button 
                                variant="outlined" 
                                size="small"
                                onClick={handleDietaryPreferencesOpen}
                                startIcon={<EditIcon />}
                                sx={{ 
                                  color: '#5a3812', 
                                  borderColor: '#5a3812',
                                  '&:hover': { 
                                    borderColor: '#22311d', 
                                    backgroundColor: 'rgba(34, 49, 29, 0.04)'
                                  }
                                }}
                              >
                                Edit Preferences
                              </Button>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                      
                      <Card elevation={3} className="mt-4" style={{ backgroundColor: '#E1D9D1' }}>
                        <CardContent>
                          <Typography variant="h6" className="mb-3">
                            Activity Summary
                          </Typography>
                          
                          <Grid container spacing={3}>
                            <Grid item xs={12} sm={4}>
                              <Paper elevation={0} className="p-3 text-center" style={{ backgroundColor: 'rgba(34, 49, 29, 0.1)' }}>
                                <Typography variant="h4" style={{ color: '#22311d' }}>
                                  {donations.length}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                  Donations Made
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Paper elevation={0} className="p-3 text-center" style={{ backgroundColor: 'rgba(90, 56, 18, 0.1)' }}>
                                <Typography variant="h4" style={{ color: '#5a3812' }}>
                                  {reservations.length}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                  Active Reservations
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Paper elevation={0} className="p-3 text-center" style={{ backgroundColor: 'rgba(34, 49, 29, 0.1)' }}>
                                <Typography variant="h4" style={{ color: '#22311d' }}>
                                  {transactions.length}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                  Items Collected
                                </Typography>
                              </Paper>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </div>
              )}
              
              {/* Current Reservations Tab */}
              {tabValue === 1 && (
                <div>
                  <Typography variant="h4" className="mb-4" style={{ color: '#5a3812' }}>
                    Current Donations & Reservations
                  </Typography>
                  {currentReservations.length === 0 ? (
                    <Paper elevation={1} className="p-5 text-center" style={{ backgroundColor: '#E1D9D1' }}>
                      <Typography variant="body1">No active donations or reservations.</Typography>
                      <Button 
                        variant="contained" 
                        style={{ backgroundColor: '#5a3812', color: 'white', marginTop: '12px' }}
                        className="mt-3"
                        onClick={goHome}
                      >
                        Find Food on Map
                      </Button>
                    </Paper>
                  ) : (
                    <Grid container spacing={3}>
                      {currentReservations.map((m) => {
                        let statusLabel = '';
                        let statusColor = '';
                        if (m.status === 'available') {
                          statusLabel = 'Open for reservation';
                          statusColor = 'primary.main';
                        } else if (m.status === 'reserved') {
                          statusLabel = `Reserved until ${new Date(m.reserved_until).toLocaleString()}`;
                          statusColor = 'success.main';
                        } else if (m.status === 'expired') {
                          statusLabel = `Expired at ${new Date(m.updated_at).toLocaleString()}`;
                          statusColor = 'text.secondary';
                        }

                        return (
                          <Grid item xs={12} md={6} lg={4} key={m.marker_id}>
                            <Card elevation={3} className="h-full" style={{ backgroundColor: '#E1D9D1' }}>
                              <CardContent className="flex flex-col h-full">
                                <Box className="flex justify-between items-start mb-2">
                                  <Typography variant="h6">{m.food_type}</Typography>
                                  <Chip 
                                    label={m.status} 
                                    size="small"
                                    style={{ 
                                      backgroundColor: m.status === 'reserved' ? '#22311d' : '#5a3812',
                                      color: 'white'
                                    }}
                                  />
                                </Box>
                                
                                <Typography className="my-1">Quantity: {m.quantity}</Typography>
                                <Typography className="my-1">{m.description}</Typography>
                                
                                <Box className="flex items-center my-1">
                                  <LocationIcon fontSize="small" className="mr-1" color="action" />
                                  <Typography variant="body2" color="text.secondary">
                                    {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
                                  </Typography>
                                </Box>
                                
                                <Typography 
                                  className="mb-3" 
                                  sx={{ color: statusColor }}
                                  variant="body2"
                                >
                                  {statusLabel}
                                </Typography>
                                
                                {m.dietary_tags && m.dietary_tags.length > 0 && (
                                  <Box className="mb-3">
                                    <Typography variant="caption" color="text.secondary">
                                      Dietary tags:
                                    </Typography>
                                    <Box className="flex flex-wrap gap-1 mt-1">
                                      {m.dietary_tags.map(tag => (
                                        <Chip 
                                          key={tag} 
                                          label={tag} 
                                          size="small" 
                                          style={{ backgroundColor: 'rgba(34, 49, 29, 0.2)', color: '#22311d' }}
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                )}
                                
                                <Box className="mt-auto pt-2">
                                  {m.receiver_user_id === userId && m.status === 'reserved' && (
                                    <Button
                                      variant="contained"
                                      style={{ backgroundColor: '#5a3812', color: 'white' }}
                                      fullWidth
                                      onClick={() => handlePickup(m.marker_id)}
                                    >
                                      Confirm Pickup
                                    </Button>
                                  )}
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  )}
                </div>
              )}

              {/* Past Transactions Tab */}
              {tabValue === 2 && (
                <div>
                  <Typography variant="h4" className="mb-4" style={{ color: '#5a3812' }}>
                    Transaction History
                  </Typography>
                  {allTransactionHistory.length === 0 ? (
                    <Paper elevation={1} className="p-5 text-center" style={{ backgroundColor: '#E1D9D1' }}>
                      <Typography variant="body1">You haven't picked up anything yet.</Typography>
                      <Button 
                        variant="contained" 
                        style={{ backgroundColor: '#5a3812', color: 'white', marginTop: '12px' }}
                        className="mt-3"
                        onClick={goHome}
                      >
                        Find Food on Map
                      </Button>
                    </Paper>
                  ) : (
                    <Grid container spacing={3}>
                      {allTransactionHistory.map((tx) => (
                        <Grid item xs={12} md={6} lg={4} key={tx.transaction_id}>
                          <Card elevation={3} style={{ backgroundColor: '#E1D9D1' }}>
                            <CardContent>
                              <Box className="flex justify-between items-start mb-2">
                                <Typography variant="h6">{tx.marker.food_type}</Typography>
                                <Chip 
                                  label={tx.transaction_type === 'expired' ? "Expired" : "Picked Up"} 
                                  size="small" 
                                  style={{ 
                                    backgroundColor: tx.transaction_type === 'expired' ? '#5a3812' : '#22311d',
                                    color: 'white'
                                  }}
                                />
                              </Box>
                              
                              <Typography className="my-1">Quantity: {tx.marker.quantity}</Typography>
                              <Typography className="my-1">{tx.marker.description}</Typography>
                              
                              <Box className="flex items-center my-1">
                                <LocationIcon fontSize="small" className="mr-1" color="action" />
                                <Typography variant="body2" color="text.secondary">
                                  {tx.marker.latitude.toFixed(5)}, {tx.marker.longitude.toFixed(5)}
                                </Typography>
                              </Box>
                              
                              <Typography className="mt-3" color="text.secondary">
                                {tx.transaction_type === 'expired' 
                                  ? `Expired: ${new Date(tx.marker.updated_at).toLocaleString()}`
                                  : `Picked up: ${new Date(tx.pickup_time).toLocaleString()}`
                                }
                              </Typography>
                              
                              {tx.marker.dietary_tags && tx.marker.dietary_tags.length > 0 && (
                                <Box className="mt-2">
                                  <Typography variant="caption" color="text.secondary">
                                    Dietary tags:
                                  </Typography>
                                  <Box className="flex flex-wrap gap-1 mt-1">
                                    {tx.marker.dietary_tags.map(tag => (
                                      <Chip 
                                        key={tag} 
                                        label={tag} 
                                        size="small" 
                                        style={{ backgroundColor: 'rgba(34, 49, 29, 0.2)', color: '#22311d' }}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Dietary Preferences Dialog */}
      <Dialog 
        open={dietaryPreferencesOpen} 
        onClose={handleDietaryPreferencesClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          style: {
            backgroundColor: '#E1D9D1',
          }
        }}
      >
        <DialogTitle style={{ color: '#22311d' }}>Dietary Preferences</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" className="mb-3">
            Select your dietary preferences to help filter food donations that match your needs.
          </Typography>
          <FormGroup>
            <Grid container spacing={1}>
              {dietaryOptions.map(option => (
                <Grid item xs={6} key={option}>
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={dietaryPreferences.includes(option)}
                        onChange={() => handleDietaryPreferenceToggle(option)}
                        name={option}
                        style={{ color: '#22311d' }}
                      />
                    }
                    label={option}
                  />
                </Grid>
              ))}
            </Grid>
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDietaryPreferencesClose} style={{ color: '#5a3812' }}>
            Cancel
          </Button>
          <Button 
            onClick={saveDietaryPreferences} 
            variant="contained"
            disabled={savingPreferences}
            style={{ backgroundColor: '#5a3812', color: 'white' }}
          >
            {savingPreferences ? <CircularProgress size={24} style={{ color: 'white' }} /> : 'Save Preferences'}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
};

export default AccountDetails;

