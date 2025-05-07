const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs');
const ScraperController = require('./controller');
const config = require('../config/config');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Create scraper controller
const scraperController = new ScraperController();

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware to check if the scraper is initialized
const ensureScraperInitialized = async (req, res, next) => {
  try {
    await scraperController.ensureInitialized();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to initialize LinkedIn API service', details: error.message });
  }
};

// LinkedIn OAuth Routes

// Redirect to LinkedIn for OAuth authorization
app.get('/auth/linkedin', (req, res) => {
  const authUrl = 'https://www.linkedin.com/oauth/v2/authorization';
  const params = {
    response_type: 'code',
    client_id: config.linkedinApi.clientId,
    redirect_uri: config.linkedinApi.redirectUri,
    state: 'random-state-string', // In production, use a secure random string
    scope: 'r_liteprofile r_emailaddress rw_organization_admin'
  };
  
  res.redirect(`${authUrl}?${querystring.stringify(params)}`);
});

// Handle OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code not received');
  }
  
  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', querystring.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: config.linkedinApi.clientId,
      client_secret: config.linkedinApi.clientSecret,
      redirect_uri: config.linkedinApi.redirectUri
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Update configuration with new tokens
    const tokenExpiresAt = Date.now() + (expires_in * 1000);
    
    // Update .env file with new tokens
    const envPath = path.resolve(__dirname, '../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Replace or add token variables
    const envVars = {
      LINKEDIN_API_ACCESS_TOKEN: access_token,
      LINKEDIN_API_REFRESH_TOKEN: refresh_token || '',
      LINKEDIN_API_TOKEN_EXPIRES_AT: tokenExpiresAt
    };
    
    for (const [key, value] of Object.entries(envVars)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }
    
    fs.writeFileSync(envPath, envContent);
    
    // Update runtime config
    config.linkedinApi.accessToken = access_token;
    config.linkedinApi.refreshToken = refresh_token || '';
    config.linkedinApi.tokenExpiresAt = tokenExpiresAt;
    
    // Redirect to success page
    res.redirect('/auth-success.html');
  } catch (error) {
    console.error('Error exchanging code for token:', error.response?.data || error.message);
    res.status(500).send('Error obtaining access token');
  }
});

// Status endpoint to check if we have a valid token
app.get('/api/auth/status', (req, res) => {
  const hasToken = !!config.linkedinApi.accessToken;
  const tokenExpired = hasToken && 
                      config.linkedinApi.tokenExpiresAt && 
                      Date.now() > config.linkedinApi.tokenExpiresAt;
  
  res.json({
    authenticated: hasToken && !tokenExpired,
    tokenExpired
  });
});

// API Routes
// Root route now serves the UI
app.get('/api', (req, res) => {
  res.json({ message: 'LinkedIn API Service is running' });
});

// Search for LinkedIn profiles with filters
app.post('/api/search', ensureScraperInitialized, async (req, res) => {
  try {
    const filters = req.body;
    const profiles = await scraperController.findProfiles(filters);
    res.json({
      count: profiles.length,
      filters,
      profiles
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search profiles', details: error.message });
  }
});

// Get detailed info for a specific profile
app.get('/api/profile/:url', ensureScraperInitialized, async (req, res) => {
  try {
    const { url } = req.params;
    if (!url) {
      return res.status(400).json({ error: 'Profile URL is required' });
    }
    
    const profileUrl = decodeURIComponent(url);
    const profileDetails = await scraperController.getProfileDetails(profileUrl);
    
    if (!profileDetails) {
      return res.status(404).json({ error: 'Profile not found or could not be accessed' });
    }
    
    res.json(profileDetails);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile details', details: error.message });
  }
});

// Get available filter options (Note: this is mocked data since LinkedIn doesn't expose these directly)
app.get('/api/filters', (req, res) => {
  res.json({
    industries: [
      { id: 47, name: 'Information Technology' },
      { id: 4, name: 'Software Development' },
      { id: 6, name: 'Financial Services' },
      { id: 51, name: 'Healthcare' },
      { id: 12, name: 'Marketing and Advertising' },
      // Add more industries as needed
    ],
    connectionDegrees: [
      { id: 'F', name: '1st connections' },
      { id: 'S', name: '2nd connections' },
      { id: 'O', name: '3rd+ connections' }
    ],
    experienceLevels: [
      { id: 1, name: 'Internship' },
      { id: 2, name: 'Entry level' },
      { id: 3, name: 'Associate' },
      { id: 4, name: 'Mid-Senior level' },
      { id: 5, name: 'Director' },
      { id: 6, name: 'Executive' }
    ]
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LinkedIn API Service running on port ${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await scraperController.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await scraperController.close();
  process.exit(0);
});