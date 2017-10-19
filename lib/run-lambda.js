const fs = require( "fs" );
const AWS = require( "aws-sdk" );

const utils = require( "./utils" );

function getLambdaEventFile () {

	const path = `${process.env.COLLY__PROJECT_DIR}/${process.env.COLLY__LAMBDA_EVENT_FILE}`;

	if ( fs.existsSync( path ) ) {
		return JSON.parse( fs.readFileSync( path, "utf8" ) );
    } else {
    	console.log( "WARNING: Event file not found." );
    	return {};
    }

}

function getLambdaContextFile () {

	const defaultContext = {
		"done": () => {}
	};

	const path = `${process.env.COLLY__PROJECT_DIR}/${process.env.COLLY__LAMBDA_CONTEXT_FILE}`;

	if ( fs.existsSync( path ) ) {
		return require( path );
	} else {
		return defaultContext;
	}

}

function runningLocally () {
	return JSON.parse( process.env.COLLY__RUN_LAMBDA_LOCAL );
}

function runLocally () {

	return new Promise ( ( resolve, reject ) => {

		const projectConfig = utils.getProjectConfig();

        utils.addLambdaEnvironmentVariablesToProcess( projectConfig.environmentVariables );

        utils.setAwsRegion();

        utils.assumeLambdaRole().then( () => {

			const config = utils.getLambdaConfigFile();

			const lambdaHandler = getLambdaHandler();

			lambdaHandler(
				getLambdaEventFile(),
				getLambdaContextFile(),
				function callback( err, data ) {
					if ( err ) {
						reject( err );
					}
					resolve( data );
				}
			);

		}).catch( console.log );

	});

}

function runDeployedLamda () {
	
	utils.setAwsRegion();
	const config = utils.getLambdaConfigFile();
	const lambda = new AWS.Lambda();
	const params = {
		"FunctionName": utils.getLambdaName(),
		"InvocationType": "RequestResponse",
		"Payload": JSON.stringify( getLambdaEventFile() ),
		"LogType": "Tail"
	};

	lambda.invoke(params, function(err, data) {
		if ( err ) {
			console.log( err );
		} else {
			if ( data.LogResult ) {
				console.log( "Status code: ")
				console.log( data.StatusCode );
				console.log( "Payload: " )
				console.log( JSON.parse( data.Payload ) );
				console.log( "Lambda log:" );
				console.log( Buffer.from( data.LogResult, "base64" ).toString() );
			}
		}
	});

}

function getLambdaHandler() {
	try {
		return require( utils.getLambdaFilePath() )[ utils.getLambdaHandlerName() ];
	}
	catch( err ) {
		console.log( "Error: Cannot find the lambda you are trying to run. Check the `--name` or the handler property in the lambda's function file.");
		throw err;
	}
}

function init () {

	return new Promise( ( resolve, reject ) => {

		if ( runningLocally() ) {
			runLocally()
				.then( ( data ) => {
					console.log( data );
					resolve( data );
				})
				.catch( reject );
		} else {
			utils
				.authenticate()
				.then( runDeployedLamda )
				.catch( console.log );
		}
		resolve();

	});

}

module.exports = {
	"getLambdaContextFile": getLambdaContextFile,
	"getLambdaEventFile": getLambdaEventFile,
	"init": init,
	"runLocally": runLocally,
	"runningLocally": runningLocally
}