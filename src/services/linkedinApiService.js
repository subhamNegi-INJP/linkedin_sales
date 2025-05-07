const axios = require('axios');
const config = require('../../config/config');

class LinkedInApiService {
  constructor() {
    this.accessToken = config.linkedinApi.accessToken;
    this.baseUrl = 'https://api.linkedin.com/v2';
    this.salesNavigatorUrl = 'https://api.linkedin.com/sales-api/v1';
    this.initialized = false;
  }

  /**
   * Initialize the API service by validating the access token
   */
  async initialize() {
    try {
      // Check if we have a valid access token
      if (!this.accessToken) {
        throw new Error('LinkedIn API access token is not configured');
      }

      // Verify the token by making a simple API call
      await this.makeApiRequest(`${this.baseUrl}/me`);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('LinkedIn API initialization error:', error.message);
      // If token is expired, we could add refresh token logic here
      return false;
    }
  }

  /**
   * Search for LinkedIn profiles using Sales Navigator Search API
   * @param {Object} filters - Search filters
   * @returns {Array} - Array of profile results
   */
  async searchProfiles(filters) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Prepare search parameters based on filters
      const params = this.buildSearchParams(filters);
      
      // Make API request to Sales Navigator Search endpoint
      const response = await this.makeApiRequest(
        `${this.salesNavigatorUrl}/sales/search/lead`,
        'POST',
        params
      );

      // Process and format the response
      return this.processSearchResults(response.data);
    } catch (error) {
      console.error('LinkedIn API search error:', error.message);
      return [];
    }
  }

  /**
   * Get detailed profile information for a specific profile
   * @param {String} profileId - LinkedIn member ID or URN
   * @returns {Object} - Profile details
   */
  async getProfileDetails(profileId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Extract member ID from URL if needed
      const memberId = this.extractMemberIdFromUrl(profileId);
      
      if (!memberId) {
        throw new Error('Invalid profile ID or URL');
      }

      // Make API request to get member profile
      const response = await this.makeApiRequest(
        `${this.salesNavigatorUrl}/sales/leads/${memberId}`,
        'GET',
        {
          // Include desired fields
          fields: 'firstName,lastName,title,companyName,location,profilePictureUrl,summary,experience,education,skills'
        }
      );

      // Process and format the response
      return this.processProfileDetails(response.data);
    } catch (error) {
      console.error('LinkedIn API profile details error:', error.message);
      return null;
    }
  }

  /**
   * Helper method to make API requests
   * @param {String} url - API endpoint
   * @param {String} method - HTTP method
   * @param {Object} data - Request data or params
   * @returns {Object} - API response
   */
  async makeApiRequest(url, method = 'GET', data = null) {
    try {
      const options = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json',
        }
      };

      // Add data or params based on method
      if (method === 'GET' && data) {
        options.params = data;
      } else if (data) {
        options.data = data;
      }

      const response = await axios(options);
      return response;
    } catch (error) {
      if (error.response) {
        console.error(`API Error (${error.response.status}):`, 
                     error.response.data?.message || error.response.statusText);
        
        // Handle token expiration
        if (error.response.status === 401) {
          this.initialized = false;
          throw new Error('LinkedIn API access token has expired');
        }
      }
      throw error;
    }
  }

  /**
   * Build search parameters based on filters
   * @param {Object} filters - User-provided filters
   * @returns {Object} - Formatted search parameters for API
   */
  buildSearchParams(filters) {
    // Initialize search query parameters
    const params = {
      q: 'leadSearch',
      start: 0,
      count: filters.maxResults || 20,
    };

    // Add search criteria based on filters
    const searchCriteria = {};
    
    // Keywords/title search
    if (filters.keywords) {
      searchCriteria.keywords = filters.keywords;
    }

    // Location filter
    if (filters.location) {
      searchCriteria.geoLocations = {
        locations: [{ name: filters.location }]
      };
    }

    // Current company filter
    if (filters.currentCompany) {
      searchCriteria.currentCompany = {
        values: [{ name: filters.currentCompany }]
      };
    }

    // Industry filter
    if (filters.industry) {
      searchCriteria.industries = {
        values: [{ name: filters.industry }]
      };
    }

    // School filter
    if (filters.school) {
      searchCriteria.schools = {
        values: [{ name: filters.school }]
      };
    }

    // Connection degree filter
    if (filters.connectionDegree) {
      searchCriteria.connectionDegree = {
        values: [{ degree: filters.connectionDegree }]
      };
    }

    // Add search criteria to params
    if (Object.keys(searchCriteria).length > 0) {
      params.search = searchCriteria;
    }

    return params;
  }

  /**
   * Process search results from API into the expected format
   * @param {Object} data - API response data
   * @returns {Array} - Formatted profile results
   */
  processSearchResults(data) {
    const results = [];
    
    if (!data.elements || !Array.isArray(data.elements)) {
      return results;
    }

    // Map API response to our expected format
    data.elements.forEach(element => {
      if (element.lead) {
        const lead = element.lead;
        
        results.push({
          name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
          profileUrl: lead.profileUrl || this.buildProfileUrl(lead.id),
          title: lead.title || '',
          location: lead.location?.displayName || '',
          company: lead.currentPositions?.[0]?.companyName || '',
          connectionDegree: lead.connectionDegree || ''
        });
      }
    });

    return results;
  }

  /**
   * Process profile details from API into the expected format
   * @param {Object} data - API response data
   * @returns {Object} - Formatted profile details
   */
  processProfileDetails(data) {
    if (!data) return null;

    // Format experience
    const experience = [];
    if (data.experience && Array.isArray(data.experience)) {
      data.experience.forEach(exp => {
        experience.push({
          title: exp.title || '',
          company: exp.companyName || '',
          duration: `${exp.startDate || ''} - ${exp.endDate || 'Present'}`,
          description: exp.description || ''
        });
      });
    }

    // Format education
    const education = [];
    if (data.education && Array.isArray(data.education)) {
      data.education.forEach(edu => {
        education.push({
          school: edu.schoolName || '',
          degree: edu.degree || '',
          field: edu.fieldOfStudy || '',
          dates: `${edu.startDate || ''} - ${edu.endDate || 'Present'}`
        });
      });
    }

    // Format skills
    const skills = data.skills?.map(skill => skill.name) || [];

    return {
      name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      headline: data.title || '',
      location: data.location?.displayName || '',
      about: data.summary || '',
      experience,
      education,
      skills
    };
  }

  /**
   * Extract LinkedIn member ID from a profile URL
   * @param {String} profileUrlOrId - Profile URL or member ID
   * @returns {String} - Extracted member ID
   */
  extractMemberIdFromUrl(profileUrlOrId) {
    // If it's already a member ID (numeric or URN format)
    if (/^\d+$/.test(profileUrlOrId) || profileUrlOrId.startsWith('urn:li:person:')) {
      return profileUrlOrId;
    }

    // Extract from profile URL
    const urlPattern = /linkedin\.com\/in\/([^/]+)/;
    const match = profileUrlOrId.match(urlPattern);
    
    if (match && match[1]) {
      return match[1];
    }

    // If Sales Navigator URL
    const salesPattern = /linkedin\.com\/sales\/lead\/([^/,?]+)/;
    const salesMatch = profileUrlOrId.match(salesPattern);
    
    if (salesMatch && salesMatch[1]) {
      return salesMatch[1];
    }

    return null;
  }

  /**
   * Build a LinkedIn profile URL from member ID
   * @param {String} memberId - LinkedIn member ID
   * @returns {String} - LinkedIn profile URL
   */
  buildProfileUrl(memberId) {
    if (!memberId) return '';
    
    // If it's a URN, extract just the ID part
    if (memberId.startsWith('urn:li:person:')) {
      memberId = memberId.split(':').pop();
    }
    
    return `https://www.linkedin.com/in/${memberId}`;
  }
}

module.exports = LinkedInApiService;