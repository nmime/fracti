import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface ParamsStackProps extends cdk.StackProps {
  stage: string;
}

/**
 * SSM Parameter Store stack for managing application secrets and configuration
 */
export class ParamsStack extends cdk.Stack {
  public readonly botTokenParam: ssm.StringParameter;
  public readonly webhookSecretParam: ssm.StringParameter;
  public readonly deploymentParam: ssm.StringParameter;
  public readonly cookieSecretParam: ssm.StringParameter;

  private readonly paramPrefix: string;

  constructor(scope: Construct, id: string, props: ParamsStackProps) {
    super(scope, id, props);

    const { stage } = props;
    this.paramPrefix = `/fracti/${stage}`;

    // ============================================
    // Bot Configuration Parameters
    // ============================================
    this.botTokenParam = new ssm.StringParameter(this, 'BotTokenParam', {
      parameterName: `${this.paramPrefix}/bot/token`,
      stringValue: 'PLACEHOLDER', // Set via CLI after deployment
      description: 'Telegram Bot Token from @BotFather',
      tier: ssm.ParameterTier.STANDARD,
    });

    this.webhookSecretParam = new ssm.StringParameter(this, 'WebhookSecretParam', {
      parameterName: `${this.paramPrefix}/bot/webhook-secret`,
      stringValue: 'PLACEHOLDER', // Set during setup
      description: 'Secret token for Telegram webhook validation',
      tier: ssm.ParameterTier.STANDARD,
    });

    // ============================================
    // Deployment Metadata
    // ============================================
    this.deploymentParam = new ssm.StringParameter(this, 'DeploymentParam', {
      parameterName: `${this.paramPrefix}/deployment/metadata`,
      stringValue: JSON.stringify({
        version: '1.0.0',
        deployedAt: new Date().toISOString(),
        stage,
      }),
      description: 'Deployment metadata',
      tier: ssm.ParameterTier.STANDARD,
    });

    // ============================================
    // Cookie/Session Secret
    // ============================================
    this.cookieSecretParam = new ssm.StringParameter(this, 'CookieSecretParam', {
      parameterName: `${this.paramPrefix}/session/cookie-secret`,
      stringValue: 'PLACEHOLDER', // Set during setup
      description: 'Secret for signing session cookies',
      tier: ssm.ParameterTier.STANDARD,
    });

    // ============================================
    // Outputs
    // ============================================
    new cdk.CfnOutput(this, 'ParameterPrefix', {
      value: this.paramPrefix,
      description: 'SSM Parameter Store prefix',
    });
  }

  /**
   * Grant read access to bot-related parameters
   */
  public grantBotRead(grantee: iam.IGrantable): void {
    this.botTokenParam.grantRead(grantee);
    this.webhookSecretParam.grantRead(grantee);
  }

  /**
   * Grant read/write access to session parameters
   */
  public grantSessionAccess(grantee: iam.IGrantable): void {
    this.cookieSecretParam.grantRead(grantee);
  }

  /**
   * Grant full access for deployment operations
   */
  public grantDeploymentAccess(grantee: iam.IGrantable): void {
    this.botTokenParam.grantWrite(grantee);
    this.webhookSecretParam.grantWrite(grantee);
    this.deploymentParam.grantWrite(grantee);
    this.cookieSecretParam.grantWrite(grantee);
  }
}
