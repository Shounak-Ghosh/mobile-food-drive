import { createTheme } from '@mui/material/styles';

// Create a custom theme with beige color for error and coffee autofill
const theme = createTheme({
  palette: {
    error: {
      main: '#f5c89f', // Beige color for error
    },
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& input:-webkit-autofill': {
            WebkitBoxShadow: '0 0 0px 1000px #ffcd7e inset', // coffee background for autofill
            WebkitTextFillColor: 'inherit', // Text inherits default color
          },
        },
      },
    },
  },
});

export default theme;