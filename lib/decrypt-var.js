var AWS = require( "aws-sdk" );

const utils = require( "./utils" );

function decrypt ( varName, externalDecrypt ) {

	return new Promise( ( resolve, reject ) => {

		function callDecryptMethod ( params, cb, externalEncrypt ) {
			if ( externalDecrypt ) {
				externalDecrypt( params, cb);
			} else {
				let kms = new AWS.KMS();
				kms.decrypt( params, cb );
			}
		}

		const params = {
			"CiphertextBlob": new Buffer( utils.getProjectConfig().environmentVariables[ varName ], "base64" )
		};

		callDecryptMethod( params, ( err, data ) => {
			if (err) {
				reject( err );
			} else {
				resolve( data.Plaintext.toString() );
			}
		})

	});

}

function commandLineArgsAreValid ( varName ) {

	return ( varName !== null ) && ( utils.getProjectConfig().environmentVariables[ varName ] !== undefined );

}

function init ( varName ) {

	utils.authenticate().then( () => {

		if ( commandLineArgsAreValid( varName ) ) {

			const projectConfig = utils.getProjectConfig();
			AWS.config.region = projectConfig.region;
			decrypt( varName )
				.then( console.log )
				.catch( console.log );

		} else {

			console.log( "ERROR: no variable defined. Please use the `--name` option to state a var that matches an environment variable in the colly.json file to decrypt" );

		}

	});

}

module.exports = {
	"decrypt": decrypt,
	"init": init
}