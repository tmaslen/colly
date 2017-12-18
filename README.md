Colly
=====

Another serverless framework for AWS Lambda and API Gateway.

## Installing

Step 1: Create an AWS IAM role for colly to use when running. Give the role the following policy document:

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "events:DeleteRule",
                "events:PutRule",
                "events:PutTargets",
                "events:RemoveTargets",
                "iam:AttachRolePolicy",
                "iam:CreateRole",
                "iam:GetRole",
                "iam:GetUser",
                "iam:PassRole",
                "lambda:AddPermission",
                "lambda:CreateFunction",
                "lambda:GetFunction",
                "lambda:InvokeFunction",
                "lambda:ListFunctions",
                "lambda:RemovePermission",
                "lambda:UpdateFunctionCode",
                "lambda:UpdateFunctionConfiguration",
                "logs:DescribeLogStreams",
                "logs:FilterLogEvents",
                "sts:*"
            ],
            "Effect": "Allow",
            "Resource": "*"
        }
    ]
}
```

Step 2: install colly locally.

```
npm install colly
```

Step 3: make colly easy to run using a shortcut in your project's `package.json` file.

```
// Example package.json file
{
	"scripts": {
		"colly": "./node_modules/colly/bin/colly"
	}
}
```

Step 4: create a `colly.json` file in the root of your project. To begin with all you need to reference is the name of the IAM policy you created in the step above:

```
{
	"awsProfile": "collyRunner"
}
```

Step 5: run colly.

```
npm run colly -- <COMMAND> --<PARAM_NAME> <PARAM_VALUE>
```

See a list of command instructions below.

## Command instructions

### Init a new Lambda

```
colly init-lambda --lambda_name <NAME_OF_LAMBDA>
```

### Run a lambda locally

```
colly run-lambda --name <NAME_OF_LAMBDA> --local
```

You can pass the Lambda an event object (use a JSON file in your project directory) and a context object (use a JS file in your project directory):

```
colly run-lambda --name <NAME_OF_LAMBDA> --local --event <RELATIVE_PATH_TO_JSON_FILE> --context <RELATIVE_PATH_TO_JS_FILE>
```

Note the context object will need to export an object literal.

When running a lambda locally, colly will attempt to assume the lambda's IAM role. This will enable the lambda to run with the same permissions locally as when it is ran from AWS.

### Deploy a lambda

```
colly deploy-lambda --name <NAME_OF_LAMBDA> --aws_profile <AWS_PROFILE_NAME>
```

When deploying a lambda for the first time, a role will be created for it. This role will be similarly named as the lambda and will be given the `AWSLambdaBasicExecutionRole` action.

By default your Lambda will run with the absolute minimum AWS privileges a Lambda is given (`AWSLambdaBasicExecutionRole`). If you want your Lambda to access any additional AWS services then you need to create an [IAM Policy]() and provide Colly with its ARN value.

Add the policy ARN value to the `colly.json` file or the Lambda function config file using the property `customRolePolicyArn`. The value in the Lambda function file will take precedence. For example:

```
{
    "customRolePolicyArn": "arn:aws:iam::777788889999:policy/myCustomPolicy"
}
```

### Run a deployed lambda from the CLI

```
colly run-lambda --name <NAME_OF_LAMBDA> --aws_profile <AWS_PROFILE_NAME>
```

You can pass the deployed Lambda an event object (use a JSON file in your project directory):

```
colly run-lambda --name <NAME_OF_LAMBDA> --event <RELATIVE_PATH_TO_JSON_FILE> --aws_profile <AWS_PROFILE_NAME>
```

### Get logs from AWS

Creating a log output for NodeJS running on AWS Lambda is very simple. Lambda will log any `console.log` (or even `console.trace` ) to AWS Cloudwatch logs. There is no setup required.

However AWS Cloudwatch Logs batches all logs up into collections based on time. Scanning through these can be cumbersome as each batch has its own page in the AWS console.

A better way to view the logs for your Lambda is to use the command `colly log-watch`. This will take all of your logs and display them in one place.

Get the logs for the lambda:

```
colly watch-log --name myLambda --aws_profile colly_tester
```

Search the logs for a key word of phrase:

```
colly watch-log --name myLambda --aws_profile colly_tester --search error
colly watch-log --name myLambda --aws_profile colly_tester --search "foo bar"
```

Tail logs:

```
colly watch-log --name myLambda --aws_profile colly_tester --search error --tail
```

Search from a moment in time:

```
colly watch-log --name myLambda --aws_profile colly_tester --search error --tail --start_time 2017-09-01
```

### Encrypting environment variables

While its possible to encrypt environment variables when they are uploaded to AWS Lambda, using encrypted environment variables will mean your code will need to behave differently when running it locally compared to when its deployed. If you have data that you want to encrypt, then if its to be part of your repo you don't want it to be lying around unencrypted.

With this feature you can encrypt a value (for example an API key) and store it in your project config (the `colly.json` file) immediately without the unencrypted value ever being written into a file.

To enable this functionality you need to create a AWS KMS key and store it in your `colly.json` file.

```
colly encrypt-var --name <NAME_OF_ENV_VAR> --value <VALUE_OF_ENV_VAR> --aws_profile <AWS_PROFILE_NAME>
```

You can also get the encrypted values decrypted using this command:

```
colly decrypt-var --name <NAME_OF_ENV_VAR> --aws_profile <AWS_PROFILE_NAME>
```

Use the `--env` flag to set which environment colly file you want to edit. For example:

```
colly encrypt-var --name <NAME_OF_ENV_VAR> --value <VALUE_OF_ENV_VAR> --env test
```

### Config file

You can define configuration for colly using config files. By default colly will look for a `colly.json` file in the root of your project. You can also define a colly file for each work pipeline you want to setup.

For example you can have a test as well as a live pipeline. Example colly config files:

 * `colly.json` will be used by default.
 * `colly.live.json` will also be used by default.
 * `colly.test.json` will be used if you add the param `--env test` onto any colly task command.

Here's an example with all the options you can define:

```
{
	"region": "eu-west-1", // AWS Region you are working from
	"awsProfile": "<PROFILE_NAME>" // The name of the AWS profile you want to authenticate your AWS session with.
	"useBastion": true // set to true if you want to authenticate your AWS session via a bastion service.
	"bastionService": {
		"endpoint": "<URL_TO_BASTION_SERVICE>",
		"certPath": "<ABSOLUTE_PATH_TO_CERT>",
		"cloudServicesRoot": "<ABSOLUTE_PATH_TO_ROOT_FILE>"
	},
	"vpcConfig": {
		"SubnetIds": [ "<SUBNET_ID_1>", "<SUBNET_ID_2>" ], // Minimum of 2 subnets must be provided
		"SecurityGroupIds": [ "SECURITY_GROUP_ID" ]
	},
	"kmsKeyArn": "<KMS_KEY_ARN>",
	"customRolePolicyArn": "<POLICY_ARN>",
    "additionalDeploymentAssets": [ <ARRAY OF ADDITIONAL FILES TO DEPLOY],
    "nameTemplate": "${name}--TEST"
}
```

#### `additionalDeploymentAssets`

By default Colly will create a module tree of all the requires Node modules (NodeJS files that are required in from other NodeJS files) and deploy them when you run the `deploy-lambda` command. Sometimes your Lambda may depend on files that are not referenced using the `require` command which will not be picked up by Colly.

To ensure Colly does deploy these additional assets, you can reference them in the config file. Create a property called `additionalDeploymentAssets` in the config file, use this to define an array of additional asssets for deployments. These should be relative paths from the base of your project. For example:

```
{
    "additionalDeploymentAssets": [
        "package.json",
        "data/dataFile.json",
        "textFiles/fileFullOfText.txt"
    ]
}
```

## Developing

Configuration is done with environment variables. To run a node module directly (rather than via the commands in the `bin`) you need to set environment variables. Use this pattern:

```
env <VAR_NAME>="<VAR_VALUE>" node lib/<MODULE_NAME>
```

For example...

```
env COLLY__PROJECT_DIR="./test/fixtures/deploy-lambda" ENV="live" node lib/deploy-lambda
```

## Testing

There are unit tests that can be ran with this command...

```
npm test
```

Some of the tasks need to be manually tested. Here are command examples of running these...

```
env COLLY__PROJECT_DIR="/<LOCAL_PATH_TO_PROJECT_DIR>/colly/test/fixtures/deploy-lambda" npm run colly deploy-lambda -- --name myLambda --aws_profile colly_tester
```