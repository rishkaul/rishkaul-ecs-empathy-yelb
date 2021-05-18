#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { EcsEmpathyYelbStack } from '../lib/ecs_empathy_yelb-stack';

const app = new cdk.App();
new EcsEmpathyYelbStack(app, 'EcsEmpathyYelbStack');
