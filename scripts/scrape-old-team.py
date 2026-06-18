from html.parser import HTMLParser
from urllib.parse import urljoin
from pathlib import Path
import json
import re

URL = "https://www.mecgmichigan.com/team"
HTML_PATH = Path("data/public/old-team.html")

class TeamParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []

    def handle_starttag(self, tag, attrs):
        self.items.append({
            "type": "start",
            "tag": tag,
            "attrs": dict(attrs),
            "text": "",
        })

    def handle_data(self, data):
        text = " ".join(data.split())
        if text:
            self.items.append({
                "type": "text",
                "tag": "",
                "attrs": {},
                "text": text,
            })

def clean(value):
    return " ".join((value or "").split()).strip()

html = HTML_PATH.read_text(errors="ignore")

parser = TeamParser()
parser.feed(html)

images = []
links = []
texts = []

for item in parser.items:
    if item["type"] == "text":
        texts.append(item["text"])

    if item["type"] == "start" and item["tag"] == "img":
        attrs = item["attrs"]
        alt = clean(attrs.get("alt", ""))
        src = attrs.get("src") or attrs.get("data-src") or ""
        if src:
            images.append({
                "alt": alt,
                "src": urljoin(URL, src),
            })

    if item["type"] == "start" and item["tag"] == "a":
        href = item["attrs"].get("href", "")
        if href:
            links.append(href)

linkedin_links = [href for href in links if "linkedin.com/in/" in href]
email_links = [
    href.replace("mailto:", "").split("?")[0]
    for href in links
    if href.startswith("mailto:")
]

role_labels = {
    "President",
    "VP External",
    "VP Internal",
    "VP Recruitment",
    "VP Consulting",
    "VP Education",
    "VP Finance",
    "VP Marketing",
    "Project Manager",
    "Assistant Project Manager",
    "Strategic Lead",
    "Analyst",
}

ignore = {
    "Meet the Team",
    "Executive Board",
    "Project Managers",
    "Assistant Project Managers",
    "Strategic Leads",
    "View All",
    "LinkedIn",
    "Email",
    "Home",
    "About",
    "Team",
    "Services",
    "Contact",
    "Michigan Engineering Consulting Group",
    "University of Michigan - Ann Arbor",
}

people = []
for i, text in enumerate(texts[:-1]):
    next_text = texts[i + 1]
    looks_like_name = (
        len(text.split()) >= 2
        and text not in ignore
        and not text.lower().startswith("mecg")
        and not text.startswith("©")
    )

    if looks_like_name and next_text in role_labels:
        people.append({
            "name": text,
            "role": next_text,
        })

def image_for_name(name, index):
    normalized = re.sub(r"[^a-z]", "", name.lower())

    for img in images:
        alt_norm = re.sub(r"[^a-z]", "", img["alt"].lower())
        src_norm = re.sub(r"[^a-z]", "", img["src"].lower())
        if normalized and (normalized in alt_norm or normalized in src_norm):
            return img["src"]

    if index < len(images):
        return images[index]["src"]

    return None

output_people = []
for index, person in enumerate(people):
    output_people.append({
        "name": person["name"],
        "role": person["role"],
        "image": image_for_name(person["name"], index),
        "linkedin": linkedin_links[index] if index < len(linkedin_links) else None,
        "email": email_links[index] if index < len(email_links) else None,
    })

output = {
    "source": URL,
    "people_count": len(output_people),
    "image_count": len(images),
    "linkedin_count": len(linkedin_links),
    "email_count": len(email_links),
    "people": output_people,
}

Path("data/public/old-team-scrape.json").write_text(json.dumps(output, indent=2))
print(json.dumps(output, indent=2))
print("\nSaved to data/public/old-team-scrape.json")
