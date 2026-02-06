/// <reference path="./.sst/platform/config.d.ts" />

// Project configuration constants
const PROJECT_NAME: string = "arbitrum-miniapp"; // Must be set by developer, must only contain alphanumeric characters and hyphens
const CUSTOMER: string = "wakeup"; // Must be set by developer, must only contain alphanumeric characters and hyphens

export default $config({
  app(input) {
    return {
      name: PROJECT_NAME,
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          defaultTags: {
            tags: { customer: CUSTOMER, stage: input.stage },
          },
        },
      },
    };
  },
  async run() {
    let vpc: sst.aws.Vpc | undefined = undefined;
    // Remove if no static IP is required
    if ($app.stage === "production") {
      vpc = new sst.aws.Vpc("arbitrum-miniapp-vpc", {
        nat: "ec2",
      });
    }

    // Load environment variables:
    // 1. From local .env file (for development)
    // 2. From GitHub vars JSON (for CI/CD - automatically injected by workflow)
    const dotenv = await import("dotenv");
    dotenv.config();


    const DOMAIN_URL = process.env.DOMAIN_URL!;
    const UI_URL = `https://${DOMAIN_URL}`;

    const API_DOMAIN_URL = `api.${DOMAIN_URL}`;
    const API_URL = `https://${API_DOMAIN_URL}`;

    const allowedOrigins = [
      UI_URL,
      API_URL,
      ...($app.stage !== "production"
        ? [
          "http://localhost:3000", // for local development
          "http://localhost:9999", // for API dev server
        ]
        : []),
    ];

    // deploy api - all env vars are passed automatically!
    const apiFunction = new sst.aws.Function(`${PROJECT_NAME}-api`, {
      vpc: vpc,
      handler: "packages/api/src/index.handler",
      environment: {
        NODE_ENV: $app.stage,
        DATABASE_URL: process.env.DATABASE_URL!,
      },
    });

    // deploy API Gateway with custom domain
    // CORS: Allow any origin for simplicity
    const api = new sst.aws.ApiGatewayV2("gateway", {
      domain: API_DOMAIN_URL,
      cors: {
        allowOrigins: allowedOrigins,
        allowMethods: [
          "GET",
          "POST",
          "PUT",
          "DELETE",
          "PATCH",
          "OPTIONS",
        ],
        allowHeaders: ["*"],
      },
    });

    // Add routes to connect API Gateway to the function
    api.route("ANY /{proxy+}", apiFunction.arn);
    api.route("ANY /", apiFunction.arn);

    // Create IAM role for cross-account CloudWatch Logs access
    // This allows the software provider to assume this role from their AWS account
    // and access CloudWatch logs through the AWS console
    const supportUserArn = process.env.SUPPORT_USER_ARN;
    let cloudwatchLogsRoleArn: any = undefined;
    let apiFunctionLogsUrl: any = undefined;

    if (supportUserArn) {
      const aws = await import("@pulumi/aws");

      // Get AWS region for constructing CloudWatch Logs URLs
      const region = aws.getRegionOutput();

      // Construct CloudWatch Logs URLs for resources
      // Access the actual log group name from the Function's nodes property
      apiFunctionLogsUrl = apiFunction.nodes.logGroup.apply((logGroup) => {
        if (!logGroup) return null;
        // logGroup can be a string (log group name) or a LogGroup object
        const logGroupNameOutput =
          typeof logGroup === 'string'
            ? $output(logGroup)
            : logGroup.name;
        return region.name.apply((regionName) =>
          logGroupNameOutput.apply(
            (logGroupName) =>
              `https://${regionName}.console.aws.amazon.com/cloudwatch/home?region=${regionName}#logsV2:log-groups/log-group/${encodeURIComponent(logGroupName)}`,
          ),
        );
      });

      const cloudwatchLogsRole = new aws.iam.Role(
        `${PROJECT_NAME}-cloudwatch-logs-access`,
        {
          assumeRolePolicy: aws.iam.getPolicyDocumentOutput({
            statements: [
              {
                effect: "Allow",
                principals: [
                  {
                    type: "AWS",
                    identifiers: [supportUserArn],
                  },
                ],
                actions: ["sts:AssumeRole"],
              },
            ],
          }).json,
          inlinePolicies: [
            {
              name: "CloudWatchLogsReadOnly",
              policy: aws.iam.getPolicyDocumentOutput({
                statements: [
                  {
                    effect: "Allow",
                    actions: [
                      "logs:DescribeLogStreams",
                      "logs:FilterLogEvents",
                      "logs:GetLogEvents",
                      "logs:GetLogGroupFields",
                      "logs:GetLogRecord",
                      "logs:StartQuery",
                      "logs:StopQuery",
                      "logs:TestMetricFilter",
                      "logs:DescribeMetricFilters",
                      "logs:DescribeQueries",
                    ],
                    resources: [
                      "arn:aws:logs:*:*:log-group:*",
                      "arn:aws:logs:*:*:log-group:*:*",
                    ],
                    conditions: [
                      {
                        test: "StringEquals",
                        variable: "aws:ResourceTag/customer",
                        values: [CUSTOMER],
                      },
                      {
                        test: "StringEquals",
                        variable: "aws:ResourceTag/stage",
                        values: [$app.stage],
                      },
                    ],
                  },
                ],
              }).json,
            },
          ],
          tags: {
            customer: CUSTOMER,
            stage: $app.stage,
            purpose: "cloudwatch-logs-access",
          },
        },
        {
          protect: $app.stage === "production",
        },
      );

      cloudwatchLogsRoleArn = cloudwatchLogsRole.arn;
    }

    // deploy ui
    const ui = new sst.aws.StaticSite(`${PROJECT_NAME}-ui`, {
      build: {
        command: "npm run build:ui",
        output: "packages/ui/dist",
      },
      domain: DOMAIN_URL,
      environment: {
        NODE_ENV: $app.stage,
        VITE_API_URL: $interpolate`${api.url}`,
      },
      assets: {
        textEncoding: "utf-8",
        fileOptions: [
          {
            files: ["**/*.css", "**/*.js", "**/*.mjs"],
            cacheControl: "max-age=31536000,public,immutable",
          },
          {
            files: "**/*.html",
            cacheControl: "max-age=0,no-cache,no-store,must-revalidate",
          },
          {
            files: [
              "**/*.png",
              "**/*.jpg",
              "**/*.jpeg",
              "**/*.gif",
              "**/*.svg",
              "**/*.ico",
              "**/*.pdf",
              "**/*.webp",
            ],
            cacheControl: "max-age=2592000,public,immutable",
          },
          {
            files: ["**/*.ttf", "**/*.woff", "**/*.woff2"],
            cacheControl: "max-age=31536000,public,immutable",
          },
        ],
      },
      indexPage: "index.html",
      errorPage: "index.html"
    });

    return {
      api: api.url,
      ui: ui.url,
      ...(supportUserArn && apiFunctionLogsUrl && {
        cloudwatchLogsUrl: apiFunctionLogsUrl
      }),
    };
  },
});
