# Deploy to Vercel - Run this in PowerShell

# 1. Install Vercel CLI (if not installed)
npm i -g vercel

# 2. Login (opens browser)
vercel login

# 3. Deploy to production
cd "C:\Users\USER\Desktop\bytebane\Chaos-Ransomware-Builder-main\Chaos Ransomware\vercel-dashboard"
vercel --prod

# Or use npx (no global install needed):
npx vercel --prod