---
description: How to deploy the Prestige Points app to GitHub Pages
---

# Deploying to GitHub Pages

Since your app is now static and uses Supabase for data, deployment is straightforward.

## 1. Prepare your Repository
If you haven't initialized a git repository yet, run:
```bash
git init
git add .
git commit -m "feat: complete supabase migration and ui refinement"
```

## 2. Push to GitHub
1. Create a new repository on [GitHub](https://github.com/new).
2. Follow the instructions to push your existing repository:
```bash
git remote add origin https://github.com/YOUR_USERNAME/points.git
git branch -M main
git push -u origin main
```

## 3. Enable GitHub Pages
1. On GitHub, navigate to your repository **Settings**.
2. Click on **Pages** in the left sidebar.
3. Under **Build and deployment > Branch**, select `main` (or the branch you pushed) and the `/ (root)` folder.
4. Click **Save**.

## 4. Access your Site
Wait a minute or two for GitHub to build the site. It will be available at:
`https://YOUR_USERNAME.github.io/points/`

Your admin panel will be at:
`https://YOUR_USERNAME.github.io/points/admin.html`

> [!NOTE]
> Since we use Supabase, your site is "live" instantly across all devices. No server needed!
