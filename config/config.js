// LinkedIn scraper configuration
require('dotenv').config(); // Make sure dotenv is loaded here as well
const path = require('path');
const fs = require('fs');

// Create user data directory for persistent sessions if it doesn't exist
const userDataDir = path.resolve(__dirname, '../user_data');
if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
  console.log(`Created user data directory at: ${userDataDir}`);
}

module.exports = {
  // LinkedIn credentials (only used for initial login if needed)
  linkedin: {
    email: process.env.LINKEDIN_EMAIL || '',
    password: process.env.LINKEDIN_PASSWORD || '',
  },
  
  // LinkedIn API credentials (for Sales Navigator API)
  linkedinApi: {
    clientId: process.env.LINKEDIN_API_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_API_CLIENT_SECRET || '',
    redirectUri: process.env.LINKEDIN_API_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    accessToken: process.env.LINKEDIN_API_ACCESS_TOKEN || '',
    refreshToken: process.env.LINKEDIN_API_REFRESH_TOKEN || '',
    tokenExpiresAt: process.env.LINKEDIN_API_TOKEN_EXPIRES_AT || 0
  },
  
  // Browser settings
  browser: {
    headless: process.env.HEADLESS === 'true' || false,
    slowMo: 100, // slow down operations for stability
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    userDataDir: userDataDir, // Store cookies and session data here
  },
  
  // Server settings
  server: {
    port: process.env.PORT || 3000,
  },
  
  // Rate limiting to avoid detection
  rateLimit: {
    requestDelay: 2000, // milliseconds between actions
    maxProfiles: 100, // max profiles to scrape in one session
  }
};