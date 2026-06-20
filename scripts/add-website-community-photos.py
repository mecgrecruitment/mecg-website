from html.parser import HTMLParser
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from pathlib import Path
import json
import ssl

BASE = "https://www.mecgmichigan.com"
PAGES = [
    "/",
    "/about",
    "/team",
    "/recruitment",
    "/services",
    "/socials",
]

LOCAL_JSON = Path("src/lib/community-photos.json")

class ImageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []

    def handle_starttag(self, tag, attrs):
        if tag != "img":
            return

        attrs = dict(attrs)
        src = attrs.get("src") or attrs.get("data-src") or ""
        alt = attrs.get("alt") or "MECG community photo"

        if not src:
            return

        full = urljoin(BASE, src)

        # Skip icons/logos/headshots. Keep community/event/site photos.
        lowered = full.lower()
        if any(skip in lowered for skip in [
            "favicon",
            "logo",
            "headshots",
            "/board/",
        ]):
            return

        if any(keep in lowered for keep in [
            "/images/carousel/",
            "/images/presidentswelcome/",
            "football",
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
        ]):
            self.images.append({
                "src": full,
                "alt": alt,
                "source": "old MECG website",
            })

def fetch_page(path):
    url = urljoin(BASE, path)
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        return urlopen(req, timeout=20).read().decode("utf-8", errors="ignore")
    except Exception:
        # fallback for local cert issues
        context = ssl._create_unverified_context()
        return urlopen(req, timeout=20, context=context).read().decode("utf-8", errors="ignore")

existing = {"images": []}
if LOCAL_JSON.exists():
    existing = json.loads(LOCAL_JSON.read_text())

current_images = existing.get("images", [])
seen = {img.get("src") for img in current_images}

website_images = []
for page in PAGES:
    try:
        html = fetch_page(page)
        parser = ImageParser()
        parser.feed(html)

        for image in parser.images:
            if image["src"] not in seen:
                seen.add(image["src"])
                website_images.append(image)
    except Exception as error:
        print(f"Skipped {page}: {error}")

combined = current_images + website_images

output = {
    "count": len(combined),
    "local_count": len([img for img in combined if str(img.get("src", "")).startswith("/images/community/")]),
    "website_count": len([img for img in combined if str(img.get("src", "")).startswith("https://www.mecgmichigan.com")]),
    "images": combined,
}

LOCAL_JSON.write_text(json.dumps(output, indent=2))
Path("data/public/community-photos-combined.json").write_text(json.dumps(output, indent=2))

print(json.dumps({
    "added_from_website": len(website_images),
    "total": output["count"],
    "local_count": output["local_count"],
    "website_count": output["website_count"],
}, indent=2))
print("\nSaved combined photo list to src/lib/community-photos.json")
