# CloudFormation - Clubinhonib API

This directory contains CloudFormation templates to provision AWS infrastructure for the Clubinhonib API application.

## 📁 Directory Structure

Each AWS service has its own folder with all necessary files:

```
cloudformation/
├── acm/                    # SSL Certificate (ACM)
│   ├── deploy.sh
│   ├── stack.yaml
│   └── params.json
│
├── infrastructure/         # Main Infrastructure (ACM + EC2 + ALB + DNS)
│   ├── deploy-infrastructure.sh  # 🆕 Deploy ACM + EC2 unified
│   ├── deploy-complete.sh        # Deploy application (build + push + run)
│   ├── stack.yaml                # EC2 CloudFormation template
│   ├── params.json               # Infrastructure parameters
│   ├── params.example.json
│   └── README.md
│
├── ecr/                    # Docker Registry
│   ├── deploy.sh
│   └── stack.yaml
│
├── s3/                     # Storage
│   ├── deploy.sh
│   ├── stack.yaml
│   └── params.json
│
├── ses/                    # Email Service
│   ├── deploy.sh
│   ├── stack.yaml
│   └── params.json
│
└── rds/                    # Database
    ├── deploy.sh
    ├── stack.yaml
    ├── params.json
    └── rds-connect.sh
```

## 🚀 Quick Start

### Deploy a specific service:

```bash
# ECR (creates staging and production repositories)
cd ecr && bash deploy.sh

# Infrastructure (ACM + EC2 + ALB + DNS)
cd infrastructure && bash deploy-infrastructure.sh

# Application deployment (build + push + deploy)
cd infrastructure && bash deploy-complete.sh staging
cd infrastructure && bash deploy-complete.sh production

# SES
cd ses && bash deploy.sh

# S3
cd s3 && bash deploy.sh

# RDS
cd rds && bash deploy.sh
```

### AWS Profile

All scripts use the `clubinho-aws` profile by default. To use a different profile:

```bash
AWS_PROFILE=another-profile bash deploy.sh
```

## 📦 RDS Stack

### Features

- **Instance**: `db.t3.micro` (cheapest available)
- **Engine**: MySQL 8.4.6
- **Storage**: 20 GB gp3 (encrypted)
- **Backup**: 7 days retention
- **Multi-AZ**: Disabled (to reduce costs)
- **Access**: **PUBLIC** (accessible via internet with password authentication)
- **Estimated cost**: ~$15-20 USD/month

⚠️ **IMPORTANT - SECURITY**: This configuration allows public access to RDS. Make sure to:
- Use **VERY STRONG** passwords (minimum 16 characters, with letters, numbers and symbols)
- Consider restricting `AllowedCIDR` to specific IPs in production
- Monitor access logs and connection attempts

### Prerequisites

1. AWS CLI configured
2. Adequate permissions to create RDS, VPC, Security Groups resources
3. **VPC and PUBLIC Subnets** existing (required for public RDS access)
   - Subnets must have route to Internet Gateway
   - At least 2 subnets in different Availability Zones

### How to Deploy

#### 1. Prepare Parameters

Edit the `rds/params.json` file and adjust the values:

```json
[
  {
    "ParameterKey": "Environment",
    "ParameterValue": "staging"
  },
  {
    "ParameterKey": "DBInstanceIdentifier",
    "ParameterValue": "clubinhonib-db"
  },
  {
    "ParameterKey": "DBName",
    "ParameterValue": "clubinhonib"
  },
  {
    "ParameterKey": "DBUsername",
    "ParameterValue": "admin"
  },
  {
    "ParameterKey": "DBPassword",
    "ParameterValue": "YOUR_STRONG_PASSWORD_HERE"
  },
  {
    "ParameterKey": "VpcId",
    "ParameterValue": "vpc-xxxxxxxxx"
  },
  {
    "ParameterKey": "SubnetIds",
    "ParameterValue": "subnet-xxxxxxxxx,subnet-yyyyyyyyy"
  },
  {
    "ParameterKey": "AllowedCIDR",
    "ParameterValue": "0.0.0.0/0"
  }
]
```

#### 2. Get VPC and PUBLIC Subnets

⚠️ **IMPORTANT**: For public access, you need **public subnets** (with route to Internet Gateway).

```bash
# List available VPCs
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,IsDefault]' --output table

# List PUBLIC Subnets of a VPC (check if they have Internet Gateway)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-xxxxxxxxx" --query 'Subnets[*].[SubnetId,AvailabilityZone,MapPublicIpOnLaunch]' --output table

# Check if subnet has route to Internet Gateway
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-xxxxxxxxx" --query 'RouteTables[*].[Routes[?GatewayId!=null].GatewayId,Associations[].SubnetId]' --output table
```

**Tip**: Default VPC usually has public subnets by default.

#### 3. Deploy Stack

```bash
cd rds
bash deploy.sh
```

Or manually:

```bash
aws cloudformation create-stack \
  --stack-name clubinhonib-rds-staging \
  --template-body file://stack.yaml \
  --parameters file://params.json
```

#### 4. Check Status

```bash
# View stack status
aws cloudformation describe-stacks --stack-name clubinhonib-rds-staging

# View stack events
aws cloudformation describe-stack-events --stack-name clubinhonib-rds-staging --max-items 10
```

#### 5. Get Outputs

After creation (may take 10-15 minutes), get the outputs:

```bash
# Get all outputs
aws cloudformation describe-stacks \
  --stack-name clubinhonib-rds-staging \
  --query 'Stacks[0].Outputs' \
  --output table

# Get specific public endpoint
aws cloudformation describe-stacks \
  --stack-name clubinhonib-rds-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicEndpoint`].OutputValue' \
  --output text
```

### Test Public Connection

After deployment, test the connection:

```bash
# Get endpoint
ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name clubinhonib-rds-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicEndpoint`].OutputValue' \
  --output text)

# Test MySQL connection
mysql -h $ENDPOINT -u admin -p
```

### Update Stack

```bash
cd rds
bash deploy.sh
```

### Delete Stack

⚠️ **WARNING**: This will create a snapshot before deleting (thanks to DeletionPolicy: Snapshot)

```bash
aws cloudformation delete-stack --stack-name clubinhonib-rds-staging
```

## 🔌 Connect MySQL Workbench and Local Application

### Step 1: Get Connection Information

Execute this script to get all necessary information:

```bash
cd cloudformation/rds
./rds-connect.sh staging
```

Or manually:

```bash
# Get public endpoint
ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name clubinhonib-rds-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicEndpoint`].OutputValue' \
  --output text)

# Get port
PORT=$(aws cloudformation describe-stacks \
  --stack-name clubinhonib-rds-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`DBPort`].OutputValue' \
  --output text)

# Get database name
DB_NAME=$(aws cloudformation describe-stacks \
  --stack-name clubinhonib-rds-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`DBName`].OutputValue' \
  --output text)

echo "Endpoint: $ENDPOINT"
echo "Port: $PORT"
echo "Database: $DB_NAME"
```

### Step 2: Connect MySQL Workbench

1. Open **MySQL Workbench**
2. Click **"+"** next to "MySQL Connections" or go to **Database > Manage Connections**
3. Click **"New"** to create a new connection

#### Configure Connection

Fill in the fields:

- **Connection Name**: `Clubinhonib RDS (Staging)` (or any name)
- **Hostname**: `<ENDPOINT>` (obtained in Step 1)
- **Port**: `3306` (or the port obtained in Step 1)
- **Username**: `admin` (or the user you configured)
- **Password**: Click **"Store in Keychain"** or **"Store in Vault"** and enter your password
- **Default Schema**: `clubinhonib` (or the configured database name)

#### Advanced Settings (Optional)

In the **"Advanced"** tab:
- **Use SSL**: Can leave unchecked for development, but recommended for production
- **Default Character Set**: `utf8mb4`
- **Default Collation**: `utf8mb4_unicode_ci`

#### Test Connection

1. Click **"Test Connection"** to verify it's working
2. If it works, click **"OK"** to save
3. Double-click the connection to connect

### Step 3: Configure Local Application

#### 3.1 Create local `.env` file

Create a `.env` file at the project root (or copy from `env/example.env`):

```bash
cp env/example.env env/local.env
```

#### 3.2 Get RDS Values

Execute this script to automatically generate the `.env` file:

```bash
cd cloudformation/rds
./rds-connect.sh staging --generate-env
```

This will create the `env/local.env` file with all RDS configurations. **Edit the password** in the generated file:

```bash
nano ../env/local.env
# Change DB_PASSWORD=CHANGE_THIS_PASSWORD to your real password
```

**Important**: The application uses `env/local.env` when `ENVIRONMENT=local`. Make sure:
- The `env/local.env` file exists
- The `ENVIRONMENT=local` variable is defined in the file (already included)

Or configure manually in the `env/local.env` file:

```env
ENVIRONMENT=local

# Database Configuration - RDS AWS
DB_HOST=clubinhonib-db-staging.xxxxxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USERNAME=admin
DB_PASSWORD=your_password_here
DB_NAME=clubinhonib

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_BUCKET_NAME=your_bucket_name

# Email Configuration (SES)
SES_DEFAULT_FROM=no-reply@yourdomain.com
SES_DEFAULT_TO=your-email@example.com

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_REFRESH_EXPIRES_IN=14d

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
TWILIO_WHATSAPP_TO=whatsapp:+1234567890

# Feed Configuration
FEED_CLUBINHO_PAGE_ID=your_page_id

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
```

#### 3.3 Verify Configuration

The NestJS application is already configured to read these variables. Check the `database/database.module.ts` file - it uses:

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`

#### 3.4 Test Application Connection

```bash
# Install dependencies (if needed)
npm install

# Run the application
npm run start:dev
```

The application should connect to RDS automatically. Check the logs to confirm the connection.

## 🚀 EC2 Stack

### Features

- **Instance Type**: EC2 Spot Instance (cost-effective)
- **AMI**: Amazon Linux 2023
- **Docker**: Pre-installed and configured
- **Auto DNS**: Automatic Route53 DNS update after deployment
- **SSM**: Systems Manager for secure deployment

### Deploy Infrastructure (ACM + EC2)

```bash
cd infrastructure
bash deploy-infrastructure.sh
```

This will:
1. Create/update SSL certificate (ACM)
2. Create/update EC2 instances + ALB stack
3. Automatically update Route53 DNS records

### Complete Application Deployment

The `deploy-complete.sh` script does everything in one command:

```bash
cd infrastructure
bash deploy-complete.sh staging
```

This script:
1. **Builds** the Docker image
2. **Pushes** to ECR (staging or production repository)
3. **Deploys** to EC2 instance

#### Usage Options

```bash
# Deploy to staging
./deploy-complete.sh staging latest

# Deploy to production
./deploy-complete.sh production latest
# or
./deploy-complete.sh prod latest

# Skip build (if image already exists)
./deploy-complete.sh staging latest --skip-build

# Skip deploy (only build and push)
./deploy-complete.sh staging latest --skip-deploy
```

### Infrastructure Utilities

```bash
cd infrastructure

# Get HostedZoneId for a domain
./get-hosted-zone-id.sh clubinhonib.com

# Install Docker on EC2 (if needed)
./get-docker.sh
```

## 🔐 Application Environment Variables

After deploying RDS, you'll need to configure environment variables for the NestJS application.

### Database Variables

Use CloudFormation stack outputs:

```bash
# Get values
DB_HOST=$(aws cloudformation describe-stacks \
  --stack-name clubinhonib-rds-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`DBEndpoint`].OutputValue' \
  --output text)

DB_PORT=$(aws cloudformation describe-stacks \
  --stack-name clubinhonib-rds-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`DBPort`].OutputValue' \
  --output text)
```

### All Required Variables

The application needs these environment variables:

#### Database
- `DB_HOST` - RDS endpoint (from CloudFormation output)
- `DB_PORT` - MySQL port (3306)
- `DB_USERNAME` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name

#### AWS
- `AWS_REGION` - AWS region (e.g., us-east-1)
- `AWS_ACCESS_KEY_ID` - IAM user access key
- `AWS_SECRET_ACCESS_KEY` - IAM user secret key
- `AWS_S3_BUCKET_NAME` - S3 bucket name

#### Email (SES)
- `SES_DEFAULT_FROM` - Default sender email
- `SES_DEFAULT_TO` - Default recipient email

#### JWT
- `JWT_SECRET` - Secret key for JWT signing
- `JWT_EXPIRES_IN` - JWT expiration time (e.g., 7d)
- `JWT_REFRESH_SECRET` - Secret key for refresh tokens
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiration time (e.g., 14d)

#### Twilio
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_WHATSAPP_FROM` - WhatsApp sender number
- `TWILIO_WHATSAPP_TO` - WhatsApp recipient number

#### Other
- `FEED_CLUBINHO_PAGE_ID` - Facebook/Instagram page ID
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `ENVIRONMENT` - Application environment (local, staging, production)

### Example .env File

See `env/staging.env` and `env/prod.env` for examples.

## 🔒 Security - PUBLIC ACCESS

⚠️ **WARNING**: This configuration exposes RDS publicly on the internet. Follow these security recommendations:

### MANDATORY Recommendations

1. **STRONG Passwords**: 
   - Use passwords with **minimum 16 characters**
   - Combine uppercase, lowercase, numbers and symbols
   - Use AWS Secrets Manager or Parameter Store to store passwords
   - **NEVER** commit passwords to code

2. **Restrict Access by IP** (RECOMMENDED for production):
   - Adjust `AllowedCIDR` to allow access only from specific IPs
   - Example: `"AllowedCIDR": "203.0.113.0/24"` (only your network)
   - Use `0.0.0.0/0` only for development/staging

3. **Monitoring**:
   - Enable CloudWatch Logs to monitor access attempts
   - Configure alerts for multiple failed login attempts
   - Monitor suspicious connections

4. **Encryption**: 
   - Storage is already encrypted by default ✅
   - Consider enabling SSL/TLS for connections (recommended)

5. **Backup**: 
   - Automatic backups are configured (7 days) ✅

6. **Updates**:
   - Keep MySQL always updated with security patches
   - Configure automatic updates when possible

### Use Secrets Manager

```bash
# Create secret for RDS password
aws secretsmanager create-secret \
  --name clubinhonib/rds/password \
  --secret-string "YOUR_STRONG_PASSWORD"

# Retrieve secret
aws secretsmanager get-secret-value \
  --secret-id clubinhonib/rds/password \
  --query SecretString \
  --output text
```

## 💰 Costs

- **db.t3.micro**: ~$15-20 USD/month
- **Storage (20 GB gp3)**: ~$2 USD/month
- **Backups (7 days)**: Included in storage
- **Total estimated**: ~$17-22 USD/month

To reduce costs in development, you can:
- Stop the instance when not in use
- Reduce backup period
- Use smaller instances (if available)

## 🐛 Troubleshooting

### Error: "DB instance already exists"
- Check if an instance with the same identifier already exists
- Use a different name or delete the existing instance

### Error: "Subnet group not found"
- Verify that subnets are in the same VPC
- Make sure you have at least 2 subnets in different AZs

### Error: "Invalid security group"
- Verify that the Security Group is in the same VPC
- Check ingress rules

### Can't connect to RDS publicly
- Check Security Group (port 3306 must be open for your IP or 0.0.0.0/0)
- Verify that subnets are public (have route to Internet Gateway)
- Verify that RDS is configured as public (PubliclyAccessible: true)
- Verify that the endpoint is correct (use the PublicEndpoint output)
- Test connection: `mysql -h <endpoint> -u <username> -p`

### Error: "Can't connect to MySQL server"

**Possible causes:**
1. Security Group doesn't allow your IP
   - **Solution**: Check if `AllowedCIDR` is set to `0.0.0.0/0` or includes your IP

2. RDS is still being created
   - **Solution**: Wait 10-15 minutes after deployment

3. Incorrect endpoint
   - **Solution**: Check endpoint with `aws cloudformation describe-stacks`

### Error: "Access denied for user"

**Possible causes:**
1. Incorrect username or password
   - **Solution**: Check CloudFormation stack parameters

2. User doesn't have permissions
   - **Solution**: Master user should have all permissions

### Error: "Unknown database"

**Possible causes:**
1. Database wasn't created
   - **Solution**: Verify that the `DBName` parameter was configured correctly

### Application doesn't connect

**Check:**
1. Environment variables are correct in the `.env` file
2. `.env` file is being loaded (check `src/main.ts` or `app.module.ts`)
3. Port 3306 is not blocked by local firewall
4. Application logs for specific errors

## 📚 References

- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [CloudFormation RDS Resource](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_RDS.html)
- [MySQL on RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_MySQL.html)
- [EC2 Spot Instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-spot-instances.html)
- [ECR Documentation](https://docs.aws.amazon.com/ecr/)
