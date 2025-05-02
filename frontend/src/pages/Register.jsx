import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Button,
  IconButton,
  InputAdornment,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import axios from "axios";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../themes/LoginRegisterTheme";

const Register = ({ onRegister }) => {
  // Accept onRegister as a prop
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    dietaryPreferences: [],
    allergies: [],
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };
  
  const dietaryOptions = [
    "Vegetarian",
    "Vegan",
    "Pescatarian",
    "Gluten-Free",
    "Halal",
    "Kosher",
    "Organic",
    "Non-Perishable"
  ];

  const allergiesOptions = [
    "Nut-Free",
    "Dairy-Free",
    "Eggs-Free",
    "Shellfish-Free",
  ];
  

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.email) newErrors.email = "Email is required";
    else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/i.test(formData.email))
      newErrors.email = "Enter a valid email";
    if (!formData.password) newErrors.password = "Password is required";
    else if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/i.test(
        formData.password
      )
    )
      newErrors.password =
        "Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character";
    return newErrors;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleDietarySelectChange = (e, type) => {
    const selected = typeof e.target.value === "string"
      ? e.target.value.split(",")
      : e.target.value;

    if (type === "dietary") {
      setFormData({
        ...formData,
        dietaryPreferences: selected
      });
    } else if (type === "allergy") {
      setFormData({
        ...formData,
        allergies: selected
      });
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({}); //resets errors before validating again
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      if (validationErrors.name || validationErrors.email || validationErrors.password) {
        setStep(1); //checks for errors on page 1, if there are, return from page 2 to page 1 
      }
      return;
    }
    setErrors({});
    setLoading(true);
  
    try {
      const mergedPreferences = formData.dietaryPreferences.concat(formData.allergies);

      // Convert all entries to lowercase
      const normalizedPreferences = mergedPreferences.map(item => item.toLowerCase());

      const payload = {
        ...formData,
        dietaryPreferences: normalizedPreferences,
      };
      delete payload.allergies;

      const response = await axios.post(
        "http://localhost:8000/auth/register",
        payload
      );
      const token = response.data.access_token;
      localStorage.setItem("authToken", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Update authentication state in parent component
      onRegister();

      console.log("Registration successful");
      setLoading(false);

      // Redirect to landing page
      navigate("/landing");
    } catch (error) {
      setLoading(false);
      alert(error.response?.data?.message || "Registration failed");
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
            Create Your Account
          </h1>
          <p className="text-sm text-gray-300 mb-6 text-center">
            Join us and start making a difference!
          </p>




          
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 &&(
              <>
                <div className="space-y-4">
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
                    onChange={handleChange}
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
                <div style={{ display: "flex", justifyContent: "flex-end"}}>
                  <Button
                    style={{
                      backgroundColor: "#5a3812",
                      color: "white",
                    }}
                    onClick={() => setStep(2)}>Next</Button>
                </div>
              </>
            )}



            {/*Page 2 */}
            {step === 2 && (
              <>
                <div className="space-y-4">
                  <FormControl fullWidth>
                    <InputLabel id="dietary-label" sx={{ color: "white",
                      "&.Mui-focused": {color: "white",},
                     }}>
                      Dietary Preferences
                    </InputLabel>
                    <Select
                      labelId="dietary-label"
                      label="Dietary Preferences"
                      multiple
                      name="dietaryPreferences"
                      value={formData.dietaryPreferences}
                      onChange={(e) => handleDietarySelectChange(e, "dietary")}
                      renderValue={(selected) => selected.join(", ")}
                      sx={{
                        color: "white",
                        backgroundColor: "#22311d",
                        borderRadius: "4px",
                        ".MuiOutlinedInput-notchedOutline": {
                          borderColor: "white",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "white",
                        },
                        "& .MuiSvgIcon-root": {
                          color: "white",
                        },
                      }}
                    >
                      {dietaryOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          <Checkbox 
                            checked={formData.dietaryPreferences.includes(option)}
                            sx={{
                              color: '#22311d',
                              '&.Mui-checked': {
                                color: '#5a3812',
                              },
                            }}
                          />
                          <ListItemText primary={option} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
                <div className="space-y-4">
                  <FormControl fullWidth>
                    <InputLabel id="allergy-label" sx={{ color: "white",
                        "&.Mui-focused": {color: "white",},
                      }}>
                      Allergies
                    </InputLabel>
                    <Select
                      labelId="allergy-label"
                      label="Allergies"
                      multiple
                      name="allergies"
                      value={formData.allergies}
                      onChange={(e) => handleDietarySelectChange(e, "allergy")}
                      renderValue={(selected) => selected.join(", ")}
                      sx={{
                        color: "white",
                        backgroundColor: "#22311d",
                        borderRadius: "4px",
                        ".MuiOutlinedInput-notchedOutline": {
                          borderColor: "white",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "white",
                        },
                        "& .MuiSvgIcon-root": {
                          color: "white",
                        },
                      }}
                    >
                      {allergiesOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          <Checkbox 
                            checked={formData.allergies.includes(option)}
                            sx={{
                              color: '#22311d',
                              '&.Mui-checked': {
                                color: '#5a3812',
                              },
                            }}
                          />
                          <ListItemText primary={option} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between"}}>
                  <Button
                    style={{
                      backgroundColor: "#5a3812",
                      color: "white",
                    }}
                    onClick={() => setStep(1)}>Previous</Button>

                  {/*Registration Button */}
                  <Button
                    type="submit"
                    variant="contained"
                    style={{
                      backgroundColor: "#5a3812",
                      color: "white",
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      "Register"
                    )}
                  </Button>
                </div>
                  
              </>


            )}
          </form>
          <div className="text-center mt-4">
            <p className="text-sm text-gray-300">
              Already have an account?{" "}
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
