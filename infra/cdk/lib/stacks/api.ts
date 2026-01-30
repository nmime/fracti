import $ from '@libs/constants';
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import type { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  stage: string;
  botFunction: lambda.IFunction;
  guiFunction: lambda.IFunction;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { stage, botFunction, guiFunction } = props;

    // ============================================
    // HTTP API Gateway
    // ============================================
    this.api = new apigateway.HttpApi(this, 'Api', {
      apiName: `fracti-api-${stage}`,
      description: 'Fracti Telegram Mini App API Gateway',
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
    });

    // ============================================
    // Bot Integration
    // ============================================
    const botIntegration = new apigatewayIntegrations.HttpLambdaIntegration('BotIntegration', botFunction);

    // Bot webhook route
    this.api.addRoutes({
      path: `${$.artifacts.lambda.bot.basepath}/webhook`,
      methods: [apigateway.HttpMethod.POST],
      integration: botIntegration,
    });

    // Bot proxy route for other operations
    this.api.addRoutes({
      path: `${$.artifacts.lambda.bot.basepath}/{proxy+}`,
      methods: [apigateway.HttpMethod.ANY],
      integration: botIntegration,
    });

    // ============================================
    // GUI Integration (SSR)
    // ============================================
    const guiIntegration = new apigatewayIntegrations.HttpLambdaIntegration('GuiIntegration', guiFunction);

    // GUI root route
    this.api.addRoutes({
      path: $.artifacts.lambda.gui.basepath,
      methods: [apigateway.HttpMethod.GET],
      integration: guiIntegration,
    });

    // GUI proxy route
    this.api.addRoutes({
      path: `${$.artifacts.lambda.gui.basepath}/{proxy+}`,
      methods: [apigateway.HttpMethod.ANY],
      integration: guiIntegration,
    });

    // Health check route
    this.api.addRoutes({
      path: '/ok',
      methods: [apigateway.HttpMethod.GET],
      integration: guiIntegration,
    });

    // ============================================
    // Outputs
    // ============================================
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.apiEndpoint,
      description: 'API Gateway endpoint URL',
      exportName: `${stage}-fracti-api-endpoint`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.apiId,
      description: 'API Gateway ID',
      exportName: `${stage}-fracti-api-id`,
    });

    new cdk.CfnOutput(this, 'TelegramWebhookUrl', {
      value: `${this.api.apiEndpoint}${$.artifacts.lambda.bot.basepath}/webhook`,
      description: 'URL to register with Telegram Bot API',
    });
  }
}
