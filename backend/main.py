import requests

url = "https://www.reddit.com/r/cscareerquestions/.json"
headers = {"User-Agent": "public-scraper/0.1"}

response = requests.get(url, headers=headers)
data = response.json()

for post in data["data"]["children"]:
    print(post["data"]["title"])
