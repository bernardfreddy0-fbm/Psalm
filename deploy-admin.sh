#!/bin/bash
# Déploiement AEF Admin React → admin-psalm.a-e-f.fr/admin/
# Usage: ./deploy-admin.sh

set -e  # Arrêt immédiat si une commande échoue

SSH_USER="bqzk4896"
SSH_HOST="yellow.o2switch.net"
SSH_KEY="${HOME}/.ssh/id_ed25519"
REMOTE_DIR="~/admin-psalm.a-e-f.fr/admin"
DIST="./dist"

echo "Déploiement AEF Admin React"
echo "================================"
echo "→ Destination : https://admin-psalm.a-e-f.fr/admin/"

# Test connexion SSH
echo "Test connexion SSH..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15 \
  "$SSH_USER@$SSH_HOST" "echo '  SSH OK'" || { echo "ERREUR : connexion SSH impossible"; exit 1; }

# Upload index.html + .htaccess
echo "Upload index.html + .htaccess..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no \
  "$DIST/index.html" \
  "$SSH_USER@$SSH_HOST:$REMOTE_DIR/" && echo "  ✓ index.html"

# Upload .htaccess si présent
if [ -f "$DIST/.htaccess" ]; then
  scp -i "$SSH_KEY" -o StrictHostKeyChecking=no \
    "$DIST/.htaccess" \
    "$SSH_USER@$SSH_HOST:$REMOTE_DIR/" && echo "  ✓ .htaccess"
fi

# Upload assets
echo "Upload assets..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no \
  "$DIST/assets/"* \
  "$SSH_USER@$SSH_HOST:$REMOTE_DIR/assets/" && echo "  ✓ assets/"

echo ""
echo "================================"
echo "✅ Déploiement réussi !"
echo "https://admin-psalm.a-e-f.fr/admin/"
