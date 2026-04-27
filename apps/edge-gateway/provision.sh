#!/usr/bin/env bash
# ChromaCommand Edge Gateway — first-boot provisioning (PRD §22)
#
# Run on a fresh Ubuntu Server 24.04 install on the ThinkCentre Tiny.
# Either via cloud-init (USB stick) or:
#   curl -fsSL https://api.chromacommand.io/provision/script.sh | sudo bash
#
# Required env vars (or interactive prompt):
#   PROV_CODE     8-char alphanumeric provisioning code (single-use)
#   API_BASE_URL  https://api.chromacommand.io
set -euo pipefail

CC_HOME=/etc/chromacommand
CC_DATA=/var/lib/chromacommand
API_BASE_URL="${API_BASE_URL:-https://api.chromacommand.io}"

if [[ $EUID -ne 0 ]]; then
  echo "✗ provision.sh must run as root" >&2
  exit 1
fi

echo "=== ChromaCommand Edge Gateway provisioning ==="

# ── 1. Dependencies ──────────────────────────────────────────────────────
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl jq openssh-client docker.io docker-compose-plugin \
  ufw chrony

systemctl enable --now docker chrony

# ── 2. User + directories ─────────────────────────────────────────────────
id -u chromacommand &>/dev/null || useradd --system --home-dir "$CC_DATA" --shell /usr/sbin/nologin chromacommand
mkdir -p "$CC_HOME" "$CC_DATA"
chown -R chromacommand:chromacommand "$CC_DATA"
chmod 0750 "$CC_HOME"

# ── 3. Generate Ed25519 keypair (NEVER leaves the box) ────────────────────
if [[ ! -f "$CC_HOME/key.pem" ]]; then
  echo "→ Generating per-device Ed25519 keypair…"
  openssl genpkey -algorithm Ed25519 -out "$CC_HOME/key.pem"
  openssl pkey -in "$CC_HOME/key.pem" -pubout -out "$CC_HOME/pubkey.pem"
  chmod 0600 "$CC_HOME/key.pem"
  chmod 0644 "$CC_HOME/pubkey.pem"
fi

# ── 4. Claim with provisioning code ───────────────────────────────────────
PROV_CODE="${PROV_CODE:-}"
if [[ -z "$PROV_CODE" ]]; then
  read -rp "Provisioning code (8 chars, single-use, paired in dashboard): " PROV_CODE
fi

PUBKEY=$(cat "$CC_HOME/pubkey.pem")
echo "→ Claiming with $API_BASE_URL/provision/claim …"
RESP=$(curl -fsSL -X POST "$API_BASE_URL/provision/claim" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg code "$PROV_CODE" --arg pk "$PUBKEY" \
        '{provisioning_code:$code, public_key:$pk}')")

STORE_ID=$(echo "$RESP" | jq -r '.store_id')
REGION_ID=$(echo "$RESP" | jq -r '.region_id')
BROKER_URL=$(echo "$RESP" | jq -r '.mqtt_broker_url')
echo "$RESP" | jq -r '.cert_pem' > "$CC_HOME/cert.pem"
echo "$RESP" | jq -r '.ca_pem' > "$CC_HOME/ca.pem"
chmod 0600 "$CC_HOME/cert.pem" "$CC_HOME/ca.pem"
chown root:chromacommand "$CC_HOME"/{cert.pem,key.pem,ca.pem}

if [[ "$STORE_ID" == "null" || -z "$STORE_ID" ]]; then
  echo "✗ Provisioning failed — invalid response from server"
  echo "$RESP" >&2
  exit 1
fi

# ── 5. Write env file ─────────────────────────────────────────────────────
cat > "$CC_HOME/edge.env" <<EOF
STORE_ID=$STORE_ID
REGION_ID=$REGION_ID
MQTT_BROKER_URL=$BROKER_URL
MQTT_CLIENT_CERT=/etc/chromacommand/cert.pem
MQTT_CLIENT_KEY=/etc/chromacommand/key.pem
MQTT_CA_CERT=/etc/chromacommand/ca.pem
DB_PATH=/data/edge_cache.db
HEARTBEAT_INTERVAL=30000
SYNC_INTERVAL=60000
EOF
chmod 0640 "$CC_HOME/edge.env"
chown root:chromacommand "$CC_HOME/edge.env"

# ── 6. Firewall (PRD §13.3, §22) ──────────────────────────────────────────
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp                # SSH (consider locking to mgmt VLAN)
ufw allow 5000/tcp              # Local REST/WS for in-store devices
ufw allow 5353/udp              # screen-discovery multicast
ufw --force enable

# ── 7. systemd unit for the docker container ──────────────────────────────
cat > /etc/systemd/system/chromacommand-edge.service <<'UNIT'
[Unit]
Description=ChromaCommand Edge Gateway
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Restart=always
RestartSec=10
ExecStartPre=-/usr/bin/docker rm -f chromacommand-edge
ExecStart=/usr/bin/docker run --rm --name chromacommand-edge \
  --network host \
  --env-file /etc/chromacommand/edge.env \
  -v /etc/chromacommand:/etc/chromacommand:ro \
  -v chromacommand-edge:/data \
  ghcr.io/targetpraks/chromacommand-edge-gateway:latest
ExecStop=/usr/bin/docker stop chromacommand-edge

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now chromacommand-edge.service

# ── 8. Cert auto-renewal cron (renew at -30d) ─────────────────────────────
cat > /etc/cron.daily/chromacommand-cert-renew <<'CRON'
#!/usr/bin/env bash
set -e
CERT=/etc/chromacommand/cert.pem
[[ -f "$CERT" ]] || exit 0
# Check if cert expires within 30 days
if openssl x509 -checkend $((30*86400)) -noout -in "$CERT"; then
  exit 0
fi
echo "[cert-renew] Cert expires within 30 days — renewing…"
PUBKEY=$(cat /etc/chromacommand/pubkey.pem)
RESP=$(curl -fsSL -X POST "${API_BASE_URL:-https://api.chromacommand.io}/provision/renew" \
  --cert /etc/chromacommand/cert.pem --key /etc/chromacommand/key.pem \
  --cacert /etc/chromacommand/ca.pem \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg pk "$PUBKEY" '{public_key:$pk}')")
echo "$RESP" | jq -r '.cert_pem' > /etc/chromacommand/cert.pem.new
mv /etc/chromacommand/cert.pem.new /etc/chromacommand/cert.pem
chmod 0600 /etc/chromacommand/cert.pem
systemctl restart chromacommand-edge
CRON
chmod +x /etc/cron.daily/chromacommand-cert-renew

echo
echo "✅ Provisioning complete."
echo "   Store: $STORE_ID  ·  Region: $REGION_ID"
echo "   Service: systemctl status chromacommand-edge"
echo "   Logs:    journalctl -u chromacommand-edge -f"
