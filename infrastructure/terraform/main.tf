terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "conic-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# ---- VPC ----
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "conic-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false

  tags = { Project = "conic" }
}

# ---- RDS PostgreSQL ----
resource "aws_db_subnet_group" "main" {
  name       = "conic-db-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds" {
  name   = "conic-rds-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }
}

resource "aws_db_instance" "postgres" {
  identifier           = "conic-postgres"
  engine               = "postgres"
  engine_version       = "16.3"
  instance_class       = var.db_instance_class
  allocated_storage    = 20
  storage_encrypted    = true
  db_name              = "conic"
  username             = var.db_username
  password             = var.db_password
  db_subnet_group_name = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  backup_retention_period = 7
  deletion_protection  = true
  skip_final_snapshot  = false
  final_snapshot_identifier = "conic-postgres-final"

  tags = { Project = "conic" }
}

# ---- ElastiCache Redis ----
resource "aws_elasticache_subnet_group" "main" {
  name       = "conic-redis-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "redis" {
  name   = "conic-redis-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "conic-redis"
  description          = "Conic Redis cluster"
  node_type            = "cache.t3.micro"
  num_cache_clusters   = 2
  automatic_failover_enabled = true
  engine               = "redis"
  engine_version       = "7.1"
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = { Project = "conic" }
}

# ---- ECS Cluster ----
resource "aws_ecs_cluster" "main" {
  name = "conic-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Project = "conic" }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# ---- ECR Repositories ----
locals {
  services = ["backend", "frontend", "contract-ai", "deliverable-verification-ai", "creator-graph-ai", "pricing-engine-ai", "campaign-agent-ai"]
}

resource "aws_ecr_repository" "services" {
  for_each             = toset(local.services)
  name                 = "conic-${each.value}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Project = "conic" }
}

# ---- ALB ----
resource "aws_lb" "main" {
  name               = "conic-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = module.vpc.public_subnets

  tags = { Project = "conic" }
}
