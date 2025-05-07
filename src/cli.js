const dotenv = require('dotenv');
const readline = require('readline');
const ScraperController = require('./controller');

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const scraperController = new ScraperController();

// Function to prompt for user input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Main function
async function main() {
  try {
    console.log('LinkedIn Profile Scraper CLI');
    console.log('----------------------------');
    
    // Initialize the scraper
    console.log('Initializing LinkedIn scraper...');
    await scraperController.ensureInitialized();
    console.log('Successfully logged in to LinkedIn!');
    
    // Get search filters from user input
    const filters = {};
    
    filters.keywords = await prompt('Enter keywords to search (job title, skills, etc.): ');
    filters.location = await prompt('Enter location (e.g., "United States", "New York"): ');
    filters.currentCompany = await prompt('Enter current company (optional): ');
    filters.industry = await prompt('Enter industry (optional): ');
    filters.connectionDegree = await prompt('Enter connection degree (F=1st, S=2nd, O=3rd+, optional): ');
    filters.yearsOfExperience = await prompt('Enter experience level (1=Internship, 2=Entry, 3=Associate, 4=Mid-Senior, 5=Director, 6=Executive, optional): ');
    
    const maxResultsInput = await prompt('Maximum number of results (default: 20): ');
    filters.maxResults = maxResultsInput ? parseInt(maxResultsInput) : 20;
    
    const getDetailedInfoInput = await prompt('Get detailed profile information? (y/n, default: n): ');
    filters.getDetailedInfo = getDetailedInfoInput.toLowerCase() === 'y';
    
    if (filters.getDetailedInfo) {
      const maxDetailedInput = await prompt('Maximum number of detailed profiles (default: 5): ');
      filters.maxDetailedProfiles = maxDetailedInput ? parseInt(maxDetailedInput) : 5;
    }
    
    console.log('\nSearching for profiles with the following filters:');
    console.log(JSON.stringify(filters, null, 2));
    console.log('\nThis may take a while depending on your search parameters...');
    
    // Find profiles
    const profiles = await scraperController.findProfiles(filters);
    
    // Display results
    console.log(`\nFound ${profiles.length} profiles:`);
    profiles.forEach((profile, index) => {
      console.log(`\n[${index + 1}] ${profile.name}`);
      console.log(`    Title: ${profile.title}`);
      console.log(`    Location: ${profile.location}`);
      console.log(`    URL: ${profile.profileUrl}`);
      
      if (profile.details) {
        console.log('    --- Detailed Info ---');
        console.log(`    Headline: ${profile.details.headline}`);
        
        if (profile.details.skills && profile.details.skills.length > 0) {
          console.log(`    Skills: ${profile.details.skills.join(', ')}`);
        }
        
        if (profile.details.experience && profile.details.experience.length > 0) {
          console.log('    Experience:');
          profile.details.experience.forEach(exp => {
            console.log(`      * ${exp.title} at ${exp.company} (${exp.duration})`);
          });
        }
        
        if (profile.details.education && profile.details.education.length > 0) {
          console.log('    Education:');
          profile.details.education.forEach(edu => {
            console.log(`      * ${edu.degree} in ${edu.field} at ${edu.school} (${edu.dates})`);
          });
        }
      }
    });
    
    // Export option
    const exportOption = await prompt('\nExport results to JSON file? (y/n): ');
    if (exportOption.toLowerCase() === 'y') {
      const fs = require('fs');
      const filename = `linkedin_profiles_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(filename, JSON.stringify(profiles, null, 2));
      console.log(`Profiles exported to ${filename}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Clean up
    await scraperController.close();
    rl.close();
  }
}

// Run the main function
main();