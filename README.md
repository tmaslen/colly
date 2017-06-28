Colly
=====

Another serverless framework for AWS Lambda and API Gateway.

## Init a new Lambda

```
colly init-lambda --lambda_name <NAME_OF_LAMBDA>
```

## Run a lambda locally

```
colly run-lambda --name <NAME_OF_LAMBDA> --local
```

You can pass the Lambda an event object (use a JSON file in your project directory):

```
colly run-lambda --name <NAME_OF_LAMBDA> --local --event <RELATIVE_PATH_TO_JSON_FILE>
```