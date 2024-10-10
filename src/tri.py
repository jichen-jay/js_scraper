from trafilatura import extract
from trafilatura.settings import DEFAULT_CONFIG
from copy import deepcopy
from trafilatura.downloads import fetch_url

downloaded = fetch_url("https://www.reddit.com/r/debian/comments/1dcuqma/getting_rocm_installed_on_debian_12/")

with open("assets/reddit.html", "r", encoding="utf-8") as f:
    my_html = f.read()

my_config = deepcopy(DEFAULT_CONFIG)

# Input settings - adjust based on forum structure
my_config['DEFAULT']['MAX_FILE_SIZE'] = "50000000"
my_config['DEFAULT']['MIN_FILE_SIZE'] = "20"

# Extraction settings 
my_config['DEFAULT']['MIN_EXTRACTED_SIZE'] = "30"  
my_config['DEFAULT']['MIN_OUTPUT_SIZE'] = "10"

# Comment extraction settings 
my_config['DEFAULT']['MIN_EXTRACTED_COMM_SIZE'] = "10"
my_config['DEFAULT']['MIN_OUTPUT_COMM_SIZE'] = "5"

# Deduplication settings - optional
my_config['DEFAULT']['MIN_DUPLCHECK_SIZE'] = "50"
my_config['DEFAULT']['MAX_REPETITIONS'] = "1"

# Metadata
my_config['DEFAULT']['EXTENSIVE_DATE_SEARCH'] = 'on'

# Navigation
my_config['DEFAULT']['EXTERNAL_URLS'] = 'off'
my_config['DEFAULT']['MAX_REDIRECTS'] = "3"

url = "https://www.reddit.com/r/debian/comments/1dcuqma/getting_rocm_installed_on_debian_12/";

extracted_text = extract(downloaded, config=my_config)
print(extracted_text)
