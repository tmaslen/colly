Colly
=====

Another serverless framework for AWS Lambda and API Gateway.

## Instructions

### Init a new Lambda

```
colly init-lambda --lambda_name <NAME_OF_LAMBDA>
```

### Run a lambda locally

```
colly run-lambda --name <NAME_OF_LAMBDA> --local
```

You can pass the Lambda an event object (use a JSON file in your project directory):

```
colly run-lambda --name <NAME_OF_LAMBDA> --local --event <RELATIVE_PATH_TO_JSON_FILE>
```

### Deploy a lambda

```
colly deploy-lambda --name <NAME_OF_LAMBDA> --aws_profile <AWS_PROFILE_NAME>
```

### Run a deployed lambda from the CLI

```
colly run-lambda --name <NAME_OF_LAMBDA> --aws_profile <AWS_PROFILE_NAME>
```

You can pass the deployed Lambda an event object (use a JSON file in your project directory):

```
colly run-lambda --name <NAME_OF_LAMBDA> --event <RELATIVE_PATH_TO_JSON_FILE> --aws_profile <AWS_PROFILE_NAME>
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
	}
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