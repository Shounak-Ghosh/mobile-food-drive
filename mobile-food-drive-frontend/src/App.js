import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Register from './Register'; // Import the Register component
import Login from './Login'; // Import the Login component (you'll create this)

function App() {
  return (
    <Router>
      <div>
        <nav>
          <Link to="/register">Register</Link> | <Link to="/login">Login</Link>
        </nav>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<h1>Welcome to Mobile Food Drive</h1>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;