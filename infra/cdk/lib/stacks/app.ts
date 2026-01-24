import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import $ from '@core/constants'

// Stack name prefix from constants
const prefix = $.app.name

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Re-export modular stacks
export { DynamoDBStack } from './dynamodb'
export { BackendStack } from './backend'
export { ApiStack } from './api'
export { WafStack } from './waf'
export { CdnStack } from './cdn'
export { WebhookStack } from './webhook'
export { ParamsStack } from './params'
export { LogsStack } from './logs'

export interface FractiStackProps extends cdk.StackProps {
  stage: string
}

export interface FractiAppProps {
  stage: string
  env: cdk.Environment
}

/**
 * FractiApp - Single stack approach following AWS sample patterns
 * This consolidates all resources into a single stack to avoid cross-stack cyclic dependencies
 */
export class FractiApp extends Construct {
  public readonly dynamoDbStack: cdk.Stack
  public readonly backendStack: cdk.Stack
  public readonly apiStack: cdk.Stack
  public readonly cdnStack: cdk.Stack

  constructor(scope: Construct, id: string, props: FractiAppProps) {
    super(scope, id)

    const { stage, env } = props
    const isProduction = stage === 'prod'

    // ============================================
    // Main Application Stack (Single Stack Pattern)
    // ============================================
    const prefix = $.app.name // 'tma' from app.yaml
    const mainStack = new cdk.Stack(scope, `${prefix}-${stage}`, {
      env,
      description: 'Telegram Mini App - AI-powered expense splitting with TON settlements',
      crossRegionReferences: true,
      synthesizer: new cdk.CliCredentialsStackSynthesizer({
        fileAssetsBucketName: `${prefix}-assets-${env.account}-${env.region}`,
        bucketPrefix: '',
      }),
    })

    // Expose as dynamoDbStack for CDK Nag suppressions compatibility
    this.dynamoDbStack = mainStack
    this.backendStack = mainStack
    this.apiStack = mainStack
    this.cdnStack = mainStack

    // ============================================
    // DynamoDB Table (Single Table Design)
    // ============================================
    const table = new dynamodb.Table(mainStack, 'Table', {
      tableName: `${prefix}-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProduction },
      timeToLiveAttribute: 'TTL',
    })

    // GSI1: User-to-Group lookups
    table.addGlobalSecondaryIndex({
      indexName: $.dynamodb.gsi.gsi1,
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // GSI2: Entity lookups by ID
    table.addGlobalSecondaryIndex({
      indexName: $.dynamodb.gsi.gsi2,
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // GSI3: User activity timeline
    table.addGlobalSecondaryIndex({
      indexName: $.dynamodb.gsi.gsi3,
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // ============================================
    // S3 Buckets
    // ============================================

    // S3 Bucket for Avatars (served via CloudFront)
    // Note: No bucket policies - served via CloudFront with OAC
    // (s3:DeleteBucketPolicy not allowed, so we avoid bucket policies)
    const avatarsBucket = new s3.Bucket(mainStack, 'AvatarsBucket', {
      bucketName: `${prefix}-avatars-${cdk.Aws.ACCOUNT_ID}-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      // autoDeleteObjects removed - requires Lambda custom resource
    })

    // S3 Bucket for Frontend (Private, served via CloudFront)
    const frontendBucket = new s3.Bucket(mainStack, 'FrontendBucket', {
      bucketName: `${prefix}-frontend-${cdk.Aws.ACCOUNT_ID}-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      // autoDeleteObjects removed - requires Lambda custom resource
    })

    // ============================================
    // Lambda Functions
    // ============================================

    // Common Lambda environment
    const lambdaEnvironment: Record<string, string> = {
      NODE_ENV: isProduction ? 'production' : 'development',
      TABLE_NAME: table.tableName,
      S3_BUCKET_NAME: avatarsBucket.bucketName,
      BEDROCK_MODEL_ID: $.bedrock.model,
      AWS_REGION_NAME: env.region || 'us-east-1',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
      MINI_APP_URL: process.env.MINI_APP_URL || '',
    }

    // Log group for Lambda functions
    const appLogGroup = new logs.LogGroup(mainStack, 'AppLogGroup', {
      logGroupName: `${prefix}-${stage}-app`,
      retention: isProduction ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    })

    // Common bundling options for NodejsFunction
    const bundlingOptions: lambdaNodejs.BundlingOptions = {
      minify: true,
      sourceMap: true,
      target: 'node22',
      format: lambdaNodejs.OutputFormat.ESM,
      mainFields: ['module', 'main'],
      // Banner to support dynamic require in ESM for Node.js built-ins
      banner: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
      esbuildArgs: {
        '--bundle': true,
      },
    }

    // Bot Lambda Function
    const botFunction = new lambdaNodejs.NodejsFunction(mainStack, 'BotFunction', {
      functionName: `${prefix}-bot-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, '../../../../apps/bot/lambda.ts'),
      handler: 'handler',
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logGroup: appLogGroup,
      bundling: bundlingOptions,
    })

    // GUI Lambda Function (SSR) - uses pre-built assets
    const guiFunction = new lambda.Function(mainStack, 'GuiFunction', {
      functionName: `${prefix}-gui-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'server/index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../../apps/web/build')),
      environment: {
        ...lambdaEnvironment,
        NODE_ENV: isProduction ? 'production' : 'development',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logGroup: appLogGroup,
    })

    // API Lambda Function (REST API for Mini App)
    const apiFunction = new lambdaNodejs.NodejsFunction(mainStack, 'ApiFunction', {
      functionName: `${prefix}-api-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, '../../../../apps/server/index.ts'),
      handler: 'handler',
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logGroup: appLogGroup,
      bundling: bundlingOptions,
    })

    // Grant permissions
    table.grantReadWriteData(botFunction)
    table.grantReadWriteData(guiFunction)
    table.grantReadWriteData(apiFunction)
    avatarsBucket.grantReadWrite(botFunction)
    avatarsBucket.grantRead(guiFunction)
    avatarsBucket.grantReadWrite(apiFunction)

    // Bedrock permissions
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${env.region || 'us-east-1'}::foundation-model/anthropic.claude-*`,
        `arn:aws:bedrock:${env.region || 'us-east-1'}::foundation-model/amazon.nova-*`,
      ],
    })
    botFunction.addToRolePolicy(bedrockPolicy)
    guiFunction.addToRolePolicy(bedrockPolicy)
    apiFunction.addToRolePolicy(bedrockPolicy)

    // ============================================
    // Lambda Function URLs (replacing API Gateway)
    // ============================================

    // Bot Function URL
    const botFunctionUrl = botFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data', 'X-Telegram-Bot-Api-Secret-Token', 'Authorization'],
        maxAge: cdk.Duration.days(1),
      },
    })

    // GUI Function URL
    const guiFunctionUrl = guiFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data', 'Authorization'],
        maxAge: cdk.Duration.days(1),
      },
    })

    // API Function URL
    const apiFunctionUrl = apiFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data', 'Authorization'],
        maxAge: cdk.Duration.days(1),
      },
    })

    // Extract domain names from Function URLs for CloudFront origins
    // Function URLs are in format: https://<url-id>.lambda-url.<region>.on.aws/
    const botFunctionUrlDomain = cdk.Fn.select(2, cdk.Fn.split('/', botFunctionUrl.url))
    const guiFunctionUrlDomain = cdk.Fn.select(2, cdk.Fn.split('/', guiFunctionUrl.url))
    const apiFunctionUrlDomain = cdk.Fn.select(2, cdk.Fn.split('/', apiFunctionUrl.url))

    // ============================================
    // WAF Web ACL (rate limiting only - no managed rules due to permissions)
    // ============================================
    const webAcl = new wafv2.CfnWebACL(mainStack, 'WebACL', {
      name: `${prefix}-waf-${stage}`,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${prefix}-waf-${stage}`,
        sampledRequestsEnabled: true,
      },
      rules: [
        // Rate limiting rule
        {
          name: 'RateLimitRule',
          priority: 1,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
            sampledRequestsEnabled: true,
          },
        },
        // Geo restrictions (if configured in app.yaml)
        ...($.cdn.geoRestrictions.block.length > 0 ? [{
          name: 'GeoBlockRule',
          priority: 2,
          action: { block: {} },
          statement: {
            geoMatchStatement: {
              countryCodes: $.cdn.geoRestrictions.block,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'GeoBlockRule',
            sampledRequestsEnabled: true,
          },
        }] : []),
      ],
    })

    // ============================================
    // CloudFront Distribution
    // ============================================

    // Origin Access Control for S3
    const oac = new cloudfront.S3OriginAccessControl(mainStack, 'OAC', {
      originAccessControlName: `${prefix}-oac-${stage}`,
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    })

    // S3 origins with OAC
    const frontendOrigin = cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(frontendBucket, {
      originAccessControl: oac,
    })
    const avatarsOrigin = cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(avatarsBucket, {
      originAccessControl: oac,
    })

    // Lambda Function URL origins
    const botOrigin = new cloudfrontOrigins.HttpOrigin(botFunctionUrlDomain)
    const guiOrigin = new cloudfrontOrigins.HttpOrigin(guiFunctionUrlDomain)
    const apiOrigin = new cloudfrontOrigins.HttpOrigin(apiFunctionUrlDomain)

    // SPA routing function
    const spaRoutingFunction = new cloudfront.Function(mainStack, 'SpaRoutingFunction', {
      functionName: `${prefix}-spa-routing-${stage}`,
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          if (!uri.includes('.') && !uri.startsWith('/bot') && !uri.startsWith('/app') && !uri.startsWith('/api') && !uri.startsWith('/avatars')) {
            request.uri = '/index.html';
          }
          return request;
        }
      `),
    })

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(mainStack, 'Distribution', {
      defaultBehavior: {
        origin: frontendOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{
          function: spaRoutingFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        '/avatars/*': {
          origin: avatarsOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        },
        '/bot/*': {
          origin: botOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        '/app': {
          origin: guiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        '/app/*': {
          origin: guiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        '/api': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
      webAclId: webAcl.attrArn,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    })

    // Note: CloudFront access to S3 is granted automatically by CDK when using
    // S3BucketOrigin.withOriginAccessControl() - no need for explicit policy

    // ============================================
    // Outputs
    // ============================================
    new cdk.CfnOutput(mainStack, 'TableName', {
      value: table.tableName,
      description: 'DynamoDB table name',
    })

    new cdk.CfnOutput(mainStack, 'AvatarsBucketName', {
      value: avatarsBucket.bucketName,
      description: 'S3 bucket for avatars',
    })

    new cdk.CfnOutput(mainStack, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 bucket for frontend',
    })

    new cdk.CfnOutput(mainStack, 'BotFunctionUrl', {
      value: botFunctionUrl.url,
      description: 'Bot Lambda Function URL',
    })

    new cdk.CfnOutput(mainStack, 'GuiFunctionUrl', {
      value: guiFunctionUrl.url,
      description: 'GUI Lambda Function URL',
    })

    new cdk.CfnOutput(mainStack, 'ApiFunctionUrl', {
      value: apiFunctionUrl.url,
      description: 'API Lambda Function URL',
    })

    new cdk.CfnOutput(mainStack, 'TelegramWebhookUrl', {
      value: `${botFunctionUrl.url}webhook`,
      description: 'Telegram webhook URL',
    })

    new cdk.CfnOutput(mainStack, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain',
    })

    new cdk.CfnOutput(mainStack, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
    })
  }
}

/**
 * @deprecated Use FractiApp with single stack approach for new deployments
 * This legacy single-stack class is kept for backward compatibility
 */
export class FractiStack extends cdk.Stack {
  public readonly table: dynamodb.Table
  public readonly avatarsBucket: s3.Bucket
  public readonly frontendBucket: s3.Bucket
  public readonly botFunction: lambda.Function
  public readonly guiFunction: lambda.Function
  public readonly api: apigateway.HttpApi
  public readonly distribution: cloudfront.Distribution
  public readonly waf: wafv2.CfnWebACL

  constructor(scope: Construct, id: string, props: FractiStackProps) {
    super(scope, id, props)

    const { stage } = props
    const isProduction = stage === 'prod'

    // ============================================
    // DynamoDB Table (Single Table Design)
    // ============================================
    this.table = new dynamodb.Table(this, 'Table', {
      tableName: `${$.app.name}-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProduction },
    })

    // GSI1: User-to-Group lookups
    this.table.addGlobalSecondaryIndex({
      indexName: $.dynamodb.gsi.gsi1,
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // GSI2: Entity lookups by ID
    this.table.addGlobalSecondaryIndex({
      indexName: $.dynamodb.gsi.gsi2,
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // GSI3: User activity (expenses paid, settlements made)
    this.table.addGlobalSecondaryIndex({
      indexName: $.dynamodb.gsi.gsi3,
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // ============================================
    // S3 Bucket for Avatars (Public Read)
    // ============================================
    this.avatarsBucket = new s3.Bucket(this, 'AvatarsBucket', {
      bucketName: `${prefix}-avatars-${cdk.Aws.ACCOUNT_ID}-${stage}`,
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      cors: [{
        allowedHeaders: ['*'],
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        maxAge: 86400,
      }],
      lifecycleRules: [{
        expiration: cdk.Duration.days(365),
        id: 'DeleteOldAvatars',
      }],
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProduction,
    })

    // ============================================
    // S3 Bucket for Frontend (Private)
    // ============================================
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${prefix}-frontend-${cdk.Aws.ACCOUNT_ID}-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProduction,
    })

    // ============================================
    // WAF Web ACL for CloudFront
    // ============================================
    this.waf = new wafv2.CfnWebACL(this, 'WebACL', {
      name: `${prefix}-waf-${stage}`,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${prefix}-waf-${stage}`,
        sampledRequestsEnabled: true,
      },
      rules: [
        // AWS Managed Rules - Common Rule Set
        {
          name: 'AWS-AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        // AWS Managed Rules - Known Bad Inputs
        {
          name: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        // Rate limiting
        {
          name: 'RateLimitRule',
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
            sampledRequestsEnabled: true,
          },
        },
        // Geo restrictions (optional - controlled by app.yaml)
        ...($.cdn.geoRestrictions.block.length > 0 ? [{
          name: 'GeoBlockRule',
          priority: 4,
          action: { block: {} },
          statement: {
            geoMatchStatement: {
              countryCodes: $.cdn.geoRestrictions.block,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'GeoBlockRule',
            sampledRequestsEnabled: true,
          },
        }] : []),
      ],
    })

    // ============================================
    // Lambda Functions
    // ============================================

    // Common Lambda environment
    const lambdaEnvironment = {
      NODE_ENV: stage,
      [$.env.TABLE_NAME]: this.table.tableName,
      [$.env.S3_BUCKET_NAME]: this.avatarsBucket.bucketName,
      [$.env.BEDROCK_MODEL_ID]: $.bedrock.model,
      [$.env.AWS_REGION]: cdk.Aws.REGION,
    }

    // Bot Lambda Function
    this.botFunction = new lambda.Function(this, 'BotFunction', {
      functionName: `${prefix}-bot-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../../apps/bot'), {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c',
            'npm install && npm run build && cp -r dist/* /asset-output/',
          ],
          user: 'root',
        },
      }),
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: isProduction ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    })

    // GUI Lambda Function (for SSR)
    this.guiFunction = new lambda.Function(this, 'GuiFunction', {
      functionName: `${prefix}-gui-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'server/index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../../apps/web'), {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c',
            'npm install && npm run build && cp -r build/* /asset-output/',
          ],
          user: 'root',
        },
      }),
      environment: {
        ...lambdaEnvironment,
        NODE_ENV: isProduction ? 'production' : 'development',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: isProduction ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    })

    // Grant permissions
    this.table.grantReadWriteData(this.botFunction)
    this.table.grantReadWriteData(this.guiFunction)
    this.avatarsBucket.grantReadWrite(this.botFunction)
    this.avatarsBucket.grantRead(this.guiFunction)

    // Bedrock permissions
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-*`,
        `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.nova-*`,
      ],
    })
    this.botFunction.addToRolePolicy(bedrockPolicy)
    this.guiFunction.addToRolePolicy(bedrockPolicy)

    // ============================================
    // API Gateway (HTTP API)
    // ============================================
    this.api = new apigateway.HttpApi(this, 'Api', {
      apiName: `${prefix}-api-${stage}`,
      description: 'Fracti API Gateway',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.PUT,
          apigateway.CorsHttpMethod.DELETE,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'X-Telegram-Init-Data', 'Authorization'],
        maxAge: cdk.Duration.days(1),
      },
    })

    // Bot webhook route
    const botIntegration = new apigatewayIntegrations.HttpLambdaIntegration(
      'BotIntegration',
      this.botFunction
    )
    this.api.addRoutes({
      path: `${$.artifacts.lambda.bot.basepath}/{proxy+}`,
      methods: [apigateway.HttpMethod.ANY],
      integration: botIntegration,
    })

    // GUI routes (SSR)
    const guiIntegration = new apigatewayIntegrations.HttpLambdaIntegration(
      'GuiIntegration',
      this.guiFunction
    )
    this.api.addRoutes({
      path: `${$.artifacts.lambda.gui.basepath}/{proxy+}`,
      methods: [apigateway.HttpMethod.ANY],
      integration: guiIntegration,
    })
    this.api.addRoutes({
      path: $.artifacts.lambda.gui.basepath,
      methods: [apigateway.HttpMethod.ANY],
      integration: guiIntegration,
    })

    // ============================================
    // CloudFront Distribution
    // ============================================

    // Origin Access Control for S3
    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      originAccessControlName: `${prefix}-oac-${stage}`,
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    })

    // S3 origin for static assets
    const s3Origin = cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(this.frontendBucket, {
      originAccessControl: oac,
    })

    // API Gateway origin
    const apiOrigin = new cloudfrontOrigins.HttpOrigin(
      `${this.api.apiId}.execute-api.${cdk.Aws.REGION}.amazonaws.com`
    )

    // CloudFront Function for SPA routing
    const spaRoutingFunction = new cloudfront.Function(this, 'SpaRoutingFunction', {
      functionName: `${prefix}-spa-routing-${stage}`,
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;

          // Check if the URI has a file extension
          if (!uri.includes('.') && !uri.startsWith('/api') && !uri.startsWith('/bot') && !uri.startsWith('/app')) {
            request.uri = '/index.html';
          }

          return request;
        }
      `),
    })

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{
          function: spaRoutingFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        '/bot/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        '/app/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      webAclId: this.waf.attrArn,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    })

    // Grant CloudFront access to S3
    this.frontendBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [`${this.frontendBucket.bucketArn}/*`],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${this.distribution.distributionId}`,
        },
      },
    }))

    // ============================================
    // Outputs
    // ============================================
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.apiEndpoint,
      description: 'API Gateway endpoint URL',
    })

    new cdk.CfnOutput(this, 'TelegramWebhookUrl', {
      value: `${this.api.apiEndpoint}${$.artifacts.lambda.bot.basepath}/webhook`,
      description: 'URL to register with Telegram Bot API',
    })

    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name',
    })

    new cdk.CfnOutput(this, 'AvatarsBucketName', {
      value: this.avatarsBucket.bucketName,
      description: 'S3 bucket for user avatars',
    })

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'S3 bucket for frontend assets',
    })

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain',
    })

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
    })
  }
}
