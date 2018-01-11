const AWS = require( "aws-sdk" );

const utils = require( "./index" );

module.exports = function createIamRole ( resourceName, policyArn, customRolePolicyArn ) {

    const projectConfig = utils.getProjectConfig();

    AWS.config.region = projectConfig.region;

    return new Promise( ( resolve, reject ) => {

        const config = utils.getLambdaConfigFile();

        const roleName = `${resourceName}Role`;

        const roleArnKey = `${resourceName}RoleArn`;

        const roleArnValue = utils.getValueFromLambdaConfig( `deployedAssets.${process.env.LAMBDA__ENV}.${roleArnKey}` );

        if ( roleArnValue ) {
            console.log( `${roleName} already defined in the file "${utils.getLambdaConfigFilePath()}.`);
            resolve( roleArnValue );
            return;
        }

        const iam = new AWS.IAM();

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
                            utils.addValueToLambdaConfig( `deployedAssets.${process.env.LAMBDA__ENV}.${roleArnKey}`, data.Role.Arn );
                            iam.attachRolePolicy({
                                "RoleName": roleName,
                                "PolicyArn" : policyArn
                            }, ( err ) => {
                                if ( !err ) {

                                    if ( customRolePolicyArn ) {

                                        iam.attachRolePolicy({
                                            "RoleName": roleName,
                                            "PolicyArn" : customRolePolicyArn
                                        }, ( err ) => {
                                            if ( !err ) {

                                                setTimeout( () => {
                                                    resolve( data.Role.Arn )
                                                }, 2000 );

                                            } else {
                                                reject( err );
                                            }
                                        });

                                    } else {
                                        resolve( data.Role.Arn );
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
                utils.addValueToLambdaConfig( `deployedAssets.${process.env.LAMBDA__ENV}.${roleArnKey}`, data.Role.Arn );
                resolve( data.Role.Arn );

            }
        });

    });

}