const AWS    = require( "aws-sdk" );
const prompt = require( "prompt" );

const utils = require( "./utils" );

function encrypt ( varName, varValue, externalEncrypt ) {

	function callEncryptMethod ( params, cb, externalEncrypt ) {
		if ( externalEncrypt ) {
			externalEncrypt( params, cb);
		} else {
			let kms = new AWS.KMS();
			kms.encrypt( params, cb );
		}
	}

	const params = {
		"KeyId": utils.getProjectConfig().kmsKeyArn,
		"Plaintext": varValue
	};

	callEncryptMethod( params, function( err, data ) {
		if ( err ) {
			console.log( err );
		} else {
			utils.addEnvVarToProjectConfig( varName, data.CiphertextBlob.toString( "base64" ) );
		}
	}, externalEncrypt);
 
}

function commandLineArgsAreValid ( a, b ) {
	console.log( a, b );
	return a && b;
}

function validateAndEnsure ( varName, varValue ) {

	return new Promise( ( resolve, reject ) => {

		if ( commandLineArgsAreValid( varName, varValue ) ) {

			console.log( `You are about to set "${varName}" to an encrypted value of "${varValue}" in the file "${utils.getProjectConfigFilePath()}"`)

			prompt.start();

			prompt.get([ { "message": "Are you sure you want to add this? (Y/n)" } ], ( err, results ) => {

				if ( !err && ( [ "y", "Y" ].indexOf( results.question ) > -1 ) ) {
					encrypt( varName, varValue );
					resolve();
				} else {
					if ( err ) {
						console.log( err );
					}
					reject( "Encryption rejected" );
				}

			});

		} else {
			reject( "ERROR: no variable name or variable value param defined. Please use the `--name` and `--value` options to state a var to encrypt" );
		}

	});

}

function init ( varName, varValue ) {

	utils.authenticate().then( () => {
		const projectConfig = utils.getProjectConfig();
		AWS.config.region = projectConfig.region;
		validateAndEnsure( varName, varValue );
	});

}

module.exports = {
	"encrypt": encrypt,
	"init": init
}