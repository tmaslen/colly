const fs  = require( "fs" );
const AWS = require( "aws-sdk" );
const _   = require( "lodash" );
const ncp = require( "ncp" ).ncp;

const utils = require( "../utils" );
const scheduledEvent = require( "./scheduledEvent" );

function configShouldBeUpdated( newConfig, projectConfig, deployedConfig ) {

    const deployedEnvVars = ( deployedConfig.Environment ) ? deployedConfig.Environment.Variables : {};
    const newEnvVars = projectConfig.environmentVariables || {};

    var shouldUpdate = false;

    if ( 
        ( newConfig.handler     !== deployedConfig.Handler     ) ||
        ( newConfig.memorySize  !== deployedConfig.MemorySize  ) ||
        ( newConfig.timeout     !== deployedConfig.Timeout     ) ||
        ( newConfig.runtime     !== deployedConfig.Runtime     ) ||
        ( newConfig.description !== deployedConfig.Description ) ||
        !_.isEqual( newEnvVars, deployedEnvVars ) ||
        ( projectConfig.vpcConfig !== deployedConfig.VpcConfig )
    ) {
        shouldUpdate = true;
    }
    return shouldUpdate;
}

function updateLambdaConfig ( lambda, config, projectConfig, deployedConfig ) {

    if ( configShouldBeUpdated( config, projectConfig, deployedConfig ) ) {
                
        console.log( "Updating configuration..." );

        const params = {
            "FunctionName": utils.getLambdaName(),
            "Description":  config.description,
            "Environment": {
                "Variables": projectConfig.environmentVariables
            },
            "Runtime":      config.runtime,
            "Role":         config.roleArn,
            "Handler":      config.handler,
            "MemorySize":   config.memorySize,
            "Timeout":      config.timeout
        };

        if ( projectConfig.vpcConfig ) {
            params.VpcConfig = projectConfig.vpcConfig;
        }

        lambda.updateFunctionConfiguration( params, ( err ) => {

            if ( err ) {
                console.log( err );
            } else {
                console.log( "Config update complete." );
            }

        });

    }
    console.log( "Code update complete." );

}

function deployToLambda( zipFilePath ) {

    console.log( "Deploying zip to Lambda..." );

    console.log( `Using the file ${zipFilePath}` );

    const projectConfig = utils.getProjectConfig();

    const config = utils.getLambdaConfigFile();

    AWS.config.region = projectConfig.region;

    var lambda = new AWS.Lambda();

    const params = {
        "FunctionName": utils.getLambdaName(), 
        "Publish": true,
        "ZipFile": fs.readFileSync( zipFilePath )
    };

    lambda.updateFunctionCode( params, ( err, deployedConfig ) => {

        if ( err ) {

            console.log(err, err.stack);

        } else {
            
            updateLambdaConfig ( lambda, config, projectConfig, deployedConfig );

        }

    });

}

const updater = {

    "dryRun": function () {
        utils.prepLambdaDeployStagingDir()
            .then( utils.copyAllFilesToDistDir )
            .then( utils.copyAdditionalFiles )
            .then( utils.zipFile )
            .catch( console.log );
    },

    "wetRun": function () {
        utils.prepLambdaDeployStagingDir()
            .then( utils.copyAllFilesToDistDir )
            .then( utils.copyAdditionalFiles )
            .then( utils.zipFile )
            .then( deployToLambda )
            .then( scheduledEvent.init )
            .catch( console.log );
    },

    "init": function () {
        console.log( "Updating lambda..." );
        if ( process.env.COLLY__DEPLOY_DRY_RUN == "true" ) {
            updater.dryRun();
        }
        else {
            updater.wetRun();
        }
    }

};

updater.configShouldBeUpdated = configShouldBeUpdated;

module.exports = updater;