import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import * as path from 'path'
import $ from '@core/constants'

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
 * FractiApp - Orchestrates all modular stacks for the Fracti application
 * This is the recommended approach for new deployments
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
    // Stack 1: DynamoDB (Data Layer)
    // ============================================
    this.dynamoDbStack = new cdk.Stack(scope, `Fracti-DynamoDB-${stage}`, {
      env,
      description: 'Fracti DynamoDB table and indexes',
    })

    const table = new dynamodb.Table(this.dynamoDbStack, 'Table', {
      tableName: `fracti-${stage}`,
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
    // Stack 2: Backend (Lambda + S3)
    // ============================================
    this.backendStack = new cdk.Stack(scope, `Fracti-Backend-${stage}`, {
      env,
      description: 'Fracti Lambda functions and S3 buckets',
    })
    this.backendStack.addDependency(this.dynamoDbStack)

    // S3 Bucket for Avatars
    const avatarsBucket = new s3.Bucket(this.backendStack, 'AvatarsBucket', {
      bucketName: `fracti-avatars-${cdk.Aws.ACCOUNT_ID}-${stage}`,
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
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProduction,
    })

    // S3 Bucket for Frontend
    const frontendBucket = new s3.Bucket(this.backendStack, 'FrontendBucket', {
      bucketName: `fracti-frontend-${cdk.Aws.ACCOUNT_ID}-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProduction,
    })

    // Common Lambda environment
    const lambdaEnvironment = {
      NODE_ENV: stage,
      TABLE_NAME: table.tableName,
      S3_BUCKET_NAME: avatarsBucket.bucketName,
      BEDROCK_MODEL_ID: $.bedrock.model,
      AWS_REGION_NAME: env.region || 'us-east-1',
    }

    // Bot Lambda Function
    const botFunction = new lambda.Function(this.backendStack, 'BotFunction', {
      functionName: `fracti-bot-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../../bot')),
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: isProduction ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    })

    // GUI Lambda Function (SSR)
    const guiFunction = new lambda.Function(this.backendStack, 'GuiFunction', {
      functionName: `fracti-gui-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'server/index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../../gui/react/build')),
      environment: {
        ...lambdaEnvironment,
        NODE_ENV: isProduction ? 'production' : 'development',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: isProduction ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    })

    // API Lambda Function (REST API for Mini App)
    const apiFunction = new lambda.Function(this.backendStack, 'ApiFunction', {
      functionName: `fracti-api-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../../server')),
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: isProduction ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
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
    // Stack 3: API Gateway
    // ============================================
    this.apiStack = new cdk.Stack(scope, `Fracti-API-${stage}`, {
      env,
      description: 'Fracti HTTP API Gateway',
    })
    this.apiStack.addDependency(this.backendStack)

    const api = new apigateway.HttpApi(this.apiStack, 'Api', {
      apiName: `fracti-api-${stage}`,
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
        allowHeaders: ['Content-Type', 'X-Telegram-Init-Data', 'X-Telegram-Bot-Api-Secret-Token', 'Authorization'],
        maxAge: cdk.Duration.days(1),
      },
    })

    // Bot routes
    const botIntegration = new apigatewayIntegrations.HttpLambdaIntegration('BotIntegration', botFunction)
    api.addRoutes({
      path: `${$.artifacts.lambda.bot.basepath}/webhook`,
      methods: [apigateway.HttpMethod.POST],
      integration: botIntegration,
    })
    api.addRoutes({
      path: `${$.artifacts.lambda.bot.basepath}/{proxy+}`,
      methods: [apigateway.HttpMethod.ANY],
      integration: botIntegration,
    })

    // GUI routes
    const guiIntegration = new apigatewayIntegrations.HttpLambdaIntegration('GuiIntegration', guiFunction)
    api.addRoutes({
      path: $.artifacts.lambda.gui.basepath,
      methods: [apigateway.HttpMethod.GET],
      integration: guiIntegration,
    })
    api.addRoutes({
      path: `${$.artifacts.lambda.gui.basepath}/{proxy+}`,
      methods: [apigateway.HttpMethod.ANY],
      integration: guiIntegration,
    })

    // API routes (REST API for Mini App)
    const apiIntegration = new apigatewayIntegrations.HttpLambdaIntegration('ApiIntegration', apiFunction)
    api.addRoutes({
      path: '/api/{proxy+}',
      methods: [apigateway.HttpMethod.ANY],
      integration: apiIntegration,
    })

    // ============================================
    // Stack 4: CDN (CloudFront + WAF)
    // ============================================
    this.cdnStack = new cdk.Stack(scope, `Fracti-CDN-${stage}`, {
      env: { ...env, region: 'us-east-1' }, // WAF must be in us-east-1 for CloudFront
      description: 'Fracti CloudFront distribution and WAF',
      crossRegionReferences: true,
    })
    this.cdnStack.addDependency(this.apiStack)

    // WAF Web ACL
    const webAcl = new wafv2.CfnWebACL(this.cdnStack, 'WebACL', {
      name: `fracti-waf-${stage}`,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `fracti-waf-${stage}`,
        sampledRequestsEnabled: true,
      },
      rules: [
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
      ],
    })

    // Origin Access Control for S3
    const oac = new cloudfront.S3OriginAccessControl(this.cdnStack, 'OAC', {
      originAccessControlName: `fracti-oac-${stage}`,
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    })

    // S3 origin
    const s3Origin = cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(frontendBucket, {
      originAccessControl: oac,
    })

    // API Gateway origin
    const apiOrigin = new cloudfrontOrigins.HttpOrigin(
      `${api.apiId}.execute-api.${env.region || 'us-east-1'}.amazonaws.com`
    )

    // SPA routing function
    const spaRoutingFunction = new cloudfront.Function(this.cdnStack, 'SpaRoutingFunction', {
      functionName: `fracti-spa-routing-${stage}`,
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          if (!uri.includes('.') && !uri.startsWith('/bot') && !uri.startsWith('/app') && !uri.startsWith('/api')) {
            request.uri = '/index.html';
          }
          return request;
        }
      `),
    })

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this.cdnStack, 'Distribution', {
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

    // Grant CloudFront access to S3
    frontendBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [`${frontendBucket.bucketArn}/*`],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${distribution.distributionId}`,
        },
      },
    }))

    // ============================================
    // Outputs
    // ============================================
    new cdk.CfnOutput(this.dynamoDbStack, 'TableName', {
      value: table.tableName,
      description: 'DynamoDB table name',
    })

    new cdk.CfnOutput(this.backendStack, 'AvatarsBucketName', {
      value: avatarsBucket.bucketName,
      description: 'S3 bucket for avatars',
    })

    new cdk.CfnOutput(this.backendStack, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 bucket for frontend',
    })

    new cdk.CfnOutput(this.apiStack, 'ApiEndpoint', {
      value: api.apiEndpoint,
      description: 'API Gateway endpoint',
    })

    new cdk.CfnOutput(this.apiStack, 'TelegramWebhookUrl', {
      value: `${api.apiEndpoint}${$.artifacts.lambda.bot.basepath}/webhook`,
      description: 'Telegram webhook URL',
    })

    new cdk.CfnOutput(this.cdnStack, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain',
    })

    new cdk.CfnOutput(this.cdnStack, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
    })
  }
}

/**
 * @deprecated Use FractiApp with modular stacks for new deployments
 * This single-stack approach is kept for backward compatibility
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
      tableName: `fracti-${stage}`,
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
      bucketName: `fracti-avatars-${cdk.Aws.ACCOUNT_ID}-${stage}`,
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
      bucketName: `fracti-frontend-${cdk.Aws.ACCOUNT_ID}-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProduction,
    })

    // ============================================
    // WAF Web ACL for CloudFront
    // ============================================
    this.waf = new wafv2.CfnWebACL(this, 'WebACL', {
      name: `fracti-waf-${stage}`,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `fracti-waf-${stage}`,
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
      functionName: `fracti-bot-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../../bot'), {
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
      functionName: `fracti-gui-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'server/index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../../gui/react'), {
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
      apiName: `fracti-api-${stage}`,
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
      originAccessControlName: `fracti-oac-${stage}`,
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
      functionName: `fracti-spa-routing-${stage}`,
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
