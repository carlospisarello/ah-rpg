import { createTheme } from "@mui/material/styles";
import { blueGrey, teal, red } from "@mui/material/colors";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: teal[600],
    },
    secondary: {
      main: blueGrey[900],
    },
    error: {
      main: red[400],
    },
  },
  typography: {
    fontFamily: '"arno-pro-small-text", serif',
  },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: "none" } },
    },
  },
});
