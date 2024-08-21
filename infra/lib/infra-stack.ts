import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_lambda as lambda,
  aws_apigateway as apigateway,
  aws_s3 as s3,
  aws_iam as iam,
  RemovalPolicy
} from 'aws-cdk-lib';

export class MockServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const parentStageName = this.node.tryGetContext("parentStageName");
    const projectName = this.node.tryGetContext("projectName");

    console.log(">> ParentStageName", parentStageName);
    console.log(">> ProjectName", projectName);

    const mockBucket = new s3.Bucket(this, `${parentStageName}-${projectName}-mockresponsesbucket`, {
      bucketName: `${parentStageName}-${projectName}-mockresponsesbucket`,
      versioned: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Definir el rol IAM que será asumido por la Lambda usando el token de Cognito
    const assumeRole = new iam.Role(this, `${parentStageName}-${projectName}-AssumeRole`, {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          "StringEquals": {
            "cognito-identity.amazonaws.com:aud": "eu-south-2:7501cfb3-5175-4b54-8b74-cc9692bffdba"  // Reemplaza con tu ID de identidad de Cognito
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated"
          }
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      description: "Role assumed by Lambda through Web Identity Federation to access S3",
      inlinePolicies: {
        S3AccessPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["s3:*"],
              resources: [mockBucket.bucketArn, `${mockBucket.bucketArn}/*`],
            })
          ]
        })
      }
    });

    // Lambda function
    const proxyLambda = new lambda.Function(this, `${parentStageName}-${projectName}-proxylambda`, {
      functionName: `${parentStageName}-${projectName}-proxylambda`,
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('../lambda'),
      handler: 'index.handler',
      environment: {
        BUCKET_NAME: mockBucket.bucketName,
        ROLE_ARN: assumeRole.roleArn,  // Pasar el ARN del rol a la Lambda
      },
    });

    mockBucket.grantReadWrite(proxyLambda);  // Esto es opcional si quieres que la Lambda también tenga acceso directo sin STS

    // API Gateway
    const api = new apigateway.LambdaRestApi(this, `${parentStageName}-${projectName}-mockapi`, {
      restApiName: `${parentStageName}-${projectName}-mockapi`,
      handler: proxyLambda,
      proxy: true,
    });
  }
}
