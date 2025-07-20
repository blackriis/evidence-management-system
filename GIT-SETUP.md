# Git Repository Setup for Evidence Management System

## การตั้งค่า Git Repository

เนื่องจาก project นี้ยังไม่ได้เชื่อมต่อกับ remote repository คุณต้องทำตามขั้นตอนต่อไปนี้:

### ขั้นตอนที่ 1: สร้าง Repository บน GitHub/GitLab

1. **สร้าง Repository ใหม่:**
   - ไปที่ GitHub.com หรือ GitLab.com
   - คลิก "New Repository" 
   - Repository name: `evidence-management-system`
   - เลือก Private (แนะนำ เนื่องจากเป็น production system)
   - ไม่ต้องเลือก "Initialize with README" (เพราะมี code อยู่แล้ว)

2. **Copy Repository URL:**
   - HTTPS: `https://github.com/username/evidence-management-system.git`
   - SSH: `git@github.com:username/evidence-management-system.git`

### ขั้นตอนที่ 2: เชื่อมต่อ Local Repository

```bash
# เพิ่ม remote origin
git remote add origin https://github.com/YOUR_USERNAME/evidence-management-system.git

# หรือใช้ SSH
git remote add origin git@github.com:YOUR_USERNAME/evidence-management-system.git

# ตรวจสอบ remote
git remote -v

# Push ครั้งแรก
git push -u origin main
```

### ขั้นตอนที่ 3: เพิ่ม .gitignore (ถ้ายังไม่มี)

สร้างไฟล์ `.gitignore`:

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output

# Next.js
.next/
out/
build/

# Production
dist/

# Environment variables
.env
.env*.local
.env.production

# Database
*.db
*.sqlite

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Next.js build output
.next

# Nuxt.js build / generate output
.nuxt
dist

# Gatsby files
.cache/
public

# Vuepress build output
.vuepress/dist

# Serverless directories
.serverless/

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# Uploads directory (created at runtime)
uploads/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Docker
.dockerignore

# Backup files
*.bak
*.backup
*.old

# TypeScript build info
*.tsbuildinfo

# Testing
test-results/
playwright-report/
playwright/.cache/
```

### ขั้นตอนที่ 4: Commit และ Push

```bash
# เพิ่มไฟล์ทั้งหมด
git add .

# Commit
git commit -m "Initial commit: Evidence Management System

- Complete Next.js application with authentication
- Prisma database schema and migrations
- Docker deployment configuration
- Dokploy deployment scripts and documentation
- Comprehensive testing setup
- Security features and audit logging
- File upload and evidence management
- Role-based access control
- Dashboard and reporting features"

# Push ไปยัง remote repository
git push -u origin main
```

### ขั้นตอนที่ 5: ตรวจสอบ Repository

```bash
# ตรวจสอบ remote
git remote -v

# ตรวจสอบ branch
git branch -a

# ตรวจสอบ status
git status
```

## สำหรับ Dokploy Deployment

หลังจากตั้งค่า Git repository แล้ว:

1. **ใช้ Repository URL ใน Dokploy:**
   - Repository URL: `https://github.com/YOUR_USERNAME/evidence-management-system.git`
   - Branch: `main`

2. **รัน Deployment Script:**
   ```bash
   ./dokploy-deploy.sh
   ```

3. **ตาม Deployment Guide:**
   - อ่าน `DOKPLOY-DEPLOYMENT.md`
   - ใช้ `DEPLOYMENT-CHECKLIST.md`

## เพิ่มเติม: สำหรับ Private Repository

หาก repository เป็น private และใช้ HTTPS:

1. **สร้าง Personal Access Token:**
   - GitHub: Settings > Developer settings > Personal access tokens
   - สร้าง token ใหม่ with repo permissions

2. **ใช้ Token แทน Password:**
   ```bash
   git clone https://YOUR_TOKEN@github.com/username/evidence-management-system.git
   ```

หรือใช้ SSH keys (แนะนำ):

1. **สร้าง SSH Key:**
   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   ```

2. **เพิ่ม SSH Key ไปยัง GitHub/GitLab:**
   - Copy public key: `cat ~/.ssh/id_ed25519.pub`
   - เพิ่มใน Settings > SSH Keys

3. **ใช้ SSH URL:**
   ```bash
   git remote add origin git@github.com:username/evidence-management-system.git
   ```

---

หลังจากตั้งค่า Git repository แล้ว ระบบจะพร้อมสำหรับ deployment บน Dokploy!