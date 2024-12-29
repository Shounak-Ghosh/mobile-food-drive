import React, { useState } from 'react';
import { TextField, Button, CircularProgress } from '@mui/material';
import axios from 'axios';
import { ThemeProvider } from '@mui/material/styles';
import theme from './themes/ErrorTheme'; 

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    return newErrors;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/auth/login', formData);
      alert('Login successful: ' + response.data.token);  // Handle token appropriately
      setLoading(false);
      // Redirect or update state as needed (e.g., store token in localStorage)
    } catch (error) {
      setLoading(false);
      alert(error.response?.data?.message || 'Login failed');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#d4edda' }}>
        <div
          className="p-6 rounded-lg shadow-md w-full max-w-md"
          style={{
            backgroundColor: '#8B4513',
            color: 'white',
          }}
        >
          <h1 className="text-2xl font-semibold mb-4 text-center">Mobile Food Drive</h1>
          <p className="text-sm text-gray-300 mb-6 text-center">Sign in to continue</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              fullWidth
              name="email"
              label="Email"
              variant="outlined"
              value={formData.email}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
              sx={{
                '& .MuiInputLabel-root': {
                  color: 'white',
                  '&.Mui-focused': { color: 'white' },
                },
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  '& fieldset': { borderColor: 'white' },
                  '&:hover fieldset': { borderColor: '#c4c4c4' },
                  '&.Mui-focused fieldset': { borderColor: 'white' },
                },
              }}
            />
            <TextField
              fullWidth
              name="password"
              label="Password"
              type="password"
              variant="outlined"
              value={formData.password}
              onChange={handleChange}
              error={!!errors.password}
              helperText={errors.password}
              sx={{
                '& .MuiInputLabel-root': {
                  color: 'white',
                  '&.Mui-focused': { color: 'white' },
                },
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  '& fieldset': { borderColor: 'white' },
                  '&:hover fieldset': { borderColor: '#c4c4c4' },
                  '&.Mui-focused fieldset': { borderColor: 'white' },
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              style={{
                backgroundColor: '#5a3812',
                color: 'white',
              }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>
          <div className="text-center mt-4">
          <p className="text-sm text-gray-300">
            Don't have an account?{' '}
            <a href="/register" className="text-green-200 hover:underline">
              Sign up
            </a>
          </p>
        </div>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default Login;
