#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraTenantUserPoolStack } from '../lib/infra-tenant-user-pool-stack';

const app = new cdk.App();
new InfraTenantUserPoolStack(app, 'InfraTenantUserPoolStack',{
  stackName: 'infra-tenant-user-pool'
});