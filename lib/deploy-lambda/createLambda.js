var AWS                 = require( "aws-sdk" );
const fs                = require( "fs" );

const utils             = require( "../utils" );

const projectConfig = utils.getProjectConfig();

AWS.config.region = projectConfig.region;

function createLambda( zipFilePath ) {

    console.log( zipFilePath );

    console.log( "Deploying zip to Lambda..." );

    const config = utils.getLambdaConfigFile();

    var lambda = new AWS.Lambda();

    console.log( "roleARN: " + config.deployedAssets[ process.env.ENV ].roleArn );

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
        "Role":       config.deployedAssets[ process.env.ENV ].roleArn,
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
            utils.addValueToLambdaConfig( `deployedAssets.${process.env.ENV}.lambdaArn`, data.FunctionArn );
        }
    });

}

function createRoleForLambda() {

    return new Promise( ( resolve, reject ) => {

        const config = utils.getLambdaConfigFile();

        const roleName = `${utils.getLambdaName()}Role`;

        const roleArn = ( process.env.ENV in config.deployedAssets ) ? config.deployedAssets[ process.env.ENV ].roleArn : null;

        if ( ( typeof roleArn === "string" ) && ( roleArn !== "" ) ) {
            console.log( `${roleName} already defined in the file "${utils.getLambdaConfigFilePath()}.`);
            resolve();
            return;
        }

        var iam = new AWS.IAM();

        iam.getRole({
            "RoleName": roleName
        }, function(err, data) {
            if ( err && ( err.code === "NoSuchEntity" ) ) {
            
                console.log( "Creating role..." );

                iam.getUser({
                    "UserName": utils.getProjectConfig.awsProfile
                }, ( err, collyUserData ) => {

                    const params = {
                        "AssumeRolePolicyDocument": JSON.stringify( {
                            "Version": "2012-10-17",
                            "Statement": [{
                                "Effect": "Allow",
                                "Principal": { "Service": ["lambda.amazonaws.com"] },
                                "Action": ["sts:AssumeRole"]
                            },{
                                "Effect": "Allow",
                                "Principal": { "AWS": collyUserData.User.Arn },
                                "Action": ["sts:AssumeRole"]
                            }]
                        } ),
                        "Path": "/", 
                        "RoleName": roleName
                    };
                    iam.createRole(params, function(err, data) {
                        if ( err ) {
                            reject( err );
                        } else {
                            utils.addValueToLambdaConfig( `deployedAssets.${process.env.ENV}.roleArn`, data.Role.Arn );
                            iam.attachRolePolicy({
                                "RoleName": roleName,
                                "PolicyArn" : "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
                            }, ( err ) => {
                                if ( !err ) {

                                    const customRolePolicyArn = config.customRolePolicyArn || projectConfig.customRolePolicyArn || null;

                                    if ( customRolePolicyArn ) {

                                        iam.attachRolePolicy({
                                            "RoleName": roleName,
                                            "PolicyArn" : customRolePolicyArn
                                        }, ( err ) => {
                                            if ( !err ) {

                                                setTimeout( () => {
                                                    resolve()
                                                }, 1000 );

                                            } else {
                                                reject( err );
                                            }
                                        });

                                    } else {
                                        resolve();
                                    }

                                } else {
                                    reject( err );
                                }
                            });
                        }
                    });

                });

            } else if ( err ) {

                reject( err );

            } else {

                console.log( roleName + " already exists in your AWS account.");
                utils.addValueToLambdaConfig( `deployedAssets.${process.env.ENV}.roleArn`, data.Role.Arn );
                resolve();

            }
        });

    });

}

module.exports = function init () {
    console.log( "creating lambda..." );
    createRoleForLambda()
        .then( utils.prepLambdaDeployStagingDir )
        .then( utils.copyAllFilesToDistDir )
        .then( utils.copyAdditionalFiles )
        .then( utils.zipFile )
        .then( createLambda )
        .catch( console.log );
    
}
