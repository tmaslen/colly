const AWS = require( "aws-sdk" );
const fs  = require( "fs" );

const manageScheduledEvent = require( "./scheduledEvent" ).init;
const utils = require( "../utils" );
const createIamRole = require( "../utils/createIamRole" );

const lambdaBasicExecutionArn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole";

function createLambda ( zipFilePath ) {
    return new Promise( ( resolve, reject ) => {

        console.log( zipFilePath );

        console.log( "Deploying zip to Lambda..." );

        const projectConfig = utils.getProjectConfig();

        const config = utils.getLambdaConfigFile();

        AWS.config.region = projectConfig.region;
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
                reject( err );
                return;
            }
            console.log( "lambda created" );
            utils.addValueToLambdaConfig( `deployedAssets.${process.env.LAMBDA__ENV}.${utils.getLambdaName()}Arn`, data.FunctionArn );
            resolve();
        });

    });
}

function getCustomPolicyArn () {
    const config = utils.getLambdaConfigFile();
    const projectConfig = utils.getProjectConfig();
    return config.customRolePolicyArn || projectConfig.customRolePolicyArn || null;
}

const creator = {

    "dryRun": function () {
        utils.prepLambdaDeployStagingDir()
            .then( utils.copyAllFilesToDistDir )
            .then( utils.copyAdditionalFiles )
            .then( utils.zipFile )
            .catch( console.log );
    },

    "wetRun": function () {
        createIamRole( utils.getLambdaName(), lambdaBasicExecutionArn, getCustomPolicyArn() )
            .then( utils.prepLambdaDeployStagingDir )
            .then( utils.copyAllFilesToDistDir )
            .then( utils.copyAdditionalFiles )
            .then( utils.zipFile )
            .then( createLambda )
            .then( manageScheduledEvent )
            .catch( console.log );
    },

    "init": function () {
        console.log( "creating lambda..." );
        if ( process.env.COLLY__DRY_RUN == "true" ) {
            creator.dryRun();
        }
        else {
            creator.wetRun();
        }
    }

};

module.exports = creator;
