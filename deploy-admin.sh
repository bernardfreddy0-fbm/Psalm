#!/bin/bash
# Déploiement AEF Admin React → admin-psalm.a-e-f.fr/admin/
# Usage: ./deploy-admin.sh MOT_DE_PASSE_FTP

FTP_PASS="${1}"
FTP_USER="bqzk4896"
FTP_HOST="yellow.o2switch.net"
REMOTE_DIR="/home/bqzk4896/public_html/admin-psalm.a-e-f.fr/admin"
DIST="./dist"

if [ -z "$FTP_PASS" ]; then
  echo "Usage: ./deploy-admin.sh MOT_DE_PASSE_FTP"
  exit 1
fi

echo "🚀 Déploiement AEF Admin React"
echo "================================"
echo "→ Destination : https://admin-psalm.a-e-f.fr/admin/"

# Créer le dossier /admin/ si inexistant
echo "📁 Création du dossier /admin/..."
curl -s "ftp://$FTP_HOST/$REMOTE_DIR/" \
  -u "$FTP_USER:$FTP_PASS" \
  -Q "MKD $REMOTE_DIR" > /dev/null 2>&1

# Upload index.html
echo "📤 Upload index.html..."
curl -s -T "$DIST/index.html" \
  "ftp://$FTP_HOST/$REMOTE_DIR/index.html" \
  -u "$FTP_USER:$FTP_PASS" && echo "  ✅ index.html"

# Upload .htaccess
echo "📤 Upload .htaccess..."
curl -s -T "$DIST/.htaccess" \
  "ftp://$FTP_HOST/$REMOTE_DIR/.htaccess" \
  -u "$FTP_USER:$FTP_PASS" 2>/dev/null && echo "  ✅ .htaccess"

# Créer dossier assets
curl -s "ftp://$FTP_HOST/$REMOTE_DIR/assets/" \
  -u "$FTP_USER:$FTP_PASS" \
  -Q "MKD $REMOTE_DIR/assets" > /dev/null 2>&1

# Upload les assets (JS + CSS)
echo "📤 Upload assets..."
for file in "$DIST/assets/"*; do
  filename=$(basename "$file")
  curl -s -T "$file" \
    "ftp://$FTP_HOST/$REMOTE_DIR/assets/$filename" \
    -u "$FTP_USER:$FTP_PASS" && echo "  ✅ assets/$filename"
done

# Upload favicon
curl -s -T "$DIST/favicon.ico" \
  "ftp://$FTP_HOST/$REMOTE_DIR/favicon.ico" \
  -u "$FTP_USER:$FTP_PASS" > /dev/null 2>&1

echo ""
echo "================================"
echo "✅ Déploiement terminé !"
echo "🔗 https://admin-psalm.a-e-f.fr/admin/"
