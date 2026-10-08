# AWS infrastructure checklist

This demo deliberately keeps infrastructure instructions separate from the application.

## Required resources

1. VPC
2. Private RDS PostgreSQL
3. EC2 instance
4. EC2 security group
5. Lambda function
6. IAM instance role for EC2
7. IAM execution role for Lambda
8. CloudWatch telemetry setup
9. CloudWatch Application Signals
10. CloudWatch Omni domain + space

## Security groups

EC2:
- TCP 3000: restrict to your demo access path.
- Outbound: required AWS service access.

RDS:
- TCP 5432: source = EC2 security group only.

Do not expose PostgreSQL to 0.0.0.0/0.

## IAM concept

EC2 needs permission to:
- invoke the specific payment Lambda
- send the telemetry required by your selected CloudWatch/ADOT path
- write/read logs as required by the CloudWatch agent setup

Lambda needs:
- standard Lambda execution permissions
- Application Signals/OpenTelemetry permissions when enabled using the AWS-supported method

Prefer least-privilege policies and an instance role rather than AWS access keys stored on the EC2 host.
