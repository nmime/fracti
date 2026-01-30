import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import type { Construct } from 'constructs';

export interface LogsStackProps extends cdk.StackProps {
  stage: string;
}

/**
 * Centralized logging stack for CloudWatch Logs configuration
 */
export class LogsStack extends cdk.Stack {
  public readonly botLogGroup: logs.LogGroup;
  public readonly guiLogGroup: logs.LogGroup;
  public readonly apiLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: LogsStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const isProduction = stage === 'prod';

    // Retention period based on environment
    const retention = isProduction ? logs.RetentionDays.SIX_MONTHS : logs.RetentionDays.ONE_WEEK;

    // ============================================
    // Bot Lambda Log Group
    // ============================================
    this.botLogGroup = new logs.LogGroup(this, 'BotLogGroup', {
      logGroupName: `/aws/lambda/fracti-bot-${stage}`,
      retention,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ============================================
    // GUI Lambda Log Group
    // ============================================
    this.guiLogGroup = new logs.LogGroup(this, 'GuiLogGroup', {
      logGroupName: `/aws/lambda/fracti-gui-${stage}`,
      retention,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ============================================
    // API Gateway Log Group
    // ============================================
    this.apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/aws/apigateway/fracti-api-${stage}`,
      retention,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ============================================
    // Metric Filters for Monitoring
    // ============================================

    // Error metric filter for bot logs
    new logs.MetricFilter(this, 'BotErrorMetricFilter', {
      logGroup: this.botLogGroup,
      metricNamespace: 'Fracti',
      metricName: 'BotErrors',
      filterPattern: logs.FilterPattern.anyTerm('ERROR', 'Error', 'error'),
      metricValue: '1',
      dimensions: {
        Stage: stage,
        Function: 'bot',
      },
    });

    // Error metric filter for GUI logs
    new logs.MetricFilter(this, 'GuiErrorMetricFilter', {
      logGroup: this.guiLogGroup,
      metricNamespace: 'Fracti',
      metricName: 'GuiErrors',
      filterPattern: logs.FilterPattern.anyTerm('ERROR', 'Error', 'error'),
      metricValue: '1',
      dimensions: {
        Stage: stage,
        Function: 'gui',
      },
    });

    // Latency metric filter (extract duration from Lambda logs)
    new logs.MetricFilter(this, 'BotDurationMetricFilter', {
      logGroup: this.botLogGroup,
      metricNamespace: 'Fracti',
      metricName: 'BotDuration',
      filterPattern: logs.FilterPattern.literal('[report="REPORT", ...]'),
      metricValue: '$duration',
      dimensions: {
        Stage: stage,
        Function: 'bot',
      },
    });

    // ============================================
    // Outputs
    // ============================================
    new cdk.CfnOutput(this, 'BotLogGroupName', {
      value: this.botLogGroup.logGroupName,
      description: 'Bot Lambda log group name',
    });

    new cdk.CfnOutput(this, 'GuiLogGroupName', {
      value: this.guiLogGroup.logGroupName,
      description: 'GUI Lambda log group name',
    });
  }

  /**
   * Configure Lambda function to use pre-created log group
   */
  public configureFunction(fn: lambda.Function, logGroup: logs.LogGroup): void {
    // The function will automatically use the log group if names match
    logGroup.grantWrite(fn);
  }
}
