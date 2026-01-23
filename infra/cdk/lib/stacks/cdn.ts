import * as cdk from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2'
import { Construct } from 'constructs'

export interface CdnStackProps extends cdk.StackProps {
  stage: string
  frontendBucket: s3.IBucket
  api: apigateway.IHttpApi
  webAclArn?: string
}

export class CdnStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution
  public readonly spaRoutingFunction: cloudfront.Function

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props)

    const { stage, frontendBucket, api, webAclArn } = props

    // ============================================
    // Origin Access Control for S3
    // ============================================
    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      originAccessControlName: `fracti-oac-${stage}`,
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    })

    // S3 origin for static assets
    const s3Origin = cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(frontendBucket, {
      originAccessControl: oac,
    })

    // API Gateway origin
    const apiDomain = `${api.apiId}.execute-api.${cdk.Aws.REGION}.amazonaws.com`
    const apiOrigin = new cloudfrontOrigins.HttpOrigin(apiDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    })

    // ============================================
    // CloudFront Function for SPA routing
    // ============================================
    this.spaRoutingFunction = new cloudfront.Function(this, 'SpaRoutingFunction', {
      functionName: `fracti-spa-routing-${stage}`,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Skip API and bot paths
  if (uri.startsWith('/api') || uri.startsWith('/bot') || uri.startsWith('/app')) {
    return request;
  }

  // Check if the URI has a file extension
  if (uri.includes('.')) {
    return request;
  }

  // SPA: redirect all other paths to index.html
  request.uri = '/index.html';
  return request;
}
      `),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    })

    // ============================================
    // CloudFront Distribution
    // ============================================
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Fracti CDN - ${stage}`,
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        functionAssociations: [{
          function: this.spaRoutingFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        // Bot webhook endpoint
        '/bot/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        // GUI SSR endpoint
        '/app/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        // API endpoint
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
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      webAclId: webAclArn,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    })

    // ============================================
    // Grant CloudFront access to S3
    // ============================================
    frontendBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [`${frontendBucket.bucketArn}/*`],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${this.distribution.distributionId}`,
        },
      },
    }))

    // ============================================
    // Outputs
    // ============================================
    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain',
      exportName: `${stage}-fracti-cloudfront-domain`,
    })

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `${stage}-fracti-cloudfront-id`,
    })

    new cdk.CfnOutput(this, 'MiniAppUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Telegram Mini App URL',
    })
  }
}
