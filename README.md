# LinkedIn Profile Scraper with Advanced Filtering

This is a powerful LinkedIn scraper that allows you to search for LinkedIn profiles with advanced filtering options. It uses Puppeteer for browser automation to log in to LinkedIn and extract profile information based on your search criteria.

## Features

- Search LinkedIn profiles using multiple filters including:
  - Keywords (job titles, skills, etc.)
  - Location
  - Current company
  - Industry
  - Education (school)
  - Connection degree
  - Years of experience
- Get detailed profile information including:
  - Work experience
  - Education history
  - Skills
  - Contact information
  - About section
- Export results to JSON format
- Command-line interface for quick searches
- REST API for integration with other applications

## Prerequisites

- Node.js (v14 or higher)
- A valid LinkedIn account
- LinkedIn Premium account recommended for best results

## Installation

1. Clone this repository
2. Install dependencies:
```
npm install
```
3. Copy `.env.example` to `.env` and add your LinkedIn credentials:
```
LINKEDIN_EMAIL=your_linkedin_email@example.com
LINKEDIN_PASSWORD=your_linkedin_password
HEADLESS=false
PORT=3000
```

## Usage

### Command Line Interface

Run the CLI tool to search for profiles:

```
npm run cli
```

Follow the prompts to enter your search criteria. The CLI will guide you through the available filters.

### API Server

Start the API server:

```
npm start
```

The server will run on port 3000 (or the port specified in your .env file).

#### API Endpoints

- `GET /api/filters` - Get available filter options
- `POST /api/search` - Search for profiles with filters
- `GET /api/profile/:url` - Get detailed information for a specific profile

Example search request:

```json
POST /api/search
{
  "keywords": "software engineer",
  "location": "New York",
  "currentCompany": "Google",
  "industry": "Software Development",
  "school": "MIT",
  "connectionDegree": "S",
  "yearsOfExperience": "4",
  "maxResults": 20,
  "getDetailedInfo": true,
  "maxDetailedProfiles": 5
}
```

## Important Notes

1. LinkedIn may detect and block automated access to their platform. Use this tool responsibly and avoid making too many requests in a short period.
2. The scraper may break if LinkedIn changes their website structure.
3. Usage of this tool should comply with LinkedIn's terms of service.
4. This tool is intended for educational purposes only.

## License

ISC

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.