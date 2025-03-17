import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../themes/LoginRegisterTheme';
import axios from 'axios';

const PastTransactions = ({ onLogout }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.get('http://localhost:8000/transaction/user', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        setTransactions(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setError('Failed to load your transaction history');
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      {/* Full-page container with Tailwind */}
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
          <Typography variant="h6" className="mb-4 text-white">
            Future Options
          </Typography>
          {/* Placeholder buttons or links */}
          <button
            className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
            onClick={() => alert('Dietary Restrictions coming soon!')}
          >
            Dietary Restriction
          </button>
          <button
            className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
            onClick={() => alert('Settings coming soon!')}
          >
            Settings
          </button>
          <button
            className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
            onClick={onLogout}
          >
            Logout
          </button>
          {/* You can add more sidebar options here */}
        </div>
        {/* Main Content Area */}
        <div className="flex-1 p-8 overflow-auto">
          <Typography
            variant="h4"
            className="mb-6"
            style={{ color: '#5a3812', fontWeight: 'bold' }}
          >
            Your Past Transactions
          </Typography>

          {loading && (
            <Typography variant="body1">Loading your transaction history...</Typography>
          )}

          {error && (
            <Typography variant="body1" style={{ color: 'red' }}>{error}</Typography>
          )}

          {!loading && !error && transactions.length === 0 && (
            <Typography variant="body1">You don't have any past transactions yet.</Typography>
          )}

          {transactions.map((transaction) => (
            <Card
              key={transaction.transaction_id}
              className="mb-4"
              style={{ backgroundColor: '#ffffff', color: '#333' }}
            >
              <CardContent>
                <Typography variant="h6" style={{ fontWeight: 'bold' }}>
                  {transaction.location}
                </Typography>
                <Typography variant="body1">
                  Address: {transaction.address}
                </Typography>
                <Typography variant="body1">
                  Pickup Time: {transaction.pickup_time}
                </Typography>
                <Typography variant="body2">
                  Order ID: {transaction.order_id}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ThemeProvider>
  );
};

export default PastTransactions;
