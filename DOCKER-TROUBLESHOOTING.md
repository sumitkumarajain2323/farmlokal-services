# 🐳 Docker Deployment Troubleshooting

## ✅ **Issue Fixed: TypeScript Build Error**

### **Problem**
```
sh: tsc: not found
error: failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 127
```

### **Root Cause**
The Docker builder stage was installing only production dependencies (`npm ci --only=production`), but TypeScript compiler (`tsc`) is in `devDependencies`.

### **Solution Applied**
Updated `Dockerfile` builder stage to install all dependencies:
```dockerfile
# Before (BROKEN)
RUN npm ci --only=production && npm cache clean --force

# After (FIXED)
RUN npm ci && npm cache clean --force
```

### **Why This Works**
- **Builder stage**: Installs ALL dependencies (including TypeScript) to compile the code
- **Production stage**: Still installs only production dependencies for the final image
- **Multi-stage build**: Keeps final image size small while enabling proper compilation

---

## 🚀 **Deployment Status**

### **✅ Ready for Deployment**
Your FarmLokal backend is now ready for deployment on:
- **Render** ✅
- **Railway** ✅
- **Heroku** ✅
- **DigitalOcean** ✅
- **AWS/GCP/Azure** ✅
- **Any Docker platform** ✅

### **🔧 Deployment Commands**

#### **Local Docker Test**
```bash
# Build the image
docker build -t farmlokal-backend .

# Run the container
docker run -p 3000:3000 farmlokal-backend

# Or use docker-compose (recommended)
docker-compose up -d
```

#### **Render Deployment**
1. Connect your GitHub repository
2. Select "Docker" as build environment
3. Set environment variables in Render dashboard
4. Deploy automatically triggers on git push

#### **Railway Deployment**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway link
railway up
```

---

## 🔍 **Common Docker Issues & Solutions**

### **1. Build Context Too Large**
**Error**: `sending build context to Docker daemon: XXX MB`

**Solution**: Update `.dockerignore`
```dockerignore
node_modules
dist/
logs/
*.log
.git
```

### **2. Permission Issues**
**Error**: `permission denied` or `EACCES`

**Solution**: Already handled in Dockerfile
```dockerfile
# Create non-root user
RUN adduser -S farmlokal -u 1001
USER farmlokal
```

### **3. Health Check Failures**
**Error**: Container starts but health check fails

**Solution**: Verify health endpoint
```bash
# Test health endpoint
curl http://localhost:3000/health

# Check container logs
docker logs <container-id>
```

### **4. Environment Variables**
**Error**: Database connection failures

**Solution**: Set required environment variables
```bash
# For local testing
cp .env.example .env

# For production deployment
# Set these in your platform's dashboard:
NODE_ENV=production
DB_HOST=your-database-host
DB_PASSWORD=your-database-password
REDIS_HOST=your-redis-host
```

### **5. Database Connection Issues**
**Error**: `ECONNREFUSED` or `Connection refused`

**Solutions**:
```bash
# Option 1: Use docker-compose (includes MySQL + Redis)
docker-compose up -d

# Option 2: Use external database services
# Set DB_HOST to external database URL
# Set REDIS_HOST to external Redis URL

# Option 3: Use managed services
# Render PostgreSQL + Redis
# Railway MySQL + Redis
# AWS RDS + ElastiCache
```

---

## 📊 **Deployment Verification**

### **✅ Post-Deployment Checklist**
```bash
# 1. Health check
curl https://your-app.onrender.com/health

# 2. API endpoints
curl https://your-app.onrender.com/api/v1/products?limit=5

# 3. Database connection
curl https://your-app.onrender.com/api/v1/metrics/health

# 4. Performance test
curl -w "@curl-format.txt" -o /dev/null -s https://your-app.onrender.com/api/v1/products
```

### **📈 Expected Results**
- **Health check**: `{"status": "healthy"}`
- **Response time**: < 500ms (first request may be slower due to cold start)
- **Products API**: Returns JSON with products array
- **Metrics**: Shows database and Redis status

---

## 🛠️ **Platform-Specific Notes**

### **Render**
- ✅ **Dockerfile**: Automatically detected
- ✅ **Environment**: Set in dashboard
- ✅ **Database**: Use Render PostgreSQL (update connection string)
- ✅ **Redis**: Use Render Redis
- ⚠️ **Cold starts**: Free tier has cold starts

### **Railway**
- ✅ **Auto-deploy**: On git push
- ✅ **Environment**: Railway dashboard or CLI
- ✅ **Database**: Railway MySQL plugin
- ✅ **Redis**: Railway Redis plugin
- ✅ **Custom domains**: Available

### **Heroku**
- ✅ **Dockerfile**: Supported
- ✅ **Add-ons**: ClearDB MySQL, Heroku Redis
- ⚠️ **Port**: Use `process.env.PORT` (already configured)
- ⚠️ **Ephemeral filesystem**: No persistent file storage

---

## 🎯 **Production Optimization**

### **Performance Tuning**
```dockerfile
# Already optimized in current Dockerfile:
- Multi-stage build (smaller image)
- Non-root user (security)
- Dumb-init (proper signal handling)
- Health checks (monitoring)
- Alpine Linux (minimal base image)
```

### **Scaling Considerations**
- **Horizontal scaling**: Stateless design ✅
- **Load balancing**: Multiple instances ✅
- **Database**: Connection pooling configured ✅
- **Cache**: Redis for shared state ✅

---

## 🎉 **Success!**

Your FarmLokal backend Docker build is now **fixed and ready for production deployment** on any platform!

**Key improvements made**:
✅ Fixed TypeScript compilation in Docker build  
✅ Maintained multi-stage build optimization  
✅ Preserved security with non-root user  
✅ Kept production image size minimal  
✅ Ready for any Docker-based deployment platform  

**Deploy with confidence!** 🚀