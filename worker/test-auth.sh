#!/usr/bin/env bash
# Test end-to-end des endpoints /api/auth/* du Worker.
#
# Usage :
#   ./test-auth.sh https://ton-worker.workers.dev
#   ./test-auth.sh http://localhost:8787    # avec wrangler dev
#
# Pré-requis : curl + jq.
# Le script suppose que le KV est vide ou contient déjà un compte "admin".
# Il crée puis supprime un compte de test "test-e2e".

set -euo pipefail

BASE="${1:-http://localhost:8787}"
ADMIN_LOGIN="admin"
ADMIN_PASSWORD="IR2026!"
TEST_LOGIN="test-e2e"
TEST_PASSWORD="testpass123"
TEST_PASSWORD_NEW="newpass456!"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; FAILED=1; }
info() { echo -e "${YELLOW}▸${NC} $1"; }
FAILED=0

req() {
  # req METHOD PATH [TOKEN] [BODY]
  local method="$1" path="$2" token="${3:-}" body="${4:-}"
  local args=(-s -o /tmp/auth-test-body -w '%{http_code}' -X "$method" "$BASE$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  curl "${args[@]}"
}

# ════════════════════════════════════════
info "1. Login admin (bootstrap si KV vide)"
status=$(req POST /api/auth/login "" "{\"login\":\"$ADMIN_LOGIN\",\"password\":\"$ADMIN_PASSWORD\"}")
[ "$status" = "200" ] && pass "Login admin OK ($status)" || { fail "Login admin failed ($status)"; cat /tmp/auth-test-body; exit 1; }
ADMIN_TOKEN=$(jq -r .token /tmp/auth-test-body)
[ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ] && pass "Token reçu" || fail "Pas de token"

# ════════════════════════════════════════
info "2. GET /api/auth/me avec token admin"
status=$(req GET /api/auth/me "$ADMIN_TOKEN")
[ "$status" = "200" ] && pass "Me OK" || fail "Me failed ($status)"
role=$(jq -r .user.role /tmp/auth-test-body)
[ "$role" = "admin" ] && pass "Rôle admin confirmé" || fail "Rôle attendu admin, reçu '$role'"

# ════════════════════════════════════════
info "3. Login avec mauvais mdp → 401"
status=$(req POST /api/auth/login "" "{\"login\":\"$ADMIN_LOGIN\",\"password\":\"WRONG\"}")
[ "$status" = "401" ] && pass "Mauvais mdp = 401" || fail "Attendu 401, reçu $status"

# ════════════════════════════════════════
info "4. Login avec utilisateur inexistant → 401 (timing constant)"
t1=$(date +%s%N)
status=$(req POST /api/auth/login "" "{\"login\":\"ghost-user-zzz\",\"password\":\"whatever\"}")
t2=$(date +%s%N)
elapsed_ms=$(( (t2 - t1) / 1000000 ))
[ "$status" = "401" ] && pass "Ghost user = 401" || fail "Attendu 401, reçu $status"
[ "$elapsed_ms" -gt 30 ] && pass "Temps PBKDF2 cohérent (~${elapsed_ms}ms, dummy hash exécuté)" || fail "Trop rapide (${elapsed_ms}ms) — timing attack possible"

# ════════════════════════════════════════
info "5. Création user 'test-e2e' (admin)"
# Cleanup d'abord si reste d'un run précédent
status=$(req GET /api/auth/users "$ADMIN_TOKEN")
existing_id=$(jq -r --arg L "$TEST_LOGIN" '.users[] | select(.login==$L) | .id' /tmp/auth-test-body)
if [ -n "$existing_id" ] && [ "$existing_id" != "null" ]; then
  info "  → cleanup compte préexistant $existing_id"
  req DELETE "/api/auth/users/$existing_id" "$ADMIN_TOKEN" > /dev/null
fi
status=$(req POST /api/auth/users "$ADMIN_TOKEN" "{\"login\":\"$TEST_LOGIN\",\"name\":\"Test User\",\"password\":\"$TEST_PASSWORD\",\"role\":\"editor\"}")
[ "$status" = "201" ] && pass "User créé ($status)" || { fail "Création failed ($status)"; cat /tmp/auth-test-body; }
TEST_USER_ID=$(jq -r .user.id /tmp/auth-test-body)

# ════════════════════════════════════════
info "6. Création doublon → 409"
status=$(req POST /api/auth/users "$ADMIN_TOKEN" "{\"login\":\"$TEST_LOGIN\",\"name\":\"X\",\"password\":\"abcdefgh\",\"role\":\"editor\"}")
[ "$status" = "409" ] && pass "Doublon refusé (409)" || fail "Attendu 409, reçu $status"

# ════════════════════════════════════════
info "7. Login en tant que test-e2e (rôle editor)"
status=$(req POST /api/auth/login "" "{\"login\":\"$TEST_LOGIN\",\"password\":\"$TEST_PASSWORD\"}")
[ "$status" = "200" ] && pass "Login editor OK" || fail "Login editor failed ($status)"
EDITOR_TOKEN=$(jq -r .token /tmp/auth-test-body)

# ════════════════════════════════════════
info "8. Editor essaie GET /api/auth/users → 403"
status=$(req GET /api/auth/users "$EDITOR_TOKEN")
[ "$status" = "403" ] && pass "Accès admin refusé (403)" || fail "Attendu 403, reçu $status"

# ════════════════════════════════════════
info "9. Editor change son propre mdp"
status=$(req PATCH /api/auth/me/password "$EDITOR_TOKEN" "{\"currentPassword\":\"$TEST_PASSWORD\",\"newPassword\":\"$TEST_PASSWORD_NEW\"}")
[ "$status" = "200" ] && pass "Changement de mdp OK" || fail "Changement failed ($status)"

# Le token actuel doit toujours marcher (on garde la session courante)
status=$(req GET /api/auth/me "$EDITOR_TOKEN")
[ "$status" = "200" ] && pass "Session courante préservée après self-change" || fail "Session courante invalidée à tort ($status)"

# ════════════════════════════════════════
info "10. Re-login avec le nouveau mdp"
status=$(req POST /api/auth/login "" "{\"login\":\"$TEST_LOGIN\",\"password\":\"$TEST_PASSWORD_NEW\"}")
[ "$status" = "200" ] && pass "Login avec nouveau mdp OK" || fail "Login échoué ($status)"
EDITOR_TOKEN2=$(jq -r .token /tmp/auth-test-body)

# ════════════════════════════════════════
info "11. Admin reset le mdp du test → toutes les sessions de test invalidées"
status=$(req PATCH "/api/auth/users/$TEST_USER_ID" "$ADMIN_TOKEN" "{\"password\":\"$TEST_PASSWORD\"}")
[ "$status" = "200" ] && pass "Reset par admin OK" || fail "Reset failed ($status)"
# Les deux tokens editor doivent être morts maintenant
status=$(req GET /api/auth/me "$EDITOR_TOKEN")
[ "$status" = "401" ] && pass "Ancien token editor invalidé (401)" || fail "Token devrait être 401, reçu $status"
status=$(req GET /api/auth/me "$EDITOR_TOKEN2")
[ "$status" = "401" ] && pass "Token editor #2 invalidé (401)" || fail "Token devrait être 401, reçu $status"

# ════════════════════════════════════════
info "12. Logout admin → token admin invalidé"
NEW_ADMIN_TOKEN=$ADMIN_TOKEN
# Re-login admin pour avoir un token frais qu'on peut détruire
status=$(req POST /api/auth/login "" "{\"login\":\"$ADMIN_LOGIN\",\"password\":\"$ADMIN_PASSWORD\"}")
THROW_TOKEN=$(jq -r .token /tmp/auth-test-body)
status=$(req POST /api/auth/logout "$THROW_TOKEN")
[ "$status" = "200" ] && pass "Logout OK" || fail "Logout failed ($status)"
status=$(req GET /api/auth/me "$THROW_TOKEN")
[ "$status" = "401" ] && pass "Token mort après logout (401)" || fail "Token devrait être 401, reçu $status"

# ════════════════════════════════════════
info "13. Cleanup : suppression user test-e2e"
status=$(req DELETE "/api/auth/users/$TEST_USER_ID" "$ADMIN_TOKEN")
[ "$status" = "200" ] && pass "User supprimé" || fail "Suppression failed ($status)"

# ════════════════════════════════════════
info "14. Admin essaie de se supprimer → 400"
ADMIN_ID=$(req GET /api/auth/me "$ADMIN_TOKEN" > /dev/null && jq -r .user.id /tmp/auth-test-body)
status=$(req DELETE "/api/auth/users/$ADMIN_ID" "$ADMIN_TOKEN")
[ "$status" = "400" ] && pass "Auto-suppression refusée (400)" || fail "Attendu 400, reçu $status"

echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ Tous les tests passent.${NC}"
  exit 0
else
  echo -e "${RED}✗ Au moins un test a échoué.${NC}"
  exit 1
fi
