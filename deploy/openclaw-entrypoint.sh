#!/usr/bin/env sh
set -eu

OPENCLAW_HOME_DIR="${OPENCLAW_HOME_DIR:-/root/.openclaw}"
OPENCLAW_WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-$OPENCLAW_HOME_DIR/workspace}"
OPENCLAW_MODEL_PROVIDER="${OPENCLAW_MODEL_PROVIDER:-sumopod}"
OPENCLAW_MODEL_ID="${OPENCLAW_MODEL_ID:-gpt-4o-mini}"
OPENCLAW_MODEL_REF="${OPENCLAW_MODEL_PROVIDER}/${OPENCLAW_MODEL_ID}"

mkdir -p "$OPENCLAW_HOME_DIR" "$OPENCLAW_WORKSPACE_DIR"
cp -R /workspace-template/. "$OPENCLAW_WORKSPACE_DIR/"

cat > "$OPENCLAW_HOME_DIR/openclaw.json" <<EOF
{
  "models": {
    "mode": "merge",
    "providers": {
      "${OPENCLAW_MODEL_PROVIDER}": {
        "baseUrl": "${SUMOPOD_BASE_URL:-https://ai.sumopod.com/v1}",
        "apiKey": "SUMOPOD_API_KEY",
        "api": "openai-completions",
        "models": [
          {
            "id": "${OPENCLAW_MODEL_ID}",
            "name": "SumoPod ${OPENCLAW_MODEL_ID}",
            "reasoning": false,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 128000,
            "contextTokens": 96000,
            "maxTokens": 4096
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "workspace": "${OPENCLAW_WORKSPACE_DIR}",
      "model": {
        "primary": "${OPENCLAW_MODEL_REF}"
      }
    }
  }
}
EOF

case "${1:-gateway}" in
  gateway)
    exec openclaw gateway 0.0.0.0 --port "${OPENCLAW_GATEWAY_PORT:-18789}" --verbose
    ;;
  agent-check)
    shift || true
    exec openclaw agent --message "${OPENCLAW_CHECK_MESSAGE:-CareClaw health check: reply with one short sentence confirming the healthcare agent workspace is loaded.}" --thinking low "$@"
    ;;
  *)
    exec openclaw "$@"
    ;;
esac
