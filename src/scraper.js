const puppeteer = require('puppeteer');
const config = require('../config/config');
const path = require('path');
const fs = require('fs');

// Global browser instance to be shared across all operations
let globalBrowser = null;

class LinkedInScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
  }

  async initialize() {
    try {
      console.log('Initializing LinkedIn scraper...');
      
      // If a global browser instance already exists, use it instead of creating a new one
      if (globalBrowser) {
        console.log('Using existing browser instance');
        this.browser = globalBrowser;
      } else {
        // Create and configure the browser
        console.log(`Starting browser with user data directory: ${config.browser.userDataDir}`);
        this.browser = await puppeteer.launch({
          headless: config.browser.headless, 
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ],
          userDataDir: config.browser.userDataDir
        });
        
        // Set the global browser instance for reuse
        globalBrowser = this.browser;
        
        // Handle browser disconnection
        this.browser.on('disconnected', () => {
          console.log('Browser disconnected - resetting global browser instance');
          globalBrowser = null;
        });
      }
      
      // Get existing pages or create a new one
      const pages = await this.browser.pages();
      if (pages.length > 0) {
        this.page = pages[0];
        console.log('Using existing page/tab');
      } else {
        this.page = await this.browser.newPage();
        console.log('Created new page/tab');
      }
      
      // Configure the page
      await this.page.setViewport({ width: 1366, height: 768 });
      await this.page.setUserAgent(config.browser.userAgent);
      
      // Check if we're already logged in
      this.isLoggedIn = await this.checkLoginStatus();
      return true;
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      if (this.browser) {
        await this.browser.close();
        globalBrowser = null;
      }
      return false;
    }
  }
  
  async checkLoginStatus() {
    try {
      // Go to LinkedIn homepage
      console.log('Checking LinkedIn login status...');
      await this.page.goto('https://www.linkedin.com/feed/', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Check if we're redirected to login page or if we can see the feed
      const url = this.page.url();
      console.log(`Current URL: ${url}`);
      
      if (url.includes('linkedin.com/feed') || url.includes('linkedin.com/home')) {
        console.log('Login status: Logged in');
        return true; // We're logged in
      }
      
      // If not redirected to login, check for elements that only appear when logged in
      const navBar = await this.page.$('nav.global-nav');
      const isLoggedIn = !!navBar;
      console.log(`Login status: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`);
      return isLoggedIn; // True if nav bar exists, false otherwise
    } catch (error) {
      console.error('Error checking login status:', error);
      return false;
    }
  }

  async login() {
    // If already logged in, no need to log in again
    if (this.isLoggedIn) {
      console.log('Already logged in. Skipping login process.');
      return true;
    }
    
    try {
      // Open manual login page in the current tab
      console.log('Navigating to LinkedIn login page...');
      await this.page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });
      
      // Wait for manual login (we won't try auto-login to avoid detection)
      console.log('Please log in to LinkedIn manually in the browser tab...');
      return await this.waitForManualLogin();
    } catch (error) {
      console.error('Login process failed:', error);
      return false;
    }
  }
  
  async waitForManualLogin() {
    console.log('Waiting for manual login. Please log in to LinkedIn in the browser tab...');
    
    // Wait up to 5 minutes for manual login
    const maxWaitTimeMs = 5 * 60 * 1000;
    const checkIntervalMs = 5000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTimeMs) {
      // Check if login was successful
      const isLoggedIn = await this.checkLoginStatus();
      if (isLoggedIn) {
        this.isLoggedIn = true;
        console.log('Manual login successful!');
        return true;
      }
      
      // Wait before checking again
      await this.delay(checkIntervalMs);
    }
    
    console.error('Timed out waiting for manual login.');
    return false;
  }

  async searchProfiles(filters) {
    try {
      // Build the search URL based on filters
      const baseUrl = 'https://www.linkedin.com/search/results/people/';
      let queryParams = [];
      
      // Handle keywords
      if (filters.keywords) {
        queryParams.push(`keywords=${encodeURIComponent(filters.keywords)}`);
      }
      
      // Handle location
      if (filters.location) {
        queryParams.push(`geoUrn=${encodeURIComponent(`["${filters.location}"]`)}`);
      }
      
      // Handle current company
      if (filters.currentCompany) {
        queryParams.push(`currentCompany=${encodeURIComponent(`["${filters.currentCompany}"]`)}`);
      }
      
      // Handle industry
      if (filters.industry) {
        queryParams.push(`industryV2=${encodeURIComponent(`["${filters.industry}"]`)}`);
      }
      
      // Handle school
      if (filters.school) {
        queryParams.push(`schoolFilter=${encodeURIComponent(`["${filters.school}"]`)}`);
      }
      
      // Handle connection degree
      if (filters.connectionDegree) {
        queryParams.push(`network=${encodeURIComponent(`["${filters.connectionDegree}"]`)}`);
      }
      
      // Handle years of experience
      if (filters.yearsOfExperience) {
        queryParams.push(`experienceLevel=${encodeURIComponent(`["${filters.yearsOfExperience}"]`)}`);
      }
      
      // Build the final URL
      const searchUrl = `${baseUrl}?${queryParams.join('&')}`;
      
      // Navigate to the search URL
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Extract profile data
      const profiles = await this.extractProfiles(filters.maxResults || config.rateLimit.maxProfiles);
      
      return profiles;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  async extractProfiles(maxResults) {
    const profiles = [];
    let pageNum = 1;
    
    while (profiles.length < maxResults) {
      console.log(`Extracting profiles from page ${pageNum}...`);
      
      // Wait for profile cards to load
      await this.page.waitForSelector('.reusable-search__result-container', { timeout: 10000 });
      
      // Extract data from profile cards
      const pageProfiles = await this.page.evaluate(() => {
        const results = [];
        const cards = document.querySelectorAll('.reusable-search__result-container');
        
        cards.forEach(card => {
          try {
            // Get the profile link and name
            const linkElement = card.querySelector('.app-aware-link');
            const nameElement = card.querySelector('.entity-result__title-text a span span');
            
            // Get the title and company
            const subtitleElement = card.querySelector('.entity-result__primary-subtitle');
            
            // Get the location
            const locationElement = card.querySelector('.entity-result__secondary-subtitle');
            
            // Only add if we have at least a name and link
            if (linkElement && nameElement) {
              results.push({
                name: nameElement.innerText.trim(),
                profileUrl: linkElement.href,
                title: subtitleElement ? subtitleElement.innerText.trim() : '',
                location: locationElement ? locationElement.innerText.trim() : '',
                // We'll get more detailed info when we visit the profile
                description: ''
              });
            }
          } catch (e) {
            // Skip this card if there's an error
          }
        });
        
        return results;
      });
      
      // Add the profiles from this page
      profiles.push(...pageProfiles);
      
      // Check if we've reached the max results
      if (profiles.length >= maxResults) {
        return profiles.slice(0, maxResults);
      }
      
      // Try to go to the next page
      const nextButton = await this.page.$('button.artdeco-pagination__button--next:not(.artdeco-pagination__button--disabled)');
      if (!nextButton) {
        break; // No more pages
      }
      
      // Click next and wait for results to load
      await nextButton.click();
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
      pageNum++;
      
      // Delay to avoid rate limiting
      await this.delay(config.rateLimit.requestDelay);
    }
    
    return profiles.slice(0, maxResults);
  }
  
  async getProfileDetails(profileUrl) {
    try {
      await this.page.goto(profileUrl, { waitUntil: 'networkidle2' });
      
      // Extract detailed profile information
      const profile = await this.page.evaluate(() => {
        // Helper function to safely get text content
        const getText = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.innerText.trim() : '';
        };
        
        // Get skills section
        const skills = Array.from(document.querySelectorAll('.pv-skill-category-entity__name-text'))
          .map(skill => skill.innerText.trim());
          
        // Get experience section
        const experienceItems = Array.from(document.querySelectorAll('.experience-item'));
        const experience = experienceItems.map(item => {
          const title = item.querySelector('.pv-entity__summary-info h3')?.innerText.trim() || '';
          const company = item.querySelector('.pv-entity__secondary-title')?.innerText.trim() || '';
          const duration = item.querySelector('.pv-entity__date-range span:not(.visually-hidden)')?.innerText.trim() || '';
          const description = item.querySelector('.pv-entity__description')?.innerText.trim() || '';
          
          return { title, company, duration, description };
        });
        
        // Get education section
        const educationItems = Array.from(document.querySelectorAll('.education-item'));
        const education = educationItems.map(item => {
          const school = item.querySelector('.pv-entity__school-name')?.innerText.trim() || '';
          const degree = item.querySelector('.pv-entity__degree-name span:not(.visually-hidden)')?.innerText.trim() || '';
          const field = item.querySelector('.pv-entity__fos span:not(.visually-hidden)')?.innerText.trim() || '';
          const dates = item.querySelector('.pv-entity__dates span:not(.visually-hidden)')?.innerText.trim() || '';
          
          return { school, degree, field, dates };
        });
        
        return {
          name: getText('.pv-top-card--list .pv-top-card--list-bullet li:first-child'),
          headline: getText('.pv-top-card-section__headline'),
          location: getText('.pv-top-card-section__location'),
          about: getText('.pv-about-section .pv-about__summary-text'),
          experience,
          education,
          skills
        };
      });
      
      return profile;
    } catch (error) {
      console.error('Failed to get profile details:', error);
      return null;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      globalBrowser = null;
    }
  }
}

module.exports = LinkedInScraper;