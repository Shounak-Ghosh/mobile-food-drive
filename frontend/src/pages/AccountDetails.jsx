import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Typography,
  Card,
  CardContent,
  Divider,
  Button
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../themes/LoginRegisterTheme';

const AccountDetails = ({ onLogout }) => {
  const [donations, setDonations] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');
  const userId = parseInt(localStorage.getItem('userId'), 10);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [donRes, resRes, txRes] = await Promise.all([
          axios.get('http://localhost:8000/markers/donated', { headers }),
          axios.get('http://localhost:8000/markers/reserved', { headers }),
          axios.get('http://localhost:8000/transactions/user', { headers }),
        ]);

        setDonations(donRes.data);
        setReservations(resRes.data);

        const detailedTx = await Promise.all(
          txRes.data.map(async (tx) => {
            const m = await axios.get(
              `http://localhost:8000/markers/${tx.marker_id}`,
              { headers }
            );
            return { ...tx, marker: m.data };
          })
        );
        // Sort transactions by most recent pickup_time first
        detailedTx.sort((a, b) => new Date(b.pickup_time) - new Date(a.pickup_time));
        setTransactions(detailedTx);
      } catch (err) {
        console.error(err);
        alert('Error loading account details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

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
    } catch (err) {
      console.error(err);
      alert('Could not confirm pickup.');
    }
  };

  const goHome = () => navigate('/landing');
  const showDietary = () => alert('Dietary Restrictions coming soon!');
  const showSettings = () => alert('Account Settings coming soon!');

  const currentReservations = [
    ...donations.filter((m) => m.status !== 'picked_up'),
    ...reservations
  ];

  return (
    <ThemeProvider theme={theme}>
      <div className="flex min-h-screen" style={{ backgroundColor: '#d4edda' }}>
        {/* Left Sidebar */}
        <div
          className="flex flex-col p-4"
          style={{
            backgroundColor: '#8B4513',
            color: 'white',
            width: '220px',
          }}
        >
          <Typography variant="h6" className="mb-4 text-white">Menu Options</Typography>
          <button
            className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
            onClick={goHome}
          >
            Home Page
          </button>
          <button
            className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
            onClick={showDietary}
          >
            Dietary Restrictions
          </button>
          <button
            className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
            onClick={showSettings}
          >
            Account Settings
          </button>
          <button
            className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-8 overflow-auto">
          {loading ? (
            <Typography>Loading your account details…</Typography>
          ) : (
            <>
              <Typography variant="h4" className="mb-4" style={{ color: '#5a3812' }}>
                Current Reservations
              </Typography>
              {currentReservations.length === 0 ? (
                <Typography>No active reservations.</Typography>
              ) : (
                currentReservations.map((m) => {
                  let statusLabel = '';
                  if (m.status === 'available') {
                    statusLabel = 'Open for reservation';
                  } else if (m.status === 'reserved') {
                    statusLabel = `Reserved until ${new Date(m.reserved_until).toLocaleString()}`;
                  } else if (m.status === 'expired') {
                    statusLabel = `Expired at ${new Date(m.updated_at).toLocaleString()}`;
                  }

                  return (
                    <Card key={m.marker_id} className="mb-4">
                      <CardContent>
                        <Typography variant="h6">{m.food_type}</Typography>
                        <Typography className="my-1">Quantity: {m.quantity}</Typography>
                        <Typography className="my-1">{m.description}</Typography>
                        <Typography className="my-1">
                          Location: {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
                        </Typography>
                        <Typography className="mb-2" color="textSecondary">
                          {statusLabel}
                        </Typography>
                        {m.receiver_user_id === userId && m.status === 'reserved' && (
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handlePickup(m.marker_id)}
                          >
                            I’ve Claimed My Food
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}

              <Divider className="my-8" />

              <Typography variant="h4" className="mb-4" style={{ color: '#5a3812' }}>
                Past Transactions
              </Typography>
              {transactions.length === 0 ? (
                <Typography>You haven’t picked up anything yet.</Typography>
              ) : (
                transactions.map((tx) => (
                  <Card key={tx.transaction_id} className="mb-4">
                    <CardContent>
                      <Typography variant="h6">{tx.marker.food_type}</Typography>
                      <Typography className="my-1">Quantity: {tx.marker.quantity}</Typography>
                      <Typography className="my-1">{tx.marker.description}</Typography>
                      <Typography className="my-1">
                        Location: {tx.marker.latitude.toFixed(5)}, {tx.marker.longitude.toFixed(5)}
                      </Typography>
                      <Typography className="my-1">
                        Pickup Time: {new Date(tx.pickup_time).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
};

export default AccountDetails;
