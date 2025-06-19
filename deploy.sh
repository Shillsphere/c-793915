#!/bin/bash

echo "🚀 Building linkdms.io for production deployment..."

# Clean previous builds
rm -rf dist/
rm -f linkdms-build*.zip

# Build the project
npm run build

# Add .htaccess for SPA routing
cat > dist/.htaccess << 'EOF'
RewriteEngine On
RewriteBase /

# Handle client-side routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Set cache headers
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
EOF

# Create deployment package
cd dist && zip -r ../linkdms-deployment-$(date +%Y%m%d-%H%M%S).zip . && cd ..

echo "✅ Build complete! Upload the zip file to your Hostinger public_html directory."
echo "📦 Deployment package: linkdms-deployment-$(date +%Y%m%d-%H%M%S).zip"
echo ""
echo "🔧 Deployment Instructions:"
echo "1. Login to Hostinger Control Panel"
echo "2. Go to File Manager"
echo "3. Navigate to public_html"
echo "4. Delete existing files (if any)"
echo "5. Upload the zip file"
echo "6. Extract the zip file"
echo "7. Move all extracted files to the root of public_html"
echo ""
echo "🌐 Your site will be live at your Hostinger domain!" 