import React, { useState } from 'react';
import { TextField, Button, CircularProgress } from '@mui/material';
import axios from 'axios';
import { ThemeProvider } from '@mui/material/styles';
import theme from './themes/ErrorTheme'; 


const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/i.test(formData.email))
      newErrors.email = 'Enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/i.test(formData.password)
    )
      newErrors.password =
        'Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character';
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
      const response = await axios.post('http://localhost:5000/auth/register', formData);
      alert('Registration successful: ' + response.data.message);  // Handle response message or token
      setLoading(false);
      // Redirect or update state as needed (e.g., go to login page)
    } catch (error) {
      setLoading(false);
      alert(error.response?.data?.message || 'Registration failed');
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
          <h1 className="text-2xl font-semibold mb-4 text-center">Create Your Account</h1>
          <p className="text-sm text-gray-300 mb-6 text-center">Join us and start making a difference!</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              fullWidth
              name="name"
              label="Name"
              variant="outlined"
              value={formData.name}
              onChange={handleChange}
              error={!!errors.name}
              helperText={errors.name}
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
                '& .MuiInputLabel-root': { color: 'white', '&.Mui-focused': { color: 'white' } },
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Register'}
            </Button>
          </form>
          <div className="text-center mt-4">
            <p className="text-sm text-gray-300">
              Already have an account?{' '}
              <a href="/login" className="text-green-200 hover:underline">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default Register;
