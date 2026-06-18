MECG Community Photo Package

What this package includes:
- 17 optimized .webp community photos in public/images/community
- src/lib/community-photos.json
- src/components/site/CommunityPhotos.tsx
- install-mecg-community.py, which:
  - copies the photos/components into your project
  - removes the homepage pillars/machine section if it finds it
  - adds tasteful photo sections on Home, Socials, and Prospective Members
  - adds the moving strip CSS animation
  - creates backups of changed files

Install from your project root:
python3 install-mecg-community.py
npm run build
