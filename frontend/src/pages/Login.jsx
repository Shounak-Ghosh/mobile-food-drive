import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  TextField,
  Button,
  IconButton,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import axios from "axios";
import { ThemeProvider, darken } from "@mui/material/styles";
import theme from "../themes/LoginRegisterTheme";
import Notification from "../components/Notification";

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "error",
  });
  const navigate = useNavigate();
  const location = useLocation();

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  // Show logout notification if passed via navigate
  useEffect(() => {
    if (location.state?.message) {
      setNotification({
        open: true,
        message: location.state.message,
        severity: location.state.severity || "info",
      });
    }
  }, [location.state]);

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = "Email is required";
    else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/i.test(formData.email))
      newErrors.email = "Enter a valid email";
    if (!formData.password) newErrors.password = "Password is required";
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
      const response = await axios.post(
        "http://localhost:8000/auth/login",
        `username=${encodeURIComponent(formData.email)}&password=${encodeURIComponent(formData.password)}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          withCredentials: true
        }
      );
      const token = response.data.access_token;
      localStorage.setItem("authToken", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Update authentication state in the parent
      onLogin();

      // Show success notification
      setNotification({
        open: true,
        message: "Login successful!",
        severity: "success",
      });

      setLoading(false);

      // Redirect to landing page
      setTimeout(() => navigate("/landing"), 2000); // 2s delay to show notification
    } catch (error) {
      setLoading(false);

      // Show error notification
      setNotification({
        open: true,
        message: error.response?.data?.detail || "Login failed",
        severity: "error",
      });
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: "#E1D9D1" }}
      >
        <div
          className="p-6 rounded-lg shadow-md w-full max-w-md"
          style={{
            backgroundColor: "#22311d",
            color: "white",
          }}
        >
          <h1 className="text-2xl font-semibold mb-4 text-center">
            Mobile Food Drive
          </h1>
          <p className="text-sm text-gray-300 mb-6 text-center">
            Sign in to continue
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  "& .MuiInputLabel-root": {
                    color: "white",
                    "&.Mui-focused": { color: "white" },
                  },
                  "& .MuiOutlinedInput-root": {
                    color: "white",
                    "& fieldset": { borderColor: "white" },
                    "&:hover fieldset": { borderColor: "#c4c4c4" },
                    "&.Mui-focused fieldset": { borderColor: "white" },
                  },
                }}
              />
            </div>
            <div className="space-y-4">
              <TextField
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                variant="outlined"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                error={!!errors.password}
                helperText={errors.password}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={togglePasswordVisibility}
                          edge="end"
                          sx={{ color: "#E1D9D1" }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  "& .MuiInputLabel-root": {
                    color: "white",
                    "&.Mui-focused": { color: "white" },
                  },
                  "& .MuiOutlinedInput-root": {
                    color: "white",
                    "& fieldset": { borderColor: "white" },
                    "&:hover fieldset": { borderColor: "#c4c4c4" },
                    "&.Mui-focused fieldset": { borderColor: "white" },
                  },
                }}
              />
            </div>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              style={{
                backgroundColor: "#5a3812",
                color: "white",
              }}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
          <div className="text-center mt-4">
            <p className="text-sm text-gray-300">
              Don't have an account?{" "}
              <a href="/register" className="text-green-200 hover:underline">
                Sign up
              </a>
            </p>
          </div>
        </div>

        {/* Notification Component */}
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
