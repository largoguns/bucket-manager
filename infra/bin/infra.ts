#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MockServiceStack } from '../lib/infra-stack';

const projectName = "mockserver";
const parentStageName = getValue(process.env.ENVIRONMENT, "dev");
const stageName = getValue(process.env.FEATURENAME, parentStageName);

console.log("parentStageName", parentStageName);
console.log("stageName", stageName);
console.log("projectName", projectName);

const app = new cdk.App({
  context: {
    parentStageName,
    stageName,
    projectName
  }
});

new MockServiceStack(app, `${stageName}-${projectName}-MockService`, {
  env: {
    region: process.env.AWS_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT
  }
});

const commonTags: { [key: string]: string } = {
  Owner: "ARCHITECTURE",
  Environment: process.env.Environment ?? "Development",
  CostCenter: "Sonora",
  Domain: "ARCHITECTURE",
  BoundedContext: "API REST Mock Server for external integrations",
  Security: "N/A",
  Compliance: "N/A"
};

for (const [key, value] of Object.entries(commonTags)) {
  cdk.Tags.of(app).add(key, value);
}

function getValue(input: any, defaultValue: string) {
  if (input === null || input === undefined || input.trim() === "") {
    return defaultValue;
  }
  return input;
}