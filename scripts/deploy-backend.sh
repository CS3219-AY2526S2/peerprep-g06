#!/usr/bin/env bash

set -euo pipefail

# Default deploy order. Nginx goes last so the gateway flips after the services behind it.
SERVICES=(
  "user-service"
  "question-service"
  "matching-service"
  "collaboration-service"
  "nginx"
)

# Team-wide deploy constants.
AWS_REGION="ap-southeast-1"
AWS_ACCOUNT_ID="894064921761"
ECS_CLUSTER="neeg06code-prod"
TASK_DEFINITION_PREFIX="neeg06code"
ECR_REPO_PREFIX="neeg06code"
PLATFORM="linux/amd64"

log() {
  printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  }
}

prompt() {
  local var_name="$1"
  local label="$2"
  local default_value="${3:-}"
  local secret="${4:-false}"
  local value=""

  # Allow pre-exported env vars so users can skip prompts if they want.
  if [[ -n "${!var_name:-}" ]]; then
    return
  fi

  if [[ "$secret" == "true" ]]; then
    read -r -s -p "$label: " value
    echo
  elif [[ -n "$default_value" ]]; then
    read -r -p "$label [$default_value]: " value
    value="${value:-$default_value}"
  else
    read -r -p "$label: " value
  fi

  printf -v "$var_name" '%s' "$value"
  export "$var_name"
}

get_context() {
  case "$1" in
    user-service) echo "services/user-service" ;;
    question-service) echo "services/question-service" ;;
    matching-service) echo "." ;;
    collaboration-service) echo "." ;;
    nginx) echo "nginx" ;;
    *) return 1 ;;
  esac
}

get_dockerfile() {
  case "$1" in
    user-service) echo "services/user-service/Dockerfile" ;;
    question-service) echo "services/question-service/Dockerfile" ;;
    matching-service) echo "services/matching-service/Dockerfile" ;;
    collaboration-service) echo "services/collaboration-service/Dockerfile" ;;
    nginx) echo "nginx/Dockerfile" ;;
    *) return 1 ;;
  esac
}

get_task_definition_name() {
  echo "${TASK_DEFINITION_PREFIX}-$1"
}

ensure_repo() {
  local repo_name="$1"

  if aws ecr describe-repositories \
    --repository-names "$repo_name" \
    --region "$AWS_REGION" >/dev/null 2>&1; then
    return
  fi

  log "Creating ECR repo ${repo_name}"
  aws ecr create-repository \
    --repository-name "$repo_name" \
    --image-scanning-configuration scanOnPush=true \
    --region "$AWS_REGION" >/dev/null
}

build_and_push() {
  local service="$1"
  local repo_name="${ECR_REPO_PREFIX}-${service}"
  local context
  local dockerfile
  local local_tag="${repo_name}:${IMAGE_TAG}"
  local remote_tag="${REGISTRY}/${repo_name}:${IMAGE_TAG}"

  context="$(get_context "$service")"
  dockerfile="$(get_dockerfile "$service")"

  ensure_repo "$repo_name"

  log "Building ${service}"
  docker buildx build \
    --platform "$PLATFORM" \
    --file "$dockerfile" \
    --tag "$local_tag" \
    "$context" \
    --load

  log "Pushing ${service}"
  docker tag "$local_tag" "$remote_tag"
  docker push "$remote_tag"
}

deploy_service() {
  local service="$1"
  local image="${REGISTRY}/${ECR_REPO_PREFIX}-${service}:${IMAGE_TAG}"
  local task_definition_name
  local workdir
  local current_td
  local next_td
  local task_definition_arn

  task_definition_name="$(get_task_definition_name "$service")"
  workdir="$(mktemp -d)"
  current_td="${workdir}/current.json"
  next_td="${workdir}/next.json"

  # Read the current task definition, replace just the image, and register a new revision.
  aws ecs describe-task-definition \
    --task-definition "$task_definition_name" \
    --region "$AWS_REGION" \
    --query taskDefinition > "$current_td"

  jq --arg IMAGE "$image" --arg NAME "$service" '
    del(
      .taskDefinitionArn,
      .revision,
      .status,
      .requiresAttributes,
      .compatibilities,
      .registeredAt,
      .registeredBy
    )
    | .containerDefinitions |= map(
        if .name == $NAME then .image = $IMAGE else . end
      )
  ' "$current_td" > "$next_td"

  log "Registering task definition for ${service}"
  task_definition_arn="$(
    aws ecs register-task-definition \
      --cli-input-json "file://${next_td}" \
      --region "$AWS_REGION" \
      --query 'taskDefinition.taskDefinitionArn' \
      --output text
  )"

  log "Updating ECS service ${service}"
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$service" \
    --task-definition "$task_definition_arn" \
    --region "$AWS_REGION" >/dev/null

  rm -rf "$workdir"
}

wait_for_services() {
  if [[ $# -eq 0 ]]; then
    return
  fi

  log "Waiting for services to stabilise: $*"
  aws ecs wait services-stable \
    --cluster "$ECS_CLUSTER" \
    --services "$@" \
    --region "$AWS_REGION"
}

main() {
  require_cmd aws
  require_cmd docker
  require_cmd jq
  require_cmd git

  prompt AWS_ACCESS_KEY_ID "AWS access key ID"
  prompt AWS_SECRET_ACCESS_KEY "AWS secret access key" "" true
  prompt AWS_SESSION_TOKEN "AWS session token (leave blank if not required)" "" true
  prompt IMAGE_TAG "Image tag" "$(git rev-parse --short HEAD)"

  export AWS_PAGER=""
  [[ -z "$AWS_SESSION_TOKEN" ]] && unset AWS_SESSION_TOKEN

  REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
  export REGISTRY

  log "Checking AWS credentials"
  aws sts get-caller-identity --region "$AWS_REGION" >/dev/null

  log "Logging Docker into ECR"
  aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$REGISTRY"

  local selected_services=()
  if [[ $# -gt 0 ]]; then
    selected_services=("$@")
  else
    selected_services=("${SERVICES[@]}")
  fi

  for service in "${selected_services[@]}"; do
    get_context "$service" >/dev/null || {
      printf 'Unsupported service: %s\n' "$service" >&2
      printf 'Supported services: %s\n' "${SERVICES[*]}" >&2
      exit 1
    }
  done

  # First push all images, then update ECS. This avoids half-built releases.
  for service in "${selected_services[@]}"; do
    build_and_push "$service"
  done

  local backend_services=()
  local nginx_selected=false

  for service in "${selected_services[@]}"; do
    if [[ "$service" == "nginx" ]]; then
      nginx_selected=true
    else
      backend_services+=("$service")
    fi
  done

  # Roll backend services first, then wait for them together.
  for service in "${backend_services[@]}"; do
    deploy_service "$service"
  done
  wait_for_services "${backend_services[@]}"

  # Flip the public gateway last.
  if [[ "$nginx_selected" == "true" ]]; then
    deploy_service nginx
    wait_for_services nginx
  fi

  log "Backend deploy completed"
  printf 'Image tag: %s\n' "$IMAGE_TAG"
  printf 'Services: %s\n' "${selected_services[*]}"
}

main "$@"
