const LinkedInApiService = require('./services/linkedinApiService');

class ScraperController {
  constructor() {
    this.scraper = new LinkedInApiService();
    this.initialized = false;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      console.log("Initializing LinkedIn API service...");
      const initialized = await this.scraper.initialize();
      
      if (!initialized) {
        throw new Error('Failed to initialize LinkedIn API. Check your API credentials.');
      }
      
      this.initialized = true;
      console.log("LinkedIn API service initialized successfully");
    }
  }

  async findProfiles(filters) {
    try {
      await this.ensureInitialized();
      
      // Validate and sanitize filters
      const sanitizedFilters = this.sanitizeFilters(filters);
      
      // Search for profiles with the given filters
      const profiles = await this.scraper.searchProfiles(sanitizedFilters);
      
      // If detailed info requested, fetch profile details for each result
      if (sanitizedFilters.getDetailedInfo && profiles.length > 0) {
        const maxDetailed = Math.min(profiles.length, sanitizedFilters.maxDetailedProfiles);
        
        for (let i = 0; i < maxDetailed; i++) {
          try {
            const profileDetails = await this.scraper.getProfileDetails(profiles[i].profileUrl);
            if (profileDetails) {
              profiles[i].details = profileDetails;
            }
          } catch (error) {
            console.error(`Error getting details for profile ${i}:`, error);
          }
        }
      }
      
      return profiles;
    } catch (error) {
      console.error('Error finding profiles:', error);
      throw error;
    }
  }

  async getProfileDetails(profileUrl) {
    try {
      await this.ensureInitialized();
      return await this.scraper.getProfileDetails(profileUrl);
    } catch (error) {
      console.error('Error getting profile details:', error);
      throw error;
    }
  }

  sanitizeFilters(filters) {
    const defaultFilters = {
      keywords: '',
      location: '',
      currentCompany: '',
      industry: '',
      school: '',
      connectionDegree: '',
      yearsOfExperience: '',
      maxResults: 20,
      getDetailedInfo: true,
      maxDetailedProfiles: 10
    };

    // Merge provided filters with defaults
    const sanitized = { ...defaultFilters, ...filters };
    
    // Ensure maxResults is a reasonable number
    sanitized.maxResults = Math.min(
      Math.max(1, parseInt(sanitized.maxResults) || 20),
      100
    );
    
    // Ensure we're not trying to get detailed info for too many profiles
    sanitized.maxDetailedProfiles = Math.min(
      Math.max(1, parseInt(sanitized.maxDetailedProfiles) || 10),
      20
    );
    
    return sanitized;
  }

  async close() {
    // No real need to close API connections, but keeping method for compatibility
    this.initialized = false;
    return true;
  }
}

module.exports = ScraperController;