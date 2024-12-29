import { createTheme } from '@mui/material/styles';

// Create a custom theme with beige color for error
const theme = createTheme({
  palette: {
    error: {
      main: '#f5c89f', // Beige color for error
    },
  },
});

export default theme;
