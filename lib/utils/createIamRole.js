const AWS = require( "aws-sdk" );

const utils = require( "./index" );

const projectConfig = utils.getProjectConfig();

AWS.config.region = projectConfig.region;

module.exports = function createIamRole ( resourceName ) {

    return new Promise( ( resolve, reject ) => {

        const config = utils.getLambdaConfigFile();

        const roleName = `${resourceName}Role`;

        const roleArnKey = `${resourceName}RoleArn`;

        const roleArnValue = utils.getValueFromLambdaConfig( `deployedAssets.${process.env.ENV}.${roleArnKey}` );

        if ( roleArnValue ) {
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
                            utils.addValueToLambdaConfig( `deployedAssets.${process.env.ENV}.${roleArnKey}`, data.Role.Arn );
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
                utils.addValueToLambdaConfig( `deployedAssets.${process.env.ENV}.${roleArnKey}`, data.Role.Arn );
                resolve();

            }
        });

    });

}