import * as cdk from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import {Peer, Port} from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import {LogDriver} from "@aws-cdk/aws-ecs";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';

export class EcsEmpathyYelbStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        /* Boilerplate from: https://docs.aws.amazon.com/cdk/latest/guide/ecs_example.html */
        const yelbEcsVpc = new ec2.Vpc(this, "EcsYelbVpc", {
            maxAzs: 3 // Default is all AZs in region
        });

        const yelbEcsCluster = new ecs.Cluster(this, "EcsYelbCluster", {
            clusterName: 'EcsYelbCluster',
            vpc: yelbEcsVpc
        });

        const yelbCloudMapNamespace = new servicediscovery.PrivateDnsNamespace(this, 'yelbNamespace', {
            name: 'yelbNamespace',
            vpc: yelbEcsVpc
        });

        const yelbUiService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "YelbUIService", {
            cluster: yelbEcsCluster,
            serviceName: 'YelbUIService',
            cpu: 512,
            desiredCount: 3,
            /*
             Can be defined as separate task definition
             But taskImageOptions and taskDefinition props have to be mutually exclusive
            */
            taskImageOptions: {
                image: ecs.ContainerImage.fromRegistry("mreferre/yelb-ui:0.6"),
                containerPort: 80,
                environment: {
                    /* Consumed at UI startup and helps discover AppServer by name */
                    'SEARCH_DOMAIN': yelbCloudMapNamespace.namespaceName
                }
            },
            memoryLimitMiB: 2048,
            publicLoadBalancer: true
        });

        const yelbAppServerTaskDef = new ecs.FargateTaskDefinition(this, 'YelbAppServerTaskDef', {
            /*
             Can define these at container level, however need to ensure CDK doesn't set a default at task level
             because then there's a constraint violation
            */
            cpu: 512,
            memoryLimitMiB: 2048
        });
        yelbAppServerTaskDef.addContainer('YelbAppServerContainer', {
            image: ecs.ContainerImage.fromRegistry("mreferre/yelb-appserver:0.5"),
            environment: {
                'RACK_ENV': 'custom',
                /*
                 Setup separately using this template, need to be in the same VPC as the ECS cluster
                 https://wildrydes-mreferre.s3-eu-west-1.amazonaws.com/Yelb-cloudformation-EC2-Postgres-redis.yaml
                */
                'REDIS_SERVER_ENDPOINT': 'ip-10-0-115-244.us-west-2.compute.internal',
                'YELB_DB_SERVER_ENDPOINT': 'ip-10-0-97-220.us-west-2.compute.internal',
                'SEARCH_DOMAIN': yelbCloudMapNamespace.namespaceName /* Not really required, but AppServer does consume this (safely) */
            },
            logging: LogDriver.awsLogs({
                streamPrefix: 'YelbAppServerContainer'
            })
        });

        const yelbAppServerService = new ecs.FargateService(this, "YelbAppServerService", {
            cluster: yelbEcsCluster,
            serviceName: 'YelbAppServerService',
            desiredCount: 3,
            taskDefinition: yelbAppServerTaskDef,
            /*
             UI steps, converted into CDK
             https://aws.amazon.com/blogs/aws/amazon-ecs-service-discovery/
            */
            cloudMapOptions: {
                name: "yelb-appserver", /* Needs to be this exact string, expected by UI service */
                cloudMapNamespace: yelbCloudMapNamespace,
                /*
                 This ttl help much as there are multiple levels of caching,
                 need to forcefully update UI service after every AppServer update
                */
                dnsTtl: cdk.Duration.seconds(10)
            }
        });
        yelbAppServerService.connections.allowFrom(
            yelbUiService.service,
            /* Copied from BONES initial commit, does work but looking at the UI Service available subnets, can possibly break */
            /* Peer.ipv4(ecsCluster.vpc.vpcCidrBlock), */
            Port.tcp(4567), /* https://stackoverflow.com/questions/59710635/how-to-connect-aws-ecs-applicationloadbalancedfargateservice-private-ip-to-rds */
            'Local VPC Access'
        );
    }
}
