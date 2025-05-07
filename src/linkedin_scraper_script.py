#!/usr/bin/env python
import sys
import json
import time
import random
from linkedin_scraper import Person, actions
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# Redirect all print statements to stderr except the final JSON result
def log(message):
    """Print log messages to stderr instead of stdout"""
    print(message, file=sys.stderr)

def setup_driver(headless=False, user_data_dir=None):
    """Set up the Chrome driver with options."""
    chrome_options = Options()
    if headless:
        # Proper headless configuration to avoid crashes
        chrome_options.add_argument('--headless=new')
        chrome_options.add_argument('--disable-gpu')
    
    # Use user data directory if provided (for persistent sessions)
    if user_data_dir:
        chrome_options.add_argument(f'--user-data-dir={user_data_dir}')
        # Add this to explicitly set the profile directory to avoid lock issues
        chrome_options.add_argument('--profile-directory=Default')
    
    # Add arguments to make the browser less detectable
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_argument('--window-size=1920,1080')
    
    # Add a unique debugging port to avoid conflicts
    import random
    debug_port = random.randint(9222, 9999)
    chrome_options.add_argument(f'--remote-debugging-port={debug_port}')
    
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    # Additional settings to avoid detection
    chrome_options.add_argument('--disable-features=IsolateOrigins,site-per-process')
    chrome_options.add_argument('--disable-web-security')
    chrome_options.add_argument('--allow-running-insecure-content')
    
    # Set a realistic user agent - update with a more recent Chrome version
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    
    # Disable WebRTC to avoid STUN server errors
    chrome_options.add_argument('--disable-webrtc')
    
    # Disable logging to reduce noise
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    
    # Add preferences to make the browser more stable
    prefs = {
        'profile.default_content_setting_values.notifications': 2,  # Block notifications
        'credentials_enable_service': False,  # Disable password manager
        'profile.password_manager_enabled': False,
        'intl.accept_languages': 'en-US,en',  # Set language preferences
    }
    chrome_options.add_experimental_option('prefs', prefs)
    
    try:
        log("Attempting to start Chrome driver...")
        driver = webdriver.Chrome(options=chrome_options)
        
        # Execute CDP commands to hide automation
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
            // Overwrite the 'webdriver' property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Overwrite the automation-related properties
            Object.defineProperty(navigator, 'maxTouchPoints', {
                get: () => 1
            });
            
            // Overwrite the languages property
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en', 'es']
            });
            
            // Overwrite the plugins property
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // Additional evasions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
            
            // Prevent fingerprinting based on hardware
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 8
            });
            
            // Prevent fingerprinting based on device memory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8
            });
            """
        })
        
        # Set window size explicitly
        driver.set_window_size(1920, 1080)
        
        return driver
    except Exception as e:
        log(f"Error creating Chrome driver: {str(e)}")
        # If we fail with the user data directory, try again without it
        if user_data_dir:
            log("Trying to start Chrome without user data directory...")
            chrome_options = Options()
            if headless:
                chrome_options.add_argument('--headless=new')
                chrome_options.add_argument('--disable-gpu')
            
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--window-size=1920,1080')
            
            return webdriver.Chrome(options=chrome_options)
        else:
            raise

def humanize_behavior(driver):
    """Add random pauses and movements to seem more human-like."""
    # Random pause between 1-3 seconds
    time.sleep(random.uniform(1, 3))

def login_linkedin(driver, email, password):
    """Log in to LinkedIn with improved error handling and anti-detection measures."""
    try:
        log("Attempting to login to LinkedIn...")
        
        # Navigate to login page with a randomized approach
        driver.get("https://www.linkedin.com")
        time.sleep(random.uniform(2, 4))  # Random wait to seem more human-like
        
        # Check if we're already on the login page, if not, find and click the sign-in button
        if "/login" not in driver.current_url:
            try:
                # Look for various sign-in buttons on the homepage
                possible_selectors = [
                    "a.nav__button-secondary",
                    "a[data-tracking-control-name='guest_homepage-basic_nav-header-signin']",
                    "a[href*='login']"
                ]
                
                for selector in possible_selectors:
                    try:
                        sign_in_button = WebDriverWait(driver, 3).until(
                            EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                        )
                        log(f"Found sign-in button with selector: {selector}")
                        sign_in_button.click()
                        time.sleep(random.uniform(1, 2))
                        break
                    except:
                        continue
            except Exception as e:
                log(f"Could not find sign-in button, directly navigating to login page: {str(e)}")
                driver.get("https://www.linkedin.com/login")
                time.sleep(random.uniform(2, 3))
        
        # Wait for username field with multiple retries
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # First check if we're already logged in (redirect to feed)
                if "feed" in driver.current_url:
                    log("Already logged in!")
                    return True
                
                # Wait for username field
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.ID, "username"))
                )
                log("Login page loaded successfully")
                break
            except TimeoutException:
                if attempt < max_retries - 1:
                    log(f"Timeout waiting for login page (attempt {attempt+1}/{max_retries}), refreshing...")
                    driver.refresh()
                    time.sleep(random.uniform(2, 4))
                else:
                    log("Could not load login page after multiple attempts")
                    # Take a screenshot for debugging
                    try:
                        driver.save_screenshot("login_page_error.png")
                        log("Debug screenshot saved as login_page_error.png")
                    except:
                        pass
                    raise
        
        # Enter email with human-like typing pattern
        try:
            email_field = driver.find_element(By.ID, "username")
            email_field.clear()
            for char in email:
                email_field.send_keys(char)
                time.sleep(random.uniform(0.05, 0.15))  # Randomize typing speed
            
            # Add a natural pause between fields
            time.sleep(random.uniform(0.8, 1.5))
        except Exception as e:
            log(f"Error entering email: {str(e)}")
            # Try an alternative approach
            try:
                log("Trying alternative approach for email field")
                driver.execute_script("document.getElementById('username').value = arguments[0]", email)
            except:
                raise Exception("Could not enter email in login form")
        
        # Enter password with human-like typing pattern
        try:
            password_field = driver.find_element(By.ID, "password")
            password_field.clear()
            for char in password:
                password_field.send_keys(char)
                time.sleep(random.uniform(0.05, 0.15))  # Randomize typing speed
            
            # Add a natural pause before clicking login
            time.sleep(random.uniform(0.8, 1.5))
        except Exception as e:
            log(f"Error entering password: {str(e)}")
            # Try an alternative approach
            try:
                log("Trying alternative approach for password field")
                driver.execute_script("document.getElementById('password').value = arguments[0]", password)
            except:
                raise Exception("Could not enter password in login form")
        
        # Click login button with retry mechanism
        max_button_retries = 3
        for attempt in range(max_button_retries):
            try:
                login_button = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
                )
                # Move mouse to button before clicking (more human-like)
                try:
                    from selenium.webdriver.common.action_chains import ActionChains
                    ActionChains(driver).move_to_element(login_button).pause(random.uniform(0.3, 0.7)).click().perform()
                except:
                    # Fallback to regular click if ActionChains fails
                    login_button.click()
                
                break
            except Exception as e:
                if attempt < max_button_retries - 1:
                    log(f"Error clicking login button (attempt {attempt+1}/{max_button_retries}): {str(e)}")
                    time.sleep(random.uniform(1, 2))
                else:
                    # Last resort: try JavaScript click
                    try:
                        log("Trying JavaScript click as last resort")
                        driver.execute_script("document.querySelector('button[type=\"submit\"]').click()")
                    except:
                        raise Exception("Could not click login button after multiple attempts")
        
        # Wait for login to complete with improved detection
        try:
            # Wait for either feed page or security checkpoint
            WebDriverWait(driver, 20).until(
                lambda d: any(x in d.current_url for x in ["feed", "checkpoint", "login-submit", "add-phone"])
            )
            
            # Check current URL to determine login status
            current_url = driver.current_url
            log(f"Post-login navigation complete. Current URL: {current_url}")
            
            if "feed" in current_url:
                log("Login successful - redirected to feed!")
                time.sleep(random.uniform(1, 2))  # Let the page fully load
                return True
                
            elif "checkpoint" in current_url or "add-phone" in current_url:
                log("LinkedIn security checkpoint detected. Manual intervention may be required.")
                # Let the user handle the checkpoint manually
                time.sleep(40)  # Give more time for manual intervention
                
                # Check again if we're logged in after manual intervention
                if "feed" in driver.current_url:
                    log("Login successful after checkpoint!")
                    return True
                else:
                    log(f"Still at checkpoint after waiting. Current URL: {driver.current_url}")
                    # Take a screenshot for debugging
                    try:
                        driver.save_screenshot("checkpoint_screen.png")
                        log("Checkpoint screenshot saved for debugging")
                    except:
                        pass
                    return False
            else:
                log(f"Login unsuccessful. Current URL: {current_url}")
                # Look for error messages on the page
                try:
                    error_messages = driver.find_elements(By.CSS_SELECTOR, ".alert, .error, .form-error")
                    for error in error_messages:
                        if error.is_displayed() and error.text.strip():
                            log(f"Login error message displayed: {error.text.strip()}")
                except:
                    pass
                return False
                
        except TimeoutException:
            log("Timeout waiting for login completion")
            # Check current URL anyway
            if "feed" in driver.current_url:
                log("Despite timeout, appears to be logged in successfully")
                return True
            # Take a screenshot for debugging
            try:
                driver.save_screenshot("login_timeout.png")
                log("Login timeout screenshot saved")
            except:
                pass
            return False
        
    except Exception as e:
        log(f"Login error: {str(e)}")
        # Log full traceback for debugging
        import traceback
        log(f"Stacktrace: {traceback.format_exc()}")
        
        # Take a screenshot for debugging
        try:
            driver.save_screenshot("login_error.png")
            log("Error screenshot saved as login_error.png")
        except:
            pass
        return False

def is_logged_in(driver):
    """
    Check if the user is currently logged in to LinkedIn with robust verification.
    Returns True if logged in, False otherwise.
    """
    try:
        # First check the URL - most reliable indicator
        current_url = driver.current_url
        
        # If we're on the feed or other internal pages, we're likely logged in
        if any(x in current_url for x in ["/feed", "/in/", "/mynetwork", "/jobs", "/messaging"]):
            log("Logged in - verified by URL check")
            return True
            
        # If we're on login-specific pages, we're definitely not logged in
        if any(x in current_url for x in ["/login", "/checkpoint", "signup"]):
            log("Not logged in - on login page")
            return False
            
        # Check for presence of nav bar elements that only appear when logged in
        try:
            # Try to find elements that only exist when logged in
            # Use a short timeout to not slow down the process too much
            WebDriverWait(driver, 3).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "nav.global-nav"))
            )
            log("Logged in - verified by presence of nav bar")
            return True
        except TimeoutException:
            # If we can't find the nav bar, try checking for profile button
            try:
                WebDriverWait(driver, 3).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "button[data-control-name='nav.settings']"))
                )
                log("Logged in - verified by presence of profile settings button")
                return True
            except TimeoutException:
                pass

        # As a fallback, check if we can find the login form
        try:
            login_form = driver.find_elements(By.ID, "username")
            if login_form:
                log("Not logged in - login form is present")
                return False
        except:
            pass
            
        # If we're still unsure, navigate to the feed and check again
        if "/feed" not in current_url:
            log("Login status unclear, attempting to navigate to feed")
            driver.get("https://www.linkedin.com/feed/")
            time.sleep(random.uniform(2, 3))
            
            # Check if we were redirected to the login page
            if any(x in driver.current_url for x in ["/login", "/checkpoint"]):
                log("Not logged in - redirected to login page")
                return False
                
            # If we successfully loaded the feed, we're logged in
            if "/feed" in driver.current_url:
                log("Logged in - successfully loaded feed page")
                return True
                
        log(f"Login status unclear after checks. Current URL: {driver.current_url}")
        return False
        
    except Exception as e:
        log(f"Error checking login status: {str(e)}")
        return False

def search_profiles(driver, keywords, location=None, max_results=10):
    """Search for profiles based on keywords and location."""
    try:
        log(f"Searching for profiles with keywords: '{keywords}', location: '{location}'")
        
        # Construct search URL with proper encoding
        search_url = "https://www.linkedin.com/search/results/people/?"
        
        # Add keywords if provided
        if keywords:
            from urllib.parse import quote
            search_url += f"keywords={quote(keywords)}"
        
        # Add location if provided
        if location:
            from urllib.parse import quote
            location_param = f"&geoUrn=%5B%22{quote(location)}%22%5D"
            search_url += location_param
        
        # Navigate to search page
        log(f"Navigating to search URL: {search_url}")
        driver.get(search_url)
        
        # Wait for page to load and results to appear
        try:
            log("Waiting for search results to load...")
            # Wait for various possible containers (2025 version)
            timeout = 15
            try:
                WebDriverWait(driver, timeout).until(lambda d: any([
                    len(d.find_elements(By.CSS_SELECTOR, selector)) > 0 
                    for selector in [
                        ".search-results-container",
                        ".search-results__container",
                        ".reusable-search__result-container",
                        ".scaffold-layout__main",
                        "[data-test-search-results-container]",
                        ".pserp-layout__content"
                    ]
                ]))
                log("Search results container found.")
            except TimeoutException:
                log(f"Timeout waiting for main search container. Continuing anyway...")
            
            # Add a small delay to ensure all results load
            time.sleep(5)
            
            # Check for "No results found" message
            try:
                for no_results_selector in [
                    ".search-no-results__container", 
                    ".search-results--empty",
                    "[data-test-empty-results-message]"
                ]:
                    no_results = driver.find_elements(By.CSS_SELECTOR, no_results_selector)
                    if no_results and any(elem.is_displayed() for elem in no_results):
                        log(f"LinkedIn returned no results for this search (detected with {no_results_selector}).")
                        return []
            except Exception as e:
                log(f"Error checking for no results message: {str(e)}")
            
            # Take screenshot of the search results page for debugging
            log("Taking screenshot of the search results page for debugging...")
            driver.save_screenshot("search_results.png")
            
            # 2025 specific selectors based on the provided HTML structure
            profile_cards = []
            
            # First try the specific profile card selector from the example
            specific_card_selectors = [
                "li.vkZEvhSqLOnLWodnFYCRDBnmsEjqiYVTw",
                "div.iApnJXUiSsjqmiRQZkvmEoajuUczHMyoNFl",
                "div[class*='LbjsZYFQzzAaOzYtctfbmFlDsqCMvbkzCVOwk']",
                "div[data-chameleon-result-urn*='urn:li:member:']"
            ]
            
            for selector in specific_card_selectors:
                try:
                    cards = driver.find_elements(By.CSS_SELECTOR, selector)
                    if cards and len(cards) > 0:
                        log(f"Found {len(cards)} profile cards with 2025 specific selector: {selector}")
                        profile_cards = cards
                        break
                except Exception as e:
                    log(f"Error with 2025 specific selector {selector}: {str(e)}")
            
            # If specific selectors didn't work, try other potential selectors
            if not profile_cards:
                possible_selectors = [
                    # Other potential selectors
                    "div.pserp-layout__result-item",
                    "li.reusable-search__result-container",
                    "div.entity-result",
                    "div.search-entity-result",
                    "div.search-results-entity-result",
                    ".reusable-search__result-container",
                    ".entity-result",
                    ".search-results__result-item",
                    "li.artdeco-list__item",
                    ".artdeco-list__item",
                    ".ember-view.artdeco-list__item",
                    "[data-view-name='search-result-item']",
                    # Generic list item selectors that might contain profile results
                    "li.search-result",
                    "ul.reusable-search__entity-result-list > li",
                    "ul.artdeco-list > li"
                ]
                
                for selector in possible_selectors:
                    try:
                        cards = driver.find_elements(By.CSS_SELECTOR, selector)
                        if cards and len(cards) > 0:
                            log(f"Found {len(cards)} profile cards with selector: {selector}")
                            profile_cards = cards
                            break
                    except Exception as e:
                        log(f"Error with selector {selector}: {str(e)}")
            
            # If no cards found yet, try direct link approach
            if not profile_cards:
                log("No profile cards found with selectors. Trying direct link approach...")
                results = extract_profiles_from_links(driver, max_results)
                if results:
                    return results
            
            # Process the profile cards to extract data
            results = []
            processed_urls = set()  # To avoid duplicates
            
            log(f"Processing {len(profile_cards)} profile cards...")
            for i, card in enumerate(profile_cards[:max_results]):
                try:
                    # Extract profile URL - directly target the specific class from the example
                    profile_url = None
                    profile_name = "Unknown"
                    
                    # Try 2025 specific selectors first
                    try:
                        # Target the specific class for links from the example
                        link_elem = card.find_element(By.CSS_SELECTOR, "a.eBOSiHffioaRqrowDPILgMQbHBQe")
                        if link_elem:
                            profile_url = link_elem.get_attribute("href")
                            if profile_url:
                                profile_url = profile_url.split("?")[0]  # Remove tracking parameters
                                
                                # Extract name from the link
                                span_elems = link_elem.find_elements(By.TAG_NAME, "span")
                                for span in span_elems:
                                    if span.text and not span.text.isspace() and len(span.text) > 1:
                                        profile_name = span.text.strip()
                                        break
                    except Exception as e:
                        log(f"Error with 2025 specific link selector: {str(e)}")
                    
                    # If specific selectors failed, try generic approach
                    if not profile_url:
                        try:
                            # Generic approach - any link with /in/ pattern
                            links = card.find_elements(By.CSS_SELECTOR, "a[href*='/in/']")
                            if links:
                                for link in links:
                                    href = link.get_attribute("href")
                                    if href and "/in/" in href:
                                        profile_url = href.split("?")[0]
                                        
                                        # Try to get name
                                        try:
                                            spans = link.find_elements(By.TAG_NAME, "span")
                                            for span in spans:
                                                if span.text and not span.text.isspace() and len(span.text) > 1:
                                                    profile_name = span.text.strip()
                                                    break
                                        except:
                                            pass
                                        
                                        break
                        except Exception as e:
                            log(f"Error with generic link extraction: {str(e)}")
                    
                    if not profile_url:
                        log(f"Could not find profile URL in card {i+1}")
                        continue
                    
                    # Skip if this URL has already been processed
                    if profile_url in processed_urls:
                        log(f"Skipping duplicate profile URL: {profile_url}")
                        continue
                    
                    processed_urls.add(profile_url)
                    
                    # Extract title and location using 2025 specific classes
                    title = ""
                    location = ""
                    
                    # Try 2025 specific title selector
                    try:
                        title_elem = card.find_element(By.CSS_SELECTOR, "div.tvZyUTymqQUmWAonPMfdpcDvzAIYFHuWLfBUE")
                        if title_elem:
                            title = title_elem.text.strip()
                    except:
                        # Try generic approach
                        try:
                            subtitle_elems = card.find_elements(By.CSS_SELECTOR, ".t-14, .t-black--light")
                            if subtitle_elems and len(subtitle_elems) > 0:
                                title = subtitle_elems[0].text.strip()
                        except:
                            pass
                    
                    # Try 2025 specific location selector
                    try:
                        location_elem = card.find_element(By.CSS_SELECTOR, "div.HhmzfnhfsJBnlckYHmnKptNFyvpjjiSpBs")
                        if location_elem:
                            location = location_elem.text.strip()
                    except:
                        # Try generic approach
                        try:
                            subtitle_elems = card.find_elements(By.CSS_SELECTOR, ".t-14, .t-black--light")
                            if subtitle_elems and len(subtitle_elems) > 1:
                                location = subtitle_elems[1].text.strip()
                        except:
                            pass
                    
                    # Add the profile to results
                    results.append({
                        "name": profile_name,
                        "profileUrl": profile_url,
                        "title": title,
                        "location": location
                    })
                    
                    log(f"Added profile {i+1}: {profile_name} - {profile_url}")
                    
                except Exception as e:
                    log(f"Error processing profile card {i+1}: {str(e)}")
            
            log(f"Successfully extracted {len(results)} profiles from search results")
            return results
            
        except Exception as e:
            log(f"Error extracting profiles: {str(e)}")
            import traceback
            log(f"Traceback: {traceback.format_exc()}")
            return []
            
    except Exception as e:
        log(f"Search error: {str(e)}")
        return []

def extract_profiles_from_links(driver, max_results):
    """Extract profiles directly from links when card selectors fail."""
    try:
        log("Attempting to extract profiles directly from links...")
        all_links = driver.find_elements(By.CSS_SELECTOR, "a[href*='/in/']")
        
        if not all_links:
            log("No profile links found.")
            return []
        
        log(f"Found {len(all_links)} potential profile links")
        
        results = []
        processed_urls = set()
        
        for link in all_links:
            try:
                href = link.get_attribute("href")
                if href and "/in/" in href:
                    profile_url = href.split("?")[0]  # Remove tracking parameters
                    
                    # Skip if already processed
                    if profile_url in processed_urls:
                        continue
                    
                    processed_urls.add(profile_url)
                    
                    # Try to get name
                    name = "Unknown"
                    try:
                        spans = link.find_elements(By.TAG_NAME, "span")
                        for span in spans:
                            if span.text and not span.text.isspace() and len(span.text) > 1:
                                name = span.text.strip()
                                break
                    except:
                        pass
                    
                    # Try to find title and location by navigating up to parent elements
                    title = ""
                    location = ""
                    
                    try:
                        # Navigate up to potential card container
                        parent = link
                        for _ in range(4):  # Look up to 4 levels
                            try:
                                parent = parent.find_element(By.XPATH, "..")
                                
                                # Try to find title and location in this parent
                                try:
                                    title_elem = parent.find_element(By.CSS_SELECTOR, "div.tvZyUTymqQUmWAonPMfdpcDvzAIYFHuWLfBUE")
                                    if title_elem:
                                        title = title_elem.text.strip()
                                except:
                                    pass
                                
                                try:
                                    location_elem = parent.find_element(By.CSS_SELECTOR, "div.HhmzfnhfsJBnlckYHmnKptNFyvpjjiSpBs")
                                    if location_elem:
                                        location = location_elem.text.strip()
                                except:
                                    pass
                                
                                # If found both, break
                                if title and location:
                                    break
                                    
                            except:
                                break
                    except:
                        pass
                    
                    # Add to results
                    results.append({
                        "name": name,
                        "profileUrl": profile_url,
                        "title": title,
                        "location": location
                    })
                    
                    log(f"Added profile from direct link: {name} - {profile_url}")
                    
                    # Check if we have enough results
                    if len(results) >= max_results:
                        break
            except Exception as e:
                log(f"Error processing link: {str(e)}")
        
        log(f"Successfully extracted {len(results)} profiles from direct links")
        return results
    except Exception as e:
        log(f"Error in extract_profiles_from_links: {str(e)}")
        return []

def get_profile_details(driver, profile_url):
    """Get detailed information about a specific profile."""
    try:
        person = Person(profile_url, driver=driver, close_on_complete=False)
        
        # Format experience
        experience = []
        if person.experiences:
            for exp in person.experiences:
                experience.append({
                    "title": exp.position_title if hasattr(exp, 'position_title') else "",
                    "company": exp.institution_name if hasattr(exp, 'institution_name') else "",
                    "duration": f"{exp.from_date} - {exp.to_date}" if hasattr(exp, 'from_date') and hasattr(exp, 'to_date') else "",
                    "description": exp.description if hasattr(exp, 'description') else ""
                })
        
        # Format education
        education = []
        if person.educations:
            for edu in person.educations:
                education.append({
                    "school": edu.institution_name if hasattr(edu, 'institution_name') else "",
                    "degree": edu.degree if hasattr(edu, 'degree') else "",
                    "field": edu.field_of_study if hasattr(edu, 'field_of_study') else "",
                    "dates": f"{edu.from_date} - {edu.to_date}" if hasattr(edu, 'from_date') and hasattr(edu, 'to_date') else ""
                })
        
        # Format skills (not directly provided by the library)
        skills = []
        
        return {
            "name": person.name,
            "headline": person.headline,
            "location": person.location,
            "about": person.about,
            "experience": experience,
            "education": education,
            "skills": skills
        }
    
    except Exception as e:
        log(f"Profile details error: {str(e)}")
        return None

if __name__ == "__main__":
    # Get arguments from stdin as JSON
    args = json.loads(sys.stdin.read())
    
    action = args.get("action")
    email = args.get("email")
    password = args.get("password")
    user_data_dir = args.get("userDataDir")
    
    # Initialize driver
    try:
        driver = setup_driver(
            headless=args.get("headless", False),
            user_data_dir=user_data_dir
        )
        
        result = {"success": False}
        
        try:
            if action == "login":
                # Login to LinkedIn
                result["success"] = login_linkedin(driver, email, password)
            
            elif action == "search":
                # Check if already logged in or login
                if args.get("skipLogin", False):
                    # Check if already logged in when skipLogin is true
                    login_status = is_logged_in(driver)
                    if not login_status:
                        log("Session validation failed: User is not logged in despite skipLogin=true")
                        result["error"] = "Not logged in to LinkedIn. Please log in first or provide credentials."
                        # Only JSON result should go to stdout
                        print(json.dumps(result))
                        driver.quit()
                        sys.exit(1)
                else:
                    # Regular login with credentials
                    login_success = login_linkedin(driver, email, password)
                    if not login_success:
                        result["error"] = "Login failed"
                        # Only JSON result should go to stdout
                        print(json.dumps(result))
                        driver.quit()
                        sys.exit(1)
                
                # Search for profiles
                profiles = search_profiles(
                    driver, 
                    args.get("keywords", ""),
                    args.get("location", ""),
                    args.get("maxResults", 10)
                )
                
                # Get detailed profile info if requested
                if args.get("getDetailedInfo", False) and profiles:
                    max_detailed = min(len(profiles), args.get("maxDetailedProfiles", 5))
                    
                    for i in range(max_detailed):
                        try:
                            detailed_info = get_profile_details(driver, profiles[i]["profileUrl"])
                            if detailed_info:
                                profiles[i]["details"] = detailed_info
                        except Exception as e:
                            log(f"Error getting details for profile {i}: {str(e)}")
                
                result["success"] = True
                result["profiles"] = profiles
            
            elif action == "profile":
                # Check if already logged in or login
                if args.get("skipLogin", False):
                    # Check if already logged in when skipLogin is true
                    login_status = is_logged_in(driver)
                    if not login_status:
                        log("Session validation failed: User is not logged in despite skipLogin=true")
                        result["error"] = "Not logged in to LinkedIn. Please log in first or provide credentials."
                        # Only JSON result should go to stdout
                        print(json.dumps(result))
                        driver.quit()
                        sys.exit(1)
                else:
                    # Regular login with credentials
                    login_success = login_linkedin(driver, email, password)
                    if not login_success:
                        result["error"] = "Login failed"
                        # Only JSON result should go to stdout
                        print(json.dumps(result))
                        driver.quit()
                        sys.exit(1)
                
                # Get profile details
                profile_url = args.get("profileUrl")
                if profile_url:
                    profile_data = get_profile_details(driver, profile_url)
                    if profile_data:
                        result["success"] = True
                        result["profile"] = profile_data
                    else:
                        result["error"] = "Failed to get profile details"
                else:
                    result["error"] = "No profile URL provided"
            
            else:
                result["error"] = f"Unknown action: {action}"
        
        except Exception as e:
            log(f"Exception in main flow: {str(e)}")
            result["error"] = str(e)
        
        finally:
            # Output the result as JSON
            # This is the ONLY thing that should go to stdout
            print(json.dumps(result))
            driver.quit()
    except Exception as e:
        # If driver setup fails, we need to output a valid JSON result
        log(f"Critical error during driver setup: {str(e)}")
        error_result = {
            "success": False,
            "error": f"Failed to initialize Chrome driver: {str(e)}"
        }
        print(json.dumps(error_result))
        sys.exit(1)