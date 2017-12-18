const AWS = require( "aws-sdk" );
const fs  = require( "fs" );

const manageScheduledEvent = require( "./scheduledEvent" ).init;
const utils = require( "../utils" );
const createIamRole = require( "../utils/createIamRole" );

const projectConfig = utils.getProjectConfig();

AWS.config.region = projectConfig.region;

const lambdaRoleName = `${utils.getLambdaName()}Role`;

const lambdaBasicExecutionArn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole";

function createLambda ( zipFilePath ) {

    console.log( zipFilePath );

    console.log( "Deploying zip to Lambda..." );

    const config = utils.getLambdaConfigFile();

    const lambda = new AWS.Lambda();

    const lambdaRoleArnKey = utils.getLambdaRoleArnKey();

    console.log( `roleARN: ${lambdaRoleArnKey}`);

    var params = {
        "FunctionName": utils.getLambdaName(),
        "Description": config.description,
        "Environment": {
            "Variables": projectConfig.environmentVariables
        },
        "Publish": true,
        "Code": {
            "ZipFile": fs.readFileSync( zipFilePath )
        },
        "Runtime":    config.runtime,
        "Role":       lambdaRoleArnKey,
        "Handler":    config.handler,
        "MemorySize": config.memorySize,
        "Timeout":    config.timeout
    };

    if ( projectConfig.vpcConfig ) {
        params.VpcConfig = projectConfig.vpcConfig;
    }

    lambda.createFunction( params, ( err, data ) => {
        if ( err ) {
            console.log(err, err.stack);
        } else {
            console.log( "lambda created" );
            utils.addValueToLambdaConfig( `deployedAssets.${process.env.ENV}.${lambdaRoleName}Arn`, data.FunctionArn );
        }
    });

}

function getCustomPolicyArn () {
    const config = utils.getLambdaConfigFile();
    return config.customRolePolicyArn || projectConfig.customRolePolicyArn || null;
}

module.exports = function init () {
    console.log( "creating lambda..." );
    createIamRole( utils.getLambdaName(), lambdaBasicExecutionArn, getCustomPolicyArn() )
        .then( utils.prepLambdaDeployStagingDir )
        .then( utils.copyAllFilesToDistDir )
        .then( utils.copyAdditionalFiles )
        .then( utils.zipFile )
        .then( createLambda )
        .then( manageScheduledEvent )
        .catch( console.log );
    
}
