import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { Typography, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText, Button } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../themes/LoginRegisterTheme';
import Sidebar from '../components/Sidebar';

const EditDietaryTags = () => {
    const [dietaryPreference, setDietaryPreference] = useState([]);
    const [allergyPreference, setAllergyPreference] = useState([]);
    const navigate = useNavigate();

    const dietaryOptions = [
        'None',
        'Vegetarian',
        'Vegan',
        'Gluten-Free',
        'Kosher',
        'Halal',
    ];

    const allergyOptions = [
        'None',
        'Peanuts',
        'Tree Nuts',
        'Dairy',
        'Eggs',
        'Shellfish',
        'Wheat',
        'Soy',
        'Fish',
    ];

    const handleDietaryChange = (event) => {
        const {
            target: { value },
        } = event;
        setDietaryPreference(typeof value === 'string' ? value.split(',') : value);
    };

    const handleAllergyChange = (event) => {
        const {
            target: { value },
        } = event;
        setAllergyPreference(typeof value === 'string' ? value.split(',') : value);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        console.log('Dietary Preference:', dietaryPreference);
        console.log('Allergy Preference:', allergyPreference);
    };

    return (
        <ThemeProvider theme={theme}>
            
            {/* Full-page container with Tailwind */}
            
            <div className="flex min-h-screen" style={{ backgroundColor: '#d4edda' }}>
                <Sidebar />
                {/* Main Content Area */}
               
                <div className="flex items-center justify-center flex-grow"
                >
                    <div
                    className="p-6 rounded-lg shadow-md w-full max-w-md"
                    style={{
                        backgroundColor: "#22311d",
                        color: "white",
                    }}
                    >
                        <div className="flex-1 p-6">
                            <Typography variant="h4" className="mb-6">
                                Edit Dietary Tags
                            </Typography>
                            <form onSubmit={handleSubmit}>
                                {/* Dietary Preferences Dropdown */}
                                <div className="mb-4">
                                    <FormControl fullWidth>
                                        <InputLabel id="diet-label" 
                                            sx={{
                                                color : "white", 
                                                "&.Mui-focused": {color: "white"},}}>
                                                Select Dietary Preference
                                        </InputLabel>
                                        <Select
                                            labelId="diet-label"
                                            label="Select Dietary Preference"
                                            multiple
                                            value={dietaryPreference}
                                            onChange={handleDietaryChange}
                                            renderValue={(selected) => selected.join(', ')}
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
                                                    <Checkbox checked={dietaryPreference.includes(option)} />
                                                    <ListItemText primary={option} />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </div>
            
                                {/* Allergy Preferences Dropdown */}
                                <div className="mb-4">
                                    <FormControl fullWidth>
                                        <InputLabel id="allergy-label" 
                                            sx={{
                                                color : "white", 
                                                "&.Mui-focused": {color: "white"},}}>
                                                Select Allergies
                                        </InputLabel>
                                        <Select
                                            labelId="allergy-label"
                                            label= "Select Allergies"
                                            multiple
                                            value={allergyPreference}
                                            onChange={handleAllergyChange}
                                            renderValue={(selected) => selected.join(', ')}
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
                                            {allergyOptions.map((option) => (
                                                <MenuItem key={option} value={option}>
                                                    <Checkbox checked={allergyPreference.includes(option)} />
                                                    <ListItemText primary={option} />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </div>
                                            
                                {/* Submit Button */}
                                <Button type="submit" variant="contained" 
                                style = {{backgroundColor: "#5a3812", color: "primary"}}>
                                    Update Tags
                                </Button>
                    </form>
                </div>
            </div>
            </div>
            </div>
    </ThemeProvider>
    );
}
export default EditDietaryTags;