const { PythonShell } = require('python-shell');
const path = require('path');
const config = require('../config/config');

class LinkedInPythonScraper {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, 'linkedin_scraper_script.py');
    this.userDataDir = path.join(__dirname, '../user_data');
    this.isInitialized = false;
  }

  /**
   * Initialize the scraper
   */
  async initialize() {
    try {
      console.log('Initializing LinkedIn Python scraper...');
      // Check if login is successful by performing a simple login action
      const result = await this.runPythonScript({
        action: 'login',
        email: config.linkedin.email,
        password: config.linkedin.password,
        headless: config.browser.headless || false,
        userDataDir: this.userDataDir
      });

      this.isInitialized = result.success;
      return this.isInitialized;
    } catch (error) {
      console.error('Error initializing LinkedIn scraper:', error);
      return false;
    }
  }

  /**
   * Login to LinkedIn
   */
  async login() {
    try {
      const result = await this.runPythonScript({
        action: 'login',
        email: config.linkedin.email,
        password: config.linkedin.password,
        headless: config.browser.headless || false,
        userDataDir: this.userDataDir
      });

      this.isInitialized = result.success;
      return result.success;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }

  /**
   * Search for LinkedIn profiles based on filters
   */
  async searchProfiles(filters) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const result = await this.runPythonScript({
        action: 'search',
        email: config.linkedin.email,
        password: config.linkedin.password,
        skipLogin: true, // Use existing session
        headless: config.browser.headless || false,
        userDataDir: this.userDataDir,
        keywords: filters.keywords || '',
        location: filters.location || '',
        maxResults: filters.maxResults || 20,
        getDetailedInfo: filters.getDetailedInfo === undefined ? true : filters.getDetailedInfo,
        maxDetailedProfiles: filters.maxDetailedProfiles || 5
      });

      return result.profiles || [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  /**
   * Get detailed profile information
   */
  async getProfileDetails(profileUrl) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const result = await this.runPythonScript({
        action: 'profile',
        email: config.linkedin.email,
        password: config.linkedin.password,
        skipLogin: true, // Use existing session
        headless: config.browser.headless || false,
        userDataDir: this.userDataDir,
        profileUrl: profileUrl
      });

      return result.profile || null;
    } catch (error) {
      console.error('Profile details error:', error);
      return null;
    }
  }

  /**
   * Run the Python script with given arguments
   */
  async runPythonScript(args) {
    return new Promise((resolve, reject) => {
      // Configure PythonShell options
      const options = {
        mode: 'json',        // Expect JSON output
        pythonPath: 'python', // Use system Python
        pythonOptions: ['-u'], // unbuffered output
        scriptPath: path.dirname(this.pythonScriptPath),
        args: []
      };

      // Create a new PythonShell instance
      const pyshell = new PythonShell(path.basename(this.pythonScriptPath), options);

      // Send the arguments to the Python script
      pyshell.send(args);

      let result = null;

      // Handle messages from the Python script (valid JSON)
      pyshell.on('message', (message) => {
        result = message;
      });

      // Handle errors and debug logs from Python (these will go to stderr)
      pyshell.on('stderr', (err) => {
        console.log('Python log:', err);  // Changed from error to log since we're using stderr for logging
      });

      // Handle Python errors
      pyshell.on('error', (err) => {
        console.error('Python error:', err);
      });

      // End the Python process and resolve/reject based on the result
      pyshell.end((err) => {
        if (err) {
          // Parsing errors are common when mixing logs with JSON output
          if (err.message && err.message.includes('Unexpected token')) {
            console.error('JSON parsing error from Python output. Check Python logging.');
          } else {
            console.error('Python script error:', err);
          }
          
          // If we got a result object despite the error, return it
          if (result) {
            resolve(result);
          } else {
            reject(err);
          }
        } else {
          resolve(result || { success: false, error: 'No response from Python script' });
        }
      });
    });
  }

  /**
   * Close the scraper (cleanup)
   */
  async close() {
    // No persistent connection to close with this approach
    this.isInitialized = false;
    return true;
  }
}

module.exports = LinkedInPythonScraper;