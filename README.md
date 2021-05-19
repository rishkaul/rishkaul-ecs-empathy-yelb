# ECS Empathy Workshop

1. Create a public load balanced UI service using ECS Fargate
2. Create an internal AppServer using ECS Fargate
3. Make AppServer discoverable to UI by name
4. Allow connections from UI service to AppServer
5. Persistence layer is created separately using Cfn templates (out of scope) - has to be in the same VPC

## Useful commands

 * `npm install`     install dependencies
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk destroy`     destroy the resources
