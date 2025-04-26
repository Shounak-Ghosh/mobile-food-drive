import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';

const Sidebar = ({ onLogout }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const navigate = useNavigate();

    const goToAccountSettings = () => {
        alert('Account Settings coming soon!');
    };
    const goToDietPage = () => {
        navigate('/diet')
    };
    const goToTransactionsPage = () => {
        navigate('/account-details')
    };
    const goToLandingPage = () => {
        navigate('/landing')
    };

    const handleLogout = () => {
        navigate('/login'); // Redirect to the login page
    };

    return (
        /* Full-page container with Tailwind */
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
                Menu Options
            </Typography>
            {/* Placeholder buttons or links */}
            <button
                className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
                onClick={goToLandingPage}
            >
                Home Page
            </button>
            <button
                className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
                onClick={goToTransactionsPage}
            >
                Transactions
            </button>
            <button
                className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
                onClick={goToDietPage}
            >
                Dietary Restrictions
            </button>
            <button
                className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
                onClick={goToAccountSettings}
            >
                Account Settings
            </button>
            <button
                className="bg-[#5a3812] hover:bg-[#4a2f0e] text-white font-semibold py-2 px-4 mb-2 rounded"
                onClick={handleLogout}
            >
                Logout
            </button>
            </div>
        </div>
    );
};

export default Sidebar;
