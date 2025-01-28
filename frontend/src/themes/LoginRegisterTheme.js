import { createTheme } from '@mui/material/styles';

// Create a custom theme
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
            WebkitBoxShadow: '0 0 0 1000px transparent inset', // Transparent background for autofill
            WebkitTextFillColor: '#ffffff', // Autofill text color set to white
            caretColor: '#ffffff', // Blinking cursor (caret) color set to white
            transition: 'background-color 5000s ease-in-out 0s', // Prevent flashing autofill background
          },
          '& input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active': {
            WebkitBoxShadow: '0 0 0 1000px transparent inset',
            WebkitTextFillColor: '#ffffff', // Ensure consistency across states
            caretColor: '#ffffff', // Keep the blinking cursor white in all states
            transition: 'background-color 5000s ease-in-out 0s',
          },
        },
      },
    },
  },
});

// Apply keyframes dynamically to ensure animations work
const autofillStyles = `
@keyframes autofill {
  100% {
    background: transparent !important;
    color: #ffffff !important; /* Autofill text color set to white */
    caret-color: #ffffff !important; /* Autofill blinking cursor color set to white */
  }
}
@-webkit-keyframes autofill {
  100% {
    background: transparent !important;
    color: #ffffff !important; /* Autofill text color set to white */
    caret-color: #ffffff !important; /* Autofill blinking cursor color set to white */
  }
}
`;

// Add the keyframes to the document's styles
const styleSheet = document.createElement('style');
styleSheet.innerText = autofillStyles; // Removed deprecated 'type' attribute
document.head.appendChild(styleSheet);

export default theme;
