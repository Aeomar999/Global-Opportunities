#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Hostinger VPS Bootstrap & Hardening Provisioner (Ubuntu 24.04 LTS)
# SEC-112, Decisions D5, D6
# ==============================================================================
# This script is IDEMPOTENT. Running it multiple times will not duplicate
# configurations or corrupt existing state.
#
# Tasks performed:
#   1. System packages upgrade and automatic security updates
#   2. SSH daemon security hardening (key-only authentication)
#   3. UFW firewall setup (strictly allow 22, 80, 443 only)
#   4. Fail2ban configuration for brute-force SSH defense
#   5. Official Docker Engine & Docker Compose plugin installation
#   6. Unprivileged 'deploy' user creation and docker group assignment
#   7. Shared Docker 'edge' bridge network creation
#   8. Cloudflare Authenticated Origin Pull (AOP) CA certificate acquisition
#   9. /opt/god directory hierarchy provisioning with proper ownership
# ==============================================================================

if [[ $EUID -ne 0 ]]; then
  echo "Error: This script must be run as root (or via sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Step 1: Updating system packages and installing baseline utilities..."
apt-get update
apt-get upgrade -y
apt-get install -y --no-install-recommends \
  curl \
  wget \
  git \
  ca-certificates \
  gnupg \
  lsb-release \
  ufw \
  fail2ban \
  unattended-upgrades \
  jq \
  net-tools

echo "==> Step 2: Configuring unattended security updates..."
systemctl enable --now unattended-upgrades

echo "==> Step 3: Hardening SSH daemon configuration..."
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-god-hardening.conf << 'EOF'
# Enforced by Global Opportunities infrastructure bootstrap
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
X11Forwarding no
MaxAuthTries 4
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

# Test sshd configuration before restarting
sshd -t
systemctl reload ssh || systemctl restart ssh || true

echo "==> Step 4: Configuring Fail2ban..."
cat > /etc/fail2ban/jail.d/sshd.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
maxretry = 4
bantime = 3600
findtime = 600
EOF

systemctl enable --now fail2ban
systemctl restart fail2ban || true

echo "==> Step 5: Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP Caddy Edge'
ufw allow 443/tcp comment 'HTTPS Caddy Edge'
ufw --force enable

echo "==> Step 6: Installing official Docker Engine & Compose plugin..."
install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

DOCKER_LIST="/etc/apt/sources.list.d/docker.list"
if [[ ! -f "$DOCKER_LIST" ]]; then
  # shellcheck disable=SC1091
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee "$DOCKER_LIST" > /dev/null
fi

apt-get update
apt-get install -y --no-install-recommends \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

systemctl enable --now docker

echo "==> Step 7: Configuring unprivileged 'deploy' user..."
if ! id -u deploy &>/dev/null; then
  useradd -m -s /bin/bash -G docker deploy
  echo "Created user 'deploy' with docker group privileges."
else
  usermod -aG docker deploy
  echo "User 'deploy' already exists. Verified docker group membership."
fi

mkdir -p /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

echo "==> Step 8: Creating shared Docker 'edge' network..."
if ! docker network inspect edge >/dev/null 2>&1; then
  docker network create edge
  echo "Created Docker network 'edge'."
else
  echo "Docker network 'edge' already exists."
fi

echo "==> Step 9: Setting up SSL & Cloudflare Authenticated Origin Pull CA..."
mkdir -p /etc/ssl/cloudflare
if [[ ! -f /etc/ssl/cloudflare/origin_pull_ca.pem ]]; then
  curl -fsSL https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem -o /etc/ssl/cloudflare/origin_pull_ca.pem
  chmod 644 /etc/ssl/cloudflare/origin_pull_ca.pem
  echo "Downloaded Cloudflare Authenticated Origin Pull CA certificate."
fi
chmod 755 /etc/ssl/cloudflare

echo "==> Step 10: Provisioning /opt/god directory hierarchy..."
mkdir -p \
  /opt/god/staging \
  /opt/god/production \
  /opt/god/development \
  /opt/god/bin \
  /opt/god/deploy \
  /opt/platform/edge \
  /opt/platform/vector

chown -R deploy:deploy /opt/god
chmod 750 /opt/god

echo "==> Step 11: Setup complete!"
echo "--------------------------------------------------------------------------------"
echo "Next configuration actions:"
echo "1. Place Cloudflare Origin CA certificate and private key at:"
echo "     /etc/ssl/cloudflare/origin.crt"
echo "     /etc/ssl/cloudflare/origin.key (chmod 600)"
echo "2. Add the CI deploy SSH public key to /home/deploy/.ssh/authorized_keys with:"
echo '     command="/opt/god/bin/god-deploy-gate",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 <KEY> CI Deploy Key'
echo "3. Copy deployment scripts into /opt/god/bin/ and make them executable:"
echo "     cp deploy/bin/god-deploy /opt/god/bin/"
echo "     cp deploy/bin/god-deploy-gate /opt/god/bin/"
echo "     chmod 755 /opt/god/bin/god-deploy*"
echo "4. Copy deploy/compose.yml to /opt/god/deploy/compose.yml"
echo "5. Create /opt/god/<env>/api.env (chmod 600, deploy:deploy)"
echo "6. Launch edge reverse proxy: docker compose -f platform/vps/edge/compose.yml up -d"
echo "--------------------------------------------------------------------------------"
