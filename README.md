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
colly run-lambda --name <NAME_OF_LAMBDA>
```

You can pass the deployed Lambda an event object (use a JSON file in your project directory):

```
colly run-lambda --name <NAME_OF_LAMBDA> --event <RELATIVE_PATH_TO_JSON_FILE>
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