import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'
import * as path from 'path'
import $ from '@core/constants'

export interface BackendStackProps extends cdk.StackProps {
  stage: string
  table: dynamodb.ITable
}

export class BackendStack extends cdk.Stack {
  public readonly avatarsBucket: s3.Bucket
  public readonly frontendBucket: s3.Bucket
  public readonly botFunction: lambda.Function
  public readonly guiFunction: lambda.Function

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props)

    const { stage, table } = props
    const isProduction = stage === 'prod'

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
    // Lambda Environment
    // ============================================
    const lambdaEnvironment = {
      NODE_ENV: stage,
      [$.env.TABLE_NAME]: table.tableName,
      [$.env.S3_BUCKET_NAME]: this.avatarsBucket.bucketName,
      [$.env.BEDROCK_MODEL_ID]: $.bedrock.model,
      [$.env.AWS_REGION]: cdk.Aws.REGION,
    }

    // ============================================
    // Bot Lambda Function
    // ============================================
    this.botFunction = new lambda.Function(this, 'BotFunction', {
      functionName: `fracti-bot-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      // Use pre-built dist folder - build with 'pnpm run build' before deploying
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../../apps/bot/dist')),
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: isProduction ? logs.RetentionDays.SIX_MONTHS : logs.RetentionDays.ONE_WEEK,
    })

    // ============================================
    // GUI Lambda Function (for SSR)
    // ============================================
    this.guiFunction = new lambda.Function(this, 'GuiFunction', {
      functionName: `fracti-gui-${stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'run.sh',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../../apps/web'), {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c',
            'npm install && npm run build && cp -r build/* /asset-output/ && cp run.sh /asset-output/',
          ],
          user: 'root',
        },
      }),
      environment: {
        ...lambdaEnvironment,
        NODE_ENV: isProduction ? 'production' : 'development',
        AWS_LWA_READINESS_CHECK_PATH: '/ok',
        PORT: '3000',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: isProduction ? logs.RetentionDays.SIX_MONTHS : logs.RetentionDays.ONE_WEEK,
    })

    // ============================================
    // Permissions
    // ============================================
    table.grantReadWriteData(this.botFunction)
    table.grantReadWriteData(this.guiFunction)
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
    // Outputs
    // ============================================
    new cdk.CfnOutput(this, 'AvatarsBucketName', {
      value: this.avatarsBucket.bucketName,
      description: 'S3 bucket for user avatars',
      exportName: `${stage}-fracti-avatars-bucket`,
    })

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'S3 bucket for frontend assets',
      exportName: `${stage}-fracti-frontend-bucket`,
    })

    new cdk.CfnOutput(this, 'BotFunctionArn', {
      value: this.botFunction.functionArn,
      description: 'Bot Lambda function ARN',
      exportName: `${stage}-fracti-bot-function-arn`,
    })

    new cdk.CfnOutput(this, 'GuiFunctionArn', {
      value: this.guiFunction.functionArn,
      description: 'GUI Lambda function ARN',
      exportName: `${stage}-fracti-gui-function-arn`,
    })
  }
}
