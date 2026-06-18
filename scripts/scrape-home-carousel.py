from html.parser import HTMLParser
from urllib.parse import urljoin
from pathlib import Path
import json

URL = "https://www.mecgmichigan.com/"
HTML_PATH = Path("data/public/old-home.html")

class ImgParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []

    def handle_starttag(self, tag, attrs):
        if tag != "img":
            return

        attrs = dict(attrs)
        src = attrs.get("src") or attrs.get("data-src") or ""
        alt = attrs.get("alt") or "MECG community photo"

        if "/images/carousel/" in src:
            full_src = urljoin(URL, src)
            if full_src not in [img["src"] for img in self.images]:
                self.images.append({
                    "src": full_src,
                    "alt": alt,
                })

html = HTML_PATH.read_text(errors="ignore")
parser = ImgParser()
parser.feed(html)

output = {
    "source": URL,
    "count": len(parser.images),
    "images": parser.images,
}

Path("src/lib/home-carousel.json").write_text(json.dumps(output, indent=2))
Path("data/public/home-carousel.json").write_text(json.dumps(output, indent=2))

print(json.dumps(output, indent=2))
print("\nSaved to src/lib/home-carousel.json")
