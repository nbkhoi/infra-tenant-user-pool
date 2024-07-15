import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as targets from 'aws-cdk-lib/aws-events-targets';
export class InfraTenantUserPoolStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create eventbridge bus
    const eventBus = new events.EventBus(this, 'TenantEventBus', {
      eventBusName: this.stackName + '-tenant-eb',
    });

    // Create lambda function role
    const lambdaRole = new iam.Role(this, 'TenantLambdaRole', {
      roleName: this.stackName + '-tenant-lambda-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
      ],
      // Inline policy to allow lambda to put events
      inlinePolicies: {
        PutEventsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['events:PutEvents'],
              resources: [eventBus.eventBusArn],
            }),
          ],
        }),
      },
    });

    // Create lambda function to handle events on the bus
    const postConfirmationLambdaFunction = new lambda.Function(this, 'PostConfirmationLambdaFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/lambda/post-confirmation'),
      environment: {
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
      role: lambdaRole,
    });

    // Create cognito user pool
    const userPool = new cognito.UserPool(this, 'TenantUserPool', {
      userPoolName: this.stackName + '-tenant-up',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: { email: true },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create user pool client
    const userPoolClient = new cognito.UserPoolClient(this, 'TenantUserPoolClient', {
      userPool,
      userPoolClientName: this.stackName + '-tenant-upc',
      generateSecret: false,
    });

    // Assign the Lambda Trigger to the PostConfirmation event
    userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmationLambdaFunction);

    // Create a Rule on EventBridge to handle events from the Bus
    const rule = new events.Rule(this, 'TenantCreatedRule', {
      eventBus,
      eventPattern: {
        source: ['my.cognito'],
        detailType: ['UserCreated'],
      },
      targets: [],
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'EventBusArn', {
      value: eventBus.eventBusArn,
    });
    new cdk.CfnOutput(this, 'PostConfirmationLambdaFunctionArn', {
      value: postConfirmationLambdaFunction.functionArn,
    });
  }
}
