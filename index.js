const express = require('express');
const path = require('path');
const app = express();

// Serve static folders
app.use(express.static(path.join(__dirname, 'src')));
app.use('/config', express.static(path.join(__dirname, 'config'))); // <-- add this line

// Routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/pages/login.html'));
});

app.get('/', (req, res) => {
  res.redirect('/pages/signup.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
