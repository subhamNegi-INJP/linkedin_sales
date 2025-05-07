// LinkedIn API UI JavaScript

// Global variable to store search results
let searchResults = [];

// Initialize the UI when the page is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication status
    checkAuthStatus();
    
    // Load filter options from the API
    loadFilterOptions();
    
    // Handle form submission
    document.getElementById('searchForm').addEventListener('submit', function(e) {
        e.preventDefault();
        searchProfiles();
    });
    
    // Handle export button click
    document.getElementById('exportButton').addEventListener('click', function() {
        exportResults();
    });
    
    // Handle auth button click
    document.getElementById('authButton').addEventListener('click', function() {
        initiateOAuth();
    });
    
    // Listen for auth success messages from popup window
    window.addEventListener('message', function(event) {
        if (event.data === 'linkedin-auth-success') {
            checkAuthStatus();
        }
    });
});

// Check the LinkedIn API authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        const authButton = document.getElementById('authButton');
        const authStatus = document.getElementById('authStatus');
        const searchButton = document.getElementById('searchButton');
        
        if (data.authenticated) {
            // Authenticated
            authButton.textContent = 'Re-authenticate';
            authButton.classList.remove('btn-danger');
            authButton.classList.add('btn-outline-secondary');
            
            authStatus.textContent = 'You are connected to LinkedIn API';
            authStatus.classList.remove('text-danger');
            authStatus.classList.add('text-success');
            
            searchButton.disabled = false;
        } else {
            // Not authenticated
            authButton.textContent = 'Connect to LinkedIn API';
            authButton.classList.remove('btn-outline-secondary');
            authButton.classList.add('btn-danger');
            
            if (data.tokenExpired) {
                authStatus.textContent = 'Your LinkedIn API token has expired. Please re-authenticate.';
            } else {
                authStatus.textContent = 'Not connected to LinkedIn API';
            }
            
            authStatus.classList.remove('text-success');
            authStatus.classList.add('text-danger');
            
            searchButton.disabled = true;
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
    }
}

// Initiate the OAuth flow
function initiateOAuth() {
    // Open the auth window
    const authWindow = window.open('/auth/linkedin', 'linkedinAuth', 'width=600,height=700');
    
    // Check if window was blocked by popup blocker
    if (!authWindow || authWindow.closed || typeof authWindow.closed === 'undefined') {
        showAlert('error', 'Popup blocked! Please allow popups for this site to authenticate with LinkedIn.');
    }
}

// Load filter options from the API
async function loadFilterOptions() {
    try {
        const response = await fetch('/api/filters');
        const data = await response.json();
        
        // Populate industry dropdown
        const industrySelect = document.getElementById('industry');
        data.industries.forEach(industry => {
            const option = document.createElement('option');
            option.value = industry.id;
            option.textContent = industry.name;
            industrySelect.appendChild(option);
        });
        
        // Populate connection degree dropdown
        const connectionSelect = document.getElementById('connectionDegree');
        data.connectionDegrees.forEach(connection => {
            const option = document.createElement('option');
            option.value = connection.id;
            option.textContent = connection.name;
            connectionSelect.appendChild(option);
        });
        
        // Populate experience level dropdown
        const experienceSelect = document.getElementById('yearsOfExperience');
        data.experienceLevels.forEach(experience => {
            const option = document.createElement('option');
            option.value = experience.id;
            option.textContent = experience.name;
            experienceSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading filter options:', error);
        showAlert('error', 'Failed to load filter options. Please refresh the page and try again.');
    }
}

// Search profiles based on the form inputs
async function searchProfiles() {
    // Show loading indicator
    document.getElementById('loadingIndicator').classList.remove('d-none');
    document.getElementById('resultsContainer').innerHTML = '';
    document.getElementById('exportButton').disabled = true;
    
    // Get form values
    const filters = {
        keywords: document.getElementById('keywords').value,
        location: document.getElementById('location').value,
        currentCompany: document.getElementById('currentCompany').value,
        industry: document.getElementById('industry').value,
        school: document.getElementById('school').value,
        connectionDegree: document.getElementById('connectionDegree').value,
        yearsOfExperience: document.getElementById('yearsOfExperience').value,
        maxResults: document.getElementById('maxResults').value,
        getDetailedInfo: document.getElementById('getDetailedInfo').checked,
        maxDetailedProfiles: document.getElementById('maxDetailedProfiles').value
    };
    
    try {
        // Call the search API
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filters)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || `API Error: ${response.status}`);
        }
        
        const data = await response.json();
        searchResults = data.profiles;
        
        // Display results
        displayResults(data);
        
        // Enable export button if there are results
        document.getElementById('exportButton').disabled = searchResults.length === 0;
    } catch (error) {
        console.error('Error searching profiles:', error);
        showAlert('error', 'Failed to search profiles. ' + error.message);
    } finally {
        // Hide loading indicator
        document.getElementById('loadingIndicator').classList.add('d-none');
    }
}

// Display search results
function displayResults(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.innerHTML = '';
    
    if (data.profiles.length === 0) {
        showAlert('info', 'No profiles found matching your search criteria.');
        return;
    }
    
    // Show result count
    const countElement = document.createElement('div');
    countElement.className = 'alert alert-success';
    countElement.textContent = `Found ${data.count} profile(s) matching your search criteria.`;
    resultsContainer.appendChild(countElement);
    
    // Create a container for profile cards
    const profilesContainer = document.createElement('div');
    profilesContainer.className = 'row';
    
    // Add each profile
    data.profiles.forEach((profile, index) => {
        const profileCard = createProfileCard(profile, index);
        profilesContainer.appendChild(profileCard);
    });
    
    resultsContainer.appendChild(profilesContainer);
}

// Create a card element for a profile
function createProfileCard(profile, index) {
    const col = document.createElement('div');
    col.className = 'col-md-6 mb-3';
    
    const card = document.createElement('div');
    card.className = 'card profile-card h-100';
    
    // Card header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header d-flex justify-content-between align-items-center';
    
    const profileNumber = document.createElement('span');
    profileNumber.className = 'badge bg-primary';
    profileNumber.textContent = `#${index + 1}`;
    
    const viewDetailsBtn = document.createElement('button');
    viewDetailsBtn.className = 'btn btn-sm btn-outline-primary';
    viewDetailsBtn.textContent = 'View Details';
    viewDetailsBtn.addEventListener('click', () => showProfileDetails(profile));
    
    cardHeader.appendChild(profileNumber);
    cardHeader.appendChild(viewDetailsBtn);
    
    // Card body
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    
    // Profile name
    const nameElement = document.createElement('h5');
    nameElement.className = 'card-title';
    nameElement.textContent = profile.name;
    
    // Profile title/headline
    const titleElement = document.createElement('h6');
    titleElement.className = 'card-subtitle mb-2 text-muted';
    titleElement.textContent = profile.title || 'No title provided';
    
    // Profile location
    const locationElement = document.createElement('p');
    locationElement.className = 'card-text small';
    locationElement.innerHTML = `<i class="bi bi-geo-alt"></i> ${profile.location || 'Location not specified'}`;
    
    // Profile link
    const linkElement = document.createElement('a');
    linkElement.href = profile.profileUrl;
    linkElement.className = 'btn btn-sm btn-outline-primary mt-2';
    linkElement.textContent = 'View on LinkedIn';
    linkElement.target = '_blank';
    
    // Append elements to card body
    cardBody.appendChild(nameElement);
    cardBody.appendChild(titleElement);
    cardBody.appendChild(locationElement);
    
    // Add skills if available (for detailed profiles)
    if (profile.details && profile.details.skills && profile.details.skills.length > 0) {
        const skillsContainer = document.createElement('div');
        skillsContainer.className = 'mt-2';
        
        const skillsTitle = document.createElement('p');
        skillsTitle.className = 'mb-1 fw-bold small';
        skillsTitle.textContent = 'Skills:';
        skillsContainer.appendChild(skillsTitle);
        
        const skillsList = document.createElement('div');
        profile.details.skills.slice(0, 5).forEach(skill => {
            const skillBadge = document.createElement('span');
            skillBadge.className = 'badge bg-secondary skill-badge';
            skillBadge.textContent = skill;
            skillsList.appendChild(skillBadge);
        });
        
        if (profile.details.skills.length > 5) {
            const moreBadge = document.createElement('span');
            moreBadge.className = 'badge bg-light text-dark skill-badge';
            moreBadge.textContent = `+${profile.details.skills.length - 5} more`;
            skillsList.appendChild(moreBadge);
        }
        
        skillsContainer.appendChild(skillsList);
        cardBody.appendChild(skillsContainer);
    }
    
    cardBody.appendChild(linkElement);
    
    // Append card header and body to card
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    
    // Append card to column
    col.appendChild(card);
    
    return col;
}

// Show detailed profile information in a modal
function showProfileDetails(profile) {
    const modalTitle = document.getElementById('profileModalTitle');
    const modalBody = document.getElementById('profileModalBody');
    
    modalTitle.textContent = profile.name;
    modalBody.innerHTML = '';
    
    // Create profile header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'modal-profile-header';
    
    // Profile title/position
    const titleElement = document.createElement('h5');
    titleElement.textContent = profile.title || 'No title provided';
    headerDiv.appendChild(titleElement);
    
    // Profile location
    const locationElement = document.createElement('p');
    locationElement.className = 'mb-1';
    locationElement.innerHTML = `<strong>Location:</strong> ${profile.location || 'Not specified'}`;
    headerDiv.appendChild(locationElement);
    
    // LinkedIn link
    const linkElement = document.createElement('p');
    linkElement.className = 'mb-0';
    linkElement.innerHTML = `<a href="${profile.profileUrl}" target="_blank" class="btn btn-sm btn-primary">View on LinkedIn</a>`;
    headerDiv.appendChild(linkElement);
    
    modalBody.appendChild(headerDiv);
    
    // If we have detailed info
    if (profile.details) {
        // About section if available
        if (profile.details.about) {
            const aboutSection = document.createElement('div');
            aboutSection.className = 'mb-3';
            
            const aboutTitle = document.createElement('h6');
            aboutTitle.className = 'border-bottom pb-1';
            aboutTitle.textContent = 'About';
            aboutSection.appendChild(aboutTitle);
            
            const aboutText = document.createElement('p');
            aboutText.textContent = profile.details.about;
            aboutSection.appendChild(aboutText);
            
            modalBody.appendChild(aboutSection);
        }
        
        // Experience section
        if (profile.details.experience && profile.details.experience.length > 0) {
            const expSection = document.createElement('div');
            expSection.className = 'mb-3';
            
            const expTitle = document.createElement('h6');
            expTitle.className = 'border-bottom pb-1';
            expTitle.textContent = 'Experience';
            expSection.appendChild(expTitle);
            
            const expList = document.createElement('div');
            profile.details.experience.forEach(exp => {
                const expItem = document.createElement('div');
                expItem.className = 'experience-entry';
                
                const jobTitle = document.createElement('p');
                jobTitle.className = 'mb-0 fw-bold';
                jobTitle.textContent = exp.title;
                expItem.appendChild(jobTitle);
                
                const company = document.createElement('p');
                company.className = 'mb-0';
                company.textContent = exp.company;
                expItem.appendChild(company);
                
                const duration = document.createElement('p');
                duration.className = 'text-muted small';
                duration.textContent = exp.duration;
                expItem.appendChild(duration);
                
                if (exp.description) {
                    const description = document.createElement('p');
                    description.className = 'small mt-1';
                    description.textContent = exp.description;
                    expItem.appendChild(description);
                }
                
                expList.appendChild(expItem);
            });
            
            expSection.appendChild(expList);
            modalBody.appendChild(expSection);
        }
        
        // Education section
        if (profile.details.education && profile.details.education.length > 0) {
            const eduSection = document.createElement('div');
            eduSection.className = 'mb-3';
            
            const eduTitle = document.createElement('h6');
            eduTitle.className = 'border-bottom pb-1';
            eduTitle.textContent = 'Education';
            eduSection.appendChild(eduTitle);
            
            const eduList = document.createElement('div');
            profile.details.education.forEach(edu => {
                const eduItem = document.createElement('div');
                eduItem.className = 'mb-2';
                
                const school = document.createElement('p');
                school.className = 'mb-0 fw-bold';
                school.textContent = edu.school;
                eduItem.appendChild(school);
                
                const degree = document.createElement('p');
                degree.className = 'mb-0';
                degree.textContent = `${edu.degree}${edu.field ? ` in ${edu.field}` : ''}`;
                eduItem.appendChild(degree);
                
                const dates = document.createElement('p');
                dates.className = 'text-muted small';
                dates.textContent = edu.dates;
                eduItem.appendChild(dates);
                
                eduList.appendChild(eduItem);
            });
            
            eduSection.appendChild(eduList);
            modalBody.appendChild(eduSection);
        }
        
        // Skills section
        if (profile.details.skills && profile.details.skills.length > 0) {
            const skillSection = document.createElement('div');
            skillSection.className = 'mb-3';
            
            const skillTitle = document.createElement('h6');
            skillTitle.className = 'border-bottom pb-1';
            skillTitle.textContent = 'Skills';
            skillSection.appendChild(skillTitle);
            
            const skillsList = document.createElement('div');
            skillsList.className = 'mt-2';
            
            profile.details.skills.forEach(skill => {
                const skillBadge = document.createElement('span');
                skillBadge.className = 'badge bg-secondary skill-badge';
                skillBadge.textContent = skill;
                skillsList.appendChild(skillBadge);
            });
            
            skillSection.appendChild(skillsList);
            modalBody.appendChild(skillSection);
        }
    } else {
        // If no detailed info is available
        const noDetailsMsg = document.createElement('div');
        noDetailsMsg.className = 'alert alert-info';
        noDetailsMsg.textContent = 'Detailed profile information is not available. Check the "Get Detailed Profile Info" option in your search to see more information.';
        modalBody.appendChild(noDetailsMsg);
    }
    
    // Show the modal
    const profileModal = new bootstrap.Modal(document.getElementById('profileModal'));
    profileModal.show();
}

// Export results to JSON file
function exportResults() {
    if (searchResults.length === 0) {
        showAlert('warning', 'No results to export.');
        return;
    }
    
    // Create a JSON blob
    const dataStr = JSON.stringify(searchResults, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    
    // Create a download link and trigger it
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin_profiles_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('success', 'Results exported successfully.');
}

// Show an alert message
function showAlert(type, message) {
    const resultsContainer = document.getElementById('resultsContainer');
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.textContent = message;
    
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close';
    closeButton.setAttribute('data-bs-dismiss', 'alert');
    closeButton.setAttribute('aria-label', 'Close');
    
    alert.appendChild(closeButton);
    
    // Clear previous alerts
    const previousAlerts = resultsContainer.querySelectorAll('.alert');
    previousAlerts.forEach(prevAlert => prevAlert.remove());
    
    resultsContainer.prepend(alert);
}