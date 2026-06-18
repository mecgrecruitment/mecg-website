from pathlib import Path
import shutil

ROOT = Path.cwd()
PACKAGE = Path(__file__).resolve().parent


def backup(path: Path):
    if path.exists():
        b = path.with_suffix(path.suffix + ".before-community-photos")
        if not b.exists():
            b.write_text(path.read_text())


def copy_tree(src: Path, dst: Path):
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        if item.is_file():
            shutil.copy2(item, dst / item.name)


def ensure_import(text: str, import_line: str) -> str:
    if import_line in text:
        return text
    lines = text.splitlines()
    import_indexes = [i for i, line in enumerate(lines) if line.startswith("import ")]
    if import_indexes:
        lines.insert(max(import_indexes) + 1, import_line)
        return "\n".join(lines) + "\n"
    return import_line + "\n" + text


def remove_section_containing(text: str, phrases: list[str]) -> str:
    lowered = text.lower()
    for phrase in phrases:
        pos = lowered.find(phrase.lower())
        if pos == -1:
            continue
        start = text.rfind("<section", 0, pos)
        end = text.find("</section>", pos)
        if start != -1 and end != -1:
            return text[:start] + text[end + len("</section>"):]
    return text


def insert_before_section_containing(text: str, phrases: list[str], insert: str) -> str:
    if insert.strip() in text:
        return text
    lowered = text.lower()
    for phrase in phrases:
        pos = lowered.find(phrase.lower())
        if pos == -1:
            continue
        start = text.rfind("<section", 0, pos)
        if start != -1:
            return text[:start] + insert + "\n" + text[start:]
    # fallback: before final div
    last = text.rfind("</div>")
    if last != -1:
        return text[:last] + insert + "\n" + text[last:]
    return text + "\n" + insert


def insert_before_last_div(text: str, insert: str) -> str:
    marker = insert.split("\n", 2)[1].strip() if "\n" in insert else insert.strip()
    if marker and marker in text:
        return text
    last = text.rfind("</div>")
    if last != -1:
        return text[:last] + insert + "\n" + text[last:]
    return text + "\n" + insert


# Copy assets/code
copy_tree(PACKAGE / "public/images/community", ROOT / "public/images/community")
(ROOT / "src/lib").mkdir(parents=True, exist_ok=True)
shutil.copy2(PACKAGE / "src/lib/community-photos.json", ROOT / "src/lib/community-photos.json")
(ROOT / "src/components/site").mkdir(parents=True, exist_ok=True)
shutil.copy2(PACKAGE / "src/components/site/CommunityPhotos.tsx", ROOT / "src/components/site/CommunityPhotos.tsx")

# CSS animation
css_candidates = [ROOT / "app/globals.css", ROOT / "src/app/globals.css", ROOT / "globals.css"]
css = next((p for p in css_candidates if p.exists()), None)
if css:
    backup(css)
    text = css.read_text()
    css_block = '''

@keyframes mecg-photo-strip {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

.animate-mecg-photo-strip {
  animation: mecg-photo-strip 42s linear infinite;
}

.animate-mecg-photo-strip:hover {
  animation-play-state: paused;
}
'''
    if "mecg-photo-strip" not in text:
        css.write_text(text.rstrip() + css_block + "\n")

# Home page
home = ROOT / "app/(external)/page.tsx"
if home.exists():
    backup(home)
    text = home.read_text()
    text = text.replace('import { HomePhotoStrip } from "@/components/site/HomePhotoStrip";\n', '')
    text = ensure_import(text, 'import { CommunityPhotoStrip, CommunityPhotoGrid } from "@/components/site/CommunityPhotos";')
    text = text.replace("<HomePhotoStrip />", "<CommunityPhotoStrip />")
    if "<CommunityPhotoStrip" not in text:
        text = insert_before_section_containing(
            text,
            ["Quick Answers", "QUICK ANSWERS", "Q&A", "What holds", "Pillars"],
            '''      <div className="py-10 md:py-14">
        <CommunityPhotoStrip />
      </div>
''',
        )
    text = remove_section_containing(text, ["What holds the machine together", "Four Pillars", "FOUR PILLARS"])
    if "A community that feels easy to join." not in text:
        text = insert_before_section_containing(
            text,
            ["Quick Answers", "QUICK ANSWERS", "Q&A"],
            '''      <CommunityPhotoGrid
        title="A community that feels easy to join."
        subtitle="From project work to socials and campus events, MECG is shaped by the people who show up for each other."
        start={3}
      />
''',
        )
    home.write_text(text)

# Socials page
socials = ROOT / "app/(external)/socials/page.tsx"
if socials.exists():
    backup(socials)
    text = socials.read_text()
    text = ensure_import(text, 'import { CommunityPhotoGrid } from "@/components/site/CommunityPhotos";')
    if "Socials that make MECG feel like home." not in text:
        text = insert_before_last_div(
            text,
            '''
      <CommunityPhotoGrid
        title="Socials that make MECG feel like home."
        subtitle="Our community is built through dinners, game days, formals, trips, and the everyday moments between projects."
        start={5}
      />
''',
        )
    socials.write_text(text)

# Prospective members page
prospective = ROOT / "app/(external)/prospective-members/page.tsx"
if prospective.exists():
    backup(prospective)
    text = prospective.read_text()
    text = ensure_import(text, 'import { CommunityPhotoGrid, JoinCommunityPhotos } from "@/components/site/CommunityPhotos";')
    if "Join a community, not just a club." not in text:
        text = insert_before_last_div(
            text,
            '''
      <CommunityPhotoGrid
        title="Join a community, not just a club."
        subtitle="Prospective members get to meet people across majors, learn consulting in a supportive setting, and find a place to grow."
        start={1}
        label="Prospective Members"
      />
''',
        )
    prospective.write_text(text)

print("Installed MECG community photos and page sections.")
print("Backups were saved next to edited files with .before-community-photos suffix.")
