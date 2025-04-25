// frontend/src/pages/Login.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  TextField,
  Button,
  IconButton,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import API from '../api/axios';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../themes/LoginRegisterTheme';
import Notification from '../components/Notification';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'error',
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Toggle password visibility
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  // Show a notification if we got one via navigation
  useEffect(() => {
    if (location.state?.message) {
      setNotification({
        open: true,
        message: location.state.message,
        severity: location.state.severity || 'info',
      });
    }
  }, [location.state]);

  // Simple form validation
  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (
      !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/i.test(formData.email)
    )
      newErrors.email = 'Enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';
    return newErrors;
  };

  const handleChange = (e) => {
    setFormData((f) => ({ ...f, [e.target.name]: e.target.value }));
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
      // 1) Login
      const response = await API.post(
        '/auth/login',
        `username=${encodeURIComponent(formData.email)}&password=${encodeURIComponent(
          formData.password
        )}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      const { access_token, refresh_token } = response.data;
      localStorage.setItem('accessToken', access_token);
      if (refresh_token) localStorage.setItem('refreshToken', refresh_token);
      API.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // 2) Fetch /auth/me for user_id
      const me = await API.get('/auth/me');
      localStorage.setItem('userId', me.data.user_id);

      onLogin({ access_token, refresh_token });
      setNotification({
        open: true,
        message: 'Login successful!',
        severity: 'success',
      });
      setLoading(false);

      // Redirect after a brief pause
      setTimeout(() => navigate('/landing'), 1000);
    } catch (error) {
      setLoading(false);
      setNotification({
        open: true,
        message: error.response?.data?.detail || 'Login failed',
        severity: 'error',
      });
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: '#E1D9D1' }}
      >
        <div
          className="p-6 rounded-lg shadow-md w-full max-w-md"
          style={{ backgroundColor: '#22311d', color: 'white' }}
        >
          <h1 className="text-2xl font-semibold mb-4 text-center">
            Mobile Food Drive
          </h1>
          <p className="text-sm text-gray-300 mb-6 text-center">
            Sign in to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-4">
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
                  '& .MuiInputLabel-root': { color: 'white', '&.Mui-focused': { color: 'white' } },
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: 'white' },
                    '&:hover fieldset': { borderColor: '#c4c4c4' },
                    '&.Mui-focused fieldset': { borderColor: 'white' },
                  },
                }}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-4">
              <TextField
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                value={formData.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={togglePasswordVisibility}
                        edge="end"
                        sx={{ color: '#E1D9D1' }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiInputLabel-root': { color: 'white', '&.Mui-focused': { color: 'white' } },
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: 'white' },
                    '&:hover fieldset': { borderColor: '#c4c4c4' },
                    '&.Mui-focused fieldset': { borderColor: 'white' },
                  },
                }}
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              style={{ backgroundColor: '#5a3812', color: 'white' }}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
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

        {/* Notification */}
        <Notification
          open={notification.open}
          onClose={() => setNotification({ ...notification, open: false })}
          message={notification.message}
          severity={notification.severity}
        />
      </div>
    </ThemeProvider>
  );
};

export default Login;
