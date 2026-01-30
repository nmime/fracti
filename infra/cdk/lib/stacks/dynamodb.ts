import $ from '@libs/constants';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';

export interface DynamoDBStackProps extends cdk.StackProps {
  stage: string;
}

export class DynamoDBStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDBStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const isProduction = stage === 'prod';

    // Single Table Design for expense splitting
    this.table = new dynamodb.Table(this, 'Table', {
      tableName: `fracti-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProduction },
      timeToLiveAttribute: 'TTL',
    });

    // GSI1: User-to-Group lookups (find all groups a user belongs to)
    this.table.addGlobalSecondaryIndex({
      indexName: $.dynamodb.gsi.gsi1,
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Entity lookups by ID (expenses, settlements by their unique ID)
    this.table.addGlobalSecondaryIndex({
      indexName: $.dynamodb.gsi.gsi2,
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI3: User activity timeline (expenses paid, settlements made)
    this.table.addGlobalSecondaryIndex({
      indexName: $.dynamodb.gsi.gsi3,
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Outputs
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name',
      exportName: `${stage}-fracti-table-name`,
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB table ARN',
      exportName: `${stage}-fracti-table-arn`,
    });
  }
}
