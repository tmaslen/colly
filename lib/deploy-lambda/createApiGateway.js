var AWS     = require( "aws-sdk" );
const fs    = require( "fs" );
const chalk = require( "chalk" );
const _     = require( "lodash" );

const utils                  = require( "../utils" );
const cloudformationTemplate = require( "../templates/cf-template--api-gateway.json" );

function createApiGateway() {

    return new Promise( ( resolve, reject ) => {

        const config = utils.getLambdaConfigFile();

    	var cloudformation = new AWS.CloudFormation({apiVersion: '2010-05-15'});

        // Do something here if you want to edit cloudformation config

    	var params = {
    	    "StackName": utils.getLambdaName(),
    	    "Capabilities": [ "CAPABILITY_IAM" ],
            "OnFailure": "ROLLBACK",
            "Parameters": [{
                "ParameterKey":     "LambdaARN",
                "ParameterValue":   config.deployedAssets[ process.env.ENV ].lambdaArn,
                "UsePreviousValue": false
    	    },{
                "ParameterKey":     "ApiName",
                "ParameterValue":   utils.getLambdaName(),
                "UsePreviousValue": false
            },{
                "ParameterKey":     "ApiDescription",
                "ParameterValue":   config.description,
                "UsePreviousValue": false
            }],
    	    "TemplateBody": JSON.stringify( cloudformationTemplate ),
    	};
    	cloudformation.createStack(params, ( err, data ) => {
    	    if ( err ) {
                reject( err );
            } else {
                resolve();
            }
    	});

    });

}

function eventIsNotCreateOrFailedForCfn( event ) {
    const eventNamesToCheck = [ "CREATE_COMPLETE", "CREATE_FAILED" ];
    return ( eventNamesToCheck.indexOf( event.ResourceStatus ) == -1 ) || 
           ( event.ResourceType !== "AWS::CloudFormation::Stack" );
}

function eventIsCreateCompleteForCfn( event ) {
    return ( event.ResourceStatus === "CREATE_COMPLETE" ) && 
           ( event.ResourceType   === "AWS::CloudFormation::Stack" );
}

function createMsg ( event ) {

    const statusColours = {
        "CREATE_IN_PROGRESS": chalk.yellow,
        "CREATE_FAILED":      chalk.red,
        "CREATE_COMPLETE":    chalk.green,
        "DELETE_IN_PROGRESS": chalk.gray,
        "DELETE_FAILED":      chalk.red,
        "DELETE_COMPLETE":    chalk.gray,
        "DELETE_SKIPPED":     chalk.gray,
        "UPDATE_IN_PROGRESS": chalk.yellow,
        "UPDATE_FAILED":      chalk.red,
        "UPDATE_COMPLETE":    chalk.green
    };

    return statusColours[ event.ResourceStatus ](
        `${_.padEnd( event.ResourceStatus, 20 )} ${_.padEnd( event.ResourceType, 30 )} ${_.padEnd( event.LogicalResourceId, 30 )} ${event.ResourceStatusReason || ""}`
    );
}

function addConsoleOutputHeaders() {
    process.stdout.write(
        chalk.gray(
            `${_.padEnd( "Status", 20 )} ${_.padEnd( "Type", 30 )} ${_.padEnd( "Id", 30 )} Reason\n`
        )
    );
    return Promise.resolve();
}

function displayStackOutputs() {

    return new Promise( ( resolve, reject ) => {

        const config = utils.getLambdaConfigFile();

        var cloudformation = new AWS.CloudFormation({apiVersion: '2010-05-15'});

        cloudformation.describeStacks({
            "StackName": utils.getLambdaName()
        }, ( err, data ) => {

            if ( err ) {
                throw new Error( err );
            }

            process.stdout.write( "\nOutputs\n=======\n" );
            process.stdout.write( `${_.padEnd( "Name", 20 )} ${_.padEnd( "Name", 40 )}\n` );

            process.stdout.write( `${_.padEnd( "----", 20, "-" )} ${_.padEnd( "", 60, "-" )}\n` );

            var outputs = {};

            data.Stacks[ 0 ].Outputs.forEach( ( output ) => {

               process.stdout.write( `${_.padEnd( output.OutputKey, 20 )} ${output.OutputValue}\n` ); 

               outputs[ output.OutputKey ] = output.OutputValue;

            });

            resolve( outputs );

        });

    });

}

function checkStackStatus( consoledStackEventIds ) {

    const config = utils.getLambdaConfigFile();

    consoledStackEventIds = consoledStackEventIds || [];

    return new Promise( ( resolve, reject ) => {

        var cloudformation = new AWS.CloudFormation({apiVersion: '2010-05-15'});

        cloudformation.describeStackEvents({
            "NextToken": "1",
            "StackName": utils.getLambdaName()
        }, ( err, data ) => {

            if ( err ) {

                reject( "Stack no longer exists, presumed DELETED." );

            } else {

                const events = data.StackEvents.reverse();

                events.forEach( ( event) => {
                    if ( consoledStackEventIds.indexOf( event.EventId ) == -1 ) {
                        process.stdout.write( `${createMsg( event )}\n` );
                        consoledStackEventIds.push( event.EventId );
                    }
                });

                if ( 
                    ( events.length === 0 ) ||
                    eventIsNotCreateOrFailedForCfn( _.last( events ) )
                ) {
                    setTimeout( () => {
                        checkStackStatus( consoledStackEventIds )
                            .then( resolve );
                    }, 2000);
                }

                if (
                    ( events.length === 0 ) || 
                    eventIsCreateCompleteForCfn( _.last( events ) )
                ) {
                    resolve();
                }

            }

        });

    });
}

function init () {
    return new Promise( ( resolve, reject ) => {
        createApiGateway()
            .then( addConsoleOutputHeaders )
            .then( checkStackStatus )
            .then( displayStackOutputs )
            .then( resolve )
            .catch( reject );
    });
}

module.exports = {
    "init": init
}